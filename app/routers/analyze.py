"""
Analyze router — handles all /analyze endpoints.

Routes defined in this module (prefix "/analyze" is applied in main.py):

    GET /analyze/most-similar/{team}
        Reserved for a future ChromaDB similarity query.  Returns 501 until
        the vector-database integration is implemented.

    GET /analyze/{team}
        Load team data from the predictions JSON and return a full TeamAnalysis.
        similar_teams is always an empty list until /most-similar is wired up.

NOTE: The most-specific route (/most-similar/{team}) is registered BEFORE the
wildcard route (/{team}) so that FastAPI does not accidentally swallow
"most-similar" as a team name.
"""

from fastapi import APIRouter, HTTPException

from app.models import SimilarTeamsResponse, TeamAnalysis
from app.services import build_team_analysis, find_team

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
        HTTPException 501: ChromaDB integration not yet implemented.
    """
    raise HTTPException(status_code=501, detail="Not yet implemented")


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
      - similar_teams is an empty list until /most-similar is implemented.

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
        raise HTTPException(status_code=404, detail=f"Team '{team}' not found.")

    # similar_teams is empty until the ChromaDB integration is complete.
    return build_team_analysis(team_data, similar=[])
