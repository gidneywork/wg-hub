// Pure helpers for the Spending tab — no DB access.

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
 * Formats a YYYY-MM string to a short month label.
 * '2026-03' → 'Mar 26'
 */
export function fmtMonthShort(yyyymm) {
  if (!yyyymm) return ''
  const [year, month] = yyyymm.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}
