// Full tournament bracket composed of four regional brackets and a center section.
//
// Layout uses CSS Grid with named areas:
//   "east    champion   south"    ← upper row: top-left, center, top-right
//   ".       band       ."        ← band row: championship strip (center only)
//   "west    spacer     midwest"  ← lower row: bottom-left, center, bottom-right
//
// The championship band only occupies the center column, so the left/right region
// columns run edge-to-edge with no extra vertical space between upper and lower rows.
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

export default function Bracket({ bracket = DEFAULT_BRACKET, onTeamClick }) {
  return (
    <div className="bracket-wrapper fade-in">

      {/* ── Upper row ── */}
      <div className="region-east">
        <BracketRegion name="East" teams={bracket.East} direction="left" onTeamClick={onTeamClick} />
      </div>

      {/* Champion box — center of upper row, sits between East and South */}
      <div className="champion-box">
        <div className="band-label">Champion</div>
        <div className="trophy">🏆</div>
        <BracketSlot seed={null} name="" />
      </div>

      <div className="region-south">
        <BracketRegion name="South" teams={bracket.South} direction="right" onTeamClick={onTeamClick} />
      </div>

      {/* ── Championship band ──
          Narrow strip bounded by two lines, spanning center column only.
          Left pairing: East + West winners (Semifinal 1)
          Right pairing: South + Midwest winners (Semifinal 2) */}
      <div className="championship-band">
        <div className="ff-pairing">
          <div className="band-label">Final Four</div>
          <BracketSlot seed={null} name="" /> {/* East regional winner */}
          <BracketSlot seed={null} name="" /> {/* West regional winner */}
        </div>
        <div className="championship-game">
          <div className="band-label">Championship</div>
          <BracketSlot seed={null} name="" /> {/* Semifinal 1 winner */}
          <BracketSlot seed={null} name="" /> {/* Semifinal 2 winner */}
        </div>
        <div className="ff-pairing">
          <div className="band-label">Final Four</div>
          <BracketSlot seed={null} name="" /> {/* South regional winner */}
          <BracketSlot seed={null} name="" /> {/* Midwest regional winner */}
        </div>
      </div>

      {/* ── Lower row ── */}
      <div className="region-west">
        <BracketRegion name="West" teams={bracket.West} direction="left" onTeamClick={onTeamClick} />
      </div>

      {/* Spacer keeps West and Midwest aligned with East and South above */}
      <div className="center-spacer" />

      <div className="region-midwest">
        <BracketRegion name="Midwest" teams={bracket.Midwest} direction="right" onTeamClick={onTeamClick} />
      </div>

    </div>
  );
}
