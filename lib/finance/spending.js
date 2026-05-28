// Pure helpers for the Spending tab — no DB access.

// Mirrors cadence-tokens.css --d1 through --d7 (light theme values).
// Cannot use CSS custom properties in SVG fill attributes.
export const CHART_PALETTE = [
  '#6B7A5A', // d1 — moss
  '#B96A4D', // d2 — clay
  '#4A5F6E', // d3 — slate
  '#C9A24E', // d4 — sand
  '#8A7396', // d5 — mauve
  '#5F5C55', // d6 — stone
  '#A3493D', // d7 — brick
  '#B8B3A7', // neutral — Other bucket
]

/**
 * Returns YYYY-MM-DD for a Date object using local time (not UTC).
 */
export function toYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns { from: Date|null, to: Date } bounds for a time range selector value.
 * All dates are local midnight. 'all' returns from=null.
 */
export function getTimeRangeBounds(timeRange) {
  const now = new Date()
  const to  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let from
  switch (timeRange) {
    case '30d': from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); break
    case '3m':  from = new Date(to.getFullYear(), to.getMonth() - 3, to.getDate()); break
    case '6m':  from = new Date(to.getFullYear(), to.getMonth() - 6, to.getDate()); break
    case 'ytd': from = new Date(to.getFullYear(), 0, 1); break
    default:    from = null
  }
  return { from, to }
}

/**
 * Buckets spending transactions by YYYY-MM and category, keeping topN categories
 * and merging the rest into 'Other'.
 *
 * Returns { data, cats }:
 *   data — [{ month: 'YYYY-MM', [catName]: pence, ... }] sorted asc by month
 *   cats — ordered category names for rendering Bar components (most-spent first, Other last)
 *
 * Note: colour mapping is period-relative (rank 0 → palette slot 0). The same
 * category may get a different colour when the time range changes — acceptable for v1.
 */
export function bucketByMonthAndCategory(transactions, categories, topN = 7) {
  const catName = id => {
    if (!id) return 'Uncategorised'
    return categories.find(c => c.id === id)?.name ?? 'Uncategorised'
  }

  // Global totals for the period to determine top N categories
  const globalTotals = {}
  for (const tx of transactions) {
    const name = catName(tx.category_id)
    globalTotals[name] = (globalTotals[name] ?? 0) + Math.abs(Number(tx.amount_pence))
  }

  const ranked  = Object.entries(globalTotals).sort((a, b) => b[1] - a[1])
  const topCats = ranked.slice(0, topN).map(([name]) => name)
  const topSet  = new Set(topCats)
  const hasOther = ranked.length > topN

  // Group by YYYY-MM
  const monthMap = {}
  for (const tx of transactions) {
    const month  = tx.tx_date.slice(0, 7)
    const raw    = catName(tx.category_id)
    const bucket = topSet.has(raw) ? raw : 'Other'
    if (!monthMap[month]) monthMap[month] = {}
    monthMap[month][bucket] = (monthMap[month][bucket] ?? 0) + Math.abs(Number(tx.amount_pence))
  }

  const data = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, breakdown]) => ({ month, ...breakdown }))

  const cats = hasOther ? [...topCats, 'Other'] : topCats

  return { data, cats }
}

/**
 * Aggregates spending by category for the period.
 * Returns [{ name, amount }] sorted by amount descending (all non-zero categories).
 */
export function aggregateByCategory(transactions, categories) {
  const catName = id => {
    if (!id) return 'Uncategorised'
    return categories.find(c => c.id === id)?.name ?? 'Uncategorised'
  }
  const totals = {}
  for (const tx of transactions) {
    const name = catName(tx.category_id)
    totals[name] = (totals[name] ?? 0) + Math.abs(Number(tx.amount_pence))
  }
  return Object.entries(totals)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Aggregates spending by merchant (merchant_clean falling back to description).
 * Returns top `limit` merchants: [{ rank, merchant, total, txCount }].
 */
export function aggregateMerchants(transactions, limit = 10) {
  const totals = {}
  const counts = {}
  for (const tx of transactions) {
    const key = tx.merchant_clean || tx.description || 'Unknown'
    totals[key] = (totals[key] ?? 0) + Math.abs(Number(tx.amount_pence))
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([merchant, total], idx) => ({ rank: idx + 1, merchant, total, txCount: counts[merchant] }))
}

/**
 * Formats a pence value to a compact GBP string for chart axis labels.
 * 150000 → "£1.5k", 1500000 → "£15k", 9900 → "£99"
 */
export function penceToShort(pence) {
  const pounds = Math.abs(Number(pence)) / 100
  if (pounds >= 10000) return `£${Math.round(pounds / 1000)}k`
  if (pounds >= 1000)  return `£${(pounds / 1000).toFixed(1)}k`
  return `£${Math.round(pounds)}`
}

/**
 * Sign-aware variant of penceToShort for axes where sign matters (e.g. net worth).
 * -2500000 → "-£25k"
 */
export function penceToShortSigned(pence) {
  const n      = Number(pence)
  const sign   = n < 0 ? '-' : ''
  const pounds = Math.abs(n) / 100
  if (pounds >= 10000) return `${sign}£${Math.round(pounds / 1000)}k`
  if (pounds >= 1000)  return `${sign}£${(pounds / 1000).toFixed(1)}k`
  return `${sign}£${Math.round(pounds)}`
}

/**
 * Formats a YYYY-MM string to a short month label.
 * '2026-03' → 'Mar 26'
 */
export function fmtMonthShort(yyyymm) {
  if (!yyyymm) return ''
  const [year, month] = yyyymm.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

/**
 * Formats a YYYY-MM-DD string to a short date label.
 * '2026-05-28' → '28 May'
 */
export function fmtDateShort(isoDate) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  const d = new Date(Number(year), Number(month) - 1, Number(day))
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Recurring pattern detection helpers (private) ─────────────────────────────

function median(arr) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function mode(arr) {
  if (!arr.length) return null
  const counts = {}
  for (const v of arr) counts[v] = (counts[v] ?? 0) + 1
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0])
}

function daysBetween(isoA, isoB) {
  return Math.round(
    (new Date(isoB + 'T00:00:00').getTime() - new Date(isoA + 'T00:00:00').getTime())
    / 86400000
  )
}

function addDaysToISO(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toYMD(d)
}

/**
 * Detects recurring transaction patterns for a single account.
 * Filters to spending (amount_pence < 0) with non-null merchant_clean.
 * Returns suggestions sorted by occurrence count descending.
 *
 * @param {Array} transactions        All transactions for the account
 * @param {Array} existingBills       Active bills for the account (to exclude already-tracked patterns)
 * @param {Array<string>} dismissedPatterns  merchant_clean strings the user has dismissed
 * @returns {Array<{
 *   merchant_clean: string,
 *   occurrenceCount: number,
 *   medianAmountPence: number,
 *   frequency: 'monthly'|'quarterly',
 *   anchorDay: number,
 *   nextDueDate: string,
 *   descriptionPattern: string,
 *   samples: Array
 * }>}
 */
export function detectRecurringPatterns(transactions, existingBills, dismissedPatterns) {
  const spending = transactions.filter(
    tx => Number(tx.amount_pence) < 0 && tx.merchant_clean
  )

  const groups = {}
  for (const tx of spending) {
    const key = tx.merchant_clean
    if (!groups[key]) groups[key] = []
    groups[key].push(tx)
  }

  const suggestions = []

  for (const [merchant, txs] of Object.entries(groups)) {
    if (dismissedPatterns.includes(merchant)) continue

    const alreadyBill = existingBills.some(
      b => b.description_pattern?.toLowerCase() === merchant.toLowerCase()
    )
    if (alreadyBill) continue

    if (txs.length < 3) continue

    const sorted = [...txs].sort((a, b) => a.tx_date.localeCompare(b.tx_date))

    const spacings = []
    for (let i = 1; i < sorted.length; i++) {
      spacings.push(daysBetween(sorted[i - 1].tx_date, sorted[i].tx_date))
    }

    const monthlyCount   = spacings.filter(d => d >= 25 && d <= 35).length
    const quarterlyCount = spacings.filter(d => d >= 80 && d <= 100).length

    let frequency = null
    if (monthlyCount   / spacings.length >= 0.8) frequency = 'monthly'
    else if (quarterlyCount / spacings.length >= 0.8) frequency = 'quarterly'
    if (!frequency) continue

    const amounts = sorted.map(tx => Math.abs(Number(tx.amount_pence)))
    const med = median(amounts)
    if (med === 0) continue

    const allWithinTolerance = amounts.every(a => Math.abs(a - med) / med <= 0.25)
    if (!allWithinTolerance) continue

    const days = sorted.map(tx => new Date(tx.tx_date + 'T00:00:00').getDate())
    const anchorDay = mode(days)

    const lastDate  = sorted[sorted.length - 1].tx_date
    let nextDueDate = addDaysToISO(lastDate, frequency === 'monthly' ? 30 : 90)

    const [ny, nm] = nextDueDate.split('-').map(Number)
    const lastOfMonth = new Date(ny, nm, 0).getDate()
    const snapped = Math.min(anchorDay, lastOfMonth)
    nextDueDate = `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(snapped).padStart(2, '0')}`

    suggestions.push({
      merchant_clean:     merchant,
      occurrenceCount:    txs.length,
      medianAmountPence:  med,
      frequency,
      anchorDay,
      nextDueDate,
      descriptionPattern: merchant,
      samples:            sorted,
    })
  }

  return suggestions.sort((a, b) => b.occurrenceCount - a.occurrenceCount)
}
