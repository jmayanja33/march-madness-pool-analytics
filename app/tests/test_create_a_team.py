"""
Tests for the POST /pool endpoint and the build_pool_team_summary service.

Service tests are fully isolated (no file I/O or network calls).
Endpoint tests use the HTTPX async client wired directly to the FastAPI app,
with the predictions-data loader mocked so no real JSON file is required.
"""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import build_pool_team_summary


# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

# Minimal raw team dict that satisfies build_pool_team_summary.
_MOCK_TEAM = {
    "name": "Duke",
    "tournament_seed": 1,
    "conference": "ACC",
    "wins": 30,
    "losses": 5,
    "avg_height": 78,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": {"0": 0.2, "1": 0.3, "2+": 0.5},
}

# Second team used in multi-team pool tests.
_MOCK_TEAM_2 = {
    "name": "Auburn",
    "tournament_seed": 1,
    "conference": "SEC",
    "wins": 28,
    "losses": 6,
    "avg_height": 79,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": {"0": 0.3, "1": 0.4, "2+": 0.3},
}


@pytest.fixture
async def client() -> AsyncClient:
    """Yield an async HTTPX client wired directly to the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# build_pool_team_summary — unit tests
# ---------------------------------------------------------------------------


def test_build_pool_team_summary_name() -> None:
    """Team name is preserved in the summary."""
    summary = build_pool_team_summary(_MOCK_TEAM)
    assert summary.name == "Duke"


def test_build_pool_team_summary_seed() -> None:
    """Tournament seed is mapped to the seed field."""
    summary = build_pool_team_summary(_MOCK_TEAM)
    assert summary.seed == 1


def test_build_pool_team_summary_conference() -> None:
    """Conference is preserved in the summary."""
    summary = build_pool_team_summary(_MOCK_TEAM)
    assert summary.conference == "ACC"


def test_build_pool_team_summary_win_distribution() -> None:
    """Win-probability distribution is correctly mapped from raw keys."""
    summary = build_pool_team_summary(_MOCK_TEAM)
    dist = summary.win_probability_distribution
    assert dist.zero_wins == 0.2
    assert dist.one_win == 0.3
    assert dist.two_plus_wins == 0.5


def test_build_pool_team_summary_missing_seed() -> None:
    """A team without tournament_seed defaults to seed 0."""
    team = {**_MOCK_TEAM, "tournament_seed": None}
    summary = build_pool_team_summary(team)
    assert summary.seed == 0


def test_build_pool_team_summary_missing_conference() -> None:
    """A team without a conference defaults to an empty string."""
    team = {k: v for k, v in _MOCK_TEAM.items() if k != "conference"}
    summary = build_pool_team_summary(team)
    assert summary.conference == ""


def test_build_pool_team_summary_empty_distribution() -> None:
    """Missing win-probability keys default to 0.0."""
    team = {**_MOCK_TEAM, "win_probability_distribution": {}}
    summary = build_pool_team_summary(team)
    dist = summary.win_probability_distribution
    assert dist.zero_wins == 0.0
    assert dist.one_win == 0.0
    assert dist.two_plus_wins == 0.0


# ---------------------------------------------------------------------------
# POST /pool — endpoint tests
# ---------------------------------------------------------------------------


async def test_pool_returns_200(client: AsyncClient) -> None:
    """POST /pool with a valid team name returns HTTP 200."""
    with patch("app.routers.pool.find_team", return_value=_MOCK_TEAM):
        response = await client.post("/create-a-team", json={"teams": ["Duke"]})
    assert response.status_code == 200


async def test_pool_returns_team_data(client: AsyncClient) -> None:
    """The response includes the expected team name and seed."""
    with patch("app.routers.pool.find_team", return_value=_MOCK_TEAM):
        response = await client.post("/create-a-team", json={"teams": ["Duke"]})
    data = response.json()
    assert data["teams"][0]["name"] == "Duke"
    assert data["teams"][0]["seed"] == 1


async def test_pool_skips_unknown_teams(client: AsyncClient) -> None:
    """Teams not found in the predictions data are omitted from the response."""
    with patch("app.routers.pool.find_team", return_value=None):
        response = await client.post("/create-a-team", json={"teams": ["Unknown Team"]})
    assert response.status_code == 200
    assert response.json()["teams"] == []


async def test_pool_multiple_teams(client: AsyncClient) -> None:
    """Multiple teams are resolved and returned in request order."""
    side_effects = [_MOCK_TEAM, _MOCK_TEAM_2]

    def find_team_side_effect(name: str):
        """Return mock teams in sequence, matching by name."""
        for team in side_effects:
            if team["name"].casefold() == name.casefold():
                return team
        return None

    with patch("app.routers.pool.find_team", side_effect=find_team_side_effect):
        response = await client.post(
            "/create-a-team", json={"teams": ["Duke", "Auburn"]}
        )
    data = response.json()
    assert len(data["teams"]) == 2
    assert data["teams"][0]["name"] == "Duke"
    assert data["teams"][1]["name"] == "Auburn"


async def test_pool_partial_resolution(client: AsyncClient) -> None:
    """Unknown teams are skipped while valid teams are still returned."""
    def find_team_side_effect(name: str):
        """Return mock data only for Duke; skip the unknown team."""
        if name.casefold() == "duke":
            return _MOCK_TEAM
        return None

    with patch("app.routers.pool.find_team", side_effect=find_team_side_effect):
        response = await client.post(
            "/create-a-team", json={"teams": ["Duke", "Unknown Team"]}
        )
    data = response.json()
    # Only Duke should appear in the response.
    assert len(data["teams"]) == 1
    assert data["teams"][0]["name"] == "Duke"


async def test_pool_empty_request(client: AsyncClient) -> None:
    """An empty teams list returns an empty response without errors."""
    response = await client.post("/create-a-team", json={"teams": []})
    assert response.status_code == 200
    assert response.json()["teams"] == []


async def test_pool_response_includes_win_distribution(client: AsyncClient) -> None:
    """Each team in the response includes a win-probability distribution."""
    with patch("app.routers.pool.find_team", return_value=_MOCK_TEAM):
        response = await client.post("/create-a-team", json={"teams": ["Duke"]})
    dist = response.json()["teams"][0]["win_probability_distribution"]
    assert "zero_wins" in dist
    assert "one_win" in dist
    assert "two_plus_wins" in dist


async def test_pool_response_includes_conference(client: AsyncClient) -> None:
    """Each team in the response includes the conference field."""
    with patch("app.routers.pool.find_team", return_value=_MOCK_TEAM):
        response = await client.post("/create-a-team", json={"teams": ["Duke"]})
    assert response.json()["teams"][0]["conference"] == "ACC"
