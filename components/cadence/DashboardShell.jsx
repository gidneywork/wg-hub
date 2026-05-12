'use client'

import './cadence.css'
import Sidebar from './Sidebar'

/**
 * Cadence app shell — sidebar + main content slot.
 * Mockup: design/mockups/cadence-dashboard-v5.html lines 606–642.
 *
 * The [data-cadence] attribute is the scope for all cadence.css rules.
 * Non-dashboard legacy content rendered inside `children` should wrap
 * itself in [data-legacy="true"] so its CSS variables stay scoped and
 * do not override the Cadence token set.
 */
export default function DashboardShell({ view, setView, userName, userMeta, onSignOut, children }) {
  return (
    <div data-cadence>
      <div className="shell">
        <Sidebar
          view={view}
          setView={setView}
          userName={userName}
          userMeta={userMeta}
          onSignOut={onSignOut}
        />
        <main>
          {children}
          <div className="page-credit">lovingly vibe coded by gidney</div>
        </main>
      </div>
    </div>
  )
}
