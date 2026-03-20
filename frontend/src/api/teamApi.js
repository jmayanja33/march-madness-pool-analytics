// API module — functions for communicating with the FastAPI backend.
// The Vite dev proxy forwards all /api/* requests to http://localhost:8000.

// Base path for all backend API endpoints. The /api prefix ensures Vite's dev
// proxy (and nginx in production) routes these to FastAPI rather than React Router.
const API_BASE = '/api';
const ANALYZE_BASE = `${API_BASE}/analyze`;

// Fetches all pre-calculated data for a given team from the backend.
// Returns a TeamAnalysis object containing record, players, win distribution, and similar teams.
// Throws an error if the request fails (e.g. team not found or server down).
export async function fetchTeamData(teamName) {
  const res = await fetch(`${ANALYZE_BASE}/${encodeURIComponent(teamName)}`);
  if (!res.ok) {
    console.error(`[API] fetchTeamData failed — ${teamName}: HTTP ${res.status}`);
    throw new Error(`Failed to fetch data for ${teamName}: ${res.status}`);
  }
  const data = await res.json();
  console.log(`[API] fetchTeamData — ${teamName}: ${data.similar_teams?.length ?? 0} similar team(s)`);
  return data;
}

// Fetches the full tournament team list, sorted by seed then alphabetically.
// Returns an array of { name, seed } objects used to populate the Analyze dropdown.
// Throws an error if the request fails.
export async function fetchTeams() {
  const res = await fetch(`${API_BASE}/teams`);
  if (!res.ok) {
    console.error(`[API] fetchTeams failed: HTTP ${res.status}`);
    throw new Error(`Failed to fetch team list: ${res.status}`);
  }
  return res.json();
}

// Fetches static project info, model metrics, and data sources from the backend.
// Returns an InfoResponse object used to populate the Info page.
// Throws an error if the request fails.
export async function fetchInfo() {
  const res = await fetch(`${API_BASE}/info`);
  if (!res.ok) {
    console.error(`[API] fetchInfo failed: HTTP ${res.status}`);
    throw new Error(`Failed to fetch project info: ${res.status}`);
  }
  return res.json();
}

// Fetches power rankings for all tournament teams from the backend.
// Returns a PowerRankingsResponse with three ranked lists: two_wins, one_win,
// and zero_wins, each containing PoolTeamSummary objects sorted by win-bucket
// probability descending.
// Throws an error if the request fails.
export async function fetchPowerRankings() {
  const res = await fetch(`${API_BASE}/power-rankings`);
  if (!res.ok) {
    console.error(`[API] fetchPowerRankings failed: HTTP ${res.status}`);
    throw new Error(`Failed to fetch power rankings: ${res.status}`);
  }
  const data = await res.json();
  console.log(
    `[API] fetchPowerRankings — ${data.six_wins.length} six-win, ` +
    `${data.five_wins.length} five-win, ${data.four_wins.length} four-win, ` +
    `${data.three_wins.length} three-win, ${data.two_wins.length} two-win, ` +
    `${data.one_win.length} one-win, ${data.zero_wins.length} zero-win teams`
  );
  return data;
}

// Fetches the head-to-head win probability prediction for two tournament teams.
// Accepts the display names of both teams and returns an H2HResponse with
// win_probability values for team1 and team2.
// Throws if the network request fails or the pair is not found (404).
export async function fetchH2H(team1Name, team2Name) {
  const params = new URLSearchParams({ team1: team1Name, team2: team2Name });
  const res = await fetch(`${API_BASE}/head-to-head?${params.toString()}`);
  if (!res.ok) {
    console.error(`[API] fetchH2H failed — ${team1Name} vs ${team2Name}: HTTP ${res.status}`);
    throw new Error(`Failed to fetch H2H data: ${res.status}`);
  }
  const data = await res.json();
  console.log(
    `[API] fetchH2H — ${team1Name} (${data.team1.win_probability}) ` +
    `vs ${team2Name} (${data.team2.win_probability})`
  );
  return data;
}

// Fetches tournament model results grouped by year and round from the backend.
// Returns a ResultsResponse containing all tracked tournament years, each with
// a list of rounds and the game results (teams, scores, winner, correct flag).
// Throws an error if the request fails or the data file is unavailable (503).
export async function fetchResults() {
  const res = await fetch(`${API_BASE}/results`);
  if (!res.ok) {
    console.error(`[API] fetchResults failed: HTTP ${res.status}`);
    throw new Error(`Failed to fetch results: ${res.status}`);
  }
  const data = await res.json();
  console.log(`[API] fetchResults — ${data.tournaments.length} tournament year(s)`);
  return data;
}

// Fetches lightweight pool summaries for a list of team names from the backend.
// Accepts an array of team display names (up to 8) and returns the resolved
// PoolTeamSummary objects.  Teams not found in the predictions data are
// omitted from the response rather than causing an error.
// Throws if the network request itself fails.
export async function fetchPoolTeams(teamNames) {
  const res = await fetch(`${API_BASE}/create-a-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teams: teamNames }),
  });
  if (!res.ok) {
    console.error(`[API] fetchPoolTeams failed: HTTP ${res.status}`);
    throw new Error(`Failed to fetch pool data: ${res.status}`);
  }
  const data = await res.json();
  console.log(`[API] fetchPoolTeams — resolved ${data.teams.length} / ${teamNames.length} teams`);
  return data.teams;
}
