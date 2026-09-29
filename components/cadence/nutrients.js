/**
 * Highlighted nutrients (FC-085) — pure helpers shared by Daily Data, the
 * Dashboard Nutrients card, TV Mode and Charts.
 *
 * Cadence mirrors the Cronometer diary's "Highlighted nutrients" panel:
 *   list      cronometer_data.highlighted — Cronometer nutrient ids, slot order
 *   targets   cronometer_data.micro_targets — { "<id>": { min, max } }
 *   consumed  cronometer_data.nutrients — the daily-summary export row
 *             (includes supplements; verified against the panel 2026-09-29)
 * All three are written by the sync on today's row. A date without its own
 * snapshot (e.g. before FC-085) uses the most recent one stored.
 *
 * Direction comes from the target: min only = at least; min and max = a
 * range; max only = a limit; neither = no target. % is consumed ÷ min (or ÷
 * max when there is only a max), as Cronometer's panel shows it.
 */

// Cronometer nutrient id → Cadence name (British, sentence case), the export
// column that carries its consumed value, and Cronometer's unit.
export const NUTRIENTS = {
  203: { name: 'Protein',             column: 'Protein (g)',                 unit: 'g' },
  204: { name: 'Fat',                 column: 'Fat (g)',                     unit: 'g' },
  205: { name: 'Carbs',               column: 'Carbs (g)',                   unit: 'g' },
  208: { name: 'Energy',              column: 'Energy (kcal)',               unit: 'kcal' },
  209: { name: 'Starch',              column: 'Starch (g)',                  unit: 'g' },
  221: { name: 'Alcohol',             column: 'Alcohol (g)',                 unit: 'g' },
  255: { name: 'Water',               column: 'Water (g)',                   unit: 'g' },
  262: { name: 'Caffeine',            column: 'Caffeine (mg)',               unit: 'mg' },
  269: { name: 'Sugars',              column: 'Sugars (g)',                  unit: 'g' },
  291: { name: 'Fibre',               column: 'Fiber (g)',                   unit: 'g' },
  301: { name: 'Calcium',             column: 'Calcium (mg)',                unit: 'mg' },
  303: { name: 'Iron',                column: 'Iron (mg)',                   unit: 'mg' },
  304: { name: 'Magnesium',           column: 'Magnesium (mg)',              unit: 'mg' },
  305: { name: 'Phosphorus',          column: 'Phosphorus (mg)',             unit: 'mg' },
  306: { name: 'Potassium',           column: 'Potassium (mg)',              unit: 'mg' },
  307: { name: 'Sodium',              column: 'Sodium (mg)',                 unit: 'mg' },
  309: { name: 'Zinc',                column: 'Zinc (mg)',                   unit: 'mg' },
  312: { name: 'Copper',              column: 'Copper (mg)',                 unit: 'mg' },
  315: { name: 'Manganese',           column: 'Manganese (mg)',              unit: 'mg' },
  317: { name: 'Selenium',            column: 'Selenium (µg)',               unit: 'µg' },
  320: { name: 'Vitamin A',           column: 'Vitamin A (µg)',              unit: 'µg' },
  323: { name: 'Vitamin E',           column: 'Vitamin E (mg)',              unit: 'mg' },
  324: { name: 'Vitamin D',           column: 'Vitamin D (IU)',              unit: 'IU' },
  401: { name: 'Vitamin C',           column: 'Vitamin C (mg)',              unit: 'mg' },
  404: { name: 'Vitamin B1',          column: 'B1 (Thiamine) (mg)',          unit: 'mg' },
  405: { name: 'Vitamin B2',          column: 'B2 (Riboflavin) (mg)',        unit: 'mg' },
  406: { name: 'Vitamin B3',          column: 'B3 (Niacin) (mg)',            unit: 'mg' },
  410: { name: 'Vitamin B5',          column: 'B5 (Pantothenic Acid) (mg)',  unit: 'mg' },
  415: { name: 'Vitamin B6',          column: 'B6 (Pyridoxine) (mg)',        unit: 'mg' },
  417: { name: 'Folate',              column: 'Folate (µg)',                 unit: 'µg' },
  418: { name: 'Vitamin B12',         column: 'B12 (Cobalamin) (µg)',        unit: 'µg' },
  430: { name: 'Vitamin K',           column: 'Vitamin K (µg)',              unit: 'µg' },
  501: { name: 'Tryptophan',          column: 'Tryptophan (g)',              unit: 'g' },
  502: { name: 'Threonine',           column: 'Threonine (g)',               unit: 'g' },
  503: { name: 'Isoleucine',          column: 'Isoleucine (g)',              unit: 'g' },
  504: { name: 'Leucine',             column: 'Leucine (g)',                 unit: 'g' },
  505: { name: 'Lysine',              column: 'Lysine (g)',                  unit: 'g' },
  506: { name: 'Methionine',          column: 'Methionine (g)',              unit: 'g' },
  507: { name: 'Cystine',             column: 'Cystine (g)',                 unit: 'g' },
  508: { name: 'Phenylalanine',       column: 'Phenylalanine (g)',           unit: 'g' },
  509: { name: 'Tyrosine',            column: 'Tyrosine (g)',                unit: 'g' },
  510: { name: 'Valine',              column: 'Valine (g)',                  unit: 'g' },
  512: { name: 'Histidine',           column: 'Histidine (g)',               unit: 'g' },
  601: { name: 'Cholesterol',         column: 'Cholesterol (mg)',            unit: 'mg' },
  605: { name: 'Trans fat',           column: 'Trans-Fats (g)',              unit: 'g' },
  606: { name: 'Saturated fat',       column: 'Saturated (g)',               unit: 'g' },
  645: { name: 'Monounsaturated fat', column: 'Monounsaturated (g)',         unit: 'g' },
  646: { name: 'Polyunsaturated fat', column: 'Polyunsaturated (g)',         unit: 'g' },
}

// One decimal, as Cronometer's panel shows it. State is judged on this
// displayed value (FC-083: a value is judged as shown).
export const roundNutrient = v => Math.round(v * 10) / 10
export function formatNutrient(v) {
  return v == null ? '—' : roundNutrient(v).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const num = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

// State of one consumed value against its target.
//   { kind: 'none' }                                — no target
//   { kind: 'min'|'range'|'max', pct, state }        — state: 'on'|'low'|'above'
// pct is null when there is no consumed value.
export function nutrientState(consumed, target) {
  const min = num(target?.min), max = num(target?.max)
  if (min == null && max == null) return { kind: 'none', pct: null, state: null }
  const kind = min != null && max != null ? 'range' : min != null ? 'min' : 'max'
  if (consumed == null) return { kind, pct: null, state: null }
  // % from the exact value (as Cronometer's table shows it); the state is
  // judged on the displayed, rounded value.
  const v = roundNutrient(consumed)
  const base = min != null && min > 0 ? min : max
  const pct = base ? (consumed / base) * 100 : null
  const state = min != null && v < min ? 'low' : max != null && v > max ? 'above' : 'on'
  return { kind, pct, state }
}

export const STATE_LABEL = { on: 'On target', low: 'Below target', above: 'Above limit' }

// "At least 38 g" · "1000–2500 mg" · "Up to 2300 mg" · null
export function describeTarget(target, unit) {
  const min = num(target?.min), max = num(target?.max)
  const f = x => x.toLocaleString('en-GB', { maximumFractionDigits: 1 })
  if (min != null && max != null) return `${f(min)}–${f(max)} ${unit}`
  if (min != null) return `At least ${f(min)} ${unit}`
  if (max != null) return `Up to ${f(max)} ${unit}`
  return null
}

// The snapshot (list + targets) in force for a date: the row's own, else the
// most recent stored.
export function snapshotForDate(date, cronometerData) {
  const own = cronometerData?.[date]
  const has = r => Array.isArray(r?.highlighted) && r.highlighted.length
  if (has(own)) return { highlighted: own.highlighted, targets: own.micro_targets || {} }
  const latest = Object.keys(cronometerData || {}).sort().reverse().map(d => cronometerData[d]).find(has)
  return latest ? { highlighted: latest.highlighted, targets: latest.micro_targets || {} } : null
}

export function consumedFor(id, row) {
  const col = NUTRIENTS[id]?.column
  return col ? num(row?.nutrients?.[col]) : null
}

// Highlighted nutrients for one date or a period (dates = array of ISO days).
// A period averages consumed over the days that have a value for that
// nutrient; targets and the list come from the latest date's snapshot.
// Returns { items, unmapped } or null when nothing has synced yet.
//   item: { id, name, unit, consumed, target, kind, pct, state }
export function highlightedNutrients(dates, cronometerData) {
  const days = [].concat(dates).filter(Boolean).sort()
  if (!days.length) return null
  const snap = snapshotForDate(days[days.length - 1], cronometerData)
  if (!snap) return null
  const items = [], unmapped = []
  for (const id of snap.highlighted) {
    const meta = NUTRIENTS[id]
    if (!meta) { unmapped.push(id); continue }
    const vals = days.map(d => consumedFor(id, cronometerData?.[d])).filter(v => v != null)
    const consumed = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const target = snap.targets[String(id)] || null
    items.push({ id, name: meta.name, unit: meta.unit, consumed, target, ...nutrientState(consumed, target) })
  }
  return { items, unmapped }
}

// "Nutrients: 5 of 8 on target · low: Fibre, Vitamin A, Potassium"
// Counts only nutrients that have a target and a value. Null when none do.
export function nutrientsSummary(result) {
  const judged = (result?.items || []).filter(i => i.state)
  if (!judged.length) return null
  const on = judged.filter(i => i.state === 'on').length
  const low = judged.filter(i => i.state === 'low').map(i => i.name)
  const above = judged.filter(i => i.state === 'above').map(i => i.name)
  let s = `Nutrients: ${on} of ${judged.length} on target`
  if (low.length) s += ` · low: ${low.join(', ')}`
  if (above.length) s += ` · above limit: ${above.join(', ')}`
  return s
}
