'use client'

import { evaluateCalorieDelta } from '../../../lib/calories'

const MODES = [
  { key: 'deficit',  label: 'Deficit'  },
  { key: 'maintain', label: 'Maintain' },
  { key: 'surplus',  label: 'Surplus'  },
]

function formatStatusLine(mode, status, delta) {
  if (!mode) return null
  if (status === 'no_data') return 'No data yet'
  if (mode === 'maintain' && status === 'on_target') return 'Today: within target'
  return `Today: ${Math.abs(delta).toLocaleString('en-GB')} kcal ${delta < 0 ? 'deficit' : 'surplus'}`
}

export default function CalorieModeSection({ mode, onChange, logs, activities }) {
  const today = new Date().toLocaleDateString('en-CA')
  const log = logs?.[today]
  const calsIn = parseFloat(log?.nutrition?.calories)
  const inVal = isFinite(calsIn) && calsIn > 0 ? calsIn : null
  const todayActs = (activities || []).filter(a => (a.start_date || '').split('T')[0] === today)
  const calsOut = todayActs.reduce((s, a) => s + (parseFloat(a.data?.calories) || 0), 0)
  const outVal = calsOut > 0 ? calsOut : null

  const { status, delta } = evaluateCalorieDelta(inVal, outVal, mode)
  const statusLine = formatStatusLine(mode, status, delta)

  return (
    <section className="settings-section r r-6">
      <div className="section-head">
        <span className="section-label">Calorie target mode</span>
      </div>
      <div className="section-body">
        <div className="cal-mode-row">
          <div className="toggle">
            {MODES.map(m => (
              <button
                key={m.key}
                type="button"
                className={mode === m.key ? 'active' : ''}
                onClick={() => onChange(mode === m.key ? null : m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {statusLine && (
            <span className="cal-mode-status">{statusLine}</span>
          )}
        </div>
      </div>
    </section>
  )
}
