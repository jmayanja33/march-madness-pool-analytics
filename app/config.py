"""
Application configuration.

All settings are read from environment variables so that the same code runs
identically in local development, Docker Compose, and any future deployment.
Defaults are tuned for local development (outside Docker).
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Data paths
# ---------------------------------------------------------------------------

# Root data directory — one level above this package.
# Override DATA_DIR in the environment to point elsewhere (e.g. in tests).
DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(Path(__file__).parent.parent / "data")))

# Directory that holds per-season team prediction JSON files.
PREDICTIONS_DIR: Path = DATA_DIR / "predictions"

# ---------------------------------------------------------------------------
# ChromaDB settings
# ---------------------------------------------------------------------------

# Hostname for the ChromaDB service.
# Inside Docker Compose this resolves to the "chromadb" service via DNS.
CHROMA_HOST: str = os.getenv("CHROMA_HOST", "localhost")

# Port that ChromaDB listens on inside its container (always 8000).
# Locally, ChromaDB is exposed on 8001 — set CHROMA_PORT=8001 in that case.
CHROMA_PORT: int = int(os.getenv("CHROMA_PORT", "8001"))

# Name of the ChromaDB collection that stores the PCA-reduced team vectors.
# Must match the --collection argument used when running scripts/import_vectors.py.
CHROMA_COLLECTION: str = os.getenv("CHROMA_COLLECTION", "ncaa_teams")
