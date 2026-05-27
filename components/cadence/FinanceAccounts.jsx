'use client'
import { useState, useEffect } from 'react'
import {
  loadAccounts,
  loadCategories,
  loadCategoryRules,
  loadStatementDocuments,
  loadTransactions,
  insertAccount,
  insertStatementDocument,
  addTransaction,
  updateTransaction,
  insertCategoryRule,
  applyRuleToExistingTransactions,
  getStatementSignedUrl,
  applyAutoLinkToTransaction,
} from '../../lib/finance/db'
import {
  getBankLabel, ACCOUNT_TYPE_LABELS,
  getMostRecentImportedStatement,
  computeAvailableToSpend,
} from '../../lib/finance/accounts'
import { formatPence, dedupeHash } from '../../lib/finance/transactions'
import CadencePanel from './CadencePanel'

const STATUS_LABELS = {
  pending:    'Pending',
  processing: 'Processing',
  imported:   'Imported',
  failed:     'Failed',
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtUploadDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ADD_BLANK    = { name: '', bank: '', account_type: '', bank_other_text: '', notes: '' }
const TX_BLANK     = { tx_date: '', description: '', merchant_clean: '', amount_str: '', direction: 'out', tx_type: '', category_id: '', notes: '' }

const ALLOWED_FINANCE_MIME = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/pdf']
const MAX_STATEMENT_BYTES  = 20 * 1024 * 1024
const UPLOAD_BLANK         = { accountId: '', file: null, periodFrom: '', periodTo: '', notes: '' }

export default function FinanceAccounts() {
  const [accounts,      setAccounts     ] = useState([])
  const [categories,    setCategories   ] = useState([])
  const [rules,         setRules        ] = useState([])
  const [statementDocs, setStatementDocs] = useState([])
  const [txCache,       setTxCache      ] = useState({})
  const [expanded,      setExpanded     ] = useState(null)
  const [txLoadingFor,  setTxLoadingFor ] = useState(null)
  const [loading,       setLoading      ] = useState(true)

  const [showAdd,   setShowAdd  ] = useState(false)
  const [addForm,   setAddForm  ] = useState(ADD_BLANK)
  const [addSaving, setAddSaving] = useState(false)
  const [addError,  setAddError ] = useState(null)

  const [showUpload,   setShowUpload  ] = useState(false)
  const [uploadForm,   setUploadForm  ] = useState(UPLOAD_BLANK)
  const [uploadSaving, setUploadSaving] = useState(false)
  const [uploadError,  setUploadError ] = useState(null)

  const [parsingDocId,   setParsingDocId  ] = useState(null)
  const [docParseErrors, setDocParseErrors] = useState({})

  const [txPanelMode,      setTxPanelMode     ] = useState('closed')  // 'closed'|'add'|'edit'|'rule-confirm'
  const [txPanelAccountId, setTxPanelAccountId] = useState(null)
  const [txPanelRecord,    setTxPanelRecord   ] = useState(null)
  const [txPanelForm,      setTxPanelForm     ] = useState(TX_BLANK)
  const [txPanelSaving,    setTxPanelSaving   ] = useState(false)
  const [txPanelError,     setTxPanelError    ] = useState(null)
  const [createRuleChecked, setCreateRuleChecked] = useState(false)
  const [ruleConfirmForm,   setRuleConfirmForm  ] = useState(null)

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      loadCategories(),
      loadCategoryRules(),
      loadStatementDocuments(),
    ])
      .then(([accs, cats, rs, docs]) => {
        setAccounts(accs)
        setCategories(cats)
        setRules(rs)
        setStatementDocs(docs)
      })
      .catch(e => console.error('FinanceAccounts load:', e))
      .finally(() => setLoading(false))
  }, [])

  async function handleExpand(accountId) {
    if (expanded === accountId) { setExpanded(null); return }
    setExpanded(accountId)
    if (txCache[accountId]) return
    setTxLoadingFor(accountId)
    try {
      const txs     = await loadTransactions(accountId)
      const balance = txs.reduce((s, tx) => s + Number(tx.amount_pence), 0)
      setTxCache(prev => ({ ...prev, [accountId]: { txs, balance } }))
    } catch (e) {
      console.error('loadTransactions:', e)
    } finally {
      setTxLoadingFor(null)
    }
  }

  function getCategoryName(categoryId) {
    if (!categoryId) return null
    return categories.find(c => c.id === categoryId)?.name ?? null
  }

  function bustTxCache(accountId) {
    setTxCache(prev => { const n = { ...prev }; delete n[accountId]; return n })
  }

  // ── Account add ────────────────────────────────────────────────────────────

  const addDisabled =
    addSaving
    || !addForm.name.trim()
    || !addForm.bank
    || !addForm.account_type
    || (addForm.bank === 'other' && !addForm.bank_other_text.trim())

  async function handleAddAccount() {
    setAddSaving(true)
    setAddError(null)
    try {
      const nextOrder = accounts.length === 0
        ? 10
        : Math.max(...accounts.map(a => a.display_order)) + 10
      await insertAccount({
        name:            addForm.name.trim(),
        bank:            addForm.bank,
        account_type:    addForm.account_type,
        bank_other_text: addForm.bank === 'other' ? addForm.bank_other_text.trim() : null,
        notes:           addForm.notes.trim() || null,
        display_order:   nextOrder,
      })
      const accs = await loadAccounts()
      setAccounts(accs)
      setShowAdd(false)
      setAddForm(ADD_BLANK)
    } catch (e) {
      setAddError(e?.message || 'Failed to save. Please try again.')
    } finally {
      setAddSaving(false)
    }
  }

  // ── Statement upload ───────────────────────────────────────────────────────

  const uploadDisabled =
    uploadSaving
    || !uploadForm.accountId
    || !uploadForm.file

  function handleStatementFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_FINANCE_MIME.includes(file.type)) {
      setUploadError('Unsupported file type. Use CSV or plain text.')
      setUploadForm(p => ({ ...p, file: null }))
      e.target.value = ''
      return
    }
    if (file.size > MAX_STATEMENT_BYTES) {
      setUploadError('File too large. Maximum 20 MB.')
      setUploadForm(p => ({ ...p, file: null }))
      e.target.value = ''
      return
    }
    setUploadError(null)
    setUploadForm(p => ({ ...p, file }))
  }

  async function handleParseStatement(docId) {
    setParsingDocId(docId)
    setDocParseErrors(prev => { const n = { ...prev }; delete n[docId]; return n })
    try {
      const res = await fetch('/api/finance/parse-statement', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ documentId: docId }),
      })
      const json = await res.json()
      if (!res.ok || json.status === 'failed') {
        setDocParseErrors(prev => ({ ...prev, [docId]: json.error_detail || 'Parse failed.' }))
      }
      const docs = await loadStatementDocuments()
      setStatementDocs(docs)
      const doc = docs.find(d => d.id === docId)
      if (doc) bustTxCache(doc.account_id)
    } catch (e) {
      setDocParseErrors(prev => ({ ...prev, [docId]: e.message || 'Parse failed.' }))
    } finally {
      setParsingDocId(null)
    }
  }

  async function handleUploadStatement() {
    if (uploadForm.periodFrom && uploadForm.periodTo
        && uploadForm.periodFrom > uploadForm.periodTo) {
      setUploadError('Period from must be before period to.')
      return
    }
    setUploadSaving(true)
    setUploadError(null)
    try {
      await insertStatementDocument({
        account_id:  uploadForm.accountId,
        file:        uploadForm.file,
        period_from: uploadForm.periodFrom || null,
        period_to:   uploadForm.periodTo   || null,
        notes:       uploadForm.notes.trim() || null,
      })
      const docs = await loadStatementDocuments()
      setStatementDocs(docs)
      setShowUpload(false)
      setUploadForm(UPLOAD_BLANK)
    } catch (e) {
      setUploadError(e?.message || 'Upload failed. Please try again.')
    } finally {
      setUploadSaving(false)
    }
  }

  async function handleOpenStatement(doc) {
    try {
      const url = await getStatementSignedUrl(doc.file_url)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      console.error('getStatementSignedUrl:', e)
    }
  }

  // ── Transaction panel ──────────────────────────────────────────────────────

  function handleOpenAddTx(accountId) {
    setTxPanelMode('add')
    setTxPanelAccountId(accountId)
    setTxPanelRecord(null)
    setTxPanelForm(TX_BLANK)
    setCreateRuleChecked(false)
    setRuleConfirmForm(null)
    setTxPanelError(null)
  }

  function handleOpenEditTx(tx, accountId) {
    setTxPanelMode('edit')
    setTxPanelAccountId(accountId)
    setTxPanelRecord(tx)
    setTxPanelForm({
      tx_date:        tx.tx_date,
      description:    tx.description,
      merchant_clean: tx.merchant_clean ?? '',
      amount_str:     (Math.abs(Number(tx.amount_pence)) / 100).toFixed(2),
      direction:      Number(tx.amount_pence) >= 0 ? 'in' : 'out',
      tx_type:        tx.tx_type ?? '',
      category_id:    tx.category_id ?? '',
      notes:          tx.notes ?? '',
    })
    setCreateRuleChecked(false)
    setRuleConfirmForm(null)
    setTxPanelError(null)
  }

  function handleTxCancel() {
    setTxPanelMode('closed')
    setTxPanelAccountId(null)
    setTxPanelRecord(null)
    setTxPanelForm(TX_BLANK)
    setTxPanelError(null)
    setCreateRuleChecked(false)
    setRuleConfirmForm(null)
  }

  async function handleTxSave() {
    setTxPanelSaving(true)
    setTxPanelError(null)
    try {
      const rawAmount  = parseFloat(txPanelForm.amount_str)
      const amount_pence = Math.round(rawAmount * 100) * (txPanelForm.direction === 'out' ? -1 : 1)

      if (txPanelMode === 'add') {
        const hash = await dedupeHash(txPanelAccountId, txPanelForm.tx_date, amount_pence, txPanelForm.description)
        const newTx = await addTransaction({
          account_id:     txPanelAccountId,
          tx_date:        txPanelForm.tx_date,
          description:    txPanelForm.description.trim(),
          merchant_clean: txPanelForm.merchant_clean.trim() || null,
          amount_pence,
          tx_type:        txPanelForm.tx_type.trim() || null,
          category_id:    txPanelForm.category_id || null,
          notes:          txPanelForm.notes.trim() || null,
          is_transfer:    false,
          dedupe_hash:    hash,
        })
        bustTxCache(txPanelAccountId)
        handleTxCancel()
        // Fire-and-forget — auto-link failure must not surface to the user
        applyAutoLinkToTransaction(newTx.id).catch(e =>
          console.error('Auto-link after manual add:', e.message)
        )
      } else {
        const changes = {
          tx_date:        txPanelForm.tx_date,
          description:    txPanelForm.description.trim(),
          merchant_clean: txPanelForm.merchant_clean.trim() || null,
          amount_pence,
          tx_type:        txPanelForm.tx_type.trim() || null,
          category_id:    txPanelForm.category_id || null,
          notes:          txPanelForm.notes.trim() || null,
        }
        // Recompute dedupe_hash if any of the three keyed fields changed
        if (
          changes.tx_date !== txPanelRecord.tx_date ||
          amount_pence !== Number(txPanelRecord.amount_pence) ||
          changes.description !== txPanelRecord.description
        ) {
          changes.dedupe_hash = await dedupeHash(txPanelAccountId, changes.tx_date, amount_pence, changes.description)
        }
        await updateTransaction(txPanelRecord.id, changes)
        bustTxCache(txPanelAccountId)

        if (createRuleChecked && txPanelForm.category_id) {
          const matchField = txPanelForm.merchant_clean.trim() ? 'merchant_clean' : 'description'
          const matchValue = matchField === 'merchant_clean'
            ? txPanelForm.merchant_clean.trim()
            : txPanelForm.description.trim()
          setRuleConfirmForm({
            category_id: txPanelForm.category_id,
            match_type:  'contains',
            match_field: matchField,
            match_value: matchValue,
            priority:    100,
          })
          setTxPanelMode('rule-confirm')
        } else {
          handleTxCancel()
        }
      }
    } catch (e) {
      setTxPanelError(e.message || 'Failed to save.')
    } finally {
      setTxPanelSaving(false)
    }
  }

  async function handleRuleSave() {
    setTxPanelSaving(true)
    setTxPanelError(null)
    try {
      await insertCategoryRule(ruleConfirmForm)
      await applyRuleToExistingTransactions(ruleConfirmForm, txPanelAccountId)
      bustTxCache(txPanelAccountId)
      handleTxCancel()
    } catch (e) {
      setTxPanelError(e.message || 'Failed to create rule.')
    } finally {
      setTxPanelSaving(false)
    }
  }

  function handleRuleSkip() {
    handleTxCancel()
  }

  // ── Disabled guards ────────────────────────────────────────────────────────

  const txFormDisabled =
    txPanelSaving
    || !txPanelForm.tx_date
    || !txPanelForm.description.trim()
    || !txPanelForm.amount_str.trim()
    || isNaN(parseFloat(txPanelForm.amount_str))
    || parseFloat(txPanelForm.amount_str) <= 0

  if (loading) return <div className="fa-loading">Loading…</div>

  // ── Panel bodies ───────────────────────────────────────────────────────────

  const addAccountBody = (
    <div className="bm-add-form">
      {addError && <p className="fa-add-error">{addError}</p>}
      <div className="form-row">
        <label>Account name</label>
        <input
          type="text"
          value={addForm.name}
          onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <label>Bank</label>
        <select
          value={addForm.bank}
          onChange={e => setAddForm(p => ({ ...p, bank: e.target.value, bank_other_text: '' }))}
        >
          <option value="">— select —</option>
          <option value="lloyds">Lloyds</option>
          <option value="barclays">Barclays</option>
          <option value="first_direct">First Direct</option>
          <option value="hsbc">HSBC</option>
          <option value="monzo">Monzo</option>
          <option value="nationwide">Nationwide</option>
          <option value="natwest">NatWest</option>
          <option value="santander">Santander</option>
          <option value="starling">Starling</option>
          <option value="other">Other</option>
        </select>
      </div>
      {addForm.bank === 'other' && (
        <div className="form-row">
          <label>Bank name</label>
          <input
            type="text"
            value={addForm.bank_other_text}
            onChange={e => setAddForm(p => ({ ...p, bank_other_text: e.target.value }))}
          />
        </div>
      )}
      <div className="form-row">
        <label>Account type</label>
        <select
          value={addForm.account_type}
          onChange={e => setAddForm(p => ({ ...p, account_type: e.target.value }))}
        >
          <option value="">— select —</option>
          <option value="current">Current</option>
          <option value="credit_card">Credit card</option>
          <option value="savings">Savings</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="form-row">
        <label>Notes <span className="form-optional">(optional)</span></label>
        <textarea
          rows={2}
          value={addForm.notes}
          onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
        />
      </div>
    </div>
  )

  const uploadFormBody = (
    <div className="bm-add-form">
      {uploadError && <p className="fa-upload-error">{uploadError}</p>}
      {accounts.length === 0 && (
        <p className="fa-upload-no-accounts">Add an account before uploading a statement.</p>
      )}
      <div className="form-row">
        <label>Account</label>
        <select
          value={uploadForm.accountId}
          disabled={accounts.length === 0}
          onChange={e => setUploadForm(p => ({ ...p, accountId: e.target.value }))}
        >
          <option value="">— select —</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>File <span className="form-optional">(PDF or CSV · max 20 MB)</span></label>
        <label className="fa-file-picker">
          <span>{uploadForm.file ? uploadForm.file.name : 'Choose file'}</span>
          <input
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel,text/plain,application/pdf,.pdf"
            hidden
            onChange={handleStatementFileChange}
          />
        </label>
      </div>
      <div className="form-row">
        <label>Period from <span className="form-optional">(optional)</span></label>
        <input
          type="date"
          value={uploadForm.periodFrom}
          onChange={e => setUploadForm(p => ({ ...p, periodFrom: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <label>Period to <span className="form-optional">(optional)</span></label>
        <input
          type="date"
          value={uploadForm.periodTo}
          onChange={e => setUploadForm(p => ({ ...p, periodTo: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <label>Notes <span className="form-optional">(optional)</span></label>
        <textarea
          rows={2}
          value={uploadForm.notes}
          onChange={e => setUploadForm(p => ({ ...p, notes: e.target.value }))}
        />
      </div>
    </div>
  )

  const txFormAccountName = accounts.find(a => a.id === txPanelAccountId)?.name ?? ''

  const txFormBody = (
    <div className="bm-add-form fa-tx-form">
      {txPanelError && <p className="fa-add-error">{txPanelError}</p>}
      {txFormAccountName && (
        <p className="fa-tx-form-account">{txFormAccountName}</p>
      )}
      <div className="form-row">
        <label>Date</label>
        <input
          type="date"
          value={txPanelForm.tx_date}
          onChange={e => setTxPanelForm(p => ({ ...p, tx_date: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <label>Description</label>
        <input
          type="text"
          value={txPanelForm.description}
          onChange={e => setTxPanelForm(p => ({ ...p, description: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <label>Merchant <span className="form-optional">(optional)</span></label>
        <input
          type="text"
          value={txPanelForm.merchant_clean}
          onChange={e => setTxPanelForm(p => ({ ...p, merchant_clean: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <label>Amount</label>
        <div className="fa-amount-row">
          <div className="fa-direction-toggle">
            <button
              type="button"
              className={`fa-direction-btn${txPanelForm.direction === 'out' ? ' fa-direction-btn--active' : ''}`}
              onClick={() => setTxPanelForm(p => ({ ...p, direction: 'out' }))}
            >
              Out
            </button>
            <button
              type="button"
              className={`fa-direction-btn${txPanelForm.direction === 'in' ? ' fa-direction-btn--active' : ''}`}
              onClick={() => setTxPanelForm(p => ({ ...p, direction: 'in' }))}
            >
              In
            </button>
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={txPanelForm.amount_str}
            placeholder="0.00"
            onChange={e => setTxPanelForm(p => ({ ...p, amount_str: e.target.value }))}
          />
        </div>
      </div>
      <div className="form-row">
        <label>Category <span className="form-optional">(optional)</span></label>
        <select
          value={txPanelForm.category_id}
          onChange={e => setTxPanelForm(p => ({ ...p, category_id: e.target.value }))}
        >
          <option value="">— uncategorised —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>Type <span className="form-optional">(optional)</span></label>
        <input
          type="text"
          value={txPanelForm.tx_type}
          onChange={e => setTxPanelForm(p => ({ ...p, tx_type: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <label>Notes <span className="form-optional">(optional)</span></label>
        <textarea
          rows={2}
          value={txPanelForm.notes}
          onChange={e => setTxPanelForm(p => ({ ...p, notes: e.target.value }))}
        />
      </div>
      {txPanelMode === 'edit' && (
        <div className="form-row form-row--checkbox">
          <input
            type="checkbox"
            id="fa-create-rule"
            checked={createRuleChecked}
            onChange={e => setCreateRuleChecked(e.target.checked)}
          />
          <label htmlFor="fa-create-rule">Create categorisation rule from this edit</label>
        </div>
      )}
    </div>
  )

  const ruleConfirmBody = ruleConfirmForm ? (
    <div className="fa-rule-confirm">
      {txPanelError && <p className="fa-add-error">{txPanelError}</p>}
      <p className="fa-rule-confirm-label">
        Transactions where <strong>{ruleConfirmForm.match_field === 'merchant_clean' ? 'merchant' : 'description'}</strong> contains &ldquo;<strong>{ruleConfirmForm.match_value}</strong>&rdquo; will be assigned to <strong>{getCategoryName(ruleConfirmForm.category_id)}</strong>.
      </p>
      <p className="fa-rule-confirm-label">
        Existing uncategorised transactions that match will also be updated.
      </p>
      <button type="button" className="fa-rule-skip-btn" onClick={handleRuleSkip}>
        Skip — save edit only
      </button>
    </div>
  ) : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fa-page">
      <div className="fa-header">
        <h2 className="fa-title">Accounts</h2>
        <button
          type="button"
          className={`fa-add-btn${showAdd ? ' fa-add-btn--active' : ''}`}
          onClick={() => { if (!showAdd) setShowAdd(true) }}
          disabled={showAdd}
        >
          Add account
        </button>
      </div>

      <CadencePanel
        open={showAdd}
        title="Add account"
        body={addAccountBody}
        confirmLabel={addSaving ? 'Saving…' : 'Add account'}
        confirmClass="btn-primary"
        confirmDisabled={addDisabled}
        onConfirm={handleAddAccount}
        onCancel={() => { setShowAdd(false); setAddForm(ADD_BLANK); setAddError(null) }}
      />

      <CadencePanel
        open={txPanelMode === 'add' || txPanelMode === 'edit'}
        title={txPanelMode === 'edit' ? 'Edit transaction' : 'Add transaction'}
        body={txFormBody}
        confirmLabel={txPanelSaving ? 'Saving…' : (txPanelMode === 'edit' ? 'Save' : 'Add')}
        confirmClass="btn-primary"
        confirmDisabled={txFormDisabled}
        onConfirm={handleTxSave}
        onCancel={handleTxCancel}
      />

      <CadencePanel
        open={txPanelMode === 'rule-confirm'}
        title="Create rule"
        body={ruleConfirmBody}
        confirmLabel={txPanelSaving ? 'Creating…' : 'Create rule'}
        confirmClass="btn-primary"
        confirmDisabled={txPanelSaving}
        onConfirm={handleRuleSave}
        cancelLabel={null}
        onCancel={handleRuleSkip}
      />

      {accounts.length === 0 ? (
        <p className="fa-empty">No accounts yet.</p>
      ) : (
        <ul className="fa-list">
          {accounts.map(account => {
            const isExpanded    = expanded === account.id
            const cached        = txCache[account.id]
            const isCreditCard  = account.account_type === 'credit_card'
            const ccStmt        = isCreditCard ? getMostRecentImportedStatement(statementDocs, account.id) : null
            const ccAvailable   = isCreditCard && ccStmt ? computeAvailableToSpend(account, statementDocs) : null
            const isDebt        = isCreditCard && ccStmt?.closing_balance_pence != null

            const balance = (() => {
              if (isCreditCard && ccStmt?.closing_balance_pence != null) {
                return formatPence(-Math.abs(Number(ccStmt.closing_balance_pence)))
              }
              return cached != null ? formatPence(cached.balance) : '—'
            })()

            return (
              <li key={account.id} className={`fa-account-row${isExpanded ? ' fa-account-row--open' : ''}`}>
                <button
                  type="button"
                  className="fa-account-header"
                  onClick={() => handleExpand(account.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="fa-account-name">{account.name}</span>
                  <div className="fa-account-meta">
                    <span className="fa-account-bank">{getBankLabel(account)}</span>
                    <span className="fa-account-type">{ACCOUNT_TYPE_LABELS[account.account_type]}</span>
                    <span className={`fa-account-balance${isDebt ? ' fa-account-balance--debt' : ''}`}>{balance}</span>
                  </div>
                  <svg className={`fa-chevron${isExpanded ? ' fa-chevron--open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {isCreditCard && ccStmt && (
                  <div className="fa-cc-row">
                    {ccStmt.credit_limit_pence != null && (
                      <span className="fa-cc-field">
                        <span className="fa-cc-label">Limit</span>
                        <span className="fa-cc-value">{formatPence(ccStmt.credit_limit_pence)}</span>
                      </span>
                    )}
                    {ccAvailable != null && (
                      <span className="fa-cc-field">
                        <span className="fa-cc-label">Available</span>
                        <span className="fa-cc-value">{formatPence(ccAvailable)}</span>
                      </span>
                    )}
                    {ccStmt.minimum_payment_pence != null && (
                      <span className="fa-cc-field">
                        <span className="fa-cc-label">Min payment</span>
                        <span className="fa-cc-value">{formatPence(ccStmt.minimum_payment_pence)}</span>
                      </span>
                    )}
                    {ccStmt.payment_due_date && (
                      <span className="fa-cc-field">
                        <span className="fa-cc-label">Due</span>
                        <span className="fa-cc-value">{fmtDate(ccStmt.payment_due_date)}</span>
                      </span>
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div className="fa-account-body">
                    <div className="fa-account-body-header">
                      <button
                        type="button"
                        className="fa-add-tx-btn"
                        onClick={() => handleOpenAddTx(account.id)}
                      >
                        Add transaction
                      </button>
                    </div>
                    {txLoadingFor === account.id ? (
                      <p className="fa-tx-loading">Loading…</p>
                    ) : !cached ? (
                      <p className="fa-tx-empty">No transactions yet.</p>
                    ) : cached.txs.length === 0 ? (
                      <p className="fa-tx-empty">No transactions yet.</p>
                    ) : (
                      <table className="fa-tx-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th className="fa-tx-amount-col">Amount</th>
                            <th className="fa-tx-edit-col"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cached.txs.map(tx => {
                            const catName  = getCategoryName(tx.category_id)
                            const isCredit = tx.amount_pence >= 0
                            return (
                              <tr key={tx.id}>
                                <td className="fa-tx-date">{fmtDate(tx.tx_date)}</td>
                                <td className="fa-tx-desc">{tx.merchant_clean || tx.description}</td>
                                <td className="fa-tx-cat">
                                  {catName && <span className="fa-cat-badge">{catName}</span>}
                                </td>
                                <td className={`fa-tx-amount${isCredit ? ' fa-tx-amount--credit' : ' fa-tx-amount--debit'}`}>
                                  {formatPence(tx.amount_pence)}
                                </td>
                                <td className="fa-tx-edit-col">
                                  <button
                                    type="button"
                                    className="fa-tx-edit-btn"
                                    onClick={() => handleOpenEditTx(tx, account.id)}
                                    aria-label="Edit transaction"
                                  >
                                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11.5 2.5a1.41 1.41 0 0 1 2 2L5 13H3v-2L11.5 2.5z"/>
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <section className="fa-docs-section">
        <div className="fa-docs-header">
          <h3 className="fa-docs-title">Statements</h3>
          <button
            type="button"
            className={`fa-upload-btn${showUpload ? ' fa-upload-btn--active' : ''}`}
            onClick={() => { if (!showUpload) setShowUpload(true) }}
            disabled={showUpload}
          >
            Upload statement
          </button>
        </div>

        <CadencePanel
          open={showUpload}
          title="Upload statement"
          body={uploadFormBody}
          confirmLabel={uploadSaving ? 'Uploading…' : 'Upload'}
          confirmClass="btn-primary"
          confirmDisabled={uploadDisabled}
          onConfirm={handleUploadStatement}
          onCancel={() => { setShowUpload(false); setUploadForm(UPLOAD_BLANK); setUploadError(null) }}
        />

        {statementDocs.length === 0 ? (
          <p className="fa-docs-empty">No statements uploaded yet.</p>
        ) : (
          <ul className="fa-docs-list">
            {statementDocs.map(doc => {
              const account = accounts.find(a => a.id === doc.account_id)
              return (
                <li key={doc.id} className="fa-doc-row">
                  <span className="fa-doc-date">{fmtUploadDate(doc.uploaded_at)}</span>
                  <button
                    type="button"
                    className="fa-doc-filename-btn"
                    onClick={() => handleOpenStatement(doc)}
                    title={doc.file_name}
                  >
                    {doc.file_name}
                  </button>
                  <span className="fa-doc-account">{account?.name ?? '—'}</span>
                  {parsingDocId === doc.id ? (
                    <span className="fa-doc-status fa-doc-status--processing fa-parse-btn--loading">Parsing…</span>
                  ) : doc.status === 'imported' ? (
                    <span className="fa-doc-status fa-doc-status--imported">
                      Imported{doc.row_count != null ? ` · ${doc.row_count}` : ''}
                    </span>
                  ) : doc.status === 'pending' || doc.status === 'failed' ? (
                    <>
                      <span className={`fa-doc-status fa-doc-status--${doc.status}`}>
                        {STATUS_LABELS[doc.status]}
                      </span>
                      <button
                        type="button"
                        className="fa-parse-btn"
                        onClick={() => handleParseStatement(doc.id)}
                        disabled={parsingDocId !== null}
                      >
                        {doc.status === 'failed' ? 'Retry' : 'Parse'}
                      </button>
                    </>
                  ) : (
                    <span className={`fa-doc-status fa-doc-status--${doc.status}`}>
                      {STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                  )}
                  {docParseErrors[doc.id] && (
                    <p className="fa-doc-error">{docParseErrors[doc.id]}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

    </div>
  )
}
