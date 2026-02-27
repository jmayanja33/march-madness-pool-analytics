"""
March Madness Pool Analytics — FastAPI application entry point.

This module creates the FastAPI app instance, configures CORS middleware so
the Vite frontend can reach the API during local development, and registers
all route groups.

The app is started by uvicorn as specified in the project Dockerfile:

    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import HealthResponse, TeamListItem
from app.routers import analyze
from app.services import get_all_teams

# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="March Madness Pool Analytics",
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

# /analyze and /analyze/most-similar routes defined in app/routers/analyze.py
app.include_router(analyze.router)

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
    "/teams",
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


@app.get("/info", tags=["info"], summary="Project information")
async def info() -> dict:
    """
    Return high-level information about the project, model, and data sources.

    This data populates the frontend Info page.
    """
    return {
        "project": "March Madness Pool Analytics",
        "description": (
            "Predicts NCAA tournament team performance using historical data "
            "and a machine learning model trained on seasons from 2009-10 onwards."
        ),
        "model": "Gradient Boosting classifier trained on team season statistics",
        "data_source": "College Basketball Reference (Sports Reference)",
        "vector_db": "ChromaDB — cosine similarity on PCA-reduced team vectors",
    }
