// Info page — three sections: Background/How to Play, Data/Models, and More Info.
// Model metrics are fetched from the /info API endpoint; all other content is static.
import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import { fetchInfo } from '../api/teamApi';
import './Info.css';

export default function Info() {
  // Model metrics loaded from the API; null until the request resolves.
  const [infoData, setInfoData] = useState(null);

  useEffect(() => {
    document.title = 'The Pool | Info';

    // Fetch structured project info from the backend.
    fetchInfo()
      .then(data => setInfoData(data))
      .catch(err => console.error('[Info] Failed to load info data:', err));
  }, []);

  // Resolve metrics from API data or fall back to static values from the spec.
  const metrics = infoData?.model ?? {
    accuracy: 75.26,
    f1_weighted: 76.33,
    precision_weighted: 79.05,
    quadratic_weighted_kappa: 0.763,
    ranked_probability_score: 0.097,
    training_samples: 643,
    test_samples: 190,
    seasons: '2010–2025',
  };

  return (
    <div className="info-page">
      <NavBar />

      <main className="info-main fade-in">

        {/* ── Section 1: Background / How to Play ── */}
        <section className="info-section">
          <h2 className="info-section-title">Background / How to Play</h2>
          <div className="info-section-body">
            <p>
              During March Madness, the Bracket Pool is the most common fan competition. Every year,
              millions of brackets are filled out, with the chances of one being perfect being approximately
              1 in 9.2 quintillion. One wrong pick ruins the perfect bracket, and a couple usually cost
              people an entire pool. However, there is another fun way to compete during March Madness.
            </p>
            <p>
              The Pool is a different approach on the traditional Bracket Pool. To play, a pool of 8 players
              is needed, each of whom put together a collection of 8 teams in the NCAA tournament field.
              To put together their collection of teams, there is an auction where teams are auctioned off.
              Each player gets 1000 bid points in the auction to spend on their teams.
            </p>
            <p>
              The goal of the pool is to pick 8 teams which will have the most wins (cumulative) out of
              everyone in the pool. First place wins the pot, while second gets their money back.
              Additionally, there is a payout for the team who selects the NCAA champion in the auction.
            </p>
          </div>
        </section>

        {/* ── Section 2: Data / Models ── */}
        <section className="info-section">
          <h2 className="info-section-title">Data / Models</h2>
          <div className="info-section-body">
            <p>
              The main goal of this platform is to help players analyze team performance when creating
              their 8-team collection for the pool. All data was collected from the following sources:
            </p>

            {/* Data source links */}
            <ul className="info-sources-list">
              <li>
                <strong>Player and Team Statistics:</strong>{' '}
                <a href="https://collegebasketballdata.com/" target="_blank" rel="noreferrer">CBBD</a>
              </li>
              <li>
                <strong>Game Summaries:</strong>{' '}
                <a href="https://www.espn.com/" target="_blank" rel="noreferrer">ESPN</a>
              </li>
              <li>
                <strong>Team Logos:</strong>{' '}
                <a href="https://www.sportslogos.net/" target="_blank" rel="noreferrer">SportsLogos.Net</a>
              </li>
            </ul>

            <p>
              One feature of the team analytics is their predicted wins in the tournament. For this, an
              ordinal regression model was used to evaluate the probability that a team would win 0, 1,
              or 2+ games in the tournament. For this year (2026), the model is performing with the
              following metrics:
            </p>

            {/* Model performance metrics grid */}
            <div className="info-metrics-grid">
              <MetricCard label="Accuracy"              value={`${metrics.accuracy}%`} />
              <MetricCard label="F1 Score (Weighted)"  value={`${metrics.f1_weighted}%`} />
              <MetricCard label="Precision (Weighted)" value={`${metrics.precision_weighted}%`} />
              <MetricCard label="Quadratic Weighted Kappa"  value={metrics.quadratic_weighted_kappa} />
              <MetricCard label="Ranked Probability Score"  value={metrics.ranked_probability_score} />
            </div>

            <p className="info-model-detail">
              The model was trained on {metrics.training_samples} teams ({metrics.seasons}) and tested
              on {metrics.test_samples}, using 5-fold cross-validation with hyperparameter tuning. It
              classifies teams into three win buckets (0, 1, or 2+ wins) with ~75% accuracy. A Quadratic
              Weighted Kappa of {metrics.quadratic_weighted_kappa} indicates strong ordinal agreement, and
              a Ranked Probability Score of {metrics.ranked_probability_score} reflects well-calibrated
              win probability distributions.
            </p>
          </div>
        </section>

        {/* ── Section 3: More Info ── */}
        <section className="info-section info-section--last">
          <h2 className="info-section-title">More Info</h2>
          <div className="info-section-body">
            <p>
              For more information on the model development or data collection process, reach out to
              Josh Mayanja:
            </p>
            <ul className="info-contact-list">
              <li>
                <strong>Email:</strong>{' '}
                <a href="mailto:joshmayanja30@gmail.com">joshmayanja30@gmail.com</a>
              </li>
              <li>
                <strong>LinkedIn:</strong>{' '}
                <a
                  href="https://www.linkedin.com/in/josh-mayanja-a3001b200/"
                  target="_blank"
                  rel="noreferrer"
                >
                  linkedin.com/in/josh-mayanja-a3001b200
                </a>
              </li>
              <li>
                <strong>GitHub:</strong>{' '}
                <a href="https://github.com/jmayanja33" target="_blank" rel="noreferrer">
                  github.com/jmayanja33
                </a>
              </li>
            </ul>
          </div>
        </section>

      </main>
    </div>
  );
}

// Small card displaying a single model performance metric.
// Renders the value prominently above a smaller label.
function MetricCard({ label, value }) {
  return (
    <div className="info-metric-card">
      <span className="info-metric-value">{value}</span>
      <span className="info-metric-label">{label}</span>
    </div>
  );
}
