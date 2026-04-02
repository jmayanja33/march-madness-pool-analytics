// BracketPage — displays the interactive 2026 NCAA Tournament bracket.
//
// Two tabs are available at the top of the page:
//   "Live Bracket"      — shows actual tournament results, updating as games are played.
//   "Predicted Bracket" — shows the most-likely predicted bracket from predictions JSON,
//                         with correct/incorrect coloring once games are played.
//
// Clicking any filled team slot opens a TeamPopup with that team's analytics.
// The bracket is scaled down via CSS transform so it always fits the viewport
// with no horizontal scrolling.
//
// Results are fetched live from the API on mount.  The same raw API data drives
// both the live bracket (via transformAPIResults) and the predicted bracket
// (via transformPredictedBracket).  If the fetch fails both brackets render
// with no status coloring applied.
import { useState, useEffect, useRef, useCallback } from 'react';
import NavBar from '../components/NavBar';
import Bracket from '../components/Bracket';
import TeamPopup from '../components/TeamPopup';
import { BRACKET_2026, FIRST_FOUR_2026 } from '../data/bracketData';
import { PREDICTED_BRACKET } from '../data/predictedBracketData';
import { fetchResults } from '../api/teamApi';
import { transformAPIResults, transformPredictedBracket } from '../utils/bracketUtils';
import './BracketPage.css';

export default function BracketPage() {
  useEffect(() => { document.title = 'The Pool | Bracket'; }, []);

  // Tracks which team the user has clicked; null means no popup is open
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Active tab: 'live' or 'predicted'
  const [activeTab, setActiveTab] = useState('live');

  // Live bracket results derived from the API.  Starts null (all TBD) and
  // populates once the fetch completes.
  const [bracketResults, setBracketResults] = useState(null);

  // Predicted bracket results, computed from PREDICTED_BRACKET + raw API data.
  // Starts null and populates after the API fetch (even if empty, so the bracket renders).
  const [predictedResults, setPredictedResults] = useState(null);

  useEffect(() => {
    fetchResults()
      .then(data => {
        // Transform the flat round/game list into per-region bracket format for live tab
        const derived = transformAPIResults(data, BRACKET_2026, FIRST_FOUR_2026);
        if (derived) setBracketResults(derived);

        // Compute predicted bracket from static prediction data; liveResults
        // is used only for accuracy metric calculation, not for coloring.
        const predicted = transformPredictedBracket(
          PREDICTED_BRACKET,
          derived ?? null,
          BRACKET_2026,
          FIRST_FOUR_2026,
        );
        setPredictedResults(predicted);
      })
      .catch(err => {
        // Non-fatal: both brackets render with no status coloring applied
        console.warn('[BracketPage] Could not fetch live results:', err.message);
        // Still populate predicted bracket without any game results
        const predicted = transformPredictedBracket(
          PREDICTED_BRACKET,
          null,
          BRACKET_2026,
          FIRST_FOUR_2026,
        );
        setPredictedResults(predicted);
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

  // Recalculate scale when the active tab changes — each bracket may have
  // slightly different height depending on whether accuracy metrics are present.
  useEffect(() => {
    recalcScale();
  }, [activeTab, recalcScale]);
  // ──────────────────────────────────────────────────────────────────────────

  // Convenience alias: accuracy stats from the predicted results object
  const accuracy = predictedResults?.accuracy ?? null;

  return (
    <div className="bracket-page">
      <NavBar />
      <main className="bracket-page-main">
        <div className="bracket-page-header fade-in">
          <h1>2026 NCAA Tournament</h1>
          <p>Click on any team to view analytics</p>
        </div>

        {/* ── Tab bar ── */}
        <div className="bracket-tabs fade-in">
          <button
            className={`bracket-tab ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            Live Bracket
          </button>
          <button
            className={`bracket-tab ${activeTab === 'predicted' ? 'active' : ''}`}
            onClick={() => setActiveTab('predicted')}
          >
            Predicted Bracket
          </button>
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
            {activeTab === 'live' && (
              /* Live bracket — uses transformAPIResults output */
              <Bracket
                bracket={BRACKET_2026}
                firstFour={FIRST_FOUR_2026}
                results={bracketResults}
                onTeamClick={setSelectedTeam}
              />
            )}

            {activeTab === 'predicted' && (
              /* Predicted bracket — uses transformPredictedBracket output */
              <div className="predicted-bracket-wrapper">
                <Bracket
                  bracket={BRACKET_2026}
                  firstFour={FIRST_FOUR_2026}
                  results={predictedResults}
                  onTeamClick={setSelectedTeam}
                />

                {/* ── Accuracy metrics row ── */}
                {accuracy && (
                  <div className="accuracy-metrics fade-in">
                    <div className="accuracy-stat">
                      <span className="accuracy-label">Total Games Played</span>
                      <span className="accuracy-value">{accuracy.totalPlayed}</span>
                    </div>
                    <div className="accuracy-stat">
                      <span className="accuracy-label">Correct Predictions</span>
                      <span className="accuracy-value">{accuracy.correct}</span>
                    </div>
                    <div className="accuracy-stat">
                      <span className="accuracy-label">Accuracy</span>
                      <span className="accuracy-value">
                        {accuracy.percentage !== null ? `${accuracy.percentage}%` : '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
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
