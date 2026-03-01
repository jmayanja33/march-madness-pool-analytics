// BracketPage — displays the interactive 2026 NCAA Tournament bracket.
// Clicking any filled team slot opens a TeamPopup with that team's analytics.
import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import Bracket from '../components/Bracket';
import TeamPopup from '../components/TeamPopup';
import { BRACKET_2025, FIRST_FOUR_2025, RESULTS_2025 } from '../data/bracketData';
import './BracketPage.css';

export default function BracketPage() {
  useEffect(() => { document.title = 'The Pool | Bracket'; }, []);

  // Tracks which team the user has clicked; null means no popup is open
  const [selectedTeam, setSelectedTeam] = useState(null);

  return (
    <div className="bracket-page">
      <NavBar />
      <main className="bracket-page-main">
        <div className="bracket-page-header fade-in">
          <h1>2025 NCAA Tournament</h1>
          <p>Click on any team to view analytics</p>
        </div>
        {/* Pass 2025 bracket, First Four data, and full results; onTeamClick opens the analytics popup */}
        <Bracket
          bracket={BRACKET_2025}
          firstFour={FIRST_FOUR_2025}
          results={RESULTS_2025}
          onTeamClick={setSelectedTeam}
        />
      </main>

      {/* Popup is rendered only when a team is selected */}
      {selectedTeam && (
        <TeamPopup
          teamName={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
