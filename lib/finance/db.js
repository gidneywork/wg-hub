// Finance DB helpers — all Supabase interactions for the Finance pillar.
import { supabase } from '../supabase'
import { applyRules } from './transactions'
import { advanceNextDueDate, countMatchingBills, matchesTransaction, computeNextDueDate } from './bills'

// ── Accounts ──────────────────────────────────────────────────────────────────

/**
 * Returns all finance_accounts ordered by display_order ascending.
 * Excludes inactive accounts by default; pass { includeInactive: true } to override.
 * @param {{ includeInactive?: boolean }} [opts]
 * @returns {Promise<Array>}
 */
export async function loadAccounts(opts) {
  let q = supabase.from('finance_accounts').select('*').order('display_order', { ascending: true })
  if (!opts?.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) { console.error('loadAccounts:', error); throw error }
  return data || []
}

/**
 * Inserts a new finance_account row.
 * @param {{ name: string, account_type: string, bank: string, bank_other_text?: string|null, currency?: string, notes?: string|null }} account
 * @returns {Promise<void>}
 */
export async function insertAccount(account) {
  const { data, error } = await supabase
    .from('finance_accounts')
    .insert([account])
    .select()
    .single()
  if (error) { console.error('insertAccount:', error); throw error }
  return data
}

/**
 * Updates a finance_account row by id.
 * @param {string} id  UUID
 * @param {Partial<{ name: string, is_active: boolean, notes: string, display_order: number }>} changes
 * @returns {Promise<void>}
 */
export async function updateAccount(id, changes) {
  const { error } = await supabase
    .from('finance_accounts')
    .update(changes)
    .eq('id', id)
  if (error) { console.error('updateAccount:', error); throw error }
}

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Returns finance_transactions for an account ordered by tx_date descending.
 * Optional date range: opts.from and opts.to (ISO date strings).
 * @param {string} accountId  UUID
 * @param {{ from?: string, to?: string }} [opts]
 * @returns {Promise<Array>}
 */
export async function loadTransactions(accountId, opts) {
  let q = supabase.from('finance_transactions').select('*').eq('account_id', accountId).order('tx_date', { ascending: false })
  if (opts?.from) q = q.gte('tx_date', opts.from)
  if (opts?.to)   q = q.lte('tx_date', opts.to)
  const { data, error } = await q
  if (error) { console.error('loadTransactions:', error); throw error }
  return data || []
}

/**
 * Updates a single transaction row.
 * @param {string} id  UUID
 * @param {Partial<{ tx_date: string, description: string, merchant_clean: string|null, amount_pence: number, tx_type: string|null, category_id: string|null, notes: string|null, dedupe_hash: string }>} changes
 * @param {object} [client]
 * @returns {Promise<void>}
 */
export async function updateTransaction(id, changes, client = supabase) {
  const { error } = await client
    .from('finance_transactions')
    .update(changes)
    .eq('id', id)
  if (error) { console.error('updateTransaction:', error); throw error }
}

/**
 * Updates a single transaction's category_id.
 * Pass null to clear the category (revert to uncategorised).
 * @param {string} id  UUID
 * @param {string|null} categoryId  UUID or null
 * @returns {Promise<void>}
 */
export async function recategoriseTransaction(id, categoryId) {
  return updateTransaction(id, { category_id: categoryId })
}

/**
 * Bulk-inserts transactions from a parsed statement.
 * Uses upsert with ignoreDuplicates on dedupe_hash to achieve idempotency.
 * Returns { inserted, skipped } counts.
 * @param {Array<{ account_id: string, tx_date: string, amount_pence: number, description: string, dedupe_hash: string, source_document_id?: string }>} rows
 * @returns {Promise<{ inserted: number, skipped: number }>}
 */
export async function insertTransactions(rows, client = supabase) {
  if (!rows.length) return { inserted: 0, skipped: 0 }

  const { data, error } = await client
    .from('finance_transactions')
    .upsert(rows, { onConflict: 'dedupe_hash', ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(`Transaction insert failed: ${error.message}`)

  const inserted = (data ?? []).length
  const skipped  = rows.length - inserted
  return { inserted, skipped, insertedRows: data ?? [] }
}

/**
 * Inserts a single manually-entered transaction.
 * Surfaces a 23505 unique constraint violation as a user-visible error.
 * @param {{ account_id: string, tx_date: string, amount_pence: number, description: string, dedupe_hash: string }} row
 * @param {object} [client]
 * @returns {Promise<{ id: string }>}
 */
export async function addTransaction(row, client = supabase) {
  const { data, error } = await client
    .from('finance_transactions')
    .insert([row])
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Transaction already exists (duplicate).')
    console.error('addTransaction:', error)
    throw error
  }
  return data
}

// ── Categories ────────────────────────────────────────────────────────────────

/**
 * Returns all finance_categories ordered by display_order ascending.
 * @returns {Promise<Array>}
 */
export async function loadCategories() {
  const { data, error } = await supabase.from('finance_categories').select('*').order('display_order', { ascending: true })
  if (error) { console.error('loadCategories:', error); throw error }
  return data || []
}

// ── Category rules ────────────────────────────────────────────────────────────

/**
 * Returns all active finance_category_rules ordered by priority ascending.
 * @returns {Promise<Array>}
 */
export async function loadCategoryRules() {
  const { data, error } = await supabase.from('finance_category_rules').select('*').eq('is_active', true).order('priority', { ascending: true })
  if (error) { console.error('loadCategoryRules:', error); throw error }
  return data || []
}

/**
 * Inserts a new finance_category_rule.
 * @param {{ category_id: string, match_type: string, match_field: string, match_value: string, priority?: number }} rule
 * @param {object} [client]
 * @returns {Promise<void>}
 */
export async function insertCategoryRule(rule, client = supabase) {
  const { error } = await client
    .from('finance_category_rules')
    .insert([{
      category_id: rule.category_id,
      match_type:  rule.match_type,
      match_field: rule.match_field,
      match_value: rule.match_value,
      priority:    rule.priority ?? 100,
    }])
  if (error) { console.error('insertCategoryRule:', error); throw error }
}

/**
 * Retroactively applies a single rule to all uncategorised transactions in an account.
 * Matches on description/merchant_clean using the same logic as applyRules.
 * Returns { updated } count.
 * @param {{ category_id: string, match_type: string, match_field: string, match_value: string }} rule
 * @param {string} accountId  UUID
 * @param {object} [client]
 * @returns {Promise<{ updated: number }>}
 */
export async function applyRuleToExistingTransactions(rule, accountId, client = supabase) {
  const { data: txs, error } = await client
    .from('finance_transactions')
    .select('id, description, merchant_clean')
    .eq('account_id', accountId)
    .is('category_id', null)
  if (error) throw error

  const matchingIds = (txs ?? [])
    .filter(tx => applyRules([rule], tx.description, tx.merchant_clean) !== null)
    .map(tx => tx.id)

  if (!matchingIds.length) return { updated: 0 }

  const { error: updErr } = await client
    .from('finance_transactions')
    .update({ category_id: rule.category_id })
    .in('id', matchingIds)
  if (updErr) throw updErr

  return { updated: matchingIds.length }
}

// ── Statement documents ───────────────────────────────────────────────────────

/**
 * Returns all finance_statement_documents for an account ordered by uploaded_at descending.
 * @param {string} accountId  UUID
 * @returns {Promise<Array>}
 */
export async function loadStatementDocuments(accountId) {
  let q = supabase.from('finance_statement_documents').select('*').order('uploaded_at', { ascending: false })
  if (accountId) q = q.eq('account_id', accountId)
  const { data, error } = await q
  if (error) { console.error('loadStatementDocuments:', error); throw error }
  return data || []
}

/**
 * Uploads a CSV file to the finance-statements storage bucket, then inserts a
 * finance_statement_documents row. On INSERT failure, attempts to remove the
 * orphan file before re-throwing.
 * @param {{ account_id: string, file: File, period_from?: string|null, period_to?: string|null, notes?: string|null }} doc
 * @returns {Promise<void>}
 */
export async function insertStatementDocument({ account_id, file, period_from, period_to, notes }) {
  const ext  = file.name.split('.').pop().toLowerCase()
  const path = `${new Date().toISOString().slice(0, 10)}_${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('finance-statements')
    .upload(path, file)
  if (upErr) { console.error('statementDocument upload:', upErr); throw upErr }

  const { error: insErr } = await supabase
    .from('finance_statement_documents')
    .insert({
      account_id,
      file_url:    path,
      file_name:   file.name,
      period_from: period_from || null,
      period_to:   period_to   || null,
      notes:       notes       || null,
    })

  if (insErr) {
    await supabase.storage.from('finance-statements').remove([path]).catch(() => {})
    console.error('statementDocument insert:', insErr)
    throw insErr
  }
}

/**
 * Updates the status and metadata of a statement document after the import run.
 * @param {string} id  UUID
 * @param {{ status: string, row_count?: number|null, error_detail?: string|null, imported_at?: string|null }} changes
 * @returns {Promise<void>}
 */
export async function updateStatementDocument(id, changes) {
  const { error } = await supabase
    .from('finance_statement_documents')
    .update(changes)
    .eq('id', id)
  if (error) { console.error('updateStatementDocument:', error); throw error }
}

/**
 * Returns a short-lived signed URL for a private statement file.
 * @param {string} path  Storage path (file_url column)
 * @returns {Promise<string>}
 */
export async function getStatementSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from('finance-statements')
    .createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

// ── Bills ─────────────────────────────────────────────────────────────────────

/**
 * Returns all finance_bills ordered by next_due_date ascending.
 * Excludes inactive bills by default; pass true to include them.
 * @param {boolean} [includeInactive=false]
 * @returns {Promise<Array>}
 */
export async function loadBills(includeInactive = false) {
  let q = supabase.from('finance_bills').select('*').order('next_due_date', { ascending: true })
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) { console.error('loadBills:', error); throw error }
  return data || []
}

/**
 * Inserts a new finance_bills row.
 * @param {{ account_id: string, name: string, bill_type: string, category_id?: string|null, expected_amount_pence: number, tolerance_pct?: number, frequency: string, next_due_date: string, anchor_day?: number|null, description_pattern?: string|null, notes?: string|null }} bill
 * @param {object} [client]
 * @returns {Promise<object>}
 */
export async function insertBill(bill, client = supabase) {
  const { data, error } = await client
    .from('finance_bills')
    .insert([bill])
    .select()
    .single()
  if (error) { console.error('insertBill:', error); throw error }
  return data
}

/**
 * Updates a finance_bills row by id.
 * @param {string} id  UUID
 * @param {Partial<{ name: string, bill_type: string, category_id: string|null, expected_amount_pence: number, tolerance_pct: number, frequency: string, next_due_date: string, anchor_day: number|null, description_pattern: string|null, is_active: boolean, notes: string|null }>} changes
 * @param {object} [client]
 * @returns {Promise<void>}
 */
export async function updateBill(id, changes, client = supabase) {
  const { error } = await client
    .from('finance_bills')
    .update(changes)
    .eq('id', id)
  if (error) { console.error('updateBill:', error); throw error }
}

/**
 * Deletes a finance_bills row by id. Cascades to finance_bill_payments.
 * @param {string} id  UUID
 * @param {object} [client]
 * @returns {Promise<void>}
 */
export async function deleteBill(id, client = supabase) {
  const { error } = await client
    .from('finance_bills')
    .delete()
    .eq('id', id)
  if (error) { console.error('deleteBill:', error); throw error }
}

/**
 * Returns all finance_bill_payments for a bill ordered by due_date descending.
 * @param {string} billId  UUID
 * @returns {Promise<Array>}
 */
export async function loadBillPaymentsForBill(billId) {
  const { data, error } = await supabase
    .from('finance_bill_payments')
    .select('*')
    .eq('bill_id', billId)
    .order('due_date', { ascending: false })
  if (error) { console.error('loadBillPaymentsForBill:', error); throw error }
  return data || []
}

/**
 * Returns all finance_bill_payments ordered by due_date descending.
 * Used for eager-loading on the Bills page to avoid N+1 queries.
 * @returns {Promise<Array>}
 */
export async function loadAllBillPayments() {
  const { data, error } = await supabase
    .from('finance_bill_payments')
    .select('*')
    .order('due_date', { ascending: false })
  if (error) { console.error('loadAllBillPayments:', error); throw error }
  return data || []
}

/**
 * Inserts a new finance_bill_payments row.
 * @param {{ bill_id: string, transaction_id: string, due_date: string, link_source: 'auto'|'manual' }} payment
 * @param {object} [client]
 * @returns {Promise<object>}
 */
export async function insertBillPayment(payment, client = supabase) {
  const { data, error } = await client
    .from('finance_bill_payments')
    .insert([payment])
    .select()
    .single()
  if (error) { console.error('insertBillPayment:', error); throw error }
  return data
}

/**
 * Deletes a finance_bill_payments row by id (unlinks a transaction from a bill cycle).
 * @param {string} id  UUID
 * @param {object} [client]
 * @returns {Promise<void>}
 */
export async function deleteBillPayment(id, client = supabase) {
  const { error } = await client
    .from('finance_bill_payments')
    .delete()
    .eq('id', id)
  if (error) { console.error('deleteBillPayment:', error); throw error }
}

/**
 * Returns finance_transactions for an account within a date window.
 * Used to populate the Mark Paid transaction picker.
 * @param {string} accountId  UUID
 * @param {string} from  ISO date string
 * @param {string} to    ISO date string
 * @returns {Promise<Array>}
 */
export async function loadAccountTransactionsForBillMatching(accountId, from, to) {
  const { data, error } = await supabase
    .from('finance_transactions')
    .select('id, tx_date, amount_pence, description, merchant_clean')
    .eq('account_id', accountId)
    .gte('tx_date', from)
    .lte('tx_date', to)
    .order('tx_date', { ascending: false })
  if (error) { console.error('loadAccountTransactionsForBillMatching:', error); throw error }
  return data || []
}

/**
 * Attempts to auto-link a transaction to a matching active bill.
 * Matches on description_pattern, expected_amount_pence ± tolerance_pct, and next_due_date window.
 * Creates a finance_bill_payments row with link_source='auto' if matched.
 * @param {string} transactionId  UUID
 * @param {object} [client]
 * @returns {Promise<{ linked: boolean, billId?: string }>}
 */
export async function applyAutoLinkToTransaction(transactionId, client = supabase, preloaded = null) {
  const { data: tx, error: txErr } = await client
    .from('finance_transactions')
    .select('id, account_id, tx_date, amount_pence, description, merchant_clean')
    .eq('id', transactionId)
    .maybeSingle()
  if (txErr) throw txErr
  if (!tx) return { linked: false, reason: 'no_match' }

  let bills    = []
  let payments = []

  if (preloaded) {
    bills    = preloaded.bills
    payments = preloaded.payments
  } else {
    const { data: b, error: billsErr } = await client
      .from('finance_bills')
      .select('*')
      .eq('account_id', tx.account_id)
      .eq('is_active', true)
    if (billsErr) throw billsErr
    bills = b ?? []

    const billIds = bills.map(b => b.id)
    if (billIds.length > 0) {
      const { data: p, error: pmtErr } = await client
        .from('finance_bill_payments')
        .select('bill_id, due_date')
        .in('bill_id', billIds)
      if (pmtErr) throw pmtErr
      payments = p ?? []
    }
  }

  if (!bills.length) return { linked: false, reason: 'no_match' }

  const result = countMatchingBills(bills, tx, payments)
  if (result.count === 0) return { linked: false, reason: 'no_match' }
  if (result.count > 1)  return { linked: false, reason: 'multiple_matches' }

  const bill           = bills.find(b => b.id === result.matchedBillId)
  const paidDueDate    = bill.next_due_date
  const newNextDueDate = advanceNextDueDate(bill)

  await insertBillPayment({
    bill_id:        bill.id,
    transaction_id: transactionId,
    due_date:       paidDueDate,
    link_source:    'auto',
  }, client)

  await updateBill(bill.id, { next_due_date: newNextDueDate }, client)

  return { linked: true, billId: bill.id, paidDueDate, newNextDueDate }
}

// Non-exported helper — mirror of computeNextDueDate going backwards.
function walkBackCycleDate(dateISO, frequency, anchorDay) {
  const [year, month, day] = dateISO.split('-').map(Number)
  let newYear = year, newMonth = month
  if (frequency === 'monthly') {
    newMonth -= 1
    if (newMonth < 1) { newMonth = 12; newYear -= 1 }
  } else if (frequency === 'quarterly') {
    newMonth -= 3
    while (newMonth < 1) { newMonth += 12; newYear -= 1 }
  } else if (frequency === 'annual') {
    newYear -= 1
  }
  const targetDay  = anchorDay ?? day
  const lastDay    = new Date(newYear, newMonth, 0).getDate()
  const clampedDay = Math.min(targetDay, lastDay)
  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

/**
 * Retroactively matches all historical transactions on a bill's account to that bill
 * across multiple past cycles. Creates finance_bill_payments rows for confident matches.
 * @param {string} billId  UUID
 * @param {object} [client]
 * @returns {Promise<{ linkedCount: number, advancedCycles: number, rejectedCount: number }>}
 */
export async function applyRetroactiveAutoLinkForBill(billId, client = supabase) {
  const { data: bill, error: billErr } = await client
    .from('finance_bills').select('*').eq('id', billId).maybeSingle()
  if (billErr) throw billErr
  if (!bill) throw new Error('Bill not found')

  const { data: txData, error: txErr } = await client
    .from('finance_transactions')
    .select('id, tx_date, amount_pence, description, merchant_clean')
    .eq('account_id', bill.account_id)
    .lt('amount_pence', 0)
    .order('tx_date', { ascending: true })
  if (txErr) throw txErr
  const transactions = txData ?? []
  if (!transactions.length) return { linkedCount: 0, advancedCycles: 0, rejectedCount: 0 }

  const { data: pmtData, error: pmtErr } = await client
    .from('finance_bill_payments')
    .select('id, transaction_id, due_date')
    .eq('bill_id', billId)
  if (pmtErr) throw pmtErr
  const existingPayments     = pmtData ?? []
  const existingPaymentDates = new Set(existingPayments.map(p => p.due_date))
  const alreadyLinkedTxIds   = new Set(existingPayments.map(p => p.transaction_id))

  // Walk back from next_due_date to generate candidate cycle dates
  const earliestTxDate = transactions[0].tx_date
  const cycleDates     = []
  let cursor           = bill.next_due_date
  const MAX_CYCLES     = 120  // safety cap (~10 years of monthly)
  while (cursor > earliestTxDate && cycleDates.length < MAX_CYCLES) {
    cursor = walkBackCycleDate(cursor, bill.frequency, bill.anchor_day)
    cycleDates.push(cursor)
  }
  if (!cycleDates.length) return { linkedCount: 0, advancedCycles: 0, rejectedCount: 0 }

  // Greedy assignment: most-recent cycle first, one transaction per cycle
  const assignments = new Map()
  const usedTxIds   = new Set()
  let rejectedCount = 0

  for (const cycleDate of cycleDates) {
    if (existingPaymentDates.has(cycleDate)) continue

    const billForCycle = { ...bill, next_due_date: cycleDate }
    const candidates   = transactions.filter(tx =>
      !alreadyLinkedTxIds.has(tx.id) &&
      !usedTxIds.has(tx.id) &&
      matchesTransaction(billForCycle, tx, [])
    )

    if (candidates.length === 1) {
      assignments.set(cycleDate, candidates[0])
      usedTxIds.add(candidates[0].id)
    } else {
      rejectedCount++
    }
  }

  // Insert in chronological order
  const sortedEntries       = [...assignments.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  let linkedCount           = 0
  let mostRecentLinkedCycle = null

  for (const [cycleDate, tx] of sortedEntries) {
    await insertBillPayment({
      bill_id:        billId,
      transaction_id: tx.id,
      due_date:       cycleDate,
      link_source:    'auto',
    }, client)
    linkedCount++
    mostRecentLinkedCycle = cycleDate
  }

  // Advance next_due_date to the cycle after the most recent linked one
  let advancedCycles = 0
  if (mostRecentLinkedCycle) {
    const newNextDue = computeNextDueDate(mostRecentLinkedCycle, bill.frequency, bill.anchor_day)
    if (newNextDue !== bill.next_due_date) {
      await updateBill(billId, { next_due_date: newNextDue }, client)
      advancedCycles = linkedCount
    }
  }

  return { linkedCount, advancedCycles, rejectedCount }
}
