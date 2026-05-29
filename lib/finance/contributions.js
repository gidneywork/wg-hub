// Pure helpers for savings contributions. No DB access.

export function contributionMonthlyEquivalent(row) {
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

export function monthlyContributionsTotal(rows) {
  return rows.reduce((sum, r) => sum + contributionMonthlyEquivalent(r), 0)
}

export const CONTRIBUTION_FREQUENCY_LABELS = {
  monthly:   'Monthly',
  weekly:    'Weekly',
  quarterly: 'Quarterly',
  annual:    'Annual',
  'one-off': 'One-off',
}

export function computeContributionsBreakdown(rows) {
  return rows
    .map(r => ({ name: r.name || 'Unnamed', monthly: contributionMonthlyEquivalent(r) }))
    .filter(r => r.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)
}
