// Modal popup displayed when a user clicks a team slot in the bracket.
// Fetches team data from the backend and renders four sections:
//   Win Probability, Top Players, Similar Teams, and a text Summary.
// Clicking the overlay or the ✕ button closes the popup.
import { useEffect, useState } from 'react';
import { fetchTeamData } from '../api/teamApi';
import './TeamPopup.css';

export default function TeamPopup({ teamName, onClose }) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch team data whenever the selected team changes.
  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(true);
    fetchTeamData(teamName)
      .then(setData)
      .catch(() => setError('Team data is not yet available.'))
      .finally(() => setLoading(false));
  }, [teamName]);

  // Win probability rows built from the structured API response fields.
  const winRows = data
    ? [
        { label: '0 wins',  value: data.win_probability_distribution.zero_wins },
        { label: '1 win',   value: data.win_probability_distribution.one_win },
        { label: '2+ wins', value: data.win_probability_distribution.two_plus_wins },
      ]
    : [];

  return (
    // Clicking the overlay (outside the popup card) closes the popup.
    <div className="popup-overlay" onClick={onClose}>
      {/* stopPropagation prevents clicks inside the card from closing it. */}
      <div className="popup pop-in" onClick={e => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose}>✕</button>

        {/* Loading and error states */}
        {loading && <div className="popup-loading"><span className="spinner" />Loading…</div>}
        {error   && <div className="popup-error">{error}</div>}

        {data && (
          <div className="popup-content">
            <h2 className="popup-team-name">{data.name}</h2>
            <p className="popup-record">{data.wins}–{data.losses}</p>

            {/* ── Win Probability ── */}
            <section>
              <h3>Win Probability</h3>
              <div className="prob-bars">
                {winRows.map(({ label, value }) => (
                  <div key={label} className="prob-row">
                    <span className="prob-label">{label}</span>
                    <div className="prob-track">
                      {/* Bar width driven by the probability value (0–1). */}
                      <div className="prob-fill" style={{ width: `${value * 100}%` }} />
                    </div>
                    <span className="prob-pct">{(value * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Top 5 Players (by minutes) ── */}
            <section>
              <h3>Top Players</h3>
              <table className="players-table">
                <thead>
                  <tr><th>Name</th><th>Pos</th><th>Ht</th><th>Min</th><th>Pts</th><th>FT%</th></tr>
                </thead>
                <tbody>
                  {data.top_players.map(p => (
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

            {/* ── 3 Most Similar Historical Teams (from ChromaDB vector search) ── */}
            {data.similar_teams.length > 0 && (
              <section>
                <h3>Similar Teams</h3>
                <ul className="similar-list">
                  {data.similar_teams.map(t => (
                    <li key={`${t.name}-${t.year}`}>
                      <span className="sim-name">{t.name} ({t.year})</span>
                      <span className="sim-meta">
                        {t.tournament_wins} tourney {t.tournament_wins === 1 ? 'win' : 'wins'} · {(t.similarity * 100).toFixed(0)}% similar
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── AI-generated team summary ── */}
            {data.profile_summary && (
              <section>
                <h3>Summary</h3>
                <p className="popup-summary">{data.profile_summary}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
