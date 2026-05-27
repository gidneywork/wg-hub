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

/**
 * Returns the most recently imported statement document for a given account,
 * or null if none exists.
 * @param {Array<{ id: string, account_id: string, status: string, imported_at?: string, uploaded_at: string }>} statements
 * @param {string} accountId
 * @returns {object|null}
 */
export function getMostRecentImportedStatement(statements, accountId) {
  return statements
    .filter(d => d.account_id === accountId && d.status === 'imported')
    .sort((a, b) => {
      const ta = a.imported_at ?? a.uploaded_at
      const tb = b.imported_at ?? b.uploaded_at
      return tb < ta ? -1 : tb > ta ? 1 : 0
    })[0] ?? null
}

/**
 * Computes the display balance for an account.
 * Credit cards use closing_balance_pence from the most recent imported statement
 * (negated — debt is negative). All other types sum transaction amount_pence.
 * @param {{ id: string, account_type: string }} account
 * @param {Array<{ amount_pence: number|string }>} transactions
 * @param {Array<object>} statements
 * @returns {number}
 */
export function computeAccountBalance(account, transactions, statements) {
  if (account.account_type === 'credit_card') {
    const stmt = getMostRecentImportedStatement(statements, account.id)
    if (stmt?.closing_balance_pence != null) {
      return -Math.abs(Number(stmt.closing_balance_pence))
    }
  }
  return transactions.reduce((s, tx) => s + Number(tx.amount_pence), 0)
}

/**
 * Returns available-to-spend for a credit card account (limit minus balance owed),
 * or null if either column is absent on the most recent statement.
 * @param {{ id: string }} account
 * @param {Array<object>} statements
 * @returns {number|null}
 */
export function computeAvailableToSpend(account, statements) {
  const stmt = getMostRecentImportedStatement(statements, account.id)
  if (!stmt || stmt.credit_limit_pence == null || stmt.closing_balance_pence == null) return null
  return stmt.credit_limit_pence - Math.abs(Number(stmt.closing_balance_pence))
}
