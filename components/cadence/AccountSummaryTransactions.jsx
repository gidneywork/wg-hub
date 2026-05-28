'use client'
import { useState, useEffect, Fragment } from 'react'
import {
  loadTransactions,
  loadCategories,
  updateTransaction,
  insertCategoryRule,
  applyRuleToExistingTransactions,
  applyAutoLinkToTransaction,
} from '../../lib/finance/db'
import { validateRuleForm } from '../../lib/finance/categories'
import { formatPence, dedupeHash } from '../../lib/finance/transactions'

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TX_BLANK = {
  category_id:    '',
  description:    '',
  merchant_clean: '',
  amount_str:     '',
  direction:      'out',
  tx_date:        '',
}

const PAGE_SIZE = 50

export default function AccountSummaryTransactions({ accountId }) {
  const [transactions, setTransactions] = useState([])
  const [categories,   setCategories]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [pageError,    setPageError]    = useState(null)

  const [categoryFilter,    setCategoryFilter]    = useState('')
  const [typeFilter,        setTypeFilter]        = useState('')
  const [dateFrom,          setDateFrom]          = useState('')
  const [dateTo,            setDateTo]            = useState('')
  const [currentPage,       setCurrentPage]       = useState(1)
  const [uncategorisedOnly, setUncategorisedOnly] = useState(false)

  const [editId,            setEditId           ] = useState(null)
  const [editForm,          setEditForm         ] = useState(TX_BLANK)
  const [editError,         setEditError        ] = useState(null)
  const [editSaving,        setEditSaving       ] = useState(false)
  const [createRuleChecked, setCreateRuleChecked] = useState(false)
  const [ruleConfirmForm,   setRuleConfirmForm  ] = useState(null)

  useEffect(() => {
    setLoading(true)
    setPageError(null)
    Promise.all([
      loadTransactions(accountId),
      loadCategories(),
    ])
      .then(([txs, cats]) => {
        setTransactions(txs)
        setCategories(cats)
      })
      .catch(e => setPageError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const hasActiveFilter = categoryFilter || typeFilter || dateFrom || dateTo || uncategorisedOnly

  function clearFilters() {
    setCategoryFilter('')
    setTypeFilter('')
    setDateFrom('')
    setDateTo('')
    setUncategorisedOnly(false)
    setCurrentPage(1)
  }

  // ── Edit open/close ────────────────────────────────────────────────────────

  function handleEditOpen(tx) {
    if (editId === tx.id) { handleEditCancel(); return }
    setEditId(tx.id)
    setEditForm({
      category_id:    tx.category_id   ?? '',
      description:    tx.description,
      merchant_clean: tx.merchant_clean ?? '',
      amount_str:     (Math.abs(Number(tx.amount_pence)) / 100).toFixed(2),
      direction:      Number(tx.amount_pence) >= 0 ? 'in' : 'out',
      tx_date:        tx.tx_date,
    })
    setCreateRuleChecked(false)
    setRuleConfirmForm(null)
    setEditError(null)
  }

  function handleEditCancel() {
    setEditId(null)
    setEditForm(TX_BLANK)
    setCreateRuleChecked(false)
    setRuleConfirmForm(null)
    setEditError(null)
  }

  function handleCreateRuleToggle(checked) {
    setCreateRuleChecked(checked)
    if (checked) {
      const matchField = editForm.merchant_clean.trim() ? 'merchant_clean' : 'description'
      const matchValue = matchField === 'merchant_clean'
        ? editForm.merchant_clean.trim()
        : editForm.description.trim()
      setRuleConfirmForm({
        category_id: editForm.category_id,
        match_type:  'contains',
        match_field: matchField,
        match_value: matchValue,
        priority:    100,
      })
    } else {
      setRuleConfirmForm(null)
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleEditSave() {
    if (!editForm.description.trim()) { setEditError('Description required.'); return }
    if (!editForm.tx_date)            { setEditError('Date required.'); return }
    const rawAmount = parseFloat(editForm.amount_str)
    if (isNaN(rawAmount) || rawAmount <= 0) { setEditError('Amount must be a positive number.'); return }
    if (createRuleChecked && ruleConfirmForm) {
      const ruleErr = validateRuleForm({ ...ruleConfirmForm, category_id: editForm.category_id })
      if (ruleErr) { setEditError(ruleErr); return }
    }

    setEditSaving(true)
    setEditError(null)
    try {
      const amount_pence = Math.round(rawAmount * 100) * (editForm.direction === 'out' ? -1 : 1)

      const changes = {
        tx_date:     editForm.tx_date,
        description: editForm.description.trim(),
        category_id: editForm.category_id || null,
        amount_pence,
      }

      const origTx = transactions.find(t => t.id === editId)
      if (
        origTx &&
        (changes.tx_date    !== origTx.tx_date ||
         amount_pence       !== Number(origTx.amount_pence) ||
         changes.description !== origTx.description)
      ) {
        changes.dedupe_hash = await dedupeHash(accountId, changes.tx_date, amount_pence, changes.description)
      }

      await updateTransaction(editId, changes)

      if (createRuleChecked && ruleConfirmForm) {
        const insertedRule = await insertCategoryRule({
          category_id: editForm.category_id,
          match_type:  ruleConfirmForm.match_type,
          match_field: ruleConfirmForm.match_field,
          match_value: ruleConfirmForm.match_value.trim(),
          priority:    Number(ruleConfirmForm.priority) || 100,
        })
        await applyRuleToExistingTransactions(insertedRule, accountId)
      }

      // Fire-and-forget — auto-link failure must not surface to the user
      applyAutoLinkToTransaction(editId).catch(e =>
        console.error('Auto-link after edit:', e.message)
      )

      const txs = await loadTransactions(accountId)
      setTransactions(txs)
      handleEditCancel()
    } catch (e) {
      setEditError(e.message || 'Failed to save.')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading)   return <div className="ast-loading">Loading…</div>
  if (pageError) return <div className="ast-error">{pageError}</div>

  const filtered = transactions.filter(tx => {
    if (categoryFilter && tx.category_id !== categoryFilter) return false
    if (typeFilter === 'debit'  && tx.amount_pence >= 0) return false
    if (typeFilter === 'credit' && tx.amount_pence <  0) return false
    if (dateFrom && tx.tx_date < dateFrom) return false
    if (dateTo   && tx.tx_date > dateTo)   return false
    return true
  })
  const uncategorisedCount = filtered.filter(tx => tx.category_id === null).length
  const displayedFiltered  = uncategorisedOnly ? filtered.filter(tx => tx.category_id === null) : filtered
  const totalPages = Math.max(1, Math.ceil(displayedFiltered.length / PAGE_SIZE))
  const safePage   = Math.min(currentPage, totalPages)
  const startIdx   = (safePage - 1) * PAGE_SIZE
  const visibleTxs = displayedFiltered.slice(startIdx, startIdx + PAGE_SIZE)

  return (
    <div className="ast-page">

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="ast-filters">
        <div className="ast-filter-group">
          <span className="ast-filter-label">Category</span>
          <select
            className="ast-filter-select"
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="ast-filter-group">
          <span className="ast-filter-label">Type</span>
          <div className="ast-filter-type-toggle">
            {[['', 'All'], ['debit', 'Debit'], ['credit', 'Credit']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`ast-filter-type-btn${typeFilter === val ? ' ast-filter-type-btn--active' : ''}`}
                onClick={() => { setTypeFilter(val); setCurrentPage(1) }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ast-filter-group">
          <span className="ast-filter-label">From</span>
          <input
            type="date"
            className="ast-filter-input"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setCurrentPage(1) }}
          />
        </div>

        <div className="ast-filter-group">
          <span className="ast-filter-label">To</span>
          <input
            type="date"
            className="ast-filter-input"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setCurrentPage(1) }}
          />
        </div>

        <div className="ast-filter-group">
          <button
            type="button"
            className={`ast-uncat-toggle${uncategorisedOnly ? ' ast-uncat-toggle--active' : ''}`}
            onClick={() => { setUncategorisedOnly(p => !p); setCurrentPage(1) }}
          >
            Uncategorised only{uncategorisedCount > 0 ? ` (${uncategorisedCount})` : ''}
          </button>
        </div>

        {hasActiveFilter && (
          <button type="button" className="ast-clear-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table / empty states ─────────────────────────────────────────────── */}
      {transactions.length === 0 ? (
        <p className="ast-empty">No transactions yet. Upload a statement to see activity on this account.</p>
      ) : displayedFiltered.length === 0 ? (
        <div className="ast-empty">
          {uncategorisedOnly
            ? <p>All transactions categorised.</p>
            : <>
                <p>No transactions match the current filters.</p>
                <button type="button" className="ast-clear-btn" onClick={clearFilters}>Clear filters</button>
              </>
          }
        </div>
      ) : (
        <>
          <table className="ast-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th className="ast-amount-col">Amount</th>
                <th className="ast-actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {visibleTxs.map(tx => (
                <Fragment key={tx.id}>
                  <tr className={`ast-row${editId === tx.id ? ' ast-row--editing' : ''}`}>
                    <td className="ast-date">{fmtDate(tx.tx_date)}</td>
                    <td className="ast-desc">{tx.merchant_clean || tx.description}</td>
                    <td className="ast-cat">
                      {categories.find(c => c.id === tx.category_id)?.name ?? 'Uncategorised'}
                    </td>
                    <td className={`ast-amount${tx.amount_pence < 0 ? ' ast-amount--debit' : ''}`}>
                      {formatPence(tx.amount_pence)}
                    </td>
                    <td className="ast-actions">
                      <button
                        type="button"
                        className={`ast-edit-btn${editId === tx.id ? ' ast-edit-btn--active' : ''}`}
                        onClick={() => handleEditOpen(tx)}
                        aria-label="Edit transaction"
                      >
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11.5 2.5a1.41 1.41 0 0 1 2 2L5 13H3v-2L11.5 2.5z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>

                  {editId === tx.id && (
                    <tr className="ast-edit-row">
                      <td colSpan={5}>
                        <div className="ast-edit-panel">
                          {editError && <p className="ast-edit-error">{editError}</p>}

                          <div className="form-row">
                            <label>Date</label>
                            <input
                              type="date"
                              value={editForm.tx_date}
                              onChange={e => setEditForm(p => ({ ...p, tx_date: e.target.value }))}
                            />
                          </div>
                          <div className="form-row">
                            <label>Description</label>
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                            />
                          </div>
                          <div className="form-row">
                            <label>Amount</label>
                            <div className="ast-amount-row">
                              <div className="ast-direction-toggle">
                                <button
                                  type="button"
                                  className={`ast-direction-btn${editForm.direction === 'out' ? ' ast-direction-btn--active' : ''}`}
                                  onClick={() => setEditForm(p => ({ ...p, direction: 'out' }))}
                                >Out</button>
                                <button
                                  type="button"
                                  className={`ast-direction-btn${editForm.direction === 'in' ? ' ast-direction-btn--active' : ''}`}
                                  onClick={() => setEditForm(p => ({ ...p, direction: 'in' }))}
                                >In</button>
                              </div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editForm.amount_str}
                                placeholder="0.00"
                                onChange={e => setEditForm(p => ({ ...p, amount_str: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <label>Category</label>
                            <select
                              value={editForm.category_id}
                              onChange={e => setEditForm(p => ({ ...p, category_id: e.target.value }))}
                            >
                              <option value="">— uncategorised —</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>

                          <div className="form-row form-row--checkbox">
                            <input
                              type="checkbox"
                              id={`ast-create-rule-${editId}`}
                              checked={createRuleChecked}
                              onChange={e => handleCreateRuleToggle(e.target.checked)}
                            />
                            <label htmlFor={`ast-create-rule-${editId}`}>Create categorisation rule from this edit</label>
                          </div>

                          {createRuleChecked && ruleConfirmForm && (
                            <div className="ast-rule-form">
                              <div className="form-row">
                                <label>Match field</label>
                                <select
                                  value={ruleConfirmForm.match_field}
                                  onChange={e => setRuleConfirmForm(p => ({ ...p, match_field: e.target.value }))}
                                >
                                  <option value="description">Description</option>
                                  <option value="merchant_clean">Merchant</option>
                                </select>
                              </div>
                              <div className="form-row">
                                <label>Match type</label>
                                <select
                                  value={ruleConfirmForm.match_type}
                                  onChange={e => setRuleConfirmForm(p => ({ ...p, match_type: e.target.value }))}
                                >
                                  <option value="contains">Contains</option>
                                  <option value="starts_with">Starts with</option>
                                  <option value="exact">Exact match</option>
                                </select>
                              </div>
                              <div className="form-row">
                                <label>Pattern</label>
                                <input
                                  type="text"
                                  value={ruleConfirmForm.match_value}
                                  onChange={e => setRuleConfirmForm(p => ({ ...p, match_value: e.target.value }))}
                                />
                              </div>
                            </div>
                          )}

                          <div className="ast-edit-actions">
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={editSaving}
                              onClick={handleEditSave}
                            >
                              {editSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="ast-cancel-btn"
                              disabled={editSaving}
                              onClick={handleEditCancel}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          {/* ── Pagination ──────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="ast-pagination">
              <button
                type="button"
                className="ast-pagination-btn"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </button>
              <span className="ast-pagination-info">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                className="ast-pagination-btn"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
