/**
 * Formats a pence integer to a GBP string.
 * Negative values render with a minus sign: -4250 → '−£42.50'.
 * @param {number|bigint} pence
 * @returns {string}
 */
export function formatPence(pence) { /* Commit 2 */ }

/**
 * Generates the dedupe hash for a transaction.
 * Input: concatenation of accountId, txDate (ISO 'YYYY-MM-DD'), amountPence,
 * and normalised description (whitespace-collapsed, uppercased).
 * Uses Web Crypto SHA-256; returns a hex string.
 * @param {string} accountId  UUID
 * @param {string} txDate     ISO date string
 * @param {number} amountPence
 * @param {string} description  Raw description from CSV
 * @returns {Promise<string>}
 */
export async function dedupeHash(accountId, txDate, amountPence, description) { /* Commit 3 */ }

/**
 * Applies active categorisation rules to a transaction in priority order.
 * Returns the first matching category_id (sorted by priority ascending) or null.
 * @param {Array<{ match_type: string, match_field: string, match_value: string, category_id: string, priority: number }>} rules
 * @param {string} description
 * @param {string|null} merchantClean
 * @returns {string|null} category_id UUID or null
 */
export function applyRules(rules, description, merchantClean) { /* Commit 3 */ }
