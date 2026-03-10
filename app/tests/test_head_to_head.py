"""
Tests for the GET /head-to-head endpoint and the get_h2h_prediction service.

Service tests are fully isolated (no file I/O).
Endpoint tests use the HTTPX async client wired directly to the FastAPI app,
with the h2h data loader mocked so no real JSON file is required.
"""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import get_h2h_prediction

# ---------------------------------------------------------------------------
# Shared mock data
# ---------------------------------------------------------------------------

# Minimal h2h-predictions entries for testing.
_MOCK_H2H = [
    {
        "team1": {"name": "Duke", "win_probability": 0.72},
        "team2": {"name": "Kentucky", "win_probability": 0.28},
        "year": 2025,
    },
    {
        "team1": {"name": "North Carolina", "win_probability": 0.60},
        "team2": {"name": "Kansas", "win_probability": 0.40},
        "year": 2025,
    },
]


@pytest.fixture
async def client() -> AsyncClient:
    """Yield an async HTTPX client wired directly to the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# get_h2h_prediction — unit tests
# ---------------------------------------------------------------------------


def test_returns_prediction_in_stored_order() -> None:
    """Returns correct probabilities when request order matches stored order."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = get_h2h_prediction("Duke", "Kentucky")
    assert result is not None
    assert result.team1.name == "Duke"
    assert result.team1.win_probability == pytest.approx(0.72)
    assert result.team2.name == "Kentucky"
    assert result.team2.win_probability == pytest.approx(0.28)


def test_returns_prediction_in_reversed_order() -> None:
    """Swaps probabilities when request order is reversed relative to stored order."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = get_h2h_prediction("Kentucky", "Duke")
    assert result is not None
    # team1 in response should be Kentucky (the first arg)
    assert result.team1.name == "Kentucky"
    assert result.team1.win_probability == pytest.approx(0.28)
    assert result.team2.name == "Duke"
    assert result.team2.win_probability == pytest.approx(0.72)


def test_lookup_is_case_insensitive() -> None:
    """Name matching is case-insensitive."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = get_h2h_prediction("duke", "KENTUCKY")
    assert result is not None
    assert result.team1.win_probability == pytest.approx(0.72)


def test_returns_none_for_unknown_pair() -> None:
    """Returns None when no entry exists for the given team pair."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = get_h2h_prediction("Alabama", "Oregon")
    assert result is None


def test_returns_none_for_empty_predictions() -> None:
    """Returns None when the predictions list is empty."""
    with patch("app.services.load_h2h_predictions", return_value=[]):
        result = get_h2h_prediction("Duke", "Kentucky")
    assert result is None


# ---------------------------------------------------------------------------
# GET /head-to-head — endpoint tests
# ---------------------------------------------------------------------------


async def test_h2h_returns_200(client: AsyncClient) -> None:
    """GET /head-to-head returns HTTP 200 for a valid pair."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/head-to-head?team1=Duke&team2=Kentucky")
    assert response.status_code == 200


async def test_h2h_response_shape(client: AsyncClient) -> None:
    """The response contains team1 and team2 objects with name and win_probability."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/head-to-head?team1=Duke&team2=Kentucky")
    data = response.json()
    assert "team1" in data
    assert "team2" in data
    assert data["team1"]["name"] == "Duke"
    assert data["team1"]["win_probability"] == pytest.approx(0.72)
    assert data["team2"]["name"] == "Kentucky"
    assert data["team2"]["win_probability"] == pytest.approx(0.28)


async def test_h2h_reversed_order(client: AsyncClient) -> None:
    """Response maps probabilities to the request order, not the stored order."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/head-to-head?team1=Kentucky&team2=Duke")
    data = response.json()
    assert data["team1"]["name"] == "Kentucky"
    assert data["team2"]["name"] == "Duke"


async def test_h2h_returns_404_for_unknown_pair(client: AsyncClient) -> None:
    """GET /head-to-head returns 404 when no prediction exists for the pair."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/head-to-head?team1=Alabama&team2=Oregon")
    assert response.status_code == 404


async def test_h2h_returns_400_for_same_team(client: AsyncClient) -> None:
    """GET /head-to-head returns 400 when team1 and team2 are the same."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/head-to-head?team1=Duke&team2=Duke")
    assert response.status_code == 400


async def test_h2h_missing_team1_returns_422(client: AsyncClient) -> None:
    """GET /head-to-head returns 422 when team1 query param is missing."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/head-to-head?team2=Kentucky")
    assert response.status_code == 422


async def test_h2h_missing_team2_returns_422(client: AsyncClient) -> None:
    """GET /head-to-head returns 422 when team2 query param is missing."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/head-to-head?team1=Duke")
    assert response.status_code == 422
