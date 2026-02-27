"""
Tests for the FastAPI application root and global endpoints.

Covers:
  - GET /  (health check)
  - GET /info
  - GET /analyze/{team}       (stub — expects 501 until implemented)
  - GET /analyze/most-similar/{team}  (stub — expects 501 until implemented)
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


# ---------------------------------------------------------------------------
# Shared async test client fixture
# ---------------------------------------------------------------------------


@pytest.fixture
async def client() -> AsyncClient:
    """Yield an async HTTPX client wired directly to the FastAPI app (no network)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# GET / — health check
# ---------------------------------------------------------------------------


async def test_root_status_code(client: AsyncClient) -> None:
    """GET / should return HTTP 200."""
    response = await client.get("/")
    assert response.status_code == 200


async def test_root_status_field(client: AsyncClient) -> None:
    """GET / response body should contain status='ok'."""
    response = await client.get("/")
    assert response.json()["status"] == "ok"


async def test_root_response_has_message(client: AsyncClient) -> None:
    """GET / response body should include a non-empty 'message' field."""
    response = await client.get("/")
    body = response.json()
    assert "message" in body
    assert len(body["message"]) > 0


# ---------------------------------------------------------------------------
# GET /info
# ---------------------------------------------------------------------------


async def test_info_status_code(client: AsyncClient) -> None:
    """GET /info should return HTTP 200."""
    response = await client.get("/info")
    assert response.status_code == 200


async def test_info_contains_project_key(client: AsyncClient) -> None:
    """GET /info response body should include a 'project' field."""
    response = await client.get("/info")
    assert "project" in response.json()


async def test_info_contains_model_key(client: AsyncClient) -> None:
    """GET /info response body should include a 'model' field."""
    response = await client.get("/info")
    assert "model" in response.json()


async def test_info_contains_data_source_key(client: AsyncClient) -> None:
    """GET /info response body should include a 'data_source' field."""
    response = await client.get("/info")
    assert "data_source" in response.json()


# ---------------------------------------------------------------------------
# GET /analyze/{team} — stub
# ---------------------------------------------------------------------------


async def test_analyze_team_returns_501(client: AsyncClient) -> None:
    """GET /analyze/{team} should return 501 Not Implemented until built out."""
    response = await client.get("/analyze/Duke")
    assert response.status_code == 501


# ---------------------------------------------------------------------------
# GET /analyze/most-similar/{team} — stub
# ---------------------------------------------------------------------------


async def test_analyze_most_similar_returns_501(client: AsyncClient) -> None:
    """GET /analyze/most-similar/{team} should return 501 until built out."""
    response = await client.get("/analyze/most-similar/Duke")
    assert response.status_code == 501
