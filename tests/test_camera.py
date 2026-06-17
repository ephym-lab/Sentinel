import io
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure TestClient context is active."""
    with TestClient(app) as _:
        yield


def test_camera_feed_management_flow():
    # 1. Create a Tenant
    tenant_id = str(uuid.uuid4())
    tenant_payload = {
        "id": tenant_id,
        "name": f"Feed Test Mall {uuid.uuid4()}",
        "mode": "mall"
    }
    response = client.post("/api/v1/tenants/", json=tenant_payload)
    assert response.status_code == 201

    # 2. Register a camera
    camera_id = str(uuid.uuid4())
    camera_payload = {
        "id": camera_id,
        "name": f"North Entrance Camera {uuid.uuid4()}",
        "zone": "North Wing",
        "camera_type": "face",
        "is_active": True
    }
    response = client.post(
        "/api/v1/cameras/",
        json=camera_payload,
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 201
    assert response.json()["id"] == camera_id
    assert response.json()["location"] == "North Wing"

    # 3. Upload a mock video feed (MP4 format)
    # File starts with ftyp for signature validation
    video_content = b"\x00\x00\x00\x14ftypmp42" + b"\x00" * 1000
    file_payload = {"file": ("test_entrance.mp4", io.BytesIO(video_content), "video/mp4")}
    
    response = client.post(
        f"/api/v1/cameras/{camera_id}/feed",
        files=file_payload,
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    camera_data = response.json()
    assert camera_data["active_feed"] is not None
    assert camera_data["active_feed"]["original_filename"] == "test_entrance.mp4"
    assert camera_data["active_feed"]["is_active"] is True
    assert camera_data["active_feed"]["preview_url"].startswith("/static/videos/sentinel_")
    
    first_feed_id = camera_data["active_feed"]["id"]

    # 4. Upload a second mock video feed (AVI format)
    # File starts with RIFF and AVI in header
    avi_content = b"RIFF\x00\x00\x00\x00AVI \x00" * 100
    file_payload_2 = {"file": ("test_entrance_2.avi", io.BytesIO(avi_content), "video/avi")}
    
    response = client.post(
        f"/api/v1/cameras/{camera_id}/feed",
        files=file_payload_2,
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    camera_data_2 = response.json()
    assert camera_data_2["active_feed"] is not None
    assert camera_data_2["active_feed"]["original_filename"] == "test_entrance_2.avi"
    
    # Check that our two feeds are listed under this camera
    feeds = camera_data_2["feeds"]
    assert len(feeds) >= 2
    first_feed = [f for f in feeds if f["id"] == first_feed_id][0]
    assert first_feed["is_active"] is False

    # 5. Get camera details
    response = client.get(
        f"/api/v1/cameras/{camera_id}",
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    assert len(response.json()["feeds"]) >= 2

    # 6. List all cameras
    response = client.get(
        "/api/v1/cameras/",
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    cameras = response.json()
    assert len(cameras) >= 1
    our_cam = [c for c in cameras if c["id"] == camera_id][0]
    assert our_cam["active_feed"]["original_filename"] == "test_entrance_2.avi"

    # 7. Delete the inactive feed
    response = client.delete(
        f"/api/v1/cameras/{camera_id}/feed/{first_feed_id}",
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    
    # 8. Confirm feed history shows the first feed is removed
    response = client.get(
        f"/api/v1/cameras/{camera_id}",
        headers={"X-Tenant-ID": tenant_id}
    )
    assert response.status_code == 200
    feeds_after = response.json()["feeds"]
    assert len([f for f in feeds_after if f["id"] == first_feed_id]) == 0
