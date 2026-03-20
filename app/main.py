"""
March Madness Pool Analytics — FastAPI application entry point.

This module creates the FastAPI app instance, configures CORS middleware so
the Vite frontend can reach the API during local development, and registers
all route groups.

The app is started by uvicorn as specified in the project Dockerfile:

    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CHROMA_HOST, CHROMA_PORT, PREDICTIONS_DIR
from app.models import (
    ContactInfo,
    DataSourceInfo,
    HealthResponse,
    InfoResponse,
    ModelMetrics,
    TeamListItem,
)
from app.routers import analyze, head_to_head, pool, power_rankings, results
from app.services import get_all_teams

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown logging
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Log key configuration on startup and confirm clean shutdown."""
    logger.info(
        "API starting — ChromaDB: %s:%s | Predictions: %s",
        CHROMA_HOST, CHROMA_PORT, PREDICTIONS_DIR,
    )
    yield
    logger.info("API shutting down.")


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="March Madness Pool Analytics",
    lifespan=lifespan,
    description=(
        "AI/ML-powered NCAA tournament team-performance predictions. "
        "Provides win-probability distributions and similar-team lookups "
        "for every team in the current tournament field."
    ),
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------

# Allow the Vite dev server (port 5173) to call this API without browser
# CORS errors during local development.  In production this list should be
# tightened to the actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

# All API routes are served under /api so they don't collide with React Router
# client-side paths (e.g. /analyze, /info, /power-rankings, /head-to-head).
app.include_router(analyze.router,        prefix="/api")
app.include_router(pool.router,           prefix="/api")
app.include_router(power_rankings.router, prefix="/api")
app.include_router(head_to_head.router,   prefix="/api")
app.include_router(results.router,        prefix="/api")

# ---------------------------------------------------------------------------
# Root — health check
# ---------------------------------------------------------------------------


@app.get("/", response_model=HealthResponse, tags=["health"], summary="Health check")
async def root() -> HealthResponse:
    """
    Health-check endpoint.

    Returns a simple status object so that Docker health checks, load
    balancers, and the CI pipeline can verify the API is running.
    """
    return HealthResponse(
        status="ok",
        message="March Madness Pool Analytics API is running.",
    )


# ---------------------------------------------------------------------------
# Info
# ---------------------------------------------------------------------------


@app.get(
    "/api/teams",
    response_model=list[TeamListItem],
    tags=["teams"],
    summary="List all tournament teams",
)
async def teams() -> list[TeamListItem]:
    """
    Return every team in the current tournament field, sorted by seed then name.

    Used by the frontend to populate the Analyze-page dropdown.
    Only teams with a tournament seed set in the predictions data are included.
    """
    return [TeamListItem(**t) for t in get_all_teams()]


@app.get(
    "/api/info",
    response_model=InfoResponse,
    tags=["info"],
    summary="Project information",
)
async def info() -> InfoResponse:
    """
    Return structured information about the project, model, and data sources.

    All values here are static — they describe the model trained for the 2026
    tournament season and the fixed set of data sources used.  The frontend Info
    page renders these fields directly rather than hard-coding them.
    """
    return InfoResponse(
        project="March Madness Pool Analytics",
        description=(
            "Predicts NCAA tournament team performance using historical data "
            "and an ordinal regression model trained on seasons from 2010–2025."
        ),
        # Ordinal regression metrics for the 2026 season model.
        model=ModelMetrics(
            name="Ordinal Regression",
            accuracy=75.26,
            f1_weighted=76.33,
            precision_weighted=79.05,
            quadratic_weighted_kappa=0.763,
            ranked_probability_score=0.097,
            training_samples=643,
            test_samples=190,
            seasons="2010–2025",
        ),
        # External data sources used to build the predictions dataset.
        data_source=DataSourceInfo(
            player_team_stats="https://collegebasketballdata.com/",
            game_summaries="https://www.espn.com/",
            team_logos="https://www.sportslogos.net/",
        ),
        # Project author contact information.
        contact=ContactInfo(
            name="Josh Mayanja",
            email="joshmayanja30@gmail.com",
            linkedin="https://www.linkedin.com/in/josh-mayanja-a3001b200/",
            github="https://github.com/jmayanja33",
        ),
    )
