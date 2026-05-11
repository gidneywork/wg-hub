'use client'

import Hero from './Hero'
import StatRow from './StatRow'

/**
 * Cadence dashboard.
 * Phases C–F fill in sections in source order matching
 * design/mockups/cadence-dashboard-v5.html lines 644–980.
 *
 * Reveal classes (.r .r-N) mirror the mockup's stagger ladder. Note
 * the .hero <section> is the only one without a .r class on the
 * outer element — the mockup applies .r-2 / .r-3 to the inner columns
 * so the text and the chart enter on slightly different beats.
 */
export default function Dashboard({ logs, settings, activities, whoopData, plan, setView }) {
  const now = new Date()
  const stamp = now
    .toLocaleString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
    })
    .toUpperCase()

  const hour = now.getHours()
  const greetingWord = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <header className="header r r-1">
        <h1 className="greeting">{greetingWord}, <em>Will.</em></h1>
        <span className="stamp">{stamp}</span>
      </header>

      <Hero logs={logs} whoopData={whoopData} />

      <StatRow logs={logs} whoopData={whoopData} settings={settings} activities={activities} />

      <section className="week r r-5" aria-label="This week">
        <div className="section-head"><h2>This week</h2></div>
        {/* Phase D — 7-day plan grid */}
      </section>

      <section className="section r r-6" aria-label="Today">
        <div className="section-head"><h2>Today</h2></div>
        {/* Phase D — scheduled / fuel / journal cards */}
      </section>

      <section className="section r r-7" aria-label="Trends">
        <div className="section-head"><h2>Trends</h2></div>
        {/* Phase E — six trend charts */}
      </section>

      <section className="section r r-8" aria-label="Personal bests">
        <div className="section-head"><h2>Personal bests · this block</h2></div>
        {/* Phase F — running PB strip */}
      </section>

      <section className="section r r-9" aria-label="Recent">
        <div className="section-head"><h2>Recent</h2></div>
        {/* Phase F — activity table */}
      </section>
    </>
  )
}
