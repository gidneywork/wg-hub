'use client'

// Map between the Cadence sidebar's visual labels and the existing
// view keys used by WGHub. Keep these in source order from the mockup.
const NAV_TODAY = [
  { view: 'dashboard', label: 'Dashboard', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  ) },
  { view: 'planner', label: 'Planner', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
  ) },
  { view: 'plan', label: 'Training', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>
  ) },
  { view: 'log', label: 'Daily data', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
  ) },
]

const NAV_ANALYSE = [
  { view: 'charts', label: 'Charts', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18l4-8 4 4 4-12 4 16h2"/></svg>
  ) },
  { view: 'history', label: 'History', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 4-7"/></svg>
  ) },
  { view: 'journal', label: 'Journal', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h10M4 14h12M4 18h8"/></svg>
  ) },
  { view: 'tv', label: 'TV mode', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
  ) },
]

const NAV_ASSISTANT = [
  { view: '__talk', label: 'Talk to Cadence', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
  ) },
  { view: '__messages', label: 'Messages', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  ) },
  { view: 'assistant-config', label: 'Configuration', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.5"/><circle cx="15" cy="12" r="2.5"/><circle cx="9" cy="18" r="2.5"/></svg>
  ) },
]

function NavGroup({ eyebrow, items, view, setView }) {
  return (
    <div className="nav-section">
      <div className="nav-eyebrow">{eyebrow}</div>
      <ul className="nav-list">
        {items.map(item => (
          <li key={item.view}>
            <button
              type="button"
              className={view === item.view ? 'active' : ''}
              onClick={() => setView(item.view)}
            >
              {item.icon}
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Sidebar({ view, setView, userName = 'You', userMeta = 'PRO · GMT', onSignOut, onThemeToggle }) {
  const initial = (userName || 'W').trim().charAt(0).toUpperCase() || 'W'

  return (
    <aside className="sidebar">
      <div className="wordmark">cadence<span className="dot" /></div>

      <NavGroup eyebrow="Today"     items={NAV_TODAY}     view={view} setView={setView} />
      <NavGroup eyebrow="Analyse"   items={NAV_ANALYSE}   view={view} setView={setView} />
      <NavGroup eyebrow="Assistant" items={NAV_ASSISTANT} view={view} setView={setView} />

      <div className="sidebar-footer">
        <button
          type="button"
          className="avatar"
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
        >
          {initial}
        </button>
        <div className="user-info">
          <div className="user-name">{userName}</div>
          <div className="user-meta">{userMeta}</div>
        </div>
        <button
          type="button"
          className="settings-cog"
          onClick={() => setView('settings')}
          aria-label="Settings"
          title="Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={onThemeToggle}
          aria-label="Toggle theme"
          title="Toggle light/dark"
        >
          <svg className="t-icon t-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          <svg className="t-icon t-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </aside>
  )
}
