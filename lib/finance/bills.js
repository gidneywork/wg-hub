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

/**
 * Derives the display status of a bill from its state and payment history.
 * @param {{ next_due_date: string, is_active: boolean }} bill
 * @param {Array<{ due_date: string }>} payments
 * @param {string} today  ISO date string (YYYY-MM-DD)
 * @returns {'paid'|'due'|'overdue'|'upcoming'|'inactive'}
 */
export function deriveBillStatus(bill, payments, today) { /* Commit 2 */ }

/**
 * Returns a new next_due_date after the current cycle is paid.
 * Advances by one frequency period from bill.next_due_date.
 * @param {{ next_due_date: string, frequency: string, anchor_day: number|null }} bill
 * @returns {string}  ISO date string
 */
export function advanceNextDueDate(bill) { /* Commit 2 */ }

/**
 * Computes the next due date from a reference date given a frequency and optional anchor day.
 * @param {string} currentDate  ISO date string
 * @param {'monthly'|'quarterly'|'annual'} frequency
 * @param {number|null} anchorDay  Day-of-month (1–31); null means same day as currentDate
 * @returns {string}  ISO date string
 */
export function computeNextDueDate(currentDate, frequency, anchorDay) { /* Commit 2 */ }
