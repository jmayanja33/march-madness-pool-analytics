// Sticky top navigation bar shared across all pages.
// Highlights the active route link using the current pathname.
import { Link, useLocation } from 'react-router-dom';
import './NavBar.css';

export default function NavBar() {
  // useLocation gives the current URL path, used to mark the active nav link
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      {/* Brand — logo + site title, both link back to the home page */}
      <div className="navbar-brand">
        <Link to="/">
          <img src="/march-madness-logo.svg" alt="March Madness" className="navbar-logo" />
          <span className="navbar-title">The Pool</span>
        </Link>
      </div>

      {/* Navigation links — active class applied to the current route */}
      <div className="navbar-links">
        <Link to="/"        className={pathname === '/'        ? 'active' : ''}>Bracket</Link>
        <Link to="/analyze" className={pathname === '/analyze' ? 'active' : ''}>Analyze</Link>
        <Link to="/info"    className={pathname === '/info'    ? 'active' : ''}>Info</Link>
      </div>
    </nav>
  );
}
