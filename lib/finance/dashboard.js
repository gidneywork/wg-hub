// Pure helpers for the Finance Dashboard. No DB access.
import { computeAccountBalance, getMostRecentImportedStatement } from './accounts'
import { billMonthlyEquivalent } from './bills'
import { formatPence } from './transactions'

/**
 * Computes assets, debt, and net worth across all accounts.
 * Extracted from FinanceAccounts.jsx's local computeRollup so both
 * FinanceAccounts and FinanceDashboard share the same logic.
 *
 * @param {Array} accounts        All active finance_accounts
 * @param {Array} allTransactions All finance_transactions (any account)
 * @param {Array} statementDocs   All finance_statement_documents
 * @returns {{ assets: number, debt: number, netWorth: number }}  Pence values
 */
export function computeNetWorth(accounts, allTransactions, statementDocs) {
  let assets = 0, debt = 0
  for (const acc of accounts) {
    const acTxs = allTransactions.filter(tx => tx.account_id === acc.id)
    const bal   = computeAccountBalance(acc, acTxs, statementDocs)
    if (bal == null) continue
    if (bal >= 0) assets += bal
    else          debt   += Math.abs(bal)
  }
  return { assets, debt, netWorth: assets - debt }
}

/**
 * Sums the monthly-equivalent amount for all active bills.
 * Uses billMonthlyEquivalent to normalise quarterly / annual bills.
 *
 * @param {Array} bills  finance_bills rows (may include inactive)
 * @returns {number}  Pence per month
 */
export function computeMonthlyBillsTotal(bills) {
  return bills
    .filter(b => b.is_active)
    .reduce((sum, b) => sum + billMonthlyEquivalent(b), 0)
}

/**
 * Sums spending (negative transactions) in the current calendar month.
 *
 * @param {Array} transactions  finance_transactions for one or all accounts
 * @returns {number}  Total pence spent (positive value)
 */
export function computeThisMonthSpending(transactions) {
  const now    = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return transactions
    .filter(tx => tx.tx_date.startsWith(prefix) && Number(tx.amount_pence) < 0)
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount_pence)), 0)
}

/**
 * Buckets all transactions by calendar month and returns up to the last
 * six months as [{ month, incomePence, spendingPence, netPence }].
 *
 * @param {Array} transactions  finance_transactions (any account)
 * @returns {Array<{ month: string, incomePence: number, spendingPence: number, netPence: number }>}
 */
export function computeMonthlyCashflow(transactions) {
  const buckets = {}
  for (const tx of transactions) {
    const month = tx.tx_date.slice(0, 7)
    if (!buckets[month]) buckets[month] = { income: 0, spending: 0 }
    const amt = Number(tx.amount_pence)
    if (amt > 0) buckets[month].income   += amt
    else         buckets[month].spending += Math.abs(amt)
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, { income, spending }]) => ({
      month,
      incomePence:   income,
      spendingPence: spending,
      netPence:      income - spending,
    }))
}

export function computeHealthAlerts(accounts, transactions, statementDocuments, billsWithStatus) {
  const now        = new Date()
  const ccAccounts = accounts.filter(a => a.account_type === 'credit_card')
  const alerts     = []

  // CC utilisation
  const ccUtilAlerts = []
  for (const acc of ccAccounts) {
    const stmt = getMostRecentImportedStatement(statementDocuments, acc.id)
    if (!stmt || stmt.credit_limit_pence == null || stmt.closing_balance_pence == null) continue
    const limit = Number(stmt.credit_limit_pence)
    if (limit <= 0) continue
    const balance = Math.abs(Number(stmt.closing_balance_pence))
    const util    = balance / limit
    if (util > 0.8) {
      ccUtilAlerts.push({
        id: `cc-util-${acc.id}`, severity: 'warning',
        title: `Credit card at ${Math.round(util * 100)}% utilisation`,
        description: `${acc.name} — ${formatPence(balance)} / ${formatPence(limit)}`,
        action: { label: 'View account', view: `finance-account:${acc.id}:overview` },
      })
    }
  }
  if (ccUtilAlerts.length === 0) {
    ccUtilAlerts.push({ id: 'cc-util-clear', severity: 'clear', title: 'Credit cards healthy', description: null, action: null })
  }
  alerts.push(...ccUtilAlerts)

  // Bills overdue
  const overdue      = billsWithStatus.filter(b => b._status === 'overdue')
  const overdueTotal = overdue.reduce((s, b) => s + Math.abs(Number(b.expected_amount_pence)), 0)
  alerts.push(overdue.length > 0
    ? { id: 'bills-overdue', severity: 'warning',
        title: `${overdue.length} ${overdue.length === 1 ? 'bill' : 'bills'} overdue`,
        description: `Total: ${formatPence(overdueTotal)}`,
        action: { label: 'View bills', view: 'finance-bills' } }
    : { id: 'bills-overdue-clear', severity: 'clear', title: 'No bills overdue', description: null, action: null }
  )

  // CC minimum payment due within 7 days
  const ccPaymentAlerts = []
  for (const acc of ccAccounts) {
    const stmt = getMostRecentImportedStatement(statementDocuments, acc.id)
    if (!stmt || !stmt.payment_due_date || !stmt.minimum_payment_pence || Number(stmt.minimum_payment_pence) <= 0) continue
    const daysUntil = Math.round(
      (new Date(stmt.payment_due_date + 'T00:00:00').getTime() - now.getTime()) / 86400000
    )
    if (daysUntil >= 0 && daysUntil <= 7) {
      ccPaymentAlerts.push({
        id: `cc-payment-${acc.id}`, severity: 'warning',
        title: `Credit card payment due in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`,
        description: `${acc.name} — minimum ${formatPence(Number(stmt.minimum_payment_pence))}`,
        action: { label: 'View account', view: `finance-account:${acc.id}:overview` },
      })
    }
  }
  if (ccPaymentAlerts.length === 0) {
    ccPaymentAlerts.push({ id: 'cc-payment-clear', severity: 'clear', title: 'No urgent credit card payments', description: null, action: null })
  }
  alerts.push(...ccPaymentAlerts)

  // Spending elevated >20% above 3-month average
  const curPrefix     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const priorPrefixes = [1, 2, 3].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const thisMonthSpend = transactions
    .filter(tx => tx.tx_date.startsWith(curPrefix) && Number(tx.amount_pence) < 0)
    .reduce((s, tx) => s + Math.abs(Number(tx.amount_pence)), 0)
  const priorSpends = priorPrefixes.map(p =>
    transactions
      .filter(tx => tx.tx_date.startsWith(p) && Number(tx.amount_pence) < 0)
      .reduce((s, tx) => s + Math.abs(Number(tx.amount_pence)), 0)
  )
  const priorMonthsWithData = priorSpends.filter(s => s > 0).length

  if (priorMonthsWithData < 3) {
    alerts.push({ id: 'spending-baseline', severity: 'clear', title: 'Building spending baseline',
      description: 'Need 3 months of prior data to compare.', action: null })
  } else {
    const avg = priorSpends.reduce((s, v) => s + v, 0) / 3
    if (avg > 0 && thisMonthSpend > avg * 1.2) {
      const pctAbove = Math.round(((thisMonthSpend - avg) / avg) * 100)
      alerts.push({ id: 'spending-elevated', severity: 'warning', title: 'Spending elevated this month',
        description: `${formatPence(thisMonthSpend)} this month vs ${formatPence(Math.round(avg))} average (+${pctAbove}%)`,
        action: null })
    } else {
      alerts.push({ id: 'spending-clear', severity: 'clear', title: 'Spending in line with average', description: null, action: null })
    }
  }

  return alerts
}

export function computeActionItems(accounts, transactions, statementDocuments, suggestionCounts) {
  const today   = new Date()
  const todayMs = today.getTime()
  const items   = []

  // Uncategorised transactions
  const uncatByAccount = {}
  for (const tx of transactions) {
    if (tx.category_id == null) uncatByAccount[tx.account_id] = (uncatByAccount[tx.account_id] ?? 0) + 1
  }
  const uncatTotal = Object.values(uncatByAccount).reduce((s, n) => s + n, 0)
  if (uncatTotal > 0) {
    const worst = accounts.map(a => ({ a, n: uncatByAccount[a.id] ?? 0 })).sort((x, y) => y.n - x.n)[0]
    items.push({ id: 'uncat', severity: 'action', title: 'Uncategorised transactions',
      description: `${worst.a.name} has the most (${worst.n})`, count: uncatTotal,
      action: { label: 'Review', view: `finance-account:${worst.a.id}:transactions` } })
  } else {
    items.push({ id: 'uncat-clear', severity: 'clear', title: 'All transactions categorised', description: null, count: null, action: null })
  }

  // Recurring detection suggestions
  const totalSuggestions = suggestionCounts.reduce((s, sc) => s + sc.suggestionsCount, 0)
  if (totalSuggestions > 0) {
    const top = [...suggestionCounts].sort((a, b) => b.suggestionsCount - a.suggestionsCount)[0]
    items.push({ id: 'recurring', severity: 'action', title: 'Possible recurring bills detected',
      description: `${top.accountName} has the most (${top.suggestionsCount})`, count: totalSuggestions,
      action: { label: 'View', view: `finance-account:${top.accountId}:spending` } })
  } else {
    items.push({ id: 'recurring-clear', severity: 'clear', title: 'No recurring patterns detected', description: null, count: null, action: null })
  }

  // Statements not yet parsed (pending || failed)
  const unparsed = statementDocuments.filter(d => d.status === 'pending' || d.status === 'failed')
  if (unparsed.length > 0) {
    items.push({ id: 'unparsed', severity: 'action', title: 'Statements need parsing',
      description: unparsed.some(d => d.status === 'failed') ? 'Includes failed parse — retry needed' : null,
      count: unparsed.length, action: { label: 'View statements', view: 'finance-accounts' } })
  } else {
    items.push({ id: 'unparsed-clear', severity: 'clear', title: 'All statements parsed', description: null, count: null, action: null })
  }

  // Stale statements (>35 days since period_to)
  const staleAccounts = accounts.filter(acc => {
    const latest = statementDocuments
      .filter(d => d.account_id === acc.id && d.period_to)
      .sort((a, b) => b.period_to.localeCompare(a.period_to))[0]
    if (!latest) return false
    return Math.round((todayMs - new Date(latest.period_to + 'T00:00:00').getTime()) / 86400000) > 35
  })
  if (staleAccounts.length > 0) {
    items.push({ id: 'stale', severity: 'action', title: 'Accounts with stale statements',
      description: staleAccounts.map(a => a.name).join(', '), count: staleAccounts.length,
      action: { label: 'Upload statement', view: 'finance-accounts' } })
  } else {
    items.push({ id: 'stale-clear', severity: 'clear', title: 'All accounts up to date', description: null, count: null, action: null })
  }

  return items
}
