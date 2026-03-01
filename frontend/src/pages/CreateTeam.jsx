// CreateTeam — pool builder page where users assemble 8 tournament teams
// and evaluate their combined expected performance.
//
// Layout:
//   Left panel  — "Teams": 8 numbered slots (2-column grid).  Empty slots
//                 show an "Add Team" button; filled slots display a compact
//                 team card with seed, name, conference, region, and expected wins.
//   Right panel — "Expected Performance": teams ranked by expected wins,
//                 a black divider, then the combined expected-wins total.
import { useState, useEffect, useRef } from 'react';
import NavBar from '../components/NavBar';
import { fetchTeams, fetchPoolTeams } from '../api/teamApi';
import { BRACKET_2025 } from '../data/bracketData';
import './CreateTeam.css';

// ---------------------------------------------------------------------------
// Region lookup — build a map of teamName → region from the bracket data.
// ---------------------------------------------------------------------------

const TEAM_REGION_MAP = {};
for (const [region, teams] of Object.entries(BRACKET_2025)) {
  for (const team of teams) {
    TEAM_REGION_MAP[team.name] = region;
  }
}

function getTeamRegion(teamName) {
  return TEAM_REGION_MAP[teamName] ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// Expected-wins helpers
// ---------------------------------------------------------------------------

// Determine the most likely win outcome for a team's probability distribution.
// Returns the label, the integer value used in sums (2+ → 2), and the probability.
function getExpectedWins(dist) {
  const { zero_wins, one_win, two_plus_wins } = dist;
  const maxProb = Math.max(zero_wins, one_win, two_plus_wins);

  if (maxProb === two_plus_wins) return { label: '2+', numeric: 2, prob: two_plus_wins };
  if (maxProb === one_win)       return { label: '1',  numeric: 1, prob: one_win };
  return                                { label: '0',  numeric: 0, prob: zero_wins };
}

// Return the CSS color token for a probability value (0–1).
// Red < 50%, yellow 50–70%, green 70%+.
function probColor(prob) {
  const pct = prob * 100;
  if (pct >= 70) return 'var(--exp-green)';
  if (pct >= 50) return 'var(--exp-yellow)';
  return 'var(--exp-red)';
}

// Compute aggregate pool stats from the array of filled team data objects.
// Returns { totalWins, avgProb } or null when no teams are selected.
function computePoolStats(filledTeams) {
  if (filledTeams.length === 0) return null;

  let totalWins = 0;
  let totalProb = 0;

  for (const team of filledTeams) {
    const { numeric, prob } = getExpectedWins(team.win_probability_distribution);
    totalWins += numeric;
    totalProb += prob;
  }

  return { totalWins, avgProb: totalProb / filledTeams.length };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SLOT_COUNT = 8;

export default function CreateTeam() {
  useEffect(() => { document.title = 'The Pool | Create Team'; }, []);

  // Array of SLOT_COUNT entries — each slot is null (empty) or a PoolTeamSummary.
  const [slots, setSlots] = useState(Array(SLOT_COUNT).fill(null));

  // Index of the slot whose picker modal is currently open.
  const [activeSlot, setActiveSlot] = useState(null);

  // Full team list for the picker dropdown.
  const [teamList, setTeamList]       = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState(null);

  // Loading / error state while a team is being fetched.
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Load the dropdown list once on mount.
  useEffect(() => {
    fetchTeams()
      .then(setTeamList)
      .catch(() => setListError('Could not load team list. Make sure the backend is running.'))
      .finally(() => setListLoading(false));
  }, []);

  // Names already assigned to a slot — used to filter the picker.
  const assignedNames = new Set(slots.filter(Boolean).map(t => t.name));

  // Open the picker for a specific slot index.
  function openPicker(index) {
    setActiveSlot(index);
    setFetchError(null);
  }

  // Called when the user selects a team from the picker.
  async function handleSelectTeam(teamName) {
    setActiveSlot(null);   // close picker immediately
    setFetching(true);
    setFetchError(null);

    try {
      // Fetch the lightweight pool summary for the selected team.
      const [summary] = await fetchPoolTeams([teamName]);
      if (!summary) throw new Error('Team data not available.');

      setSlots(prev => {
        const next = [...prev];
        next[activeSlot] = summary;
        return next;
      });
    } catch {
      setFetchError('Could not load team data. Check that the backend is running.');
    } finally {
      setFetching(false);
    }
  }

  // Remove the team from a slot (reset it to null).
  function removeTeam(index) {
    setSlots(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  // All filled slots, sorted by expected wins descending (for the right panel).
  const filledSlots = slots.filter(Boolean);
  const sortedTeams = [...filledSlots].sort((a, b) => {
    const winsA = getExpectedWins(a.win_probability_distribution).numeric;
    const winsB = getExpectedWins(b.win_probability_distribution).numeric;
    return winsB - winsA;
  });

  const poolStats = computePoolStats(filledSlots);

  return (
    <div className="ct-page">
      <NavBar />

      <div className="ct-body">

        {/* ── Left panel: team slots ── */}
        <section className="ct-panel ct-left">
          <h2 className="ct-panel-title">Teams</h2>

          {/* Error banner shown when a team fetch fails */}
          {fetchError && <p className="ct-fetch-error">{fetchError}</p>}

          <div className="ct-slots-grid">
            {slots.map((team, i) => (
              team
                ? /* Filled slot — compact team card */
                  <TeamSlotCard
                    key={i}
                    team={team}
                    onRemove={() => removeTeam(i)}
                  />
                : /* Empty slot — add-team button */
                  <button
                    key={i}
                    className="ct-add-btn fade-in"
                    onClick={() => openPicker(i)}
                    disabled={fetching}
                  >
                    {fetching && activeSlot === i ? 'Loading…' : `${i + 1}. Add Team`}
                  </button>
            ))}
          </div>
        </section>

        {/* ── Right panel: expected performance ── */}
        <section className="ct-panel ct-right">
          <h2 className="ct-panel-title">Expected Performance</h2>

          {filledSlots.length === 0 ? (
            <p className="ct-perf-empty">Add teams on the left to see expected performance.</p>
          ) : (
            <>
              {/* Ranked list of teams by expected wins */}
              <ul className="ct-perf-list">
                {sortedTeams.map(team => {
                  const { label, prob } = getExpectedWins(team.win_probability_distribution);
                  const color = probColor(prob);
                  return (
                    <li key={team.name} className="ct-perf-row fade-in">
                      <div className="ct-perf-name">
                        <span className="ct-perf-seed">#{team.seed}</span>
                        {team.name}
                        <img
                          src={`/logos/${team.name}.png`}
                          alt={`${team.name} logo`}
                          className="ct-perf-logo"
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      <span className="ct-perf-wins" style={{ color }}>
                        {label} wins
                        <span className="ct-perf-pct"> ({(prob * 100).toFixed(1)}%)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Black divider */}
              <div className="ct-perf-divider" />

              {/* Total expected wins — aligned like a summation under the wins column */}
              {poolStats && (() => {
                const totalLabel = `${poolStats.totalWins}+`;
                const color = probColor(poolStats.avgProb);
                return (
                  <div className="ct-perf-total-row">
                    <span className="ct-perf-total-label">Expected Team Wins</span>
                    <span className="ct-perf-wins" style={{ color }}>
                      {totalLabel} wins
                      <span className="ct-perf-pct"> ({(poolStats.avgProb * 100).toFixed(1)}%)</span>
                    </span>
                  </div>
                );
              })()}
            </>
          )}
        </section>
      </div>

      {/* ── Team picker modal ── */}
      {activeSlot !== null && (
        <div className="ct-overlay" onClick={() => setActiveSlot(null)}>
          <div className="ct-modal pop-in" onClick={e => e.stopPropagation()}>
            <div className="ct-modal-header">
              <h3>Select a Team for Slot {activeSlot + 1}</h3>
              <button className="ct-modal-close" onClick={() => setActiveSlot(null)}>✕</button>
            </div>
            <TeamPicker
              teamList={teamList}
              loading={listLoading}
              error={listError}
              assignedNames={assignedNames}
              onSelect={handleSelectTeam}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamSlotCard — compact card for a filled slot
// ---------------------------------------------------------------------------
// Shows the logo (left), seed / name / conference, region, and expected wins.

function TeamSlotCard({ team, onRemove }) {
  const region = getTeamRegion(team.name);
  const { label, prob } = getExpectedWins(team.win_probability_distribution);
  const color = probColor(prob);

  return (
    <div className="ct-slot-card fade-in">
      {/* Logo */}
      <img
        src={`/logos/${team.name}.png`}
        alt={`${team.name} logo`}
        className="ct-slot-logo"
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />

      {/* Team identity */}
      <div className="ct-slot-info">
        <div className="ct-slot-name">
          <span className="ct-slot-seed">#{team.seed}</span>
          <span className="ct-slot-teamname">{team.name}</span>
          <span className="ct-slot-conf">{team.conference}</span>
        </div>

        {/* Region */}
        <div className="ct-slot-stat">
          <span className="ct-slot-stat-label">Region</span>
          <span className="ct-slot-stat-value">{region}</span>
        </div>

        {/* Expected wins */}
        <div className="ct-slot-stat">
          <span className="ct-slot-stat-label">Expected Wins</span>
          <span className="ct-slot-stat-value" style={{ color }}>
            {label}
            <span className="ct-slot-prob"> ({(prob * 100).toFixed(2)}% likely)</span>
          </span>
        </div>
      </div>

      {/* Remove button */}
      <button className="ct-slot-remove" onClick={onRemove} title="Remove team">✕</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamPicker — searchable combobox for selecting a team
// ---------------------------------------------------------------------------
// Reuses the same interaction pattern as the Analyze page picker.

function TeamPicker({ teamList, loading, error, assignedNames, onSelect }) {
  const [query, setQuery]   = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef        = useRef(null);

  // Filter out already-assigned teams, then apply the search query.
  const available = teamList.filter(t => !assignedNames.has(t.name));
  const filtered  = query.trim()
    ? available.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : available;

  // Close the dropdown when the user clicks outside the combobox.
  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function choose(team) {
    setQuery(team.name);
    setIsOpen(false);
    onSelect(team.name);
  }

  function handleInputChange(e) {
    setQuery(e.target.value);
    setIsOpen(true);
  }

  return (
    <div className="team-picker">
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
          autoFocus
        />
        <button
          type="button"
          className={`picker-chevron ${isOpen ? 'open' : ''}`}
          onMouseDown={e => { e.preventDefault(); setIsOpen(prev => !prev); }}
          tabIndex={-1}
          aria-label="Toggle team list"
          disabled={loading}
        >
          ▾
        </button>

        {isOpen && !loading && filtered.length > 0 && (
          <ul className="picker-dropdown">
            {filtered.map(t => (
              <li
                key={t.name}
                className="picker-option"
                onMouseDown={() => choose(t)}
              >
                <span className="picker-seed">#{t.seed}</span>
                {t.name}
              </li>
            ))}
          </ul>
        )}

        {isOpen && !loading && query.trim() && filtered.length === 0 && (
          <div className="picker-no-results">No teams match "{query}"</div>
        )}
      </div>

      {error && <p className="picker-error">{error}</p>}
    </div>
  );
}
