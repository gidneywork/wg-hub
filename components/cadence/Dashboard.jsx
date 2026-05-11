'use client'

/**
 * Cadence dashboard — placeholder skeleton.
 * Phase B wires the shell. The sections below are stubbed out and will
 * be filled in by Phases C–F (hero + stat row → week + today cards →
 * trends → personal bests + recent).
 *
 * Mockup: design/mockups/cadence-dashboard-v5.html lines 644–980.
 */
export default function Dashboard() {
  const now = new Date()
  const stamp = now
    .toLocaleString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    })
    .toUpperCase()

  return (
    <>
      <header className="header r r-1">
        <h1 className="greeting">Good morning, <em>Will.</em></h1>
        <span className="stamp">{stamp}</span>
      </header>

      <section className="hero r r-2" aria-label="Recovery hero">
        {/* Phase C — hero recovery + 7-day sparkline */}
      </section>

      <section className="stat-row r r-3" aria-label="Daily stats">
        {/* Phase C — RHR · Weekly load · Sleep · HRV · Steps */}
      </section>

      <section className="week r r-4" aria-label="This week">
        <div className="section-head"><h2>This week</h2></div>
        {/* Phase D — 7-day plan grid */}
      </section>

      <section className="section r r-5" aria-label="Today">
        <div className="section-head"><h2>Today</h2></div>
        {/* Phase D — scheduled / fuel / journal cards */}
      </section>

      <section className="section r r-6" aria-label="Trends">
        <div className="section-head"><h2>Trends</h2></div>
        {/* Phase E — six trend charts */}
      </section>

      <section className="section r r-7" aria-label="Personal bests">
        <div className="section-head"><h2>Personal bests · this block</h2></div>
        {/* Phase F — running PB strip */}
      </section>

      <section className="section r r-8" aria-label="Recent">
        <div className="section-head"><h2>Recent</h2></div>
        {/* Phase F — activity table */}
      </section>
    </>
  )
}
