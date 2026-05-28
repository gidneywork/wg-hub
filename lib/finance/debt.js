// Pure helpers for the Debt tool. No DB access.
import { computeAccountBalance } from './accounts'

/**
 * Merges three sources into a unified working-debt list for the strategy race:
 *   linked        — negative-balance account WITH a finance_debts row (account_id set)
 *   auto-unlinked — negative-balance account WITHOUT a row (balance auto-detected, APR unknown)
 *   manual        — finance_debts row with account_id = null (user-entered)
 *
 * Revolving debts: full balance enters the race (unless include_in_strategy = false).
 * Loan/mortgage:   only arrears_pence enters the race (if >0 AND include_in_strategy).
 *                  Principal lives in projectAmortisation, not the strategy race.
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
 *   isArrears: boolean,
 *   parentDebtType?: 'loan'|'mortgage',
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
      const debtType = linkedRow.debt_type ?? 'revolving'

      if (debtType === 'revolving') {
        if (linkedRow.include_in_strategy === false) continue
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
          isArrears:       false,
        })
      } else {
        // loan/mortgage linked to an account — only arrears enters the race
        const arrears = linkedRow.arrears_pence != null ? Number(linkedRow.arrears_pence) : 0
        if (linkedRow.include_in_strategy !== false && arrears > 0) {
          result.push({
            key:             `linked:${acc.id}:arrears`,
            kind:            'linked',
            accountId:       acc.id,
            accountName:     acc.name,
            debtRowId:       linkedRow.id,
            name:            `${acc.name} (arrears)`,
            balancePence:    arrears,
            aprBps:          linkedRow.apr_bps,
            minPaymentPence: null,
            needsApr:        false,
            isArrears:       true,
            parentDebtType:  debtType,
          })
        }
      }
    } else {
      // Auto-unlinked: always revolving (no debt row means credit card / overdraft)
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
        isArrears:       false,
      })
    }
  }

  for (const row of debtRows) {
    if (row.account_id != null) continue
    const debtType = row.debt_type ?? 'revolving'

    if (debtType === 'revolving') {
      if (row.include_in_strategy === false) continue
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
        isArrears:       false,
      })
    } else {
      // loan/mortgage — only arrears enters the race; principal is in projectAmortisation
      const arrears = row.arrears_pence != null ? Number(row.arrears_pence) : 0
      if (row.include_in_strategy !== false && arrears > 0) {
        result.push({
          key:             `manual:${row.id}:arrears`,
          kind:            'manual',
          accountId:       null,
          accountName:     null,
          debtRowId:       row.id,
          name:            `${row.name} (arrears)`,
          balancePence:    arrears,
          aprBps:          row.apr_bps,
          minPaymentPence: null,
          needsApr:        false,
          isArrears:       true,
          parentDebtType:  debtType,
        })
      }
    }
  }

  return result
}

/**
 * Simulates a debt paydown strategy month-by-month.
 * Debts with null APR are treated as 0% interest (included, not filtered).
 * Loan/mortgage arrears entries race correctly — simulateStrategy is type-agnostic.
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

/**
 * Standard amortisation monthly payment to clear principal over n months at monthly rate r.
 * payment = P × r / (1 − (1+r)^−n). r=0 special-cased to P/n (straight-line, no division risk).
 * Returns pence, rounded.
 * @param {number} principalPence
 * @param {number} aprBps   Annual rate in basis points
 * @param {number} months   Remaining term
 * @returns {number} Monthly payment in pence (rounded), or 0 if months ≤ 0
 */
export function computeAmortisationPayment(principalPence, aprBps, months) {
  if (months <= 0) return 0
  const r = (aprBps ?? 0) / 10000 / 12
  if (r === 0) return Math.round(principalPence / months)
  const factor = Math.pow(1 + r, -months)
  return Math.round(principalPence * r / (1 - factor))
}

/**
 * Projects loan/mortgage payoff month-by-month with optional rate revert.
 *
 * Rate revert: after fixedPeriodMonths at aprBps, switches to revertAprBps and
 * recalculates payment to clear remaining balance over the remaining term
 * (standard UK fixed-rate mortgage behaviour — payment typically increases).
 *
 * Feasibility: if the initial payment cannot cover the initial month's interest
 * (payment ≤ firstInterest), the loan can never clear and feasible:false is returned.
 * This is conservative but correct — UK mortgages revert upward, not downward.
 *
 * @param {number}      principalPence
 * @param {number}      aprBps                 Initial APR in bps
 * @param {number}      termMonths             Total original term
 * @param {number}      monthlyPaymentPence    Contractual monthly payment
 * @param {number|null} fixedPeriodMonths      Months at initial rate (null = fixed whole term)
 * @param {number|null} revertAprBps           Rate after fixed period (null = no revert)
 * @param {number}      [maxMonths=600]        Safety cap
 * @returns {{
 *   feasible: boolean,
 *   months: number|null,
 *   totalInterestPence: number|null,
 *   totalPaidPence: number|null,
 *   payoffMonth: number|null,
 *   revertMonth: number|null,
 *   recalculatedPaymentPence: number|null,
 *   schedule: Array<{
 *     month: number, openingBalance: number, interest: number,
 *     principalPaid: number, closingBalance: number, rate: number, payment: number
 *   }>,
 *   neverClears: boolean,
 * }}
 */
export function projectAmortisation(
  principalPence, aprBps, termMonths, monthlyPaymentPence,
  fixedPeriodMonths = null, revertAprBps = null, maxMonths = 600
) {
  if (!principalPence || principalPence <= 0) {
    return {
      feasible: true, months: 0, totalInterestPence: 0, totalPaidPence: 0,
      payoffMonth: 0, revertMonth: null, recalculatedPaymentPence: null,
      schedule: [], neverClears: false,
    }
  }

  let balance             = principalPence
  let payment             = monthlyPaymentPence
  let currentAprBps       = aprBps ?? 0
  let revertMonth         = null
  let recalculatedPayment = null
  let month               = 0
  let totalInterest       = 0
  let totalPaid           = 0
  const schedule          = []

  // Feasibility guard: if first-month interest ≥ payment, balance can only grow.
  const firstInterest = Math.round(balance * currentAprBps / 10000 / 12)
  if (payment <= firstInterest) {
    return {
      feasible: false, months: null, totalInterestPence: null, totalPaidPence: null,
      payoffMonth: null, revertMonth: null, recalculatedPaymentPence: null,
      schedule: [], neverClears: false,
    }
  }

  while (balance > 0 && month < maxMonths) {
    month++

    // Rate revert: fires once, at the first month after the fixed period ends.
    if (
      revertAprBps != null &&
      fixedPeriodMonths != null &&
      month === fixedPeriodMonths + 1 &&
      revertMonth === null
    ) {
      currentAprBps = revertAprBps
      const remainingTerm = Math.max(1, termMonths - fixedPeriodMonths)
      payment = computeAmortisationPayment(balance, revertAprBps, remainingTerm)
      recalculatedPayment = payment
      revertMonth = month
    }

    const r           = currentAprBps / 10000 / 12
    const interest    = Math.round(balance * r)
    let principalPaid = payment - interest

    if (principalPaid <= 0) {
      // Payment can't cover interest at this phase — balance growing, will never clear.
      schedule.push({
        month, openingBalance: balance, interest,
        principalPaid: 0, closingBalance: balance,
        rate: currentAprBps, payment,
      })
      break
    }

    let paymentThisMonth = payment
    if (principalPaid > balance) {
      // Final month: clamp to avoid overpayment; absorbs rounding drift.
      principalPaid    = balance
      paymentThisMonth = balance + interest
    }

    const closing  = balance - principalPaid
    totalInterest += interest
    totalPaid     += paymentThisMonth
    schedule.push({
      month, openingBalance: balance, interest,
      principalPaid, closingBalance: closing,
      rate: currentAprBps, payment: paymentThisMonth,
    })
    balance = closing
  }

  const neverClears = balance > 0

  return {
    feasible:                 true,
    months:                   month,
    totalInterestPence:       totalInterest,
    totalPaidPence:           totalPaid,
    payoffMonth:              neverClears ? null : month,
    revertMonth,
    recalculatedPaymentPence: recalculatedPayment,
    schedule,
    neverClears,
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

/** Formats a month count as a human-readable duration. 27 → "2 years 3 months" */
export function formatMonths(n) {
  if (n == null || n < 0) return '—'
  const years  = Math.floor(n / 12)
  const months = n % 12
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`
}
