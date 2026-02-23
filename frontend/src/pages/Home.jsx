import { useState } from 'react';
import NavBar from '../components/NavBar';
import Bracket from '../components/Bracket';
import TeamPopup from '../components/TeamPopup';
import './Home.css';

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState(null);

  return (
    <div className="home">
      <NavBar />
      <main className="home-main">
        <div className="home-header fade-in">
          <h1>2026 NCAA Tournament</h1>
          <p>Click any team to see their analytics profile.</p>
        </div>
        <Bracket onTeamClick={setSelectedTeam} />
      </main>

      {selectedTeam && (
        <TeamPopup
          teamName={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
