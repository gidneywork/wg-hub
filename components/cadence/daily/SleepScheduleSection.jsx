'use client'

import { computeSleepDuration } from './dailyHelpers'

function fmtDuration({ hours, minutes }) {
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export default function SleepScheduleSection({ form, onField }) {
  const bedtime  = form?.schedule?.bedtime  ?? null
  const wakeTime = form?.schedule?.wakeTime ?? null
  const dur = computeSleepDuration(bedtime, wakeTime)

  return (
    <section className="section r r-6">
      <div className="section-head">
        <span className="title">Sleep schedule</span>
        <span className="meta">2 fields · manual entry</span>
      </div>
      <div className="field-grid cols-2">

        <div className="schedule-card">
          <div className="schedule-card-label">Bedtime</div>
          <input
            type="time"
            className="schedule-time-input"
            value={bedtime ?? ''}
            onChange={e => onField('schedule', 'bedtime', e.target.value || null)}
          />
        </div>

        <div className="schedule-card">
          <div className="schedule-card-label">Wake time</div>
          <input
            type="time"
            className="schedule-time-input"
            value={wakeTime ?? ''}
            onChange={e => onField('schedule', 'wakeTime', e.target.value || null)}
          />
        </div>

      </div>
      <div className="schedule-duration">{dur ? fmtDuration(dur) : '—'}</div>
    </section>
  )
}
