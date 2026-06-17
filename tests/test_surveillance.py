import uuid
import random
import math
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.db.base import SharedBase, TenantBase, engine

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure database tables are initialized and then cleaned up."""
    # Since lifespan is triggered on TestClient context manager start:
    with TestClient(app) as _:
        yield
    # No cleanup required for in-memory or transient test.db sqlite file


@patch("app.services.ml_client.ml_client.process_frame", new_callable=AsyncMock)
def test_full_surveillance_flow(mock_process_frame):
    # 1. Create a Tenant
    tenant_id = f"test-tenant-{random.randint(1000, 9999)}"
    tenant_payload = {
        "id": tenant_id,
        "name": "Test Academy",
        "mode": "school"
    }
    response = client.post("/api/v1/tenants/", json=tenant_payload)
    assert response.status_code == 201
    assert response.json()["id"] == tenant_id

    # 2. Register a Camera for the Tenant
    camera_id = str(uuid.uuid4())
    camera_payload = {
        "id": camera_id,
        "name": "Gate Camera",
        "location": "Front Gate A",
        "is_active": True
    }
    # We must pass the X-Tenant-ID header
    response = client.post(
        "/api/v1/cameras/",
        json=camera_payload,
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 201
    assert response.json()["id"] == camera_id

    # 3. Create a Person of Interest (POI)
    poi_id = str(uuid.uuid4())
    # Generate 512-dim dummy normalized embedding
    raw_emb = [random.uniform(-1, 1) for _ in range(512)]
    norm = math.sqrt(sum(x*x for x in raw_emb))
    poi_embedding = [x / norm for x in raw_emb]
    
    poi_payload = {
        "id": poi_id,
        "name": "Flagged Intruder",
        "notes": "Spotted loitering near back fence",
        "face_embedding": poi_embedding,
        "reid_embedding": None
    }
    response = client.post(
        "/api/v1/pois/",
        json=poi_payload,
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 201
    assert response.json()["id"] == poi_id

    # 4. Mock ML service output for process-frame
    # We simulate a face match for our POI
    mock_process_frame.return_value = {
        "face_embeddings": [
            {
                "face_index": 0,
                "embedding": poi_embedding, # Exact match
                "bbox": [100, 100, 200, 200]
            }
        ],
        "reid_embeddings": [],
        "threat": {
            "is_threat": True,
            "fused_score": 0.82
        },
        "behaviors": [
            {
                "behavior": "fighting",
                "severity": "high",
                "confidence": 0.85
            }
        ],
        "fire_detections": [],
        "audio_events": []
    }

    # 5. Ingest a camera frame
    # Generate a dummy base64 string
    dummy_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    frame_payload = {
        "camera_id": camera_id,
        "image_b64": dummy_b64,
        "audio_b64": None
    }
    response = client.post(
        "/api/v1/surveillance/process-frame",
        json=frame_payload,
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["poi_detected"] is True
    assert len(res_data["poi_matches"]) == 1
    assert res_data["poi_matches"][0]["poi_id"] == poi_id
    assert res_data["incident_created"] is True
    
    incident_id = res_data["incident"]["id"]

    # 6. Retrieve incidents for the Tenant
    response = client.get(
        "/api/v1/incidents/",
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    assert len(response.json()) > 0
    assert response.json()[0]["id"] == incident_id

    # 7. Resolve the Incident
    resolve_payload = {
        "resolution_notes": "Guards dispatched and loiterer escorted off premises."
    }
    response = client.put(
        f"/api/v1/incidents/{incident_id}/resolve",
        json=resolve_payload,
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"
