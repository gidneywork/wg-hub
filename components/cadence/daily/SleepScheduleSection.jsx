'use client'

import { computeSleepDuration } from './dailyHelpers'

function fmtDuration({ hours, minutes }) {
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export default function SleepScheduleSection({ form, date, logs, onField }) {
  const bedtime  = form?.schedule?.bedtime  ?? null
  const wakeTime = form?.schedule?.wakeTime ?? null
  const dur = computeSleepDuration(bedtime, wakeTime)

  // Source attribution, same rule as BodySection's calories pill: the value
  // came from Whoop when the log itself didn't own it but the form now has one.
  const rawBed  = logs?.[date]?.schedule?.bedtime
  const rawWake = logs?.[date]?.schedule?.wakeTime
  const bedFromWhoop  = (rawBed  == null || rawBed  === '') && bedtime  != null && bedtime  !== ''
  const wakeFromWhoop = (rawWake == null || rawWake === '') && wakeTime != null && wakeTime !== ''

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
          {bedFromWhoop ? <div className="field-source-pill">From Whoop</div> : null}
        </div>

        <div className="schedule-card">
          <div className="schedule-card-label">Wake time</div>
          <input
            type="time"
            className="schedule-time-input"
            value={wakeTime ?? ''}
            onChange={e => onField('schedule', 'wakeTime', e.target.value || null)}
          />
          {wakeFromWhoop ? <div className="field-source-pill">From Whoop</div> : null}
        </div>

      </div>
      <div className="schedule-duration">{dur ? fmtDuration(dur) : '—'}</div>
    </section>
  )
}
