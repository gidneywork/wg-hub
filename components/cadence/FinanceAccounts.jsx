'use client'
import { useState, useEffect } from 'react'
import {
  loadAccounts,
  loadStatementDocuments,
  loadAllTransactions,
  insertAccount,
  updateAccount,
  insertStatementDocument,
  getStatementSignedUrl,
} from '../../lib/finance/db'
import {
  getBankLabel, ACCOUNT_TYPE_LABELS,
  getMostRecentImportedStatement,
  computeAccountBalance,
} from '../../lib/finance/accounts'
import { formatPence } from '../../lib/finance/transactions'
import { computeNetWorth } from '../../lib/finance/dashboard'
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
const UPLOAD_BLANK = { accountId: '', file: null, periodFrom: '', periodTo: '', notes: '' }

const ALLOWED_FINANCE_MIME = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/pdf']
const MAX_STATEMENT_BYTES  = 20 * 1024 * 1024

export default function FinanceAccounts({ onViewChange }) {
  const [accounts,        setAccounts       ] = useState([])
  const [statementDocs,   setStatementDocs  ] = useState([])
  const [allTransactions, setAllTransactions] = useState([])
  const [loading,         setLoading        ] = useState(true)

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

  const [editingAccountId,  setEditingAccountId ] = useState(null)
  const [accountEditType,   setAccountEditType  ] = useState('')
  const [accountEditSaving, setAccountEditSaving] = useState(false)
  const [accountEditError,  setAccountEditError ] = useState(null)

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      loadStatementDocuments(),
      loadAllTransactions(),
    ])
      .then(([accs, docs, txs]) => {
        setAccounts(accs)
        setStatementDocs(docs)
        setAllTransactions(txs)
      })
      .catch(e => console.error('FinanceAccounts load:', e))
      .finally(() => setLoading(false))
  }, [])

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
      const txs = await loadAllTransactions()
      setAllTransactions(txs)
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

  async function handleAccountTypeSave() {
    setAccountEditSaving(true)
    setAccountEditError(null)
    try {
      await updateAccount(editingAccountId, { account_type: accountEditType })
      const accs = await loadAccounts()
      setAccounts(accs)
      setEditingAccountId(null)
    } catch (e) {
      setAccountEditError(e?.message || 'Failed to save. Please try again.')
    } finally {
      setAccountEditSaving(false)
    }
  }

  if (loading) return <div className="fa-loading">Loading…</div>

  const rollup = accounts.length > 0
    ? computeNetWorth(accounts, allTransactions, statementDocs)
    : null

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

      {rollup && (
        <div className="ar-rollup">
          <div className="ar-stat">
            <span className="ar-stat-label">Assets</span>
            <span className="ar-stat-value">{formatPence(rollup.assets)}</span>
          </div>
          <div className="ar-stat">
            <span className="ar-stat-label">Debt</span>
            <span className="ar-stat-value ar-stat-value--debt">{formatPence(-rollup.debt)}</span>
          </div>
          <div className="ar-stat">
            <span className="ar-stat-label">Net worth</span>
            <span className={`ar-stat-value${rollup.netWorth < 0 ? ' ar-stat-value--debt' : ''}`}>
              {formatPence(rollup.netWorth)}
            </span>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="fa-empty">No accounts yet.</p>
      ) : (
        <ul className="ac-list">
          {accounts.map(account => {
            const acTxs      = allTransactions.filter(tx => tx.account_id === account.id)
            const balance    = computeAccountBalance(account, acTxs, statementDocs)
            const isDebt     = balance != null && balance < 0
            const isCreditCard = account.account_type === 'credit_card'
            const ccStmt     = isCreditCard
              ? getMostRecentImportedStatement(statementDocs, account.id)
              : null

            const isEditingType = editingAccountId === account.id
            return (
              <li key={account.id} className="ac-card">
                <button
                  type="button"
                  className="ac-card-body"
                  onClick={() => onViewChange(`finance-account:${account.id}:overview`)}
                >
                  <div className="ac-card-top">
                    <span className="ac-card-name">{account.name}</span>
                    <span className={`ac-card-balance${isDebt ? ' ac-card-balance--debt' : ''}`}>
                      {balance != null ? formatPence(balance) : '—'}
                    </span>
                  </div>
                  <div className="ac-card-meta">
                    <span className="fas-hero-pill">{getBankLabel(account)}</span>
                    <span className="fas-hero-pill">{ACCOUNT_TYPE_LABELS[account.account_type]}</span>
                    {isCreditCard && ccStmt?.credit_limit_pence != null && (
                      <span className="fas-hero-pill">Limit {formatPence(ccStmt.credit_limit_pence)}</span>
                    )}
                    {isCreditCard && ccStmt?.payment_due_date && (
                      <span className="fas-hero-pill">Due {fmtDate(ccStmt.payment_due_date)}</span>
                    )}
                  </div>
                </button>
                <div className="ac-card-footer">
                  <button
                    type="button"
                    className={`ac-card-type-btn${isEditingType ? ' ac-card-type-btn--active' : ''}`}
                    onClick={() => {
                      if (isEditingType) {
                        setEditingAccountId(null)
                        setAccountEditError(null)
                      } else {
                        setEditingAccountId(account.id)
                        setAccountEditType(account.account_type)
                        setAccountEditError(null)
                      }
                    }}
                  >
                    {isEditingType ? 'Close' : 'Edit type'}
                  </button>
                </div>
                {isEditingType && (
                  <div className="ac-type-edit-panel">
                    <CadencePanel
                      open
                      title="Account type"
                      body={
                        <div className="bm-add-form">
                          {accountEditError && <p className="fa-add-error">{accountEditError}</p>}
                          <div className="form-row">
                            <label>Account type</label>
                            <select
                              value={accountEditType}
                              onChange={e => setAccountEditType(e.target.value)}
                            >
                              <option value="current">Current</option>
                              <option value="credit_card">Credit card</option>
                              <option value="savings">Savings</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      }
                      confirmLabel={accountEditSaving ? 'Saving…' : 'Save'}
                      confirmClass="btn-primary"
                      confirmDisabled={accountEditSaving || accountEditType === account.account_type}
                      onConfirm={handleAccountTypeSave}
                      onCancel={() => { setEditingAccountId(null); setAccountEditError(null) }}
                    />
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
