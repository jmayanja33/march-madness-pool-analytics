// A single team slot in the bracket.
// Renders as clickable when a team name is present, or as a greyed-out "TBD" placeholder.
// Filled slots show a small logo to the left of the seed and name.
// winner: when true, applies a green outline to indicate this team advanced.
import './BracketSlot.css';

export default function BracketSlot({ seed, name, winner = false, onClick }) {
  // Slot is considered "filled" only when a team name has been provided
  const filled = Boolean(name);

  return (
    <div
      className={`bracket-slot ${filled ? 'filled' : 'empty'} ${winner ? 'slot-winner' : ''}`}
      onClick={filled ? onClick : undefined}  // only fire click on filled slots
      title={filled ? name : undefined}       // tooltip on hover for long names
    >
      {/* Logo — shown for filled slots only; hidden via onError if file is missing */}
      {filled && (
        <img
          src={`/logos/${name}.png`}
          alt=""
          className="slot-logo"
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      {/* Seed badge — omitted for post-round slots (seed is null) */}
      {seed && <span className="slot-seed">{seed}</span>}
      <span className="slot-name">{name || 'TBD'}</span>
    </div>
  );
}
