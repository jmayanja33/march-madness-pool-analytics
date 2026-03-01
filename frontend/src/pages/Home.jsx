// Home — landing page for The Pool.
// Displays the March Madness logo, a branded subtitle, and three navigation
// buttons linking to the Bracket, Analyze, and Info pages.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import './Home.css';

export default function Home() {
  useEffect(() => { document.title = 'The Pool'; }, []);

  return (
    <div className="home">
      <NavBar />

      {/* Centered hero section — logo, subtitle, navigation buttons */}
      <main className="home-hero fade-in">
        {/* Large March Madness logo */}
        <img
          src="/march-madness-logo.svg"
          alt="March Madness"
          className="home-logo"
        />

        {/* Branded subtitle in navy Anton font */}
        <h1 className="home-subtitle">The Pool — Analytics</h1>

        {/* Three navigation buttons, one per page */}
        <div className="home-nav-buttons">
          <Link to="/bracket" className="home-btn">Bracket</Link>
          <Link to="/analyze" className="home-btn">Analyze</Link>
          <Link to="/info"    className="home-btn">Info</Link>
        </div>
      </main>
    </div>
  );
}
