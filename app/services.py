"""
Business-logic services for the March Madness Pool Analytics API.

Provides helpers for:
  - Loading and caching the predictions JSON from disk.
  - Building Pydantic response models from raw JSON data.
  - Querying ChromaDB for the most similar historical teams.
  - Returning a flat sorted team list for the frontend dropdown.
"""

import json
import logging
from functools import lru_cache
from typing import Optional

import chromadb

# Module-level logger — output is captured by uvicorn and visible in docker logs.
logger = logging.getLogger(__name__)

from app.config import CHROMA_COLLECTION, CHROMA_HOST, CHROMA_PORT, PREDICTIONS_DIR
from app.models import PlayerProfile, SimilarTeam, TeamAnalysis, TeamStats, WinProbabilityDistribution

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Mapping from numeric position code (stored in the predictions JSON) to the
# human-readable abbreviation displayed in the UI.
POSITION_LABELS: dict[int, str] = {
    0: "G",
    1: "G/F",
    2: "F",
    3: "F/C",
    4: "C",
}

# Year of the current-season predictions file (update each year).
CURRENT_YEAR: int = 2025

# ---------------------------------------------------------------------------
# Predictions data loading
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_predictions() -> list[dict]:
    """Load and cache the current season's predictions JSON.

    Picks the lexicographically last ``*.json`` file inside PREDICTIONS_DIR
    so that a new season's file is used without any code changes.
    The result is cached in-process for the lifetime of the server.

    Returns:
        List of raw team dicts from the predictions JSON.

    Raises:
        FileNotFoundError: If PREDICTIONS_DIR contains no ``*.json`` files.
    """
    files = sorted(PREDICTIONS_DIR.glob("*.json"))
    if not files:
        raise FileNotFoundError(f"No predictions JSON found in {PREDICTIONS_DIR}")
    return json.loads(files[-1].read_text(encoding="utf-8"))


def find_team(name: str) -> Optional[dict]:
    """Find a team by display name in the predictions data (case-insensitive).

    Args:
        name: Team display name to search for (e.g. ``"Duke"``).

    Returns:
        The raw team dict, or ``None`` if no matching team is found.
    """
    needle = name.casefold()
    for team in load_predictions():
        if team["name"].casefold() == needle:
            return team
    return None


def get_all_teams() -> list[dict]:
    """Return all tournament teams as a flat list sorted by seed then name.

    Only includes teams that have a ``tournament_seed`` value set.

    Returns:
        List of dicts with keys ``name`` and ``seed``.
    """
    teams = [
        {"name": t["name"], "seed": t["tournament_seed"]}
        for t in load_predictions()
        if t.get("tournament_seed") is not None
    ]
    return sorted(teams, key=lambda t: (t["seed"], t["name"]))


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def format_height(total_inches: int) -> str:
    """Convert a height given as total inches to a feet-and-inches string.

    Args:
        total_inches: Height in inches (e.g. ``79``).

    Returns:
        Formatted string (e.g. ``"6'7\""``).
    """
    feet, remaining = divmod(total_inches, 12)
    return f"{feet}'{remaining}\""


def format_position(code: int) -> str:
    """Convert a numeric position code to a human-readable abbreviation.

    Args:
        code: Position code 0–4 (0 = G, 1 = G/F, 2 = F, 3 = F/C, 4 = C).

    Returns:
        Human-readable label, or ``"?"`` for unrecognised codes.
    """
    return POSITION_LABELS.get(code, "?")


def calc_avg_per_game(total: int, games: int) -> float:
    """Calculate a per-game average from a season total.

    Args:
        total: Season total value (e.g. total minutes or total points).
        games: Number of games played during the season.

    Returns:
        Per-game average rounded to one decimal.
        Returns ``0.0`` when ``games`` is 0.
    """
    if games == 0:
        return 0.0
    return round(total / games, 1)


def calc_ft_pct(player: dict) -> float:
    """Calculate a player's free-throw percentage from season totals.

    Args:
        player: Raw player dict from the predictions JSON.

    Returns:
        Free-throw percentage (0–100) rounded to one decimal.
        Returns ``0.0`` when the player attempted zero free throws.
    """
    attempted = player.get("free_throws_attempted", 0)
    made = player.get("free_throws_made", 0)
    if attempted == 0:
        return 0.0
    return round(made / attempted * 100, 1)


# ---------------------------------------------------------------------------
# Pydantic model builders
# ---------------------------------------------------------------------------


def build_player_profile(player: dict) -> PlayerProfile:
    """Build a PlayerProfile Pydantic model from a raw player dict.

    Args:
        player: Raw player dict with the schema from the predictions JSON.

    Returns:
        Populated :class:`~app.models.PlayerProfile` instance.
    """
    games = player.get("games", 0)
    return PlayerProfile(
        name=player["name"],
        position=format_position(player["position"]),
        height=format_height(player["height"]),
        avg_minutes=calc_avg_per_game(player["minutes"], games),
        avg_points=calc_avg_per_game(player["points"], games),
        free_throw_pct=calc_ft_pct(player),
    )


def build_win_distribution(raw: dict) -> WinProbabilityDistribution:
    """Build a WinProbabilityDistribution from the raw predictions dict.

    The JSON uses string keys ``'0'``, ``'1'``, and ``'2+'`` for the three
    win-probability buckets.

    Args:
        raw: Dict with keys ``'0'``, ``'1'``, ``'2+'`` mapping to floats.

    Returns:
        Populated :class:`~app.models.WinProbabilityDistribution` instance.
    """
    return WinProbabilityDistribution(
        zero_wins=raw.get("0", 0.0),
        one_win=raw.get("1", 0.0),
        two_plus_wins=raw.get("2+", 0.0),
    )


def build_team_stats(team: dict) -> TeamStats:
    """Build a TeamStats Pydantic model from a raw team dict.

    Counts are summed across all player records then divided by total games
    played (wins + losses) to produce per-game averages.  Shooting
    percentages are computed from aggregated makes and attempts.
    Average height uses the pre-computed ``avg_height`` field (total inches)
    formatted via :func:`format_height`.

    Args:
        team: Raw team dict from the predictions JSON.

    Returns:
        Populated :class:`~app.models.TeamStats` instance.
    """
    # Default to empty list when player data is not available for this team.
    players = team.get("players") or []
    games = team["wins"] + team["losses"]

    # Sum counting stats across the full roster.
    total_2pa = sum(p["two_point_field_goals_attempted"] for p in players)
    total_2pm = sum(p["two_point_field_goals_made"] for p in players)
    total_3pa = sum(p["three_point_field_goals_attempted"] for p in players)
    total_3pm = sum(p["three_point_field_goals_made"] for p in players)
    total_blocks = sum(p["blocks"] for p in players)
    total_oreb   = sum(p["offensive_rebounds"] for p in players)
    total_dreb   = sum(p["defensive_rebounds"] for p in players)
    total_to     = sum(p["turnovers"] for p in players)
    total_steals = sum(p["steals"] for p in players)
    total_fouls  = sum(p["fouls"] for p in players)

    def per_game(total: int) -> float:
        """Divide a season total by games played, round to 2 decimals."""
        return round(total / games, 2) if games > 0 else 0.0

    def shot_pct(made: int, attempted: int) -> float:
        """Compute field-goal percentage (0–100), round to 2 decimals."""
        return round(made / attempted * 100, 2) if attempted > 0 else 0.0

    return TeamStats(
        avg_height=format_height(round(team["avg_height"])),
        two_point_pct=shot_pct(total_2pm, total_2pa),
        three_point_pct=shot_pct(total_3pm, total_3pa),
        blocks=per_game(total_blocks),
        offensive_rebounds=per_game(total_oreb),
        defensive_rebounds=per_game(total_dreb),
        turnovers=per_game(total_to),
        steals=per_game(total_steals),
        fouls=per_game(total_fouls),
    )


def build_team_analysis(team: dict, similar: list[SimilarTeam]) -> TeamAnalysis:
    """Assemble a full TeamAnalysis Pydantic model from a raw team dict.

    Args:
        team: Raw team dict from the predictions JSON.
        similar: Pre-fetched list of similar historical teams.

    Returns:
        Fully populated :class:`~app.models.TeamAnalysis` instance.
    """
    # Sort players by minutes played (descending) and keep the top 5.
    # Default to empty list when player data is not available for this team.
    players = team.get("players") or []
    top5_raw = sorted(players, key=lambda p: p["minutes"], reverse=True)[:5]

    return TeamAnalysis(
        name=team["name"],
        seed=team.get("tournament_seed", 0),
        conference=team.get("conference", ""),
        wins=team["wins"],
        losses=team["losses"],
        profile_summary=team.get("profile_summary", ""),
        top_players=[build_player_profile(p) for p in top5_raw],
        team_stats=build_team_stats(team),
        win_probability_distribution=build_win_distribution(
            team.get("win_probability_distribution", {})
        ),
        similar_teams=similar,
    )


# ---------------------------------------------------------------------------
# ChromaDB — similar team lookup
# ---------------------------------------------------------------------------


def team_name_to_chroma_id(name: str, year: int = CURRENT_YEAR) -> str:
    """Convert a team display name to its ChromaDB document ID.

    ChromaDB IDs follow the pattern ``{slug}_{year}``, where the slug is
    the team name lowercased with spaces replaced by underscores.

    Args:
        name: Team display name (e.g. ``"North Carolina"``).
        year: Season year (default: :data:`CURRENT_YEAR`).

    Returns:
        ChromaDB ID string (e.g. ``"north_carolina_2025"``).
    """
    slug = name.lower().replace(" ", "_")
    return f"{slug}_{year}"


def get_similar_teams(team_name: str) -> list[SimilarTeam]:
    """Find the 3 most similar historical teams via ChromaDB.

    Retrieves the current team's PCA-reduced vector from ChromaDB using its
    2025 document ID, then queries for the nearest neighbours.  Any 2025
    teams in the results are filtered out so that only historical seasons
    (pre-2025) are returned.

    Distance metric is L2 (ChromaDB default).  Similarity is converted via
    ``1 / (1 + d)`` so that distance 0 → similarity 1.0, and larger
    distances yield progressively lower similarity scores.

    Args:
        team_name: Display name of the team to query for.

    Returns:
        List of up to 3 :class:`~app.models.SimilarTeam` objects ordered by
        similarity descending.  Returns an empty list when ChromaDB is
        unreachable or the team is absent from the vector store.
    """
    try:
        client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        logger.info("ChromaDB connected at %s:%s", CHROMA_HOST, CHROMA_PORT)

        collection = client.get_collection(name=CHROMA_COLLECTION)
        logger.info("Collection '%s' opened — count: %s", CHROMA_COLLECTION, collection.count())

        # Retrieve the current team's stored embedding by its 2025 document ID.
        chroma_id = team_name_to_chroma_id(team_name, CURRENT_YEAR)
        logger.info("Looking up embedding for chroma_id='%s'", chroma_id)
        result = collection.get(ids=[chroma_id], include=["embeddings"])

        if not result["embeddings"]:
            logger.warning("No embedding found for chroma_id='%s'", chroma_id)
            return []

        query_vector = result["embeddings"][0]
        logger.info("Embedding retrieved (%d dimensions) — querying neighbours", len(query_vector))

        # Fetch 10 candidates so we have enough after filtering 2025 teams.
        neighbors = collection.query(
            query_embeddings=[query_vector],
            n_results=10,
            include=["metadatas", "distances"],
        )

        similar: list[SimilarTeam] = []
        for meta, dist in zip(
            neighbors["metadatas"][0], neighbors["distances"][0]
        ):
            # Skip any team from the current season.
            if meta.get("year") == CURRENT_YEAR:
                continue

            # Convert L2 distance to a bounded 0–1 similarity score.
            similarity = round(1.0 / (1.0 + dist), 4)

            similar.append(
                SimilarTeam(
                    name=meta["name"],
                    year=int(meta["year"]),
                    tournament_wins=int(meta["tournament_wins"]),
                    similarity=similarity,
                )
            )

            if len(similar) == 3:
                break

        logger.info("Returning %d similar teams for '%s'", len(similar), team_name)
        return similar

    except Exception:
        # ChromaDB unavailable or team not indexed — log and degrade gracefully.
        logger.exception("get_similar_teams failed for '%s'", team_name)
        return []
