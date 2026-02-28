// TeamCard — full team analysis profile card for the Analyze page.
// Displays seed/record, win probability bars, top-5 players table,
// similar historical teams, and a scrollable profile summary.
// The onRemove callback fires when the user clicks the ✕ button.
import './TeamCard.css';

export default function TeamCard({ team, onRemove }) {
  // Build the three win-probability rows from the structured API fields.
  const winRows = [
    { label: '0 wins',  value: team.win_probability_distribution.zero_wins },
    { label: '1 win',   value: team.win_probability_distribution.one_win },
    { label: '2+ wins', value: team.win_probability_distribution.two_plus_wins },
  ];

  return (
    <div className="team-card">

      {/* ── Header: team name (with seed badge), record, remove button ── */}
      <div className="tc-header">
        <div className="tc-title">
          <div className="tc-name-row">
            <h2 className="tc-name">
              <span className="tc-seed">#{team.seed}</span>
              {team.name}
            </h2>
            <span className="tc-conference">{team.conference}</span>
          </div>
          <p className="tc-record">{team.wins}–{team.losses}</p>
        </div>
        <button className="tc-remove" onClick={onRemove} title="Remove team">✕</button>
      </div>

      {/* ── Win Probability ── */}
      <section className="tc-section">
        <h3 className="tc-section-label">Win Probability</h3>
        <div className="tc-prob-bars">
          {winRows.map(({ label, value }) => (
            <div key={label} className="tc-prob-row">
              <span className="tc-prob-label">{label}</span>
              <div className="tc-prob-track">
                {/* Width is driven by the probability (0–1); transition animates on mount. */}
                <div className="tc-prob-fill" style={{ width: `${value * 100}%` }} />
              </div>
              <span className="tc-prob-pct">{(value * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team Stats ── */}
      <section className="tc-section">
        <h3 className="tc-section-label">Team Stats</h3>
        {team.top_players.length === 0 ? (
          <p className="tc-unavailable">Team data not available.</p>
        ) : (
          <div className="tc-stats-grid">
            <div className="tc-stat"><span className="tc-stat-label">Avg Height</span><span className="tc-stat-value">{team.team_stats.avg_height}</span></div>
            <div className="tc-stat"><span className="tc-stat-label">2PT%</span><span className="tc-stat-value">{team.team_stats.two_point_pct}%</span></div>
            <div className="tc-stat"><span className="tc-stat-label">3PT%</span><span className="tc-stat-value">{team.team_stats.three_point_pct}%</span></div>
            <div className="tc-stat"><span className="tc-stat-label">Blocks</span><span className="tc-stat-value">{team.team_stats.blocks}</span></div>
            <div className="tc-stat"><span className="tc-stat-label">Off Reb</span><span className="tc-stat-value">{team.team_stats.offensive_rebounds}</span></div>
            <div className="tc-stat"><span className="tc-stat-label">Def Reb</span><span className="tc-stat-value">{team.team_stats.defensive_rebounds}</span></div>
            <div className="tc-stat"><span className="tc-stat-label">Turnovers</span><span className="tc-stat-value">{team.team_stats.turnovers}</span></div>
            <div className="tc-stat"><span className="tc-stat-label">Steals</span><span className="tc-stat-value">{team.team_stats.steals}</span></div>
            <div className="tc-stat"><span className="tc-stat-label">Fouls</span><span className="tc-stat-value">{team.team_stats.fouls}</span></div>
          </div>
        )}
      </section>

      {/* ── Top 5 Players by minutes ── */}
      <section className="tc-section">
        <h3 className="tc-section-label">Top Players</h3>
        {team.top_players.length === 0 ? (
          <p className="tc-unavailable">Player data not available.</p>
        ) : (
          <table className="tc-players-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Ht</th>
                <th>Avg Min</th>
                <th>Avg Pts</th>
                <th>FT%</th>
              </tr>
            </thead>
            <tbody>
              {team.top_players.map(p => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.position}</td>
                  <td>{p.height}</td>
                  <td>{p.avg_minutes}</td>
                  <td>{p.avg_points}</td>
                  <td>{p.free_throw_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── 3 Most Similar Historical Teams (from ChromaDB) ── */}
      <section className="tc-section">
        <h3 className="tc-section-label">Similar Teams</h3>
        {team.similar_teams.length === 0 ? (
          <p className="tc-unavailable">Similar team data not available.</p>
        ) : (
          <ul className="tc-similar-list">
            {team.similar_teams.map(t => (
              <li key={`${t.name}-${t.year}`}>
                <span className="tc-sim-name">{t.name} ({t.year})</span>
                <span className="tc-sim-meta">
                  {t.tournament_wins} tourney {t.tournament_wins === 1 ? 'win' : 'wins'} · {(t.similarity * 100).toFixed(0)}% similar
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── AI-generated profile summary ── */}
      {team.profile_summary && (
        <section className="tc-section">
          <h3 className="tc-section-label">Summary</h3>
          <p className="tc-summary">{team.profile_summary}</p>
        </section>
      )}

    </div>
  );
}
