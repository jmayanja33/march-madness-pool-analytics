"""
Pydantic response models for the March Madness Pool Analytics API.

These models define the exact shape of every JSON response body returned by
the API endpoints.  Using Pydantic ensures automatic validation and clean
OpenAPI documentation.
"""

from typing import Optional

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
    position: str         # Human-readable position label, e.g. "G", "F", "C", "G/F"
    height: str           # Height formatted as feet + inches, e.g. '6\'11"'
    avg_minutes: float    # Average minutes played per game, rounded to one decimal
    avg_points: float     # Average points scored per game, rounded to one decimal
    free_throw_pct: float  # Free-throw percentage (0–100), rounded to one decimal


class WinProbabilityDistribution(BaseModel):
    """
    Pre-calculated probability distribution for tournament wins.

    Each value is a probability (0–1) predicted by the ML model.
    Fields cover every possible outcome from 0 to 6 games won
    (6 is the maximum — a team that wins the championship).
    """

    zero_wins: float   # Probability the team wins 0 tournament games
    one_win: float     # Probability the team wins exactly 1 tournament game
    two_wins: float    # Probability the team wins exactly 2 tournament games
    three_wins: float  # Probability the team wins exactly 3 tournament games
    four_wins: float   # Probability the team wins exactly 4 tournament games
    five_wins: float   # Probability the team wins exactly 5 tournament games
    six_wins: float    # Probability the team wins all 6 (championship)


class TeamStats(BaseModel):
    """
    Per-game team averages derived from summing all player season totals.

    Shooting percentages are computed from total makes / total attempts.
    All counting stats (blocks, rebounds, etc.) are per-game averages.
    """

    avg_height: str          # Roster average height formatted as feet + inches
    two_point_pct: float     # 2-point field-goal percentage (0–100), 2 decimals
    three_point_pct: float   # 3-point field-goal percentage (0–100), 2 decimals
    blocks: float            # Blocks per game, rounded to 2 decimals
    offensive_rebounds: float  # Offensive rebounds per game, rounded to 2 decimals
    defensive_rebounds: float  # Defensive rebounds per game, rounded to 2 decimals
    turnovers: float         # Turnovers per game, rounded to 2 decimals
    steals: float            # Steals per game, rounded to 2 decimals
    fouls: float             # Personal fouls per game, rounded to 2 decimals


class SimilarTeam(BaseModel):
    """
    A historically similar team found via ChromaDB cosine-similarity search.

    Returned as part of both TeamAnalysis and SimilarTeamsResponse.
    """

    name: str             # Team name
    year: int             # Season year (e.g. 2023 for the 2022-23 season)
    seed: int             # Tournament seed (1–16)
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
    seed: int                                                # Tournament seed (1–16)
    conference: str                                        # Conference name, e.g. "ACC"
    wins: int
    losses: int
    profile_summary: str
    top_players: list[PlayerProfile]                     # Top 5 players by minutes
    team_stats: TeamStats                                # Per-game team averages
    win_probability_distribution: WinProbabilityDistribution
    similar_teams: list[SimilarTeam]                   # 3 most similar historical teams


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


# ---------------------------------------------------------------------------
# Info models
# ---------------------------------------------------------------------------


class ModelMetrics(BaseModel):
    """
    Performance metrics for the ordinal regression win-prediction model.

    Accuracy, F1, and precision are expressed as percentages (0–100).
    Kappa and RPS are dimensionless scores.
    """

    name: str                         # Human-readable model name
    accuracy: float                   # Overall accuracy (percentage, e.g. 67.89)
    f1_weighted: float                # Weighted F1 score (percentage)
    precision_weighted: float         # Weighted precision (percentage)
    quadratic_weighted_kappa: float   # QWK — ordinal agreement strength (0–1)
    ranked_probability_score: float   # RPS — calibration quality (lower is better)
    training_samples: int             # Number of teams used for training
    test_samples: int                 # Number of teams used for testing
    seasons: str                      # Season range, e.g. "2010–2025"


class DataSourceInfo(BaseModel):
    """
    URLs for the three external data sources used to build the predictions dataset.
    """

    player_team_stats: str   # CBBD — player and team statistics
    game_summaries: str      # ESPN — game-level summaries
    team_logos: str          # SportsLogos.Net — team logo images


class ContactInfo(BaseModel):
    """Contact details for the project author."""

    name: str       # Full name
    email: str      # Contact email address
    linkedin: str   # LinkedIn profile URL
    github: str     # GitHub profile URL


class InfoResponse(BaseModel):
    """
    Structured response returned by GET /info.

    Contains top-level project metadata, model performance metrics, data source
    URLs, and author contact information — everything needed to populate the
    frontend Info page.
    """

    project: str              # Short project title
    description: str          # One-sentence project description
    model: ModelMetrics       # ML model metrics for the current season
    data_source: DataSourceInfo   # External data source URLs
    contact: ContactInfo      # Author contact info


# ---------------------------------------------------------------------------
# Pool models
# ---------------------------------------------------------------------------


class PoolTeamSummary(BaseModel):
    """
    Lightweight team data returned by POST /pool.

    Contains only the fields needed to render a team slot in the Create a Team
    page: identification fields (name, seed, conference) and the win-probability
    distribution used to compute expected wins.
    """

    name: str
    seed: int           # Tournament seed (1–16)
    conference: str     # Conference name, e.g. "ACC"
    win_probability_distribution: WinProbabilityDistribution


class PoolRequest(BaseModel):
    """
    Request body for POST /pool.

    Accepts up to 8 team names (the maximum pool size).  Names must match the
    display names stored in the predictions JSON exactly (case-insensitive on
    the server side).
    """

    teams: list[str]  # Up to 8 team display names


class PoolResponse(BaseModel):
    """
    Response returned by POST /pool.

    Contains one PoolTeamSummary per successfully resolved team, in the same
    order as the request list.  Teams not found in the predictions data are
    omitted rather than raising an error, so a partial pool is still useful.
    """

    teams: list[PoolTeamSummary]


# ---------------------------------------------------------------------------
# Head-to-head models
# ---------------------------------------------------------------------------


class H2HTeamResult(BaseModel):
    """Win probability for one team in a head-to-head matchup prediction."""

    name: str              # Team display name
    win_probability: float  # Predicted win probability (0–1)


class H2HResponse(BaseModel):
    """
    Response returned by GET /head-to-head.

    Contains the predicted win probability for each team in the requested
    matchup, sourced from the pre-calculated h2h-predictions.json file.
    """

    team1: H2HTeamResult  # Left-side team with its win probability
    team2: H2HTeamResult  # Right-side team with its win probability


# ---------------------------------------------------------------------------
# Projections models
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Results models
# ---------------------------------------------------------------------------


class ResultsTeamEntry(BaseModel):
    """
    One team's entry in a single game result.

    Score is optional because some results in the data source omit it.
    """

    name: str               # Team display name, e.g. "Duke"
    seed: int               # Tournament seed (1–16)
    score: Optional[int]    # Points scored in this game, or None if unavailable


class ResultsGame(BaseModel):
    """
    Result for a single tournament game.

    Contains both teams' info, the winner's name, whether the model's
    prediction for this matchup was correct, and the model's confidence
    (the predicted winner's win probability, always >= 0.5).
    """

    team1: ResultsTeamEntry   # First team (left side of display)
    team2: ResultsTeamEntry   # Second team (right side of display)
    winner: str               # Display name of the winning team
    correct: bool             # True if the model correctly predicted the winner
    # Model's confidence for the predicted winner (0.5–1.0); None if not found.
    predicted_probability: Optional[float] = None


class ResultsRound(BaseModel):
    """
    Results for one round of the tournament (e.g. 'First Four', 'Round of 64').

    An empty games list means no games have been played for this round yet.
    """

    name: str                  # Round name, e.g. "First Four"
    games: list[ResultsGame]   # Games played; empty if round has not started


class ResultsTournament(BaseModel):
    """
    All results for one tournament year, broken down by round.

    Contains computed aggregate totals (games, correct predictions) for the
    entire tournament derived from the individual round game lists.
    """

    year: int                      # Tournament year, e.g. 2026
    tournament_name: str           # Display title, e.g. "2026 Tournament"
    # Ordered list of rounds from First Four to National Championship.
    rounds: list[ResultsRound]


class ResultsResponse(BaseModel):
    """
    Top-level response returned by GET /api/results.

    Contains one ResultsTournament entry per year of tracked results.
    Currently only the 2026 season is included.
    """

    tournaments: list[ResultsTournament]


# ---------------------------------------------------------------------------
# Wins evaluation models
# ---------------------------------------------------------------------------


class WinsEvaluationEntry(BaseModel):
    """
    Per-team wins evaluation entry comparing expected vs actual tournament wins.

    Expected wins is the weighted average of the win probability distribution.
    Actual wins is derived from the live results data.  The difference is
    signed (positive = model over-predicted, negative = under-predicted).
    Teams still active in the tournament are included but excluded from
    summary metric computation until they are eliminated.
    """

    name: str             # Team display name, e.g. "Duke"
    seed: int             # Tournament seed (1–16)
    region: str           # Bracket region, e.g. "East"
    expected_wins: float  # Weighted average of win probability distribution
    actual_wins: int      # Tournament wins counted from results data
    difference: float     # expected_wins − actual_wins; positive = over-predicted
    eliminated: bool      # False if the team is still active in the tournament


class WinsEvaluationSummary(BaseModel):
    """
    Aggregate evaluation metrics computed across all eliminated teams.

    Metrics are not computed for teams still active because their final
    win count is unknown.
    """

    teams_evaluated: int    # Number of eliminated teams included in metrics
    mae: float              # Mean absolute error: mean(|expected − actual|)
    # Mean signed error: mean(expected − actual); positive = over-predicted
    bias: float
    within_one_pct: float   # Percentage of teams where |expected − actual| ≤ 1.0


class WinsEvaluationResponse(BaseModel):
    """
    Response returned by GET /api/wins-evaluation.

    Teams are grouped by bracket region and sorted by seed within each group.
    Summary metrics are computed only over eliminated teams.
    """

    summary: WinsEvaluationSummary
    east: list[WinsEvaluationEntry]       # East region teams sorted by seed
    west: list[WinsEvaluationEntry]       # West region teams sorted by seed
    south: list[WinsEvaluationEntry]      # South region teams sorted by seed
    midwest: list[WinsEvaluationEntry]    # Midwest region teams sorted by seed


class ProjectionsResponse(BaseModel):
    """
    Response returned by GET /projections.

    All tournament teams are grouped by their most likely win outcome (the
    probability bucket with the highest value).  Within each group teams are
    sorted by that bucket's probability descending, then alphabetically by
    name for ties.  Sections are ordered from most wins (6) to fewest (0).
    """

    six_wins: list[PoolTeamSummary]    # Teams most likely to win all 6 (championship)
    five_wins: list[PoolTeamSummary]   # Teams most likely to win exactly 5 games
    four_wins: list[PoolTeamSummary]   # Teams most likely to win exactly 4 games
    three_wins: list[PoolTeamSummary]  # Teams most likely to win exactly 3 games
    two_wins: list[PoolTeamSummary]    # Teams most likely to win exactly 2 games
    one_win: list[PoolTeamSummary]     # Teams most likely to win exactly 1 game
    zero_wins: list[PoolTeamSummary]   # Teams most likely to win 0 games
