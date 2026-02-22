# Analytics for March Madness Pools

## Overview
The most common objective in March Madness is to predict a perfect bracket. Every year, millions of brackets of are filled out,
with the chances of one being perfect being approximately 1 in 9.2 quintillion. While one wrong pick ruins an entire bracket, 
and often a lot fun for many fans, there is another way to play the game.

The March Madness pool is a pool of players, each of whom put together a collection of 8 teams in the NCAA tournament field.
Teams are auctioned off to each player, with the end goal of having the collection of teams with the most wins in the tournament.


The goal of this project is to predict how a team will perform in the tournament. A probability distribution will be 
calculated to determine the likelihood of any team in the field winning 0 games, 1 game, or 2+ games. In addition, the 
3 most similar teams (since 2009-10) will also be calculated.

For more information on the data collection and model training methodologies, contact Josh Mayanja (joshmayanja30@gmail.com).

## About this Repository

This repository holds all code to setup the pool analytics website. It is built on FastAPI and React. Feel free to
explore!

## File Structure

```
march-madness-pool-analytics/
├── .github/
│   └── workflows/
│       └── ci.yml                    # Unit test, secret detection, and linting pipeline
├── app/                              # FastAPI backend
│   ├── CLAUDE.md
│   ├── main.py                       # FastAPI app entry point
│   ├── models/                       # Pydantic data models
│   │   ├── team.py                   # Team and EmbeddedTeam objects
│   │   └── player.py                 # Player data model
│   ├── routers/                      # API route handlers
│   │   ├── analyze.py                # /analyze and /analyze/{team} endpoints
│   │   └── info.py                   # /info endpoint
│   ├── services/                     # Business logic
│   │   ├── team_service.py           # Load and parse team JSON predictions
│   │   └── vector_db.py              # ChromaDB similarity queries
│   └── tests/                        # pytest unit tests
│       ├── test_team_service.py
│       └── test_vector_db.py
├── data/
│   ├── predictions/                  # Precalculated team JSON files ({team}.json)
│   └── vector_db/                    # ChromaDB persistent storage
├── frontend/                         # React frontend
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── components/               # Reusable UI components
│       │   ├── Bracket.jsx           # Interactive tournament bracket
│       │   ├── TeamCard.jsx          # Team profile display
│       │   ├── TeamPopup.jsx         # Bracket click popup
│       │   └── NavBar.jsx
│       ├── pages/                    # Page-level components
│       │   ├── Home.jsx              # Interactive bracket page
│       │   ├── Analyze.jsx           # Team comparison page
│       │   └── Info.jsx              # Project info page
│       ├── api/
│       │   └── teamApi.js            # API call functions
│       ├── App.jsx
│       └── index.jsx
├── scripts/                          # Data pipeline scripts
│   ├── build_embeddings.py           # Build EmbeddedTeam vectors, PCA, load into ChromaDB
│   └── generate_predictions.py       # Precalculate win distributions, write team JSONs
├── .gitignore
├── CLAUDE.md
├── README.md
├── pyproject.toml                    # uv Python project configuration
└── uv.lock
```