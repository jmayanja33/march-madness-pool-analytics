"""
Pool router — handles the /create-a-team endpoint for the Create a Team page.

Routes defined in this module (no prefix applied — registered at root in main.py):

    POST /create-a-team
        Accept a list of up to 8 team names and return lightweight pool
        summaries for each team found in the predictions data.

Teams not found in the predictions data are silently omitted from the
response rather than raising a 404, so a partially-valid pool request
still returns useful data for the teams that do exist.
"""

import logging

from fastapi import APIRouter

from app.models import PoolRequest, PoolResponse
from app.services import build_pool_team_summary, find_team

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["pool"])


# ---------------------------------------------------------------------------
# POST /pool
# ---------------------------------------------------------------------------


@router.post(
    "/create-a-team",
    response_model=PoolResponse,
    summary="Get pool summary for a list of teams",
)
async def analyze_pool(request: PoolRequest) -> PoolResponse:
    """
    Return lightweight pool summaries for up to 8 tournament teams.

    For each team name in the request list the endpoint looks up the team in
    the current-season predictions data and returns its seed, conference, and
    win-probability distribution.  Teams that cannot be found are silently
    skipped so that a partial pool still yields a useful response.

    The returned list preserves the same order as the request list (minus any
    skipped teams), allowing the frontend to correlate results with slots.

    Args:
        request: JSON body containing a ``teams`` list of display names.

    Returns:
        PoolResponse with one PoolTeamSummary per successfully resolved team.
    """
    # Resolve each team name against the predictions JSON.
    summaries = []
    for name in request.teams:
        team_data = find_team(name)
        if team_data is None:
            # Log the miss but continue processing remaining teams.
            logger.warning("pool: team not found — '%s'", name)
            continue
        summaries.append(build_pool_team_summary(team_data))

    logger.info(
        "pool: resolved %d / %d teams", len(summaries), len(request.teams)
    )
    return PoolResponse(teams=summaries)
