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
  // each semi has { teamA, teamB, winner }.
  //
  // F4 participants (teamA/teamB) are always the regional champs from E8 results,
  // so the F4 section populates as soon as the Elite Eight is complete — before
  // the F4 games are actually played.  Winners are only filled in once the F4
  // round exists in the API response.
  //
  // Pairing: East vs South (semi1), Midwest vs West (semi2).
  const f4Round    = getRound('Final Four');
  const champRound = getRound('National Championship');

  const eastChamp    = regionData.East.f4    ?? '';
  const southChamp   = regionData.South.f4   ?? '';
  const midwestChamp = regionData.Midwest.f4 ?? '';
  const westChamp    = regionData.West.f4    ?? '';

  let finalFour = null;

  // Build finalFour whenever at least one regional champ is known.
  if (eastChamp || southChamp || midwestChamp || westChamp) {
    // Match each actual F4 game to the correct pairing by checking whether one
    // of the participants is the East or South champ (semi1) vs Midwest or West (semi2).
    let semi1Winner = '';
    let semi2Winner = '';
    for (const game of f4Round?.games ?? []) {
      const t1 = game.team1.name;
      const t2 = game.team2.name;
      if (t1 === eastChamp || t2 === eastChamp || t1 === southChamp || t2 === southChamp) {
        semi1Winner = game.winner ?? '';
      } else {
        semi2Winner = game.winner ?? '';
      }
    }

    finalFour = {
      semi1: { teamA: eastChamp,    teamB: southChamp,   winner: semi1Winner },
      semi2: { teamA: midwestChamp, teamB: westChamp,    winner: semi2Winner },
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

/**
 * Transforms most-likely-bracket.json + live results into a predicted bracket
 * results object with per-slot coloring based on the following rules:
 *
 *   For each game that has been played:
 *     1. Predicted winner WON     → highlight them GREEN.
 *     2. Predicted winner was IN the game but LOST
 *                                 → highlight the predicted winner RED.
 *     3. Predicted winner was NOT in the game (eliminated earlier)
 *                                 → highlight the actual winner RED.
 *   For games not yet played, no slot is highlighted.
 *
 * Presence of firstFourStatus on the returned object signals predicted mode
 * to Bracket.jsx and BracketRegion.jsx.
 *
 * @param {Object}      predictedData - Content of most-likely-bracket.json
 * @param {Object|null} liveResults   - Output of transformAPIResults(), or null
 * @param {Object}      bracket       - BRACKET_2026 { East, West, South, Midwest }
 * @param {Array}       firstFour     - FIRST_FOUR_2026 game descriptors
 * @returns {Object} Predicted results with status fields + accuracy stats
 */
export function transformPredictedBracket(predictedData, liveResults, bracket, firstFour) {
  // ── Helper: determine which team to display and its status for a slot ─────
  //
  // Rules (applied only when a game has been played):
  //   Rule 1 — predicted won:               displayName = predictedWinner, status = 'correct'
  //   Rule 2 — predicted was in game, lost:  displayName = predictedWinner, status = 'incorrect'
  //   Rule 3 — predicted wasn't in game:     displayName = predictedWinner, status = 'incorrect'
  //
  // Rules 2 and 3 both show the predicted winner in red, keeping the bracket
  // populated only with predicted teams.  Introducing the actual winner in Rule 3
  // causes confusing "ghost" teams to appear in later-round slots.
  //
  // @param {string}      predictedWinner - Who the model predicted to win
  // @param {string|null} actualWinner    - Who actually won (null if not played)
  // @param {string|null} actualP1        - Actual participant 1 (null if unknown)
  // @param {string|null} actualP2        - Actual participant 2 (null if unknown)
  // @returns {{ displayName: string, status: 'correct'|'incorrect'|'pending' }}
  function colorSlot(predictedWinner, actualWinner, actualP1, actualP2) {
    if (!actualWinner) return { displayName: predictedWinner ?? '', status: 'pending' };
    if (actualWinner === predictedWinner) return { displayName: predictedWinner, status: 'correct' };
    // Incorrect prediction (predicted was in game or was already eliminated) —
    // always display the predicted winner in red so no unexpected teams appear.
    return { displayName: predictedWinner ?? '', status: 'incorrect' };
  }

  // ── Accuracy counters ─────────────────────────────────────────────────────
  let totalPlayed = 0;
  let correct     = 0;
  function trackStatus(status) {
    if (status !== 'pending') totalPlayed++;
    if (status === 'correct') correct++;
  }

  // ── Build teamToSeed lookup ───────────────────────────────────────────────
  const teamToSeed = {};
  Object.values(bracket).forEach(region => {
    region.forEach(({ name, seed }) => { teamToSeed[name] = seed; });
  });
  firstFour.forEach(({ teamA, teamB }) => {
    teamToSeed[teamA.name] = teamA.seed;
    teamToSeed[teamB.name] = teamB.seed;
  });

  // ── First Four ────────────────────────────────────────────────────────────
  // Case 3 cannot occur for FF (both teams are always the actual participants).
  // predictedFFWinners stores the predicted winner so Bracket.jsx knows which
  // slot to color; firstFourStatus carries the color status.
  const predictedFFWinners = {}; // { [ffId]: predictedWinnerName }
  const firstFourStatus    = {}; // { [ffId]: status } — presence signals predicted mode

  (predictedData.first_four ?? []).forEach(game => {
    const entry = firstFour.find(ff =>
      ff.teamA.name === game.team1 || ff.teamA.name === game.team2 ||
      ff.teamB.name === game.team1 || ff.teamB.name === game.team2,
    );
    if (!entry) return;

    const actualWinner = liveResults?.firstFour?.[entry.id] ?? null;
    // actualP1/P2 are the two FF participants (same as game.team1/team2)
    const { status } = colorSlot(game.winner, actualWinner, game.team1, game.team2);

    // The coloring is always applied to the predicted winner's slot
    predictedFFWinners[entry.id] = game.winner;
    firstFourStatus[entry.id]    = status;
    trackStatus(status);
  });

  // ── Per-region data ────────────────────────────────────────────────────────
  // r64Status is an object (not an array) keyed by team name — its presence on
  // the results object is the signal BracketRegion uses to enter predicted mode.
  const REGIONS = ['East', 'West', 'South', 'Midwest'];
  const regionData = {};
  REGIONS.forEach(r => {
    regionData[r] = {
      r64Winners: [],
      r64Status:  {},   // { teamName → status } for R1 — presence signals predicted mode
      r32:        Array(8).fill(null),
      r32Status:  {},   // { teamName → status } for R2 — one entry per R32 game
      r32Winners: [],
      s16:        Array(4).fill(null),
      s16Status:  {},   // { teamName → status } for S16 — one entry per S16 game
      s16Winners: [],
      e8:         Array(2).fill(null),
      e8Status:   {},   // { teamName → status } for E8 — one entry per E8 game
      e8Winners:  [],
      f4:         null,
      f4Status:   'pending',
    };
  });

  // Slot-position maps track predicted winners across rounds (for game lookup).
  // These always use the PREDICTED winner name, not the display name, so that
  // each round's predicted game can be found even after an incorrect prediction.
  const nameToR32Slot = {}; // { [predictedWinner]: { region, slot } }
  const nameToS16Slot = {};
  const nameToE8Slot  = {};

  // ── Round of 64 ───────────────────────────────────────────────────────────
  // Case 3 cannot occur here — both teams are always the actual R64 participants
  // (the bracket seedings are fixed). Rule 2 applies when an upset happens.
  (predictedData.round_of_64 ?? []).forEach(game => {
    const region = game.region;
    const rd     = regionData[region];
    if (!rd) return;

    const seed1 = teamToSeed[game.team1] ?? 99;
    const seed2 = teamToSeed[game.team2] ?? 99;
    const slot  = LOWER_SEED_TO_SLOT[Math.min(seed1, seed2)];
    if (slot === undefined) return;

    // Actual R64 winner = who advanced to R32 in the live bracket
    const actualWinner = liveResults?.[region]?.r32?.[slot] ?? null;
    const { displayName, status } = colorSlot(game.winner, actualWinner, game.team1, game.team2);

    // r64Status maps the highlighted team so BracketRegion colors the right R1 slot.
    // For Rule 1: displayName = predicted winner (green). For Rule 2: displayName =
    // predicted winner (red — the team that lost).
    if (status !== 'pending') rd.r64Status[displayName] = status;

    // r32[slot] = who is shown in the R2 column for this bracket position.
    // R2 slot coloring comes from R32 game results (r32Status), not R64 results.
    rd.r64Winners.push(displayName);
    rd.r32[slot] = displayName;
    trackStatus(status);

    // Always track predicted winner (not displayName) for R32 game lookup.
    nameToR32Slot[game.winner] = { region, slot };
  });

  // ── Round of 32 ───────────────────────────────────────────────────────────
  // Actual participants = the two actual R64 winners feeding into this R32 game.
  (predictedData.round_of_32 ?? []).forEach(game => {
    const info = nameToR32Slot[game.team1] ?? nameToR32Slot[game.team2];
    if (!info) return;

    const { region, slot: r32Slot } = info;
    const s16Slot = Math.floor(r32Slot / 2);
    const rd      = regionData[region];

    // Actual R32 participants are the two R64 winners for this slot pair.
    const actualP1     = liveResults?.[region]?.r32?.[s16Slot * 2]     ?? null;
    const actualP2     = liveResults?.[region]?.r32?.[s16Slot * 2 + 1] ?? null;
    const actualWinner = liveResults?.[region]?.s16?.[s16Slot]          ?? null;

    const { displayName, status } = colorSlot(game.winner, actualWinner, actualP1, actualP2);

    rd.r32Winners.push(displayName);
    rd.s16[s16Slot] = displayName;
    if (status !== 'pending') rd.r32Status[displayName] = status;
    trackStatus(status);

    nameToS16Slot[game.winner] = { region, slot: s16Slot };
  });

  // ── Sweet Sixteen ─────────────────────────────────────────────────────────
  // Actual participants = the two actual R32 winners feeding into this S16 game.
  (predictedData.sweet_16 ?? []).forEach(game => {
    const info = nameToS16Slot[game.team1] ?? nameToS16Slot[game.team2];
    if (!info) return;

    const { region, slot: s16Slot } = info;
    const e8Slot = Math.floor(s16Slot / 2);
    const rd     = regionData[region];

    const actualP1     = liveResults?.[region]?.s16?.[e8Slot * 2]     ?? null;
    const actualP2     = liveResults?.[region]?.s16?.[e8Slot * 2 + 1] ?? null;
    const actualWinner = liveResults?.[region]?.e8?.[e8Slot]           ?? null;

    const { displayName, status } = colorSlot(game.winner, actualWinner, actualP1, actualP2);

    rd.s16Winners.push(displayName);
    rd.e8[e8Slot] = displayName;
    if (status !== 'pending') rd.s16Status[displayName] = status;
    trackStatus(status);

    nameToE8Slot[game.winner] = { region, slot: e8Slot };
  });

  // ── Elite Eight ───────────────────────────────────────────────────────────
  // Actual participants = the two actual S16 winners in this region's final.
  (predictedData.elite_8 ?? []).forEach(game => {
    const info = nameToE8Slot[game.team1] ?? nameToE8Slot[game.team2];
    if (!info) return;

    const { region } = info;
    const rd = regionData[region];

    const actualP1     = liveResults?.[region]?.e8?.[0] ?? null;
    const actualP2     = liveResults?.[region]?.e8?.[1] ?? null;
    const actualWinner = liveResults?.[region]?.f4       ?? null;

    const { displayName, status } = colorSlot(game.winner, actualWinner, actualP1, actualP2);

    rd.e8Winners.push(displayName);
    rd.f4       = displayName;
    rd.f4Status = status;
    if (status !== 'pending') rd.e8Status[displayName] = status;
    trackStatus(status);
  });

  // ── Final Four + Championship ─────────────────────────────────────────────
  // The bracket pairs East vs South in one semifinal and Midwest vs West in the
  // other (matching the predicted JSON and the visual bracket layout where East
  // and South are on the left side, Midwest and West on the right side).
  //
  // Because the API returns F4 games in game-number order (not region-pair order),
  // we match each predicted semifinal to the correct actual F4 game by looking
  // for the game whose participants include the two actual regional champs.
  let finalFour       = null;
  let finalFourStatus = null;

  const f4Games   = predictedData.final_four ?? [];
  const champGame = predictedData.championship ?? null;

  if (f4Games.length >= 2) {
    const semi1 = f4Games[0]; // predicted: East vs South
    const semi2 = f4Games[1]; // predicted: Midwest vs West

    // Helper: find the actual F4 game that contains both given regional champs.
    // Returns null if the champs haven't advanced or data isn't available yet.
    function findActualF4Game(champ1, champ2) {
      if (!liveResults?.finalFour || !champ1 || !champ2) return null;
      for (const semi of [liveResults.finalFour.semi1, liveResults.finalFour.semi2]) {
        if (!semi) continue;
        const hasChamp1 = semi.teamA === champ1 || semi.teamB === champ1;
        const hasChamp2 = semi.teamA === champ2 || semi.teamB === champ2;
        if (hasChamp1 && hasChamp2) return semi;
      }
      return null;
    }

    // Actual regional champs (from live E8 results) used to locate actual F4 games.
    const liveEastChamp    = liveResults?.East?.f4    ?? null;
    const liveSouthChamp   = liveResults?.South?.f4   ?? null;
    const liveMidwestChamp = liveResults?.Midwest?.f4 ?? null;
    const liveWestChamp    = liveResults?.West?.f4    ?? null;

    const actualS1 = findActualF4Game(liveEastChamp, liveSouthChamp);
    const actualS2 = findActualF4Game(liveMidwestChamp, liveWestChamp);

    const { displayName: s1Winner, status: s1Status } = colorSlot(
      semi1.winner,
      actualS1?.winner || null,
      actualS1?.teamA  || null,
      actualS1?.teamB  || null,
    );
    const { displayName: s2Winner, status: s2Status } = colorSlot(
      semi2.winner,
      actualS2?.winner || null,
      actualS2?.teamA  || null,
      actualS2?.teamB  || null,
    );

    // Championship actual participants = winners of each semifinal.
    const { displayName: champion, status: cStatus } = colorSlot(
      champGame?.winner ?? '',
      liveResults?.finalFour?.champion || null,
      actualS1?.winner || null,
      actualS2?.winner || null,
    );

    trackStatus(s1Status);
    trackStatus(s2Status);
    trackStatus(cStatus);

    // teamA/teamB use merged E8 display names (regionData.*.f4) so each F4
    // participant slot shows the correct team with the correct color.
    // Pairing: semi1 = East vs South, semi2 = Midwest vs West.
    finalFour = {
      semi1: { teamA: regionData.East.f4    ?? '', teamB: regionData.South.f4   ?? '', winner: s1Winner },
      semi2: { teamA: regionData.Midwest.f4 ?? '', teamB: regionData.West.f4    ?? '', winner: s2Winner },
      champion,
    };

    finalFourStatus = {
      // F4 participant slots are left uncolored until the F4 games are played.
      // The E8 result is already shown in the E8 column — repeating it here
      // makes the F4 section appear scored before any game has been played.
      semi1TeamA: 'pending',
      semi1TeamB: 'pending',
      semi2TeamA: 'pending',
      semi2TeamB: 'pending',
      // Championship slot statuses = was the predicted F4 winner correct?
      semi1Winner: s1Status,
      semi2Winner: s2Status,
      // Champion slot status = was the championship prediction correct?
      champion: cStatus,
    };
  }

  // ── Return assembled predicted results ────────────────────────────────────
  return {
    firstFour:      predictedFFWinners,
    firstFourStatus,                         // presence signals predicted mode
    East:           regionData.East,
    West:           regionData.West,
    South:          regionData.South,
    Midwest:        regionData.Midwest,
    ...(finalFour ? { finalFour, finalFourStatus } : {}),
    accuracy: {
      totalPlayed,
      correct,
      percentage: totalPlayed > 0 ? (correct / totalPlayed * 100).toFixed(1) : null,
    },
  };
}
