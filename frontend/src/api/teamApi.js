// API module — functions for communicating with the FastAPI backend.
// The Vite dev proxy forwards /analyze, /teams, and /info to http://localhost:8000.

// Base path for team-specific data endpoints.
const ANALYZE_BASE = '/analyze';

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
  const res = await fetch('/teams');
  if (!res.ok) {
    console.error(`[API] fetchTeams failed: HTTP ${res.status}`);
    throw new Error(`Failed to fetch team list: ${res.status}`);
  }
  return res.json();
}

// Fetches lightweight pool summaries for a list of team names from the backend.
// Accepts an array of team display names (up to 8) and returns the resolved
// PoolTeamSummary objects.  Teams not found in the predictions data are
// omitted from the response rather than causing an error.
// Throws if the network request itself fails.
export async function fetchPoolTeams(teamNames) {
  const res = await fetch('/create-a-team', {
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
