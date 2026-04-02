// Full tournament bracket composed of four regional brackets and a center section.
//
// Layout uses CSS Grid with named areas:
//   "east    champion   west"     ← upper row: top-left, center, top-right
//   ".       band       ."        ← band row: championship strip (center only)
//   "south   spacer     midwest"  ← lower row: bottom-left, center, bottom-right
//
// The champion-box (center of the upper row) contains two stacked sections:
//   1. First Four band — flush with the tops of the East/South regions
//   2. Champion label/trophy/slot — centered in the remaining space below
//
// The championship band only occupies the center column, so the left/right
// region columns run edge-to-edge with no unnecessary vertical gaps.
//
// props:
//   bracket     - BRACKET_2026 { East, West, South, Midwest }
//   firstFour   - FIRST_FOUR_2026 game descriptors
//   results     - Live results object (transformAPIResults output), or
//                 Predicted results object (transformPredictedBracket output), or null.
//
//   MODE DETECTION:
//     Predicted mode is active when results contains a firstFourStatus field.
//     Live mode is the default when that field is absent.
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
// results (optional): full results object — passes regional data to each
// BracketRegion and populates the Final Four / Championship band with winners.
export default function Bracket({ bracket = DEFAULT_BRACKET, firstFour = [], results = null, onTeamClick }) {
  // Convenience aliases into the results object (null-safe)
  const ff     = results?.finalFour ?? null;
  const ffWins = results?.firstFour ?? {};

  // ── Mode detection ──────────────────────────────────────────────────────────
  // Predicted mode is signaled by the presence of firstFourStatus on results.
  const isPredicted      = Boolean(results?.firstFourStatus);
  const ffStatus         = results?.firstFourStatus ?? {};
  const finalFourStatus  = results?.finalFourStatus  ?? {};

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

  // ── Helper: convert a status string to winner/incorrect props ────────────────
  // Used in predicted mode for center-section slots.
  const statusFlags = status => ({
    winner:    status === 'correct',
    incorrect: status === 'incorrect',
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
              // Render populated First Four games
              ? firstFour.map(game => {
                  const gameWinner = ffWins[game.id] ?? null;

                  if (isPredicted) {
                    // Predicted mode: color the predicted winner's slot (green or red).
                    // gameWinner = predicted winner name; winStatus drives the color.
                    const winStatus = ffStatus[game.id] ?? 'pending';
                    const { winner: wWin, incorrect: wInc } = statusFlags(winStatus);
                    const isTeamAWinner = gameWinner === game.teamA.name;
                    return (
                      <div key={game.id} className="ff-pairing">
                        <span className="ff-destination">→ {game.destination}</span>
                        <BracketSlot
                          seed={game.teamA.seed}
                          name={game.teamA.name}
                          winner={isTeamAWinner ? wWin : false}
                          incorrect={isTeamAWinner ? wInc : false}
                          onClick={() => onTeamClick(game.teamA.name)}
                        />
                        <BracketSlot
                          seed={game.teamB.seed}
                          name={game.teamB.name}
                          winner={!isTeamAWinner ? wWin : false}
                          incorrect={!isTeamAWinner ? wInc : false}
                          onClick={() => onTeamClick(game.teamB.name)}
                        />
                      </div>
                    );
                  }

                  // Live mode: winner gets the green outline
                  return (
                    <div key={game.id} className="ff-pairing">
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
          {isPredicted
            ? (() => {
                // Predicted mode: show predicted champion with status coloring
                const champStatus = finalFourStatus.champion ?? 'pending';
                const { winner: cWin, incorrect: cInc } = statusFlags(champStatus);
                const champName = ff?.champion ?? '';
                return (
                  <BracketSlot
                    seed={champName ? seedLookup[champName] ?? null : null}
                    name={champName}
                    winner={cWin}
                    incorrect={cInc}
                    onClick={() => champName && onTeamClick(champName)}
                  />
                );
              })()
            // Live mode: champion always gets the green winner outline
            : (
                <BracketSlot
                  seed={ff?.champion ? seedLookup[ff.champion] ?? null : null}
                  name={ff?.champion ?? ''}
                  winner={Boolean(ff?.champion)}
                  onClick={() => ff?.champion && onTeamClick(ff.champion)}
                />
              )
          }
        </div>

      </div>

      <div className="region-west">
        <BracketRegion
          name="West"
          teams={bracket.West}
          direction="right"
          results={results?.West ?? null}
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
          {isPredicted
            ? (() => {
                // Predicted mode: F4 participant slots use E8 result statuses
                const { winner: aWin, incorrect: aInc } = statusFlags(finalFourStatus.semi1TeamA ?? 'pending');
                const { winner: bWin, incorrect: bInc } = statusFlags(finalFourStatus.semi1TeamB ?? 'pending');
                return (
                  <>
                    <BracketSlot
                      seed={ff?.semi1.teamA ? seedLookup[ff.semi1.teamA] ?? null : null}
                      name={ff?.semi1.teamA ?? ''}
                      winner={aWin}
                      incorrect={aInc}
                      onClick={() => ff?.semi1.teamA && onTeamClick(ff.semi1.teamA)}
                    />
                    <BracketSlot
                      seed={ff?.semi1.teamB ? seedLookup[ff.semi1.teamB] ?? null : null}
                      name={ff?.semi1.teamB ?? ''}
                      winner={bWin}
                      incorrect={bInc}
                      onClick={() => ff?.semi1.teamB && onTeamClick(ff.semi1.teamB)}
                    />
                  </>
                );
              })()
            : (
                <>
                  <BracketSlot
                    seed={ff?.semi1.teamA ? seedLookup[ff.semi1.teamA] ?? null : null}
                    name={ff?.semi1.teamA ?? ''}
                    winner={Boolean(ff && ff.semi1.winner === ff.semi1.teamA)}
                    onClick={() => ff?.semi1.teamA && onTeamClick(ff.semi1.teamA)}
                  />
                  <BracketSlot
                    seed={ff?.semi1.teamB ? seedLookup[ff.semi1.teamB] ?? null : null}
                    name={ff?.semi1.teamB ?? ''}
                    winner={Boolean(ff && ff.semi1.winner === ff.semi1.teamB)}
                    onClick={() => ff?.semi1.teamB && onTeamClick(ff.semi1.teamB)}
                  />
                </>
              )
          }
        </div>

        {/* Championship game */}
        <div className="championship-game">
          <div className="band-label">Championship</div>
          {isPredicted
            ? (() => {
                // Predicted mode: championship slots use F4 semifinal winner statuses
                const { winner: s1Win, incorrect: s1Inc } = statusFlags(finalFourStatus.semi1Winner ?? 'pending');
                const { winner: s2Win, incorrect: s2Inc } = statusFlags(finalFourStatus.semi2Winner ?? 'pending');
                return (
                  <>
                    <BracketSlot
                      seed={ff?.semi1.winner ? seedLookup[ff.semi1.winner] ?? null : null}
                      name={ff?.semi1.winner ?? ''}
                      winner={s1Win}
                      incorrect={s1Inc}
                      onClick={() => ff?.semi1.winner && onTeamClick(ff.semi1.winner)}
                    />
                    <BracketSlot
                      seed={ff?.semi2.winner ? seedLookup[ff.semi2.winner] ?? null : null}
                      name={ff?.semi2.winner ?? ''}
                      winner={s2Win}
                      incorrect={s2Inc}
                      onClick={() => ff?.semi2.winner && onTeamClick(ff.semi2.winner)}
                    />
                  </>
                );
              })()
            : (
                <>
                  <BracketSlot
                    seed={ff?.semi1.winner ? seedLookup[ff.semi1.winner] ?? null : null}
                    name={ff?.semi1.winner ?? ''}
                    winner={Boolean(ff && ff.champion === ff.semi1.winner)}
                    onClick={() => ff?.semi1.winner && onTeamClick(ff.semi1.winner)}
                  />
                  <BracketSlot
                    seed={ff?.semi2.winner ? seedLookup[ff.semi2.winner] ?? null : null}
                    name={ff?.semi2.winner ?? ''}
                    winner={Boolean(ff && ff.champion === ff.semi2.winner)}
                    onClick={() => ff?.semi2.winner && onTeamClick(ff.semi2.winner)}
                  />
                </>
              )
          }
        </div>

        {/* Semifinal 2: West vs South */}
        <div className="ff-pairing">
          <div className="band-label">Final Four</div>
          {isPredicted
            ? (() => {
                const { winner: aWin, incorrect: aInc } = statusFlags(finalFourStatus.semi2TeamA ?? 'pending');
                const { winner: bWin, incorrect: bInc } = statusFlags(finalFourStatus.semi2TeamB ?? 'pending');
                return (
                  <>
                    <BracketSlot
                      seed={ff?.semi2.teamA ? seedLookup[ff.semi2.teamA] ?? null : null}
                      name={ff?.semi2.teamA ?? ''}
                      winner={aWin}
                      incorrect={aInc}
                      onClick={() => ff?.semi2.teamA && onTeamClick(ff.semi2.teamA)}
                    />
                    <BracketSlot
                      seed={ff?.semi2.teamB ? seedLookup[ff.semi2.teamB] ?? null : null}
                      name={ff?.semi2.teamB ?? ''}
                      winner={bWin}
                      incorrect={bInc}
                      onClick={() => ff?.semi2.teamB && onTeamClick(ff.semi2.teamB)}
                    />
                  </>
                );
              })()
            : (
                <>
                  <BracketSlot
                    seed={ff?.semi2.teamA ? seedLookup[ff.semi2.teamA] ?? null : null}
                    name={ff?.semi2.teamA ?? ''}
                    winner={Boolean(ff && ff.semi2.winner === ff.semi2.teamA)}
                    onClick={() => ff?.semi2.teamA && onTeamClick(ff.semi2.teamA)}
                  />
                  <BracketSlot
                    seed={ff?.semi2.teamB ? seedLookup[ff.semi2.teamB] ?? null : null}
                    name={ff?.semi2.teamB ?? ''}
                    winner={Boolean(ff && ff.semi2.winner === ff.semi2.teamB)}
                    onClick={() => ff?.semi2.teamB && onTeamClick(ff.semi2.teamB)}
                  />
                </>
              )
          }
        </div>
      </div>

      {/* ── Lower row ── */}
      <div className="region-south">
        <BracketRegion
          name="South"
          teams={bracket.South}
          direction="left"
          results={results?.South ?? null}
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
