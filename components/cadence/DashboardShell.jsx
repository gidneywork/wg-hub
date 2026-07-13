'use client'

import { useEffect } from 'react'
import './cadence.css'
import Sidebar from './Sidebar'
import { dlog } from './CadenceDialog'

/**
 * Cadence app shell — sidebar + main content slot.
 * Mockup: design/mockups/cadence-dashboard-v5.html lines 606–642.
 *
 * The [data-cadence] attribute is the scope for all cadence.css rules.
 * Non-dashboard legacy content rendered inside `children` should wrap
 * itself in [data-legacy="true"] so its CSS variables stay scoped and
 * do not override the Cadence token set.
 */
export default function DashboardShell({ view, setView, userName, userMeta, onSignOut, onThemeToggle, children }) {
  useEffect(() => { dlog('DashboardShell MOUNT'); return () => dlog('DashboardShell UNMOUNT') }, [])
  return (
    <div data-cadence>
      <div className="shell">
        <Sidebar
          view={view}
          setView={setView}
          userName={userName}
          userMeta={userMeta}
          onSignOut={onSignOut}
          onThemeToggle={onThemeToggle}
        />
        <main>
          {children}
          <div className="page-credit">lovingly vibe coded by gidney</div>
        </main>
      </div>
    </div>
  )
}
