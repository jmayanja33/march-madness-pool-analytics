# CI/CD Pipeline Documentation

This document explains the full CI/CD pipeline for `march-madness-pool-analytics` —
from a code push to a live deployment at **mmthepool.com**.

---

## Overview

The pipeline lives in `.github/workflows/ci.yml` and is powered by **GitHub Actions**.

There are two distinct modes:

- **Every push / pull request to `master`:** runs automated quality checks (lint, tests,
  secret scan). Nothing is deployed.
- **Manual trigger (`workflow_dispatch`):** runs quality checks, then builds Docker images
  and deploys them to the production AWS server.

```
Push/PR ──► lint ──┐
                   ├──► (all pass) ──► done
           test ──┤
                   │
         secrets ──┘

workflow_dispatch:
Push/PR ──► lint ──┐
                   ├──► (all pass) ──► build ──► deploy ──► live at mmthepool.com
           test ──┤
                   │
         secrets ──┘
```

---

## Step 1 — Quality Checks (always run)

All three checks run **in parallel**. Every single one must pass before anything
else can proceed.

### Lint

**Tool:** [Ruff](https://docs.astral.sh/ruff/)

Ruff scans all Python source code for style and correctness issues. This catches things
like unused imports, undefined names, and formatting problems.

- To check locally: `uv run ruff check .`
- To auto-fix locally: `uv run ruff check . --fix`

### Tests

**Tool:** [pytest](https://docs.pytest.org/)

Runs the full unit test suite for the FastAPI backend.

- To run locally: `uv run pytest`

### Secret Detection

**Tool:** [gitleaks](https://github.com/gitleaks/gitleaks)

Scans the **entire git commit history** (not just the latest commit) for accidentally
committed secrets such as API keys, passwords, or tokens. If any are found the pipeline
fails immediately.

> **Note:** If you accidentally commit a secret, simply removing it in a follow-up
> commit is not enough — gitleaks scans history. You must rotate the secret and, if
> needed, rewrite git history or add a gitleaks suppression comment.

---

## Step 2 — Build Docker Images (manual deploy only)

After all three checks pass, the pipeline builds two Docker images and pushes them to
the **GitHub Container Registry (GHCR)** at `ghcr.io`.

| Image | Built from | Tag |
|---|---|---|
| `ghcr.io/jmayanja33/mmthepool-backend:latest` | `Dockerfile` (project root) | `latest` |
| `ghcr.io/jmayanja33/mmthepool-nginx:latest` | `frontend/Dockerfile.prod` | `latest` |

The backend image contains the FastAPI application. The nginx image contains both the
nginx reverse proxy configuration and the compiled React frontend.

Images are pushed to GHCR using the repository's built-in `GITHUB_TOKEN` — no
additional credentials are needed for the build step.

---

## Step 3 — Deploy to Production (manual deploy only)

The deploy step connects to the production AWS EC2 server via SSH and updates the
running application. Two deploys can never run simultaneously — if one is already in
progress, the next trigger will wait for it to finish.

### 3a. Prepare the Server Directory

Before copying any files, the pipeline ensures that `~/march-madness-pool-analytics`
exists on the server and is owned by the deploy user. Previous Docker operations can
leave subdirectories owned by `root`, which would cause file copies to fail.

### 3b. Copy Files to the Server

The pipeline copies the following files directly from the CI runner to the server.
**The server never runs `git clone` or `git pull`** — it only ever receives files that
have already passed CI.

| File / Directory | Purpose |
|---|---|
| `docker-compose.prod.yml` | Production service definitions |
| `nginx/` | Nginx server configuration |
| `init-letsencrypt.sh` | First-time SSL certificate setup script |
| `data/predictions/` | Pre-computed team prediction JSON files |
| `data/vector_db/chroma_vectors.json` | Pre-computed ChromaDB vector embeddings |

### 3c. Deploy SSH Script

Once files are in place, the pipeline SSHes in and runs the deploy script:

1. **Install Docker** — if Docker is not already installed on the server, it is
   installed automatically using the official Docker apt repository.

2. **Authenticate to GHCR** — logs in to `ghcr.io` using the `GHCR_TOKEN` secret so
   the server can pull the private images.

3. **SSL Certificate (first deploy only)** — if the Let's Encrypt certificate for
   `mmthepool.com` does not exist yet, `init-letsencrypt.sh` is run to obtain it.
   On all subsequent deploys this step is skipped.

4. **Pull images** — pulls the latest `mmthepool-backend` and `mmthepool-nginx` images
   from GHCR.

5. **Start the stack** — runs `docker compose -f docker-compose.prod.yml up -d --remove-orphans`
   to bring up all services.

6. **Reset ChromaDB** — on every deploy the vector database is fully reset and
   reimported from the source JSON file:
   - The ChromaDB container is stopped.
   - All binary data files in `./data/vector_db/` are deleted (only `chroma_vectors.json`
     is preserved).
   - ChromaDB is restarted with a clean data directory.
   - The import script (`scripts/import_vectors.py`) is run inside the backend container
     to reimport all vectors.

   This ensures the live database always reflects the latest `chroma_vectors.json` and
   never accumulates stale data.

7. **Log out of GHCR** — credentials are removed from the server immediately after the
   image pull so they are never left on disk.

---

## Production Services

The production stack (`docker-compose.prod.yml`) runs four services on the AWS server.

```
Internet
   │
   ▼
nginx (ports 80 + 443)
   │                    ┌──────────────────────┐
   ├── /api/ ──────────►│ backend (FastAPI)     │
   │                    │  port 8000 (internal) │
   │                    └──────────┬───────────┘
   │                               │
   │                    ┌──────────▼───────────┐
   │                    │ chromadb             │
   │                    │  port 8000 (internal)│
   │                    └──────────────────────┘
   │
   └── everything else → React SPA (static files in nginx image)

certbot (background) ── renews SSL cert ──► shared volume ──► nginx picks up on reload
```

| Service | Image | External Port | Notes |
|---|---|---|---|
| `nginx` | `ghcr.io/jmayanja33/mmthepool-nginx:latest` | 80, 443 | TLS termination, API proxy, React SPA |
| `backend` | `ghcr.io/jmayanja33/mmthepool-backend:latest` | none | FastAPI; internal only |
| `chromadb` | `chromadb/chroma:latest` | none | Vector DB; internal only |
| `certbot` | `certbot/certbot` | none | SSL renewal; runs on a schedule |

Only nginx is reachable from the internet. The backend and ChromaDB are only accessible
within the internal Docker network.

---

## Domain & SSL

- **Domain:** `mmthepool.com`
- **SSL Provider:** [Let's Encrypt](https://letsencrypt.org/) via Certbot
- **Certificate location on server:** `./data/certbot/conf/live/mmthepool.com/`

### How SSL works

nginx listens on both port 80 and 443:

- **Port 80 (HTTP):** Serves Let's Encrypt challenge files (for certificate verification),
  then redirects all other traffic to HTTPS.
- **Port 443 (HTTPS):** Terminates TLS using the Let's Encrypt certificate, then routes
  traffic to the backend or serves the React app.

### Certificate Renewal

The `certbot` service runs in the background and attempts renewal at **04:00 EST (09:00 UTC)**
every 14 days. Let's Encrypt certificates last 90 days; Certbot only actually renews
when fewer than 30 days remain, so the 14-day check cadence provides a safe buffer.

nginx automatically reloads its configuration every 6 hours, so renewed certificates
are picked up without any manual intervention or container restarts.

---

## Vector Database (ChromaDB)

The site uses ChromaDB to find teams similar to a queried team.

- **Collection:** `ncaa_teams`
- **Distance metric:** cosine similarity
- **Source data:** `data/vector_db/chroma_vectors.json` — pre-computed embeddings
  generated offline and committed to the repository.

The database is **fully reset on every deploy** to ensure it always matches the
committed source JSON. This is intentional — the source JSON is the single source of
truth.

To manually populate the database locally after starting the dev stack:

```bash
uv run scripts/import_vectors.py
# or with explicit options:
uv run scripts/import_vectors.py --host localhost --port 8001 --reset
```

---

## Required GitHub Secrets

These must be configured in the repository's **Settings → Secrets and variables → Actions**
before a manual deploy can succeed.

| Secret | What it is |
|---|---|
| `EC2_HOST` | Public IP or hostname of the production AWS EC2 instance |
| `EC2_USER` | SSH username on the instance (e.g. `ubuntu`) |
| `EC2_SSH_KEY` | Private SSH key (PEM format) that has access to the instance |
| `CERTBOT_EMAIL` | Email address Let's Encrypt uses for expiry notifications |
| `GHCR_TOKEN` | GitHub Personal Access Token with `read:packages` scope |

---

## Local Development

To run the full stack locally:

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| Backend (FastAPI) | http://localhost:8000 |
| ChromaDB | http://localhost:8001 |

The frontend and backend source directories are volume-mounted, so code changes are
reflected immediately without rebuilding.

---

## Triggering a Production Deploy

1. Go to the repository on GitHub.
2. Click **Actions** → **CI** (the workflow name).
3. Click **Run workflow** → select the `master` branch → **Run workflow**.
4. The pipeline will run lint/test/secrets, build images, and deploy to `mmthepool.com`.

> Only push deploys that have already passed the CI checks. The build and deploy jobs
> are blocked by the quality checks and will not run if any check fails.

---

## Troubleshooting

| Problem | What to check |
|---|---|
| Lint fails | Run `uv run ruff check . --fix` locally and commit the fixes |
| Tests fail | Run `uv run pytest` locally and fix the failing test |
| Secret scan fails | Identify the detected secret, rotate it, and check gitleaks docs for suppression |
| Deploy SSH fails | Verify `EC2_HOST`, `EC2_USER`, and `EC2_SSH_KEY` secrets are correct |
| nginx shows 502 | Backend is unhealthy — check `docker compose logs backend` on the server |
| Site has no SSL | `CERTBOT_EMAIL` secret may be missing; re-trigger the deploy |
| ChromaDB has no data | Import script failed during deploy — check the deploy log for `[ERROR]` lines |
| Images not found on server | Verify `GHCR_TOKEN` has `read:packages` scope and hasn't expired |
