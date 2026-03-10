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
be printed as a subtitle in navy (the font should be the same as The Pool in the header). Below that will be three buttons,
One to each of the three pages (Bracket, Analyze, Info). These buttons should link to each of the pages.


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

The expected team wins can be calculated as the sum of the expected wins for each team. For teams that have 2+ wins, 
use 2 in the calculations. Then present the final expected wins as X+ wins. The probability for expected wins should
be calculated based off of the maximum win probabilities for each individual team selected.


## Power Rankings Page

The Power Rankings page will have 3 sections, stacked on top of each other from top to bottom. The top section will be
"2 wins", the middle "1 win" and the bottom "0 wins". Each section will consist of the same slots as the create a team
section, however these slots will already be filled with the same lightweight team cards as the create a team section.
The slots will be numbered from 1 - n for each section, with n being the number of teams predicted to have that many
wins. The teams should be ordered by percentage that they will win that many games, with slot 1 having the team with
the highest percentage. Any tiebreakers in percentage should be sorted alphabetically.


## Head to Head Page

This Head to Head page will help users determine who would win in a game between 2 games in the field. This page will
have 2 sections, split vertically down the middle. Each section will have a dropdown, with all the teams in the tournament
field. This dropdown will be searchable or selectable, the same as the analytics page. The left section will be titled
Team 1, and the right section Team 2. A team will be selected on either side. When this happens their team card will
fill that section of the page. On top of these selections, a meter will appear, showing the percentages of who will
win the game. These percentages will be fetched from h2h-predictions.json, where the value with team1=team 1 and team2 = team 2
is used. The percentage will fill the meter, with each team's win probability taking up that side of the meter. Each team's section in 
the meter will be their primary color (based on their logo). When the percentages are fetched, the meter/numbers should fill
with an active animation.


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


### Data/Models

The main goal of this platform is to help players analyze team performance when creating their 8 team collection for the
pool. All data was collected from the following sources:

- **Player and Team Statistics**: [CBBD](https://collegebasketballdata.com/)
- **Game Summaries**: [ESPN](https://www.espn.com/)
- **Team Logos**: [SportsLogos.Net](https://www.sportslogos.net/)


#### Wins Model

One feature of the team analytics is their predicted wins in the tournament. For this, an ordinal regression model
was used to evaluate probability that a team would win 0, 1, or 2+ games in the tournament. For this year (2026), the
model is performing with the following metrics:

- **Accuracy**: 75.26%
- **F1 Score**: 76.33%
- **Precision**: 79.05%
- **Quadratic Weighted Kappa**: 0.763
- **Ranked Probability Score**: 0.097

Accuracy measures how often the model correctly places a team in the right win bucket — at 75.26%, that's roughly
3 in 4 teams correctly called. F1 (76.33%) and Precision (79.05%) both approach 80%, with 100% being perfect,
reflecting consistent performance across all three outcomes. The Quadratic Weighted Kappa of 0.763 — where 1.0 is
perfect — shows that when the model misses, it tends to miss by one bucket, not two. A Ranked Probability Score of
0.097 (lower is better, with 0 being ideal) means the confidence behind each prediction is well-calibrated. Curious
about the methodology or want to dig deeper? Reach out below.

#### Head to Head Model

### More Info

For more information on the model development or data collection process, reach out to Josh Mayanja:

**Email**: joshmayanja30@gmail.com
**LinkedIn**: https://www.linkedin.com/in/josh-mayanja-a3001b200/
**GitHub**: https://github.com/jmayanja33