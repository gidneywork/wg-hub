// Finance DB helpers — all Supabase interactions for the Finance pillar.
// Read-path bodies land in Commit 2; write-path bodies in Commit 3 and 4.
// supabase client imported here; used in all function bodies once implemented.

// ── Accounts ──────────────────────────────────────────────────────────────────

/**
 * Returns all finance_accounts ordered by display_order ascending.
 * Excludes inactive accounts by default; pass { includeInactive: true } to override.
 * @param {{ includeInactive?: boolean }} [opts]
 * @returns {Promise<Array>}
 */
export async function loadAccounts(opts) { /* Commit 2 */ }

/**
 * Inserts a new finance_account row.
 * @param {{ name: string, account_type: string, bank: string, bank_other_text?: string|null, currency?: string, notes?: string|null }} account
 * @returns {Promise<void>}
 */
export async function insertAccount(account) { /* Commit 3 */ }

/**
 * Updates a finance_account row by id.
 * @param {string} id  UUID
 * @param {Partial<{ name: string, is_active: boolean, notes: string, display_order: number }>} changes
 * @returns {Promise<void>}
 */
export async function updateAccount(id, changes) { /* Commit 3 */ }

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Returns finance_transactions for an account ordered by tx_date descending.
 * Optional date range: opts.from and opts.to (ISO date strings).
 * @param {string} accountId  UUID
 * @param {{ from?: string, to?: string }} [opts]
 * @returns {Promise<Array>}
 */
export async function loadTransactions(accountId, opts) { /* Commit 2 */ }

/**
 * Bulk-inserts transactions from a parsed statement.
 * Uses upsert with ignoreDuplicates on dedupe_hash to achieve idempotency.
 * Returns { inserted, skipped } counts.
 * @param {Array<{ account_id: string, tx_date: string, amount_pence: number, description: string, dedupe_hash: string, source_document_id?: string }>} rows
 * @returns {Promise<{ inserted: number, skipped: number }>}
 */
export async function insertTransactions(rows) { /* Commit 3 */ }

/**
 * Updates a single transaction's category_id.
 * Pass null to clear the category (revert to uncategorised).
 * @param {string} id  UUID
 * @param {string|null} categoryId  UUID or null
 * @returns {Promise<void>}
 */
export async function recategoriseTransaction(id, categoryId) { /* Commit 4 */ }

// ── Categories ────────────────────────────────────────────────────────────────

/**
 * Returns all finance_categories ordered by display_order ascending.
 * @returns {Promise<Array>}
 */
export async function loadCategories() { /* Commit 2 */ }

// ── Category rules ────────────────────────────────────────────────────────────

/**
 * Returns all active finance_category_rules ordered by priority ascending.
 * @returns {Promise<Array>}
 */
export async function loadCategoryRules() { /* Commit 2 */ }

/**
 * Inserts a new finance_category_rule.
 * @param {{ category_id: string, match_type: string, match_field: string, match_value: string, priority?: number }} rule
 * @returns {Promise<void>}
 */
export async function insertCategoryRule(rule) { /* Commit 4 */ }

// ── Statement documents ───────────────────────────────────────────────────────

/**
 * Returns all finance_statement_documents for an account ordered by uploaded_at descending.
 * @param {string} accountId  UUID
 * @returns {Promise<Array>}
 */
export async function loadStatementDocuments(accountId) { /* Commit 2 */ }

/**
 * Inserts a finance_statement_documents row after a CSV file is uploaded to storage.
 * Initial status defaults to 'pending' per schema default.
 * @param {{ account_id: string, file_url: string, file_name: string, period_from?: string|null, period_to?: string|null }} doc
 * @returns {Promise<void>}
 */
export async function insertStatementDocument(doc) { /* Commit 3 */ }

/**
 * Updates the status and metadata of a statement document after the import run.
 * @param {string} id  UUID
 * @param {{ status: string, row_count?: number|null, error_detail?: string|null, imported_at?: string|null }} changes
 * @returns {Promise<void>}
 */
export async function updateStatementDocument(id, changes) { /* Commit 3 */ }
