"""
Tests for the wins evaluation service and GET /api/wins-evaluation endpoint.

Service tests are fully isolated (no file I/O) via mocking.
Endpoint tests use the HTTPX async client wired directly to the FastAPI app.
"""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import calc_expected_wins, get_wins_evaluation

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

# Three-game mock tournament:
#   - Team A beats Team B in Round of 64  (Team B eliminated, 0 wins)
#   - Team A beats Team C in Round of 32  (Team C eliminated, 0 wins; A has 2)
#   - Team A beats Team D in Sweet Sixteen (Team D eliminated, 0 wins; A has 3)
# Team A (3 wins) is still active (never appears as a loser).
_MOCK_RESULTS = [
    {
        "year": 2026,
        "tournament_name": "2026 Tournament",
        "rounds": [
            {
                "name": "Round of 64",
                "games": [
                    {
                        "team1": {"name": "Team A", "seed": 1, "score": 80},
                        "team2": {"name": "Team B", "seed": 16, "score": 50},
                        "winner": "Team A",
                        "correct": True,
                    }
                ],
            },
            {
                "name": "Round of 32",
                "games": [
                    {
                        "team1": {"name": "Team A", "seed": 1, "score": 75},
                        "team2": {"name": "Team C", "seed": 8, "score": 60},
                        "winner": "Team A",
                        "correct": True,
                    }
                ],
            },
            {
                "name": "Sweet Sixteen",
                "games": [
                    {
                        "team1": {"name": "Team A", "seed": 1, "score": 70},
                        "team2": {"name": "Team D", "seed": 4, "score": 65},
                        "winner": "Team A",
                        "correct": True,
                    }
                ],
            },
        ],
    }
]

# Predictions for four teams across two regions.
# Team A: East, seed 1, expected wins ≈ weighted average of dist_a
# Team B: East, seed 16, expected wins from dist_b
# Team C: West, seed 8, expected wins from dist_c
# Team D: South, seed 4, expected wins from dist_d
_MOCK_PREDICTIONS = [
    {
        "name": "Team A",
        "tournament_seed": 1,
        "region": "East",
        "win_probability_distribution": {
            "0": 0.0, "1": 0.0, "2": 0.0, "3": 0.0, "4": 0.0, "5": 0.0, "6": 1.0,
        },
    },
    {
        "name": "Team B",
        "tournament_seed": 16,
        "region": "East",
        "win_probability_distribution": {
            "0": 1.0, "1": 0.0, "2": 0.0, "3": 0.0, "4": 0.0, "5": 0.0, "6": 0.0,
        },
    },
    {
        "name": "Team C",
        "tournament_seed": 8,
        "region": "West",
        "win_probability_distribution": {
            "0": 0.0, "1": 1.0, "2": 0.0, "3": 0.0, "4": 0.0, "5": 0.0, "6": 0.0,
        },
    },
    {
        "name": "Team D",
        "tournament_seed": 4,
        "region": "South",
        "win_probability_distribution": {
            "0": 0.0, "1": 0.0, "2": 1.0, "3": 0.0, "4": 0.0, "5": 0.0, "6": 0.0,
        },
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
# calc_expected_wins — unit tests
# ---------------------------------------------------------------------------


def test_calc_expected_wins_uniform_zero() -> None:
    """All probability on 0 wins produces expected wins of 0.0."""
    dist = {"0": 1.0, "1": 0.0, "2": 0.0, "3": 0.0, "4": 0.0, "5": 0.0, "6": 0.0}
    assert calc_expected_wins(dist) == 0.0


def test_calc_expected_wins_uniform_six() -> None:
    """All probability on 6 wins produces expected wins of 6.0."""
    dist = {"0": 0.0, "1": 0.0, "2": 0.0, "3": 0.0, "4": 0.0, "5": 0.0, "6": 1.0}
    assert calc_expected_wins(dist) == 6.0


def test_calc_expected_wins_equal_distribution() -> None:
    """Equal probability across all buckets produces expected wins of 3.0."""
    prob = round(1.0 / 7, 10)
    dist = {str(i): prob for i in range(7)}
    # 0+1+2+3+4+5+6 = 21; 21/7 = 3.0
    assert abs(calc_expected_wins(dist) - 3.0) < 0.01


def test_calc_expected_wins_weighted_average() -> None:
    """Weighted average is computed correctly for a mixed distribution."""
    # 50% on 2 wins, 50% on 4 wins → expected = 3.0
    dist = {"0": 0.0, "1": 0.0, "2": 0.5, "3": 0.0, "4": 0.5, "5": 0.0, "6": 0.0}
    assert calc_expected_wins(dist) == 3.0


def test_calc_expected_wins_missing_keys_default_to_zero() -> None:
    """Missing distribution keys are treated as zero probability."""
    # Only key "3" present with probability 1.0
    dist = {"3": 1.0}
    assert calc_expected_wins(dist) == 3.0


def test_calc_expected_wins_rounds_to_two_decimals() -> None:
    """Result is rounded to two decimal places."""
    dist = {"0": 0.0, "1": 1 / 3, "2": 1 / 3, "3": 1 / 3, "4": 0.0, "5": 0.0, "6": 0.0}
    result = calc_expected_wins(dist)
    # 1*(1/3) + 2*(1/3) + 3*(1/3) = 2.0
    assert result == 2.0


# ---------------------------------------------------------------------------
# get_wins_evaluation — unit tests
# ---------------------------------------------------------------------------


def test_get_wins_evaluation_actual_wins_counted_correctly() -> None:
    """Team A's actual wins are counted correctly from results (3 wins)."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    # Team A is in the East region, seed 1.
    team_a = next(e for e in result.east if e.name == "Team A")
    assert team_a.actual_wins == 3


def test_get_wins_evaluation_zero_wins_for_first_round_loser() -> None:
    """Team B lost in Round of 64 and has 0 actual wins."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    team_b = next(e for e in result.east if e.name == "Team B")
    assert team_b.actual_wins == 0


def test_get_wins_evaluation_eliminated_flag_for_losers() -> None:
    """Teams that have lost a game are marked as eliminated."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    team_b = next(e for e in result.east if e.name == "Team B")
    team_c = next(e for e in result.west if e.name == "Team C")
    team_d = next(e for e in result.south if e.name == "Team D")
    assert team_b.eliminated is True
    assert team_c.eliminated is True
    assert team_d.eliminated is True


def test_get_wins_evaluation_active_team_not_eliminated() -> None:
    """Team A has never lost and is not marked as eliminated."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    team_a = next(e for e in result.east if e.name == "Team A")
    assert team_a.eliminated is False


def test_get_wins_evaluation_expected_wins_from_distribution() -> None:
    """Expected wins for Team A (all prob on 6) is 6.0."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    team_a = next(e for e in result.east if e.name == "Team A")
    assert team_a.expected_wins == 6.0


def test_get_wins_evaluation_difference_is_signed() -> None:
    """Difference is expected_wins − actual_wins (signed)."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    # Team B: expected=0.0 (all prob on 0), actual=0 → difference=0.0
    team_b = next(e for e in result.east if e.name == "Team B")
    assert team_b.difference == 0.0

    # Team D: expected=2.0 (all prob on 2), actual=0 → difference=2.0
    team_d = next(e for e in result.south if e.name == "Team D")
    assert team_d.difference == 2.0


def test_get_wins_evaluation_teams_grouped_by_region() -> None:
    """Teams appear in their correct region bucket."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    east_names = {e.name for e in result.east}
    west_names = {e.name for e in result.west}
    south_names = {e.name for e in result.south}
    assert "Team A" in east_names
    assert "Team B" in east_names
    assert "Team C" in west_names
    assert "Team D" in south_names


def test_get_wins_evaluation_sorted_by_seed_within_region() -> None:
    """Teams within a region are sorted by seed ascending."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    seeds = [e.seed for e in result.east]
    assert seeds == sorted(seeds)


def test_get_wins_evaluation_summary_teams_evaluated_count() -> None:
    """Summary teams_evaluated counts only eliminated teams (3 of 4)."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    # B (East), C (West), D (South) are eliminated; A (East) is active.
    assert result.summary.teams_evaluated == 3


def test_get_wins_evaluation_mae_computed_correctly() -> None:
    """MAE is the mean of absolute errors over eliminated teams.

    Eliminated teams and their errors:
      Team B: expected=0.0, actual=0 → |error|=0.0
      Team C: expected=1.0, actual=0 → |error|=1.0
      Team D: expected=2.0, actual=0 → |error|=2.0
    MAE = (0.0 + 1.0 + 2.0) / 3 = 1.0
    """
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    assert abs(result.summary.mae - 1.0) < 0.001


def test_get_wins_evaluation_bias_computed_correctly() -> None:
    """Bias is the mean of signed errors over eliminated teams.

    Signed errors:
      Team B: 0.0 − 0 = 0.0
      Team C: 1.0 − 0 = 1.0
      Team D: 2.0 − 0 = 2.0
    Bias = (0.0 + 1.0 + 2.0) / 3 ≈ 1.0
    """
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    assert abs(result.summary.bias - 1.0) < 0.001


def test_get_wins_evaluation_within_one_pct() -> None:
    """Within-one percentage counts teams with |error| <= 1.0.

    Team B: |error|=0.0 ✓ within one
    Team C: |error|=1.0 ✓ within one
    Team D: |error|=2.0 ✗ not within one
    within_one_pct = 2/3 * 100 ≈ 66.7%
    """
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    assert abs(result.summary.within_one_pct - 66.7) < 0.1


def test_get_wins_evaluation_first_four_wins_not_counted() -> None:
    """First Four wins are not counted as actual wins in the distribution."""
    first_four_results = [
        {
            "year": 2026,
            "tournament_name": "2026 Tournament",
            "rounds": [
                {
                    "name": "First Four",
                    "games": [
                        {
                            "team1": {"name": "Team A", "seed": 1, "score": 80},
                            "team2": {"name": "Team B", "seed": 16, "score": 50},
                            "winner": "Team A",
                            "correct": True,
                        }
                    ],
                }
            ],
        }
    ]
    with (
        patch("app.services.load_results_data", return_value=first_four_results),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    # Team A won the First Four but that win must not be counted.
    team_a = next(e for e in result.east if e.name == "Team A")
    assert team_a.actual_wins == 0


def test_get_wins_evaluation_first_four_loser_is_eliminated() -> None:
    """A team that loses in the First Four is still marked as eliminated."""
    first_four_results = [
        {
            "year": 2026,
            "tournament_name": "2026 Tournament",
            "rounds": [
                {
                    "name": "First Four",
                    "games": [
                        {
                            "team1": {"name": "Team A", "seed": 1, "score": 80},
                            "team2": {"name": "Team B", "seed": 16, "score": 50},
                            "winner": "Team A",
                            "correct": True,
                        }
                    ],
                }
            ],
        }
    ]
    with (
        patch("app.services.load_results_data", return_value=first_four_results),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    team_b = next(e for e in result.east if e.name == "Team B")
    assert team_b.eliminated is True
    assert team_b.actual_wins == 0


def test_get_wins_evaluation_empty_results_no_wins() -> None:
    """With no games played all teams have 0 actual wins and no one is eliminated."""
    empty_results = [{"year": 2026, "tournament_name": "2026 Tournament", "rounds": []}]
    with (
        patch("app.services.load_results_data", return_value=empty_results),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    assert result.summary.teams_evaluated == 0
    assert result.summary.mae == 0.0
    assert result.summary.bias == 0.0
    assert result.summary.within_one_pct == 0.0
    # All entries exist but none are eliminated.
    for entry in result.east + result.west + result.south + result.midwest:
        assert entry.eliminated is False
        assert entry.actual_wins == 0


def test_get_wins_evaluation_midwest_empty_when_no_midwest_teams() -> None:
    """Midwest list is empty when no predictions have region 'Midwest'."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        result = get_wins_evaluation()

    assert result.midwest == []


# ---------------------------------------------------------------------------
# GET /api/wins-evaluation — endpoint tests
# ---------------------------------------------------------------------------


async def test_wins_evaluation_returns_200(client: AsyncClient) -> None:
    """GET /api/wins-evaluation returns HTTP 200."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        response = await client.get("/api/wins-evaluation")
    assert response.status_code == 200


async def test_wins_evaluation_response_has_summary(client: AsyncClient) -> None:
    """Response JSON contains a 'summary' key."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        response = await client.get("/api/wins-evaluation")
    assert "summary" in response.json()


async def test_wins_evaluation_response_has_region_keys(client: AsyncClient) -> None:
    """Response JSON contains east, west, south, and midwest keys."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        response = await client.get("/api/wins-evaluation")
    body = response.json()
    for region in ["east", "west", "south", "midwest"]:
        assert region in body


async def test_wins_evaluation_entry_fields(client: AsyncClient) -> None:
    """Each team entry contains all required fields."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        response = await client.get("/api/wins-evaluation")
    entry = response.json()["east"][0]
    required_fields = [
        "name", "seed", "region", "expected_wins",
        "actual_wins", "difference", "eliminated",
    ]
    for field in required_fields:
        assert field in entry


async def test_wins_evaluation_summary_fields(client: AsyncClient) -> None:
    """Summary contains teams_evaluated, mae, bias, and within_one_pct."""
    with (
        patch("app.services.load_results_data", return_value=_MOCK_RESULTS),
        patch("app.services.load_predictions", return_value=_MOCK_PREDICTIONS),
    ):
        response = await client.get("/api/wins-evaluation")
    summary = response.json()["summary"]
    for field in ["teams_evaluated", "mae", "bias", "within_one_pct"]:
        assert field in summary


async def test_wins_evaluation_returns_503_when_file_missing(
    client: AsyncClient,
) -> None:
    """GET /api/wins-evaluation returns HTTP 503 when results file is missing."""
    with patch(
        "app.services.load_results_data",
        side_effect=FileNotFoundError("not found"),
    ):
        response = await client.get("/api/wins-evaluation")
    assert response.status_code == 503
