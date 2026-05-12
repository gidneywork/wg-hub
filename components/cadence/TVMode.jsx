'use client'

import { useState, useEffect } from 'react'
import './tv-mode.css'

const RANGES = ['7D', '30D', '6M', '1Y', 'YTD']

export default function TVMode({ logs, settings, plan, activities, whoopData, setView }) {
  const [range, setRange]           = useState('7D')
  const [progressKey, setProgressKey] = useState(0)
  const [dataChanging, setDataChanging] = useState(false)
  const [clockTime, setClockTime]   = useState('')
  const [clockDate, setClockDate]   = useState('')

  // ── Dark theme override (non-persisting) ────────────────────────
  // On mount: save the current DOM attr, force dark. On unmount:
  // restore the saved attr. localStorage is never touched here —
  // the user's stored preference survives their time in TV mode.
  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', 'dark')
    return () => document.documentElement.setAttribute('data-theme', saved || 'light')
  }, [])

  // ── Live clock ──────────────────────────────────────────────────
  useEffect(() => {
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    function update() {
      const now = new Date()
      const hh  = String(now.getHours()).padStart(2, '0')
      const mm  = String(now.getMinutes()).padStart(2, '0')
      setClockTime(`${hh}:${mm}`)
      setClockDate(`${DAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`)
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])

  // ── ESC key → exit TV mode ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setView('dashboard') }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setView])

  // ── Theme toggle — transient (DOM only; localStorage untouched) ─
  function handleThemeToggle() {
    const current = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
  }

  // ── Range change ────────────────────────────────────────────────
  // progressKey forces the active button to remount so the CSS
  // `::after` progress bar animation always restarts from 0%.
  // dataChanging triggers the .cycleable breathing transition.
  // (Auto-advance timer is added in TV: 7.)
  function changeRange(r) {
    if (r === range) return
    setProgressKey(k => k + 1)
    setDataChanging(true)
    setTimeout(() => {
      setRange(r)
      setDataChanging(false)
    }, 280)
  }

  return (
    <div className={`tv-page${dataChanging ? ' data-changing' : ''}`}>
      <div className="tv-shell">

        <header className="top">

          {/* Brand wordmark + tagline */}
          <div className="brand r r-1">
            <div className="wordmark">
              cadence<span className="dot" />
            </div>
            <div className="tagline">
              <span className="pulse" />
              Performance display · auto-refreshes every 30s
            </div>
          </div>

          {/* Range toggle — 5 buttons, active gets progress bar animation */}
          <div className="tv-range r r-1" role="tablist">
            {RANGES.map(r => (
              <button
                key={r === range ? `${r}-${progressKey}` : r}
                data-range={r}
                className={r === range ? 'active' : ''}
                role="tab"
                aria-selected={r === range}
                onClick={() => changeRange(r)}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Clock + theme toggle */}
          <div className="clock-area r r-2">
            <div className="clock">
              <div className="time">{clockTime}</div>
              <div className="date">{clockDate}</div>
            </div>
            <button
              className="theme-toggle"
              onClick={handleThemeToggle}
              aria-label="Toggle theme"
              title="Toggle light/dark"
            >
              {/* Sun — visible on dark theme */}
              <svg className="t-icon t-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
              {/* Moon — visible on light theme */}
              <svg className="t-icon t-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
          </div>

        </header>

        {/* Stat grid — wired in TV: 3 */}
        <section className="stat-grid" />

        {/* Bottom grid — wired in TV: 4–6 */}
        <section className="bottom-grid" />

      </div>

      <button className="tv-exit-hint" onClick={() => setView('dashboard')}>
        <kbd>ESC</kbd>Exit TV mode
      </button>
    </div>
  )
}
