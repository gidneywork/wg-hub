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
