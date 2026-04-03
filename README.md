# Analytics for March Madness Pools

## Overview
The most common objective in March Madness is to predict a perfect bracket. Every year, millions of brackets of are filled out,
with the chances of one being perfect being approximately 1 in 9.2 quintillion. While one wrong pick ruins an entire bracket, 
and often a lot fun for many fans, there is another way to play the game.

The March Madness pool is a pool of players, each of whom put together a collection of 8 teams in the NCAA tournament field.
Teams are auctioned off to each player, with the end goal of having the collection of teams with the most wins in the tournament.


The goal of this project is to predict how a team will perform in the tournament. A probability distribution is
calculated to determine the likelihood of any team in the field winning 0, 1, 2, 3, 4, 5, or 6 games. In addition,
the 3 most similar historical teams (since 2009–10) are identified via ChromaDB cosine similarity, and live wins
model evaluation tracks predicted vs. actual wins as the tournament progresses.

For more information on the data collection and model training methodologies, contact Josh Mayanja (joshmayanja30@gmail.com).

## About this Repository

This repository holds all code to setup the pool analytics website. It is built on FastAPI and React. Feel free to
explore!

## File Structure

```
march-madness-pool-analytics/
├── .github/
│   └── workflows/
│       └── ci.yml                      # Unit test, secret detection, and linting pipeline
├── app/                                # FastAPI backend
│   ├── CLAUDE.md                       # Backend AI instructions and endpoint reference
│   ├── README.md                       # Backend developer docs
│   ├── main.py                         # FastAPI app, CORS, /api/teams, /api/info, /api/wins-evaluation
│   ├── config.py                       # Environment variable settings
│   ├── models.py                       # 22 Pydantic request/response models
│   ├── services.py                     # Business logic: loading, formatting, ChromaDB, evaluation
│   ├── routers/
│   │   ├── analyze.py                  # GET /api/analyze/{team}, /api/analyze/most-similar/{team}
│   │   ├── pool.py                     # POST /api/create-a-team
│   │   ├── power_rankings.py           # GET /api/power-rankings
│   │   ├── head_to_head.py             # GET /api/head-to-head
│   │   └── results.py                  # GET /api/results
│   └── tests/
│       ├── test_main.py
│       ├── test_infrastructure.py
│       ├── test_analyze.py
│       ├── test_create_a_team.py
│       ├── test_head_to_head.py
│       ├── test_power_rankings.py
│       ├── test_results.py
│       └── test_wins_evaluation.py
├── data/
│   ├── predictions/
│   │   ├── predictions.json            # Pre-calculated team win distributions (2026 season)
│   │   ├── h2h-predictions.json        # Pre-calculated head-to-head win probabilities
│   │   ├── results.json                # Live tournament results (updated during tournament)
│   │   └── most-likely-bracket.json    # Pre-calculated optimal bracket predictions
│   └── vector_db/
│       └── chroma_vectors.json         # PCA-reduced team embeddings for ChromaDB import
├── frontend/                           # React + Vite SPA
│   ├── README.md                       # Frontend developer docs
│   ├── src/
│   │   ├── api/
│   │   │   └── teamApi.js              # All backend API call functions
│   │   ├── components/
│   │   │   ├── NavBar.jsx / .css
│   │   │   ├── TeamCard.jsx / .css
│   │   │   ├── TeamPopup.jsx / .css
│   │   │   ├── Bracket.jsx
│   │   │   ├── BracketRegion.jsx / .css
│   │   │   └── BracketSlot.jsx / .css
│   │   ├── pages/
│   │   │   ├── Home.jsx / .css
│   │   │   ├── Analyze.jsx / .css
│   │   │   ├── BracketPage.jsx / .css
│   │   │   ├── CreateTeam.jsx / .css
│   │   │   ├── PowerRankings.jsx / .css
│   │   │   ├── HeadToHead.jsx / .css
│   │   │   ├── Results.jsx / .css      # H2H accuracy + wins evaluation
│   │   │   └── Info.jsx / .css
│   │   ├── data/
│   │   │   └── bracketData.js          # 2026 tournament bracket structure
│   │   └── utils/
│   │       └── colors.js               # Probability → hex color mapping
│   └── public/
│       └── logos/                      # Team logo PNG files
├── scripts/
│   └── import_vectors.py               # Imports PCA-reduced embeddings into ChromaDB
├── .gitignore
├── CLAUDE.md                           # Root AI instructions for this project
├── README.md
├── pyproject.toml                      # uv Python project configuration
└── uv.lock
```

## Useful Commands

**Run the frontend dev server**
```bash
cd frontend && npm run dev
```

**Run the backend dev server**
```bash
uv run uvicorn app.main:app --reload
```

**Install Python dependencies**
```bash
uv sync --dev
```

**Run tests**
```bash
uv run pytest
```

**Run linter**
```bash
uv run ruff check .
```

**Fix linting errors automatically**
```bash
uv run ruff check . --fix
```