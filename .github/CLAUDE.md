# CI/CD Pipeline — Claude Instructions

This file documents the full CI/CD pipeline for `march-madness-pool-analytics` so that
Claude can reason about, debug, and extend it correctly.

---

## Trigger Model

| Event | Jobs that run |
|---|---|
| `push` to `master` | `lint`, `test`, `secrets` |
| `pull_request` targeting `master` | `lint`, `test`, `secrets` |
| `workflow_dispatch` (manual) | `lint`, `test`, `secrets` → `build` → `deploy` |

**Only a manual `workflow_dispatch` triggers a production deploy.** Regular pushes run CI
only — they never build Docker images or touch the server.

---

## CI Jobs (parallel)

All three jobs run on `ubuntu-latest` and are fully independent — they execute in
parallel. **All three must pass for any downstream job to proceed.**

### `lint`
- Installs Python deps via `uv sync --frozen` using the `astral-sh/setup-uv@v5` action
  (with caching enabled).
- Runs `uv run ruff check .` — fails on any rule violation.
- To fix locally: `uv run ruff check . --fix`

### `test`
- Same `uv` setup as `lint`.
- Runs `uv run pytest` — fails if any test errors or fails.

### `secrets`
- Uses a **full clone** (`fetch-depth: 0`) so gitleaks can scan the entire commit history.
- Runs `gitleaks/gitleaks-action@v2` with `GITHUB_TOKEN` for the license.
- Fails if any secret pattern is detected anywhere in git history.

---

## Build Job

Runs only on `workflow_dispatch`, after all three CI jobs pass.

**Permissions:** `contents: read`, `packages: write` (required to push to GHCR).

**Authentication:** Uses the built-in `GITHUB_TOKEN` — no extra secret needed for pushing.

### Images built and pushed

| Image tag | Source |
|---|---|
| `ghcr.io/jmayanja33/mmthepool-backend:latest` | `Dockerfile` in project root |
| `ghcr.io/jmayanja33/mmthepool-nginx:latest` | `frontend/Dockerfile.prod` |

Images are always tagged `:latest`. Each deploy pulls the freshest `:latest`.

---

## Deploy Job

Runs only on `workflow_dispatch`, after `build` passes. Uses a **concurrency group**
(`group: deploy`, `cancel-in-progress: false`) so a second dispatch waits rather than
cancelling the first.

### Required GitHub Repository Secrets

| Secret | Description |
|---|---|
| `EC2_HOST` | Public hostname or IP of the production AWS EC2 instance |
| `EC2_USER` | SSH username on the instance (typically `ubuntu`) |
| `EC2_SSH_KEY` | Private SSH key (PEM format) authorised on the instance |
| `CERTBOT_EMAIL` | Email address for Let's Encrypt certificate issuance/renewal notices |
| `GHCR_TOKEN` | GitHub PAT with `read:packages` scope — used to pull images on the server |

### Deploy Steps (in order)

1. **Prepare server directory** — SSHes in and runs:
   ```
   mkdir -p ~/march-madness-pool-analytics
   sudo chown -R "$USER:$USER" ~/march-madness-pool-analytics
   ```
   This fixes ownership issues left by prior Docker/sudo operations.

2. **Copy config files** — SCPs the following directly from the CI runner checkout to
   `~/march-madness-pool-analytics/` on the server. No `git clone` or `git pull` is
   ever run on the server.
   - `docker-compose.prod.yml`
   - `nginx/` (entire directory)
   - `init-letsencrypt.sh`
   - `data/predictions/` (all prediction JSON files)
   - `data/vector_db/chroma_vectors.json` (vector source data)

3. **Deploy SSH script** — the main deploy logic:
   - Installs Docker CE + Compose plugin if not already present (full apt-get flow).
   - Authenticates to GHCR: `echo "$GHCR_TOKEN" | sudo docker login ghcr.io -u jmayanja33 --password-stdin`
   - **First deploy only:** runs `init-letsencrypt.sh` if the cert directory
     `./data/certbot/conf/live/mmthepool.com` does not exist.
   - Pulls pre-built images: `sudo docker compose -f docker-compose.prod.yml pull`
   - Starts the stack: `sudo docker compose -f docker-compose.prod.yml up -d --remove-orphans`
   - **ChromaDB reset** (every deploy):
     1. Stops the `chromadb` container.
     2. Deletes all files in `./data/vector_db/` except `chroma_vectors.json` and `.gitkeep`.
     3. Restarts `chromadb`.
     4. Waits 10 seconds for it to become ready.
     5. Runs `scripts/import_vectors.py --host chromadb --port 8000 --reset` inside the
        `backend` container via `docker compose exec -T`.
   - Logs out of GHCR: `sudo docker logout ghcr.io` — credentials are never left on the
     server after the pull.

---

## Production Stack (`docker-compose.prod.yml`)

Four services; only `nginx` exposes ports to the host.

| Service | Image | Ports | Notes |
|---|---|---|---|
| `chromadb` | `chromadb/chroma:latest` | internal only | Persists to `./data/vector_db:/data` |
| `backend` | `ghcr.io/jmayanja33/mmthepool-backend:latest` | internal only | Runs uvicorn without `--reload`; mounts `./data:/app/data` |
| `nginx` | `ghcr.io/jmayanja33/mmthepool-nginx:latest` | `80:80`, `443:443` | TLS termination + React SPA + API proxy |
| `certbot` | `certbot/certbot` | none | Renews SSL cert; runs on a schedule |

### Environment Variables (backend)
- `CHROMA_HOST=chromadb` — Docker network service name
- `CHROMA_PORT=8000` — ChromaDB internal port (NOT the host-exposed 8001 from dev)

---

## Domain & TLS

- **FQDN / Domain:** `mmthepool.com`
- **TLS provider:** Let's Encrypt via Certbot
- **Certificate path on server:** `./data/certbot/conf/live/mmthepool.com/`
  - `fullchain.pem` — certificate chain (referenced by nginx)
  - `privkey.pem` — private key (referenced by nginx)
- **nginx config:** `nginx/conf.d/app.conf`
  - Port 80: serves ACME HTTP-01 challenge at `/.well-known/acme-challenge/`, redirects
    all other traffic to HTTPS.
  - Port 443: terminates TLS, proxies `/api/` to `http://backend:8000`, serves React SPA
    for all other paths with `try_files $uri $uri/ /index.html`.

### Certificate Renewal (certbot service)
- Renewal is attempted at **04:00 EST (09:00 UTC)** every **14 days**.
- Certbot only renews when fewer than 30 days remain on the 90-day cert.
- nginx reloads its config every 6 hours (`sleep 6h & nginx -s reload`) so renewed certs
  are picked up without a container restart.

### First-deploy SSL bootstrap (`init-letsencrypt.sh`)
- Runs only if `./data/certbot/conf/live/mmthepool.com` does not exist.
- Triggered with: `DOMAIN=mmthepool.com EMAIL="$CERTBOT_EMAIL" sudo -E bash ./init-letsencrypt.sh`
- After it completes, nginx can start with valid TLS.

---

## Vector Database (ChromaDB)

- **Collection name:** `ncaa_teams`
- **Distance metric:** cosine (configured on collection creation)
- **Source data:** `data/vector_db/chroma_vectors.json`
  - Schema: `{ "ids": [...], "embeddings": [...], "metadatas": [...], "documents": [...] }`
- **Import script:** `scripts/import_vectors.py`
  - Local dev: `uv run scripts/import_vectors.py` (targets `localhost:8001`)
  - Production (called by deploy): `uv run scripts/import_vectors.py --host chromadb --port 8000 --reset`
  - `--reset` drops and recreates the collection before importing, removing stale vectors.
  - Batch size: 200 records per upsert call.

### ChromaDB Ports
| Environment | Host port | Container port |
|---|---|---|
| Local dev (`docker-compose.yml`) | `8001` | `8000` |
| Production (`docker-compose.prod.yml`) | none (internal) | `8000` |

**Important:** the import script's `--port` argument must match the **host** port in dev
(`8001`) and the **container-internal** port in prod (`8000`).

---

## Local Development Stack (`docker-compose.yml`)

Three services, all with source-mounted hot-reloading.

| Service | Port | Notes |
|---|---|---|
| `chromadb` | `8001` (host) | Data persisted to `./data/vector_db` |
| `backend` | `8000` | Source mounted; uvicorn `--reload` via Dockerfile CMD |
| `frontend` | `5173` | Vite HMR; proxies `/api/` to `http://backend:8000` |

To start: `docker compose up --build`

---

## Key Files Reference

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Full pipeline definition |
| `docker-compose.yml` | Local dev stack |
| `docker-compose.prod.yml` | Production stack |
| `nginx/conf.d/app.conf` | Nginx server blocks (HTTP redirect + HTTPS + API proxy) |
| `init-letsencrypt.sh` | First-time SSL certificate bootstrap |
| `scripts/import_vectors.py` | ChromaDB vector import script |
| `data/vector_db/chroma_vectors.json` | Pre-computed embeddings (source of truth) |
| `data/predictions/` | Team prediction JSON files (mounted into backend) |
| `Dockerfile` | Backend image |
| `frontend/Dockerfile.prod` | Nginx + React production image |

---

## Common Failure Modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `lint` fails | Ruff rule violation | `uv run ruff check . --fix` locally, commit |
| `test` fails | Pytest failure | Fix the failing test or the code it covers |
| `secrets` fails | Secret pattern in git history | Remove secret, rotate it, update gitleaks config if false-positive |
| SCP step fails | Root-owned files in server dir | The "Prepare server directory" step handles this automatically |
| nginx 502 | Backend container not healthy | Check `docker compose logs backend`; backend healthcheck may be failing |
| Cert not found | First deploy, `init-letsencrypt.sh` not run | Ensure `CERTBOT_EMAIL` secret is set; re-trigger `workflow_dispatch` |
| ChromaDB empty after deploy | Import script failed | Check deploy logs for `[ERROR]` lines from `import_vectors.py` |
