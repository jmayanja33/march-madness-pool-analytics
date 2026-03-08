"""
Tests for the GET /power-rankings endpoint and the get_power_rankings service.

Service tests are fully isolated (no file I/O or network calls).
Endpoint tests use the HTTPX async client wired directly to the FastAPI app,
with the predictions-data loader mocked so no real JSON file is required.
"""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import get_power_rankings

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

# Team most likely to win 2+ games.
_TEAM_TWO_WINS = {
    "name": "Duke",
    "tournament_seed": 1,
    "conference": "ACC",
    "wins": 30,
    "losses": 5,
    "avg_height": 78,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": {"0": 0.1, "1": 0.3, "2+": 0.6},
}

# Team most likely to win exactly 1 game.
_TEAM_ONE_WIN = {
    "name": "Kentucky",
    "tournament_seed": 5,
    "conference": "SEC",
    "wins": 22,
    "losses": 10,
    "avg_height": 77,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": {"0": 0.2, "1": 0.5, "2+": 0.3},
}

# Team most likely to win 0 games.
_TEAM_ZERO_WINS = {
    "name": "Wagner",
    "tournament_seed": 16,
    "conference": "NEC",
    "wins": 18,
    "losses": 16,
    "avg_height": 75,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": {"0": 0.7, "1": 0.2, "2+": 0.1},
}

# Team without a tournament seed — should be excluded from rankings.
_TEAM_NO_SEED = {
    "name": "Not In Tournament",
    "tournament_seed": None,
    "conference": "Big Ten",
    "wins": 15,
    "losses": 15,
    "avg_height": 76,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": {"0": 0.5, "1": 0.3, "2+": 0.2},
}

_ALL_MOCK_TEAMS = [_TEAM_TWO_WINS, _TEAM_ONE_WIN, _TEAM_ZERO_WINS, _TEAM_NO_SEED]


@pytest.fixture
async def client() -> AsyncClient:
    """Yield an async HTTPX client wired directly to the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# get_power_rankings — unit tests
# ---------------------------------------------------------------------------


def test_two_wins_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is two_plus_wins land in two_wins."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    assert any(t.name == "Duke" for t in rankings["two_wins"])


def test_one_win_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is one_win land in one_win."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    assert any(t.name == "Kentucky" for t in rankings["one_win"])


def test_zero_wins_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is zero_wins land in zero_wins."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    assert any(t.name == "Wagner" for t in rankings["zero_wins"])


def test_non_tournament_teams_excluded() -> None:
    """Teams without a tournament_seed are excluded from all buckets."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    all_names = (
        [t.name for t in rankings["two_wins"]]
        + [t.name for t in rankings["one_win"]]
        + [t.name for t in rankings["zero_wins"]]
    )
    assert "Not In Tournament" not in all_names


def test_buckets_are_sorted_by_probability_descending() -> None:
    """Teams in each bucket are sorted from highest to lowest probability."""
    # Two teams in the two_wins bucket — higher probability should be first.
    team_a = {
        **_TEAM_TWO_WINS,
        "name": "Team A",
        "win_probability_distribution": {"0": 0.05, "1": 0.15, "2+": 0.80},
    }
    team_b = {
        **_TEAM_TWO_WINS,
        "name": "Team B",
        "win_probability_distribution": {"0": 0.10, "1": 0.30, "2+": 0.60},
    }
    with patch(
        "app.services.load_predictions", return_value=[team_a, team_b]
    ):
        rankings = get_power_rankings()
    names = [t.name for t in rankings["two_wins"]]
    assert names.index("Team A") < names.index("Team B")


def test_tiebreaker_is_alphabetical() -> None:
    """When two teams share a probability, they are sorted alphabetically."""
    team_z = {
        **_TEAM_TWO_WINS,
        "name": "Zebra University",
        "win_probability_distribution": {"0": 0.1, "1": 0.2, "2+": 0.7},
    }
    team_a = {
        **_TEAM_TWO_WINS,
        "name": "Apple State",
        "win_probability_distribution": {"0": 0.1, "1": 0.2, "2+": 0.7},
    }
    with patch(
        "app.services.load_predictions", return_value=[team_z, team_a]
    ):
        rankings = get_power_rankings()
    names = [t.name for t in rankings["two_wins"]]
    assert names.index("Apple State") < names.index("Zebra University")


def test_empty_predictions_returns_empty_buckets() -> None:
    """An empty predictions file produces three empty lists."""
    with patch("app.services.load_predictions", return_value=[]):
        rankings = get_power_rankings()
    assert rankings["two_wins"] == []
    assert rankings["one_win"] == []
    assert rankings["zero_wins"] == []


def test_all_teams_total_count() -> None:
    """Total ranked teams equals the number of seeded teams in predictions."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    total = (
        len(rankings["two_wins"])
        + len(rankings["one_win"])
        + len(rankings["zero_wins"])
    )
    # _TEAM_NO_SEED is excluded, so 3 out of 4 mock teams should appear.
    assert total == 3


# ---------------------------------------------------------------------------
# GET /power-rankings — endpoint tests
# ---------------------------------------------------------------------------


async def test_power_rankings_returns_200(client: AsyncClient) -> None:
    """GET /power-rankings returns HTTP 200."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        response = await client.get("/power-rankings")
    assert response.status_code == 200


async def test_power_rankings_response_has_all_buckets(client: AsyncClient) -> None:
    """The response contains two_wins, one_win, and zero_wins keys."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        response = await client.get("/power-rankings")
    data = response.json()
    assert "two_wins" in data
    assert "one_win" in data
    assert "zero_wins" in data


async def test_power_rankings_team_fields(client: AsyncClient) -> None:
    """Each ranked team includes name, seed, conference, and win distribution."""
    with patch("app.services.load_predictions", return_value=[_TEAM_TWO_WINS]):
        response = await client.get("/power-rankings")
    team = response.json()["two_wins"][0]
    assert team["name"] == "Duke"
    assert team["seed"] == 1
    assert team["conference"] == "ACC"
    assert "win_probability_distribution" in team


async def test_power_rankings_unseeded_teams_excluded(client: AsyncClient) -> None:
    """Teams without a seed do not appear in any bucket."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        response = await client.get("/power-rankings")
    data = response.json()
    all_names = (
        [t["name"] for t in data["two_wins"]]
        + [t["name"] for t in data["one_win"]]
        + [t["name"] for t in data["zero_wins"]]
    )
    assert "Not In Tournament" not in all_names


async def test_power_rankings_empty_predictions(client: AsyncClient) -> None:
    """An empty predictions file returns three empty lists with status 200."""
    with patch("app.services.load_predictions", return_value=[]):
        response = await client.get("/power-rankings")
    assert response.status_code == 200
    data = response.json()
    assert data["two_wins"] == []
    assert data["one_win"] == []
    assert data["zero_wins"] == []
