'use client'

import {
  highlightedNutrients,
  formatNutrient,
  describeTarget,
  STATE_LABEL,
} from '../nutrients'

/**
 * Highlighted nutrients (FC-085) — read-only, below Nutrition. Mirrors the
 * Cronometer diary's panel: the same nutrients, in the same order, against
 * Cronometer's targets. Each card: consumed (Ink), a consumed / target bar
 * with %, and the FC-083 target dot, direction-aware:
 *   at least / range  below the minimum → clay dot, "Below target"
 *   range / limit     above the maximum → clay dot, "Above limit"
 *   otherwise         moss dot, "On target"
 * A nutrient with no target shows its value and "No target" — no bar, no dot.
 * Always shown: before the first sync, Cronometer's default eight with "—"
 * ("Waiting for the first Cronometer sync"); on a date with no Cronometer
 * data, the names with "—" ("No Cronometer data for this day").
 */
export default function HighlightedNutrientsSection({ date, cronometerData }) {
  const result = highlightedNutrients([date], cronometerData)
  const blank = result.status !== 'ok'

  return (
    <section className="section r r-7">
      <div className="section-head">
        <span className="title">Highlighted nutrients</span>
        <span className="meta">
          <span>{result.items.length} nutrients · from Cronometer</span>
        </span>
      </div>
      <div className="field-grid cols-4">
        {result.items.map(item => <NutrientCard key={item.id} item={item} blank={blank} />)}
      </div>
      {blank ? (
        <p className="nutrients-note">
          {result.status === 'pending' ? 'Waiting for the first Cronometer sync' : 'No Cronometer data for this day'}
        </p>
      ) : null}
      {result.unmapped.length ? (
        <p className="nutrients-note">
          {result.unmapped.length === 1 ? '1 highlighted nutrient isn’t' : `${result.unmapped.length} highlighted nutrients aren’t`} in Cronometer’s export, so {result.unmapped.length === 1 ? 'it isn’t' : 'they aren’t'} shown.
        </p>
      ) : null}
    </section>
  )
}

function NutrientCard({ item, blank }) {
  if (blank) {
    return (
      <div className="field-card nutrient-card">
        <div className="row"><span className="label">{item.name}</span></div>
        <div className="nutrient-value">
          <span className="num">—</span>
          <span className="unit">{item.unit}</span>
        </div>
      </div>
    )
  }
  const hasTarget = item.kind !== 'none'
  const desc = hasTarget ? describeTarget(item.target, item.unit) : null
  const pct = item.pct != null ? Math.round(item.pct) : null
  const fill = item.state === 'low' || item.state === 'above' ? ' clay' : ''
  return (
    <div className="field-card nutrient-card">
      <div className="row">
        <span className="label">{item.name}</span>
        {desc ? <span className="target">{desc}</span> : null}
      </div>
      <div className="nutrient-value">
        <span className="num">{formatNutrient(item.consumed)}</span>
        <span className="unit">{item.unit}</span>
        {hasTarget && item.state ? (
          <span
            className={`target-dot ${item.state === 'on' ? 'on' : 'off'}`}
            role="img"
            aria-label={STATE_LABEL[item.state]}
            title={desc || undefined}
          />
        ) : null}
      </div>
      {hasTarget ? (
        <div className="progress" aria-hidden="true">
          <div className={`fill${fill}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
        </div>
      ) : null}
      <div className="helper">
        <span>
          {!hasTarget ? 'No target'
            : pct == null ? 'Nothing logged'
            : `${pct}% · ${STATE_LABEL[item.state]}`}
        </span>
      </div>
    </div>
  )
}
