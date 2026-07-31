from __future__ import annotations

from pathlib import Path
from fastapi.testclient import TestClient
from merinos_agent.api import create_app
from merinos_agent.config import Settings


def make_client(tmp_path: Path) -> TestClient:
    settings = Settings(environment="test", session_backend="memory", database_url=f"sqlite:///{tmp_path / 'api-test.db'}", jwt_secret="test-jwt-secret-00000000000000000000", redis_key_secret="test-redis-key-secret-0000000000000000", admin_password="ChangeMe123!", demo_mode=True)
    return TestClient(create_app(settings))


def test_health_and_product_contract(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        response = client.get("/health/ready")
        assert response.status_code == 200
        response = client.get("/api/v1/products", params={"color":"Krem", "size":"160x230"})
        assert response.status_code == 200
        payload = response.json()
        assert payload["data"]["total"] == 1
        assert payload["meta"]["requestId"] == response.headers["x-request-id"]


def test_order_validation_and_masking(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        invalid = client.get("/api/v1/orders/wrong/status")
        assert invalid.status_code == 422
        valid = client.get("/api/v1/orders/MRN-2026-1042/status")
        assert valid.status_code == 200
        assert valid.json()["data"]["cargoCode"].endswith("***")


def test_chat_session_and_idempotent_replay(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        request = {"clientMessageId":"message-00000001", "message":"Mavi 200x290 halı göster", "locale":"tr-TR"}
        first = client.post("/api/v1/chat/messages", json=request)
        assert first.status_code == 200
        data = first.json()["data"]
        assert data["sessionId"].startswith("demo_")
        assert data["reply"]["products"]
        request["sessionId"] = data["sessionId"]
        second = client.post("/api/v1/chat/messages", json=request)
        assert second.status_code == 200
        assert second.json()["data"] == data
        changed = {**request, "message":"Gri halı göster"}
        conflict = client.post("/api/v1/chat/messages", json=changed)
        assert conflict.status_code == 409


def test_admin_login_rbac_and_summary(tmp_path: Path) -> None:
    with make_client(tmp_path) as client:
        login = client.post("/api/v1/auth/login", json={"email":"admin@merinos.local", "password":"ChangeMe123!"})
        assert login.status_code == 200
        token = login.json()["data"]["accessToken"]
        summary = client.get("/api/v1/admin/summary", headers={"Authorization":f"Bearer {token}"})
        assert summary.status_code == 200
        assert summary.json()["data"]["orders"] == 2
        update = client.patch("/api/v1/admin/config", json={"enabled":False, "unknown":"ignored"}, headers={"Authorization":f"Bearer {token}"})
        assert update.status_code == 200
        assert update.json()["data"]["enabled"] is False
        assert "unknown" not in update.json()["data"]
