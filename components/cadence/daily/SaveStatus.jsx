'use client'

import { fmtSaveTime } from './dailyHelpers'

/**
 * Save-status pill — top-right of the page head.
 *
 *   state    'idle' → pulsing moss dot + "All saved · HH:MM"
 *            'saving' → sand dot + "Saving…"
 *   savedAt  Date of the most recent successful save (drives HH:MM)
 *
 * The pulse animation lives in cadence.css as @keyframes dailyPulse
 * (2.4s cycle, ~0.4Hz, moss-glow box-shadow halo expansion).
 */
export default function SaveStatus({ state = 'idle', savedAt = new Date() }) {
  const saving = state === 'saving'
  return (
    <div className={`save-status${saving ? ' saving' : ''}`}>
      <span className="dot" />
      <span className="text">
        {saving ? 'Saving…' : `All saved · ${fmtSaveTime(savedAt)}`}
      </span>
    </div>
  )
}
