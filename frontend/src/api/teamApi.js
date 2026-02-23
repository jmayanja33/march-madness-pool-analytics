const API_BASE = '/analyze';

export async function fetchTeamData(teamName) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(teamName)}`);
  if (!res.ok) throw new Error(`Failed to fetch data for ${teamName}`);
  return res.json();
}
