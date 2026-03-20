# Frontend

The front-end of this website will be built using React. The title of the page will be 'The Pool' with the subtitle 
'Analyzing Team Performance Through March Madness'.

The colors of this website will be a white background with dark blue, light blue, silver, and black highlights and
designs. The frontend will be simple but modern and clear, and will include dynamic loading and animations while 
users interact with the site.

**IMPORTANT**: All frontend code should be implemented thoroughly and efficiently but as simple and straightforward as possible. Overly
complex code HARMS this project as it makes maintainability much harder.

## Home Page
The home page will feature a large march madness logo in the middle of the page. Below that, The Pool - Analytics will
be printed as a subtitle in navy (the font should be the same as The Pool in the header). Below that will be six buttons
arranged in a 3-column, 2-row grid: Bracket, Analyze, Create Team, Power Rankings, Head to Head, and Info.
These buttons should link to each of their respective pages.


## Bracket Page
The bracket page will have a large bracket of the 20226 NCAA men's basketball tournament. The bracket will be interactive, with each team placed
in the correct region/seed. When the team is clicked on, a small window will pop up. This will call the analyze/${team} endpoint,
and the appropriate data will be populated in that window. If too much data is provided, the window can be scrollable.

If a template of a bracket is provided, then teams can be manually filled in as the tournament goes on.

## Analyze Page

The analyze page is where all analytics will be done. It will have a dropdown menu, with a list of teams for the current NCAA tournament.
When one team is selected, the /analyze/${team} endpoint will be called. With the data returned from this api call,
a profile of the team can be created, and will fill the screen. This profile will also include the team's name and logo.

When this happens, an add team button will appear on the top edge of the page. This allows another team to be added to the
window, so that comparisons can be made. When the next team is added, the page will be split in half and show both teams.
If a third team is added, the page will be split into thirds. If a fourth team is added, then the page will be split into
quarters. The maximum is four teams.


## Create a Team Page

The create a team page is a page where a user can create a pool team and evaluate their potential performance. The page
will be setup into to 2 sides. The left side of the page will be titled 'Teams' and will have 8 slots (listed horizontally)
for teams. Initially, no teams have been added, so each team slot (1-8) will be populated by a blue button that says (Add team).

When the add team button is selected, the same searchable dropdown as the analyze page appears where a user can select a team to add.
Once the team is selected, the team slot is filled with a box for the team. This box has the team's seed, name, conference, and logo. 
The card will have the logo on the left side, followed by seed - team name - conference. Outside of this difference, all other formatting should
match the analyze page team card formatting.

At the bottom of the card will be the following stats:

- Region (Can be pulled from the bracket)
- Expected Wins 
  - This is the number of wins that is most likely in the team's distribution
  - This number will be followed with the distribution percentage (ex. Expected Wins: 2+ (53.72% likely))
  - The expected wins percentage will be red (>50%), yellow (50-70%), or green (70%+)

Opposite of the team creation, on the right side of the page, will be the Expected Performance section. This section will
list each team selected from most expected wins to least. Each team will have the expected wins listed with them (with the percentage and coloring as well).
Below all of the listed teams will be a black bar, which separates the teams from the expected wins calculation. Beneath
this bar will be Expected Team Wins: $Number of Wins$ $(Percentage with Coloring)$ in bold. 

The expected team wins can be calculated as the sum of the expected wins for each team. The probability for expected wins should
be calculated based off of the maximum win probabilities for each individual team selected.

On the right side of the page, below the Seed Breakdown and Region Breakdown, there shpuld be a wins projection tab.
The win projection section should have a histogram of the teams expected performance, based off of the win distribution of 
each team. The x-axis of the histogram will be number of wins, and the y-axis will represent the percentage chance. The bars themselves must follow a threshold coloring, different from 
the current threshold coloring. This coloring should have:
- the bottom/top 5% of the histogram red
- the 5%-15% and 75%-95% moving from red to yellow 
- the 25%-75% moving from yellow to green, with green at 50%

There should be 3 markings on the y-axis. One to the peak percentage (connected by a dashed line). One to the 25th and 
75th percentiles (also connected by a dashed line) and one to the 5th and 95th percentiles (also connected by a dashed line).


## Power Rankings Page

The Power Rankings page will have 8 sections, stacked on top of each other from top to bottom. The top section will be
"6 wins", "5 wins", "4 wins", "3 wins", "2 wins", "1 win" and the bottom "0 wins". Each section will consist of the same slots as the create a team
section, however these slots will already be filled with the same lightweight team cards as the create a team section.
The slots will be numbered from 1 - n for each section, with n being the number of teams predicted to have that many
wins. The teams should be ordered by percentage that they will win that many games, with slot 1 having the team with
the highest percentage. Any tiebreakers in percentage should be sorted alphabetically.

### Potential Upsets Section

At the bottom of the power rankings page, there will be a potential upsets section. This section will list teams in order
(in the same way as the other sections on this page), based on the probability that they will win as an underdog (using h2h-predictions.json). 
Teams should only be listed here if they are a lower number seed in their opening round game, and the probability that
they beat their round of 64 opponent is 40% or more. Teams will be ordered in descending order based on their win probability.
On the lightweight team card in this section, "Expected Wins" should be replaced with "First Round Win Probability", 
and that will list their percentage chance of winning their first round game. First round opponent data can be pulled
from the bracket on the bracket page. For teams in the first four, each one should be evaluated on the percentage that they beat
the team they would play in the round of 64 if they won their first four game and advanced.


## Head to Head Page

The Head to Head page helps users determine who would win in a matchup between any two teams in the tournament field.
The page is split vertically into two equal halves. The left half is titled "Team 1" and the right half "Team 2".
Each half has a searchable dropdown (same as the Analyze page) for selecting a team. Once selected, that team's full
TeamCard fills the half.

When both teams are selected, a win probability meter appears at the top of the page above the two team cards. The meter
is titled "Win Probability" and consists of a horizontal bar flanked by each team's logo at full size (matching the
TeamCard logo size). The bar is split into two colored fills — one per team — where each fill's width represents that
team's win probability. Each fill is colored using the team's primary color extracted from their logo. The percentage
label appears inside each fill near the center divider. When the probabilities load, the meter fills with an animated
transition. Probabilities are fetched via GET /head-to-head?team1=&team2=, which looks them up from
data/predictions/h2h-predictions.json.

Clicking the ✕ on a TeamCard resets that side back to the empty dropdown state.


## Info Page

The info page will have the following sections. Each section will have a large heading, and wil have a bottom border
separating it from the next section.


### Background/How to Play

The Background/How to Play Section will include the following description on how the pool is setup.

During March Madness, the Bracket Pool is the most common fan competition. Every year, millions of brackets of are filled out,
with the chances of one being perfect being approximately 1 in 9.2 quintillion. One wrong pick ruins the perfect bracket,
and a couple usually cost people an entire pool. However, there is another fun way to compete during march madness.

The Pool is a different approach on the traditional Bracket Pool. To play a pool of 8 players is needed, 
each of whom put together a collection of 8 teams in the NCAA tournament field. To put together their collection of teams,
there is an auction where teams are auctioned off. Each player gets 1000 bid points in the auction to spend on their teams. 

The goal of the pool is to pick 8 teams which will have the most wins (cumulative) out of everyone in the pool. First place
wins the pot, while second gets their money back. Additionally, there is a payout for the team who selects the NCAA
champion in the auction.


### Data

The main goal of this platform is to help players analyze team performance when creating their 8 team collection for the
pool. All data was collected from the following sources:

- **Player and Team Statistics**: [CBBD](https://collegebasketballdata.com/)
- **Game Summaries**: [ESPN](https://www.espn.com/)
- **Team Logos**: [SportsLogos.Net](https://www.sportslogos.net/)

### Head to Head Model

A secondary logistic regression model was trained on PCA-reduced team embeddings combined with team statistics to
predict the winner of any individual matchup between two teams in the tournament field. For this year (2026), the
model is performing with the following metrics:

- **Accuracy**: 83.15%
- **F1 Score**: 83.01%
- **Precision**: 83.71%
- **Recall**: 82.32%
- **ROC AUC**: 0.917

An accuracy of 83.15% means the model picks the correct winner in more than 5 out of every 6 matchups. Precision
(83.71%) and Recall (82.32%) are well balanced — the model is nearly as good at avoiding false calls as it is at
finding real winners. The F1 Score (83.01%) confirms this balance. Most notably, the ROC AUC of 0.917 — where
1.0 is ideal — shows the model can reliably separate winners from losers across every possible decision threshold,
not just the default 50/50 split. The model correctly identifies non-upsets 90.65% of the time, and still captures
upsets at a 67.24% rate.

Each metric card shows a tooltip on hover explaining what the metric measures and its ideal value.

### Wins Model

One feature of the team analytics is their predicted wins in the tournament. For this, a monte carlo simulation of the entire tournament 
was performed using predictions from the head to head model for each game. 1.6 million simulations were run, and these
results were used to evaluate the probability that a team would win 0, 1, 2, 3, 4, 5, or 6 games in the tournament. 

### More Info

For more information on the model development or data collection process, reach out to Josh Mayanja:

**Email**: joshmayanja30@gmail.com
**LinkedIn**: https://www.linkedin.com/in/josh-mayanja-a3001b200/
**GitHub**: https://github.com/jmayanja33


## Results Page

The results page should track model results. The subtitle of the page should be "MODEL RESULTS BY YEAR AND ROUND". 
The page for have a section for each year that is collapsable (similar to the Power Rankings page). The title of each section
should be the year and tournament (ex. "2026 Tournament"). As of right now, there will only be one section, for the 2026
tournament. Inside of each tournament, there will be 2 sections: Head to Head Model, and Wins Model. 
These sections should have a slightly darker box to differentiate them. The head to head section will have each round of the 
tournament as nested sections.

In parentheses next to each section title, the accuracy of the section should be listed. The accuracy
will follow the color threshold for probabilities. In each section, the number of games, correct predictions, and accuracy
will be listed. If no games have been played yet for a section display this, and do not include accuracy in the section
title. 

Below the accuracy reporting, each game will be listed with a score. The two teams will be listed with their logos.
The format should be seed 1 logo 1 team 1 score 1 vs. seed 2 logo 2 team 2 score 2. If the prediction was correct, the winning team name
should be in green. If it was incorrect, the winning team name should be in red. Find the content for each section below.

### 2026 Tournament

#### Head to Head Model
Number of Games: 20
Correct Predictions: 17
Accuracy: 85.00%

##### First Four
Number of Games: 4
Correct Predictions: 4
Accuracy: 100.00% 

- 16. UMBC: 83 vs. 16. Howard: 86 [CORRECT]
- 11. Texas: 68 vs. 11. NC State: 66 [CORRECT]
- 16. Prairie View A&M: 67 vs. 16. Lehigh: 55 [CORRECT]
- 11. Miami (OH): 89 vs. 11. SMU: 79 [CORRECT]

##### Round of 64
Number of Games: 16
Correct Predictions: 13
Accuracy: 81.25%

- 8. Ohio State: 64 vs. 9. TCU: 66 [CORRECT]
- 4. Nebraska: 76 vs. 13. Troy: 47 [CORRECT]
- 6. Louisville: 83 vs. 11. South Florida: 79 [CORRECT]
- 5. Wisconsin: 82 vs. 12. High Point: 83 [INCORRECT]
- 1. Duke: 71 vs 16. Siena: 65 [CORRECT]
- 5. Vanderbilt: 78 vs. 12. McNeese: 68 [CORRECT]
- 3. Michigan State: 92 vs. 14. North Dakota State: 67 [CORRECT]
- 4. Arkansas: 97 vs. 13. Hawai'i: 78 [CORRECT]
- 6. North Carolina: 78 vs. 11. VCU: 82 [CORRECT]
- 1. Michigan: 101 vs. 16. Howard: 80 [CORRECT]
- 7. Saint Mary's: 50 vs. 10. Texas A&M: 63 [INCORRECT]
- 6. BYU: 71 vs. 11. Texas: 79 [INCORRECT]
- 3. Illinois: 105 vs. 14. Penn: 70 [CORRECT]
- 2. Houston: 78 vs. 15. Idaho: 47 [CORRECT]
- 8. Georgia: 77 vs. 9. Saint Louis: 102 [CORRECT]
- 3. Gonzaga: 73 vs. 14. Kennesaw State: 64 [CORRECT]

##### Round of 32
No games yet

##### Sweet Sixteen
No games yet

##### Elite Eight
No games yet

##### Final Four
No games yet

##### National Championship
No games yet


#### Wins Model
No data yet