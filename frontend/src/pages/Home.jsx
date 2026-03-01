// Home page — displays the interactive 2025 NCAA Tournament bracket.
// Clicking any filled team slot opens a TeamPopup with that team's analytics.
import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import Bracket from '../components/Bracket';
import TeamPopup from '../components/TeamPopup';
import { BRACKET_2025, FIRST_FOUR_2025 } from '../data/bracketData';
import './Home.css';

export default function Home() {
  useEffect(() => { document.title = 'The Pool | Home'; }, []);

  // Tracks which team the user has clicked; null means no popup is open
  const [selectedTeam, setSelectedTeam] = useState(null);

  return (
    <div className="home">
      <NavBar />
      <main className="home-main">
        <div className="home-header fade-in">
          <h1>2025 NCAA Tournament</h1>
          <p>Click on any team to view analytics</p>
        </div>
        {/* Pass 2025 bracket and First Four data; onTeamClick opens the analytics popup */}
        <Bracket
          bracket={BRACKET_2025}
          firstFour={FIRST_FOUR_2025}
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
