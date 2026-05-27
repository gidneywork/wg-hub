import { supabaseServer } from '../../../../lib/supabase-server'
import { extractTransactionsFromPdf } from '../../../../lib/finance/extraction'
import { dedupeHash, applyRules } from '../../../../lib/finance/transactions'
import { insertTransactions, applyAutoLinkToTransaction } from '../../../../lib/finance/db'

export const maxDuration = 300

async function failDoc(docId, message) {
  try {
    await supabaseServer
      .from('finance_statement_documents')
      .update({ status: 'failed', error_detail: message })
      .eq('id', docId)
  } catch (e) {
    console.error('parse-statement: failed to write failure status:', e)
  }
}

export async function POST(request) {
  let documentId = null

  try {
    const body = await request.json()
    documentId = body.documentId
    if (!documentId) return Response.json({ error: 'documentId required' }, { status: 400 })

    const { data: doc, error: docErr } = await supabaseServer
      .from('finance_statement_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle()
    if (docErr) throw docErr
    if (!doc) return Response.json({ error: 'Document not found' }, { status: 400 })
    if (doc.status === 'processing') return Response.json({ error: 'Already processing' }, { status: 400 })

    const { data: account, error: accErr } = await supabaseServer
      .from('finance_accounts')
      .select('*')
      .eq('id', doc.account_id)
      .maybeSingle()
    if (accErr) throw accErr
    if (!account) return Response.json({ error: 'Account not found' }, { status: 400 })

    // pending|failed → processing
    await supabaseServer
      .from('finance_statement_documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    // Download PDF from private storage bucket
    const { data: blob, error: dlErr } = await supabaseServer.storage
      .from('finance-statements')
      .download(doc.file_url)
    if (dlErr) {
      await failDoc(documentId, `Storage download failed: ${dlErr.message}`)
      return Response.json({ status: 'failed', error_detail: dlErr.message }, { status: 500 })
    }
    const pdfBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

    // Extract transactions via Claude
    let extracted
    try {
      extracted = await extractTransactionsFromPdf(
        pdfBase64,
        `${account.bank}_${account.account_type}`,
        { accountName: account.name }
      )
    } catch (e) {
      await failDoc(documentId, e.message)
      return Response.json({ status: 'failed', error_detail: e.message }, { status: 500 })
    }

    // Load active category rules (empty in v1; correct for when rules are later added)
    const { data: rules } = await supabaseServer
      .from('finance_category_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    // Build insert rows — dedupeHash is async, run in parallel
    let rows
    try {
      rows = await Promise.all(extracted.transactions.map(async tx => ({
        account_id:         account.id,
        tx_date:            tx.tx_date,
        amount_pence:       tx.amount_pence,
        description:        tx.description,
        merchant_clean:     tx.merchant_clean  ?? null,
        tx_type:            tx.tx_type         ?? null,
        category_id:        applyRules(rules ?? [], tx.description, tx.merchant_clean),
        is_transfer:        false,
        source_document_id: documentId,
        dedupe_hash:        await dedupeHash(account.id, tx.tx_date, tx.amount_pence, tx.description),
      })))
    } catch (e) {
      await failDoc(documentId, `Row build failed: ${e.message}`)
      return Response.json({ status: 'failed', error_detail: e.message }, { status: 500 })
    }

    // Insert — dedupe collisions are silent skips, not errors
    let inserted, skipped, insertedRows
    try {
      ;({ inserted, skipped, insertedRows } = await insertTransactions(rows, supabaseServer))
    } catch (e) {
      await failDoc(documentId, e.message)
      return Response.json({ status: 'failed', error_detail: e.message }, { status: 500 })
    }

    // Auto-link newly inserted transactions to active bills.
    // Pre-load bills + payments once to avoid N+1 queries across the loop.
    if (inserted > 0) {
      const { data: preloadedBills } = await supabaseServer
        .from('finance_bills').select('*')
        .eq('account_id', account.id).eq('is_active', true)
      const billsArr = preloadedBills ?? []
      const billIds  = billsArr.map(b => b.id)
      let pmtsArr    = []
      if (billIds.length > 0) {
        const { data: pmts } = await supabaseServer
          .from('finance_bill_payments').select('bill_id, due_date').in('bill_id', billIds)
        pmtsArr = pmts ?? []
      }
      const preloaded = { bills: billsArr, payments: pmtsArr }

      let linkedCount = 0
      for (const row of insertedRows) {
        try {
          const result = await applyAutoLinkToTransaction(row.id, supabaseServer, preloaded)
          if (result.linked) {
            linkedCount++
            // Keep preloaded consistent so subsequent iterations see the advanced bill state
            const idx = preloaded.bills.findIndex(b => b.id === result.billId)
            if (idx !== -1) {
              preloaded.payments.push({ bill_id: result.billId, due_date: result.paidDueDate })
              preloaded.bills[idx] = { ...preloaded.bills[idx], next_due_date: result.newNextDueDate }
            }
          }
        } catch (e) {
          console.error(`[parse-statement] Auto-link failed for tx ${row.id}:`, e.message)
        }
      }
      console.log(`[parse-statement] Auto-linked ${linkedCount}/${inserted} transactions to bills`)
    }

    // processing → imported
    await supabaseServer
      .from('finance_statement_documents')
      .update({
        status:                'imported',
        row_count:             inserted + skipped,   // total extracted — accurate on re-parse
        imported_at:           new Date().toISOString(),
        error_detail:          null,
        closing_balance_pence: extracted.closingBalancePence  ?? null,
        credit_limit_pence:    extracted.creditLimitPence     ?? null,
        minimum_payment_pence: extracted.minimumPaymentPence  ?? null,
        payment_due_date:      extracted.paymentDueDate       ?? null,
      })
      .eq('id', documentId)

    return Response.json({ status: 'imported', inserted, skipped })

  } catch (err) {
    console.error('parse-statement error:', err)
    if (documentId) await failDoc(documentId, err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
