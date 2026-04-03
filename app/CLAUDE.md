# API Setup

The backend of this platform will be based on FastAPI. It will have the endpoints listed below.

## Endpoints

The following endpoints will be open to be called.

### /
This is the main endpoint. This endpoint brings the user to the home page of the website


### /analyze
This endpoint routes a user to the Analyze page.


### /analyze/${team}
This endpoint fetches all data collected for a specified team in march madness. When it is called, it searches 
`/data/predictions` and pulls the following data from the correct team json:
- The team's win/loss record
- The team's top 5 players (by minutes), with position, height (in feet/inches), minutes, points, and free throw percentage
- The team's profile summary
- The predicted win probability distribution
- 3 most similar teams, the similarity percentage, and the number of tournament games they won (form the /most-similar endpoint)


### /analyze/most-similar/${team}
This endpoint runs a query on the vector database. Using cosine similarity, it finds the three most similar teams to 
the provided team, in the database. It returns the list of team objects, as well as the corresponding cosine similarity.

### /create-a-team
This endpoint routes a user to the create a team page.

### /info
This endpoint routes a user to the info page.

### /power-rankings
This endpoint routes a user to the power rankings page.

### /head-to-head
This endpoint routes users to the head to head matchup page.

### /results
This endpoint routes users to the results page.

### /api/wins-evaluation
This endpoint returns the wins model evaluation. For each tournament team it computes
the expected wins (probability-weighted average of the win probability distribution) and
the actual wins derived from results.json, then computes the signed difference
(expected − actual). Teams are grouped by bracket region (East, West, South, Midwest)
and sorted by seed. Summary metrics — MAE, bias, and within-one-win percentage — are
computed only over fully eliminated teams. First Four wins are excluded from actual win
counts since the distribution covers Round of 64 through National Championship only.
Results are read fresh on every request so the evaluation updates automatically as
game results are added to results.json.

