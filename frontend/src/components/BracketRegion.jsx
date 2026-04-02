// Renders one of the four tournament regions (East, West, South, Midwest).
// Each region displays 4 rounds (R1 → R2 → Sweet 16 → Elite 8) as columns.
// The Final Four is shown separately in the center of the full bracket.
//
// results (optional): per-region data used to populate later rounds.
//
//   LIVE MODE (no r64Status field):
//     { r64Winners, r32, r32Winners, s16, s16Winners, e8, e8Winners, f4 }
//     winner flag = team appears in the corresponding *Winners array.
//
//   PREDICTED MODE (r64Status field present):
//     { r64Status, r32, r32SlotStatus, s16, s16SlotStatus, e8, e8SlotStatus }
//     winner/incorrect flags come from per-slot status strings
//     ('correct' | 'incorrect' | 'pending').
import BracketSlot from './BracketSlot';
import './BracketRegion.css';

// Seeds in first-round bracket order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
const FIRST_ROUND_SEEDS = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];

const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];

/**
 * Converts a status string to winner/incorrect boolean flags for a BracketSlot.
 *
 * @param {string} status - 'correct' | 'incorrect' | 'pending'
 * @returns {{ winner: boolean, incorrect: boolean }}
 */
function statusToFlags(status) {
  return {
    winner:    status === 'correct',
    incorrect: status === 'incorrect',
  };
}

/**
 * Builds the 4-round slot array for a region.
 *
 * Supports two modes determined by whether results contains an r64Status field:
 *   - Live mode:      uses *Winners arrays for green-outline highlighting.
 *   - Predicted mode: uses per-slot status values for green/red highlighting.
 *
 * @param {Array}       teams   - Region's 16 teams from BRACKET_2026.
 * @param {Object|null} results - Per-region results object, or null for all-TBD.
 * @returns {Array[]} Four round arrays, each containing slot descriptor objects.
 */
function buildRounds(teams, results) {
  // Helper: find a team's seed from the original region teams list
  const getSeed = name => teams.find(t => t.name === name)?.seed ?? null;

  // ── Determine rendering mode ────────────────────────────────────────────────
  // Predicted mode is signaled by the presence of an r64Status dictionary on results.
  const isPredicted = Boolean(results?.r64Status);

  // ── Round 1 (16 slots) ──────────────────────────────────────────────────────
  let r1;
  if (isPredicted) {
    // Predicted mode: r64Status maps a team name → status string.
    // Only the highlighted team (predicted winner or actual winner per colorSlot)
    // appears in the dict; all other teams render with no coloring.
    const r64Status = results.r64Status;
    r1 = FIRST_ROUND_SEEDS.map(seed => {
      const match = teams.find(t => t.seed === seed);
      const team  = match || { seed, name: '' };
      const status = team.name ? (r64Status[team.name] ?? null) : null;
      const { winner, incorrect } = status ? statusToFlags(status) : { winner: false, incorrect: false };
      return { ...team, winner, incorrect };
    });
  } else {
    // Live mode: winner flag = team appears in r64Winners
    const r64Winners = results?.r64Winners ?? [];
    r1 = FIRST_ROUND_SEEDS.map(seed => {
      const match = teams.find(t => t.seed === seed);
      const team  = match || { seed, name: '' };
      return { ...team, winner: r64Winners.includes(team.name), incorrect: false };
    });
  }

  // ── Round of 32 (8 slots) ───────────────────────────────────────────────────
  const r32 = results?.r32 ?? [];
  let r2;
  if (isPredicted) {
    // r32Status is a name-keyed dict — only the highlighted team (one per R32 game)
    // has an entry; all other R2 slots render with no coloring.
    const r32Status = results.r32Status ?? {};
    r2 = Array.from({ length: 8 }, (_, i) => {
      const name   = r32[i] ?? null;
      const status = name ? (r32Status[name] ?? null) : null;
      const { winner, incorrect } = status ? statusToFlags(status) : { winner: false, incorrect: false };
      return {
        id:        `r2-${i}`,
        seed:      name ? getSeed(name) : null,
        name:      name || '',
        winner:    name ? winner    : false,
        incorrect: name ? incorrect : false,
      };
    });
  } else {
    const r32Winners = results?.r32Winners ?? [];
    r2 = Array.from({ length: 8 }, (_, i) => {
      const name = r32[i] ?? null;
      return {
        id:        `r2-${i}`,
        seed:      name ? getSeed(name) : null,
        name:      name || '',
        winner:    name ? r32Winners.includes(name) : false,
        incorrect: false,
      };
    });
  }

  // ── Sweet 16 (4 slots) ──────────────────────────────────────────────────────
  const s16 = results?.s16 ?? [];
  let sweet16;
  if (isPredicted) {
    const s16Status = results.s16Status ?? {};
    sweet16 = Array.from({ length: 4 }, (_, i) => {
      const name   = s16[i] ?? null;
      const status = name ? (s16Status[name] ?? null) : null;
      const { winner, incorrect } = status ? statusToFlags(status) : { winner: false, incorrect: false };
      return {
        id:        `s16-${i}`,
        seed:      name ? getSeed(name) : null,
        name:      name || '',
        winner:    name ? winner    : false,
        incorrect: name ? incorrect : false,
      };
    });
  } else {
    const s16Winners = results?.s16Winners ?? [];
    sweet16 = Array.from({ length: 4 }, (_, i) => {
      const name = s16[i] ?? null;
      return {
        id:        `s16-${i}`,
        seed:      name ? getSeed(name) : null,
        name:      name || '',
        winner:    name ? s16Winners.includes(name) : false,
        incorrect: false,
      };
    });
  }

  // ── Elite 8 (2 slots) ───────────────────────────────────────────────────────
  const e8 = results?.e8 ?? [];
  let elite8;
  if (isPredicted) {
    const e8Status = results.e8Status ?? {};
    elite8 = Array.from({ length: 2 }, (_, i) => {
      const name   = e8[i] ?? null;
      const status = name ? (e8Status[name] ?? null) : null;
      const { winner, incorrect } = status ? statusToFlags(status) : { winner: false, incorrect: false };
      return {
        id:        `e8-${i}`,
        seed:      name ? getSeed(name) : null,
        name:      name || '',
        winner:    name ? winner    : false,
        incorrect: name ? incorrect : false,
      };
    });
  } else {
    const e8Winners = results?.e8Winners ?? [];
    elite8 = Array.from({ length: 2 }, (_, i) => {
      const name = e8[i] ?? null;
      return {
        id:        `e8-${i}`,
        seed:      name ? getSeed(name) : null,
        name:      name || '',
        winner:    name ? e8Winners.includes(name) : false,
        incorrect: false,
      };
    });
  }

  return [r1, r2, sweet16, elite8];
}

// direction: 'left'  → R1 on the far left, E8 closest to center (East, West)
//            'right' → R1 on the far right, E8 closest to center (South, Midwest)
//
// DOM order is always R1→R2→S16→E8 regardless of direction, so the CSS
// nth-child spacing rules apply correctly on both sides. Right-direction
// regions are visually flipped via CSS flex-direction: row-reverse.
export default function BracketRegion({ name, teams, direction, results, onTeamClick }) {
  const rounds = buildRounds(teams, results);

  return (
    <div className={`bracket-region region-${direction}`}>
      <div className="region-label">{name}</div>
      <div className="region-rounds">
        {rounds.map((round, ri) => (
          <div key={ri} className="bracket-round">
            <div className="round-label">{ROUND_LABELS[ri]}</div>
            <div className="round-slots">
              {round.map((team, ti) => (
                // slot-wrapper margin doubles each round to vertically align
                // each slot with the midpoint of its two source matchups
                <div key={team.id ?? `${ri}-${ti}`} className="slot-wrapper">
                  <BracketSlot
                    seed={team.seed}
                    name={team.name}
                    winner={team.winner}
                    incorrect={team.incorrect ?? false}
                    onClick={() => onTeamClick(team.name)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
