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

