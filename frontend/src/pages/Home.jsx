// Home page — displays the interactive 2026 NCAA Tournament bracket.
// Clicking a filled team slot opens a TeamPopup with that team's analytics.
import { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import Bracket from '../components/Bracket';
import TeamPopup from '../components/TeamPopup';
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
          <h1>2026 NCAA Tournament</h1>
          <p>Click on any team</p>
        </div>
        {/* onTeamClick is called with the team name when a bracket slot is clicked */}
        <Bracket onTeamClick={setSelectedTeam} />
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
