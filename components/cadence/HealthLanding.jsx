'use client'

export default function HealthLanding({ setView }) {
  return (
    <div>
      <header className="header r r-1">
        <div>
          <p className="stamp">Pillar</p>
          <h1 className="greeting">Health</h1>
          <p className="pillar-tag">The body's signals. Recovery, sleep, biomarkers, cognition.</p>
        </div>
      </header>

      <section className="section r r-2">
        <div className="section-head">
          <h2>HRV trend</h2>
        </div>
        <div className="card">
          <p className="pillar-placeholder" style={{ marginBottom: 14 }}>
            Heart rate variability and resting heart rate — your primary recovery indicators.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setView('charts')}
          >
            View HRV chart →
          </button>
        </div>
      </section>

      <section className="section r r-3">
        <div className="section-head">
          <h2>More Health reports</h2>
        </div>
        <p className="pillar-placeholder">Coming soon.</p>
      </section>
    </div>
  )
}
