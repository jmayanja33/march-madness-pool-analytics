"""
import_vectors.py
----------------
One-time import script that loads pre-computed vector embeddings from a JSON
file into a running ChromaDB instance.

Usage
-----
    # Against the local docker-compose stack (ChromaDB exposed on 8001):
    uv run scripts/import_vectors.py

    # Against a custom host / collection:
    uv run scripts/import_vectors.py \
        --host localhost --port 8001 \
        --collection ncaa_teams \
        --file data/vector_db/chroma_vectors.json

The script is idempotent: re-running it will upsert records that already exist
rather than duplicating them.
"""

import argparse
import json
import sys
from pathlib import Path

import chromadb


# ── Constants ─────────────────────────────────────────────────────────────────

# Number of documents sent to ChromaDB per HTTP request.  Keeping this below
# ~500 avoids hitting ChromaDB's default request-size limits.
BATCH_SIZE = 200

# Default ChromaDB collection name used by the backend.
DEFAULT_COLLECTION = "ncaa_teams"

# Default path to the exported vectors JSON file (relative to project root).
DEFAULT_JSON_FILE = (
    "data/vector_db/"
    "chroma_vectors.json"
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def load_json(file_path: Path) -> tuple[list[str], list[list[float]], list[dict], list[str]]:
    """Load and validate the exported vectors JSON file.

    Expected JSON shape::

        {
            "ids":        [...],   # unique per-record IDs matching team_id in metadata
            "embeddings": [...],   # list of float vectors
            "metadatas":  [...],   # list of metadata dicts (each contains a team_id field)
            "documents":  [...]    # list of document strings
        }

    Args:
        file_path: Absolute or relative path to the JSON file.

    Returns:
        A 4-tuple of (ids, embeddings, metadatas, documents).

    Raises:
        SystemExit: If the file cannot be read, is missing required keys, has
            mismatched list lengths, or contains duplicate IDs.
    """
    # Read and parse the JSON file
    try:
        with open(file_path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        print(f"[ERROR] File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"[ERROR] Failed to parse JSON: {exc}", file=sys.stderr)
        sys.exit(1)

    # Validate all required keys are present
    required_keys = {"ids", "embeddings", "metadatas", "documents"}
    missing = required_keys - data.keys()
    if missing:
        print(f"[ERROR] JSON is missing required keys: {missing}", file=sys.stderr)
        sys.exit(1)

    ids: list[str] = data["ids"]
    embeddings: list[list[float]] = data["embeddings"]
    metadatas: list[dict] = data["metadatas"]
    documents: list[str] = data["documents"]

    # Validate all four lists are the same length
    lengths = {len(ids), len(embeddings), len(metadatas), len(documents)}
    if len(lengths) != 1:
        print(
            f"[ERROR] Mismatched list lengths — ids: {len(ids)}, embeddings: {len(embeddings)}, "
            f"metadatas: {len(metadatas)}, documents: {len(documents)}",
            file=sys.stderr,
        )
        sys.exit(1)

    # Confirm IDs are unique (guard against re-introduced generation bugs)
    if len(set(ids)) != len(ids):
        duplicates = len(ids) - len(set(ids))
        print(f"[ERROR] {duplicates} duplicate IDs found in the JSON file.", file=sys.stderr)
        sys.exit(1)

    return ids, embeddings, metadatas, documents


def import_vectors(
    client: chromadb.HttpClient,
    collection_name: str,
    ids: list[str],
    embeddings: list[list[float]],
    metadatas: list[dict],
    documents: list[str],
) -> None:
    """Upsert all vectors into a ChromaDB collection in batches.

    Creates the collection if it does not already exist.  Uses ``upsert`` so
    the script can be re-run safely without creating duplicate documents.

    Args:
        client:          An authenticated ChromaDB HTTP client.
        collection_name: Name of the target collection.
        ids:             Unique document IDs (one per record).
        embeddings:      Pre-computed embedding vectors (one per record).
        metadatas:       Metadata dicts (one per record).
        documents:       Raw document strings (one per record).
    """
    # Get or create the collection; embedding_function=None because we are
    # supplying pre-computed vectors directly.
    collection = client.get_or_create_collection(name=collection_name)
    print(f"[INFO] Using collection '{collection_name}'")

    total = len(ids)
    imported = 0

    # Process records in fixed-size batches to respect HTTP request limits
    for start in range(0, total, BATCH_SIZE):
        end = min(start + BATCH_SIZE, total)

        # Slice each list to the current batch window
        batch_ids = ids[start:end]
        batch_embeddings = embeddings[start:end]
        batch_metadatas = metadatas[start:end]
        batch_documents = documents[start:end]

        collection.upsert(
            ids=batch_ids,
            embeddings=batch_embeddings,
            metadatas=batch_metadatas,
            documents=batch_documents,
        )

        imported += len(batch_ids)
        print(f"[INFO] Upserted {imported}/{total} records …")

    print(f"[OK]   Import complete — {total} records in '{collection_name}'.")


# ── CLI ───────────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(
        description="Import pre-computed ChromaDB vectors from a JSON export file."
    )
    parser.add_argument(
        "--host",
        default="localhost",
        help="ChromaDB host (default: localhost)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="ChromaDB port as exposed by docker-compose (default: 8001)",
    )
    parser.add_argument(
        "--collection",
        default=DEFAULT_COLLECTION,
        help=f"ChromaDB collection name (default: {DEFAULT_COLLECTION})",
    )
    parser.add_argument(
        "--file",
        default=DEFAULT_JSON_FILE,
        help=f"Path to the vectors JSON file (default: {DEFAULT_JSON_FILE})",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point: parse args, load data, connect to ChromaDB, and import."""
    args = parse_args()
    # Resolve relative to the project root (parent of the scripts/ directory)
    # so the script works correctly regardless of the working directory.
    file_path = Path(__file__).parent.parent / args.file

    print(f"[INFO] Loading vectors from: {file_path}")
    ids, embeddings, metadatas, documents = load_json(file_path)
    print(f"[INFO] Loaded {len(ids)} records ({len(set(ids))} unique IDs)")

    # Connect to the ChromaDB HTTP server
    print(f"[INFO] Connecting to ChromaDB at {args.host}:{args.port} …")
    try:
        client = chromadb.HttpClient(host=args.host, port=args.port)
        # Trigger an actual network call to verify connectivity
        client.heartbeat()
    except Exception as exc:
        print(f"[ERROR] Cannot reach ChromaDB at {args.host}:{args.port}: {exc}", file=sys.stderr)
        sys.exit(1)

    print("[INFO] Connected.")

    import_vectors(client, args.collection, ids, embeddings, metadatas, documents)


if __name__ == "__main__":
    main()
