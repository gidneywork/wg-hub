// Finance DB helpers — all Supabase interactions for the Finance pillar.
import { supabase } from '../supabase'
import { applyRules } from './transactions'

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
  return { inserted, skipped }
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
