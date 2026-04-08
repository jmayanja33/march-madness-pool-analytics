// HeadToHead — two-team matchup page with optional path-difficulty adjustment.
//
// Layout: the page is split vertically into two equal halves (Team 1 | Team 2).
// Each half has a searchable team picker.  When a team is selected its full
// TeamCard fills that half, and a "Prior Path" table appears below.
//
// The prior path table has one row per tournament round (First Four through
// Final Four).  A round can only be filled once the previous round is filled,
// enforcing chronological order.  The First Four row is optional and
// independent — it does not gate the Round of 64 row.
//
// Each filled slot shows a round-labeled chip.  Removing an opponent from
// a slot also cascades-clears all later slots so the path stays sequential.
//
// When both sides are populated a win-probability meter appears at the top.
// If any prior opponents are set the meter shows the path-adjusted probability
// (Bayesian log-odds update); otherwise it shows the base pre-season value.
// Meter segments use each team's primary color extracted from their logo.
import { useState, useEffect, useRef } from 'react';
import NavBar from '../components/NavBar';
import TeamCard from '../components/TeamCard';
import { fetchTeams, fetchTeamData, fetchH2H } from '../api/teamApi';
import './Analyze.css';   /* reuse picker component styles */
import './HeadToHead.css';

// ---------------------------------------------------------------------------
// Round configuration
// ---------------------------------------------------------------------------

// Ordered list of rounds that appear as rows in the path table.
// "optional" marks the First Four as not requiring the previous slot.
const ROUND_CONFIG = [
  { key: 'firstFour', label: 'First Four', short: 'PLAY IN', optional: true },
  { key: 'r64',       label: 'Round of 64', short: 'R64',  optional: false },
  { key: 'r32',       label: 'Round of 32', short: 'R32',  optional: false },
  { key: 's16',       label: 'Sweet Sixteen', short: 'S16', optional: false },
  { key: 'e8',        label: 'Elite Eight', short: 'E8',   optional: false },
  { key: 'ff',        label: 'Final Four', short: 'FF',    optional: false },
];

// Keys of rounds that follow each other sequentially (excluding firstFour).
// Used to cascade-clear dependent slots when an earlier slot is removed.
const SEQUENTIAL_KEYS = ['r64', 'r32', 's16', 'e8', 'ff'];

// Empty path state — all slots null.
const EMPTY_PATH = { firstFour: null, r64: null, r32: null, s16: null, e8: null, ff: null };

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Convert a path object into the ordered opponents array expected by the
 * backend.  Null slots are omitted.  The First Four opponent comes first,
 * followed by R64 through FF in order.
 *
 * @param {Object} path - Path object with keys firstFour, r64, r32, s16, e8, ff.
 * @returns {string[]} Ordered array of beaten opponent names.
 */
function buildFullPath(path) {
  return ROUND_CONFIG.map(r => path[r.key]).filter(Boolean);
}

/**
 * Returns true when at least one slot in the path is filled.
 *
 * @param {Object} path - Path object.
 * @returns {boolean}
 */
function hasPathData(path) {
  return Object.values(path).some(Boolean);
}

// ---------------------------------------------------------------------------
// Logo color extraction
// ---------------------------------------------------------------------------

// Fallback colors used when logo extraction fails or a logo is missing.
const FALLBACK_COLOR_1 = 'var(--dark-blue)';
const FALLBACK_COLOR_2 = '#4a6fa5';

/**
 * Extracts the average primary color from a logo image using canvas.
 * Considers only non-transparent, non-near-white pixels.
 *
 * @param {string} src - Image URL to sample.
 * @returns {Promise<string|null>} RGB color string, or null on failure.
 */
function extractLogoColor(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 32, 32);
      const { data } = ctx.getImageData(0, 0, 32, 32);

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        const pr = data[i], pg = data[i + 1], pb = data[i + 2];
        if (alpha < 128) continue;
        if (pr > 220 && pg > 220 && pb > 220) continue;
        r += pr; g += pg; b += pb;
        count++;
      }

      if (count === 0) { resolve(null); return; }
      resolve(`rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`);
    };

    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HeadToHead() {
  useEffect(() => { document.title = 'The Pool | Head to Head'; }, []);

  // Sorted list of { name, seed } for the team pickers.
  const [teamList, setTeamList]         = useState([]);
  const [listLoading, setListLoading]   = useState(true);
  const [listError, setListError]       = useState(null);

  // Full TeamAnalysis data for each side, or null when unpopulated.
  const [team1, setTeam1]               = useState(null);
  const [team2, setTeam2]               = useState(null);

  // Per-side loading/error state while a team is being fetched.
  const [loading1, setLoading1]         = useState(false);
  const [loading2, setLoading2]         = useState(false);
  const [error1, setError1]             = useState(null);
  const [error2, setError2]             = useState(null);

  // Path objects — one per side.  Each key is a round slot (firstFour, r64,
  // r32, s16, e8, ff) holding either null or a beaten opponent's display name.
  const [path1, setPath1]               = useState({ ...EMPTY_PATH });
  const [path2, setPath2]               = useState({ ...EMPTY_PATH });

  // Head-to-head win probabilities from the backend, or null.
  const [h2hData, setH2hData]           = useState(null);
  const [h2hLoading, setH2hLoading]     = useState(false);
  const [h2hError, setH2hError]         = useState(null);

  // Controls the CSS transition on the meter fill.
  const [meterAnimated, setMeterAnimated] = useState(false);

  // Team logo primary colors, used to fill the meter segments.
  const [color1, setColor1]             = useState(FALLBACK_COLOR_1);
  const [color2, setColor2]             = useState(FALLBACK_COLOR_2);

  // Load team list on mount.
  useEffect(() => {
    fetchTeams()
      .then(setTeamList)
      .catch(() => setListError('Could not load team list. Make sure the backend is running.'))
      .finally(() => setListLoading(false));
  }, []);

  // Fetch H2H prediction whenever both sides are populated or any path changes.
  useEffect(() => {
    if (!team1 || !team2) {
      setH2hData(null);
      setMeterAnimated(false);
      return;
    }
    setH2hData(null);
    setMeterAnimated(false);
    setH2hLoading(true);
    setH2hError(null);

    fetchH2H(team1.name, team2.name, buildFullPath(path1), buildFullPath(path2))
      .then(data => {
        setH2hData(data);
        setTimeout(() => setMeterAnimated(true), 40);
      })
      .catch(() => setH2hError('Could not load head-to-head prediction.'))
      .finally(() => setH2hLoading(false));
  }, [team1, team2, path1, path2]);

  // Extract team logo colors whenever teams change.
  useEffect(() => {
    if (!team1) { setColor1(FALLBACK_COLOR_1); return; }
    extractLogoColor(`/logos/${team1.name}.png`)
      .then(c => setColor1(c ?? FALLBACK_COLOR_1));
  }, [team1]);

  useEffect(() => {
    if (!team2) { setColor2(FALLBACK_COLOR_2); return; }
    extractLogoColor(`/logos/${team2.name}.png`)
      .then(c => setColor2(c ?? FALLBACK_COLOR_2));
  }, [team2]);

  // Load a team by name into the specified side and reset that side's path.
  async function loadTeam(name, side) {
    const setLoading = side === 1 ? setLoading1 : setLoading2;
    const setError   = side === 1 ? setError1   : setError2;
    const setTeam    = side === 1 ? setTeam1    : setTeam2;
    const setPath    = side === 1 ? setPath1    : setPath2;

    setLoading(true);
    setError(null);
    setPath({ ...EMPTY_PATH });
    try {
      const data = await fetchTeamData(name);
      setTeam(data);
    } catch {
      setError('Team data is not yet available. Try again once the backend is ready.');
    } finally {
      setLoading(false);
    }
  }

  // Clear a side back to the empty/picker state and remove its path.
  function clearTeam(side) {
    if (side === 1) { setTeam1(null); setError1(null); setPath1({ ...EMPTY_PATH }); }
    else             { setTeam2(null); setError2(null); setPath2({ ...EMPTY_PATH }); }
  }

  // Names already chosen on either main side — excluded from all pickers.
  const addedNames = new Set([team1?.name, team2?.name].filter(Boolean));

  // True when any path slot is filled on either side — drives "Path Adjusted" badge.
  const hasPath = hasPathData(path1) || hasPathData(path2);

  // Display probabilities: use path-adjusted when available, else base.
  const pct1 = h2hData
    ? (h2hData.team1.path_adjusted_probability ?? h2hData.team1.win_probability) * 100
    : 50;
  const pct2 = h2hData
    ? (h2hData.team2.path_adjusted_probability ?? h2hData.team2.win_probability) * 100
    : 50;

  return (
    <div className="h2h-page">
      <NavBar />

      {/* ── Win probability meter ── */}
      {(team1 && team2) && (
        <div className="h2h-meter-wrap fade-in">
          <h2 className="h2h-meter-title">
            Win Probability
            {hasPath && (
              <span className="h2h-path-adjusted-badge"> · Path Adjusted</span>
            )}
          </h2>

          <div className="h2h-meter-row">
            <img
              src={`/logos/${team1.name}.png`}
              alt={`${team1.name} logo`}
              className="h2h-meter-logo"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />

            <div className="h2h-meter-bar">
              <div
                className="h2h-meter-fill h2h-meter-fill-left"
                style={{ width: meterAnimated ? `${pct1}%` : '50%', background: color1 }}
              >
                {meterAnimated && (
                  <span className="h2h-meter-label">{pct1.toFixed(1)}%</span>
                )}
              </div>
              <div
                className="h2h-meter-fill h2h-meter-fill-right"
                style={{ width: meterAnimated ? `${pct2}%` : '50%', background: color2 }}
              >
                {meterAnimated && (
                  <span className="h2h-meter-label">{pct2.toFixed(1)}%</span>
                )}
              </div>
            </div>

            <img
              src={`/logos/${team2.name}.png`}
              alt={`${team2.name} logo`}
              className="h2h-meter-logo"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          <div className="h2h-meter-names">
            <span className="h2h-meter-team-name" style={{ color: color1 }}>{team1.name}</span>
            <span className="h2h-meter-vs">vs</span>
            <span className="h2h-meter-team-name" style={{ color: color2 }}>{team2.name}</span>
          </div>

          {h2hLoading && <p className="h2h-meter-status">Loading prediction…</p>}
          {h2hError   && <p className="h2h-meter-error">{h2hError}</p>}
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="h2h-body">

        {/* ── Left side — Team 1 ── */}
        <div className="h2h-side">
          <h2 className="h2h-side-title">Team 1</h2>

          {!team1 ? (
            <div className="h2h-picker-wrap">
              <TeamPicker
                teamList={teamList}
                loading={listLoading || loading1}
                error={listError || error1}
                addedNames={addedNames}
                onSelect={name => loadTeam(name, 1)}
              />
            </div>
          ) : (
            <>
              <div className="h2h-card-wrap fade-in">
                <TeamCard team={team1} onRemove={() => clearTeam(1)} />
              </div>
              <PathTable
                teamList={teamList}
                addedNames={addedNames}
                path={path1}
                onPathChange={setPath1}
              />
            </>
          )}
        </div>

        {/* ── Vertical divider ── */}
        <div className="h2h-divider">
          {!(team1 || team2) ? (
            <>
              <p className="h2h-page-sub">EVALUATE 2 TEAMS AND DETERMINE WHO WILL WIN A HEAD TO HEAD MATCHUP</p>
              <div className="h2h-divider-line" />
            </>
          ) : (
            <div className="h2h-divider-line" />
          )}
        </div>

        {/* ── Right side — Team 2 ── */}
        <div className="h2h-side">
          <h2 className="h2h-side-title">Team 2</h2>

          {!team2 ? (
            <div className="h2h-picker-wrap">
              <TeamPicker
                teamList={teamList}
                loading={listLoading || loading2}
                error={listError || error2}
                addedNames={addedNames}
                onSelect={name => loadTeam(name, 2)}
              />
            </div>
          ) : (
            <>
              <div className="h2h-card-wrap fade-in">
                <TeamCard team={team2} onRemove={() => clearTeam(2)} />
              </div>
              <PathTable
                teamList={teamList}
                addedNames={addedNames}
                path={path2}
                onPathChange={setPath2}
              />
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamPicker — searchable combobox
// ---------------------------------------------------------------------------

function TeamPicker({ teamList, loading, error, addedNames, onSelect }) {
  const [query, setQuery]   = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef        = useRef(null);

  const available = teamList.filter(t => !addedNames.has(t.name));
  const filtered  = query.trim()
    ? available.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : available;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function choose(team) {
    setQuery(team.name);
    setIsOpen(false);
    onSelect(team.name);
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
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          autoComplete="off"
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
              <li key={t.name} className="picker-option" onMouseDown={() => choose(t)}>
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
// PathTable — round-by-round opponent table
// ---------------------------------------------------------------------------
// Renders one row per tournament round.  Each row has a round badge on the
// left and either a filled chip or an interactive slot picker on the right.
//
// Sequential constraint: a slot is enabled only when the preceding slot is
// filled (except First Four, which is always enabled and optional).
// Removing an opponent from a slot cascades-clears all dependent later slots.
//
// Props:
//   teamList    — full { name, seed } list from the API
//   addedNames  — Set of the two main team names (always excluded)
//   path        — path object { firstFour, r64, r32, s16, e8, ff }
//   onPathChange — callback(newPath) called on any slot change

function PathTable({ teamList, addedNames, path, onPathChange }) {
  // All names currently filled across all slots — prevent using the same team twice.
  const filledNames = new Set(Object.values(path).filter(Boolean));
  // Full exclusion set: the two main teams plus all filled opponents.
  const excludeNames = new Set([...addedNames, ...filledNames]);

  // Returns true when the given round slot is available to interact with.
  function isEnabled(key) {
    if (key === 'firstFour' || key === 'r64') return true;
    const prereq = { r32: 'r64', s16: 'r32', e8: 's16', ff: 'e8' };
    return !!path[prereq[key]];
  }

  // Update a single slot, cascading-clear any dependent sequential slots.
  function setSlot(key, name) {
    const newPath = { ...path, [key]: name };
    // When clearing a non-firstFour slot, clear all slots that come after it.
    if (!name && key !== 'firstFour') {
      const idx = SEQUENTIAL_KEYS.indexOf(key);
      for (let i = idx + 1; i < SEQUENTIAL_KEYS.length; i++) {
        newPath[SEQUENTIAL_KEYS[i]] = null;
      }
    }
    onPathChange(newPath);
  }

  return (
    <div className="h2h-prior-section">
      <div className="h2h-prior-header">
        <span className="h2h-prior-title">NCAA Tournament Path</span>
        <span className="h2h-prior-hint">
          Add opponents beaten on the way to this matchup to adjust the win probability
        </span>
      </div>

      {/* One row per round */}
      <div className="h2h-path-table">
        {ROUND_CONFIG.map(({ key, short, optional }) => {
          const enabled = isEnabled(key);
          const selected = path[key];
          return (
            <div key={key} className={`h2h-path-row${enabled ? '' : ' h2h-path-row-disabled'}`}>
              {/* Left column — round badge */}
              <div className="h2h-path-label-col">
                <span className={`h2h-prior-chip-round${enabled ? '' : ' h2h-path-badge-dim'}`}>
                  {short}
                </span>
                {optional && (
                  <span className="h2h-path-optional">opt</span>
                )}
              </div>

              {/* Right column — slot picker or filled chip */}
              <div className="h2h-path-value-col">
                <SlotPicker
                  teamList={teamList}
                  excludeNames={excludeNames}
                  selected={selected}
                  onSelect={name => setSlot(key, name)}
                  enabled={enabled}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SlotPicker — single round slot in the path table
// ---------------------------------------------------------------------------
// Shows one of three states:
//   filled   — a chip with the selected team name and a remove button
//   enabled  — a button that opens an inline searchable dropdown
//   disabled — a grey dash indicating this round is not yet reachable

function SlotPicker({ teamList, excludeNames, selected, onSelect, enabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery]   = useState('');
  const ref                 = useRef(null);

  // Close dropdown on outside click.
  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Filled state — show chip with remove button.
  if (selected) {
    const t = teamList.find(t => t.name === selected);
    return (
      <span className="h2h-prior-chip">
        {t ? `#${t.seed} ` : ''}{selected}
        <button
          className="h2h-prior-chip-remove"
          onClick={() => onSelect(null)}
          aria-label={`Remove ${selected}`}
        >
          ✕
        </button>
      </span>
    );
  }

  // Disabled state — show a dash.
  if (!enabled) {
    return <span className="h2h-path-disabled">—</span>;
  }

  // Enabled and empty — show the picker button and inline dropdown.
  const available = teamList.filter(t => !excludeNames.has(t.name));
  const filtered  = query.trim()
    ? available.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : available;

  return (
    <div className="h2h-path-picker" ref={ref}>
      <button
        className="h2h-path-add-btn"
        onClick={() => setIsOpen(prev => !prev)}
      >
        + Select opponent
      </button>

      {isOpen && (
        <div className="h2h-path-dropdown">
          <input
            type="text"
            className="h2h-path-search"
            placeholder="Search teams…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {filtered.length > 0 ? (
            <ul className="h2h-path-dropdown-list">
              {filtered.map(t => (
                <li
                  key={t.name}
                  className="h2h-path-option"
                  onMouseDown={() => { onSelect(t.name); setIsOpen(false); setQuery(''); }}
                >
                  <span className="picker-seed">#{t.seed}</span>
                  {t.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="picker-no-results">No teams available</div>
          )}
        </div>
      )}
    </div>
  );
}
