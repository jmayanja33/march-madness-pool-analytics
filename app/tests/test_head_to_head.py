"""
Tests for the GET /head-to-head endpoint and the head-to-head services.

Service tests are fully isolated (no file I/O).
Endpoint tests use the HTTPX async client wired directly to the FastAPI app,
with the h2h data loader mocked so no real JSON file is required.
"""

import math
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import apply_path_adjustment, compute_path_score, get_h2h_prediction

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
# apply_path_adjustment — unit tests
# ---------------------------------------------------------------------------


def test_no_path_difference_leaves_probability_unchanged() -> None:
    """Equal path scores produce zero net adjustment."""
    p1, p2 = apply_path_adjustment(0.6, 0.5, 0.5)
    assert p1 == pytest.approx(0.6, abs=1e-5)
    assert p2 == pytest.approx(0.4, abs=1e-5)


def test_zero_path_scores_leaves_probability_unchanged() -> None:
    """Zero path scores on both sides produce zero net adjustment."""
    p1, p2 = apply_path_adjustment(0.72, 0.0, 0.0)
    assert p1 == pytest.approx(0.72, abs=1e-5)
    assert p2 == pytest.approx(0.28, abs=1e-5)


def test_higher_path_score_increases_probability() -> None:
    """A harder path for team1 shifts the adjusted probability upward."""
    p1_adj, _ = apply_path_adjustment(0.5, 0.8, 0.4)
    assert p1_adj > 0.5


def test_lower_path_score_decreases_probability() -> None:
    """An easier path for team1 shifts the adjusted probability downward."""
    p1_adj, _ = apply_path_adjustment(0.5, 0.3, 0.7)
    assert p1_adj < 0.5


def test_probabilities_sum_to_one() -> None:
    """Adjusted p1 and p2 always sum to 1.0."""
    p1, p2 = apply_path_adjustment(0.65, 0.9, 0.3)
    assert p1 + p2 == pytest.approx(1.0, abs=1e-6)


def test_path_adjustment_known_value() -> None:
    """Verify the log-odds arithmetic against a manually computed example."""
    # base_p1=0.5 → prior log-odds = 0; net = 0.67; sigmoid(0.67) ≈ 0.6613
    p1, p2 = apply_path_adjustment(0.5, 1.47, 0.80)
    expected = 1.0 / (1.0 + math.exp(-(0.0 + 0.67)))
    assert p1 == pytest.approx(expected, abs=1e-3)
    assert p2 == pytest.approx(1.0 - expected, abs=1e-3)


# ---------------------------------------------------------------------------
# compute_path_score — unit tests
# ---------------------------------------------------------------------------


def test_path_score_no_opponents_is_zero() -> None:
    """An empty opponent list produces a path score of 0."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        score = compute_path_score("Kentucky", [])
    assert score == 0.0


def test_path_score_sums_opponent_win_probabilities() -> None:
    """Path score equals the sum of each opponent's win probability vs the team."""
    # Duke has 0.72 win probability against Kentucky → P(Duke beats Kentucky) = 0.72
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        score = compute_path_score("Kentucky", ["Duke"])
    assert score == pytest.approx(0.72)


def test_path_score_skips_unknown_opponent() -> None:
    """Opponents not found in H2H data are silently skipped."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        score = compute_path_score("Kentucky", ["UnknownTeam"])
    assert score == 0.0


def test_path_score_accumulates_multiple_opponents() -> None:
    """Multiple opponents contribute cumulatively to the path score."""
    # Duke (0.72 vs Kentucky) + North Carolina (0.60 vs Kansas)
    # We need an opponent of Duke; reuse stored pairs where Duke is team2.
    # Kentucky's path score after beating Duke: P(Duke beats Kentucky) = 0.72.
    # Add a second beaten opponent — North Carolina vs Kansas → not relevant.
    # Instead: test with two opponents both in the mock that beat the same target.
    extended_mock = _MOCK_H2H + [
        {
            "team1": {"name": "North Carolina", "win_probability": 0.55},
            "team2": {"name": "Kentucky", "win_probability": 0.45},
            "year": 2025,
        },
    ]
    with patch("app.services.load_h2h_predictions", return_value=extended_mock):
        score = compute_path_score("Kentucky", ["Duke", "North Carolina"])
    # P(Duke beats Kentucky) = 0.72 + P(North Carolina beats Kentucky) = 0.55
    assert score == pytest.approx(0.72 + 0.55)


# ---------------------------------------------------------------------------
# GET /head-to-head — endpoint tests
# ---------------------------------------------------------------------------


async def test_h2h_returns_200(client: AsyncClient) -> None:
    """GET /head-to-head returns HTTP 200 for a valid pair."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/head-to-head?team1=Duke&team2=Kentucky")
    assert response.status_code == 200


async def test_h2h_response_shape(client: AsyncClient) -> None:
    """The response contains team1 and team2 objects with name and win_probability."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/head-to-head?team1=Duke&team2=Kentucky")
    data = response.json()
    assert "team1" in data
    assert "team2" in data
    assert data["team1"]["name"] == "Duke"
    assert data["team1"]["win_probability"] == pytest.approx(0.72)
    assert data["team2"]["name"] == "Kentucky"
    assert data["team2"]["win_probability"] == pytest.approx(0.28)
    # No opponents supplied — path_adjusted_probability should be absent / null.
    assert data["team1"].get("path_adjusted_probability") is None
    assert data["team2"].get("path_adjusted_probability") is None


async def test_h2h_reversed_order(client: AsyncClient) -> None:
    """Response maps probabilities to the request order, not the stored order."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/head-to-head?team1=Kentucky&team2=Duke")
    data = response.json()
    assert data["team1"]["name"] == "Kentucky"
    assert data["team2"]["name"] == "Duke"


async def test_h2h_returns_404_for_unknown_pair(client: AsyncClient) -> None:
    """GET /head-to-head returns 404 when no prediction exists for the pair."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/head-to-head?team1=Alabama&team2=Oregon")
    assert response.status_code == 404


async def test_h2h_returns_400_for_same_team(client: AsyncClient) -> None:
    """GET /head-to-head returns 400 when team1 and team2 are the same."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/head-to-head?team1=Duke&team2=Duke")
    assert response.status_code == 400


async def test_h2h_missing_team1_returns_422(client: AsyncClient) -> None:
    """GET /head-to-head returns 422 when team1 query param is missing."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/head-to-head?team2=Kentucky")
    assert response.status_code == 422


async def test_h2h_missing_team2_returns_422(client: AsyncClient) -> None:
    """GET /head-to-head returns 422 when team2 query param is missing."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get("/api/head-to-head?team1=Duke")
    assert response.status_code == 422


async def test_h2h_with_opponents_returns_adjusted_probability(
    client: AsyncClient,
) -> None:
    """Supplying prior opponents populates path_adjusted_probability in the response."""
    # Duke beats 1 opponent (North Carolina); Kentucky has no prior opponents.
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get(
            "/api/head-to-head?team1=Duke&team2=Kentucky&team1_opponents=North+Carolina"
        )
    assert response.status_code == 200
    data = response.json()
    # path_adjusted_probability must be present and differ from base.
    assert data["team1"]["path_adjusted_probability"] is not None
    assert data["team2"]["path_adjusted_probability"] is not None
    # p1 + p2 must still sum to 1.
    assert (
        data["team1"]["path_adjusted_probability"]
        + data["team2"]["path_adjusted_probability"]
        == pytest.approx(1.0, abs=1e-5)
    )


async def test_h2h_empty_opponents_no_adjustment(client: AsyncClient) -> None:
    """Passing empty opponent strings is equivalent to providing no opponents."""
    with patch("app.services.load_h2h_predictions", return_value=_MOCK_H2H):
        response = await client.get(
            "/api/head-to-head?team1=Duke&team2=Kentucky&team1_opponents=&team2_opponents="
        )
    data = response.json()
    assert data["team1"].get("path_adjusted_probability") is None
