/**
 * Returns the monthly-equivalent expected_amount_pence for a bill, based on frequency.
 * One-off bills return 0 (not recurring).
 * Schema CHECK is ('monthly','quarterly','annual'). weekly/fortnightly/one_off are defensive
 * future-proofing — unreachable with current schema values.
 * @param {{ expected_amount_pence: number|string, frequency: string }} bill
 * @returns {number}  monthly amount in pence
 */
export function billMonthlyEquivalent(bill) {
  const amount = Math.abs(Number(bill.expected_amount_pence) || 0)
  switch (bill.frequency) {
    case 'monthly':     return amount
    case 'weekly':      return Math.round(amount * 52 / 12)
    case 'fortnightly': return Math.round(amount * 26 / 12)
    case 'quarterly':   return Math.round(amount / 3)
    case 'annual':      return Math.round(amount / 12)
    case 'one_off':     return 0
    default:            return 0
  }
}

/** Display labels for finance_bills.bill_type CHECK values. */
export const BILL_TYPE_LABELS = {
  utility:       'Utility',
  subscription:  'Subscription',
  rent_mortgage: 'Rent / Mortgage',
  insurance:     'Insurance',
  loan:          'Loan',
  council_tax:   'Council Tax',
  other:         'Other',
}

/** Display labels for finance_bills.frequency CHECK values. */
export const FREQUENCY_LABELS = {
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  annual:    'Annual',
}

/** Display labels for bill status values. */
export const STATUS_LABELS = {
  overdue:  'Overdue',
  due_soon: 'Due soon',
  paid:     'Paid',
  upcoming: 'Upcoming',
  inactive: 'Inactive',
}

/**
 * Derives the display status of a bill from its state and payment history.
 * @param {{ id: string, next_due_date: string, is_active: boolean }} bill
 * @param {Array<{ bill_id: string, due_date: string }>} payments  — all payments for all bills
 * @param {string} today  ISO date string (YYYY-MM-DD)
 * @returns {'paid'|'due_soon'|'overdue'|'upcoming'|'inactive'}
 */
export function deriveBillStatus(bill, payments, today) {
  if (!bill.is_active) return 'inactive'

  const isPaid = payments.some(p => p.bill_id === bill.id && p.due_date === bill.next_due_date)
  if (isPaid) return 'paid'

  const todayMs = new Date(today).getTime()
  const dueMs   = new Date(bill.next_due_date).getTime()
  const days    = Math.round((dueMs - todayMs) / 86400000)

  if (days < 0)  return 'overdue'
  if (days <= 7) return 'due_soon'
  return 'upcoming'
}

/**
 * Returns a new next_due_date after the current cycle is paid.
 * Advances by one frequency period from bill.next_due_date.
 * @param {{ next_due_date: string, frequency: string, anchor_day: number|null }} bill
 * @returns {string}  ISO date string
 */
export function advanceNextDueDate(bill) {
  return computeNextDueDate(bill.next_due_date, bill.frequency, bill.anchor_day)
}

/**
 * Computes the next due date from a reference date given a frequency and optional anchor day.
 * Uses pure arithmetic to avoid JS Date month-overflow bugs (e.g. Jan 31 + 1 month).
 * @param {string} currentDate  ISO date string
 * @param {'monthly'|'quarterly'|'annual'} frequency
 * @param {number|null} anchorDay  Day-of-month (1–31); null means same day as currentDate
 * @returns {string}  ISO date string
 */
/**
 * Client-side validation for the Add / Edit Bill form.
 * @param {{ name, account_id, bill_type, expected_amount_str, tolerance_pct, frequency, next_due_date, anchor_day }} formData
 * @returns {{ ok: true } | { ok: false, errors: { [field]: string } }}
 */
export function validateBillForm(formData) {
  const errors = {}
  if (!formData.name?.trim())    errors.name            = 'Name is required.'
  if (!formData.account_id)      errors.account_id      = 'Account is required.'
  if (!formData.bill_type)       errors.bill_type       = 'Type is required.'
  if (!formData.frequency)       errors.frequency       = 'Frequency is required.'
  if (!formData.next_due_date)   errors.next_due_date   = 'Next due date is required.'
  const amount = parseFloat(formData.expected_amount_str)
  if (!formData.expected_amount_str || isNaN(amount) || amount <= 0)
    errors.expected_amount_str = 'Amount must be a positive number.'
  if (formData.tolerance_pct !== '' && formData.tolerance_pct != null) {
    const t = Number(formData.tolerance_pct)
    if (!Number.isInteger(t) || t < 0 || t > 100)
      errors.tolerance_pct = 'Tolerance must be 0–100.'
  }
  if (formData.anchor_day !== '' && formData.anchor_day != null) {
    const ad = Number(formData.anchor_day)
    if (!Number.isInteger(ad) || ad < 1 || ad > 31)
      errors.anchor_day = 'Anchor day must be 1–31.'
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true }
}

/**
 * Returns the tolerance window in absolute pence for a bill's expected amount.
 * @param {{ expected_amount_pence: number, tolerance_pct: number|null }} bill
 * @returns {{ min: number, max: number }}
 */
export function computeBillAmountTolerance(bill) {
  const amount = Math.abs(bill.expected_amount_pence)
  const factor = (bill.tolerance_pct ?? 20) / 100
  const delta  = Math.round(amount * factor)
  return { min: amount - delta, max: amount + delta }
}

/**
 * Returns true if a transaction falls within the bill's amount tolerance AND within ±7 days of next_due_date.
 * @param {{ tx_date: string, amount_pence: number }} tx
 * @param {{ expected_amount_pence: number, tolerance_pct: number|null, next_due_date: string }} bill
 * @returns {boolean}
 */
export function isTransactionInBillToleranceWindow(tx, bill) {
  const { min, max } = computeBillAmountTolerance(bill)
  const absAmount = Math.abs(Number(tx.amount_pence))
  if (absAmount < min || absAmount > max) return false
  const days = Math.abs(Math.round(
    (new Date(tx.tx_date).getTime() - new Date(bill.next_due_date).getTime()) / 86400000
  ))
  return days <= 7
}

/**
 * Returns true if a transaction confidently matches a bill for auto-linking.
 * Criteria evaluated cheapest-first.
 * @param {{ id, is_active, expected_amount_pence, tolerance_pct, next_due_date, description_pattern, name }} bill
 * @param {{ amount_pence, tx_date, description, merchant_clean }} transaction
 * @param {Array<{ bill_id, due_date }>} payments  pre-loaded payments (cycle-paid guard)
 * @returns {boolean}
 */
export function matchesTransaction(bill, transaction, payments) {
  if (!bill.is_active) return false
  if (Number(transaction.amount_pence) >= 0) return false

  const { min, max } = computeBillAmountTolerance(bill)
  const absAmount = Math.abs(Number(transaction.amount_pence))
  if (absAmount < min || absAmount > max) return false

  const days = Math.abs(Math.round(
    (new Date(transaction.tx_date   + 'T00:00:00').getTime() -
     new Date(bill.next_due_date    + 'T00:00:00').getTime()) / 86400000
  ))
  if (days > 7) return false

  const pattern = (bill.description_pattern ?? bill.name).toLowerCase()
  const desc    = (transaction.description    ?? '').toLowerCase()
  const merch   = (transaction.merchant_clean ?? '').toLowerCase()
  if (!desc.includes(pattern) && !merch.includes(pattern)) return false

  if (payments.some(p => p.bill_id === bill.id && p.due_date === bill.next_due_date)) return false

  return true
}

/**
 * Returns the count of bills matching a transaction and, when exactly one matches, its ID.
 * 0 = no match, 1 = confident (single), 2+ = ambiguous (multiple).
 * @param {Array} bills
 * @param {{ amount_pence, tx_date, description, merchant_clean }} transaction
 * @param {Array<{ bill_id, due_date }>} allPayments
 * @returns {{ count: number, matchedBillId?: string }}
 */
export function countMatchingBills(bills, transaction, allPayments) {
  const matches = bills.filter(bill => matchesTransaction(bill, transaction, allPayments))
  if (matches.length === 0) return { count: 0 }
  if (matches.length === 1) return { count: 1, matchedBillId: matches[0].id }
  return { count: matches.length }
}

export function computeNextDueDate(currentDate, frequency, anchorDay) {
  const [year, month, day] = currentDate.split('-').map(Number)

  let newYear  = year
  let newMonth = month

  if (frequency === 'monthly') {
    newMonth += 1
    if (newMonth > 12) { newMonth = 1; newYear += 1 }
  } else if (frequency === 'quarterly') {
    newMonth += 3
    while (newMonth > 12) { newMonth -= 12; newYear += 1 }
  } else if (frequency === 'annual') {
    newYear += 1
  }

  const targetDay = anchorDay ?? day
  const lastDay   = new Date(newYear, newMonth, 0).getDate()
  const clampedDay = Math.min(targetDay, lastDay)

  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}
