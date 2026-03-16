"""
Power rankings router — handles the GET /power-rankings endpoint.

Routes defined in this module (no prefix applied — registered at root in main.py):

    GET /power-rankings
        Return all tournament teams grouped by their most likely win outcome
        (2+, 1, or 0 games won).  Within each group teams are ranked by their
        win-bucket probability descending, with alphabetical tie-breaking.
"""

import logging

from fastapi import APIRouter

from app.models import PowerRankingsResponse
from app.services import get_power_rankings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["power-rankings"])


# ---------------------------------------------------------------------------
# GET /power-rankings
# ---------------------------------------------------------------------------


@router.get(
    "/power-rankings",
    response_model=PowerRankingsResponse,
    summary="Get power rankings for all tournament teams",
)
async def power_rankings() -> PowerRankingsResponse:
    """
    Return all tournament teams grouped by their expected win outcome.

    Teams are partitioned into three buckets based on which win-probability
    value is highest: 2+ wins, 1 win, or 0 wins.  Within each bucket, teams
    are sorted by their bucket probability descending so that rank 1 in a
    section is the team most likely to achieve that outcome.  Alphabetical
    order by name breaks any probability ties.

    Returns:
        PowerRankingsResponse with three ranked lists: two_wins, one_win,
        and zero_wins.
    """
    rankings = get_power_rankings()
    logger.info(
        "power-rankings: %d six-win, %d five-win, %d four-win, %d three-win, "
        "%d two-win, %d one-win, %d zero-win teams",
        len(rankings["six_wins"]),
        len(rankings["five_wins"]),
        len(rankings["four_wins"]),
        len(rankings["three_wins"]),
        len(rankings["two_wins"]),
        len(rankings["one_win"]),
        len(rankings["zero_wins"]),
    )
    return PowerRankingsResponse(**rankings)
