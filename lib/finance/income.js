// Pure helpers for income. No DB access.

/**
 * Returns the monthly-equivalent amount_pence for an income row.
 * monthly as-is; weekly ×52/12; quarterly ÷3; annual ÷12; one-off → 0.
 * Normalisation is byte-identical to billMonthlyEquivalent for shared frequencies.
 * Cannot reuse billMonthlyEquivalent directly — income uses amount_pence,
 * bills use expected_amount_pence; mismatched field would silently return 0.
 * @param {{ amount_pence: number|string, frequency: string }} row
 * @returns {number}  Monthly amount in pence (rounded)
 */
export function incomeMonthlyEquivalent(row) {
  const amount = Math.abs(Number(row.amount_pence) || 0)
  switch (row.frequency) {
    case 'monthly':   return amount
    case 'weekly':    return Math.round(amount * 52 / 12)
    case 'quarterly': return Math.round(amount / 3)
    case 'annual':    return Math.round(amount / 12)
    case 'one-off':   return 0
    default:          return 0
  }
}

/**
 * Sums recurring income normalised to a monthly figure.
 * One-off income contributes 0 (excluded from the recurring monthly total).
 * @param {Array<{ amount_pence: number, frequency: string }>} incomeRows
 * @returns {number}  Total monthly pence
 */
export function monthlyIncomeTotal(incomeRows) {
  return incomeRows.reduce((sum, r) => sum + incomeMonthlyEquivalent(r), 0)
}

/** Display labels for finance_income.frequency CHECK values. */
export const INCOME_FREQUENCY_LABELS = {
  monthly:   'Monthly',
  weekly:    'Weekly',
  quarterly: 'Quarterly',
  annual:    'Annual',
  'one-off': 'One-off',
}

/**
 * Per-source monthly income breakdown, sorted descending.
 * One-off income is excluded (monthly equivalent = 0).
 * @param {Array<{ source: string, amount_pence: number, frequency: string }>} incomeRows
 * @returns {Array<{ source: string, monthly: number }>}
 */
export function computeIncomeBreakdown(incomeRows) {
  return incomeRows
    .map(r => ({ source: r.source || 'Unnamed', monthly: incomeMonthlyEquivalent(r) }))
    .filter(r => r.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)
}
