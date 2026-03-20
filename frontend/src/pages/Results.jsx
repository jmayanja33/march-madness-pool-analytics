// Results page — displays model prediction accuracy by tournament year and round.
// Each year is a collapsible section; inside it are two model boxes:
//   1. Head to Head Model — contains each round as a nested collapsible section.
//   2. Wins Model — placeholder ("No data yet") until data is available.
// Correct predictions highlight the winning team in green; incorrect in red.
import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import { fetchResults } from '../api/teamApi';
import { probColor } from '../utils/colors';
import './Results.css';

// ---------------------------------------------------------------------------
// Accuracy helpers
// ---------------------------------------------------------------------------

// Compute total games and correct predictions across all games in a list.
// Returns { games, correct, accuracy } where accuracy is 0–1.
function calcStats(games) {
  const total = games.length;
  const correct = games.filter(g => g.correct).length;
  return {
    games: total,
    correct,
    accuracy: total > 0 ? correct / total : null,
  };
}

// Collect all games from every round in a tournament.
function allGames(tournament) {
  return tournament.rounds.flatMap(r => r.games);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Results() {
  useEffect(() => { document.title = 'The Pool | Results'; }, []);

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Each year section is collapsible; keyed by year number.
  const [yearCollapsed, setYearCollapsed] = useState({});
  // Each model box is collapsible; keyed by `${year}-h2h` or `${year}-wins`.
  const [modelCollapsed, setModelCollapsed] = useState({});
  // Each round section is collapsible; keyed by `${year}-${roundName}`.
  const [roundCollapsed, setRoundCollapsed] = useState({});

  // Fetch results on mount.
  useEffect(() => {
    fetchResults()
      .then(d => {
        setData(d);
        // Default all years, model boxes, and rounds to expanded.
        const yc = {};
        const mc = {};
        const rc = {};
        for (const t of d.tournaments) {
          yc[t.year] = false;
          mc[`${t.year}-h2h`]  = false;
          mc[`${t.year}-wins`] = false;
          for (const r of t.rounds) {
            rc[`${t.year}-${r.name}`] = false;
          }
        }
        setYearCollapsed(yc);
        setModelCollapsed(mc);
        setRoundCollapsed(rc);
      })
      .catch(() => setError('Could not load results. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  function toggleYear(year) {
    setYearCollapsed(prev => ({ ...prev, [year]: !prev[year] }));
  }

  function toggleModel(key) {
    setModelCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleRound(year, roundName) {
    const key = `${year}-${roundName}`;
    setRoundCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="results-page">
      <NavBar />

      <div className="results-body">
        <h1 className="results-title">Results</h1>
        <p className="results-subtitle">MODEL RESULTS BY YEAR AND ROUND</p>

        {/* Loading state */}
        {loading && <p className="results-status">Loading results…</p>}

        {/* Error state */}
        {error && <p className="results-error">{error}</p>}

        {/* Tournament year sections */}
        {data && data.tournaments.map(tournament => {
          const h2hStats      = calcStats(allGames(tournament));
          const isYearCollapsed = yearCollapsed[tournament.year];

          return (
            <section key={tournament.year} className="results-year-section">

              {/* Clickable year header */}
              <button
                className="results-year-header"
                onClick={() => toggleYear(tournament.year)}
                aria-expanded={!isYearCollapsed}
              >
                <div className="results-year-header-left">
                  <h2 className="results-year-title">{tournament.tournament_name}</h2>
                  {/* Per-model accuracy lines shown in smaller text below the title */}
                  <div className="results-year-model-stats">
                    <span className="results-year-model-stat">
                      Head to Head Model Accuracy:{' '}
                      <strong style={h2hStats.accuracy !== null ? { color: probColor(h2hStats.accuracy) } : {}}>
                        {h2hStats.accuracy !== null
                          ? `${(h2hStats.accuracy * 100).toFixed(2)}%`
                          : 'N/A'}
                      </strong>
                    </span>
                    <span className="results-year-model-stat">
                      Wins Model Accuracy: <strong>N/A</strong>
                    </span>
                  </div>
                </div>
                <span className={`results-caret${isYearCollapsed ? ' results-caret--collapsed' : ''}`}>
                  &#8964;
                </span>
              </button>

              {/* Year section body — contains the two model boxes */}
              {!isYearCollapsed && (
                <div className="results-year-body">

                  {/* ── Head to Head Model box ── */}
                  <H2HModelBox
                    tournament={tournament}
                    h2hStats={h2hStats}
                    modelCollapsed={modelCollapsed}
                    roundCollapsed={roundCollapsed}
                    onToggleModel={toggleModel}
                    onToggleRound={toggleRound}
                  />

                  {/* ── Wins Model box ── */}
                  <WinsModelBox
                    year={tournament.year}
                    modelCollapsed={modelCollapsed}
                    onToggleModel={toggleModel}
                  />

                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// H2HModelBox — collapsible "Head to Head Model" section for one tournament.
// Contains the overall H2H stats and all round sub-sections.
// ---------------------------------------------------------------------------

function H2HModelBox({ tournament, h2hStats, modelCollapsed, roundCollapsed, onToggleModel, onToggleRound }) {
  const key        = `${tournament.year}-h2h`;
  const isCollapsed = modelCollapsed[key];

  return (
    <section className="results-model-section">

      {/* Model box header */}
      <button
        className="results-model-header"
        onClick={() => onToggleModel(key)}
        aria-expanded={!isCollapsed}
      >
        <h3 className="results-model-title">
          Head to Head Model
          {/* Show accuracy only when games have been played */}
          {h2hStats.accuracy !== null && (
            <span
              className="results-accuracy-badge"
              style={{ color: probColor(h2hStats.accuracy) }}
            >
              {' '}({(h2hStats.accuracy * 100).toFixed(2)}%)
            </span>
          )}
        </h3>
        <span className={`results-caret results-caret--small${isCollapsed ? ' results-caret--collapsed' : ''}`}>
          &#8964;
        </span>
      </button>

      {/* Model box body */}
      {!isCollapsed && (
        <div className="results-model-body">

          {/* Overall H2H stats */}
          {h2hStats.games > 0 && (
            <div className="results-stats-bar">
              <span>Games: <strong>{h2hStats.games}</strong></span>
              <span>Correct: <strong>{h2hStats.correct}</strong></span>
              <span>
                Accuracy:{' '}
                <strong style={{ color: probColor(h2hStats.accuracy) }}>
                  {(h2hStats.accuracy * 100).toFixed(2)}%
                </strong>
              </span>
            </div>
          )}

          {/* Round sub-sections */}
          {tournament.rounds.map(round => {
            const roundStats  = calcStats(round.games);
            const roundKey    = `${tournament.year}-${round.name}`;
            const isRoundCollapsed = roundCollapsed[roundKey];

            return (
              <section key={round.name} className="results-round-section">

                {/* Clickable round header */}
                <button
                  className="results-round-header"
                  onClick={() => onToggleRound(tournament.year, round.name)}
                  aria-expanded={!isRoundCollapsed}
                >
                  <h4 className="results-round-title">
                    {round.name}
                    {/* Show round accuracy only if games have been played */}
                    {roundStats.accuracy !== null && (
                      <span
                        className="results-accuracy-badge"
                        style={{ color: probColor(roundStats.accuracy) }}
                      >
                        {' '}({(roundStats.accuracy * 100).toFixed(2)}%)
                      </span>
                    )}
                  </h4>
                  <span className={`results-caret results-caret--small${isRoundCollapsed ? ' results-caret--collapsed' : ''}`}>
                    &#8964;
                  </span>
                </button>

                {/* Round body */}
                {!isRoundCollapsed && (
                  <div className="results-round-body">

                    {/* No games yet state */}
                    {round.games.length === 0 && (
                      <p className="results-no-games">No games yet</p>
                    )}

                    {/* Round stats summary */}
                    {round.games.length > 0 && (
                      <div className="results-stats-bar results-stats-bar--round">
                        <span>Games: <strong>{roundStats.games}</strong></span>
                        <span>Correct: <strong>{roundStats.correct}</strong></span>
                        <span>
                          Accuracy:{' '}
                          <strong style={{ color: probColor(roundStats.accuracy) }}>
                            {(roundStats.accuracy * 100).toFixed(2)}%
                          </strong>
                        </span>
                      </div>
                    )}

                    {/* Game result rows */}
                    {round.games.map((game, idx) => (
                      <GameRow key={idx} game={game} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// WinsModelBox — collapsible "Wins Model" section for one tournament.
// Currently shows "No data yet" since no wins-model results are available.
// ---------------------------------------------------------------------------

function WinsModelBox({ year, modelCollapsed, onToggleModel }) {
  const key        = `${year}-wins`;
  const isCollapsed = modelCollapsed[key];

  return (
    <section className="results-model-section">

      {/* Model box header */}
      <button
        className="results-model-header"
        onClick={() => onToggleModel(key)}
        aria-expanded={!isCollapsed}
      >
        <h3 className="results-model-title">Wins Model</h3>
        <span className={`results-caret results-caret--small${isCollapsed ? ' results-caret--collapsed' : ''}`}>
          &#8964;
        </span>
      </button>

      {/* Model box body */}
      {!isCollapsed && (
        <div className="results-model-body">
          <p className="results-no-games">No data yet</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// GameRow — displays one game result with seeds, logos, names, and scores.
// ---------------------------------------------------------------------------
// The winning team's name is highlighted green (correct prediction) or red
// (incorrect prediction). Optional scores are shown when available.

function GameRow({ game }) {
  // Determine color for the winning team's name.
  const winnerColor = game.correct ? '#3a9e5f' : '#e05252';

  return (
    <div className="results-game-row fade-in">
      {/* Team 1 */}
      <TeamEntry
        team={game.team1}
        isWinner={game.team1.name === game.winner}
        winnerColor={winnerColor}
      />

      {/* Separator */}
      <span className="results-game-vs">vs.</span>

      {/* Team 2 */}
      <TeamEntry
        team={game.team2}
        isWinner={game.team2.name === game.winner}
        winnerColor={winnerColor}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamEntry — one team's section within a GameRow.
// ---------------------------------------------------------------------------

function TeamEntry({ team, isWinner, winnerColor }) {
  return (
    <div className="results-team-entry">
      {/* Seed number */}
      <span className="results-team-seed">{team.seed}.</span>

      {/* Team logo */}
      <img
        src={`/logos/${team.name}.png`}
        alt={`${team.name} logo`}
        className="results-team-logo"
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />

      {/* Team name — colored if this team is the winner */}
      <span
        className="results-team-name"
        style={isWinner ? { color: winnerColor, fontWeight: 700 } : {}}
      >
        {team.name}
      </span>

      {/* Score — only shown when available */}
      {team.score !== null && team.score !== undefined && (
        <span className="results-team-score">{team.score}</span>
      )}
    </div>
  );
}
