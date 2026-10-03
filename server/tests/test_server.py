import os
import pytest
from fastapi.testclient import TestClient

from server.main import app, validate_host


@pytest.fixture
def client():
    # Set a test access token
    os.environ["ACCESS_TOKEN"] = "test-secret-token-12345"
    with TestClient(app) as test_client:
        yield test_client


def test_401_without_token(client):
    """Item 4: /api route returns 401 when no token is provided"""
    response = client.get("/api/health")
    assert response.status_code == 401


def test_401_with_invalid_token(client):
    """Item 4: /api route returns 401 when an invalid token is provided"""
    response = client.get("/api/health", headers={"Authorization": "Bearer wrong-token"})
    assert response.status_code == 401


def test_200_with_valid_token(client):
    """Item 4: /api route returns 200 with the exact Bearer token"""
    response = client.get(
        "/api/health",
        headers={"Authorization": "Bearer test-secret-token-12345"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_security_headers_present(client):
    """Item 8: Security headers are present on responses"""
    response = client.get("/api/health")
    headers = response.headers
    assert "content-security-policy" in headers
    assert "default-src 'self'" in headers["content-security-policy"]
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["referrer-policy"] == "no-referrer"
    assert "permissions-policy" in headers


def test_refuses_non_loopback():
    """Item 1: Server refuses 0.0.0.0 or public interfaces unless explicitly allowed"""
    with pytest.raises(ValueError, match="Refusing to bind to non-loopback host"):
        validate_host("0.0.0.0", allow_non_loopback=False)

    with pytest.raises(ValueError, match="Refusing to bind to non-loopback host"):
        validate_host("192.168.1.50", allow_non_loopback=False)

    # Loopback addresses should succeed
    validate_host("127.0.0.1", allow_non_loopback=False)
    validate_host("localhost", allow_non_loopback=False)

    # When override is explicitly set, it does not raise
    validate_host("0.0.0.0", allow_non_loopback=True)
