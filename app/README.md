# Backend

The backend is a **FastAPI** application that serves pre-calculated NCAA tournament
predictions. It loads team data from JSON files, queries a ChromaDB vector database for
similar-team lookups, and exposes a REST API consumed by the React frontend.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.12 | Language |
| FastAPI | ≥0.115 | Web framework |
| Uvicorn | ≥0.32 | ASGI server |
| Pydantic | ≥2.9 | Request/response validation |
| ChromaDB | ≥0.6 | Vector database client (similar teams) |
| uv | latest | Dependency management & virtual env |

---

## Directory Structure

```
app/
├── __init__.py
├── main.py          # App factory, CORS, root endpoints (/api/teams, /api/info)
├── config.py        # Environment variable settings
├── models.py        # All Pydantic request/response models (19 models)
├── services.py      # Business logic: data loading, formatting, ChromaDB queries
├── routers/
│   ├── __init__.py
│   ├── analyze.py        # GET /api/analyze/{team}, /api/analyze/most-similar/{team}
│   ├── pool.py           # POST /api/create-a-team
│   ├── power_rankings.py # GET /api/power-rankings
│   └── head_to_head.py   # GET /api/head-to-head
└── tests/
    ├── __init__.py
    ├── test_main.py           # Health check, /api/teams, /api/info
    ├── test_infrastructure.py # CI/CD config file validation
    ├── test_analyze.py        # Analyze & most-similar endpoints
    ├── test_create_a_team.py  # Pool POST endpoint
    ├── test_head_to_head.py   # Head-to-head endpoint
    └── test_power_rankings.py # Power rankings endpoint
```

---

## Local Development

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) installed
- ChromaDB running (see Docker Compose section below)

### Running with uv directly

```bash
# Install dependencies
uv sync

# Start the dev server (with hot-reload)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available at **http://localhost:8000**.

Interactive API docs (Swagger UI) are at **http://localhost:8000/docs**.

### Running with Docker Compose (recommended)

From the project root, start the full stack:

```bash
docker compose up --build
```

This starts ChromaDB, the backend, and the frontend together. The backend's source
directory is volume-mounted so file changes trigger hot-reload automatically.

| Service | URL |
|---|---|
| Backend | http://localhost:8000 |
| ChromaDB | http://localhost:8001 |
| Frontend | http://localhost:5173 |

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `data` | Root data directory (relative to project root) |
| `CHROMA_HOST` | `localhost` | ChromaDB hostname |
| `CHROMA_PORT` | `8001` | ChromaDB port (8001 in dev, 8000 in prod container network) |
| `CHROMA_COLLECTION` | `ncaa_teams` | ChromaDB collection name |

When running via Docker Compose, `CHROMA_HOST=chromadb` and `CHROMA_PORT=8000` are
injected automatically (backend reaches ChromaDB over the Docker network).

---

## API Reference

All endpoints are prefixed with `/api/`. The root health-check endpoint is at `/`.

### Health Check

```
GET /
```
Returns API status. Used by Docker health checks.

**Response:**
```json
{ "status": "ok" }
```

---

### Teams List

```
GET /api/teams
```
Returns all tournament teams sorted by seed, then alphabetically. Used to populate
dropdowns in the frontend.

**Response:**
```json
[
  { "name": "Duke", "seed": 1 },
  { "name": "Kentucky", "seed": 2 },
  ...
]
```

---

### Project Info

```
GET /api/info
```
Returns static project metadata, model performance metrics, data sources, and contact
information.

**Response fields:** `background`, `how_to_play`, `data_sources`, `h2h_model_metrics`,
`wins_model_info`, `contact`

---

### Team Analysis

```
GET /api/analyze/{team}
```
Returns the full analysis for a single team.

**Path parameter:** `team` — team name (case-insensitive, spaces OK)

**Response (`TeamAnalysis`):**
```json
{
  "name": "Duke",
  "seed": 1,
  "conference": "ACC",
  "wins": 28,
  "losses": 5,
  "profile_summary": "...",
  "win_probability_distribution": {
    "zero_wins": 0.05,
    "one_win": 0.10,
    "two_wins": 0.15,
    "three_wins": 0.20,
    "four_wins": 0.20,
    "five_wins": 0.15,
    "six_wins": 0.15
  },
  "players": [...],
  "team_stats": {...},
  "similar_teams": [...]
}
```

**Errors:** `404` if team not found

---

### Similar Teams

```
GET /api/analyze/most-similar/{team}
```
Returns the 3 most similar historical teams (since 2009–10) from ChromaDB.

**Path parameter:** `team` — team name (case-insensitive)

**Response (`SimilarTeamsResponse`):**
```json
{
  "team": "Duke",
  "similar_teams": [
    {
      "name": "Kansas",
      "year": 2012,
      "seed": 2,
      "tournament_wins": 5,
      "similarity_score": 0.94
    },
    ...
  ]
}
```

**Errors:** `404` if team not found

---

### Head to Head

```
GET /api/head-to-head?team1={name}&team2={name}
```
Returns the predicted win probability for a specific matchup.

**Query parameters:** `team1`, `team2` — team names (case-insensitive)

**Response (`H2HResponse`):**
```json
{
  "team1": { "name": "Duke", "win_probability": 0.62 },
  "team2": { "name": "Kentucky", "win_probability": 0.38 }
}
```

**Errors:**
- `400` if `team1` and `team2` are the same team
- `404` if the matchup is not found in predictions

---

### Power Rankings

```
GET /api/power-rankings
```
Returns all tournament teams grouped by their most-probable win total. Within each
bucket, teams are sorted by probability (descending), then alphabetically.

**Response (`PowerRankingsResponse`):**
```json
{
  "six_wins":   [{ "name": "...", "seed": 1, ... }, ...],
  "five_wins":  [...],
  "four_wins":  [...],
  "three_wins": [...],
  "two_wins":   [...],
  "one_win":    [...],
  "zero_wins":  [...]
}
```

Each entry is a `PoolTeamSummary`: `name`, `seed`, `conference`, `wins`, `losses`,
`win_probability_distribution`.

---

### Create a Team (Pool Builder)

```
POST /api/create-a-team
```
Accepts a list of team names and returns lightweight summaries for each. Teams not found
are silently skipped — partial pools are valid.

**Request body (`PoolRequest`):**
```json
{ "teams": ["Duke", "Kentucky", "Kansas"] }
```

**Response (`PoolResponse`):**
```json
{
  "teams": [
    {
      "name": "Duke",
      "seed": 1,
      "conference": "ACC",
      "wins": 28,
      "losses": 5,
      "win_probability_distribution": {...}
    },
    ...
  ]
}
```

---

## Data Models (`models.py`)

19 Pydantic models define all API contracts.

| Model | Used by | Description |
|---|---|---|
| `HealthResponse` | `GET /` | `{ status: str }` |
| `TeamEntry` | `GET /api/teams` | `{ name, seed }` |
| `WinProbabilityDistribution` | Many | Win probabilities for 0–6 wins |
| `PlayerProfile` | `TeamAnalysis` | Position, height, per-game stats |
| `TeamStats` | `TeamAnalysis` | Shooting %, blocks, rebounds, etc. |
| `SimilarTeam` | `TeamAnalysis` | Historical match with similarity score |
| `TeamAnalysis` | `GET /analyze/{team}` | Full team profile |
| `SimilarTeamsResponse` | `GET /most-similar/{team}` | Team + 3 similar teams |
| `PoolTeamSummary` | Power Rankings, Create Team | Lightweight team card |
| `PowerRankingsResponse` | `GET /power-rankings` | 7 win-bucket lists |
| `PoolRequest` | `POST /create-a-team` | `{ teams: [str] }` |
| `PoolResponse` | `POST /create-a-team` | `{ teams: [PoolTeamSummary] }` |
| `H2HTeam` | `H2HResponse` | `{ name, win_probability }` |
| `H2HResponse` | `GET /head-to-head` | Two `H2HTeam` objects |
| `InfoResponse` | `GET /api/info` | Project metadata & metrics |

---

## Services (`services.py`)

All business logic lives here. Routers call service functions; they never touch files or
databases directly.

### Data Loading

```python
load_predictions() -> dict
```
Loads the latest season's prediction JSON from `data/predictions/`. Result is cached
with `@lru_cache` so the file is only read once per process.

```python
find_team(name: str) -> dict | None
```
Case-insensitive lookup of a team by name in the loaded predictions. Returns the raw
team dict or `None` if not found.

```python
get_all_teams() -> list[TeamEntry]
```
Returns all teams as `TeamEntry` objects, sorted by seed then name.

```python
load_h2h_predictions() -> list[dict]
```
Loads `data/predictions/h2h-predictions.json`. Also cached with `@lru_cache`.

```python
get_h2h_prediction(team1_name: str, team2_name: str) -> H2HResponse | None
```
Direction-agnostic lookup: finds the matchup regardless of which team is listed first.

### Formatting Helpers

```python
format_height(inches: int) -> str          # 79 → "6'7\""
format_position(code: int) -> str          # 1 → "G", 3 → "F", 5 → "C"
calc_avg_per_game(total, games) -> float   # season total ÷ games played
calc_ft_pct(player: dict) -> float         # FTM ÷ FTA
```

### Pydantic Builders

```python
build_player_profile(player_dict: dict) -> PlayerProfile
build_win_distribution(raw_dict: dict) -> WinProbabilityDistribution
build_team_stats(team_dict: dict) -> TeamStats    # aggregates all player stats
build_team_analysis(team_dict, similar) -> TeamAnalysis
build_pool_team_summary(team_dict: dict) -> PoolTeamSummary
get_power_rankings() -> dict[str, list[PoolTeamSummary]]
```

### ChromaDB Integration

```python
team_name_to_chroma_id(name: str, year: int) -> str
```
Converts a display name to a ChromaDB document ID (e.g., `"North Carolina"` →
`"north_carolina_2026"`).

```python
get_similar_teams(team_name: str) -> list[SimilarTeam]
```
Queries ChromaDB for the 10 nearest neighbors using cosine distance, filters out
current-season (2026) teams, and returns the 3 closest historical matches.

Similarity score = `1 - cosine_distance` (range 0–1, higher = more similar).

If ChromaDB is unreachable, returns an empty list so the rest of the response still
succeeds.

---

## Configuration (`config.py`)

Settings are read from environment variables at import time:

```python
DATA_DIR          = os.getenv("DATA_DIR", "data")
CHROMA_HOST       = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT       = int(os.getenv("CHROMA_PORT", "8001"))
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "ncaa_teams")
```

The `PREDICTIONS_DIR` is derived from `DATA_DIR` and points to `data/predictions/`.

---

## Application Entry Point (`main.py`)

```python
app = FastAPI(title="March Madness Pool Analytics API")
```

**CORS:** All origins allowed (frontend dev server runs on a different port).

**Lifespan hooks:** Log startup and shutdown messages.

**Routers included:**
```python
app.include_router(analyze_router,         prefix="/api")
app.include_router(pool_router,            prefix="/api")
app.include_router(power_rankings_router,  prefix="/api")
app.include_router(head_to_head_router,    prefix="/api")
```

**Route registration order in `analyze.py`:**
The `/api/analyze/most-similar/{team}` route is registered *before*
`/api/analyze/{team}` to prevent `most-similar` from being matched as a team name.

---

## Unit Tests

Tests live in `app/tests/` and use **pytest** with **pytest-asyncio**.

```bash
# Run all tests
uv run pytest

# Run a specific test file
uv run pytest app/tests/test_analyze.py

# Run with verbose output
uv run pytest -v
```

### Test Files

| File | Tests | What's covered |
|---|---|---|
| `test_main.py` | 23 | `GET /`, `GET /api/teams`, `GET /api/info` |
| `test_infrastructure.py` | 23 | nginx config, docker-compose.prod.yml, frontend Dockerfile, init script |
| `test_analyze.py` | 8 | `GET /api/analyze/{team}`, `GET /api/analyze/most-similar/{team}` |
| `test_create_a_team.py` | 8 | `POST /api/create-a-team` (valid, invalid, mixed, empty) |
| `test_head_to_head.py` | 5 | `GET /api/head-to-head` (valid, unknown, self-matchup) |
| `test_power_rankings.py` | 7 | `GET /api/power-rankings` (grouping, sorting, completeness) |

### Testing Strategy

- **Fixtures** define reusable mock data and `TestClient` instances
- **`unittest.mock.patch`** mocks service-layer functions so tests are independent of
  the filesystem and ChromaDB
- **`pytest-asyncio`** with `asyncio_mode = "auto"` handles async test functions
- **Infrastructure tests** validate CI/CD config files (nginx, compose, Dockerfile, SSL
  bootstrap script) to catch misconfigurations before they reach production

---

## Data Files

The backend reads from two JSON files. Both are pre-calculated offline and committed to
the repository.

### `data/predictions/{year}.json`

Array of team objects. The loader picks the most recent year file automatically.

**Team object shape:**
```json
{
  "name": "Duke",
  "tournament_seed": 1,
  "conference": "ACC",
  "wins": 28,
  "losses": 5,
  "profile_summary": "...",
  "avg_height": 78.4,
  "players": [
    {
      "name": "Player Name",
      "position": 1,
      "height": 75,
      "games": 33,
      "minutes": 820,
      "points": 560,
      "free_throws_made": 80,
      "free_throws_attempted": 100,
      "two_point_field_goals_made": 120,
      "two_point_field_goals_attempted": 200,
      "three_point_field_goals_made": 60,
      "three_point_field_goals_attempted": 150,
      "blocks": 15,
      "offensive_rebounds": 20,
      "defensive_rebounds": 80,
      "turnovers": 50,
      "steals": 30,
      "fouls": 60
    }
  ],
  "win_probability_distribution": {
    "0": 0.05, "1": 0.10, "2": 0.15,
    "3": 0.20, "4": 0.20, "5": 0.15, "6": 0.15
  }
}
```

**Position codes:**
| Code | Position |
|---|---|
| 1 | G (Guard) |
| 2 | G/F |
| 3 | F (Forward) |
| 4 | F/C |
| 5 | C (Center) |

### `data/predictions/h2h-predictions.json`

Array of head-to-head matchup objects.

```json
[
  {
    "team1": { "name": "Duke", "win_probability": 0.62 },
    "team2": { "name": "Kentucky", "win_probability": 0.38 },
    "year": 2026
  }
]
```

Lookups are direction-agnostic: `(Duke, Kentucky)` and `(Kentucky, Duke)` both return
the same matchup with the probabilities correctly oriented.

---

## Linting

Linting uses [Ruff](https://docs.astral.sh/ruff/).

```bash
# Check for violations
uv run ruff check .

# Auto-fix fixable violations
uv run ruff check . --fix
```

Ruff is configured in `pyproject.toml` with rules `E` (errors), `F` (undefined names),
and `I` (import ordering). The `lint` CI job runs `ruff check .` and fails the pipeline
on any violation.

---

## Dependencies

Managed with **uv**. `pyproject.toml` specifies constraints; `uv.lock` pins exact
versions for reproducible installs.

```bash
uv sync          # install all deps (including dev)
uv sync --no-dev # install runtime deps only (used in Dockerfile)
```

### Runtime

| Package | Minimum | Purpose |
|---|---|---|
| `fastapi` | 0.115.0 | Web framework |
| `uvicorn[standard]` | 0.32.0 | ASGI server |
| `chromadb` | 0.6.0 | Vector database client |
| `scikit-learn` | 1.6.0 | (used in pre-computation scripts) |
| `numpy` | 2.0.0 | Numerical operations |
| `pydantic` | 2.9.0 | Data validation |

### Dev

| Package | Minimum | Purpose |
|---|---|---|
| `pytest` | 8.0.0 | Test framework |
| `pytest-asyncio` | 0.24.0 | Async test support |
| `httpx` | 0.28.0 | Async HTTP client (used by TestClient) |
| `ruff` | 0.8.0 | Linter |
| `pillow` | 12.1.1 | Image processing (used in scripts) |

---

## Docker

### Development (`Dockerfile`)

```
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen
COPY app/ ./app/
COPY scripts/ ./scripts/
COPY data/ ./data/
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

The `app/` and `data/` directories are volume-mounted in `docker-compose.yml`, so the
`COPY` steps are overridden by mounts during local dev — changes take effect immediately
via uvicorn's `--reload`.

### Production

In production the `--reload` flag is replaced:
```yaml
command: ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

The pre-built image `ghcr.io/jmayanja33/mmthepool-backend:latest` is pulled from GHCR
by the CI deploy job — no build happens on the server.
