import json
import os
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from server.main import app, validate_host


@pytest.fixture
def client():
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

    validate_host("127.0.0.1", allow_non_loopback=False)
    validate_host("localhost", allow_non_loopback=False)
    validate_host("0.0.0.0", allow_non_loopback=True)


@patch("httpx.AsyncClient.get")
def test_api_status_ok(mock_get, client):
    """GET /api/status returns ok when Ollama has gemma2:2b"""
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "models": [{"name": "gemma2:2b"}, {"name": "llama3:latest"}]
    }
    mock_get.return_value = mock_resp

    response = client.get(
        "/api/status",
        headers={"Authorization": "Bearer test-secret-token-12345"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ollama"] == "ok"
    assert data["model"] == "gemma2:2b"


@patch("httpx.AsyncClient.get")
def test_api_status_model_missing(mock_get, client):
    """GET /api/status returns model_missing when gemma2:2b is not pulled"""
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"models": [{"name": "mistral:latest"}]}
    mock_get.return_value = mock_resp

    response = client.get(
        "/api/status",
        headers={"Authorization": "Bearer test-secret-token-12345"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ollama"] == "model_missing"


@patch("httpx.AsyncClient.post")
def test_api_generate_success_with_markdown_fences(mock_post, client):
    """POST /api/generate strips markdown fences and validates Pydantic model"""
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    # Raw response from Ollama wrapped in ```json ... ```
    mock_resp.json.return_value = {
        "response": '```json\n{"challenge": "Bois un grand verre d\'eau", "message": "Tiens bon Camille !"}\n```'
    }
    mock_post.return_value = mock_resp

    response = client.post(
        "/api/generate",
        headers={"Authorization": "Bearer test-secret-token-12345"},
        json={"prompt": "Camille a une envie de fumer après le café.", "expected_format": "craving"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["challenge"] == "Bois un grand verre d'eau"
    assert data["message"] == "Tiens bon Camille !"


def test_api_generate_extra_forbidden(client):
    """Item 5: Extra fields are strictly forbidden by Pydantic extra='forbid'"""
    response = client.post(
        "/api/generate",
        headers={"Authorization": "Bearer test-secret-token-12345"},
        json={
            "prompt": "Test prompt",
            "forbidden_extra_field": "injected",
        },
    )
    assert response.status_code == 422
