// API module — functions for communicating with the FastAPI backend.
// The Vite dev proxy forwards /analyze requests to http://localhost:8000.

const API_BASE = '/analyze';

// Fetches all pre-calculated data for a given team from the backend.
// Returns a Team object containing record, players, win distribution, and similar teams.
// Throws an error if the request fails (e.g. team not found or server down).
export async function fetchTeamData(teamName) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(teamName)}`);
  if (!res.ok) throw new Error(`Failed to fetch data for ${teamName}`);
  return res.json();
}
