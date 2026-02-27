"""
Analyze router — handles all /analyze endpoints.

Routes defined in this module (prefix "/analyze" is applied in main.py):

    GET /analyze/most-similar/{team}
        Query ChromaDB with cosine similarity to find the 3 most similar
        historical teams to the given team.

    GET /analyze/{team}
        Load team data from the predictions JSON, build a full TeamAnalysis
        (including a call to the most-similar logic), and return it.

NOTE: The most-specific route (/most-similar/{team}) is registered BEFORE the
wildcard route (/{team}) so that FastAPI does not accidentally swallow
"most-similar" as a team name.
"""

from fastapi import APIRouter, HTTPException

from app.models import SimilarTeamsResponse, TeamAnalysis

# ---------------------------------------------------------------------------
# Router — prefix and tag are applied when this router is included in main.py
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
    The team must exist in the current season's predictions JSON so that its
    vector can be looked up before querying the database.

    Args:
        team: URL-decoded team name (e.g. "Duke" or "North Carolina").

    Returns:
        SimilarTeamsResponse containing the queried team name and a list of
        the 3 closest historical matches with their similarity scores and
        tournament win totals.

    Raises:
        HTTPException 404: If the team is not found in the predictions data.
        HTTPException 503: If the ChromaDB vector database is unreachable.
    """
    # TODO: look up the team's vector from the predictions JSON,
    #       then run a ChromaDB cosine-similarity query and return results.
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
      - The 3 most similar historical teams (via ChromaDB)

    Args:
        team: URL-decoded team name (e.g. "Duke" or "North Carolina").

    Returns:
        TeamAnalysis with all data needed to render the team-profile card
        in the frontend.

    Raises:
        HTTPException 404: If the team is not found in the predictions data.
    """
    # TODO: load predictions JSON, filter by team name, build TeamAnalysis,
    #       call get_most_similar() to populate similar_teams.
    raise HTTPException(status_code=501, detail="Not yet implemented")
