// PowerRankings — displays all tournament teams grouped by their most likely
// win outcome (2+ wins, 1 win, 0 wins), ranked by probability within each
// section.  Uses the same compact team card as the Create a Team page.
//
// Layout: three stacked sections (top to bottom): 2 Wins → 1 Win → 0 Wins.
// Each section has a numbered 2-column grid of lightweight team cards.
import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import TeamPopup from '../components/TeamPopup';
import { fetchPowerRankings } from '../api/teamApi';
import { BRACKET_2025 } from '../data/bracketData';
import { probColor } from '../utils/colors';
import './PowerRankings.css';

// ---------------------------------------------------------------------------
// Region lookup — build a map of teamName → region from the bracket data.
// ---------------------------------------------------------------------------

const TEAM_REGION_MAP = {};
for (const [region, teams] of Object.entries(BRACKET_2025)) {
  for (const team of teams) {
    TEAM_REGION_MAP[team.name] = region;
  }
}

function getTeamRegion(teamName) {
  return TEAM_REGION_MAP[teamName] ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// Expected-wins helper — returns the probability for the team's win bucket.
// ---------------------------------------------------------------------------

// Return the probability and label for the team's most likely win outcome.
function getExpectedWins(dist) {
  const { zero_wins, one_win, two_plus_wins } = dist;
  const maxProb = Math.max(zero_wins, one_win, two_plus_wins);

  if (maxProb === two_plus_wins) return { prob: two_plus_wins, winsText: '2+ wins' };
  if (maxProb === one_win)       return { prob: one_win,       winsText: '1 win'   };
  return                                { prob: zero_wins,     winsText: '0 wins'  };
}

// ---------------------------------------------------------------------------
// Section definitions — controls order, title, and which data key to use.
// ---------------------------------------------------------------------------

const SECTIONS = [
  { key: 'two_wins',   title: '2+ Wins', bucketProb: t => t.win_probability_distribution.two_plus_wins },
  { key: 'one_win',    title: '1 Win',   bucketProb: t => t.win_probability_distribution.one_win       },
  { key: 'zero_wins',  title: '0 Wins',  bucketProb: t => t.win_probability_distribution.zero_wins     },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PowerRankings() {
  useEffect(() => { document.title = 'The Pool | Power Rankings'; }, []);

  // Power rankings data from the API — keyed by two_wins / one_win / zero_wins.
  const [rankings, setRankings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Name of the team whose full TeamCard popup is currently open, or null.
  const [popupTeam, setPopupTeam] = useState(null);

  // Fetch rankings on mount.
  useEffect(() => {
    fetchPowerRankings()
      .then(setRankings)
      .catch(() => setError('Could not load power rankings. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pr-page">
      <NavBar />

      <div className="pr-body">
        <h1 className="pr-page-title">Power Rankings</h1>

        {/* Loading state */}
        {loading && <p className="pr-status">Loading rankings…</p>}

        {/* Error state */}
        {error && <p className="pr-error">{error}</p>}

        {/* Rankings content — three stacked sections */}
        {rankings && SECTIONS.map(({ key, title, bucketProb }) => {
          const teams = rankings[key];
          return (
            <section key={key} className="pr-section">

              {/* Section header — e.g. "2 Wins" */}
              <h2 className="pr-section-title">{title}</h2>

              {teams.length === 0 ? (
                <p className="pr-empty">No teams in this category.</p>
              ) : (
                <div className="pr-slots-grid">
                  {teams.map((team, i) => (
                    <RankCard
                      key={team.name}
                      rank={i + 1}
                      team={team}
                      bucketProb={bucketProb(team)}
                      onInfo={() => setPopupTeam(team.name)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Full team detail popup — opened by the ⓘ button on any card */}
      {popupTeam && (
        <TeamPopup teamName={popupTeam} onClose={() => setPopupTeam(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RankCard — compact numbered card for a single ranked team
// ---------------------------------------------------------------------------
// Mirrors the TeamSlotCard in CreateTeam but adds a rank badge and removes
// the remove button since this is a read-only view.

function RankCard({ rank, team, bucketProb, onInfo }) {
  const region = getTeamRegion(team.name);
  const { winsText, prob } = getExpectedWins(team.win_probability_distribution);
  const color = probColor(prob);

  return (
    <div className="pr-slot-card fade-in">
      {/* Rank number badge — top-left corner */}
      <span className="pr-rank-badge">{rank}</span>

      {/* Team logo */}
      <img
        src={`/logos/${team.name}.png`}
        alt={`${team.name} logo`}
        className="pr-slot-logo"
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />

      {/* Team identity and stats */}
      <div className="pr-slot-info">
        <div className="pr-slot-name">
          <span className="pr-slot-seed">#{team.seed}</span>
          <span className="pr-slot-teamname">{team.name}</span>
          <span className="pr-slot-conf">{team.conference}</span>
        </div>

        {/* Region */}
        <div className="pr-slot-stat">
          <span className="pr-slot-stat-label">Region</span>
          <span className="pr-slot-stat-value">{region}</span>
        </div>

        {/* Expected wins with colored probability + info button */}
        <div className="pr-slot-stat">
          <span className="pr-slot-stat-label">Expected Wins</span>
          <span className="pr-slot-stat-value" style={{ color }}>
            {winsText}
            <span className="pr-slot-prob"> ({(bucketProb * 100).toFixed(2)}% likely)</span>
          </span>
          <button className="pr-slot-info-btn" onClick={onInfo} title="View team details">ⓘ</button>
        </div>
      </div>
    </div>
  );
}
