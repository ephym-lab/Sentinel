import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import decode_access_token


@pytest.fixture(scope="module", autouse=True)
def setup_test_client():
    with TestClient(app) as _:
        yield




client = TestClient(app)



def test_platform_bootstrap_and_login():
    # 1. Create first user with super_admin role (bootstrap mode)
    create_payload = {
        "name": "Super Admin Creator",
        "email": "superadmin@sentinel.ai",
        "role": "super_admin",
        "password": "supersecretpassword",
        "tenant_id": None
    }
    resp = client.post("/api/v1/users/", json=create_payload)
    assert resp.status_code == 201
    user_data = resp.json()
    assert user_data["role"] == "super_admin"
    assert user_data["email"] == "superadmin@sentinel.ai"

    # 2. Login and get access token
    login_payload = {
        "email": "superadmin@sentinel.ai",
        "password": "supersecretpassword"
    }
    resp = client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 200
    token_data = resp.json()
    assert token_data["token_type"] == "bearer"
    assert token_data["role"] == "super_admin"
    assert token_data["is_super_admin"] is True

    # 3. Decode token to verify claims
    payload = decode_access_token(token_data["access_token"])
    assert payload is not None
    assert payload["role"] == "super_admin"
    assert payload["is_super_admin"] is True
    assert payload["tenant_id"] is None


def test_platform_tenants_onboarding_and_impersonation():
    # Authenticate super_admin
    login_payload = {
        "email": "superadmin@sentinel.ai",
        "password": "supersecretpassword"
    }
    login_resp = client.post("/api/v1/auth/login", json=login_payload)
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Onboard a school tenant
    onboard_payload = {
        "id": "e22a6111-bf87-4340-9a3d-3df69d3000b0",
        "name": "KCA University Main Campus",
        "environment_type": "school"
    }
    resp = client.post("/api/v1/platform/tenants", json=onboard_payload, headers=headers)
    assert resp.status_code == 201
    tenant_data = resp.json()
    assert tenant_data["id"] == "e22a6111-bf87-4340-9a3d-3df69d3000b0"
    assert tenant_data["environment_type"] == "school"
    assert tenant_data["status"] == "active"
    assert tenant_data["config"]["escalation_delay_minutes"] == 5
    assert "roll_call" in tenant_data["config"]["enabled_features"]

    # 2. List tenants
    resp = client.get("/api/v1/platform/tenants", headers=headers)
    assert resp.status_code == 200
    tenants = resp.json()
    assert any(t["id"] == "e22a6111-bf87-4340-9a3d-3df69d3000b0" for t in tenants)

    # 3. Get tenant detail
    resp = client.get("/api/v1/platform/tenants/e22a6111-bf87-4340-9a3d-3df69d3000b0", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "KCA University Main Campus"

    # 4. Update tenant config
    new_config = tenant_data["config"]
    new_config["escalation_delay_minutes"] = 8
    update_payload = {
        "name": "KCA University Main Campus",
        "config": new_config
    }
    resp = client.put("/api/v1/platform/tenants/e22a6111-bf87-4340-9a3d-3df69d3000b0", json=update_payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["config"]["escalation_delay_minutes"] == 8

    # 5. Impersonate tenant
    resp = client.post("/api/v1/platform/tenants/e22a6111-bf87-4340-9a3d-3df69d3000b0/impersonate", headers=headers)
    assert resp.status_code == 200
    imp_data = resp.json()
    assert imp_data["impersonated_tenant_id"] == "e22a6111-bf87-4340-9a3d-3df69d3000b0"
    
    # Verify impersonated token claims
    imp_payload = decode_access_token(imp_data["access_token"])
    assert imp_payload["tenant_id"] == "e22a6111-bf87-4340-9a3d-3df69d3000b0"

    assert imp_payload["is_super_admin"] is True


def test_platform_health_endpoints():
    login_payload = {
        "email": "superadmin@sentinel.ai",
        "password": "supersecretpassword"
    }
    login_resp = client.post("/api/v1/auth/login", json=login_payload)
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Cameras Health
    resp = client.get("/api/v1/platform/health/cameras", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # 2. ML Service Health
    resp = client.get("/api/v1/platform/health/ml-service", headers=headers)
    assert resp.status_code == 200
    ml_health = resp.json()
    assert "cpu_utilization" in ml_health
    assert "gpu_utilization" in ml_health

    # 3. Queues Health
    resp = client.get("/api/v1/platform/health/queues", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # 4. System Errors
    resp = client.get("/api/v1/platform/health/errors", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_support_tickets_and_audit_logs():
    login_payload = {
        "email": "superadmin@sentinel.ai",
        "password": "supersecretpassword"
    }
    login_resp = client.post("/api/v1/auth/login", json=login_payload)
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create support ticket
    ticket_payload = {
        "tenant_id": "e22a6111-bf87-4340-9a3d-3df69d3000b0",
        "subject": "Camera offline notification test",
        "description": "The campus front gate camera is showing offline status"
    }

    resp = client.post("/api/v1/platform/support-tickets", json=ticket_payload, headers=headers)
    assert resp.status_code == 201
    ticket = resp.json()
    assert ticket["status"] == "open"
    assert ticket["subject"] == "Camera offline notification test"

    # 2. List support tickets
    resp = client.get("/api/v1/platform/support-tickets", headers=headers)
    assert resp.status_code == 200
    tickets = resp.json()
    assert len(tickets) > 0

    # 3. Resolve ticket
    resp = client.put(f"/api/v1/platform/support-tickets/{ticket['id']}/resolve", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"

    # 4. Fetch audit logs
    resp = client.get("/api/v1/platform/audit-log", headers=headers)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) > 0
    # Impersonation and config update actions should be logged
    actions = [l["action"] for l in logs]
    assert "impersonate_tenant" in actions
    assert "update_config" in actions
