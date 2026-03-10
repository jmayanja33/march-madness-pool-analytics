// HeadToHead — two-team matchup page.
//
// Layout: the page is split vertically into two equal halves (Team 1 | Team 2).
// Each half has a searchable team picker.  When a team is selected its full
// TeamCard fills that half.  When both sides are populated a win-probability
// meter appears at the top, animating from center to show each team's share.
// The meter segments use each team's primary color extracted from their logo.
import { useState, useEffect, useRef, useCallback } from 'react';
import NavBar from '../components/NavBar';
import TeamCard from '../components/TeamCard';
import { fetchTeams, fetchTeamData, fetchH2H } from '../api/teamApi';
import './Analyze.css';   /* reuse picker component styles */
import './HeadToHead.css';

// ---------------------------------------------------------------------------
// Logo color extraction
// ---------------------------------------------------------------------------

// Fallback colors used when logo extraction fails or a logo is missing.
const FALLBACK_COLOR_1 = 'var(--dark-blue)';
const FALLBACK_COLOR_2 = '#4a6fa5';

/**
 * Extracts the average primary color from a logo image using canvas.
 * Considers only non-transparent pixels that are not near-white, so that
 * background or padding pixels do not wash out the result.
 *
 * @param {string} src - Image URL to sample.
 * @returns {Promise<string|null>} RGB color string, or null on failure.
 */
function extractLogoColor(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Downsample to 32×32 for performance.
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
        // Skip transparent pixels and near-white pixels (avoid logo padding).
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

  // Head-to-head win probabilities from the backend, or null.
  const [h2hData, setH2hData]           = useState(null);
  const [h2hLoading, setH2hLoading]     = useState(false);
  const [h2hError, setH2hError]         = useState(null);

  // Controls the CSS transition on the meter fill — true once h2hData is ready.
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

  // Fetch H2H prediction whenever both sides are populated.
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
    fetchH2H(team1.name, team2.name)
      .then(data => {
        setH2hData(data);
        // Small delay so the browser renders the 0-width bar before animating.
        setTimeout(() => setMeterAnimated(true), 40);
      })
      .catch(() => setH2hError('Could not load head-to-head prediction.'))
      .finally(() => setH2hLoading(false));
  }, [team1, team2]);

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

  // Load a team by name into the specified side.
  async function loadTeam(name, side) {
    const setLoading = side === 1 ? setLoading1 : setLoading2;
    const setError   = side === 1 ? setError1   : setError2;
    const setTeam    = side === 1 ? setTeam1    : setTeam2;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeamData(name);
      setTeam(data);
    } catch {
      setError('Team data is not yet available. Try again once the backend is ready.');
    } finally {
      setLoading(false);
    }
  }

  // Clear a side back to the empty/picker state.
  function clearTeam(side) {
    if (side === 1) { setTeam1(null); setError1(null); }
    else             { setTeam2(null); setError2(null); }
  }

  // Names already chosen — used to exclude each team from the opposite picker.
  const addedNames = new Set([team1?.name, team2?.name].filter(Boolean));

  // Computed meter widths — start at 50/50 before animation fires.
  const pct1 = h2hData ? h2hData.team1.win_probability * 100 : 50;
  const pct2 = h2hData ? h2hData.team2.win_probability * 100 : 50;

  return (
    <div className="h2h-page">
      <NavBar />

      {/* ── Win probability meter (shown once both teams are loaded) ── */}
      {(team1 && team2) && (
        <div className="h2h-meter-wrap fade-in">
          {/* Section title */}
          <h2 className="h2h-meter-title">Win Probability</h2>

          <div className="h2h-meter-row">
            {/* Team 1 logo — left of the bar */}
            <img
              src={`/logos/${team1.name}.png`}
              alt={`${team1.name} logo`}
              className="h2h-meter-logo"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />

            {/* The probability bar */}
            <div className="h2h-meter-bar">
              {/* Left fill — team 1's win probability in their primary color */}
              <div
                className="h2h-meter-fill h2h-meter-fill-left"
                style={{
                  width: meterAnimated ? `${pct1}%` : '50%',
                  background: color1,
                }}
              >
                {meterAnimated && (
                  <span className="h2h-meter-label">{pct1.toFixed(1)}%</span>
                )}
              </div>

              {/* Right fill — team 2's win probability in their primary color */}
              <div
                className="h2h-meter-fill h2h-meter-fill-right"
                style={{
                  width: meterAnimated ? `${pct2}%` : '50%',
                  background: color2,
                }}
              >
                {meterAnimated && (
                  <span className="h2h-meter-label">{pct2.toFixed(1)}%</span>
                )}
              </div>
            </div>

            {/* Team 2 logo — right of the bar */}
            <img
              src={`/logos/${team2.name}.png`}
              alt={`${team2.name} logo`}
              className="h2h-meter-logo"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {/* Team name labels below the bar */}
          <div className="h2h-meter-names">
            <span className="h2h-meter-team-name" style={{ color: color1 }}>
              {team1.name}
            </span>
            <span className="h2h-meter-vs">vs</span>
            <span className="h2h-meter-team-name" style={{ color: color2 }}>
              {team2.name}
            </span>
          </div>

          {/* Loading / error states for the H2H fetch */}
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
            /* Empty state: show the team picker */
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
            /* Team loaded: show the full card (remove = clear back to picker) */
            <div className="h2h-card-wrap fade-in">
              <TeamCard team={team1} onRemove={() => clearTeam(1)} />
            </div>
          )}
        </div>

        {/* ── Vertical divider ── */}
        <div className="h2h-divider" />

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
            <div className="h2h-card-wrap fade-in">
              <TeamCard team={team2} onRemove={() => clearTeam(2)} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamPicker — searchable combobox (mirrors the Analyze page picker)
// ---------------------------------------------------------------------------
// Typing filters the list in real time; clicking a row calls onSelect.
// Teams already chosen on either side are excluded from the dropdown.

function TeamPicker({ teamList, loading, error, addedNames, onSelect }) {
  const [query, setQuery]   = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef        = useRef(null);

  // Filter out already-added teams, then apply the search query.
  const available = teamList.filter(t => !addedNames.has(t.name));
  const filtered  = query.trim()
    ? available.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : available;

  // Close dropdown when the user clicks outside.
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Select a team from the dropdown.
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
        {/* Chevron toggles the full list */}
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

        {/* Filtered dropdown list */}
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

        {/* No-results message */}
        {isOpen && !loading && query.trim() && filtered.length === 0 && (
          <div className="picker-no-results">No teams match "{query}"</div>
        )}
      </div>

      {error && <p className="picker-error">{error}</p>}
    </div>
  );
}
