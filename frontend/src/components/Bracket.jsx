import BracketRegion from './BracketRegion';
import BracketSlot from './BracketSlot';
import './Bracket.css';

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

      <div className="region-east">
        <BracketRegion name="East" teams={bracket.East} direction="left" onTeamClick={onTeamClick} />
      </div>

      <div className="champion-box">
        <div className="band-label">Champion</div>
        <div className="trophy">🏆</div>
        <BracketSlot seed={null} name="" />
      </div>

      <div className="region-south">
        <BracketRegion name="South" teams={bracket.South} direction="right" onTeamClick={onTeamClick} />
      </div>

      {/* Championship band — center column only, bounded by two lines */}
      <div className="championship-band">
        <div className="ff-pairing">
          <div className="band-label">Final Four</div>
          <BracketSlot seed={null} name="" />
          <BracketSlot seed={null} name="" />
        </div>
        <div className="championship-game">
          <div className="band-label">Championship</div>
          <BracketSlot seed={null} name="" />
        </div>
        <div className="ff-pairing">
          <div className="band-label">Final Four</div>
          <BracketSlot seed={null} name="" />
          <BracketSlot seed={null} name="" />
        </div>
      </div>

      <div className="region-west">
        <BracketRegion name="West" teams={bracket.West} direction="left" onTeamClick={onTeamClick} />
      </div>

      <div className="center-spacer" />

      <div className="region-midwest">
        <BracketRegion name="Midwest" teams={bracket.Midwest} direction="right" onTeamClick={onTeamClick} />
      </div>

    </div>
  );
}
