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
be calculated based off of the maximimum win probabilities for each individual team selected.


## Info Page

The info page will have a description about the project. It will include minor details about the model used, where
data was collected from, and accuracy metrics on the model.