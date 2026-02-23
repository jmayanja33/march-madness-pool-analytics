import BracketSlot from './BracketSlot';
import './BracketRegion.css';

// Seeds in first-round bracket order: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
const FIRST_ROUND_SEEDS = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];

// Number of teams per round for a single region
const ROUND_SIZES = [16, 8, 4, 2, 1];
const ROUND_LABELS = ['Round 1', 'Round 2', 'Sweet 16', 'Elite 8', 'Final Four'];

function buildRounds(teams) {
  // Round 1: seeded teams from the bracket template
  const r1 = FIRST_ROUND_SEEDS.map(seed => {
    const match = teams.find(t => t.seed === seed);
    return match || { seed, name: '' };
  });
  // Rounds 2–5: empty TBD slots (winners determined during the tournament)
  return [
    r1,
    Array.from({ length: 8 }, (_, i) => ({ seed: null, name: '', id: `r2-${i}` })),
    Array.from({ length: 4 }, (_, i) => ({ seed: null, name: '', id: `s16-${i}` })),
    Array.from({ length: 2 }, (_, i) => ({ seed: null, name: '', id: `e8-${i}` })),
    Array.from({ length: 1 }, (_, i) => ({ seed: null, name: '', id: `ff-${i}` })),
  ];
}

export default function BracketRegion({ name, teams, direction, onTeamClick }) {
  const rounds = buildRounds(teams);

  // DOM order is always R1→R2→S16→E8→FF so nth-child spacing is correct for both sides.
  // 'right' regions are visually flipped via CSS flex-direction: row-reverse.
  return (
    <div className={`bracket-region region-${direction}`}>
      <div className="region-label">{name}</div>
      <div className="region-rounds">
        {rounds.map((round, ri) => (
          <div key={ri} className="bracket-round">
            <div className="round-label">{ROUND_LABELS[ri]}</div>
            <div className="round-slots">
              {round.map((team, ti) => (
                <div key={team.id ?? `${ri}-${ti}`} className="slot-wrapper">
                  <BracketSlot
                    seed={team.seed}
                    name={team.name}
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
