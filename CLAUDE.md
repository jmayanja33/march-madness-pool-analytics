## Project Overview

The most common objective in March Madness is to predict a perfect bracket. Every year, millions of brackets of are filled out,
with the chances of one being perfect being approximately 1 in 9.2 quintillion. While one wrong pick ruins an entire bracket, 
and often a lot of fun for many fans, there is another way to play the game.

The March Madness pool is a pool of players, each of whom put together a collection of 8 teams in the NCAA tournament field.
Teams are auctioned off to each player, with the end goal of having the collection of teams with the most wins in the tournament.

The goal of this project is to predict how a team will perform in the tournament. A probability distribution will be 
calculated to determine the likelihood of any team in the field winning 0 games, 1 game, or 2+ games. In addition, the 
3 most similar teams (since 2009-10) will also be calculated.

This repository will hold all code for a website which utilizes AI/ML to analyze and predict NCAA tournament team
performance for the 2026 season. See each section below for details about the site's implementation.

**IMPORTANT**: A uv environment should be properly setup to run all python code.
**IMPORTANT**: All code IS REQUIRED to be fully commented. This includes full docstrings for functions (with type hints), and full comments at the top of each block of code.

## Frontend

See `frontend/CLAUDE.md` for details and instructions on the API setup.

## Backend

See the sections below for details on the backend code.

**IMPORTANT**: All backend code should be implemented thoroughly and efficiently but as simple and straightforward as possible. Overly
complex code HARMS this project as it makes maintainability much harder.

### API Setup

See `app/CLAUDE.md` for details and instructions on the API setup.

### Unit Tests

Comprehensive unit tests should be implemented for all functions created in this codebase. The unit tests should be
written using pytest.

**IMPORTANT**: All unit tests should be implemented thoroughly and efficiently but as simple and straightforward as possible. Overly
complex code HARMS this project as it makes maintainability much harder.

## CI/CD

Github actions will be used to deploy this site. In each commit pipeline, a unit test step, a secret detection step,
and a linting step all must pass.

All source code should be dockerized. The vector database should be dockerized as well. A docker compose file should 
include both, and should be executable for local development.

## Data

All predictions for this data will be precalculated. Predictions will be stored in JSON files containing Team objects.
These team objects contain all data relating to a certain team, including a summary, player data, wins/losses, and the 
predicted win distribution.

## Vector Database

A ChromaDB vector database will be used to find similar teams. Teams will be imported into the database based on a vector created
from the EmbeddedTeam object. Each attribute of the embedded team will be used as a component in the vector, and then
the vectors will be PCA reduced before being imported into the database.