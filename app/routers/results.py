"""
Results router — handles the GET /api/results endpoint.

Routes defined in this module:

    GET /api/results
        Return all tracked tournament results, organised by year and round.
        Each round lists the games played, the winning team, and whether the
        model's prediction for that game was correct.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.models import ResultsResponse
from app.services import get_results

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["results"])


# ---------------------------------------------------------------------------
# GET /results
# ---------------------------------------------------------------------------


@router.get(
    "/results",
    response_model=ResultsResponse,
    summary="Get tournament model results by year and round",
)
async def results() -> ResultsResponse:
    """
    Return all tracked tournament results grouped by year and round.

    For each tournament year the response includes every round (First Four
    through National Championship).  Rounds that have not yet been played
    contain an empty games list.  For rounds with games, each entry records
    both teams (name, seed, score), the winner, and whether the model's
    pre-tournament prediction was correct.

    Returns:
        ResultsResponse with a list of ResultsTournament objects.

    Raises:
        HTTPException 503: If the results data file is missing or unreadable.
    """
    try:
        response = get_results()
    except FileNotFoundError as exc:
        logger.error("Results data file not found: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Tournament results data is not available.",
        ) from exc

    # Log a brief summary of how many games are tracked across all years.
    total_games = sum(
        len(r.games)
        for t in response.tournaments
        for r in t.rounds
    )
    logger.info(
        "results: %d tournament year(s), %d total game(s)",
        len(response.tournaments),
        total_games,
    )
    return response
