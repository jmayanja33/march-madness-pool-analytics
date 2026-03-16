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

# All seven win-bucket keys required by the new 0–6 distribution format.
_FULL_DIST_ZERO  = {"0": 0.70, "1": 0.15, "2": 0.08, "3": 0.04, "4": 0.02, "5": 0.01, "6": 0.00}  # noqa: E501
_FULL_DIST_ONE   = {"0": 0.20, "1": 0.50, "2": 0.15, "3": 0.09, "4": 0.04, "5": 0.01, "6": 0.01}  # noqa: E501
_FULL_DIST_TWO   = {"0": 0.10, "1": 0.10, "2": 0.60, "3": 0.10, "4": 0.05, "5": 0.03, "6": 0.02}  # noqa: E501
_FULL_DIST_THREE = {"0": 0.05, "1": 0.10, "2": 0.15, "3": 0.50, "4": 0.10, "5": 0.07, "6": 0.03}  # noqa: E501
_FULL_DIST_FOUR  = {"0": 0.05, "1": 0.08, "2": 0.12, "3": 0.15, "4": 0.40, "5": 0.12, "6": 0.08}  # noqa: E501
_FULL_DIST_FIVE  = {"0": 0.03, "1": 0.05, "2": 0.10, "3": 0.12, "4": 0.20, "5": 0.35, "6": 0.15}  # noqa: E501
_FULL_DIST_SIX   = {"0": 0.02, "1": 0.04, "2": 0.08, "3": 0.10, "4": 0.16, "5": 0.20, "6": 0.40}  # noqa: E501

# Team most likely to win 2 games.
_TEAM_TWO_WINS = {
    "name": "Duke",
    "tournament_seed": 1,
    "conference": "ACC",
    "wins": 30,
    "losses": 5,
    "avg_height": 78,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": _FULL_DIST_TWO,
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
    "win_probability_distribution": _FULL_DIST_ONE,
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
    "win_probability_distribution": _FULL_DIST_ZERO,
}

# Team most likely to win 3 games.
_TEAM_THREE_WINS = {
    "name": "Gonzaga",
    "tournament_seed": 2,
    "conference": "WCC",
    "wins": 27,
    "losses": 7,
    "avg_height": 79,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": _FULL_DIST_THREE,
}

# Team most likely to win 4 games.
_TEAM_FOUR_WINS = {
    "name": "Houston",
    "tournament_seed": 2,
    "conference": "Big 12",
    "wins": 28,
    "losses": 6,
    "avg_height": 78,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": _FULL_DIST_FOUR,
}

# Team most likely to win 5 games.
_TEAM_FIVE_WINS = {
    "name": "Auburn",
    "tournament_seed": 1,
    "conference": "SEC",
    "wins": 29,
    "losses": 5,
    "avg_height": 78,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": _FULL_DIST_FIVE,
}

# Team most likely to win all 6 games (championship).
_TEAM_SIX_WINS = {
    "name": "Florida",
    "tournament_seed": 1,
    "conference": "SEC",
    "wins": 31,
    "losses": 4,
    "avg_height": 79,
    "players": [],
    "profile_summary": "",
    "win_probability_distribution": _FULL_DIST_SIX,
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
    "win_probability_distribution": _FULL_DIST_ZERO,
}

_ALL_MOCK_TEAMS = [
    _TEAM_TWO_WINS,
    _TEAM_ONE_WIN,
    _TEAM_ZERO_WINS,
    _TEAM_THREE_WINS,
    _TEAM_FOUR_WINS,
    _TEAM_FIVE_WINS,
    _TEAM_SIX_WINS,
    _TEAM_NO_SEED,
]


@pytest.fixture
async def client() -> AsyncClient:
    """Yield an async HTTPX client wired directly to the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# get_power_rankings — unit tests (bucket placement)
# ---------------------------------------------------------------------------


def test_two_wins_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is two_wins land in two_wins."""
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


def test_three_wins_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is three_wins land in three_wins."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    assert any(t.name == "Gonzaga" for t in rankings["three_wins"])


def test_four_wins_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is four_wins land in four_wins."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    assert any(t.name == "Houston" for t in rankings["four_wins"])


def test_five_wins_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is five_wins land in five_wins."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    assert any(t.name == "Auburn" for t in rankings["five_wins"])


def test_six_wins_bucket_contains_correct_team() -> None:
    """Teams whose highest probability is six_wins land in six_wins."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    assert any(t.name == "Florida" for t in rankings["six_wins"])


def test_non_tournament_teams_excluded() -> None:
    """Teams without a tournament_seed are excluded from all buckets."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    all_names = (
        [t.name for t in rankings["six_wins"]]
        + [t.name for t in rankings["five_wins"]]
        + [t.name for t in rankings["four_wins"]]
        + [t.name for t in rankings["three_wins"]]
        + [t.name for t in rankings["two_wins"]]
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
        "win_probability_distribution": _FULL_DIST_TWO | {"2": 0.80},
    }
    team_b = {
        **_TEAM_TWO_WINS,
        "name": "Team B",
        "win_probability_distribution": _FULL_DIST_TWO,
    }
    with patch(
        "app.services.load_predictions", return_value=[team_a, team_b]
    ):
        rankings = get_power_rankings()
    names = [t.name for t in rankings["two_wins"]]
    assert names.index("Team A") < names.index("Team B")


def test_tiebreaker_is_alphabetical() -> None:
    """When two teams share a probability, they are sorted alphabetically."""
    tied_dist = {"0": 0.05, "1": 0.10, "2": 0.70, "3": 0.07, "4": 0.04, "5": 0.02, "6": 0.02}  # noqa: E501
    team_z = {
        **_TEAM_TWO_WINS,
        "name": "Zebra University",
        "win_probability_distribution": tied_dist,
    }
    team_a = {
        **_TEAM_TWO_WINS,
        "name": "Apple State",
        "win_probability_distribution": tied_dist,
    }
    with patch(
        "app.services.load_predictions", return_value=[team_z, team_a]
    ):
        rankings = get_power_rankings()
    names = [t.name for t in rankings["two_wins"]]
    assert names.index("Apple State") < names.index("Zebra University")


def test_empty_predictions_returns_empty_buckets() -> None:
    """An empty predictions file produces seven empty lists."""
    with patch("app.services.load_predictions", return_value=[]):
        rankings = get_power_rankings()
    assert rankings["six_wins"] == []
    assert rankings["five_wins"] == []
    assert rankings["four_wins"] == []
    assert rankings["three_wins"] == []
    assert rankings["two_wins"] == []
    assert rankings["one_win"] == []
    assert rankings["zero_wins"] == []


def test_all_teams_total_count() -> None:
    """Total ranked teams equals the number of seeded teams in predictions."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        rankings = get_power_rankings()
    total = (
        len(rankings["six_wins"])
        + len(rankings["five_wins"])
        + len(rankings["four_wins"])
        + len(rankings["three_wins"])
        + len(rankings["two_wins"])
        + len(rankings["one_win"])
        + len(rankings["zero_wins"])
    )
    # _TEAM_NO_SEED is excluded, so 7 out of 8 mock teams should appear.
    assert total == 7


# ---------------------------------------------------------------------------
# GET /power-rankings — endpoint tests
# ---------------------------------------------------------------------------


async def test_power_rankings_returns_200(client: AsyncClient) -> None:
    """GET /power-rankings returns HTTP 200."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        response = await client.get("/power-rankings")
    assert response.status_code == 200


async def test_power_rankings_response_has_all_buckets(client: AsyncClient) -> None:
    """The response contains all seven win-bucket keys."""
    with patch("app.services.load_predictions", return_value=_ALL_MOCK_TEAMS):
        response = await client.get("/power-rankings")
    data = response.json()
    assert "six_wins" in data
    assert "five_wins" in data
    assert "four_wins" in data
    assert "three_wins" in data
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
        [t["name"] for t in data["six_wins"]]
        + [t["name"] for t in data["five_wins"]]
        + [t["name"] for t in data["four_wins"]]
        + [t["name"] for t in data["three_wins"]]
        + [t["name"] for t in data["two_wins"]]
        + [t["name"] for t in data["one_win"]]
        + [t["name"] for t in data["zero_wins"]]
    )
    assert "Not In Tournament" not in all_names


async def test_power_rankings_empty_predictions(client: AsyncClient) -> None:
    """An empty predictions file returns seven empty lists with status 200."""
    with patch("app.services.load_predictions", return_value=[]):
        response = await client.get("/power-rankings")
    assert response.status_code == 200
    data = response.json()
    assert data["six_wins"] == []
    assert data["five_wins"] == []
    assert data["four_wins"] == []
    assert data["three_wins"] == []
    assert data["two_wins"] == []
    assert data["one_win"] == []
    assert data["zero_wins"] == []
