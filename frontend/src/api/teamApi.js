// API module — functions for communicating with the FastAPI backend.
// The Vite dev proxy forwards /analyze, /teams, and /info to http://localhost:8000.

// Base path for team-specific data endpoints.
const ANALYZE_BASE = '/analyze';

// Fetches all pre-calculated data for a given team from the backend.
// Returns a TeamAnalysis object containing record, players, win distribution, and similar teams.
// Throws an error if the request fails (e.g. team not found or server down).
export async function fetchTeamData(teamName) {
  const res = await fetch(`${ANALYZE_BASE}/${encodeURIComponent(teamName)}`);
  if (!res.ok) throw new Error(`Failed to fetch data for ${teamName}: ${res.status}`);
  return res.json();
}

// Fetches the full tournament team list, sorted by seed then alphabetically.
// Returns an array of { name, seed } objects used to populate the Analyze dropdown.
// Throws an error if the request fails.
export async function fetchTeams() {
  const res = await fetch('/teams');
  if (!res.ok) throw new Error(`Failed to fetch team list: ${res.status}`);
  return res.json();
}
