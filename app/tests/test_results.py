"""
Tests for the GET /api/results endpoint and the get_results service.

Service tests are fully isolated (no file I/O).
Endpoint tests use the HTTPX async client wired directly to the FastAPI app,
with the results-data loader mocked so no real JSON file is required.
"""

import json
import tempfile
from pathlib import Path
from typing import Optional
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models import ResultsGame, ResultsRound, ResultsTeamEntry
from app.services import (
    _get_game_path_adjusted_probability,
    build_team_prior_paths_for_tournament,
    compute_brier_score,
    get_results,
    load_results_data,
)

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
    # First Four game — both teams have empty prior paths, no adjustment applied.
    # Howard has 0.58, UMBC has 0.42 — max is 0.58.
    assert game.predicted_probability == pytest.approx(0.58)


def test_get_results_game_paths_empty_for_first_four() -> None:
    """First Four games have empty team paths (no prior opponents)."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.team1_path == []
    assert game.team2_path == []


def test_get_results_game_paths_populated_after_first_round() -> None:
    """A team that won the First Four carries that opponent in their R64 path."""
    tournament_with_r64 = [
        {
            "year": 2026,
            "tournament_name": "2026 Tournament",
            "rounds": [
                {
                    "name": "First Four",
                    "games": [_FIRST_FOUR_GAME],  # Howard beats UMBC
                },
                {
                    "name": "Round of 64",
                    "games": [
                        {
                            "team1": {"name": "Michigan", "seed": 1, "score": 101},
                            "team2": {"name": "Howard",   "seed": 16, "score": 80},
                            "winner": "Michigan",
                            "correct": True,
                        }
                    ],
                },
            ],
        }
    ]
    with patch("app.services.load_results_data", return_value=tournament_with_r64), \
         patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = get_results()
    r64_game = response.tournaments[0].rounds[1].games[0]
    # Michigan had no prior games — empty path.
    assert r64_game.team1_path == []
    # Howard beat UMBC in First Four — path carries forward.
    assert r64_game.team2_path == ["UMBC"]


def test_get_results_predicted_probability_none_when_not_found() -> None:
    """get_results sets predicted_probability to None when no h2h entry exists."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    game = response.tournaments[0].rounds[0].games[0]
    assert game.predicted_probability is None


# ---------------------------------------------------------------------------
# _get_game_path_adjusted_probability — unit tests
# ---------------------------------------------------------------------------
# With empty prior paths the function behaves identically to the old
# _get_game_predicted_probability: returns max(p1, p2) from the H2H data.


def test_get_game_path_adjusted_probability_match_in_order() -> None:
    """Returns max probability when teams match stored order (no priors)."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_path_adjusted_probability("UMBC", "Howard", [], [])
    assert result == pytest.approx(0.58)


def test_get_game_path_adjusted_probability_match_reversed() -> None:
    """Returns max probability when teams are in reverse of stored order."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_path_adjusted_probability("Howard", "UMBC", [], [])
    assert result == pytest.approx(0.58)


def test_get_game_path_adjusted_probability_case_insensitive() -> None:
    """Lookup is case-insensitive."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_path_adjusted_probability("umbc", "howard", [], [])
    assert result == pytest.approx(0.58)


def test_get_game_path_adjusted_probability_returns_none_when_not_found() -> None:
    """Returns None when no matching h2h entry exists."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_path_adjusted_probability("Duke", "Kentucky", [], [])
    assert result is None


def test_get_game_path_adjusted_probability_returns_none_when_file_missing() -> None:
    """Returns None gracefully when load_h2h_predictions raises FileNotFoundError."""
    with patch(
        "app.services.load_h2h_predictions",
        side_effect=FileNotFoundError("missing"),
    ):
        result = _get_game_path_adjusted_probability("UMBC", "Howard", [], [])
    assert result is None


def test_get_game_path_adjusted_probability_always_returns_max() -> None:
    """The returned probability is always the higher of the two (>= 0.5)."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        result = _get_game_path_adjusted_probability(
            "Wisconsin", "High Point", [], []
        )
    assert result == pytest.approx(0.71)
    assert result >= 0.5


def test_get_game_path_adjusted_probability_with_prior_shifts_result() -> None:
    """Providing prior opponents applies a Bayesian adjustment to the result."""
    # Wisconsin (0.71) vs High Point (0.29) base.
    # Give Wisconsin a hard prior: a team that had 0.8 win probability vs Wisconsin.
    hard_prior_h2h = _MOCK_H2H + [
        {
            "team1": {"name": "HardTeam", "win_probability": 0.80},
            "team2": {"name": "Wisconsin", "win_probability": 0.20},
            "year": 2026,
        }
    ]
    with patch("app.services.load_h2h_predictions", return_value=hard_prior_h2h):
        base = _get_game_path_adjusted_probability(
            "Wisconsin", "High Point", [], []
        )
        adjusted = _get_game_path_adjusted_probability(
            "Wisconsin", "High Point", ["HardTeam"], []
        )
    # Wisconsin's hard path should raise its adjusted probability above the base.
    assert adjusted > base


# ---------------------------------------------------------------------------
# build_team_prior_paths_for_tournament — unit tests
# ---------------------------------------------------------------------------

# Minimal tournament with three rounds to test path accumulation.
_PATH_TOURNAMENT = {
    "year": 2026,
    "tournament_name": "Test",
    "rounds": [
        {
            "name": "First Four",
            "games": [
                {
                    "team1": {"name": "Bubble", "seed": 16},
                    "team2": {"name": "Cinderella", "seed": 16},
                    "winner": "Cinderella",
                },
            ],
        },
        {
            "name": "Round of 64",
            "games": [
                # Cinderella plays a top seed after winning First Four
                {
                    "team1": {"name": "TopSeed", "seed": 1},
                    "team2": {"name": "Cinderella", "seed": 16},
                    "winner": "TopSeed",
                },
                # A second game with two fresh teams
                {
                    "team1": {"name": "Alpha", "seed": 2},
                    "team2": {"name": "Beta", "seed": 15},
                    "winner": "Alpha",
                },
            ],
        },
        {
            "name": "Round of 32",
            "games": [
                {
                    "team1": {"name": "TopSeed", "seed": 1},
                    "team2": {"name": "Alpha", "seed": 2},
                    "winner": "TopSeed",
                },
            ],
        },
    ],
}


def test_path_builder_first_four_teams_start_empty() -> None:
    """Both teams have empty prior paths when entering the First Four."""
    paths = build_team_prior_paths_for_tournament(_PATH_TOURNAMENT)
    first_four_paths = paths["First Four"]
    # No team has played yet — paths should be absent (empty).
    assert first_four_paths.get("Bubble", []) == []
    assert first_four_paths.get("Cinderella", []) == []


def test_path_builder_fresh_teams_empty_in_r64() -> None:
    """A team that did not play First Four has an empty path in Round of 64."""
    paths = build_team_prior_paths_for_tournament(_PATH_TOURNAMENT)
    r64_paths = paths["Round of 64"]
    assert r64_paths.get("Alpha", []) == []
    assert r64_paths.get("Beta", []) == []


def test_path_builder_first_four_winner_carries_path_into_r64() -> None:
    """A First Four winner's path contains their beaten opponent in Round of 64."""
    paths = build_team_prior_paths_for_tournament(_PATH_TOURNAMENT)
    r64_paths = paths["Round of 64"]
    assert r64_paths.get("Cinderella", []) == ["Bubble"]


def test_path_builder_r32_paths_include_r64_opponent() -> None:
    """A team's Round of 32 path includes their Round of 64 opponent."""
    paths = build_team_prior_paths_for_tournament(_PATH_TOURNAMENT)
    r32_paths = paths["Round of 32"]
    # TopSeed beat Cinderella in R64; path at R32 = [Cinderella].
    assert r32_paths.get("TopSeed", []) == ["Cinderella"]
    # Alpha beat Beta in R64; path at R32 = [Beta].
    assert r32_paths.get("Alpha", []) == ["Beta"]


def test_path_builder_first_four_winner_has_two_opponents_in_r32() -> None:
    """A First Four winner who also won R64 has two opponents in their R32 path."""
    # Use a tournament where Cinderella wins R64 too.
    tournament = {
        **_PATH_TOURNAMENT,
        "rounds": [
            _PATH_TOURNAMENT["rounds"][0],  # First Four: Cinderella beats Bubble
            {
                "name": "Round of 64",
                "games": [
                    {
                        "team1": {"name": "TopSeed", "seed": 1},
                        "team2": {"name": "Cinderella", "seed": 16},
                        "winner": "Cinderella",  # upset
                    },
                ],
            },
            {
                "name": "Round of 32",
                "games": [],
            },
        ],
    }
    paths = build_team_prior_paths_for_tournament(tournament)
    r32_paths = paths["Round of 32"]
    # Cinderella beat Bubble (First Four) then TopSeed (R64).
    assert r32_paths.get("Cinderella", []) == ["Bubble", "TopSeed"]


def test_path_builder_returns_empty_dict_for_unknown_round() -> None:
    """Querying a round not in the data returns an empty dict."""
    paths = build_team_prior_paths_for_tournament(_PATH_TOURNAMENT)
    assert paths.get("Elite Eight", {}) == {}


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


# ---------------------------------------------------------------------------
# compute_brier_score — unit tests
# ---------------------------------------------------------------------------
# Helpers to build lightweight ResultsGame / ResultsRound objects without
# needing real H2H data or file I/O.


def _make_game(
    correct: bool,
    predicted_probability: Optional[float],
) -> ResultsGame:
    """Return a minimal ResultsGame with the given correctness and probability."""
    return ResultsGame(
        team1=ResultsTeamEntry(name="TeamA", seed=1, score=None),
        team2=ResultsTeamEntry(name="TeamB", seed=2, score=None),
        winner="TeamA" if correct else "TeamB",
        correct=correct,
        predicted_probability=predicted_probability,
    )


def _make_round(name: str, games: list) -> ResultsRound:
    """Return a ResultsRound with the given name and games list."""
    return ResultsRound(name=name, games=games)


def test_compute_brier_score_returns_none_when_no_games() -> None:
    """Returns (None, {}) when there are no games at all."""
    overall, by_round = compute_brier_score([])
    assert overall is None
    assert by_round == {}


def test_compute_brier_score_returns_none_when_no_probability_data() -> None:
    """Returns (None, {}) when every game has predicted_probability=None."""
    rounds = [_make_round("Round of 64", [
        _make_game(True, None), _make_game(False, None),
    ])]
    overall, by_round = compute_brier_score(rounds)
    assert overall is None
    assert by_round == {}


def test_compute_brier_score_perfect_confidence_correct() -> None:
    """A perfectly confident correct prediction contributes 0 to the score."""
    rounds = [_make_round("Round of 64", [_make_game(True, 1.0)])]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(0.0)


def test_compute_brier_score_perfect_confidence_incorrect() -> None:
    """A perfectly confident but wrong prediction contributes 1.0 (worst case)."""
    rounds = [_make_round("Round of 64", [_make_game(False, 1.0)])]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(1.0)


def test_compute_brier_score_fifty_fifty() -> None:
    """A 50/50 prediction contributes 0.25 regardless of outcome."""
    rounds = [_make_round("Round of 64", [_make_game(True, 0.5)])]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(0.25)


def test_compute_brier_score_correct_prediction_formula() -> None:
    """Correct prediction with probability 0.7 → (1-0.7)^2 = 0.09."""
    rounds = [_make_round("Round of 64", [_make_game(True, 0.7)])]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(0.09)


def test_compute_brier_score_incorrect_prediction_formula() -> None:
    """Incorrect prediction with probability 0.7 → 0.7^2 = 0.49."""
    rounds = [_make_round("Round of 64", [_make_game(False, 0.7)])]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(0.49)


def test_compute_brier_score_averages_multiple_games() -> None:
    """Overall score is the mean across all scored games."""
    # (1-0.8)^2 = 0.04  and  0.6^2 = 0.36  → mean = 0.20
    games = [_make_game(True, 0.8), _make_game(False, 0.6)]
    rounds = [_make_round("Round of 64", games)]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(0.20)


def test_compute_brier_score_excludes_games_without_probability() -> None:
    """Games with predicted_probability=None are excluded from the average."""
    # Only the scored game contributes: (1-0.8)^2 = 0.04
    games = [_make_game(True, 0.8), _make_game(True, None)]
    rounds = [_make_round("Round of 64", games)]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(0.04)


def test_compute_brier_score_by_round_keys_match_round_names() -> None:
    """by_round dict contains exactly the round names that had scored games."""
    rounds = [
        _make_round("First Four", [_make_game(True, 0.6)]),
        _make_round("Round of 64", [_make_game(True, None)]),  # no data
        _make_round("Round of 32", [_make_game(False, 0.75)]),
    ]
    _, by_round = compute_brier_score(rounds)
    assert set(by_round.keys()) == {"First Four", "Round of 32"}


def test_compute_brier_score_by_round_values_correct() -> None:
    """Per-round Brier scores are computed independently per round."""
    # First Four: (1-0.9)^2 = 0.01
    # Round of 64: 0.8^2 = 0.64
    rounds = [
        _make_round("First Four", [_make_game(True, 0.9)]),
        _make_round("Round of 64", [_make_game(False, 0.8)]),
    ]
    _, by_round = compute_brier_score(rounds)
    assert by_round["First Four"] == pytest.approx(0.01)
    assert by_round["Round of 64"] == pytest.approx(0.64)


def test_compute_brier_score_overall_spans_all_rounds() -> None:
    """Overall score is the mean across games from all rounds combined."""
    # First Four: (1-0.9)^2 = 0.01
    # Round of 64: 0.8^2 = 0.64
    # Overall mean = (0.01 + 0.64) / 2 = 0.325
    rounds = [
        _make_round("First Four", [_make_game(True, 0.9)]),
        _make_round("Round of 64", [_make_game(False, 0.8)]),
    ]
    overall, _ = compute_brier_score(rounds)
    assert overall == pytest.approx(0.325)


def test_get_results_brier_score_populated() -> None:
    """get_results populates brier_score on the tournament when h2h data exists."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = get_results()
    # UMBC vs Howard: Howard wins (correct=True), prob=0.58 → (1-0.58)^2
    assert response.tournaments[0].brier_score is not None


def test_get_results_brier_score_none_when_no_h2h() -> None:
    """get_results sets brier_score to None when no h2h predictions are available."""
    with patch("app.services.load_results_data", return_value=_MOCK_TOURNAMENT), \
         patch("app.services.load_h2h_predictions", return_value=[]):
        response = get_results()
    assert response.tournaments[0].brier_score is None
