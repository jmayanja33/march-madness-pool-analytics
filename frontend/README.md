# Frontend

The frontend is a React 19 + Vite single-page application (SPA) that displays NCAA
tournament predictions, team analysis, bracket visualizations, and pool-building tools.
In production it is compiled to static files and served by nginx at **mmthepool.com**.

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| React Router DOM | 7 | Client-side routing |
| Vite | 6 | Dev server & build tool |
| Node | 20 | JS runtime |

---

## Directory Structure

```
frontend/
├── src/
│   ├── main.jsx                  # React app entry point
│   ├── App.jsx                   # Root router (BrowserRouter + 7 routes)
│   ├── index.css                 # Global styles & font imports
│   ├── api/
│   │   └── teamApi.js            # All backend API call functions
│   ├── components/               # Reusable UI components
│   │   ├── NavBar.jsx            # Top navigation bar
│   │   ├── NavBar.css
│   │   ├── TeamCard.jsx          # Full team analysis card (used across multiple pages)
│   │   ├── TeamCard.css
│   │   ├── TeamPopup.jsx         # Modal overlay for team analysis (used in Bracket)
│   │   ├── TeamPopup.css
│   │   ├── Bracket.jsx           # Full tournament bracket container
│   │   ├── BracketRegion.jsx     # Single region (East / West / Midwest / South)
│   │   ├── BracketRegion.css
│   │   ├── BracketSlot.jsx       # Individual team slot in the bracket grid
│   │   └── BracketSlot.css
│   ├── pages/                    # Full-page route components
│   │   ├── Home.jsx              # Landing page
│   │   ├── Home.css
│   │   ├── Analyze.jsx           # Multi-team side-by-side comparison (up to 4)
│   │   ├── Analyze.css
│   │   ├── CreateTeam.jsx        # Pool team builder (8 teams)
│   │   ├── CreateTeam.css
│   │   ├── PowerRankings.jsx     # Teams grouped by predicted win total
│   │   ├── PowerRankings.css
│   │   ├── HeadToHead.jsx        # Head-to-head matchup predictor
│   │   ├── HeadToHead.css
│   │   ├── BracketPage.jsx       # Interactive tournament bracket viewer
│   │   ├── BracketPage.css
│   │   ├── Results.jsx           # Model results by year — H2H accuracy & wins evaluation
│   │   ├── Results.css
│   │   ├── Info.jsx              # Project background, data sources, model metrics
│   │   └── Info.css
│   ├── data/
│   │   └── bracketData.js        # 2026 NCAA tournament bracket structure
│   └── utils/
│       └── colors.js             # Probability → hex color mapping
├── public/
│   └── logos/                    # Team logo PNG files (one per team)
├── Dockerfile                    # Dev image: Node 20 + Vite dev server (port 5173)
├── Dockerfile.prod               # Prod image: Node builder → nginx Alpine
├── vite.config.js                # Vite config with API proxy
├── package.json                  # npm dependencies & scripts
├── .env.example                  # Environment variable template
└── .dockerignore
```

---

## Local Development

### Prerequisites

- Node 20+ (or use Docker — see below)
- Backend running on `http://localhost:8000`

### Running with npm

```bash
cd frontend
npm install
npm run dev
```

The app is available at **http://localhost:5173**.

Vite proxies all `/api/*` requests to the backend. Set the backend URL via the
`BACKEND_URL` environment variable (defaults to `http://localhost:8000`).

### Running with Docker Compose (recommended)

From the project root, start the full stack (backend + frontend + ChromaDB):

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| ChromaDB | http://localhost:8001 |

Source files are volume-mounted so changes are hot-reloaded without rebuilding.

### Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8000` | FastAPI backend URL for Vite proxy |

When running inside Docker Compose, `BACKEND_URL` is automatically set to
`http://backend:8000` (the Docker network service name).

---

## Production Build

The production image is built via a two-stage Docker build:

**Stage 1 — Build:**
```bash
npm install
npm run build    # outputs compiled assets to /app/dist
```

**Stage 2 — Serve:**
The `/app/dist` directory is copied into an nginx Alpine image and served as static
files. nginx is configured via `nginx/conf.d/app.conf` (mounted at runtime) to:

- Serve the React SPA on all routes, falling back to `index.html` (supports React Router)
- Proxy `/api/*` requests to the FastAPI backend
- Terminate TLS with Let's Encrypt certificates

The production image is built and pushed to GHCR by the CI pipeline:
`ghcr.io/jmayanja33/mmthepool-nginx:latest`

---

## Routing

Routes are defined in `src/App.jsx`:

| Path | Component | Description |
|---|---|---|
| `/` | `Home` | Landing page with navigation buttons |
| `/bracket` | `BracketPage` | Interactive tournament bracket |
| `/analyze` | `Analyze` | Side-by-side team comparison (up to 4) |
| `/create-team` | `CreateTeam` | Build a pool team (8 slots) |
| `/power-rankings` | `PowerRankings` | Teams grouped by predicted win total |
| `/head-to-head` | `HeadToHead` | Matchup win-probability predictor |
| `/results` | `Results` | H2H model accuracy and wins evaluation by year |
| `/info` | `Info` | Project background, data, and model metrics |

All routes are client-side (React Router). nginx is configured with `try_files` to
return `index.html` for all non-asset paths so deep-links work correctly.

---

## Pages

### Home (`/`)

Landing page with the site logo, title, and six navigation buttons arranged in a 2×3
grid linking to the other pages.

### Analyze (`/analyze`)

Compare up to 4 teams side-by-side. Each team is displayed in a `TeamCard` column.

**Interaction flow:**
1. A centered dropdown appears when no teams are selected.
2. User picks a team → the `TeamCard` column appears.
3. Up to 3 more teams can be added via the "Add Team" button.
4. Teams already selected are filtered out of the dropdown.
5. Each `TeamCard` has an ✕ button to remove it.

**API calls:**
- `GET /api/teams` once on mount (populates the dropdown)
- `GET /api/analyze/{team}` each time a team is added

### Create Team (`/create-team`)

Build a pool team by selecting up to 8 tournament teams.

**Features:**
- 8 team slots — each starts as an "Add Team" button
- Once selected: displays seed, name, conference, and logo
- Right-side summary panel:
  - Expected wins per team (from the win probability distribution)
  - Total expected pool wins
  - Win distribution histogram with probability color coding
  - Percentile reference lines (5th, 25th, 75th, 95th)

**API calls:**
- `GET /api/teams` on mount (dropdown)
- `POST /api/create-a-team` with `{ teams: [...] }` when the team list changes

### Power Rankings (`/power-rankings`)

Teams sorted into 7 sections by their most-probable win total (0–6 wins).

Within each section, teams are sorted by:
1. Probability of that win total (descending)
2. Alphabetically (tie-break)

Each team card shows: seed, name, conference, logo, and the probability for their win
bucket.

**API calls:**
- `GET /api/power-rankings` on mount

### Head to Head (`/head-to-head`)

Select two teams and see their predicted head-to-head win probability.

**Features:**
- Split-screen layout (Team 1 left, Team 2 right)
- Each side has a team dropdown
- When both teams are selected, a win-probability bar appears at the top:
  - Horizontal bar split proportionally by each team's win probability
  - Animated fill on load
  - Percentages shown inside the bar
- Full `TeamCard` displayed for each selected team
- Teams can be cleared and re-selected

**API calls:**
- `GET /api/teams` on mount (dropdowns)
- `GET /api/analyze/{team}` for each selected team (TeamCard data)
- `GET /api/head-to-head?team1=...&team2=...` when both teams are selected

### Bracket (`/bracket`)

Full interactive 2026 NCAA tournament bracket.

- 4 regions: East, West, Midwest, South (each rendered by `BracketRegion`)
- Each seed slot is a `BracketSlot` showing seed number, team name, and logo
- Clicking any team opens a `TeamPopup` modal with the full `TeamCard` analysis
- Bracket structure is hard-coded in `src/data/bracketData.js`

**API calls:**
- `GET /api/analyze/{team}` when a team slot is clicked (fetches data for the popup)

### Results (`/results`)

Model results broken down by tournament year. Each year is a collapsible section
containing two model sub-sections.

**Head to Head Model** — one collapsible round per tournament round (First Four through
National Championship). Each game row shows seed, logo, team name, and score; the winning
team is highlighted green (correct prediction) or red (incorrect). Round and overall
accuracy are shown with `probColor` thresholds.

**Wins Model** — per-team expected wins vs. actual wins grouped by bracket region.
Expected wins is the probability-weighted average of each team's win distribution.
Actual wins are counted from `results.json`; First Four wins are excluded since they
are not part of the 0–6 win distribution. A summary bar shows MAE, bias, and within-one
percentage with color-coded thresholds (diff/MAE: <0.75 green · 0.75–1.5 yellow · 1.5+
red; within-one %: ≥70% green · 50–70% yellow · <50% red). Active (non-eliminated) teams
are shown at reduced opacity with a green dot indicator.

**API calls:**
- `GET /api/results` on mount
- `GET /api/wins-evaluation` on mount (fetched in parallel with results)

### Info (`/info`)

Static content page with five sections:

1. **Background / How to Play** — pool format explanation
2. **Data** — data sources (CBBD, ESPN, SportsLogos.Net)
3. **Head to Head Model** — model type, accuracy, F1, precision, recall, ROC AUC
4. **Wins Model** — Monte Carlo simulation methodology (1.6M runs)
5. **More Info** — author contact (email, LinkedIn, GitHub)

Model metrics are loaded dynamically from the API.

**API calls:**
- `GET /api/info` on mount

---

## Components

### `NavBar`

Top navigation bar present on all pages. Contains the "The Pool" brand link (routes to
`/`) and navigation links to all seven pages.

### `TeamCard`

Full-featured team analysis card. Used on the Analyze, Head to Head, and Bracket pages.

**Displays:**
- Header: seed number, team name, conference, record, logo, optional ✕ remove button
- Win probability bars for 0–6 wins (color-coded via `probColor()`)
- Championship and Final Four probabilities (derived from win distribution)
- Team stats table: FG%, 3P%, FT%, blocks, rebounds, turnovers, steals, fouls
- Top 5 players: position, height, minutes/game, points/game, FT%
- Profile summary paragraph (AI-generated text)
- Similar historical teams: 3 matches with name, year, seed, wins, and similarity score

**Props:**
- `team` — `TeamAnalysis` object from the API
- `onRemove` — optional callback for the ✕ button

### `TeamPopup`

Modal overlay that wraps `TeamCard`. Used in the bracket to show full team analysis when
a slot is clicked. Renders a semi-transparent backdrop with the card centered on top.

**Props:**
- `teamName` — team name string (used to fetch data)
- `onClose` — callback to dismiss the modal

### `Bracket`

Container for the full 4-region tournament bracket. Renders four `BracketRegion`
components and manages the selected team state for the popup.

### `BracketRegion`

Renders one region (e.g., "East") as a vertical list of `BracketSlot` matchups.

### `BracketSlot`

Individual bracket slot showing one team (seed + name + logo). Clicking triggers the
`onTeamClick` callback to open the `TeamPopup`.

---

## API Layer (`src/api/teamApi.js`)

All backend communication is centralized here. Every function is `async` and returns
parsed JSON, or `null` on error.

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `fetchTeams()` | GET | `/api/teams` | All tournament teams (for dropdowns) |
| `fetchTeamData(teamName)` | GET | `/api/analyze/{team}` | Full `TeamAnalysis` for one team |
| `fetchH2H(team1, team2)` | GET | `/api/head-to-head?team1=&team2=` | Head-to-head win probabilities |
| `fetchPoolTeams(teamNames)` | POST | `/api/create-a-team` | Pool summaries for a list of teams |
| `fetchPowerRankings()` | GET | `/api/power-rankings` | Teams grouped by win bucket |
| `fetchResults()` | GET | `/api/results` | Game-by-game tournament results by year |
| `fetchWinsEvaluation()` | GET | `/api/wins-evaluation` | Expected vs actual wins evaluation |
| `fetchInfo()` | GET | `/api/info` | Project metadata and model metrics |

Team names are encoded with `encodeURIComponent()` before being interpolated into URLs.

---

## Utilities

### `src/utils/colors.js` — `probColor(probability)`

Maps a probability (0–100) to a hex color:

| Range | Color | Meaning |
|---|---|---|
| 0–20% | Red tones | Low probability |
| 20–50% | Yellow/orange tones | Mid-range |
| 50–70% | Light green | Above average |
| 70–100% | Green | High probability |

Used to color-code probability bars in `TeamCard` and win distribution charts.

### `src/data/bracketData.js`

Hard-coded 2026 NCAA tournament bracket structure. Contains the 64 teams organized by
region and seed, used by `BracketPage` and `BracketRegion` to render the bracket grid.

---

## Styling

All styles are written in plain CSS with one stylesheet per component or page.

- **`index.css`** — global reset, base styles, and the `Anton` font (Google Fonts)
- Component stylesheets are co-located with their component files
- Color scheme: white backgrounds, dark and light blue highlights, silver accents
- Responsive layout using CSS flexbox and grid

---

## npm Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `vite` | Start Vite dev server (port 5173, HMR enabled) |
| `npm run build` | `vite build` | Compile for production → `dist/` |
| `npm run preview` | `vite preview` | Serve the production build locally |

---

## Vite Configuration (`vite.config.js`)

The dev server proxies `/api/*` requests to the backend:

```js
proxy: {
  '/api': process.env.BACKEND_URL ?? 'http://localhost:8000'
}
```

This allows the frontend dev server (port 5173) to call the backend (port 8000) without
CORS issues. In Docker Compose, `BACKEND_URL=http://backend:8000` is injected via the
environment.

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.0.0 | UI framework |
| `react-dom` | ^19.0.0 | React DOM renderer |
| `react-router-dom` | ^7.0.0 | Client-side routing |

### Dev

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^6.0.0 | Build tool & dev server |
| `@vitejs/plugin-react` | ^4.3.0 | Vite React plugin (Babel transforms) |
| `@types/react` | ^19.0.0 | TypeScript types for React |
| `@types/react-dom` | ^19.0.0 | TypeScript types for React DOM |
