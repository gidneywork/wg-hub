// Pure helpers for the Finance Dashboard. No DB access.
import { computeAccountBalance } from './accounts'
import { billMonthlyEquivalent } from './bills'

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
