'use client'

import { targetState } from './settings/settingsHelpers'

/**
 * Target dot (FC-083) — a small indicator beside a KPI value. The number
 * itself stays Ink (CADENCE.md rule 5); only the dot carries colour.
 *
 *   value  — the value AS DISPLAYED (rounded), so a tile showing 45 is judged
 *            as 45, never as 45.4
 *   def    — the target definition from settings ({ value, lowerIsBetter,
 *            isWeight, isTime })
 *   unit   — unit for the tooltip ("bpm", "ms", …)
 *
 * On target → moss. Amber and off both → clay (two states, as ratified).
 * No target or no value → nothing.
 */
export function targetDotState(value, def) {
  const s = targetState(value, def)
  if (!s) return null
  const on = s.band === 'on'
  const label = on ? 'On target'
    : def.isWeight ? 'Off target'
    : def.isTime ? 'Later than target'
    : def.lowerIsBetter ? 'Above target'
    : 'Below target'
  const t = def.value
  const title = def.isWeight ? `Target ${t} kg ± 0.5`
    : def.isTime ? `Target ${t} or earlier`
    : null
  return { on, label, title }
}

export default function TargetDot({ value, def, unit = '' }) {
  const st = targetDotState(value, def)
  if (!st) return null
  const title = st.title
    ?? `Target ${def.value}${unit ? ` ${unit}` : ''} or ${def.lowerIsBetter ? 'lower' : 'higher'}`
  return (
    <span
      className={`target-dot${st.on ? ' on' : ' off'}`}
      role="img"
      aria-label={st.label}
      title={title}
    />
  )
}
