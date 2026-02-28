"""
Analyze router — handles all /analyze endpoints.

Routes defined in this module (prefix "/analyze" is applied in main.py):

    GET /analyze/most-similar/{team}
        Query ChromaDB for the 3 most similar historical teams to the given team.

    GET /analyze/{team}
        Load team data from the predictions JSON and return a full TeamAnalysis,
        including similar_teams populated from ChromaDB.

NOTE: The most-specific route (/most-similar/{team}) is registered BEFORE the
wildcard route (/{team}) so that FastAPI does not accidentally swallow
"most-similar" as a team name.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.models import SimilarTeamsResponse, TeamAnalysis
from app.services import build_team_analysis, find_team, get_similar_teams

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/analyze", tags=["analyze"])


# ---------------------------------------------------------------------------
# GET /analyze/most-similar/{team}
# ---------------------------------------------------------------------------


@router.get(
    "/most-similar/{team}",
    response_model=SimilarTeamsResponse,
    summary="Find the 3 most similar historical teams",
)
async def get_most_similar(team: str) -> SimilarTeamsResponse:
    """
    Return the 3 most similar historical teams to the given team.

    Uses cosine similarity on PCA-reduced team vectors stored in ChromaDB.

    Args:
        team: URL-decoded team name (e.g. "Duke" or "North Carolina").

    Returns:
        SimilarTeamsResponse containing the queried team name and a list of
        the 3 closest historical matches with their similarity scores and
        tournament win totals.

    Raises:
        HTTPException 404: If the team is not found in the predictions data.
    """
    # Look up the team in the predictions JSON (case-insensitive).
    team_data = find_team(team)
    if team_data is None:
        logger.warning("most-similar: team not found — '%s'", team)
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found.")

    # Query ChromaDB for the 3 most similar historical teams.
    similar = get_similar_teams(team)
    return SimilarTeamsResponse(team=team_data["name"], similar_teams=similar)


# ---------------------------------------------------------------------------
# GET /analyze/{team}
# ---------------------------------------------------------------------------


@router.get(
    "/{team}",
    response_model=TeamAnalysis,
    summary="Get full team analysis",
)
async def get_team_analysis(team: str) -> TeamAnalysis:
    """
    Return the complete analysis profile for a given NCAA tournament team.

    Reads from the predictions JSON for the current season and assembles:
      - Win/loss record
      - Top 5 players by minutes (position, height, minutes, points, FT%)
      - Plain-text profile summary
      - Pre-calculated win-probability distribution (0 / 1 / 2+ wins)
      - The 3 most similar historical teams from ChromaDB (empty if unavailable).

    Args:
        team: URL-decoded team name (e.g. "Duke" or "North Carolina").

    Returns:
        TeamAnalysis with all data needed to render the team-profile card.

    Raises:
        HTTPException 404: If the team is not found in the predictions data.
    """
    # Look up the team in the predictions JSON (case-insensitive).
    team_data = find_team(team)
    if team_data is None:
        logger.warning("analyze: team not found — '%s'", team)
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found.")

    # Query ChromaDB for the 3 most similar historical teams.
    similar = get_similar_teams(team)
    return build_team_analysis(team_data, similar=similar)
