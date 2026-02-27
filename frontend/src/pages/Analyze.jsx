// Analyze page — side-by-side team comparison (up to 4 teams).
//
// Flow:
//   1. Empty state: centered dropdown.  User picks a team → profile fills the page.
//   2. "Add Team" button appears in the top bar.  Clicking it opens a modal picker.
//   3. Additional teams split the page into equal-width columns (max 4).
//   4. Each column has a ✕ remove button to drop a team from the comparison.
import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import TeamCard from '../components/TeamCard';
import { fetchTeams, fetchTeamData } from '../api/teamApi';
import './Analyze.css';

export default function Analyze() {
  // Sorted list of { name, seed } for the team picker dropdown.
  const [teamList, setTeamList]           = useState([]);
  const [listLoading, setListLoading]     = useState(true);

  // Array of fully loaded TeamAnalysis objects, one per column (max 4).
  const [teams, setTeams]                 = useState([]);

  // Controls whether the "add team" picker modal is visible.
  const [pickerOpen, setPickerOpen]       = useState(false);

  // Per-fetch loading/error state used while a team card is being loaded.
  const [fetchLoading, setFetchLoading]   = useState(false);
  const [fetchError, setFetchError]       = useState(null);

  // Load the team dropdown list once on mount.
  useEffect(() => {
    fetchTeams()
      .then(setTeamList)
      .catch(() => setTeamList([]))
      .finally(() => setListLoading(false));
  }, []);

  // Add a team by name: fetch its full analysis and append it to the columns.
  async function addTeam(name) {
    if (!name || teams.length >= 4) return;
    setFetchLoading(true);
    setFetchError(null);
    try {
      const data = await fetchTeamData(name);
      setTeams(prev => [...prev, data]);
      setPickerOpen(false);
    } catch {
      setFetchError('Team data is not yet available. Try again once the backend is ready.');
    } finally {
      setFetchLoading(false);
    }
  }

  // Remove the team at the given index from the comparison.
  function removeTeam(index) {
    setTeams(prev => prev.filter((_, i) => i !== index));
  }

  // Names already in the comparison — used to filter the picker dropdown.
  const addedNames = new Set(teams.map(t => t.name));

  return (
    <div className="analyze-page">
      <NavBar />

      {/* ── Top bar: shown once at least one team has been added ── */}
      {teams.length > 0 && (
        <div className="analyze-topbar">
          <span className="analyze-topbar-label">
            {teams.length} / 4 teams
          </span>
          {teams.length < 4 && (
            <button
              className="btn-add-team"
              onClick={() => { setPickerOpen(true); setFetchError(null); }}
            >
              + Add Team
            </button>
          )}
        </div>
      )}

      {/* ── Empty state: centered picker ── */}
      {teams.length === 0 && (
        <div className="analyze-empty fade-in">
          <h2 className="analyze-empty-title">Compare Teams</h2>
          <p className="analyze-empty-sub">
            Select up to 4 NCAA Tournament teams to compare side by side.
          </p>
          <TeamPicker
            teamList={teamList}
            loading={listLoading || fetchLoading}
            error={fetchError}
            addedNames={addedNames}
            onSelect={addTeam}
          />
        </div>
      )}

      {/* ── Team columns ── */}
      {teams.length > 0 && (
        <div className="teams-container">
          {teams.map((team, i) => (
            <div key={team.name} className="team-column fade-in">
              <TeamCard team={team} onRemove={() => removeTeam(i)} />
            </div>
          ))}
        </div>
      )}

      {/* ── Add-team picker modal ── */}
      {pickerOpen && (
        <div className="picker-overlay" onClick={() => setPickerOpen(false)}>
          <div className="picker-modal pop-in" onClick={e => e.stopPropagation()}>
            <div className="picker-modal-header">
              <h3>Add a Team</h3>
              <button
                className="picker-close"
                onClick={() => setPickerOpen(false)}
              >
                ✕
              </button>
            </div>
            <TeamPicker
              teamList={teamList}
              loading={listLoading || fetchLoading}
              error={fetchError}
              addedNames={addedNames}
              onSelect={addTeam}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Internal team picker ──────────────────────────────────────────────────────
// A controlled select + submit button used in both the empty state and the
// add-team modal.  Teams already in the comparison are excluded from the list.

function TeamPicker({ teamList, loading, error, addedNames, onSelect }) {
  const [selected, setSelected] = useState('');

  // Filter out teams already added to the comparison.
  const available = teamList.filter(t => !addedNames.has(t.name));

  function handleSubmit(e) {
    e.preventDefault();
    if (selected) onSelect(selected);
  }

  return (
    <form className="team-picker" onSubmit={handleSubmit}>
      <select
        className="picker-select"
        value={selected}
        onChange={e => setSelected(e.target.value)}
        disabled={loading}
      >
        <option value="">Select a team…</option>
        {/* Options grouped by seed for easier browsing. */}
        {available.map(t => (
          <option key={t.name} value={t.name}>
            ({t.seed}) {t.name}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="btn-primary"
        disabled={!selected || loading}
      >
        {loading ? 'Loading…' : 'Analyze'}
      </button>

      {error && <p className="picker-error">{error}</p>}
    </form>
  );
}
