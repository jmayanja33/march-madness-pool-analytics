// Root component — sets up client-side routing for all pages.
// All routes share the same NavBar rendered inside each page component.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import BracketPage from './pages/BracketPage';
import Analyze from './pages/Analyze';
import CreateTeam from './pages/CreateTeam';
import Info from './pages/Info';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Home />} />        {/* Landing page */}
        <Route path="/bracket"  element={<BracketPage />} /> {/* Interactive bracket */}
        <Route path="/analyze"      element={<Analyze />} />     {/* Team comparison */}
        <Route path="/create-team"  element={<CreateTeam />} /> {/* Pool builder */}
        <Route path="/info"         element={<Info />} />        {/* Project info */}
      </Routes>
    </BrowserRouter>
  );
}
