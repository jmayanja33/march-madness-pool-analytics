"""
Tests for the FastAPI application root and global endpoints.

Covers:
  - GET /  (health check)
  - GET /info
  - GET /analyze/{team}               (now implemented — uses mocked predictions)
  - GET /analyze/most-similar/{team}  (stub — still 501)
"""

from unittest.mock import patch

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


# Minimal team dict that satisfies build_team_analysis without hitting disk.
_MOCK_TEAM = {
    "name": "Duke",
    "tournament_seed": 3,
    "wins": 35,
    "losses": 4,
    "avg_height": 79.0,
    "profile_summary": "A strong team.",
    "win_probability_distribution": {"0": 0.1, "1": 0.3, "2+": 0.6},
    "players": [
        {
            "name": f"Player {i}",
            "position": 0,
            "height": 75,
            "games": 30,
            "minutes": 1000 - i * 100,
            "points": 400 - i * 40,
            "free_throws_made": 50,
            "free_throws_attempted": 60,
            "two_point_field_goals_attempted": 100,
            "two_point_field_goals_made": 50,
            "three_point_field_goals_attempted": 60,
            "three_point_field_goals_made": 20,
            "blocks": 10,
            "offensive_rebounds": 15,
            "defensive_rebounds": 30,
            "turnovers": 20,
            "steals": 12,
            "fouls": 25,
        }
        for i in range(5)
    ],
}


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
# GET /analyze/{team}
# ---------------------------------------------------------------------------


async def test_analyze_team_returns_200_for_known_team(client: AsyncClient) -> None:
    """GET /analyze/{team} returns 200 when the team exists in the predictions."""
    with patch("app.routers.analyze.find_team", return_value=_MOCK_TEAM):
        response = await client.get("/analyze/Duke")
    assert response.status_code == 200


async def test_analyze_team_response_shape(client: AsyncClient) -> None:
    """GET /analyze/{team} response includes all expected top-level fields."""
    with patch("app.routers.analyze.find_team", return_value=_MOCK_TEAM):
        response = await client.get("/analyze/Duke")
    body = response.json()
    assert body["name"] == "Duke"
    assert body["seed"] == 3
    assert body["wins"] == 35
    assert body["losses"] == 4
    assert "top_players" in body
    assert "team_stats" in body
    assert "win_probability_distribution" in body
    assert "similar_teams" in body


async def test_analyze_team_similar_teams_empty(client: AsyncClient) -> None:
    """similar_teams is an empty list until ChromaDB integration is complete."""
    with patch("app.routers.analyze.find_team", return_value=_MOCK_TEAM):
        response = await client.get("/analyze/Duke")
    assert response.json()["similar_teams"] == []


async def test_analyze_team_returns_top_5_players(client: AsyncClient) -> None:
    """top_players contains at most 5 entries, sorted by minutes descending."""
    with patch("app.routers.analyze.find_team", return_value=_MOCK_TEAM):
        response = await client.get("/analyze/Duke")
    players = response.json()["top_players"]
    assert len(players) <= 5


async def test_analyze_team_returns_404_for_unknown_team(client: AsyncClient) -> None:
    """GET /analyze/{team} returns 404 when the team is not found."""
    with patch("app.routers.analyze.find_team", return_value=None):
        response = await client.get("/analyze/Nonexistent")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /analyze/most-similar/{team} — still a stub
# ---------------------------------------------------------------------------


async def test_analyze_most_similar_returns_501(client: AsyncClient) -> None:
    """GET /analyze/most-similar/{team} should return 501 until ChromaDB is wired up."""
    response = await client.get("/analyze/most-similar/Duke")
    assert response.status_code == 501
