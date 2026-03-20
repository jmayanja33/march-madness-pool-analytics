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
import TeamPopup from '../components/TeamPopup';
import { fetchTeams, fetchPoolTeams } from '../api/teamApi';
import { BRACKET_2026 } from '../data/bracketData';
import { probColor } from '../utils/colors';
import './CreateTeam.css';

// ---------------------------------------------------------------------------
// Region lookup — build a map of teamName → region from the bracket data.
// ---------------------------------------------------------------------------

const TEAM_REGION_MAP = {};
for (const [region, teams] of Object.entries(BRACKET_2026)) {
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
// Checks all seven buckets (0–6) and returns the bucket with the highest probability,
// along with its numeric value (used in sums) and a display string.
function getExpectedWins(dist) {
  const entries = [
    { numeric: 6, prob: dist.six_wins,   winsText: '6 wins' },
    { numeric: 5, prob: dist.five_wins,  winsText: '5 wins' },
    { numeric: 4, prob: dist.four_wins,  winsText: '4 wins' },
    { numeric: 3, prob: dist.three_wins, winsText: '3 wins' },
    { numeric: 2, prob: dist.two_wins,   winsText: '2 wins' },
    { numeric: 1, prob: dist.one_win,    winsText: '1 win'  },
    { numeric: 0, prob: dist.zero_wins,  winsText: '0 wins' },
  ];
  return entries.reduce((best, cur) => cur.prob > best.prob ? cur : best);
}

// Format a summed wins total for group/pool totals.
// Uses correct singular for exactly 1 win; pluralizes all other values.
function formatTotalWins(n) {
  if (n === 1) return '1 win';
  return `${n} wins`;
}


// Compute aggregate pool stats from the convolved win distribution.
// The peak (mode) of the distribution is used so the "Expected Team Wins"
// box matches the tallest bar in the Win Projection histogram exactly.
// Returns { totalWins, avgProb } or null when no teams are selected.
function computePoolStats(filledTeams) {
  if (filledTeams.length === 0) return null;

  // Convolve all team distributions into one combined distribution.
  const raw = computeWinProjection(filledTeams);
  if (!raw) return null;

  // Normalize to correct any floating-point drift.
  const total = raw.reduce((sum, d) => sum + d.prob, 0);
  const normalized = total > 0 ? raw.map(d => ({ wins: d.wins, prob: d.prob / total })) : raw;

  // The mode: total-win count with the highest probability — this is the
  // same bar that appears tallest in the histogram.
  const peak = normalized.reduce((best, cur) => cur.prob > best.prob ? cur : best);

  return { totalWins: peak.wins, avgProb: peak.prob };
}

// Standard region display order for the Region Breakdown section.
const REGION_ORDER = ['East', 'West', 'South', 'Midwest'];

// Ordered list of win-distribution keys — index matches the win count (0–6).
const WIN_DIST_KEYS = [
  'zero_wins', 'one_win', 'two_wins', 'three_wins',
  'four_wins', 'five_wins', 'six_wins',
];

// Compute the probability distribution of the pool's *total* wins by convolving
// each selected team's individual win distribution together.  The result maps
// every achievable total-win count to its probability.
//
// Example: with 2 teams the total wins range is 0–12; with 8 teams it is 0–48.
// The convolution is computed iteratively: start with {0: 1.0} and for each
// team fold its distribution into the running combined distribution.
//
// Returns a sorted array of { wins, prob } entries, or null when no teams exist.
/**
 * @param {Array<Object>} filledTeams - Array of PoolTeamSummary objects.
 * @returns {Array<{wins: number, prob: number}>|null}
 */
function computeWinProjection(filledTeams) {
  if (filledTeams.length === 0) return null;

  // Running combined distribution: total wins → probability.
  let combined = new Map([[0, 1.0]]);

  for (const team of filledTeams) {
    const dist   = team.win_probability_distribution;
    // Extract this team's per-win probabilities in order (index = win count).
    const probs  = WIN_DIST_KEYS.map(key => dist[key] ?? 0);
    const next   = new Map();

    // For every existing (totalWins, probability) pair, add the contribution
    // of each of this team's possible win outcomes.
    for (const [totalWins, combinedProb] of combined) {
      for (let w = 0; w < probs.length; w++) {
        const newTotal = totalWins + w;
        next.set(newTotal, (next.get(newTotal) ?? 0) + combinedProb * probs[w]);
      }
    }
    combined = next;
  }

  // Return sorted array so the x-axis always runs low → high.
  return Array.from(combined.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([wins, prob]) => ({ wins, prob }));
}

// Seed tier groupings used by the Seed Breakdown section.
// Ranges are non-overlapping; label matches what the user sees.
const SEED_GROUPS = [
  { label: 'Top 5 Seeds',  test: seed => seed <= 5 },
  { label: 'Seeds 6-9',   test: seed => seed >= 6 && seed <= 9 },
  { label: 'Seeds 10-12', test: seed => seed >= 10 && seed <= 12 },
  { label: 'Seeds 13+',   test: seed => seed >= 13 },
];

// Compute total wins and average probability for a subset of teams.
// Returns { totalWins, avgProb } or null for an empty array.
function computeGroupStats(teams) {
  if (teams.length === 0) return null;
  let totalWins = 0;
  let totalProb = 0;
  for (const team of teams) {
    const { numeric, prob } = getExpectedWins(team.win_probability_distribution);
    totalWins += numeric;
    totalProb += prob;
  }
  return { totalWins, avgProb: totalProb / teams.length };
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

  // Name of the team whose full TeamCard popup is currently open, or null.
  const [popupTeam, setPopupTeam] = useState(null);

  // Collapsed state for the three breakdown sections (open by default).
  const [seedOpen, setSeedOpen]     = useState(true);
  const [regionOpen, setRegionOpen] = useState(true);
  const [projOpen, setProjOpen]     = useState(true);

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

      {/* ── Page-level subtitle ── */}
      <p className="ct-page-sub">CREATE A MOCK TEAM ENTRY FOR THE POOL</p>

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
                    onInfo={() => setPopupTeam(team.name)}
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
              {/* Total expected wins — standalone box */}
              {poolStats && (() => {
                const color = probColor(poolStats.avgProb);
                return (
                  <div className="ct-total-box">
                    <span className="ct-total-box-label">
                      Expected Team Wins
                      {/* Tooltip icon — explains the calculation in plain language */}
                      <span className="ct-total-tooltip-wrap">
                        <span className="ct-total-tooltip-icon">ⓘ</span>
                        <span className="ct-total-tooltip-body">
                          The single most likely total win count for your team, based on
                          combining each team&apos;s win odds together. This matches the
                          tallest bar in the Win Projection chart. It may not equal the
                          sum of each team&apos;s individual expected wins, because some
                          win totals become more or less likely when all teams are
                          considered together.
                        </span>
                      </span>
                    </span>
                    <span className="ct-perf-wins" style={{ color }}>
                      {formatTotalWins(poolStats.totalWins)}
                      <span className="ct-perf-pct"> ({(poolStats.avgProb * 100).toFixed(1)}%)</span>
                    </span>
                  </div>
                );
              })()}

              {/* ── Seed Breakdown by seed tier ── */}
              <div className="ct-breakdown">
                <button className="ct-breakdown-title" onClick={() => setSeedOpen(o => !o)}>
                  <span className={`ct-bd-chevron ${seedOpen ? 'open' : ''}`}>▶</span>
                  Seed Breakdown
                </button>
                {/* Animated slide wrapper — content stays in DOM for smooth transition */}
                <div className={`ct-bd-slide ${seedOpen ? 'open' : ''}`}>
                  <div className="ct-bd-slide-inner">
                    {SEED_GROUPS.map(group => {
                      // Only render groups that have at least one selected team.
                      const groupTeams = sortedTeams.filter(t => group.test(t.seed));
                      if (groupTeams.length === 0) return null;
                      const stats = computeGroupStats(groupTeams);
                      const groupColor = probColor(stats.avgProb);
                      return (
                        <div key={group.label} className="ct-bd-group">
                          {/* Group header: label on left, summed wins on right */}
                          <div className="ct-bd-header">
                            <span className="ct-bd-group-label">
                              {group.label}
                              <span className="ct-bd-group-count"> ({groupTeams.length} {groupTeams.length === 1 ? 'Team' : 'Teams'})</span>
                            </span>
                            <span className="ct-perf-wins" style={{ color: groupColor }}>
                              {formatTotalWins(stats.totalWins)}
                              <span className="ct-perf-pct"> ({(stats.avgProb * 100).toFixed(1)}%)</span>
                            </span>
                          </div>
                          {/* Individual teams within the group */}
                          <ul className="ct-bd-list">
                            {groupTeams.map(team => {
                              const { winsText, prob } = getExpectedWins(team.win_probability_distribution);
                              const color = probColor(prob);
                              return (
                                <li key={team.name} className="ct-bd-row">
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
                                    {winsText}
                                    <span className="ct-perf-pct"> ({(prob * 100).toFixed(1)}%)</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Region Breakdown ── */}
              <div className="ct-breakdown">
                <button className="ct-breakdown-title" onClick={() => setRegionOpen(o => !o)}>
                  <span className={`ct-bd-chevron ${regionOpen ? 'open' : ''}`}>▶</span>
                  Region Breakdown
                </button>
                {/* Animated slide wrapper — content stays in DOM for smooth transition */}
                <div className={`ct-bd-slide ${regionOpen ? 'open' : ''}`}>
                  <div className="ct-bd-slide-inner">
                    {REGION_ORDER.map(region => {
                      // Only render regions that have at least one selected team.
                      const regionTeams = sortedTeams.filter(t => getTeamRegion(t.name) === region);
                      if (regionTeams.length === 0) return null;
                      const stats = computeGroupStats(regionTeams);
                      const groupColor = probColor(stats.avgProb);
                      return (
                        <div key={region} className="ct-bd-group">
                          {/* Region header: name + team count on left, summed wins on right */}
                          <div className="ct-bd-header">
                            <span className="ct-bd-group-label">
                              {region}
                              <span className="ct-bd-group-count"> ({regionTeams.length} {regionTeams.length === 1 ? 'Team' : 'Teams'})</span>
                            </span>
                            <span className="ct-perf-wins" style={{ color: groupColor }}>
                              {formatTotalWins(stats.totalWins)}
                              <span className="ct-perf-pct"> ({(stats.avgProb * 100).toFixed(1)}%)</span>
                            </span>
                          </div>
                          {/* Individual teams within the region */}
                          <ul className="ct-bd-list">
                            {regionTeams.map(team => {
                              const { winsText, prob } = getExpectedWins(team.win_probability_distribution);
                              const color = probColor(prob);
                              return (
                                <li key={team.name} className="ct-bd-row">
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
                                    {winsText}
                                    <span className="ct-perf-pct"> ({(prob * 100).toFixed(1)}%)</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Win Projection histogram ── */}
              <div className="ct-breakdown">
                <button className="ct-breakdown-title" onClick={() => setProjOpen(o => !o)}>
                  <span className={`ct-bd-chevron ${projOpen ? 'open' : ''}`}>▶</span>
                  Win Projection
                </button>
                {/* Animated slide wrapper — content stays in DOM for smooth transition */}
                <div className={`ct-bd-slide ${projOpen ? 'open' : ''}`}>
                  <div className="ct-bd-slide-inner">
                    <WinProjectionChart teams={filledSlots} />
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Team detail popup (info button on slot cards) ── */}
      {popupTeam && (
        <TeamPopup teamName={popupTeam} onClose={() => setPopupTeam(null)} />
      )}

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

function TeamSlotCard({ team, onRemove, onInfo }) {
  const region = getTeamRegion(team.name);
  const { winsText, prob } = getExpectedWins(team.win_probability_distribution);
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

        {/* Expected wins + info button on the same row */}
        <div className="ct-slot-stat">
          <span className="ct-slot-stat-label">Expected Wins</span>
          <span className="ct-slot-stat-value" style={{ color }}>
            {winsText}
            <span className="ct-slot-prob"> ({(prob * 100).toFixed(2)}% likely)</span>
          </span>
          <button className="ct-slot-info-btn" onClick={onInfo} title="View team details">ⓘ</button>
        </div>
      </div>

      {/* Remove button — top-right */}
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

// ---------------------------------------------------------------------------
// WinProjectionChart — histogram of the aggregated win-probability distribution
// ---------------------------------------------------------------------------
// Renders a bar chart of the pool's total-win probability distribution.
// Bar heights are in absolute pixels (tallest bar = BAR_MAX_PX) to avoid
// percentage-of-parent overflow that would clip inside the collapsible slide.
// Bars are colored by their probability relative to the tallest bar:
// the most likely outcome is green, least likely is red.

// Histogram-specific threshold color function.
// Colors each bar by its position in the cumulative distribution (CDF):
//
//   CDF 0–5%  and 95–100%  → pure red   (extreme tail outcomes)
//   CDF 5–15% and 85–95%   → red→yellow (near-tail transition)
//   CDF 15–25% and 75–85%  → stable yellow
//   CDF 25–50%              → yellow→green
//   CDF 50%                 → pure green (most expected outcome)
//   CDF 50–75%              → green→yellow  (symmetric)
//
// @param {number} cdfPos - Bar's CDF midpoint position (0–1).
// @returns {string} HSL color string.
function histBarColor(cdfPos) {
  // Convert to symmetric distance from center: 0 = median (green), 1 = extreme (red).
  const dist = Math.abs(cdfPos - 0.5) * 2;

  let h, s, l;

  if (dist <= 0.5) {
    // CDF 25–75%: green at center (dist=0), yellow at edges (dist=0.5).
    const t = dist / 0.5;
    h = 145 + t * (43  - 145);
    s = 46  + t * (80  - 46);
    l = 42  + t * (46  - 42);
  } else if (dist <= 0.7) {
    // CDF 15–25% and 75–85%: stable yellow.
    h = 43; s = 80; l = 46;
  } else if (dist <= 0.9) {
    // CDF 5–15% and 85–95%: yellow → red.
    const t = (dist - 0.7) / 0.2;
    h = 43 + t * (0  - 43);
    s = 80 + t * (72 - 80);
    l = 46 + t * (60 - 46);
  } else {
    // CDF 0–5% and 95–100%: pure red.
    h = 0; s = 72; l = 60;
  }

  return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
}

// Tallest bar height in pixels — all other bars scale proportionally.
const BAR_MAX_PX = 120;

// Space below bars reserved for the win-count x-axis label (px).
// Used to position reference lines above the labels.
const BAR_BOTTOM_OFFSET = 16;

// CDF fractions at which to draw y-axis reference lines.
const PERCENTILE_FRACS = [0.05, 0.25, 0.50, 0.75, 0.95];

/**
 * @param {Object}        props
 * @param {Array<Object>} props.teams - Array of PoolTeamSummary objects currently in the pool.
 */
function WinProjectionChart({ teams }) {
  // Compute the full convolved win-probability distribution for the pool.
  const raw = computeWinProjection(teams);
  if (!raw) return null;

  // Normalize so displayed percentages sum to exactly 100%, correcting for any
  // floating-point drift accumulated during convolution.
  const totalProb = raw.reduce((sum, d) => sum + d.prob, 0);
  const normalized = totalProb > 0
    ? raw.map(d => ({ wins: d.wins, prob: d.prob / totalProb }))
    : raw;

  // Drop any entry below 0.1% — covers true zeros and near-zero floating-point
  // residuals on extreme outcomes that would display as "0.0%".
  const data = normalized.filter(d => d.prob >= 0.001);
  if (data.length === 0) return null;

  // The tallest bar's probability — used to scale pixel heights.
  const maxProb = Math.max(...data.map(d => d.prob));

  // Annotate each bar with its CDF midpoint position (0–1).
  // cdfPos = cumulative probability of all preceding bars + half this bar's prob,
  // giving the center of this bar's probability mass in the distribution.
  let cumulative = 0;
  const dataWithCdf = data.map(d => {
    const cdfPos = cumulative + d.prob / 2;
    cumulative += d.prob;
    return { ...d, cdfPos };
  });

  return (
    <div className="ct-proj-chart">
      {/* Y-axis title above the chart */}
      <div className="ct-proj-y-label">% Chance</div>

      {/* Y-axis column + bar area side by side */}
      <div className="ct-proj-body">

        {/* Y-axis: tick labels at each percentile height, absolutely positioned */}
        <div className="ct-proj-yaxis">
          {PERCENTILE_FRACS.map(frac => (
            <span
              key={frac}
              className="ct-proj-ytick"
              style={{ bottom: `${BAR_BOTTOM_OFFSET + frac * BAR_MAX_PX}px` }}
            >
              {(frac * maxProb * 100).toFixed(1)}%
            </span>
          ))}
        </div>

        {/* Bar area: reference lines (absolute) sit behind flex bar columns */}
        <div className="ct-proj-bars">
          {/* Horizontal reference lines at each percentile */}
          {PERCENTILE_FRACS.map(frac => (
            <div
              key={`ref-${frac}`}
              className="ct-proj-refline"
              style={{ bottom: `${BAR_BOTTOM_OFFSET + frac * BAR_MAX_PX}px` }}
            />
          ))}

          {/* Bar columns */}
          {dataWithCdf.map(({ wins, prob, cdfPos }) => {
            const barPx = maxProb > 0 ? (prob / maxProb) * BAR_MAX_PX : 0;
            const color = histBarColor(cdfPos);

            return (
              <div key={wins} className="ct-proj-bar-col">
                {/* Colored bar — absolute pixel height */}
                <div
                  className="ct-proj-bar-fill"
                  style={{ height: `${barPx}px`, background: color }}
                />
                {/* X-axis label: total wins value */}
                <span className="ct-proj-bar-label">{wins}</span>
              </div>
            );
          })}
        </div>

      </div>

      {/* X-axis title */}
      <div className="ct-proj-x-label">Number of Wins</div>
    </div>
  );
}
