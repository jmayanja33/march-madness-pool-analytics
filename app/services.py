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

from app.config import CHROMA_COLLECTION, CHROMA_HOST, CHROMA_PORT, PREDICTIONS_DIR
from app.models import (
    H2HResponse,
    H2HTeamResult,
    PlayerProfile,
    PoolTeamSummary,
    ResultsGame,
    ResultsResponse,
    ResultsRound,
    ResultsTeamEntry,
    ResultsTournament,
    SimilarTeam,
    TeamAnalysis,
    TeamStats,
    WinProbabilityDistribution,
)

# Module-level logger — output is captured by uvicorn and visible in docker logs.
logger = logging.getLogger(__name__)

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
CURRENT_YEAR: int = 2026

# ---------------------------------------------------------------------------
# Predictions data loading
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_predictions() -> list[dict]:
    """Load and cache the current season's predictions JSON.

    Loads ``predictions.json`` directly from PREDICTIONS_DIR.  Other files in
    the same directory (e.g. ``results.json``, ``h2h-predictions.json``) are
    intentionally ignored so that adding new data files never accidentally
    replaces the team predictions.

    Returns:
        List of raw team dicts from the predictions JSON.

    Raises:
        FileNotFoundError: If ``predictions.json`` does not exist in PREDICTIONS_DIR.
    """
    path = PREDICTIONS_DIR / "predictions.json"
    if not path.exists():
        raise FileNotFoundError(f"Predictions file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


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

    The JSON uses string keys ``'0'`` through ``'6'`` for the seven
    win-probability buckets (one per possible tournament-wins outcome).

    Args:
        raw: Dict with keys ``'0'``–``'6'`` mapping to floats.

    Returns:
        Populated :class:`~app.models.WinProbabilityDistribution` instance.
    """
    return WinProbabilityDistribution(
        zero_wins=raw.get("0", 0.0),
        one_win=raw.get("1", 0.0),
        two_wins=raw.get("2", 0.0),
        three_wins=raw.get("3", 0.0),
        four_wins=raw.get("4", 0.0),
        five_wins=raw.get("5", 0.0),
        six_wins=raw.get("6", 0.0),
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
# Pool team builder
# ---------------------------------------------------------------------------


def build_pool_team_summary(team: dict) -> PoolTeamSummary:
    """Build a lightweight PoolTeamSummary from a raw team dict.

    Extracts only the fields required by the Create a Team page (seed,
    conference, and win-probability distribution).  Player-level detail and
    similar-team data are intentionally excluded to keep the pool response
    small.

    Args:
        team: Raw team dict from the predictions JSON.

    Returns:
        Populated :class:`~app.models.PoolTeamSummary` instance.
    """
    return PoolTeamSummary(
        name=team["name"],
        # Coerce None to 0 in case the key exists but has no value set.
        seed=team.get("tournament_seed") or 0,
        conference=team.get("conference", ""),
        win_probability_distribution=build_win_distribution(
            team.get("win_probability_distribution", {})
        ),
    )


# ---------------------------------------------------------------------------
# Power rankings builder
# ---------------------------------------------------------------------------


def get_power_rankings() -> dict:
    """Group and sort all tournament teams by their expected win outcome.

    Each team is assigned to the win bucket (0–6) whose probability is highest.
    Within each bucket, teams are ordered by that probability descending and
    then alphabetically by name to break ties.

    Only teams with a tournament seed set in the predictions data are included.

    Returns:
        Dict with keys ``six_wins``, ``five_wins``, ``four_wins``, ``three_wins``,
        ``two_wins``, ``one_win``, and ``zero_wins``, each containing a list of
        :class:`~app.models.PoolTeamSummary` objects.
    """
    # Accumulate (summary, probability) pairs for each win bucket (0–6).
    six_wins: list[tuple]   = []
    five_wins: list[tuple]  = []
    four_wins: list[tuple]  = []
    three_wins: list[tuple] = []
    two_wins: list[tuple]   = []
    one_win: list[tuple]    = []
    zero_wins: list[tuple]  = []

    for team in load_predictions():
        # Only include teams that are in the tournament.
        if team.get("tournament_seed") is None:
            continue

        # Extract raw probabilities for each win bucket.
        dist = team.get("win_probability_distribution", {})
        prob_zero  = dist.get("0", 0.0)
        prob_one   = dist.get("1", 0.0)
        prob_two   = dist.get("2", 0.0)
        prob_three = dist.get("3", 0.0)
        prob_four  = dist.get("4", 0.0)
        prob_five  = dist.get("5", 0.0)
        prob_six   = dist.get("6", 0.0)

        summary = build_pool_team_summary(team)
        max_prob = max(
            prob_zero, prob_one, prob_two, prob_three, prob_four, prob_five, prob_six
        )

        # Assign the team to the bucket with the highest probability.
        # Ties broken by checking from highest wins down.
        if max_prob == prob_six:
            six_wins.append((summary, prob_six))
        elif max_prob == prob_five:
            five_wins.append((summary, prob_five))
        elif max_prob == prob_four:
            four_wins.append((summary, prob_four))
        elif max_prob == prob_three:
            three_wins.append((summary, prob_three))
        elif max_prob == prob_two:
            two_wins.append((summary, prob_two))
        elif max_prob == prob_one:
            one_win.append((summary, prob_one))
        else:
            zero_wins.append((summary, prob_zero))

    # Sort each bucket: highest probability first, then alphabetically by name.
    sort_key = lambda item: (-item[1], item[0].name)  # noqa: E731
    six_wins.sort(key=sort_key)
    five_wins.sort(key=sort_key)
    four_wins.sort(key=sort_key)
    three_wins.sort(key=sort_key)
    two_wins.sort(key=sort_key)
    one_win.sort(key=sort_key)
    zero_wins.sort(key=sort_key)

    return {
        "six_wins":   [t[0] for t in six_wins],
        "five_wins":  [t[0] for t in five_wins],
        "four_wins":  [t[0] for t in four_wins],
        "three_wins": [t[0] for t in three_wins],
        "two_wins":   [t[0] for t in two_wins],
        "one_win":    [t[0] for t in one_win],
        "zero_wins":  [t[0] for t in zero_wins],
    }


# ---------------------------------------------------------------------------
# Head-to-head predictions
# ---------------------------------------------------------------------------

# Path to the pre-calculated head-to-head predictions JSON file.
H2H_PREDICTIONS_FILE = PREDICTIONS_DIR / "h2h-predictions.json"


@lru_cache(maxsize=1)
def load_h2h_predictions() -> list[dict]:
    """Load and cache the head-to-head predictions JSON from disk.

    The file at H2H_PREDICTIONS_FILE is read once and cached for the
    lifetime of the server process.

    Returns:
        List of raw matchup dicts, each with ``team1``, ``team2``, and
        ``year`` keys.

    Raises:
        FileNotFoundError: If H2H_PREDICTIONS_FILE does not exist.
    """
    if not H2H_PREDICTIONS_FILE.exists():
        raise FileNotFoundError(
            f"H2H predictions file not found: {H2H_PREDICTIONS_FILE}"
        )
    return json.loads(H2H_PREDICTIONS_FILE.read_text(encoding="utf-8"))


def get_h2h_prediction(team1_name: str, team2_name: str) -> Optional[H2HResponse]:
    """Look up the head-to-head win probability for a given pair of teams.

    Searches the pre-calculated h2h-predictions JSON for a matchup entry
    where one team is ``team1_name`` and the other is ``team2_name``.
    The lookup is case-insensitive and direction-agnostic — if the stored
    entry has the teams in reverse order the probabilities are swapped so
    that team1 in the response always corresponds to ``team1_name``.

    Args:
        team1_name: Display name of the first team (e.g. ``"Duke"``).
        team2_name: Display name of the second team (e.g. ``"Kentucky"``).

    Returns:
        Populated :class:`~app.models.H2HResponse`, or ``None`` if no
        matching matchup is found in the predictions data.
    """
    needle1 = team1_name.casefold()
    needle2 = team2_name.casefold()

    for entry in load_h2h_predictions():
        stored1 = entry["team1"]["name"].casefold()
        stored2 = entry["team2"]["name"].casefold()

        # Match in stored order — team1 in entry matches team1 in request.
        if stored1 == needle1 and stored2 == needle2:
            return H2HResponse(
                team1=H2HTeamResult(
                    name=entry["team1"]["name"],
                    win_probability=entry["team1"]["win_probability"],
                ),
                team2=H2HTeamResult(
                    name=entry["team2"]["name"],
                    win_probability=entry["team2"]["win_probability"],
                ),
            )

        # Match in reverse order — swap so response aligns with request order.
        if stored1 == needle2 and stored2 == needle1:
            return H2HResponse(
                team1=H2HTeamResult(
                    name=entry["team2"]["name"],
                    win_probability=entry["team2"]["win_probability"],
                ),
                team2=H2HTeamResult(
                    name=entry["team1"]["name"],
                    win_probability=entry["team1"]["win_probability"],
                ),
            )

    return None


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

    Distance metric is cosine (collection created with ``hnsw:space=cosine``).
    ChromaDB returns cosine distance in [0, 1] where 0 = identical, so
    cosine similarity = ``1 - distance``.

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
        logger.info(
            "Collection '%s' opened — count: %s", CHROMA_COLLECTION, collection.count()
        )

        # Retrieve the current team's stored embedding by its 2025 document ID.
        chroma_id = team_name_to_chroma_id(team_name, CURRENT_YEAR)
        logger.info("Looking up embedding for chroma_id='%s'", chroma_id)
        result = collection.get(ids=[chroma_id], include=["embeddings"])

        if len(result["embeddings"]) == 0:
            logger.warning("No embedding found for chroma_id='%s'", chroma_id)
            return []

        query_vector = result["embeddings"][0]
        logger.info(
            "Embedding retrieved (%d dimensions) — querying neighbours",
            len(query_vector),
        )

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

            # Cosine distance is in [0, 1]; convert to similarity score.
            similarity = round(max(0.0, 1.0 - dist), 4)

            similar.append(
                SimilarTeam(
                    name=meta["name"],
                    year=int(meta["year"]),
                    seed=int(meta["tournament_seed"]),
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


# ---------------------------------------------------------------------------
# Results data loading
# ---------------------------------------------------------------------------

# Path to the pre-calculated tournament results JSON file.
RESULTS_FILE = PREDICTIONS_DIR / "results.json"


@lru_cache(maxsize=1)
def load_results_data() -> list[dict]:
    """Load and cache the tournament results JSON from disk.

    The file at RESULTS_FILE is read once and cached for the lifetime of the
    server process.  It contains one entry per tracked tournament year.

    Returns:
        List of raw tournament dicts, each containing year, tournament_name,
        and a list of round dicts with game results.

    Raises:
        FileNotFoundError: If RESULTS_FILE does not exist.
    """
    if not RESULTS_FILE.exists():
        raise FileNotFoundError(f"Results file not found: {RESULTS_FILE}")
    return json.loads(RESULTS_FILE.read_text(encoding="utf-8"))


def get_results() -> ResultsResponse:
    """Build a ResultsResponse from the raw results JSON data.

    Parses all tournament years and their round game data into Pydantic models.
    Rounds with no games are still included so the frontend can display them
    as "No games yet".

    Returns:
        Populated :class:`~app.models.ResultsResponse` instance with all
        tracked tournament years and their game results.
    """
    raw_tournaments = load_results_data()
    tournaments: list[ResultsTournament] = []

    for raw_t in raw_tournaments:
        rounds: list[ResultsRound] = []

        # Parse each round and its games.
        for raw_r in raw_t.get("rounds", []):
            games: list[ResultsGame] = []

            for raw_g in raw_r.get("games", []):
                # Build each team's entry from the raw game dict.
                team1 = ResultsTeamEntry(
                    name=raw_g["team1"]["name"],
                    seed=raw_g["team1"]["seed"],
                    score=raw_g["team1"].get("score"),
                )
                team2 = ResultsTeamEntry(
                    name=raw_g["team2"]["name"],
                    seed=raw_g["team2"]["seed"],
                    score=raw_g["team2"].get("score"),
                )
                games.append(ResultsGame(
                    team1=team1,
                    team2=team2,
                    winner=raw_g["winner"],
                    correct=raw_g["correct"],
                ))

            rounds.append(ResultsRound(name=raw_r["name"], games=games))

        tournaments.append(ResultsTournament(
            year=raw_t["year"],
            tournament_name=raw_t["tournament_name"],
            rounds=rounds,
        ))

    logger.info("get_results: loaded %d tournament year(s)", len(tournaments))
    return ResultsResponse(tournaments=tournaments)
