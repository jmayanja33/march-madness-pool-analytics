// Root component — sets up client-side routing for the three pages.
// All routes share the same NavBar rendered inside each page component.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Analyze from './pages/Analyze';
import Info from './pages/Info';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Home />} />    {/* Interactive bracket */}
        <Route path="/analyze" element={<Analyze />} /> {/* Team comparison */}
        <Route path="/info"    element={<Info />} />    {/* Project info */}
      </Routes>
    </BrowserRouter>
  );
}
