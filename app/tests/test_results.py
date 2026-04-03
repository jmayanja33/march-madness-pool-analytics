"""
Tests for the GET /api/results endpoint and the get_results service.

Service tests are fully isolated (no file I/O).
Endpoint tests use the HTTPX async client wired directly to the FastAPI app,
with the results-data loader mocked so no real JSON file is required.
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import _get_game_predicted_probability, get_results, load_results_data

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

# Minimal single-game round for use across multiple tests.
_FIRST_FOUR_GAME = {
    "team1": {"name": "UMBC",   "seed": 16, "score": 83},
    "team2": {"name": "Howard", "seed": 16, "score": 86},
    "winner": "Howard",
    "correct": True,
}

# A game with null scores to verify optional score handling.
_NULL_SCORE_GAME = {
    "team1": {"name": "Louisville",    "seed": 6,  "score": None},
    "team2": {"name": "South Florida", "seed": 11, "score": None},
    "winner": "South Florida",
    "correct": True,
}

# A game the model predicted incorrectly.
_INCORRECT_GAME = {
    "team1": {"name": "Wisconsin",  "seed": 5,  "score": 82},
    "team2": {"name": "High Point", "seed": 12, "score": 83},
    "winner": "High Point",
    "correct": False,
}

# Complete mock tournament with two rounds (one with games, one empty).
_MOCK_TOURNAMENT = [
    {
        "year": 2026,
        "tournament_name": "2026 Tournament",
        "rounds": [
            {
                "name": "First Four",
                "games": [_FIRST_FOUR_GAME, _NULL_SCORE_GAME],
            },
            {
                "name": "Round of 32",
                "games": [],
            },
        ],
    }
]

# Sample h2h predictions used to test predicted_probability enrichment.
_MOCK_H2H = [
    {
        "team1": {"name": "UMBC",   "win_probability": 0.42},
        "team2": {"name": "Howard", "win_probability": 0.58},
        "year": 2026,
    },
    {
        "team1": {"name": "Wisconsin",  "win_probability": 0.71},
        "team2": {"name": "High Point", "win_probability": 0.29},
        "year": 2026,
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
# load_results_data — unit tests
# ---------------------------------------------------------------------------


def test_load_results_data_reads_json_file() -> None:
    """load_results_data returns parsed JSON list from a real temp file."""
    payload = [{"year": 2026, "tournament_name": "Test", "rounds": []}]
    with tempfile.NamedTemporaryFile(
        suffix=".json", mode="w", delete=False
    ) as f:
        json.dump(payload, f)
        tmp_path = Path(f.name)

    with patch("app.services.RESULTS_FILE", tmp_path):
        data = load_results_data()

    assert data == payload
    tmp_path.unlink()


def test_load_results_data_raises_when_file_missing() -> None:
    """load_results_data raises FileNotFoundError when the file is absent."""
    missing = Path("/nonexistent/results.json")
    with patch("app.services.RESULTS_FILE", missing):
        with pytest.raises(FileNotFoundError):
            load_results_data()


# ---------------------------------------------------------------------------
# get_results — unit tests (model building)
# ---------------------------------------------------------------------------


def test_get_results_returns_correct_year() -> None:
    """get_results parses the tournament year correctly."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    assert response.tournaments[0].year == 2026


def test_get_results_returns_tournament_name() -> None:
    """get_results parses the tournament_name field correctly."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    assert response.tournaments[0].tournament_name == "2026 Tournament"


def test_get_results_round_count() -> None:
    """get_results creates one ResultsRound per round in the source data."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    assert len(response.tournaments[0].rounds) == 2


def test_get_results_round_names() -> None:
    """get_results preserves the round name strings."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    names = [r.name for r in response.tournaments[0].rounds]
    assert "First Four" in names
    assert "Round of 32" in names


def test_get_results_game_team_names() -> None:
    """get_results maps team names to the correct teams in a game."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.team1.name == "UMBC"
    assert game.team2.name == "Howard"


def test_get_results_game_seeds() -> None:
    """get_results preserves the seed values for each team."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.team1.seed == 16
    assert game.team2.seed == 16


def test_get_results_game_scores() -> None:
    """get_results preserves numeric scores when present."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.team1.score == 83
    assert game.team2.score == 86


def test_get_results_null_scores_allowed() -> None:
    """get_results accepts None scores for games with missing score data."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[1]
    assert game.team1.score is None
    assert game.team2.score is None


def test_get_results_winner_field() -> None:
    """get_results maps the winner name correctly."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.winner == "Howard"


def test_get_results_correct_flag_true() -> None:
    """get_results sets correct=True for correctly predicted games."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.correct is True


def test_get_results_correct_flag_false() -> None:
    """get_results sets correct=False for incorrectly predicted games."""
    incorrect_tournament = [
        {
            **_MOCK_TOURNAMENT[0],
            "rounds": [
                {"name": "Round of 64", "games": [_INCORRECT_GAME]}
            ],
        }
    ]
    with patch("app.services.load_results_data", return_value=incorrect_tournament), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.correct is False


def test_get_results_empty_round_has_no_games() -> None:
    """A round with an empty games list produces a ResultsRound with no games."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    empty_round = response.tournaments[0].rounds[1]
    assert empty_round.games == []


def test_get_results_empty_tournaments() -> None:
    """An empty tournaments list returns a ResultsResponse with no tournaments."""
    with patch("app.services.load_results_data", return_value=[]), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    assert response.tournaments == []


def test_get_results_predicted_probability_populated() -> None:
    """get_results attaches predicted_probability when h2h data is available."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]  # UMBC vs Howard
    # Howard has 0.58, UMBC has 0.42 — max is 0.58.
    assert game.predicted_probability == pytest.approx(0.58)


def test_get_results_predicted_probability_none_when_not_found() -> None:
    """get_results sets predicted_probability to None when no h2h entry exists."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.predicted_probability is None


# ---------------------------------------------------------------------------
# _get_game_predicted_probability — unit tests
# ---------------------------------------------------------------------------


def test_get_game_predicted_probability_match_in_order() -> None:
    """Returns max probability when teams match stored order."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_predicted_probability("UMBC", "Howard")
    assert result == pytest.approx(0.58)


def test_get_game_predicted_probability_match_reversed() -> None:
    """Returns max probability when teams are in reverse of stored order."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_predicted_probability("Howard", "UMBC")
    assert result == pytest.approx(0.58)


def test_get_game_predicted_probability_case_insensitive() -> None:
    """Lookup is case-insensitive."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_predicted_probability("umbc", "howard")
    assert result == pytest.approx(0.58)


def test_get_game_predicted_probability_returns_none_when_not_found() -> None:
    """Returns None when no matching h2h entry exists."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_predicted_probability("Duke", "Kentucky")
    assert result is None


def test_get_game_predicted_probability_returns_none_when_file_missing() -> None:
    """Returns None gracefully when load_h2h_predictions raises FileNotFoundError."""
    with patch(
        "app.services.load_h2h_predictions",
        side_effect=FileNotFoundError("missing"),
    ):
        result = _get_game_predicted_probability("UMBC", "Howard")
    assert result is None


def test_get_game_predicted_probability_always_returns_max() -> None:
    """The returned probability is always the higher of the two (>= 0.5)."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_predicted_probability("Wisconsin", "High Point")
    # Wisconsin 0.71, High Point 0.29 — max is 0.71.
    assert result == pytest.approx(0.71)
    assert result >= 0.5


# ---------------------------------------------------------------------------
# GET /api/results — endpoint tests
# ---------------------------------------------------------------------------


async def test_results_returns_200(client: AsyncClient) -> None:
    """GET /api/results returns HTTP 200."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = await client.get("/api/results")
    assert response.status_code == 200


async def test_results_response_has_tournaments_key(client: AsyncClient) -> None:
    """The response JSON contains a 'tournaments' key."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = await client.get("/api/results")
    assert "tournaments" in response.json()


async def test_results_response_tournament_structure(client: AsyncClient) -> None:
    """Each tournament in the response has year, tournament_name, and rounds."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = await client.get("/api/results")
    tournament = response.json()["tournaments"][0]
    assert tournament["year"] == 2026
    assert tournament["tournament_name"] == "2026 Tournament"
    assert "rounds" in tournament


async def test_results_response_game_fields(client: AsyncClient) -> None:
    """Each game includes team1, team2, winner, correct, and predicted_probability."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/results")
    game = response.json()["tournaments"][0]["rounds"][0]["games"][0]
    assert game["team1"]["name"] == "UMBC"
    assert game["team2"]["name"] == "Howard"
    assert game["winner"] == "Howard"
    assert game["correct"] is True
    assert game["predicted_probability"] == pytest.approx(0.58)


async def test_results_returns_503_when_file_missing(client: AsyncClient) -> None:
    """GET /api/results returns HTTP 503 when the results file is missing."""
    with patch(
        "app.services.load_results_data",
        side_effect=FileNotFoundError("not found"),
    ):
        response = await client.get("/api/results")
    assert response.status_code == 503
