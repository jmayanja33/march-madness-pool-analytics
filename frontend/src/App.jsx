import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Analyze from './pages/Analyze';
import Info from './pages/Info';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/info" element={<Info />} />
      </Routes>
    </BrowserRouter>
  );
}
