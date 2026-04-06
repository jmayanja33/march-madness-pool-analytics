"""
Head-to-head router — handles the GET /head-to-head endpoint.

Routes defined in this module (no prefix applied — registered at root in main.py):

    GET /head-to-head?team1=<name>&team2=<name>
                    [&team1_opponents=<csv>&team2_opponents=<csv>]
        Return the predicted win probabilities for a matchup between two
        tournament teams, sourced from the pre-calculated h2h-predictions.json.

        When prior opponents are supplied, a log-odds Bayesian path-difficulty
        adjustment is computed and returned in path_adjusted_probability.
        The base win_probability is always the unmodified pre-season value.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from app.models import H2HResponse, H2HTeamResult
from app.services import (
    apply_path_adjustment,
    compute_path_score,
    get_h2h_prediction,
)

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
    team1_opponents: str = Query(
        default="",
        description="Comma-separated display names of opponents team1 has beaten",
    ),
    team2_opponents: str = Query(
        default="",
        description="Comma-separated display names of opponents team2 has beaten",
    ),
) -> H2HResponse:
    """
    Return predicted win probabilities for a head-to-head matchup.

    Looks up the pair in the pre-calculated h2h-predictions.json file.
    The search is case-insensitive and direction-agnostic — the response
    always maps team1 to the ``team1`` query param and team2 to ``team2``
    regardless of the order stored in the file.

    When ``team1_opponents`` or ``team2_opponents`` are provided, a
    log-odds Bayesian path-difficulty adjustment is computed.  Each prior
    opponent contributes P(opponent beats team) to that team's path score.
    The net difference (path_score_1 - path_score_2) shifts the prior
    log-odds, and the result is returned in ``path_adjusted_probability``.
    The base ``win_probability`` is always the unmodified pre-season value.

    Args:
        team1: Display name of the first (left-side) team.
        team2: Display name of the second (right-side) team.
        team1_opponents: Comma-separated names of opponents team1 has beaten.
        team2_opponents: Comma-separated names of opponents team2 has beaten.

    Returns:
        H2HResponse with base and optionally path-adjusted win probabilities.

    Raises:
        HTTPException 400: If team1 and team2 are the same.
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

    # Parse the comma-separated opponent lists (ignore empty strings from split).
    t1_opps = [o.strip() for o in team1_opponents.split(",") if o.strip()]
    t2_opps = [o.strip() for o in team2_opponents.split(",") if o.strip()]

    # Apply path-difficulty adjustment when at least one opponent is provided.
    if t1_opps or t2_opps:
        path_score_1 = compute_path_score(team1, t1_opps)
        path_score_2 = compute_path_score(team2, t2_opps)
        adj_p1, adj_p2 = apply_path_adjustment(
            result.team1.win_probability, path_score_1, path_score_2
        )
        result = H2HResponse(
            team1=H2HTeamResult(
                name=result.team1.name,
                win_probability=result.team1.win_probability,
                path_adjusted_probability=adj_p1,
            ),
            team2=H2HTeamResult(
                name=result.team2.name,
                win_probability=result.team2.win_probability,
                path_adjusted_probability=adj_p2,
            ),
        )
        logger.info(
            "head-to-head (path-adjusted): %s %.4f→%.4f vs %s %.4f→%.4f "
            "(path_scores: %.3f vs %.3f)",
            result.team1.name, result.team1.win_probability, adj_p1,
            result.team2.name, result.team2.win_probability, adj_p2,
            path_score_1, path_score_2,
        )
    else:
        logger.info(
            "head-to-head: %s (%.4f) vs %s (%.4f)",
            result.team1.name, result.team1.win_probability,
            result.team2.name, result.team2.win_probability,
        )

    return result
