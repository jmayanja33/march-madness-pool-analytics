// Info page — project overview, model details, data sources, and accuracy metrics.
// Currently a stub; full implementation coming once model details are finalized.
import { useEffect } from 'react';
import NavBar from '../components/NavBar';

export default function Info() {
  useEffect(() => { document.title = 'The Pool | Info'; }, []);

  return (
    <div>
      <NavBar />
      <main style={{ padding: '40px 32px' }}>
        <h1 style={{ color: 'var(--dark-blue)' }}>About The Pool</h1>
        <p style={{ color: 'var(--silver)', marginTop: 8 }}>Project info coming soon.</p>
      </main>
    </div>
  );
}
