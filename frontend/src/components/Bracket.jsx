import BracketRegion from './BracketRegion';
import BracketSlot from './BracketSlot';
import './Bracket.css';

// Default empty bracket — replace with real data when teams are announced
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
      {/* Left half: East (top) + West (bottom) */}
      <div className="bracket-half left">
        <BracketRegion name="East"    teams={bracket.East}    direction="left" onTeamClick={onTeamClick} />
        <BracketRegion name="West"    teams={bracket.West}    direction="left" onTeamClick={onTeamClick} />
      </div>

      {/* Center: Final Four + Championship */}
      <div className="bracket-center">
        <div className="center-label">Final Four</div>
        <div className="ff-slots">
          <BracketSlot seed={null} name="" />
          <BracketSlot seed={null} name="" />
        </div>
        <div className="championship-area">
          <div className="center-label">Championship</div>
          <BracketSlot seed={null} name="" />
          <div className="trophy">🏆</div>
        </div>
        <div className="ff-slots">
          <BracketSlot seed={null} name="" />
          <BracketSlot seed={null} name="" />
        </div>
      </div>

      {/* Right half: South (top) + Midwest (bottom) */}
      <div className="bracket-half right">
        <BracketRegion name="South"   teams={bracket.South}   direction="right" onTeamClick={onTeamClick} />
        <BracketRegion name="Midwest" teams={bracket.Midwest} direction="right" onTeamClick={onTeamClick} />
      </div>
    </div>
  );
}
