// PowerRankings — displays all tournament teams grouped by their most likely
// win outcome (2+ wins, 1 win, 0 wins), ranked by probability within each
// section.  Uses the same compact team card as the Create a Team page.
//
// Layout: four stacked sections (top to bottom): 2 Wins → 1 Win → 0 Wins →
// Potential Upsets.  Each section has a numbered 2-column grid of lightweight
// team cards.
import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import TeamPopup from '../components/TeamPopup';
import { fetchPowerRankings, fetchH2H } from '../api/teamApi';
import { BRACKET_2026, FIRST_FOUR_2026 } from '../data/bracketData';
import { probColor } from '../utils/colors';
import './PowerRankings.css';

// ---------------------------------------------------------------------------
// Region lookup — build a map of teamName → region from the bracket data.
// ---------------------------------------------------------------------------

const TEAM_REGION_MAP = {};
for (const [region, teams] of Object.entries(BRACKET_2026)) {
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
// Upset candidate builder — finds every first-round underdog matchup.
//
// Standard first-round seed pairings: [favorite_seed, underdog_seed].
// The underdog always has the higher seed number (e.g. 16 > 1).
// ---------------------------------------------------------------------------

const FIRST_ROUND_PAIRS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

// Build the list of all potential upset candidates.
//
// For each region, pair teams by the standard first-round bracket matchups and
// collect the underdog (higher seed number) as a candidate.
//
// For First Four games: both teams in the game are evaluated against the R64
// opponent they would face if they advanced — as instructed by the spec.  The
// First Four winner already occupies a bracket slot (and is captured above);
// this loop adds only the "other" team from each First Four pair.
//
// teamMap: { teamName → PoolTeamSummary } built from all three rankings buckets.
// Returns an array of { teamName, opponentName, region } objects.
function buildUpsetCandidates(teamMap) {
  const candidates = [];
  const seen = new Set();

  // Process each region's first-round underdog matchups from the main bracket.
  for (const [region, teams] of Object.entries(BRACKET_2026)) {
    // Index bracket teams by seed for quick lookup.
    const bySeed = {};
    for (const t of teams) bySeed[t.seed] = t;

    for (const [favSeed, dogSeed] of FIRST_ROUND_PAIRS) {
      const fav = bySeed[favSeed];
      const dog = bySeed[dogSeed];

      // Only include teams present in the predictions data.
      if (fav && dog && teamMap[dog.name]) {
        const key = `${dog.name}|${fav.name}`;
        if (!seen.has(key)) {
          candidates.push({ teamName: dog.name, opponentName: fav.name, region });
          seen.add(key);
        }
      }
    }
  }

  // Add the "other" team from each First Four game (the team not in the bracket
  // winner slot), evaluated against the same R64 opponent the winner slot would face.
  for (const ff of FIRST_FOUR_2026) {
    const [ffRegion, ffSeedStr] = ff.destination.split(' ');
    const ffSeed = parseInt(ffSeedStr, 10);
    const regionTeams = BRACKET_2026[ffRegion];

    // Index region teams by seed.
    const bySeed = {};
    for (const t of regionTeams) bySeed[t.seed] = t;

    // Find which pair contains this seed (as the underdog).
    const pair = FIRST_ROUND_PAIRS.find(p => p[1] === ffSeed);
    if (!pair) continue;

    // Get the R64 favorite (the team the winner slot would face).
    const favSeed = pair[0];
    const opp = bySeed[favSeed];
    if (!opp) continue;

    // The team currently occupying the winner slot in the bracket.
    const winnerSlotTeam = bySeed[ffSeed];
    if (!winnerSlotTeam) continue;

    // Add the team that is NOT the bracket winner slot.
    for (const ffTeam of [ff.teamA, ff.teamB]) {
      if (ffTeam.name !== winnerSlotTeam.name && teamMap[ffTeam.name]) {
        const key = `${ffTeam.name}|${opp.name}`;
        if (!seen.has(key)) {
          candidates.push({ teamName: ffTeam.name, opponentName: opp.name, region: ffRegion });
          seen.add(key);
        }
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PowerRankings() {
  useEffect(() => { document.title = 'The Pool | Power Rankings'; }, []);

  // Power rankings data from the API — keyed by two_wins / one_win / zero_wins.
  const [rankings, setRankings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Sorted array of upset candidates after h2h probabilities are resolved.
  // Each entry: { team, opponentName, region, winProb }
  const [upsets, setUpsets]       = useState(null);

  // Name of the team whose full TeamCard popup is currently open, or null.
  const [popupTeam, setPopupTeam] = useState(null);

  // Collapsed state for each section — keyed by section key + 'upsets'.
  // All sections start expanded.
  const [collapsed, setCollapsed] = useState({
    two_wins: false,
    one_win:  false,
    zero_wins: false,
    upsets:   false,
  });

  // Toggle a single section's collapsed state by key.
  function toggleSection(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Fetch rankings on mount.
  useEffect(() => {
    fetchPowerRankings()
      .then(setRankings)
      .catch(() => setError('Could not load power rankings. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  // Once rankings load, identify potential upsets via h2h probabilities.
  useEffect(() => {
    if (!rankings) return;

    // Build a combined name → team map from all three win buckets.
    const teamMap = {};
    for (const bucket of ['two_wins', 'one_win', 'zero_wins']) {
      for (const t of rankings[bucket]) {
        teamMap[t.name] = t;
      }
    }

    const candidates = buildUpsetCandidates(teamMap);

    // Fetch h2h win probabilities for all candidates in parallel.
    // fetchH2H(team1, team2) always returns team1 = the first argument.
    Promise.allSettled(
      candidates.map(c =>
        fetchH2H(c.teamName, c.opponentName).then(data => ({
          team: teamMap[c.teamName],
          opponentName: c.opponentName,
          region: c.region,
          winProb: data.team1.win_probability,
        }))
      )
    ).then(results => {
      // Keep only teams with >= 40% win probability, sorted descending.
      const upsetList = results
        .filter(r => r.status === 'fulfilled' && r.value.winProb >= 0.4)
        .map(r => r.value)
        .sort((a, b) => b.winProb - a.winProb);

      setUpsets(upsetList);
    }).catch(() => {
      // Fallback: if the .then() callback itself throws, ensure upsets is
      // set to an empty array so the section stops showing "Loading…".
      setUpsets([]);
    });
  }, [rankings]);

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
          const isCollapsed = collapsed[key];
          return (
            <section key={key} className="pr-section">

              {/* Clickable section header with collapse caret */}
              <button
                className="pr-section-header"
                onClick={() => toggleSection(key)}
                aria-expanded={!isCollapsed}
              >
                <h2 className="pr-section-title">{title}</h2>
                <span className={`pr-caret${isCollapsed ? ' pr-caret--collapsed' : ''}`}>&#8964;</span>
              </button>

              {/* Section body — hidden when collapsed */}
              {!isCollapsed && (
                teams.length === 0 ? (
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
                )
              )}
            </section>
          );
        })}

        {/* Potential Upsets section — shown after h2h data resolves */}
        {rankings && (
          <section className="pr-section">

            {/* Clickable section header with collapse caret */}
            <button
              className="pr-section-header"
              onClick={() => toggleSection('upsets')}
              aria-expanded={!collapsed.upsets}
            >
              <h2 className="pr-section-title">Potential Upsets</h2>
              <span className={`pr-caret${collapsed.upsets ? ' pr-caret--collapsed' : ''}`}>&#8964;</span>
            </button>

            {/* Section body — hidden when collapsed */}
            {!collapsed.upsets && (
              <>
                <p className="pr-section-sub">
                  Higher-seeded teams with a 40%+ chance of beating their Round of 64 opponent.
                </p>

                {/* Loading state for upsets — h2h calls still in flight */}
                {upsets === null && (
                  <p className="pr-status">Loading upset probabilities…</p>
                )}

                {upsets !== null && upsets.length === 0 && (
                  <p className="pr-empty">No potential upsets found.</p>
                )}

                {upsets !== null && upsets.length > 0 && (
                  <div className="pr-slots-grid">
                    {upsets.map((u, i) => (
                      <UpsetCard
                        key={u.team.name}
                        rank={i + 1}
                        team={u.team}
                        opponentName={u.opponentName}
                        region={u.region}
                        winProb={u.winProb}
                        onInfo={() => setPopupTeam(u.team.name)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
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

// ---------------------------------------------------------------------------
// UpsetCard — compact numbered card for a potential upset candidate.
// ---------------------------------------------------------------------------
// Identical layout to RankCard but replaces "Expected Wins" with
// "First Round Win Probability" showing the team's h2h win chance.

function UpsetCard({ rank, team, opponentName, region, winProb, onInfo }) {
  const color = probColor(winProb);

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

        {/* Opponent — who they'd be upsetting */}
        <div className="pr-slot-stat">
          <span className="pr-slot-stat-label">Opponent</span>
          <span className="pr-slot-stat-value">{opponentName}</span>
        </div>

        {/* First round win probability with colored value + info button */}
        <div className="pr-slot-stat">
          <span className="pr-slot-stat-label">First Round Win Prob.</span>
          <span className="pr-slot-stat-value" style={{ color }}>
            {(winProb * 100).toFixed(2)}%
          </span>
          <button className="pr-slot-info-btn" onClick={onInfo} title="View team details">ⓘ</button>
        </div>
      </div>
    </div>
  );
}
