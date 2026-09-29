'use client'

import { useEffect, useState } from 'react'
import { TARGET_SPECS, targetState } from './settingsHelpers'
import TargetText from '../TargetText'

/**
 * Single target row.
 *
 *   targetKey   — key into TARGET_SPECS and into local settings
 *   def         — full target definition from local settings
 *                 ({ value, label, unit, lowerIsBetter, isWeight })
 *   actual      — live current value (number or null)
 *   onChange    — (newValue: number | "HH:MM" for time targets) => void
 *   rowIndex    — absolute row index for staggered bar animation
 */
export default function TargetRow({ targetKey, def, actual, onChange, rowIndex }) {
  const spec = TARGET_SPECS[targetKey]
  if (!spec) return null

  const state = targetState(actual, def)
  const hasData = state != null
  const targetPct = state?.pct ?? 0
  const band = state?.band || null

  // Animate width from 0 → targetPct after page settles (500ms) with a
  // 50ms stagger per row, matching the mockup's load script.
  const [renderedPct, setRenderedPct] = useState(0)
  useEffect(() => {
    const delay = 500 + rowIndex * 50
    const id = setTimeout(() => setRenderedPct(targetPct), delay)
    return () => clearTimeout(id)
  }, [targetPct, rowIndex])

  // Two states, agreeing with the target text (FC-086): moss on, clay off.
  const fillClass = `target-fill${band === 'amber' || band === 'off' ? ' off' : ''}`

  return (
    <div className="target-row">
      <div>
        <div className="target-label">
          <span>{spec.label}</span>
          {spec.pill ? (
            <span className={`target-pill${spec.pill.clayFlag ? ' clay-flag' : ''}`}>
              {spec.pill.text}
            </span>
          ) : null}
        </div>
        <div className="input-group">
          {spec.input === 'time' ? (
            <input
              className="target-field"
              type="time"
              value={def?.value ?? ''}
              onChange={e => onChange(e.target.value)}
            />
          ) : (
            <input
              className="target-field"
              type="number"
              step={spec.step}
              min={0}
              value={def?.value ?? ''}
              onChange={e => onChange(parseFloat(e.target.value) || 0)}
            />
          )}
          <span className="target-unit">{spec.unit}</span>
        </div>
      </div>

      <div className="target-state">
        <div className="target-bar">
          <div className={fillClass} style={{ width: `${renderedPct}%` }} />
        </div>
        {hasData ? (
          <div className="target-helper">
            {spec.prefix(def.value)} · {spec.actual(actual)} · <TargetText value={actual} def={def} unit={def.lowerIsBetter ? spec.unit : ''} />
          </div>
        ) : (
          <div className="target-helper">
            <span className="no-data">No data yet</span>
          </div>
        )}
      </div>
    </div>
  )
}
