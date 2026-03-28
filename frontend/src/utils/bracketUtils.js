// Utility for deriving bracket results from the API response.
//
// The bracket components expect a results object shaped like RESULTS_2026 in
// bracketData.js — per-region arrays (r64Winners, r32, r32Winners, s16,
// s16Winners, e8, e8Winners, f4) plus a firstFour winners map and an optional
// finalFour object.  The API returns a flat list of rounds with games instead,
// so this module transforms that shape into what the bracket needs.

// Maps the numerically lower seed in a Round-of-64 matchup to its bracket slot
// index (0–7) within a region.  Lower seed = higher-ranked team.
//
// Slot ordering mirrors FIRST_ROUND_SEEDS in BracketRegion.jsx:
//   [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]
//   pairs: (1,16)→0  (8,9)→1  (5,12)→2  (4,13)→3
//          (6,11)→4  (3,14)→5  (7,10)→6  (2,15)→7
const LOWER_SEED_TO_SLOT = { 1: 0, 8: 1, 5: 2, 4: 3, 6: 4, 3: 5, 7: 6, 2: 7 };

/**
 * Transforms a ResultsResponse from the API into the bracket results format
 * expected by Bracket.jsx and BracketRegion.jsx.
 *
 * @param {Object} apiData   - Raw ResultsResponse from fetchResults()
 * @param {Object} bracket   - BRACKET_2026: { East, West, South, Midwest } team arrays
 * @param {Array}  firstFour - FIRST_FOUR_2026: array of First Four game descriptors
 * @returns {Object} Results object shaped like RESULTS_2026 in bracketData.js,
 *                   or null if no matching tournament is found.
 */
export function transformAPIResults(apiData, bracket, firstFour) {
  // Find the 2026 tournament entry in the API response
  const tournament = apiData?.tournaments?.find(t => t.year === 2026);
  if (!tournament) return null;

  // ── Build team-to-region and team-to-seed lookups from the bracket data ──
  // These let us identify which region a team belongs to when processing games.
  const teamToRegion = {};
  const teamToSeed   = {};
  Object.entries(bracket).forEach(([region, teams]) => {
    teams.forEach(({ name, seed }) => {
      teamToRegion[name] = region;
      teamToSeed[name]   = seed;
    });
  });
  // Also add the raw First Four teams (losers aren't in BRACKET_2026)
  firstFour.forEach(({ teamA, teamB }) => {
    teamToSeed[teamA.name] = teamA.seed;
    teamToSeed[teamB.name] = teamB.seed;
  });

  // ── Initialize per-region result structures ────────────────────────────────
  const REGIONS = ['East', 'West', 'South', 'Midwest'];
  const regionData = {};
  REGIONS.forEach(r => {
    regionData[r] = {
      r64Winners: [],
      r32:        Array(8).fill(null),
      r32Winners: [],
      s16:        Array(4).fill(null),
      s16Winners: [],
      e8:         Array(2).fill(null),
      e8Winners:  [],
      f4:         null,
    };
  });

  // ── Helper: look up a round by name ───────────────────────────────────────
  const getRound = name => tournament.rounds.find(r => r.name === name);

  // ── First Four ─────────────────────────────────────────────────────────────
  // Build a map of { [firstFourId]: winnerName } for the First Four band.
  const ffWinners = {};
  const ffRound = getRound('First Four');
  if (ffRound) {
    ffRound.games.forEach(game => {
      // Match the game to its FIRST_FOUR_2026 entry by checking team names
      const entry = firstFour.find(
        ff =>
          ff.teamA.name === game.team1.name || ff.teamA.name === game.team2.name ||
          ff.teamB.name === game.team1.name || ff.teamB.name === game.team2.name,
      );
      if (entry) {
        ffWinners[entry.id] = game.winner;
        // The winning First Four team may not be in the main bracket lookup
        // (BRACKET_2026 holds the actual winner by name, so it is already there),
        // but ensure the loser's region/seed don't pollute later lookups.
      }
    });
  }

  // nameToR32Slot tracks where each R64 winner sits in the r32 array.
  // Shape: { [teamName]: { region: string, slot: number } }
  // Used to determine S16 slot when processing R32 games.
  const nameToR32Slot = {};

  // ── Round of 64 ────────────────────────────────────────────────────────────
  const r64Round = getRound('Round of 64');
  if (r64Round) {
    r64Round.games.forEach(game => {
      // Identify the region — both teams in a R64 game are in the same region
      const region = teamToRegion[game.team1.name] ?? teamToRegion[game.team2.name];
      if (!region) return;

      // Determine bracket slot from the lower (higher-ranked) seed in the matchup
      const lowerSeed = Math.min(game.team1.seed, game.team2.seed);
      const slot = LOWER_SEED_TO_SLOT[lowerSeed];
      if (slot === undefined) return;

      const rd = regionData[region];
      rd.r64Winners.push(game.winner);
      rd.r32[slot] = game.winner;
      nameToR32Slot[game.winner] = { region, slot };
    });
  }

  // ── Round of 32 ────────────────────────────────────────────────────────────
  // S16 slot = floor(r32 slot / 2): slots 0,1 → S16[0]; 2,3 → S16[1]; etc.
  const r32Round = getRound('Round of 32');
  if (r32Round) {
    r32Round.games.forEach(game => {
      // Both teams are R64 winners — look up either to get region + r32 slot
      const info =
        nameToR32Slot[game.team1.name] ?? nameToR32Slot[game.team2.name];
      if (!info) return;

      const { region, slot: r32Slot } = info;
      const s16Slot = Math.floor(r32Slot / 2);
      const rd = regionData[region];
      rd.r32Winners.push(game.winner);
      rd.s16[s16Slot] = game.winner;
    });
  }

  // Build nameToS16Slot from the s16 arrays now that R32 is fully processed.
  // Shape: { [teamName]: { region: string, slot: number } }
  const nameToS16Slot = {};
  REGIONS.forEach(region => {
    regionData[region].s16.forEach((name, slot) => {
      if (name) nameToS16Slot[name] = { region, slot };
    });
  });

  // ── Sweet Sixteen ──────────────────────────────────────────────────────────
  // E8 slot = floor(s16 slot / 2): slots 0,1 → E8[0]; 2,3 → E8[1].
  const s16Round = getRound('Sweet Sixteen');
  if (s16Round) {
    s16Round.games.forEach(game => {
      const info =
        nameToS16Slot[game.team1.name] ?? nameToS16Slot[game.team2.name];
      if (!info) return;

      const { region, slot: s16Slot } = info;
      const e8Slot = Math.floor(s16Slot / 2);
      const rd = regionData[region];
      rd.s16Winners.push(game.winner);
      rd.e8[e8Slot] = game.winner;
    });
  }

  // Build nameToE8Slot from the e8 arrays now that S16 is fully processed.
  const nameToE8Slot = {};
  REGIONS.forEach(region => {
    regionData[region].e8.forEach((name, slot) => {
      if (name) nameToE8Slot[name] = { region, slot };
    });
  });

  // ── Elite Eight ────────────────────────────────────────────────────────────
  // The E8 winner becomes the regional champion (f4).
  const e8Round = getRound('Elite Eight');
  if (e8Round) {
    e8Round.games.forEach(game => {
      const info =
        nameToE8Slot[game.team1.name] ?? nameToE8Slot[game.team2.name];
      if (!info) return;

      const { region } = info;
      const rd = regionData[region];
      rd.e8Winners.push(game.winner);
      rd.f4 = game.winner;
    });
  }

  // ── Final Four & National Championship ────────────────────────────────────
  // Bracket.jsx expects results.finalFour = { semi1, semi2, champion } where
  // each semi has { teamA, teamB, winner }.  Game order in the JSON is assumed
  // to be semi1 (East/Midwest) then semi2 (West/South), matching the bracket
  // layout.
  let finalFour = null;
  const f4Round   = getRound('Final Four');
  const champRound = getRound('National Championship');
  if (f4Round && f4Round.games.length >= 2) {
    const semi1 = f4Round.games[0];
    const semi2 = f4Round.games[1];
    finalFour = {
      semi1: {
        teamA:  semi1.team1.name,
        teamB:  semi1.team2.name,
        winner: semi1.winner ?? '',
      },
      semi2: {
        teamA:  semi2.team1.name,
        teamB:  semi2.team2.name,
        winner: semi2.winner ?? '',
      },
      champion: champRound?.games[0]?.winner ?? '',
    };
  }

  // ── Assemble and return the final results object ───────────────────────────
  return {
    firstFour: ffWinners,
    ...regionData,
    ...(finalFour ? { finalFour } : {}),
  };
}
