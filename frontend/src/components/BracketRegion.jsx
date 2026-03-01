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

  // Round 1: slot order follows FIRST_ROUND_SEEDS; winner = team is in r32
  const r1 = FIRST_ROUND_SEEDS.map(seed => {
    const match = teams.find(t => t.seed === seed);
    const team = match || { seed, name: '' };
    return {
      ...team,
      winner: results ? results.r32.includes(team.name) : false,
    };
  });

  // Round of 32: populated from r32 winners; seed looked up from original teams
  const r2 = results
    ? results.r32.map((name, i) => ({
        id: `r2-${i}`, seed: getSeed(name), name,
        winner: results.s16.includes(name),
      }))
    : Array.from({ length: 8 }, (_, i) => ({ id: `r2-${i}`, seed: null, name: '', winner: false }));

  // Sweet 16: populated from s16 winners; seed looked up from original teams
  const s16 = results
    ? results.s16.map((name, i) => ({
        id: `s16-${i}`, seed: getSeed(name), name,
        winner: results.e8.includes(name),
      }))
    : Array.from({ length: 4 }, (_, i) => ({ id: `s16-${i}`, seed: null, name: '', winner: false }));

  // Elite 8: populated from e8 participants; seed looked up from original teams
  const e8 = results
    ? results.e8.map((name, i) => ({
        id: `e8-${i}`, seed: getSeed(name), name,
        winner: name === results.f4,
      }))
    : Array.from({ length: 2 }, (_, i) => ({ id: `e8-${i}`, seed: null, name: '', winner: false }));

  return [r1, r2, s16, e8];
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
