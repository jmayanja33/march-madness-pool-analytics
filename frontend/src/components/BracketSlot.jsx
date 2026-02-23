// A single team slot in the bracket.
// Renders as clickable when a team name is present, or as a greyed-out "TBD" placeholder.
import './BracketSlot.css';

export default function BracketSlot({ seed, name, onClick }) {
  // Slot is considered "filled" only when a team name has been provided
  const filled = Boolean(name);

  return (
    <div
      className={`bracket-slot ${filled ? 'filled' : 'empty'}`}
      onClick={filled ? onClick : undefined}  // only fire click on filled slots
      title={filled ? name : undefined}       // tooltip on hover for long names
    >
      {/* Seed badge — omitted for post-round slots (seed is null) */}
      {seed && <span className="slot-seed">{seed}</span>}
      <span className="slot-name">{name || 'TBD'}</span>
    </div>
  );
}
