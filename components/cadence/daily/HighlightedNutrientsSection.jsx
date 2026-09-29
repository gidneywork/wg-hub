'use client'

import {
  highlightedNutrients,
  formatNutrient,
  describeTarget,
  nutrientTargetText,
} from '../nutrients'

/**
 * Highlighted nutrients (FC-085) — read-only, below Nutrition. Mirrors the
 * Cronometer diary's panel: the same nutrients, in the same order, against
 * Cronometer's targets. Each card: consumed (Ink), a consumed / target bar,
 * and the FC-086 target text under it, direction-aware — "34% of target"
 * (at least), "107% of min" / "Above limit" (range), "N% of limit" (limit),
 * moss on target, clay off.
 * A nutrient with no target shows its value and "No target" — no bar, no
 * target text.
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
  const tt = nutrientTargetText(item)
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
      </div>
      {hasTarget ? (
        <div className="progress" aria-hidden="true">
          <div className={`fill${fill}`} style={{ width: `${Math.min(100, item.pct ?? 0)}%` }} />
        </div>
      ) : null}
      <div className="helper">
        {!hasTarget ? <span>No target</span>
          : !tt ? <span>Nothing logged</span>
          : <span className={`target-text ${tt.on ? 'on' : 'off'}`}>{tt.text}</span>}
      </div>
    </div>
  )
}
