'use client'

import Hero from './Hero'
import StatRow from './StatRow'
import WeekGrid from './WeekGrid'
import TodayCards from './TodayCards'
import Trends from './Trends'
import PersonalBests from './PersonalBests'
import Recent from './Recent'

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
  // Mockup stamp format: "MON 11 MAY · 09:42 GMT"
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
  const dayNum = now.toLocaleDateString('en-GB', { day: '2-digit' })
  const monthShort = now.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
  const hhmm = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const tz = (now.toLocaleTimeString('en-GB', { timeZoneName: 'short' }).split(' ').pop() || '').toUpperCase()
  const stamp = `${weekday} ${dayNum} ${monthShort} · ${hhmm} ${tz}`

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

      <WeekGrid plan={plan} />

      <TodayCards plan={plan} logs={logs} activities={activities} setView={setView} />

      <Trends logs={logs} whoopData={whoopData} activities={activities} settings={settings} plan={plan} />

      <PersonalBests activities={activities} />

      <Recent activities={activities} />
    </>
  )
}
