// Renders one of the four tournament regions (East, West, South, Midwest).
// Each region displays 4 rounds (R1 → R2 → Sweet 16 → Elite 8) as columns.
// The Final Four is shown separately in the center of the full bracket.
//
// results (optional): { r32, s16, e8, f4 } arrays/value used to populate later rounds
//   and determine which slots should be highlighted as winners (green outline).
import BracketSlot from './BracketSlot';
import './BracketRegion.css';

// Seeds in first-round bracket order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
const FIRST_ROUND_SEEDS = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];

const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];

// Builds the 4-round slot array for a region.
// When results are supplied, later rounds are populated from results data and
// each slot carries a `winner` flag indicating the team advanced to the next round.
// Seeds are preserved across rounds by looking up each advancing team's seed
// from the original teams array.
function buildRounds(teams, results) {
  // Helper: find a team's seed from the original region teams list
  const getSeed = name => teams.find(t => t.name === name)?.seed ?? null;

  // Round 1: slot order follows FIRST_ROUND_SEEDS.
  // winner = team appears in r64Winners, meaning they won their Round of 64 game.
  // r64Winners is separate from r32 so partial R64 results don't break the R32 column.
  const r64Winners = results?.r64Winners ?? [];
  const r1 = FIRST_ROUND_SEEDS.map(seed => {
    const match = teams.find(t => t.seed === seed);
    const team = match || { seed, name: '' };
    return {
      ...team,
      winner: r64Winners.includes(team.name),
    };
  });

  // Round of 32: always 8 slots. r32 entries may be null (game not yet played → TBD).
  // winner = team appears in s16 (they won their R32 game).
  const r32 = results?.r32 ?? [];
  const s16List = results?.s16 ?? [];
  const r2 = Array.from({ length: 8 }, (_, i) => {
    const name = r32[i] ?? null;
    return { id: `r2-${i}`, seed: name ? getSeed(name) : null, name: name || '', winner: name ? s16List.includes(name) : false };
  });

  // Sweet 16: always 4 slots. s16 entries may be null → TBD.
  const s16 = results?.s16 ?? [];
  const e8List = results?.e8 ?? [];
  const sweet16 = Array.from({ length: 4 }, (_, i) => {
    const name = s16[i] ?? null;
    return { id: `s16-${i}`, seed: name ? getSeed(name) : null, name: name || '', winner: name ? e8List.includes(name) : false };
  });

  // Elite 8: always 2 slots. e8 entries may be null → TBD.
  const e8 = results?.e8 ?? [];
  const elite8 = Array.from({ length: 2 }, (_, i) => {
    const name = e8[i] ?? null;
    return { id: `e8-${i}`, seed: name ? getSeed(name) : null, name: name || '', winner: name ? name === results.f4 : false };
  });

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
