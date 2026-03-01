// Full tournament bracket composed of four regional brackets and a center section.
//
// Layout uses CSS Grid with named areas:
//   "east    champion   south"    ← upper row: top-left, center, top-right
//   ".       band       ."        ← band row: championship strip (center only)
//   "west    spacer     midwest"  ← lower row: bottom-left, center, bottom-right
//
// The champion-box (center of the upper row) contains two stacked sections:
//   1. First Four band — flush with the tops of the East/South regions
//   2. Champion label/trophy/slot — centered in the remaining space below
//
// The championship band only occupies the center column, so the left/right
// region columns run edge-to-edge with no unnecessary vertical gaps.
import BracketRegion from './BracketRegion';
import BracketSlot from './BracketSlot';
import './Bracket.css';

// Default empty bracket — seed slots shown, team names blank until tournament field is set
const EMPTY_TEAMS = Array.from({ length: 16 }, (_, i) => ({ seed: i + 1, name: '' }));

const DEFAULT_BRACKET = {
  East:    EMPTY_TEAMS,
  West:    EMPTY_TEAMS,
  South:   EMPTY_TEAMS,
  Midwest: EMPTY_TEAMS,
};

// firstFour: array of { id, teamA: {seed, name}, teamB: {seed, name}, destination }
// Each entry represents one First Four play-in game.
//
// results (optional): full RESULTS_2025 object — passes regional data to each
// BracketRegion and populates the Final Four / Championship band with winners.
export default function Bracket({ bracket = DEFAULT_BRACKET, firstFour = [], results = null, onTeamClick }) {
  // Convenience aliases into the results object (null-safe)
  const ff     = results?.finalFour ?? null;
  const ffWins = results?.firstFour ?? {};

  // Build a name→seed lookup from all four regions and First Four teams so that
  // seeds can be shown on every slot, including Final Four and Championship.
  const seedLookup = {};
  Object.values(bracket).forEach(region =>
    region.forEach(t => { if (t.name) seedLookup[t.name] = t.seed; })
  );
  firstFour.forEach(game => {
    seedLookup[game.teamA.name] = game.teamA.seed;
    seedLookup[game.teamB.name] = game.teamB.seed;
  });

  return (
    <div className="bracket-wrapper fade-in">

      {/* ── Upper row ── */}
      <div className="region-east">
        <BracketRegion
          name="East"
          teams={bracket.East}
          direction="left"
          results={results?.East ?? null}
          onTeamClick={onTeamClick}
        />
      </div>

      {/* Champion box — center of upper row, between East and South.
          First Four band sits at the very top so its top edge aligns with the
          tops of the East and South regions. Champion content is centered below. */}
      <div className="champion-box">

        {/* ── First Four band ──
            One label for the whole section; individual games each show a
            destination chip indicating which bracket slot the winner earns. */}
        <div className="first-four-band">
          <div className="band-label">First Four</div>
          <div className="ff-games">
            {firstFour.length > 0
              // Render populated First Four games; mark the winner of each game
              ? firstFour.map(game => {
                  const gameWinner = ffWins[game.id] ?? null;
                  return (
                    <div key={game.id} className="ff-pairing">
                      {/* Small chip showing where the winner advances */}
                      <span className="ff-destination">→ {game.destination}</span>
                      <BracketSlot
                        seed={game.teamA.seed}
                        name={game.teamA.name}
                        winner={gameWinner === game.teamA.name}
                        onClick={() => onTeamClick(game.teamA.name)}
                      />
                      <BracketSlot
                        seed={game.teamB.seed}
                        name={game.teamB.name}
                        winner={gameWinner === game.teamB.name}
                        onClick={() => onTeamClick(game.teamB.name)}
                      />
                    </div>
                  );
                })
              // Fallback: four empty pairings when no data is supplied
              : Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="ff-pairing">
                    <BracketSlot seed={null} name="" />
                    <BracketSlot seed={null} name="" />
                  </div>
                ))
            }
          </div>
        </div>

        {/* ── Champion section — centered in the remaining space below ── */}
        <div className="champion-inner">
          <div className="band-label">Champion</div>
          <div className="trophy">🏆</div>
          {/* Show champion name and give it a permanent winner outline */}
          <BracketSlot
            seed={ff?.champion ? seedLookup[ff.champion] ?? null : null}
            name={ff?.champion ?? ''}
            winner={Boolean(ff?.champion)}
            onClick={() => ff?.champion && onTeamClick(ff.champion)}
          />
        </div>

      </div>

      <div className="region-south">
        <BracketRegion
          name="South"
          teams={bracket.South}
          direction="right"
          results={results?.South ?? null}
          onTeamClick={onTeamClick}
        />
      </div>

      {/* ── Championship band ──
          Narrow strip bounded by two lines, spanning center column only.
          Semifinal 1 (left):  East champion vs Midwest champion
          Semifinal 2 (right): West champion vs South champion */}
      <div className="championship-band">
        {/* Semifinal 1: East vs Midwest */}
        <div className="ff-pairing">
          <div className="band-label">Final Four</div>
          <BracketSlot
            seed={ff?.semi1.teamA ? seedLookup[ff.semi1.teamA] ?? null : null}
            name={ff?.semi1.teamA ?? ''}
            winner={ff?.semi1.winner === ff?.semi1.teamA}
            onClick={() => ff?.semi1.teamA && onTeamClick(ff.semi1.teamA)}
          />
          <BracketSlot
            seed={ff?.semi1.teamB ? seedLookup[ff.semi1.teamB] ?? null : null}
            name={ff?.semi1.teamB ?? ''}
            winner={ff?.semi1.winner === ff?.semi1.teamB}
            onClick={() => ff?.semi1.teamB && onTeamClick(ff.semi1.teamB)}
          />
        </div>
        {/* Championship game */}
        <div className="championship-game">
          <div className="band-label">Championship</div>
          <BracketSlot
            seed={ff?.semi1.winner ? seedLookup[ff.semi1.winner] ?? null : null}
            name={ff?.semi1.winner ?? ''}
            winner={ff?.champion === ff?.semi1.winner}
            onClick={() => ff?.semi1.winner && onTeamClick(ff.semi1.winner)}
          />
          <BracketSlot
            seed={ff?.semi2.winner ? seedLookup[ff.semi2.winner] ?? null : null}
            name={ff?.semi2.winner ?? ''}
            winner={ff?.champion === ff?.semi2.winner}
            onClick={() => ff?.semi2.winner && onTeamClick(ff.semi2.winner)}
          />
        </div>
        {/* Semifinal 2: West vs South */}
        <div className="ff-pairing">
          <div className="band-label">Final Four</div>
          <BracketSlot
            seed={ff?.semi2.teamA ? seedLookup[ff.semi2.teamA] ?? null : null}
            name={ff?.semi2.teamA ?? ''}
            winner={ff?.semi2.winner === ff?.semi2.teamA}
            onClick={() => ff?.semi2.teamA && onTeamClick(ff.semi2.teamA)}
          />
          <BracketSlot
            seed={ff?.semi2.teamB ? seedLookup[ff.semi2.teamB] ?? null : null}
            name={ff?.semi2.teamB ?? ''}
            winner={ff?.semi2.winner === ff?.semi2.teamB}
            onClick={() => ff?.semi2.teamB && onTeamClick(ff.semi2.teamB)}
          />
        </div>
      </div>

      {/* ── Lower row ── */}
      <div className="region-west">
        <BracketRegion
          name="West"
          teams={bracket.West}
          direction="left"
          results={results?.West ?? null}
          onTeamClick={onTeamClick}
        />
      </div>

      {/* Spacer keeps West and Midwest aligned with East and South above */}
      <div className="center-spacer" />

      <div className="region-midwest">
        <BracketRegion
          name="Midwest"
          teams={bracket.Midwest}
          direction="right"
          results={results?.Midwest ?? null}
          onTeamClick={onTeamClick}
        />
      </div>

    </div>
  );
}
