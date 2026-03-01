// Modal popup displayed when a user clicks a team slot in the bracket.
// Fetches team data from the backend and renders the same TeamCard used
// on the Analyze page so both views are identical.
// Clicking the overlay or the ✕ button closes the popup.
import { useEffect, useState } from 'react';
import { fetchTeamData } from '../api/teamApi';
import TeamCard from './TeamCard';
import './TeamPopup.css';

export default function TeamPopup({ teamName, onClose }) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch team data whenever the selected team changes.
  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(true);
    fetchTeamData(teamName)
      .then(setData)
      .catch(() => setError('Team data is not yet available.'))
      .finally(() => setLoading(false));
  }, [teamName]);

  return (
    // Clicking the overlay (outside the popup card) closes the popup.
    <div className="popup-overlay" onClick={onClose}>
      {/* stopPropagation prevents clicks inside the card from closing it. */}
      <div className="popup pop-in" onClick={e => e.stopPropagation()}>

        {/* Loading and error states */}
        {loading && <div className="popup-loading"><span className="spinner" />Loading…</div>}
        {error   && <div className="popup-error">{error}</div>}

        {/* Reuse the Analyze page TeamCard; onClose wires to the card's remove button. */}
        {data && <TeamCard team={data} onRemove={onClose} />}
      </div>
    </div>
  );
}
