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

      {/* ── Header: team name, record, remove button ── */}
      <div className="tc-header">
        <div className="tc-title">
          <h2 className="tc-name">{team.name}</h2>
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

      {/* ── Top 5 Players by minutes ── */}
      <section className="tc-section">
        <h3 className="tc-section-label">Top Players</h3>
        <table className="tc-players-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th>Ht</th>
              <th>Min</th>
              <th>Pts</th>
              <th>FT%</th>
            </tr>
          </thead>
          <tbody>
            {team.top_players.map(p => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.position}</td>
                <td>{p.height}</td>
                <td>{p.minutes}</td>
                <td>{p.points}</td>
                <td>{p.free_throw_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── 3 Most Similar Historical Teams (from ChromaDB) ── */}
      {team.similar_teams.length > 0 && (
        <section className="tc-section">
          <h3 className="tc-section-label">Similar Teams</h3>
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
        </section>
      )}

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
