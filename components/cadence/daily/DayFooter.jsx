'use client'

import { fmtSaveTime } from './dailyHelpers'

/**
 * Day footer — hairline-top band beneath the last section.
 * Left: keyboard hints. Right: total entry count + last-saved time.
 */
export default function DayFooter({ entryCount = 0, savedAt }) {
  return (
    <div className="day-footer r r-9">
      <div className="keyhint">
        <kbd>←</kbd><kbd>→</kbd> Navigate days · <kbd>T</kbd> Jump to today
      </div>
      <div>
        {entryCount} {entryCount === 1 ? 'entry' : 'entries'} · last saved {savedAt ? fmtSaveTime(savedAt) : '—'}
      </div>
    </div>
  )
}
