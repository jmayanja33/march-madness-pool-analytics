// PowerRankings — displays all tournament teams grouped by their most likely
// win outcome (6 wins → 0 wins), ranked by probability within each section.
// Uses the same compact team card as the Create a Team page.
//
// Layout (top to bottom): Potential Champion → Potential Final Four →
// Potential Upsets → Projected 6 Wins → … → Projected 0 Wins.
// Each section has a numbered 2-column grid of lightweight team cards.
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
// Checks all seven buckets (0–6) and returns the one with the highest probability.
function getExpectedWins(dist) {
  const entries = [
    { winsText: '6 wins', prob: dist.six_wins   },
    { winsText: '5 wins', prob: dist.five_wins  },
    { winsText: '4 wins', prob: dist.four_wins  },
    { winsText: '3 wins', prob: dist.three_wins },
    { winsText: '2 wins', prob: dist.two_wins   },
    { winsText: '1 win',  prob: dist.one_win    },
    { winsText: '0 wins', prob: dist.zero_wins  },
  ];
  return entries.reduce((best, cur) => cur.prob > best.prob ? cur : best);
}

// ---------------------------------------------------------------------------
// Section definitions — controls order, title, and which data key to use.
// ---------------------------------------------------------------------------

// Section definitions — one per possible win outcome, ordered from most wins to fewest.
const SECTIONS = [
  { key: 'six_wins',   title: '6 Wins', bucketProb: t => t.win_probability_distribution.six_wins   },
  { key: 'five_wins',  title: '5 Wins', bucketProb: t => t.win_probability_distribution.five_wins  },
  { key: 'four_wins',  title: '4 Wins', bucketProb: t => t.win_probability_distribution.four_wins  },
  { key: 'three_wins', title: '3 Wins', bucketProb: t => t.win_probability_distribution.three_wins },
  { key: 'two_wins',   title: '2 Wins', bucketProb: t => t.win_probability_distribution.two_wins   },
  { key: 'one_win',    title: '1 Win',  bucketProb: t => t.win_probability_distribution.one_win    },
  { key: 'zero_wins',  title: '0 Wins', bucketProb: t => t.win_probability_distribution.zero_wins  },
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

  // Collapsed state for each section — keyed by section key + special sections.
  // All sections start expanded.
  const [collapsed, setCollapsed] = useState({
    six_wins:   false,
    five_wins:  false,
    four_wins:  false,
    three_wins: false,
    two_wins:   false,
    one_win:    false,
    zero_wins:  false,
    upsets:     false,
    finalFour:  false,
    champion:   false,
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

    // Build a combined name → team map from all seven win buckets.
    const teamMap = {};
    for (const bucket of ['six_wins', 'five_wins', 'four_wins', 'three_wins', 'two_wins', 'one_win', 'zero_wins']) {
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
        <p className="pr-page-sub">Projections for likely Champions, Final Four teams, upset bids, and win totals per team in the tournament</p>

        {/* Loading state */}
        {loading && <p className="pr-status">Loading rankings…</p>}

        {/* Error state */}
        {error && <p className="pr-error">{error}</p>}

        {/* Potential Champion, Final Four, and Upsets — shown at the top */}
        {rankings && (() => {
          // Gather all teams from every win bucket into a flat array.
          const allTeams = ['six_wins','five_wins','four_wins','three_wins','two_wins','one_win','zero_wins']
            .flatMap(bucket => rankings[bucket]);

          // Championship probability: P(6 wins) >= 5%.
          const championTeams = allTeams
            .map(t => ({ team: t, prob: t.win_probability_distribution.six_wins }))
            .filter(x => x.prob >= 0.05)
            .sort((a, b) => b.prob - a.prob);

          // Final Four probability: P(4 wins) + P(5 wins) + P(6 wins) >= 20%.
          const finalFourTeams = allTeams
            .map(t => {
              const d = t.win_probability_distribution;
              return { team: t, prob: d.four_wins + d.five_wins + d.six_wins };
            })
            .filter(x => x.prob >= 0.20)
            .sort((a, b) => b.prob - a.prob);

          return (
            <>
              {/* ── Potential Champion ── */}
              <section className="pr-section">
                <button
                  className="pr-section-header"
                  onClick={() => toggleSection('champion')}
                  aria-expanded={!collapsed.champion}
                >
                  <h2 className="pr-section-title">
                    Potential Champion{' '}
                    <span className="pr-section-count">({championTeams.length} {championTeams.length === 1 ? 'Team' : 'Teams'})</span>
                  </h2>
                  <span className={`pr-caret${collapsed.champion ? ' pr-caret--collapsed' : ''}`}>&#8964;</span>
                </button>

                {!collapsed.champion && (
                  <>
                    <p className="pr-section-sub">Teams with a 5%+ chance of winning the championship.</p>
                    {championTeams.length === 0 ? (
                      <p className="pr-empty">No teams meet this threshold.</p>
                    ) : (
                      <div className="pr-slots-grid">
                        {championTeams.map((x, i) => (
                          <ProspectCard
                            key={x.team.name}
                            rank={i + 1}
                            team={x.team}
                            probLabel="Championship Prob."
                            prob={x.prob}
                            onInfo={() => setPopupTeam(x.team.name)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* ── Potential Final Four ── */}
              <section className="pr-section">
                <button
                  className="pr-section-header"
                  onClick={() => toggleSection('finalFour')}
                  aria-expanded={!collapsed.finalFour}
                >
                  <h2 className="pr-section-title">
                    Potential Final Four{' '}
                    <span className="pr-section-count">({finalFourTeams.length} {finalFourTeams.length === 1 ? 'Team' : 'Teams'})</span>
                  </h2>
                  <span className={`pr-caret${collapsed.finalFour ? ' pr-caret--collapsed' : ''}`}>&#8964;</span>
                </button>

                {!collapsed.finalFour && (
                  <>
                    <p className="pr-section-sub">Teams with a 20%+ chance of reaching the Final Four.</p>
                    {finalFourTeams.length === 0 ? (
                      <p className="pr-empty">No teams meet this threshold.</p>
                    ) : (
                      <div className="pr-slots-grid">
                        {finalFourTeams.map((x, i) => (
                          <ProspectCard
                            key={x.team.name}
                            rank={i + 1}
                            team={x.team}
                            probLabel="Final Four Prob."
                            prob={x.prob}
                            onInfo={() => setPopupTeam(x.team.name)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          );
        })()}

        {/* Potential Upsets section — shown after rankings load */}
        {rankings && (
          <section className="pr-section">

            {/* Clickable section header with collapse caret */}
            <button
              className="pr-section-header"
              onClick={() => toggleSection('upsets')}
              aria-expanded={!collapsed.upsets}
            >
              <h2 className="pr-section-title">Potential Upsets{upsets !== null && <span className="pr-section-count"> ({upsets.length} {upsets.length === 1 ? 'Team' : 'Teams'})</span>}</h2>
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

        {/* Win bucket sections — projected wins from 6 down to 0 */}
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
                <h2 className="pr-section-title">Projected {title} <span className="pr-section-count">({teams.length} {teams.length === 1 ? 'Team' : 'Teams'})</span></h2>
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
// ProspectCard — compact numbered card for Final Four / Champion candidates.
// ---------------------------------------------------------------------------
// Shares the same layout as RankCard but replaces "Expected Wins" with a
// configurable probability label (e.g. "Final Four Prob." or "Championship Prob.").

function ProspectCard({ rank, team, probLabel, prob, onInfo }) {
  const region = getTeamRegion(team.name);
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

        {/* Colored probability with info button */}
        <div className="pr-slot-stat">
          <span className="pr-slot-stat-label">{probLabel}</span>
          <span className="pr-slot-stat-value" style={{ color }}>
            {(prob * 100).toFixed(2)}%
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
