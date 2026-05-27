// Prompt templates keyed by compound slug: `${bank}_${account_type}`.
// Adding a new bank = adding an entry here; no code changes elsewhere.
const PROMPTS = {
  lloyds_current: {
    systemPrompt: `You are a bank statement parser. Extract transactions from a Lloyds Bank PDF statement and return them as a single JSON object. Return only valid JSON — no preamble, no explanation, no markdown fences.`,

    userPrompt: `Extract all transactions from this Lloyds Bank statement and return a single JSON object in this exact shape:

{
  "period_from":           "YYYY-MM-DD",
  "period_to":             "YYYY-MM-DD",
  "closing_balance_pence": 12345,
  "transactions": [
    {
      "tx_date":        "YYYY-MM-DD",
      "description":    "full description text as printed",
      "amount_pence":   -3499,
      "tx_type":        "DD",
      "merchant_clean": "Vodafone"
    }
  ]
}

--- period_from / period_to ---
Find the statement period printed on page 1 directly under the account name (e.g., "01 May 2026 to 26 May 2026"). Convert both dates to YYYY-MM-DD.

--- closing_balance_pence ---
Find the final running balance in the Balance (£) column — the value on the very last transaction row.
Multiply by 100 and return as an integer in pence.
If the balance is overdrawn (Lloyds shows an "OD" suffix), return a negative integer. "15.63 OD" → -1563.
If the balance is in credit, return a positive integer. "240.17" → 24017.

--- tx_date ---
Lloyds dates print in DD MMM YY format on every row, including continuation rows (e.g., "01 May 26"). The year is always present as two digits. Convert to YYYY-MM-DD treating YY as 20YY (26 → 2026, 25 → 2025). Do not infer or carry-forward dates between rows — every transaction row has its own date.

--- amount_pence ---
The statement has two columns: Money In (£) and Money Out (£).
Money Out → negative integer in pence. "34.99" becomes -3499.
Money In  → positive integer in pence. "2,500.00" becomes 250000.
Remove commas. Multiply by 100. No decimals. Every value must be an integer.
Each transaction row populates exactly one of the two columns — never both.

--- description ---
Copy the full description text exactly as printed on the statement.
Do not include the transaction type code in this field.
Do not include the balance amount or date.
Do not include the running balance from the Balance (£) column.

--- tx_type ---
The Lloyds transaction type code, taken from the Type column. Must be one of these exact codes:
BGC, BP, CHG, CHQ, COR, CPT, DD, DEB, DEP, FEE, FPI, FPO, MPI, MPO, PAY, SO, TFR
If the code in the PDF is not in this list, return an empty string for tx_type. Do not invent codes.

--- merchant_clean ---
If the merchant is clearly identifiable as a known organisation, provide a clean human-readable name.
Examples: "APPLE.COM/BILL" → "Apple", "CO-OPERATIVE FOOD" → "Co-op", "SPOTIFY AB" → "Spotify", "AMAZON MKTPLACE" → "Amazon", "TFL TRAVEL CH" → "TfL", "NETFLIX.COM" → "Netflix", "GOOGLE*SERVICES" → "Google", "E.ON NEXT" → "E.ON", "THAMES WATER" → "Thames Water", "BT.COM CONSUMER BP" → "BT", "DELIVEROO" → "Deliveroo", "WHOOP" → "Whoop", "SWINDON BC" → "Swindon Borough Council", "DISNEY PLUS" → "Disney+", "TESCO STORES 2013" → "Tesco".

If the description appears truncated (ends mid-word, ends with a trailing single letter, or the word count suggests the line cut off, e.g. "Premier Victoria S"), set to null.

If the description is a personal name (one or more words that look like a person's name, e.g. "S GIDNEY", "ASHRAF SYED", "JAMES BLACKETT", "GIDNEY"), preserve it as a normalised title-case merchant_clean value. Examples:
- "S GIDNEY" → "S Gidney"
- "ASHRAF SYED" → "Ashraf Syed"
- "JAMES BLACKETT" → "James Blackett"
- "GIDNEY" → "Gidney"
- "MR WILL GIDNEY" → "Will Gidney" (drop the "MR" honorific)
- "MRS JANE SMITH" → "Jane Smith"
This lets the user track money to and from specific people.

If the description is a sort code / account number reference (just digits, or "REF.XXXXX"), set to null.

If the description is genuinely ambiguous and not a clear personal name or merchant, set to null.

--- Special transactions to INCLUDE ---
- "DAILY OD INT" and "DAILY OD INT DD/MM" entries are overdraft interest charges. These ARE valid transactions and must be included in the transactions array. They typically appear as small Money Out amounts (a few pence or pounds) with tx_type "CHG".
- Cashpoint withdrawals like "LNK POST OFFICE" or "LNK MID COUNTIES C" with tx_type "CPT" are real transactions — include them.

--- Exclude entirely (do NOT include in transactions array) ---
- The "Balance on 01 May 2026" and "Balance on 26 May 2026" summary lines at the top of page 1.
- The "Money In £X" and "Money Out £X" summary totals at the top of page 1.
- "(Continued on next page)" lines and any page continuation markers.
- Page headers on pages 2+: "CLASSIC", "Sort Code", "Account Number", and the column header row repeated on each page ("Date / Description / Type / Money In (£) / Money Out (£) / Balance (£)").
- Page footers: "If you think something is incorrect…", "Lloyds Bank plc. Registered Office…", "Page X of Y".
- The Transaction types legend table on the final page (BGC Bank Giro Credit, BP Bill Payments, etc.).
- The recipient address block on page 1 (e.g. account holder name and address).

Return only the JSON object. No markdown, no code fences, no commentary.`,
  },

  nationwide_current: {
    systemPrompt: `You are a bank statement parser. Extract transactions from a Nationwide FlexDirect PDF statement and return them as a single JSON object. Return only valid JSON — no preamble, no explanation, no markdown fences.`,

    userPrompt: `Extract all transactions from this Nationwide FlexDirect statement and return a single JSON object in this exact shape:

{
  "period_from":           "YYYY-MM-DD",
  "period_to":             "YYYY-MM-DD",
  "closing_balance_pence": 12345,
  "transactions": [
    {
      "tx_date":        "YYYY-MM-DD",
      "description":    "full description text as printed",
      "amount_pence":   -3499,
      "tx_type":        "DD",
      "merchant_clean": "Vodafone"
    }
  ]
}

--- period_from / period_to ---
period_to: find "Statement date: DD MMM YYYY" in the header summary box (e.g., "Statement date: 11 May 2026" → "2026-05-11"). Convert to YYYY-MM-DD.
period_from: find the line "Balance from statement N dated DD/MM/YYYY" at the top of the transactions table. The date in this line is the PREVIOUS statement's close date. period_from is the day AFTER this date (e.g. "Balance from statement 26 dated 11/04/2026" → period_from "2026-04-12").
If the "Balance from statement" line is not present, use the earliest tx_date in the statement as period_from.

--- closing_balance_pence ---
Find the "End balance" printed at the bottom of the transaction list. Multiply by 100 and return as an integer in pence. If the account is overdrawn, return a negative integer.

--- tx_date ---
Nationwide groups transactions by date. The date is printed only on the first row of each date group; subsequent rows in the same group have no date printed. Carry the date forward to every transaction within the same group.
Nationwide dates are in DD MMM format (no year). Use the year from the statement period header. Exception: if the statement covers January and a transaction month is December or November, use the prior calendar year.
Convert to YYYY-MM-DD.

--- amount_pence ---
Nationwide uses two columns: Paid in (£) and Paid out (£).
Paid in → positive integer in pence. "2,500.00" → 250000.
Paid out → negative integer in pence. "34.99" → -3499.
Remove commas. Multiply by 100. No decimals. Every value must be an integer.
Each transaction populates exactly one column — never both.

--- description ---
Copy the full description text exactly as printed. Do not include the date, balance, or column totals.

--- tx_type ---
Nationwide has no separate type column. Infer tx_type from the description using these rules in order (use the first match):
- Contains "STANDING ORDER" → SO
- Contains "RETURNED DIRECT DEBIT" → DD
- Contains "DIRECT DEBIT" → DD
- Contains "FASTER PAYMENT RECEIVED" or starts with "CREDIT FROM" or "TRANSFER FROM" → FPI
- Contains "FASTER PAYMENT SENT" or starts with "TRANSFER TO" or "PAYMENT TO" → FPO
- Contains "ATM" or "CASHPOINT" or starts with "CASH " → CPT
- Contains "BACS CREDIT" → BGC
- Contains "INTEREST CHARGED" or "CHARGE" or "FEE" → CHG
- Card purchase at a merchant (point-of-sale) → DEB
- None of the above → return empty string ""

--- merchant_clean ---
Known organisations → clean human-readable name (e.g., "APPLE.COM/BILL" → "Apple", "SPOTIFY AB" → "Spotify", "AMAZON MKTPLACE" → "Amazon", "TFL TRAVEL CH" → "TfL", "NETFLIX.COM" → "Netflix", "CO-OPERATIVE FOOD" → "Co-op", "E.ON NEXT" → "E.ON", "THAMES WATER" → "Thames Water", "BT GROUP PLC" → "BT", "DELIVEROO" → "Deliveroo", "TESCO STORES" → "Tesco").
Truncated descriptions (ends mid-word, trailing single letter) → null.
Personal names (one or more words resembling a person's name, e.g. "S GIDNEY", "ASHRAF SYED") → normalised title-case. Examples: "S GIDNEY" → "S Gidney", "MR WILL GIDNEY" → "Will Gidney" (drop honorific).
Sort code / account number references (digits only, or "REF.XXXXX") → null.
Genuinely ambiguous → null.

--- Exclude entirely (do NOT include in transactions array) ---
- Any row labelled "Balance from statement [number]" or "Balance brought forward".
- Opening balance rows.
- Summary totals ("Total paid in", "Total paid out").
- Page headers and footers.

Return only the JSON object. No markdown, no code fences, no commentary.`,
  },

  lloyds_credit_card: {
    systemPrompt: `You are a bank statement parser. Extract transactions from a Lloyds Bank credit card PDF statement and return them as a single JSON object. Return only valid JSON — no preamble, no explanation, no markdown fences.`,

    userPrompt: `Extract all transactions from this Lloyds credit card statement and return a single JSON object in this exact shape:

{
  "period_from":           "YYYY-MM-DD",
  "period_to":             "YYYY-MM-DD",
  "closing_balance_pence": 179320,
  "credit_limit_pence":    300000,
  "minimum_payment_pence": 2500,
  "payment_due_date":      "YYYY-MM-DD",
  "transactions": [
    {
      "tx_date":        "YYYY-MM-DD",
      "description":    "full description text as printed",
      "amount_pence":   -3499,
      "tx_type":        "DEB",
      "merchant_clean": "Vodafone"
    }
  ]
}

--- period_from / period_to ---
period_to is the statement date printed near the top of the first page (e.g., "Statement date: 15 May 2026"). Convert to YYYY-MM-DD.
period_from is exactly one calendar month before period_to (e.g., 15 May 2026 → 2026-04-15). Convert to YYYY-MM-DD.

--- closing_balance_pence ---
Find "Your new balance" on the statement. This is the total amount owed. Store as a POSITIVE integer in pence. "£1,793.20" → 179320.
If the balance shown is a credit (Lloyds owes you money, shown with "CR" suffix), store as a negative integer.

--- credit_limit_pence ---
Find "Your credit limit" on the statement. Multiply by 100 and return as a positive integer in pence. "£3,000.00" → 300000. If not found, return null.

--- minimum_payment_pence ---
Find "Minimum payment" or "Minimum payment due" on the statement. Multiply by 100 and return as a positive integer in pence. "£25.00" → 2500. If not found, return null.

--- payment_due_date ---
Find "Please pay by", "Payment due date", or "Payment due" on the statement. Convert to YYYY-MM-DD. If not found, return null.

--- tx_date ---
Lloyds credit card dates print in DD MMM YY format on each row (e.g., "15 May 26"). Convert to YYYY-MM-DD treating YY as 20YY.

--- amount_pence ---
Credit card statements use two columns: Debit (£) and Credit (£).
Debit (purchases, interest, fees) → negative integer in pence.
Credit (payments received, refunds) → positive integer in pence.
Remove commas. Multiply by 100. No decimals. Every value must be an integer.

--- description ---
Copy the full description text exactly as printed. Do not include the transaction date, amount, or balance.

--- tx_type ---
Use the first matching rule:
- Purchase at a merchant → DEB
- Payment received (money credited to the account) → PAY
- Interest charged → FEE
- Fee or charge → FEE
- Cash advance or withdrawal → CPT
- Balance transfer → TFR
- None of the above → return empty string ""

--- merchant_clean ---
Known organisations → clean human-readable name.
Truncated descriptions → null.
Personal names → normalised title-case (drop honorifics).
Sort code / account number references → null.
Genuinely ambiguous → null.

--- Transactions section ---
Extract transactions only from the section headed "New transactions, fees and charges". Do not extract from:
- The account summary box (previous balance, payments received, new balance).
- The breakdown of balance or interest calculation section.
- Any arrears notice or minimum payment warning box.
- Page headers and footers.

--- Empty transactions ---
If there are no new transactions this period, return an empty array: "transactions": []. This is a valid response — do not invent transactions.

Return only the JSON object. No markdown, no code fences, no commentary.`,
  },
}

/**
 * Extracts transactions and statement metadata from a base64-encoded PDF using Claude.
 * Throws with a descriptive message on any failure — caller is responsible for status transitions.
 * @param {string} pdfBase64
 * @param {string} bankSlug  — compound key: `${bank}_${account_type}`, e.g. "lloyds_current"
 * @param {{ accountName: string }} accountMeta
 * @returns {Promise<{
 *   transactions: Array,
 *   periodFrom: string|null,
 *   periodTo: string|null,
 *   closingBalancePence: number|null,
 *   creditLimitPence: number|null,
 *   minimumPaymentPence: number|null,
 *   paymentDueDate: string|null,
 * }>}
 */
export async function extractTransactionsFromPdf(pdfBase64, bankSlug, accountMeta) {
  const prompt = PROMPTS[bankSlug]
  if (!prompt) throw new Error(
    `No extraction prompt for bank: ${bankSlug}. Supported: ${Object.keys(PROMPTS).join(', ')}`
  )

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 16000,
      system:     prompt.systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: prompt.userPrompt,
          },
        ],
      }],
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Anthropic API error ${res.status}`)

  const rawText = data.content?.[0]?.text || ''
  const jsonText = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    const len  = rawText.length
    const head = rawText.slice(0, 200)
    const tail = rawText.slice(-200)
    throw new Error(
      `Claude returned invalid JSON (${len} chars). ` +
      `Start: ${head} ... End: ${tail}`
    )
  }

  if (!Array.isArray(parsed?.transactions)) throw new Error('Claude response missing transactions array')
  if (!parsed.transactions.length) console.warn(`extractTransactionsFromPdf: 0 transactions for ${bankSlug}`)

  for (let i = 0; i < parsed.transactions.length; i++) {
    const tx = parsed.transactions[i]
    if (!tx.tx_date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.tx_date))
      throw new Error(`Transaction ${i}: invalid tx_date "${tx.tx_date}"`)
    if (typeof tx.description !== 'string' || !tx.description.trim())
      throw new Error(`Transaction ${i}: missing description`)
    if (!Number.isInteger(tx.amount_pence))
      throw new Error(`Transaction ${i}: amount_pence must be integer, got ${typeof tx.amount_pence} (${tx.amount_pence})`)
  }

  return {
    transactions:         parsed.transactions,
    periodFrom:           parsed.period_from            ?? null,
    periodTo:             parsed.period_to              ?? null,
    closingBalancePence:  parsed.closing_balance_pence  ?? null,
    creditLimitPence:     parsed.credit_limit_pence     ?? null,
    minimumPaymentPence:  parsed.minimum_payment_pence  ?? null,
    paymentDueDate:       parsed.payment_due_date       ?? null,
  }
}
