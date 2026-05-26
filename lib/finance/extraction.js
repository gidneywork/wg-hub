// Prompt templates keyed by bank slug. Adding a new bank = adding an entry here; no code changes.
const PROMPTS = {
  lloyds: {
    systemPrompt: `You are a bank statement parser. Extract transactions from a Lloyds Bank PDF statement and return them as a single JSON object. Return only valid JSON — no preamble, no explanation, no markdown fences.`,

    userPrompt: `Extract all transactions from this Lloyds Bank statement and return a single JSON object in this exact shape:

{
  "period_from": "YYYY-MM-DD",
  "period_to":   "YYYY-MM-DD",
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

If the description is a personal name (one or two all-caps or mixed-case words that look like a person, e.g. "S GIDNEY", "MR WILL GIDNEY", "ASHRAF SYED", "GIDNEY", "JAMES BLACKETT"), set to null.

If the description is a sort code / account number reference, or otherwise ambiguous, set to null.

When in doubt, set to null. Better to leave it blank than guess wrong.

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
}

/**
 * Extracts transactions from a base64-encoded PDF using Claude.
 * Throws with a descriptive message on any failure — caller is responsible for status transitions.
 * @param {string} pdfBase64
 * @param {string} bankSlug  — must match a key in PROMPTS
 * @param {{ accountName: string }} accountMeta
 * @returns {Promise<{ transactions: Array, periodFrom: string|null, periodTo: string|null }>}
 */
export async function extractTransactionsFromPdf(pdfBase64, bankSlug, accountMeta) {
  const prompt = PROMPTS[bankSlug]
  if (!prompt) throw new Error(`No extraction prompt for bank: ${bankSlug}`)

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
  if (!parsed.transactions.length) throw new Error('Claude extracted 0 transactions — check PDF and prompt')

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
    transactions: parsed.transactions,
    periodFrom:   parsed.period_from ?? null,
    periodTo:     parsed.period_to   ?? null,
  }
}
