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

## Frontend

The front-end of this website will be built using React. The title of the page will be 'The Pool' with the subtitle 
'Analyzing Team Performance Through March Madness'.

The colors of this website will be a white background with dark blue, light blue, silver, and black highlights and
designs. The frontend will be simple but modern and clear, and will include dynamic loading and animations while 
users interact with the site.

**IMPORTANT**: All frontend code should be implemented thoroughly and efficiently but as simple and straightforward as possible. Overly
complex code HARMS this project as it makes maintainability much harder.

### Home Page

The home page will have a large bracket of the 20226 NCAA men's basketball tournament. The bracket will be interactive, with each team placed
in the correct region/seed. When the team is clicked on, a small window will pop up. This will call the analyze/${team} endpoint,
and the appropriate data will be populated in that window. If too much data is provided, the window can be scrollable.

If a template of a bracket is provided, then teams can be manually filled in as the tournament goes on.

### Analyze Page

The analyze page is where all analytics will be done. It will have a dropdown menu, with a list of teams for the current NCAA tournament.
When one team is selected, the /analyze/${team} endpoint will be called. With the data returned from this api call,
a profile of the team can be created, and will fill the screen. This profile will also include the team's name and logo.

When this happens, an add team button will appear on the top edge of the page. This allows another team to be added to the
window, so that comparisons can be made. When the next team is added, the page will be split in half and show both teams.
If a third team is added, the page will be split into thirds. If a fourth team is added, then the page will be split into
quarters. The maximum is four teams.

### Info Page

The info page will have a description about the project. It will include minor details about the model used, where
data was collected from, and accuracy metrics on the model.

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

## Data

All predictions for this data will be precalculated. Predictions will be stored in JSON files containing Team objects.
These team objects contain all data relating to a certain team, including a summary, player data, wins/losses, and the 
predicted win distribution.

## Vector Database

A ChromaDB vector database will be used to find similar teams. Teams will be imported into the database based on a vector created
from the EmbeddedTeam object. Each attribute of the embedded team will be used as a component in the vector, and then
the vectors will be PCA reduced before being imported into the database.