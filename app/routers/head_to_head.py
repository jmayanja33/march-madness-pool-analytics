"""
Head-to-head router — handles the GET /head-to-head endpoint.

Routes defined in this module (no prefix applied — registered at root in main.py):

    GET /head-to-head?team1=<name>&team2=<name>
        Return the predicted win probabilities for a matchup between two
        tournament teams, sourced from the pre-calculated h2h-predictions.json.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.models import H2HResponse
from app.services import get_h2h_prediction

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["head-to-head"])


# ---------------------------------------------------------------------------
# GET /head-to-head
# ---------------------------------------------------------------------------


@router.get(
    "/head-to-head",
    response_model=H2HResponse,
    summary="Get head-to-head win probabilities for two tournament teams",
)
async def head_to_head(
    team1: str = Query(..., description="Display name of the first team"),
    team2: str = Query(..., description="Display name of the second team"),
) -> H2HResponse:
    """
    Return predicted win probabilities for a head-to-head matchup.

    Looks up the pair in the pre-calculated h2h-predictions.json file.
    The search is case-insensitive and direction-agnostic — the response
    always maps team1 to the ``team1`` query param and team2 to ``team2``
    regardless of the order stored in the file.

    Args:
        team1: Display name of the first (left-side) team.
        team2: Display name of the second (right-side) team.

    Returns:
        H2HResponse with win probabilities for both teams.

    Raises:
        HTTPException 404: If no prediction is found for the given pair.
    """
    # Reject self-matchups — a team cannot play itself.
    if team1.casefold() == team2.casefold():
        raise HTTPException(
            status_code=400,
            detail="team1 and team2 must be different teams.",
        )

    result = get_h2h_prediction(team1, team2)
    if result is None:
        logger.warning(
            "head-to-head: no prediction found for '%s' vs '%s'", team1, team2
        )
        raise HTTPException(
            status_code=404,
            detail=f"No head-to-head prediction found for '{team1}' vs '{team2}'.",
        )

    logger.info(
        "head-to-head: %s (%.4f) vs %s (%.4f)",
        result.team1.name, result.team1.win_probability,
        result.team2.name, result.team2.win_probability,
    )
    return result
