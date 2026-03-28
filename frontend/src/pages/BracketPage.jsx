// BracketPage — displays the interactive 2026 NCAA Tournament bracket.
// Clicking any filled team slot opens a TeamPopup with that team's analytics.
// The bracket is scaled down via CSS transform so it always fits the viewport
// with no horizontal scrolling.
//
// Results are fetched live from the API on mount and transformed into the
// per-region format the bracket components expect.  If the fetch fails the
// bracket renders with all advancement columns showing TBD.
import { useState, useEffect, useRef, useCallback } from 'react';
import NavBar from '../components/NavBar';
import Bracket from '../components/Bracket';
import TeamPopup from '../components/TeamPopup';
import { BRACKET_2026, FIRST_FOUR_2026 } from '../data/bracketData';
import { fetchResults } from '../api/teamApi';
import { transformAPIResults } from '../utils/bracketUtils';
import './BracketPage.css';

export default function BracketPage() {
  useEffect(() => { document.title = 'The Pool | Bracket'; }, []);

  // Tracks which team the user has clicked; null means no popup is open
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Live bracket results derived from the API.  Starts null (all TBD) and
  // populates once the fetch completes.
  const [bracketResults, setBracketResults] = useState(null);

  useEffect(() => {
    fetchResults()
      .then(data => {
        // Transform the flat round/game list into per-region bracket format
        const derived = transformAPIResults(data, BRACKET_2026, FIRST_FOUR_2026);
        if (derived) setBracketResults(derived);
      })
      .catch(err => {
        // Non-fatal: bracket renders with all TBD advancement columns
        console.warn('[BracketPage] Could not fetch live results:', err.message);
      });
  }, []);

  // ── Scaling logic ──────────────────────────────────────────────────────────
  // Measure the natural bracket width against the container width and apply a
  // proportional CSS transform so the bracket always fits without scrolling.
  const containerRef = useRef(null);
  const bracketRef   = useRef(null);
  const [scale, setScale]             = useState(1);
  const [scaledHeight, setScaledHeight] = useState(null);

  const recalcScale = useCallback(() => {
    const container = containerRef.current;
    const bracket   = bracketRef.current;
    if (!container || !bracket) return;

    // CSS transforms do not affect scrollWidth/scrollHeight — these are layout
    // dimensions that always reflect the element's natural (unscaled) size.
    // No need to temporarily reset the transform before measuring.
    const naturalW = bracket.scrollWidth;
    const naturalH = bracket.scrollHeight;

    // Reserve 24 px (12 px per side) so the bracket never sits flush against
    // the viewport edge, regardless of sub-pixel rounding or scrollbar width.
    const containerW = container.clientWidth - 24;
    const s = Math.min(1, containerW / naturalW);
    setScale(s);
    // Pre-set container height so the page doesn't have a tall empty gap below
    // the visually-smaller bracket (transform doesn't affect layout flow).
    setScaledHeight(Math.ceil(naturalH * s));
  }, []);

  useEffect(() => {
    recalcScale();
    const ro = new ResizeObserver(recalcScale);
    const container = containerRef.current;
    if (container) ro.observe(container);
    return () => ro.disconnect();
  }, [recalcScale]);
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="bracket-page">
      <NavBar />
      <main className="bracket-page-main">
        <div className="bracket-page-header fade-in">
          <h1>2026 NCAA Tournament</h1>
          <p>Click on any team to view analytics</p>
        </div>

        {/* Outer container fills the available width; height is adjusted to
            match the visually scaled bracket so no empty space is left. */}
        <div
          ref={containerRef}
          className="bracket-scale-container"
          style={scaledHeight ? { height: scaledHeight } : {}}
        >
          {/* Inner wrapper receives the scale transform */}
          <div
            ref={bracketRef}
            className="bracket-scale-inner"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            {/* Pass 2026 bracket, First Four data, and live results; onTeamClick opens the analytics popup */}
            <Bracket
              bracket={BRACKET_2026}
              firstFour={FIRST_FOUR_2026}
              results={bracketResults}
              onTeamClick={setSelectedTeam}
            />
          </div>
        </div>
      </main>

      {/* Popup is rendered only when a team is selected */}
      {selectedTeam && (
        <TeamPopup
          teamName={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
