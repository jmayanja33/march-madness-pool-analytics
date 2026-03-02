// BracketPage — displays the interactive 2026 NCAA Tournament bracket.
// Clicking any filled team slot opens a TeamPopup with that team's analytics.
// The bracket is scaled down via CSS transform so it always fits the viewport
// with no horizontal scrolling.
import { useState, useEffect, useRef, useCallback } from 'react';
import NavBar from '../components/NavBar';
import Bracket from '../components/Bracket';
import TeamPopup from '../components/TeamPopup';
import { BRACKET_2025, FIRST_FOUR_2025, RESULTS_2025 } from '../data/bracketData';
import './BracketPage.css';

export default function BracketPage() {
  useEffect(() => { document.title = 'The Pool | Bracket'; }, []);

  // Tracks which team the user has clicked; null means no popup is open
  const [selectedTeam, setSelectedTeam] = useState(null);

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

    // Reset scale to 1 before measuring so scrollWidth reflects natural size
    bracket.style.transform = 'scale(1)';
    const naturalW = bracket.scrollWidth;
    const naturalH = bracket.scrollHeight;
    bracket.style.transform = '';

    const containerW = container.clientWidth;
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
          <h1>2025 NCAA Tournament</h1>
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
            {/* Pass 2025 bracket, First Four data, and full results; onTeamClick opens the analytics popup */}
            <Bracket
              bracket={BRACKET_2025}
              firstFour={FIRST_FOUR_2025}
              results={RESULTS_2025}
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
