// Analyze page — side-by-side team comparison (up to 4 teams).
//
// Flow:
//   1. Empty state: centered dropdown.  User picks a team → profile fills the page.
//   2. "Add Team" button appears in the top bar.  Clicking it opens a modal picker.
//   3. Additional teams split the page into equal-width columns (max 4).
//   4. Each column has a ✕ remove button to drop a team from the comparison.
import { useState, useEffect, useRef } from 'react';
import NavBar from '../components/NavBar';
import TeamCard from '../components/TeamCard';
import { fetchTeams, fetchTeamData } from '../api/teamApi';
import './Analyze.css';

export default function Analyze() {
  // Sorted list of { name, seed } for the team picker dropdown.
  const [teamList, setTeamList]           = useState([]);
  const [listLoading, setListLoading]     = useState(true);
  const [listError, setListError]         = useState(null);

  // Array of fully loaded TeamAnalysis objects, one per column (max 4).
  const [teams, setTeams]                 = useState([]);

  // Controls whether the "add team" picker modal is visible.
  const [pickerOpen, setPickerOpen]       = useState(false);

  // Per-fetch loading/error state used while a team card is being loaded.
  const [fetchLoading, setFetchLoading]   = useState(false);
  const [fetchError, setFetchError]       = useState(null);

  useEffect(() => { document.title = 'The Pool | Analyze'; }, []);

  // Load the team dropdown list once on mount.
  useEffect(() => {
    fetchTeams()
      .then(setTeamList)
      .catch(() => setListError('Could not load team list. Make sure the backend is running.'))
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
            Select up to 4 Teams
          </p>
          <TeamPicker
            teamList={teamList}
            loading={listLoading || fetchLoading}
            error={listError || fetchError}
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
// Searchable combobox used in both the empty state and the add-team modal.
// Typing in the text input filters the list in real time; clicking a row
// selects that team and immediately triggers onSelect.
// Teams already in the comparison are excluded from the list.

function TeamPicker({ teamList, loading, error, addedNames, onSelect }) {
  const [query, setQuery]       = useState('');
  const [isOpen, setIsOpen]     = useState(false);
  const [selected, setSelected] = useState(''); // display name of the chosen team
  const containerRef            = useRef(null);

  // Filter out already-added teams, then apply the search query.
  const available = teamList.filter(t => !addedNames.has(t.name));
  const filtered  = query.trim()
    ? available.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : available;

  // Close the dropdown when the user clicks outside the combobox.
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Choose a team from the dropdown list.
  function choose(team) {
    setSelected(team.name);
    setQuery(team.name);
    setIsOpen(false);
    // Immediately trigger the analyze action — no extra button press needed.
    onSelect(team.name);
  }

  // Reset the picker when the input is cleared.
  function handleInputChange(e) {
    setQuery(e.target.value);
    setSelected('');
    setIsOpen(true);
  }

  return (
    <div className="team-picker">
      {/* Combobox: text input + chevron toggle */}
      <div className="picker-combobox" ref={containerRef}>
        <input
          type="text"
          className="picker-input"
          placeholder={loading ? 'Loading teams…' : 'Select or search a team…'}
          value={query}
          disabled={loading}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
        />
        {/* Chevron button toggles the full list open/closed */}
        <button
          type="button"
          className={`picker-chevron ${isOpen ? 'open' : ''}`}
          onMouseDown={e => {
            e.preventDefault();             // prevent input blur
            setIsOpen(prev => !prev);
          }}
          tabIndex={-1}
          aria-label="Toggle team list"
          disabled={loading}
        >
          ▾
        </button>

        {/* Filtered dropdown list */}
        {isOpen && !loading && filtered.length > 0 && (
          <ul className="picker-dropdown">
            {filtered.map(t => (
              <li
                key={t.name}
                className="picker-option"
                onMouseDown={() => choose(t)}   // mousedown fires before blur
              >
                <span className="picker-seed">#{t.seed}</span>
                {t.name}
              </li>
            ))}
          </ul>
        )}

        {/* No-results message */}
        {isOpen && !loading && query.trim() && filtered.length === 0 && (
          <div className="picker-no-results">No teams match "{query}"</div>
        )}
      </div>

      {error && <p className="picker-error">{error}</p>}
    </div>
  );
}
