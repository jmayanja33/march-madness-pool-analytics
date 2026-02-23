import './BracketSlot.css';

export default function BracketSlot({ seed, name, onClick }) {
  const filled = Boolean(name);

  return (
    <div
      className={`bracket-slot ${filled ? 'filled' : 'empty'}`}
      onClick={filled ? onClick : undefined}
      title={filled ? name : undefined}
    >
      {seed && <span className="slot-seed">{seed}</span>}
      <span className="slot-name">{name || 'TBD'}</span>
    </div>
  );
}
