import { useEffect, useState } from 'react';
import { fetchTeamData } from '../api/teamApi';
import './TeamPopup.css';

export default function TeamPopup({ teamName, onClose }) {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamData(teamName)
      .then(setData)
      .catch(() => setError('Could not load team data.'))
      .finally(() => setLoading(false));
  }, [teamName]);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup pop-in" onClick={e => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose}>✕</button>

        {loading && <div className="popup-loading"><span className="spinner" />Loading…</div>}
        {error   && <div className="popup-error">{error}</div>}

        {data && (
          <div className="popup-content">
            <h2 className="popup-team-name">{data.name}</h2>
            <p className="popup-record">{data.wins}–{data.losses}</p>

            <section>
              <h3>Win Probability</h3>
              <div className="prob-bars">
                {Object.entries(data.win_distribution).map(([label, pct]) => (
                  <div key={label} className="prob-row">
                    <span className="prob-label">{label}</span>
                    <div className="prob-track">
                      <div className="prob-fill" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="prob-pct">{(pct * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </section>

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
                      <td>{p.ft_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3>Similar Teams</h3>
              <ul className="similar-list">
                {data.similar_teams.map(t => (
                  <li key={t.name}>
                    <span className="sim-name">{t.name}</span>
                    <span className="sim-meta">{t.wins} tournament wins · {(t.similarity * 100).toFixed(0)}% similar</span>
                  </li>
                ))}
              </ul>
            </section>

            {data.summary && (
              <section>
                <h3>Summary</h3>
                <p className="popup-summary">{data.summary}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
