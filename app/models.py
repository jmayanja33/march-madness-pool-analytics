"""
Pydantic response models for the March Madness Pool Analytics API.

These models define the exact shape of every JSON response body returned by
the API endpoints.  Using Pydantic ensures automatic validation and clean
OpenAPI documentation.
"""

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared / nested models
# ---------------------------------------------------------------------------


class PlayerProfile(BaseModel):
    """
    Key statistics for a single player, returned as part of a TeamAnalysis.

    Only the subset of fields relevant to the team-profile UI is included
    (position, formatted height, minutes, points, free-throw percentage).
    """

    name: str
    position: str       # Human-readable position label, e.g. "G", "F", "C", "G/F"
    height: str         # Height formatted as feet + inches, e.g. '6\'11"'
    minutes: int        # Total minutes played during the season
    points: int         # Total points scored during the season
    free_throw_pct: float  # Free-throw percentage (0–100), rounded to one decimal


class WinProbabilityDistribution(BaseModel):
    """
    Pre-calculated probability distribution for tournament wins.

    Each value is a probability (0–1) predicted by the ML model.
    """

    zero_wins: float     # Probability the team wins 0 tournament games
    one_win: float       # Probability the team wins exactly 1 tournament game
    two_plus_wins: float  # Probability the team wins 2 or more tournament games


class SimilarTeam(BaseModel):
    """
    A historically similar team found via ChromaDB cosine-similarity search.

    Returned as part of both TeamAnalysis and SimilarTeamsResponse.
    """

    name: str             # Team name
    year: int             # Season year (e.g. 2023 for the 2022-23 season)
    tournament_wins: int  # Number of tournament games that team won
    similarity: float     # Cosine similarity score (0–1); higher is more similar


# ---------------------------------------------------------------------------
# Top-level response models
# ---------------------------------------------------------------------------


class TeamAnalysis(BaseModel):
    """
    Complete team analysis returned by GET /analyze/{team}.

    Combines record, player profiles, win-probability distribution, and the
    three most similar historical teams into a single response object.
    """

    name: str
    wins: int
    losses: int
    profile_summary: str
    top_players: list[PlayerProfile]                     # Top 5 players by minutes
    win_probability_distribution: WinProbabilityDistribution
    similar_teams: list[SimilarTeam]                     # 3 most similar historical teams


class SimilarTeamsResponse(BaseModel):
    """
    Response returned by GET /analyze/most-similar/{team}.

    Wraps the queried team name alongside the three closest historical matches
    ranked by cosine similarity.
    """

    team: str
    similar_teams: list[SimilarTeam]


class TeamListItem(BaseModel):
    """
    Lightweight team descriptor returned by GET /teams.

    Used to populate the Analyze-page team dropdown.
    Teams are sorted by seed then alphabetically by name.
    """

    name: str  # Display name, e.g. "North Carolina"
    seed: int  # Tournament seed (1–16)


class HealthResponse(BaseModel):
    """Simple health-check response returned by GET /."""

    status: str   # "ok" when the service is healthy
    message: str  # Human-readable status message
