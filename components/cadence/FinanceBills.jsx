'use client'

import { Fragment, useState, useEffect } from 'react'
import {
  loadAccounts,
  loadCategories,
  loadBills,
  loadAllBillPayments,
  insertBill,
  updateBill,
  deleteBill,
  insertBillPayment,
  loadAccountTransactionsForBillMatching,
  applyRetroactiveAutoLinkForBill,
} from '../../lib/finance/db'
import {
  deriveBillStatus,
  BILL_TYPE_LABELS,
  FREQUENCY_LABELS,
  STATUS_LABELS,
  validateBillForm,
  isTransactionInBillToleranceWindow,
  advanceNextDueDate,
} from '../../lib/finance/bills'
import { formatPence } from '../../lib/finance/transactions'
import CadencePanel from './CadencePanel'

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const BILL_BLANK = {
  name:                '',
  account_id:          '',
  bill_type:           '',
  category_id:         '',
  expected_amount_str: '',
  tolerance_pct:       '20',
  frequency:           '',
  next_due_date:       '',
  anchor_day:          '',
  description_pattern: '',
  notes:               '',
  is_active:           true,
}

function BillForm({ formData, setFormData, formErrors, accounts, categories }) {
  function set(field) {
    return e => setFormData(p => ({ ...p, [field]: e.target.value }))
  }
  return (
    <div className="bm-add-form">
      {formErrors._form && <p className="fa-add-error">{formErrors._form}</p>}
      <div className="form-row">
        <label>Name</label>
        <input type="text" value={formData.name} onChange={set('name')} />
        {formErrors.name && <p className="fa-add-error">{formErrors.name}</p>}
      </div>
      <div className="form-row">
        <label>Account</label>
        <select value={formData.account_id} onChange={set('account_id')}>
          <option value="">— select —</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {formErrors.account_id && <p className="fa-add-error">{formErrors.account_id}</p>}
      </div>
      <div className="form-row">
        <label>Type</label>
        <select value={formData.bill_type} onChange={set('bill_type')}>
          <option value="">— select —</option>
          {Object.entries(BILL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {formErrors.bill_type && <p className="fa-add-error">{formErrors.bill_type}</p>}
      </div>
      <div className="form-row">
        <label>Frequency</label>
        <select value={formData.frequency} onChange={set('frequency')}>
          <option value="">— select —</option>
          {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {formErrors.frequency && <p className="fa-add-error">{formErrors.frequency}</p>}
      </div>
      <div className="form-row">
        <label>Amount (£)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.expected_amount_str}
          placeholder="0.00"
          onChange={set('expected_amount_str')}
        />
        {formErrors.expected_amount_str && <p className="fa-add-error">{formErrors.expected_amount_str}</p>}
      </div>
      <div className="form-row">
        <label>Next due date</label>
        <input type="date" value={formData.next_due_date} onChange={set('next_due_date')} />
        {formErrors.next_due_date && <p className="fa-add-error">{formErrors.next_due_date}</p>}
      </div>
      <div className="form-row">
        <label>Tolerance % <span className="form-optional">(optional, default 20)</span></label>
        <input
          type="number"
          min="0"
          max="100"
          value={formData.tolerance_pct}
          onChange={set('tolerance_pct')}
        />
        {formErrors.tolerance_pct && <p className="fa-add-error">{formErrors.tolerance_pct}</p>}
      </div>
      <div className="form-row">
        <label>Anchor day <span className="form-optional">(optional, 1–31)</span></label>
        <input
          type="number"
          min="1"
          max="31"
          value={formData.anchor_day}
          placeholder="Same as current date"
          onChange={set('anchor_day')}
        />
        {formErrors.anchor_day && <p className="fa-add-error">{formErrors.anchor_day}</p>}
      </div>
      <div className="form-row">
        <label>Category <span className="form-optional">(optional)</span></label>
        <select value={formData.category_id} onChange={set('category_id')}>
          <option value="">— none —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>Description pattern <span className="form-optional">(optional)</span></label>
        <input
          type="text"
          value={formData.description_pattern}
          placeholder="e.g. COUNCIL TAX"
          onChange={set('description_pattern')}
        />
      </div>
      <div className="form-row">
        <label>Notes <span className="form-optional">(optional)</span></label>
        <textarea rows={2} value={formData.notes} onChange={set('notes')} />
      </div>
      <div className="form-row form-row--checkbox">
        <input
          type="checkbox"
          id="fb-is-active"
          checked={formData.is_active}
          onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
        />
        <label htmlFor="fb-is-active">Active</label>
      </div>
    </div>
  )
}

export default function FinanceBills() {
  const [bills,             setBills            ] = useState([])
  const [allPayments,       setAllPayments       ] = useState([])
  const [accounts,          setAccounts          ] = useState([])
  const [categories,        setCategories        ] = useState([])
  const [loading,           setLoading           ] = useState(true)
  const [error,             setError             ] = useState(null)
  const [showInactive,      setShowInactive      ] = useState(false)
  const [adding,            setAdding            ] = useState(false)
  const [editingId,         setEditingId         ] = useState(null)
  const [markingPaidId,     setMarkingPaidId     ] = useState(null)
  const [markPaidTxs,       setMarkPaidTxs       ] = useState([])
  const [markPaidLoading,   setMarkPaidLoading   ] = useState(false)
  const [saving,            setSaving            ] = useState(false)
  const [formData,          setFormData          ] = useState(BILL_BLANK)
  const [formErrors,        setFormErrors        ] = useState({})
  const [deleteConfirming,      setDeleteConfirming     ] = useState(false)
  const [retroactiveConfirming, setRetroactiveConfirming] = useState(false)
  const [retroactiveRunning,    setRetroactiveRunning   ] = useState(false)
  const [retroactiveResult,     setRetroactiveResult    ] = useState(null)

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      loadCategories(),
      loadBills(false),
      loadAllBillPayments(),
    ])
      .then(([accs, cats, b, p]) => {
        setAccounts(accs)
        setCategories(cats)
        setBills(b)
        setAllPayments(p)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function reload() {
    // Reloads bills and payments only — accounts/categories don't change from bill operations.
    const [b, p] = await Promise.all([loadBills(showInactive), loadAllBillPayments()])
    setBills(b)
    setAllPayments(p)
  }

  // ── Add ────────────────────────────────────────────────────────────────────

  function handleAddOpen() {
    setAdding(true)
    setEditingId(null)
    setMarkingPaidId(null)
    setFormData(BILL_BLANK)
    setFormErrors({})
  }

  function handleAddCancel() {
    setAdding(false)
    setFormData(BILL_BLANK)
    setFormErrors({})
  }

  async function handleAddSave() {
    const result = validateBillForm(formData)
    if (!result.ok) { setFormErrors(result.errors); return }
    setSaving(true)
    try {
      await insertBill({
        name:                  formData.name.trim(),
        account_id:            formData.account_id,
        bill_type:             formData.bill_type,
        category_id:           formData.category_id           || null,
        expected_amount_pence: Math.round(parseFloat(formData.expected_amount_str) * 100),
        tolerance_pct:         formData.tolerance_pct !== ''  ? Number(formData.tolerance_pct) : null,
        frequency:             formData.frequency,
        next_due_date:         formData.next_due_date,
        anchor_day:            formData.anchor_day   !== ''   ? Number(formData.anchor_day) : null,
        description_pattern:   formData.description_pattern.trim() || null,
        notes:                 formData.notes.trim()          || null,
        is_active:             formData.is_active,
      })
      setAdding(false)
      setFormData(BILL_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function handleEditOpen(bill) {
    setEditingId(bill.id)
    setMarkingPaidId(null)
    setAdding(false)
    setFormData({
      name:                  bill.name,
      account_id:            bill.account_id,
      bill_type:             bill.bill_type,
      category_id:           bill.category_id           ?? '',
      expected_amount_str:   (Math.abs(Number(bill.expected_amount_pence)) / 100).toFixed(2),
      tolerance_pct:         bill.tolerance_pct != null  ? String(bill.tolerance_pct) : '20',
      frequency:             bill.frequency,
      next_due_date:         bill.next_due_date,
      anchor_day:            bill.anchor_day   != null   ? String(bill.anchor_day) : '',
      description_pattern:   bill.description_pattern   ?? '',
      notes:                 bill.notes                 ?? '',
      is_active:             bill.is_active,
    })
    setFormErrors({})
    setDeleteConfirming(false)
    setRetroactiveConfirming(false)
    setRetroactiveRunning(false)
    setRetroactiveResult(null)
  }

  function handleEditCancel() {
    setEditingId(null)
    setFormData(BILL_BLANK)
    setFormErrors({})
    setDeleteConfirming(false)
    setRetroactiveConfirming(false)
    setRetroactiveRunning(false)
    setRetroactiveResult(null)
  }

  async function handleEditSave() {
    const result = validateBillForm(formData)
    if (!result.ok) { setFormErrors(result.errors); return }
    setSaving(true)
    try {
      await updateBill(editingId, {
        name:                  formData.name.trim(),
        account_id:            formData.account_id,
        bill_type:             formData.bill_type,
        category_id:           formData.category_id           || null,
        expected_amount_pence: Math.round(parseFloat(formData.expected_amount_str) * 100),
        tolerance_pct:         formData.tolerance_pct !== ''  ? Number(formData.tolerance_pct) : null,
        frequency:             formData.frequency,
        next_due_date:         formData.next_due_date,
        anchor_day:            formData.anchor_day   !== ''   ? Number(formData.anchor_day) : null,
        description_pattern:   formData.description_pattern.trim() || null,
        notes:                 formData.notes.trim()          || null,
        is_active:             formData.is_active,
      })
      setEditingId(null)
      setFormData(BILL_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDeleteClick() {
    if (!deleteConfirming) {
      setDeleteConfirming(true)
      setTimeout(() => setDeleteConfirming(false), 5000)
      return
    }
    handleDeleteConfirm()
  }

  async function handleDeleteConfirm() {
    setSaving(true)
    try {
      await deleteBill(editingId)
      setEditingId(null)
      setDeleteConfirming(false)
      setFormData(BILL_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to delete.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Mark paid ──────────────────────────────────────────────────────────────

  async function handleMarkPaidOpen(bill) {
    setMarkingPaidId(bill.id)
    setEditingId(null)
    setMarkPaidTxs([])
    setMarkPaidLoading(true)
    try {
      const from = addDays(bill.next_due_date, -14)
      const to   = addDays(bill.next_due_date,  14)
      const txs  = await loadAccountTransactionsForBillMatching(bill.account_id, from, to)
      setMarkPaidTxs(txs)
    } catch (e) {
      console.error('handleMarkPaidOpen:', e)
    } finally {
      setMarkPaidLoading(false)
    }
  }

  function handleMarkPaidCancel() {
    setMarkingPaidId(null)
    setMarkPaidTxs([])
  }

  async function handleLinkTransaction(tx, bill) {
    setSaving(true)
    try {
      await insertBillPayment({
        bill_id:        bill.id,
        transaction_id: tx.id,
        due_date:       bill.next_due_date,
        link_source:    'manual',
      })
      await updateBill(bill.id, { next_due_date: advanceNextDueDate(bill) })
      setMarkingPaidId(null)
      setMarkPaidTxs([])
      await reload()
    } catch (e) {
      console.error('handleLinkTransaction:', e)
    } finally {
      setSaving(false)
    }
  }

  // ── Retroactive auto-link ──────────────────────────────────────────────────

  function handleRetroactiveClick() {
    if (!retroactiveConfirming) {
      setRetroactiveConfirming(true)
      setTimeout(() => setRetroactiveConfirming(false), 5000)
      return
    }
    handleRetroactiveRun()
  }

  async function handleRetroactiveRun() {
    setRetroactiveConfirming(false)
    setRetroactiveRunning(true)
    setRetroactiveResult(null)
    try {
      const result = await applyRetroactiveAutoLinkForBill(editingId)
      setRetroactiveResult(result)
      await reload()
    } catch (e) {
      setRetroactiveResult({ error: e?.message || 'Auto-link failed.' })
    } finally {
      setRetroactiveRunning(false)
    }
  }

  // ── Show inactive toggle ───────────────────────────────────────────────────

  async function handleToggleInactive() {
    const next = !showInactive
    setShowInactive(next)
    try {
      const b = await loadBills(next)
      setBills(b)
    } catch (e) {
      console.error('loadBills toggle:', e)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) return (
    <div className="fb-page">
      <div className="fb-header"><h2 className="fb-title">Bills</h2></div>
      <p className="fb-loading">Loading…</p>
    </div>
  )

  if (error) return (
    <div className="fb-page">
      <div className="fb-header"><h2 className="fb-title">Bills</h2></div>
      <p className="fb-empty">{error}</p>
    </div>
  )

  // ── Computed ───────────────────────────────────────────────────────────────

  const today = todayISO()

  const billsWithStatus = bills.map(bill => ({
    ...bill,
    _status: deriveBillStatus(bill, allPayments, today),
  }))

  const overdue = billsWithStatus.filter(b => b._status === 'overdue')
  const dueSoon = billsWithStatus.filter(b => b._status === 'due_soon')

  const markingBill = markingPaidId
    ? billsWithStatus.find(b => b.id === markingPaidId) ?? null
    : null

  const eligibleTxs = markPaidTxs.filter(
    tx => !allPayments.some(p => p.transaction_id === tx.id)
  )

  // ── Panel bodies ───────────────────────────────────────────────────────────

  const addBody = (
    <BillForm
      formData={formData}
      setFormData={setFormData}
      formErrors={formErrors}
      accounts={accounts}
      categories={categories}
    />
  )

  const editBody = (
    <>
      <BillForm
        formData={formData}
        setFormData={setFormData}
        formErrors={formErrors}
        accounts={accounts}
        categories={categories}
      />
      <div className="fb-edit-danger-zone">
        <div className="fb-retroactive-section">
          {retroactiveResult ? (
            retroactiveResult.error ? (
              <p className="fb-retroactive-result fb-retroactive-result--error">
                {retroactiveResult.error}
              </p>
            ) : (
              <p className="fb-retroactive-result">
                Linked {retroactiveResult.linkedCount} payment{retroactiveResult.linkedCount !== 1 ? 's' : ''}.
                {retroactiveResult.advancedCycles > 0 && ` ${retroactiveResult.advancedCycles} cycles advanced.`}
                {retroactiveResult.rejectedCount  > 0 && ` ${retroactiveResult.rejectedCount} cycles skipped (no confident match).`}
              </p>
            )
          ) : retroactiveConfirming ? (
            <div className="fb-confirm-section">
              <p className="fb-retroactive-hint">
                This will link matching transactions in your history to this bill.
                Incorrect matches can be unlinked manually later.
              </p>
              <div className="fb-confirm-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRetroactiveConfirming(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRetroactiveRun}
                  disabled={retroactiveRunning}
                >
                  {retroactiveRunning ? 'Running…' : 'Run'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleRetroactiveClick}
              disabled={retroactiveRunning || saving}
            >
              {retroactiveRunning ? 'Running…' : 'Run auto-link on existing transactions'}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDeleteClick}
          disabled={saving}
        >
          {deleteConfirming ? 'Click again to confirm delete' : 'Delete bill'}
        </button>
      </div>
    </>
  )

  const markPaidBody = markingBill ? (
    <div className="fb-mark-paid-body">
      {markPaidLoading ? (
        <p className="fb-mark-paid-empty">Loading transactions…</p>
      ) : eligibleTxs.length === 0 ? (
        <p className="fb-mark-paid-empty">
          No unlinked transactions found within 14 days of {markingBill.next_due_date}.
        </p>
      ) : (
        <>
          <p className="fb-mark-paid-hint">Select the transaction that paid this bill.</p>
          <ul className="fb-mark-paid-list">
            {eligibleTxs.map(tx => {
              const isMatch = isTransactionInBillToleranceWindow(tx, markingBill)
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    className={`fb-mark-paid-tx${isMatch ? ' fb-mark-paid-tx--match' : ''}`}
                    onClick={() => handleLinkTransaction(tx, markingBill)}
                    disabled={saving}
                  >
                    <span className="fb-mark-paid-tx-date">{tx.tx_date}</span>
                    <span className="fb-mark-paid-tx-desc">{tx.merchant_clean || tx.description}</span>
                    <span className="fb-mark-paid-tx-amount">{formatPence(tx.amount_pence)}</span>
                    {isMatch && <span className="fb-mark-paid-match-badge">Match</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  ) : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fb-page">
      <div className="fb-header">
        <h2 className="fb-title">Bills</h2>
        <div className="fb-header-actions">
          <button
            type="button"
            className={`fb-show-inactive${showInactive ? ' fb-show-inactive--active' : ''}`}
            onClick={handleToggleInactive}
          >
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </button>
          <button
            type="button"
            className={`fb-add-btn${adding ? ' fb-add-btn--active' : ''}`}
            onClick={handleAddOpen}
            disabled={adding}
          >
            Add bill
          </button>
        </div>
      </div>

      <CadencePanel
        open={adding}
        title="Add bill"
        body={addBody}
        confirmLabel={saving ? 'Saving…' : 'Add bill'}
        confirmClass="btn-primary"
        confirmDisabled={saving}
        onConfirm={handleAddSave}
        onCancel={handleAddCancel}
      />

      {overdue.length > 0 && (
        <div className="fb-section">
          <p className="fb-section-title">Overdue</p>
          <ul className="fb-bill-list">
            {overdue.map(bill => (
              <li key={bill.id} className="fb-bill-row">
                <span className="fb-bill-name">{bill.name}</span>
                <span className="fb-bill-type">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</span>
                <span className="fb-bill-amount">{formatPence(bill.expected_amount_pence)}</span>
                <span className="fb-bill-date">Due {bill.next_due_date}</span>
                <span className="fb-status-badge fb-status-badge--overdue">Overdue</span>
                <button
                  type="button"
                  className="fb-mark-paid-btn"
                  onClick={() => handleMarkPaidOpen(bill)}
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dueSoon.length > 0 && (
        <div className="fb-section">
          <p className="fb-section-title">Due soon</p>
          <ul className="fb-bill-list">
            {dueSoon.map(bill => (
              <li key={bill.id} className="fb-bill-row">
                <span className="fb-bill-name">{bill.name}</span>
                <span className="fb-bill-type">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</span>
                <span className="fb-bill-amount">{formatPence(bill.expected_amount_pence)}</span>
                <span className="fb-bill-date">Due {bill.next_due_date}</span>
                <span className="fb-status-badge fb-status-badge--due_soon">Due soon</span>
                <button
                  type="button"
                  className="fb-mark-paid-btn"
                  onClick={() => handleMarkPaidOpen(bill)}
                >
                  Mark paid
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="fb-section">
        <p className="fb-section-title">All bills</p>
        {billsWithStatus.length === 0 ? (
          <p className="fb-section-empty">No bills added yet.</p>
        ) : (
          <table className="fb-bill-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Frequency</th>
                <th className="fb-bill-amount-col">Amount</th>
                <th>Next due</th>
                <th>Status</th>
                <th className="fb-bill-action-col"></th>
              </tr>
            </thead>
            <tbody>
              {billsWithStatus.map(bill => {
                const isEditing    = editingId     === bill.id
                const isMarkingPaid = markingPaidId === bill.id
                return (
                  <Fragment key={bill.id}>
                    <tr className={isEditing ? 'fb-bill-row--editing' : undefined}>
                      <td className="fb-bill-name">{bill.name}</td>
                      <td className="fb-bill-type">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</td>
                      <td>{FREQUENCY_LABELS[bill.frequency] ?? bill.frequency}</td>
                      <td className="fb-bill-amount">{formatPence(bill.expected_amount_pence)}</td>
                      <td className="fb-bill-date">{bill.next_due_date}</td>
                      <td>
                        <span className={`fb-status-badge fb-status-badge--${bill._status}`}>
                          {STATUS_LABELS[bill._status]}
                        </span>
                      </td>
                      <td className="fb-bill-action-cell">
                        {bill._status !== 'inactive' && bill._status !== 'paid' && (
                          <button
                            type="button"
                            className="fb-mark-paid-btn"
                            onClick={() => isMarkingPaid ? handleMarkPaidCancel() : handleMarkPaidOpen(bill)}
                          >
                            {isMarkingPaid ? 'Cancel' : 'Mark paid'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="fb-bill-edit-btn"
                          onClick={() => isEditing ? handleEditCancel() : handleEditOpen(bill)}
                        >
                          {isEditing ? 'Cancel' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="fb-bill-panel-row">
                        <td colSpan={7}>
                          <CadencePanel
                            open={true}
                            title="Edit bill"
                            body={editBody}
                            confirmLabel={saving ? 'Saving…' : 'Save'}
                            confirmClass="btn-primary"
                            confirmDisabled={saving}
                            onConfirm={handleEditSave}
                            onCancel={handleEditCancel}
                          />
                        </td>
                      </tr>
                    )}
                    {isMarkingPaid && (
                      <tr className="fb-bill-panel-row">
                        <td colSpan={7}>
                          <CadencePanel
                            open={true}
                            title={`Mark paid — ${bill.name}`}
                            body={markPaidBody}
                            confirmLabel={null}
                            onCancel={handleMarkPaidCancel}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
