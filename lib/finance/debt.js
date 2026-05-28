// Pure helpers for the Debt tool. No DB access.
import { computeAccountBalance } from './accounts'

/**
 * Merges three sources into a unified working-debt list:
 *   linked      — negative-balance account WITH a finance_debts row (account_id set)
 *   auto-unlinked — negative-balance account WITHOUT a row (balance auto-detected, APR unknown)
 *   manual      — finance_debts row with account_id = null (user-entered)
 *
 * @param {Array} accounts        All active finance_accounts
 * @param {Array} transactions    All finance_transactions
 * @param {Array} statements      All finance_statement_documents
 * @param {Array} debtRows        All finance_debts rows
 * @returns {Array<{
 *   key: string,
 *   kind: 'linked'|'auto-unlinked'|'manual',
 *   accountId: string|null,
 *   accountName: string|null,
 *   debtRowId: string|null,
 *   name: string,
 *   balancePence: number|null,
 *   aprBps: number|null,
 *   minPaymentPence: number|null,
 *   needsApr: boolean,
 * }>}
 */
export function buildWorkingDebts(accounts, transactions, statements, debtRows) {
  const result = []

  for (const acc of accounts) {
    const acTxs = transactions.filter(tx => tx.account_id === acc.id)
    const bal   = computeAccountBalance(acc, acTxs, statements)
    if (bal == null || bal >= 0) continue

    const linkedRow = debtRows.find(r => r.account_id === acc.id) ?? null

    if (linkedRow) {
      result.push({
        key:             `linked:${acc.id}`,
        kind:            'linked',
        accountId:       acc.id,
        accountName:     acc.name,
        debtRowId:       linkedRow.id,
        name:            acc.name,
        balancePence:    Math.abs(bal),
        aprBps:          linkedRow.apr_bps,
        minPaymentPence: linkedRow.min_payment_pence != null ? Number(linkedRow.min_payment_pence) : null,
        needsApr:        false,
      })
    } else {
      result.push({
        key:             `auto:${acc.id}`,
        kind:            'auto-unlinked',
        accountId:       acc.id,
        accountName:     acc.name,
        debtRowId:       null,
        name:            acc.name,
        balancePence:    Math.abs(bal),
        aprBps:          null,
        minPaymentPence: null,
        needsApr:        true,
      })
    }
  }

  for (const row of debtRows) {
    if (row.account_id != null) continue
    result.push({
      key:             `manual:${row.id}`,
      kind:            'manual',
      accountId:       null,
      accountName:     null,
      debtRowId:       row.id,
      name:            row.name,
      balancePence:    row.balance_pence != null ? Number(row.balance_pence) : null,
      aprBps:          row.apr_bps,
      minPaymentPence: row.min_payment_pence != null ? Number(row.min_payment_pence) : null,
      needsApr:        false,
    })
  }

  return result
}

/**
 * Simulates a debt paydown strategy month-by-month.
 * Debts with null APR are treated as 0% interest (included, not filtered).
 *
 * @param {Array}  debts                Working debts from buildWorkingDebts
 * @param {number} monthlyBudgetPence   Total budget per month (pence)
 * @param {'avalanche'|'snowball'} strategy
 * @param {number} [maxMonths=600]      Safety cap (~50 years)
 * @returns {{
 *   feasible: boolean,
 *   months: number|null,
 *   totalInterestPence: number|null,
 *   totalPaidPence: number|null,
 *   payoffOrder: Array<{ key: string, name: string, month: number }>,
 *   schedule: Array<{ month: number, balances: Array }>,
 *   neverClears: boolean,
 *   minimumsTotalPence: number,
 * }}
 */
export function simulateStrategy(debts, monthlyBudgetPence, strategy, maxMonths = 600) {
  const working = debts
    .filter(d => d.balancePence != null && d.balancePence > 0)
    .map(d => ({
      key:              d.key,
      name:             d.name,
      aprBps:           d.aprBps ?? 0,
      minPaymentPence:  d.minPaymentPence ?? 0,
      balanceRemaining: d.balancePence,
    }))

  if (working.length === 0) {
    return {
      feasible: true, months: 0, totalInterestPence: 0, totalPaidPence: 0,
      payoffOrder: [], schedule: [], neverClears: false, minimumsTotalPence: 0,
    }
  }

  const minimumsTotalPence = working.reduce((s, d) => s + d.minPaymentPence, 0)

  if (monthlyBudgetPence < minimumsTotalPence) {
    return {
      feasible: false, months: null, totalInterestPence: null, totalPaidPence: null,
      payoffOrder: [], schedule: [], neverClears: false, minimumsTotalPence,
    }
  }

  let month              = 0
  let totalInterestPence = 0
  let totalPaidPence     = 0
  const payoffOrder      = []
  const schedule         = []

  const state = working.map(d => ({ ...d }))

  while (month < maxMonths) {
    const active = state.filter(d => d.balanceRemaining > 0)
    if (active.length === 0) break
    month++

    // Accrue interest
    for (const d of active) {
      const interest       = Math.round(d.balanceRemaining * d.aprBps / 10000 / 12)
      d.balanceRemaining  += interest
      totalInterestPence  += interest
    }

    // Pay minimums
    let extra = monthlyBudgetPence
    for (const d of active) {
      const minPay         = Math.min(d.minPaymentPence, d.balanceRemaining)
      d.balanceRemaining   = Math.max(0, d.balanceRemaining - minPay)
      extra               -= minPay
      totalPaidPence      += minPay
    }
    extra = Math.max(0, extra)

    // Apply extra in strategy order
    const strategyQueue = active.filter(d => d.balanceRemaining > 0)
    if (strategy === 'avalanche') {
      strategyQueue.sort((a, b) => b.aprBps - a.aprBps || a.key.localeCompare(b.key))
    } else {
      strategyQueue.sort((a, b) => a.balanceRemaining - b.balanceRemaining || a.key.localeCompare(b.key))
    }
    for (const d of strategyQueue) {
      if (extra <= 0) break
      const pay            = Math.min(extra, d.balanceRemaining)
      d.balanceRemaining   = Math.max(0, d.balanceRemaining - pay)
      extra               -= pay
      totalPaidPence      += pay
    }

    // Record debts cleared this month
    for (const d of active) {
      if (d.balanceRemaining === 0) {
        payoffOrder.push({ key: d.key, name: d.name, month })
      }
    }

    schedule.push({
      month,
      balances: state.map(d => ({ key: d.key, name: d.name, balanceRemaining: d.balanceRemaining })),
    })
  }

  const neverClears = state.some(d => d.balanceRemaining > 0)

  return {
    feasible: true,
    months: month,
    totalInterestPence,
    totalPaidPence,
    payoffOrder,
    schedule,
    neverClears,
    minimumsTotalPence,
  }
}

/** Converts bps integer to a display string. 2290 → "22.9" */
export function bpsToPercent(bps) {
  if (bps == null) return ''
  return String(bps / 100)
}

/** Parses a percent string to bps integer, or null on invalid input. "22.9" → 2290 */
export function percentToBps(str) {
  const n = parseFloat(str)
  return isNaN(n) ? null : Math.round(n * 100)
}

/** Formats bps as a human-readable APR string. 2290 → "22.9%" */
export function formatApr(bps) {
  return bps == null ? '—' : `${bps / 100}%`
}
