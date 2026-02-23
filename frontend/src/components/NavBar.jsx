import { Link, useLocation } from 'react-router-dom';
import './NavBar.css';

export default function NavBar() {
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">
          <img src="/march-madness-logo.svg" alt="March Madness" className="navbar-logo" />
          <span className="navbar-title">The Pool</span>
        </Link>
      </div>
      <div className="navbar-links">
        <Link to="/"        className={pathname === '/'        ? 'active' : ''}>Bracket</Link>
        <Link to="/analyze" className={pathname === '/analyze' ? 'active' : ''}>Analyze</Link>
        <Link to="/info"    className={pathname === '/info'    ? 'active' : ''}>Info</Link>
      </div>
    </nav>
  );
}
