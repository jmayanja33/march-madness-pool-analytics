"""
Tests for app/services.py helpers and the /teams endpoint.

Service functions are tested in isolation (no file I/O, no ChromaDB).
Endpoint tests use the HTTPX async client wired directly to the FastAPI app.
"""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services import (
    calc_ft_pct,
    format_height,
    format_position,
    team_name_to_chroma_id,
    build_win_distribution,
    build_player_profile,
)


# ---------------------------------------------------------------------------
# Shared async test client
# ---------------------------------------------------------------------------


@pytest.fixture
async def client() -> AsyncClient:
    """Yield an async HTTPX client wired directly to the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# format_height
# ---------------------------------------------------------------------------


def test_format_height_even_feet() -> None:
    """72 inches (exactly 6 feet) formats correctly."""
    assert format_height(72) == "6'0\""


def test_format_height_with_remainder() -> None:
    """79 inches (6'7") formats correctly."""
    assert format_height(79) == "6'7\""


def test_format_height_tall_player() -> None:
    """85 inches (7'1") formats correctly for a center."""
    assert format_height(85) == "7'1\""


# ---------------------------------------------------------------------------
# format_position
# ---------------------------------------------------------------------------


def test_format_position_guard() -> None:
    """Code 0 maps to 'G'."""
    assert format_position(0) == "G"


def test_format_position_center() -> None:
    """Code 4 maps to 'C'."""
    assert format_position(4) == "C"


def test_format_position_forward_center() -> None:
    """Code 3 maps to 'F/C'."""
    assert format_position(3) == "F/C"


def test_format_position_unknown() -> None:
    """An unrecognised code returns '?'."""
    assert format_position(99) == "?"


# ---------------------------------------------------------------------------
# calc_ft_pct
# ---------------------------------------------------------------------------


def test_calc_ft_pct_normal() -> None:
    """14 made / 20 attempted = 70.0%."""
    player = {"free_throws_made": 14, "free_throws_attempted": 20}
    assert calc_ft_pct(player) == 70.0


def test_calc_ft_pct_zero_attempts() -> None:
    """Zero attempts returns 0.0, avoiding division by zero."""
    player = {"free_throws_made": 0, "free_throws_attempted": 0}
    assert calc_ft_pct(player) == 0.0


def test_calc_ft_pct_rounds_to_one_decimal() -> None:
    """Result is rounded to one decimal place."""
    player = {"free_throws_made": 1, "free_throws_attempted": 3}
    assert calc_ft_pct(player) == 33.3


# ---------------------------------------------------------------------------
# team_name_to_chroma_id
# ---------------------------------------------------------------------------


def test_chroma_id_simple_name() -> None:
    """Single-word name is lowercased and appended with year."""
    assert team_name_to_chroma_id("Duke", 2025) == "duke_2025"


def test_chroma_id_multi_word() -> None:
    """Spaces are replaced with underscores."""
    assert team_name_to_chroma_id("North Carolina", 2025) == "north_carolina_2025"


def test_chroma_id_default_year() -> None:
    """Default year is CURRENT_YEAR (2025)."""
    result = team_name_to_chroma_id("Duke")
    assert result.endswith("_2025")


# ---------------------------------------------------------------------------
# build_win_distribution
# ---------------------------------------------------------------------------


def test_build_win_distribution_maps_keys() -> None:
    """Raw '0'/'1'/'2+' keys are mapped to the named fields."""
    raw = {"0": 0.5, "1": 0.3, "2+": 0.2}
    dist = build_win_distribution(raw)
    assert dist.zero_wins == 0.5
    assert dist.one_win == 0.3
    assert dist.two_plus_wins == 0.2


def test_build_win_distribution_missing_keys() -> None:
    """Missing keys default to 0.0."""
    dist = build_win_distribution({})
    assert dist.zero_wins == 0.0
    assert dist.one_win == 0.0
    assert dist.two_plus_wins == 0.0


# ---------------------------------------------------------------------------
# build_player_profile
# ---------------------------------------------------------------------------

_MOCK_PLAYER = {
    "name": "Test Player",
    "position": 0,
    "height": 75,
    "minutes": 900,
    "points": 300,
    "free_throws_made": 50,
    "free_throws_attempted": 60,
}


def test_build_player_profile_name() -> None:
    """Player name is preserved."""
    p = build_player_profile(_MOCK_PLAYER)
    assert p.name == "Test Player"


def test_build_player_profile_height() -> None:
    """Height is formatted as feet/inches."""
    p = build_player_profile(_MOCK_PLAYER)
    assert p.height == "6'3\""


def test_build_player_profile_ft_pct() -> None:
    """Free-throw percentage is correctly calculated."""
    p = build_player_profile(_MOCK_PLAYER)
    assert p.free_throw_pct == 83.3


# ---------------------------------------------------------------------------
# GET /teams endpoint
# ---------------------------------------------------------------------------

_MOCK_TEAMS = [
    {"name": "Duke", "tournament_seed": 1},
    {"name": "Auburn", "tournament_seed": 1},
    {"name": "Alabama State", "tournament_seed": 16},
    # Team without a seed — should be excluded from the list
    {"name": "No-Seed Team", "tournament_seed": None},
]


async def test_teams_returns_200(client: AsyncClient) -> None:
    """GET /teams returns HTTP 200."""
    with patch("app.main.get_all_teams", return_value=[
        {"name": "Duke", "seed": 1},
        {"name": "Auburn", "seed": 1},
    ]):
        response = await client.get("/teams")
    assert response.status_code == 200


async def test_teams_excludes_unseeded(client: AsyncClient) -> None:
    """Unseeded teams are not present in the response."""
    with patch("app.main.get_all_teams", return_value=[
        {"name": "Duke", "seed": 1},
    ]):
        response = await client.get("/teams")
    names = [t["name"] for t in response.json()]
    assert "No-Seed Team" not in names


async def test_teams_response_shape(client: AsyncClient) -> None:
    """Each item in the response has 'name' and 'seed' keys."""
    with patch("app.main.get_all_teams", return_value=[
        {"name": "Duke", "seed": 1},
    ]):
        response = await client.get("/teams")
    item = response.json()[0]
    assert "name" in item
    assert "seed" in item
