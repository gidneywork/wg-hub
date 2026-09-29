'use client'

import { targetText } from './settings/settingsHelpers'

/**
 * Target text (FC-086) — the small status line beside or under a value,
 * replacing the FC-083 target dot. The value itself stays Ink; only this
 * text carries colour: moss on target, clay off target (tokens, with dark
 * variants in CSS).
 *
 *   value  — the value AS DISPLAYED (rounded), so a tile showing 45 is judged
 *            as 45, never as 45.4
 *   def    — the target definition from settings ({ value, lowerIsBetter,
 *            isWeight, isTime })
 *   unit   — unit for "N <unit> above target" (lower-is-better only)
 *
 * No target or no value → nothing.
 */
export default function TargetText({ value, def, unit = '', className = '' }) {
  const t = targetText(value, def, unit)
  if (!t) return null
  return <span className={`target-text ${t.on ? 'on' : 'off'}${className ? ` ${className}` : ''}`}>{t.text}</span>
}
