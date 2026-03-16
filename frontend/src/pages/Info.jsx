// Info page — five sections: Background/How to Play, Data, Head to Head Model, Wins Model, More Info.
// All content is static.
import { useEffect } from 'react';
import NavBar from '../components/NavBar';
import './Info.css';

export default function Info() {
  useEffect(() => { document.title = 'The Pool | Info'; }, []);

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

        {/* ── Section 2: Data ── */}
        <section className="info-section">
          <h2 className="info-section-title">Data</h2>
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
          </div>
        </section>

        {/* ── Section 3: Head to Head Model ── */}
        <section className="info-section">
          <h2 className="info-section-title">Head to Head Model</h2>
          <div className="info-section-body">
            <p>
              The Head to Head page predicts the winner of any individual matchup between two teams in
              the tournament field. A logistic regression model — trained on PCA-reduced team embeddings
              combined with team statistics — outputs a win probability for each side. For this year
              (2026), the model is performing with the following metrics:
            </p>

            {/* Head-to-head model performance metrics — static values from the 2026 training run */}
            <div className="info-metrics-grid">
              <MetricCard
                label="Accuracy"
                value="83.15%"
                tooltip="Out of every 100 predicted matchups, the model correctly identified the winner this many times. Ideal: 100%"
              />
              <MetricCard
                label="F1 Score"
                value="83.01%"
                tooltip="A combined measure of precision and recall — how well the model balances finding winners without generating too many false calls. Ideal: 100%"
              />
              <MetricCard
                label="Precision"
                value="83.71%"
                tooltip="When the model predicted a team would win a matchup, how often it was actually right. Ideal: 100%"
              />
              <MetricCard
                label="Recall"
                value="82.32%"
                tooltip="Out of all teams that actually won their matchup, the percentage the model successfully identified as the winner. Ideal: 100%"
              />
              <MetricCard
                label="ROC AUC"
                value="0.917"
                tooltip="Measures how well the model separates winners from losers across all possible decision thresholds — a score near 1.0 means it almost never confuses a winner for a loser. Ideal: 1.0"
              />
              <MetricCard
                label="Non-Upset Accuracy"
                value="90.65%"
                tooltip="How often the model correctly predicted the outcome of matchups where the favored team won (non-upsets). Ideal: 100%"
              />
              <MetricCard
                label="Upset Accuracy"
                value="67.24%"
                tooltip="How often the model correctly predicted the outcome of matchups where the underdog won (upsets). Ideal: 100%"
              />
            </div>

            <p className="info-model-detail">
              An accuracy of 83.15% means the model picks the correct winner in more than 5 out of every
              6 matchups. Precision (83.71%) and Recall (82.32%) are well balanced — the model is nearly
              as good at avoiding false calls as it is at finding real winners. The F1 Score (83.01%)
              confirms this balance. Most notably, the ROC AUC of 0.917 — where 1.0 is ideal — shows the
              model can reliably separate winners from losers across every possible decision threshold, not
              just the default 50/50 split. The model correctly identifies non-upsets 90.65% of the time,
              and still captures upsets at a 67.24% rate.
            </p>
          </div>
        </section>

        {/* ── Section 4: Wins Model ── */}
        <section className="info-section">
          <h2 className="info-section-title">Wins Model</h2>
          <div className="info-section-body">
            <p>
              One feature of the team analytics is their predicted wins in the tournament. For this, a
              Monte Carlo simulation of the entire tournament was performed using predictions from the
              Head to Head model for each game. 1.6 million simulations were run, and these results were
              used to evaluate the probability that a team would win 0, 1, 2, 3, 4, 5, or 6 games in
              the tournament.
            </p>
          </div>
        </section>

        {/* ── Section 5: More Info ── */}
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
// Renders the value prominently above a smaller label, with an optional hover tooltip.
// "Ideal: X" is bolded inline so it stands out within the tooltip text.
function MetricCard({ label, value, tooltip }) {
  const [desc, ideal] = tooltip ? tooltip.split(' Ideal:') : [null, null];

  return (
    <div className="info-metric-card">
      {tooltip && (
        <span className="info-metric-tooltip">
          {desc}{ideal && <strong> Ideal: {ideal}</strong>}
        </span>
      )}
      <span className="info-metric-value">{value}</span>
      <span className="info-metric-label">{label}</span>
    </div>
  );
}
