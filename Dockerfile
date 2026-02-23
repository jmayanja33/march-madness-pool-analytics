# Backend Dockerfile — FastAPI service running under uv.
# Uses the official uv binary for fast, reproducible dependency installation.

FROM python:3.12-slim

# Copy the uv binary from the official uv image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Install dependencies first — separate layer so it is only rebuilt when
# pyproject.toml or uv.lock changes, not on every source code change.
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# Copy application source and pre-calculated data
COPY app/ ./app/
COPY data/ ./data/

EXPOSE 8000

# Run with --reload for hot-reloading during local development.
# Bind to 0.0.0.0 so the port is reachable from outside the container.
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
