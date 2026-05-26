/**
 * Formats a pence integer to a GBP string.
 * Negative values render with a minus sign: -4250 → '−£42.50'.
 * @param {number|bigint} pence
 * @returns {string}
 */
export function formatPence(pence) {
  if (pence == null) return '—'
  const n = Number(pence)
  const abs = Math.abs(n) / 100
  const formatted = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)
  return n < 0 ? `−£${formatted}` : `£${formatted}`
}

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
export async function dedupeHash(accountId, txDate, amountPence, description) {
  const normalised  = description.replace(/\s+/g, ' ').trim().toUpperCase()
  const composite   = `${accountId}|${txDate}|${amountPence}|${normalised}`
  const bytes       = new TextEncoder().encode(composite)
  const hashBuffer  = await crypto.subtle.digest('SHA-256', bytes)
  const hashArray   = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Applies active categorisation rules to a transaction in priority order.
 * Returns the first matching category_id (sorted by priority ascending) or null.
 * @param {Array<{ match_type: string, match_field: string, match_value: string, category_id: string, priority: number }>} rules
 * @param {string} description
 * @param {string|null} merchantClean
 * @returns {string|null} category_id UUID or null
 */
export function applyRules(rules, description, merchantClean) {
  const desc  = description   ?? ''
  const merch = merchantClean ?? ''

  for (const rule of rules) {
    const field = rule.match_field === 'merchant_clean' ? merch : desc
    const val   = rule.match_value
    let match   = false

    switch (rule.match_type) {
      case 'contains':    match = field.toLowerCase().includes(val.toLowerCase());         break
      case 'starts_with': match = field.toLowerCase().startsWith(val.toLowerCase());       break
      case 'exact':       match = field.toLowerCase() === val.toLowerCase();               break
      case 'regex':       match = new RegExp(val, 'i').test(field);                        break
    }

    if (match) return rule.category_id
  }

  return null
}
