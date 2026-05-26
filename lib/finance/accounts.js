/** Account type display labels keyed by account_type CHECK value. */
export const ACCOUNT_TYPE_LABELS = {
  current:     'Current',
  credit_card: 'Credit card',
  savings:     'Savings',
  other:       'Other',
}

/** Bank display labels keyed by bank CHECK value. */
export const BANK_LABELS = {
  lloyds:       'Lloyds',
  barclays:     'Barclays',
  hsbc:         'HSBC',
  natwest:      'NatWest',
  monzo:        'Monzo',
  starling:     'Starling',
  nationwide:   'Nationwide',
  santander:    'Santander',
  first_direct: 'First Direct',
  other:        'Other',
}

/**
 * Returns the display label for an account's bank.
 * Falls back to account.bank_other_text when bank = 'other'.
 * @param {{ bank: string, bank_other_text?: string|null }} account
 * @returns {string}
 */
export function getBankLabel(account) {
  if (account.bank === 'other') return account.bank_other_text || 'Other'
  return BANK_LABELS[account.bank] || account.bank
}
