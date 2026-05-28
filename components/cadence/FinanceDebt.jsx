'use client'
import { Fragment, useState, useEffect } from 'react'
import {
  loadAccounts, loadAllTransactions, loadStatementDocuments,
  loadDebts, createDebt, updateDebt, deleteDebt,
} from '../../lib/finance/db'
import { buildWorkingDebts, bpsToPercent, percentToBps, formatApr } from '../../lib/finance/debt'
import { formatPence } from '../../lib/finance/transactions'
import CadencePanel from './CadencePanel'

const DEBT_BLANK = { name: '', balance_str: '', apr_str: '', min_payment_str: '' }

function parsePoundsToMaybePence(str) {
  if (!str || !str.trim()) return null
  const n = parseFloat(str)
  return isNaN(n) ? null : Math.round(n * 100)
}

function penceToStr(pence) {
  if (pence == null) return ''
  return (Number(pence) / 100).toFixed(2)
}

function validateForm(formData, isManual) {
  const errors = {}
  if (isManual) {
    if (!formData.name.trim()) errors.name = 'Name is required.'
    if (!formData.balance_str.trim()) {
      errors.balance_str = 'Balance is required.'
    } else {
      const n = parseFloat(formData.balance_str)
      if (isNaN(n) || n < 0) errors.balance_str = 'Enter a positive number.'
    }
  }
  if (formData.apr_str.trim()) {
    const n = parseFloat(formData.apr_str)
    if (isNaN(n) || n < 0) errors.apr_str = 'Enter a number (0 or above).'
  }
  if (formData.min_payment_str.trim()) {
    const n = parseFloat(formData.min_payment_str)
    if (isNaN(n) || n < 0) errors.min_payment_str = 'Enter a positive number.'
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export default function FinanceDebt() {
  const [loading,          setLoading         ] = useState(true)
  const [pageError,        setPageError       ] = useState(null)
  const [accounts,         setAccounts        ] = useState([])
  const [transactions,     setTransactions    ] = useState([])
  const [statementDocs,    setStatementDocs   ] = useState([])
  const [debtRows,         setDebtRows        ] = useState([])
  const [adding,           setAdding          ] = useState(false)
  const [editingKey,       setEditingKey      ] = useState(null)
  const [saving,           setSaving          ] = useState(false)
  const [formData,         setFormData        ] = useState(DEBT_BLANK)
  const [formErrors,       setFormErrors      ] = useState({})
  const [deleteConfirming, setDeleteConfirming] = useState(false)

  useEffect(() => {
    setLoading(true)
    setPageError(null)
    Promise.all([
      loadAccounts(), loadAllTransactions(), loadStatementDocuments(), loadDebts(),
    ])
      .then(([accs, txs, docs, rows]) => {
        setAccounts(accs)
        setTransactions(txs)
        setStatementDocs(docs)
        setDebtRows(rows)
      })
      .catch(e => setPageError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function reload() {
    const rows = await loadDebts()
    setDebtRows(rows)
  }

  // ── Add ────────────────────────────────────────────────────────────────────

  function handleAddOpen() {
    setAdding(true)
    setEditingKey(null)
    setFormData(DEBT_BLANK)
    setFormErrors({})
  }

  function handleAddCancel() {
    setAdding(false)
    setFormData(DEBT_BLANK)
    setFormErrors({})
  }

  async function handleAddSave() {
    const { ok, errors } = validateForm(formData, true)
    if (!ok) { setFormErrors(errors); return }
    setSaving(true)
    try {
      await createDebt({
        name:              formData.name.trim(),
        account_id:        null,
        balance_pence:     parsePoundsToMaybePence(formData.balance_str),
        apr_bps:           formData.apr_str.trim() ? percentToBps(formData.apr_str) : null,
        min_payment_pence: parsePoundsToMaybePence(formData.min_payment_str),
      })
      setAdding(false)
      setFormData(DEBT_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function handleEditOpen(debt) {
    setEditingKey(debt.key)
    setAdding(false)
    setFormData({
      name:            debt.name,
      balance_str:     penceToStr(debt.balancePence),
      apr_str:         bpsToPercent(debt.aprBps),
      min_payment_str: penceToStr(debt.minPaymentPence),
    })
    setFormErrors({})
    setDeleteConfirming(false)
  }

  function handleEditCancel() {
    setEditingKey(null)
    setFormData(DEBT_BLANK)
    setFormErrors({})
    setDeleteConfirming(false)
  }

  async function handleEditSave(debt) {
    const isManual = debt.kind === 'manual'
    const { ok, errors } = validateForm(formData, isManual)
    if (!ok) { setFormErrors(errors); return }
    setSaving(true)
    try {
      const aprBps          = formData.apr_str.trim() ? percentToBps(formData.apr_str) : null
      const minPaymentPence = parsePoundsToMaybePence(formData.min_payment_str)

      if (debt.kind === 'linked') {
        await updateDebt(debt.debtRowId, { apr_bps: aprBps, min_payment_pence: minPaymentPence })
      } else if (debt.kind === 'auto-unlinked') {
        // Creates a linked row; partial unique index prevents duplicates.
        await createDebt({
          account_id:        debt.accountId,
          name:              debt.name,
          balance_pence:     null,
          apr_bps:           aprBps,
          min_payment_pence: minPaymentPence,
        })
      } else {
        await updateDebt(debt.debtRowId, {
          name:              formData.name.trim(),
          balance_pence:     parsePoundsToMaybePence(formData.balance_str),
          apr_bps:           aprBps,
          min_payment_pence: minPaymentPence,
        })
      }
      setEditingKey(null)
      setFormData(DEBT_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDeleteClick(debt) {
    if (!deleteConfirming) {
      setDeleteConfirming(true)
      setTimeout(() => setDeleteConfirming(false), 5000)
      return
    }
    handleDeleteConfirm(debt)
  }

  async function handleDeleteConfirm(debt) {
    setSaving(true)
    try {
      await deleteDebt(debt.debtRowId)
      setEditingKey(null)
      setDeleteConfirming(false)
      setFormData(DEBT_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to delete.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loading)   return <div className="fdt-page"><p className="fdt-empty">Loading…</p></div>
  if (pageError) return <div className="fdt-page"><p className="fdt-empty">{pageError}</p></div>

  const workingDebts = buildWorkingDebts(accounts, transactions, statementDocs, debtRows)

  const addBody = (
    <div className="bm-add-form">
      {formErrors._form && <p className="fa-add-error">{formErrors._form}</p>}
      <div className="form-row">
        <label>Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
        />
        {formErrors.name && <p className="fa-add-error">{formErrors.name}</p>}
      </div>
      <div className="form-row">
        <label>Balance (£)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.balance_str}
          placeholder="0.00"
          onChange={e => setFormData(p => ({ ...p, balance_str: e.target.value }))}
        />
        {formErrors.balance_str && <p className="fa-add-error">{formErrors.balance_str}</p>}
      </div>
      <div className="form-row">
        <label>APR % <span className="form-optional">(optional)</span></label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.apr_str}
          placeholder="e.g. 22.9"
          onChange={e => setFormData(p => ({ ...p, apr_str: e.target.value }))}
        />
        {formErrors.apr_str && <p className="fa-add-error">{formErrors.apr_str}</p>}
      </div>
      <div className="form-row">
        <label>Minimum payment (£) <span className="form-optional">(optional)</span></label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.min_payment_str}
          placeholder="0.00"
          onChange={e => setFormData(p => ({ ...p, min_payment_str: e.target.value }))}
        />
        {formErrors.min_payment_str && <p className="fa-add-error">{formErrors.min_payment_str}</p>}
      </div>
    </div>
  )

  return (
    <div className="fdt-page">
      <div className="fdt-header">
        <h2 className="fb-title">Debt</h2>
        <button
          type="button"
          className={`btn btn-primary fdt-add-btn${adding ? ' fdt-add-btn--active' : ''}`}
          onClick={handleAddOpen}
          disabled={adding}
        >
          Add debt
        </button>
      </div>

      <p className="fdt-intro">
        Cadence auto-detects accounts with a negative balance. Set an APR to enable
        paydown projections. Manual debts (e.g. personal loans not in Cadence) can be
        added separately.
      </p>

      <CadencePanel
        open={adding}
        title="Add manual debt"
        body={addBody}
        confirmLabel={saving ? 'Saving…' : 'Add debt'}
        confirmClass="btn-primary"
        confirmDisabled={saving}
        onConfirm={handleAddSave}
        onCancel={handleAddCancel}
      />

      {workingDebts.length === 0 ? (
        <p className="fdt-empty">
          No debts tracked. Add a manual debt or connect an account with a negative balance.
        </p>
      ) : (
        <table className="fdt-table">
          <thead>
            <tr>
              <th>Debt</th>
              <th className="fdt-col-balance">Balance</th>
              <th className="fdt-col-apr">APR</th>
              <th className="fdt-col-min">Min payment</th>
              <th className="fdt-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {workingDebts.map(debt => {
              const isEditing      = editingKey === debt.key
              const isManual       = debt.kind === 'manual'
              const isLinked       = debt.kind === 'linked'
              const isAutoUnlinked = debt.kind === 'auto-unlinked'
              const canDelete      = isLinked || isManual
              const deleteLabel    = isLinked ? 'Remove APR override' : 'Delete debt'

              const editBody = (
                <div className="bm-add-form">
                  {formErrors._form && <p className="fa-add-error">{formErrors._form}</p>}

                  {(isLinked || isAutoUnlinked) && (
                    <div className="fdt-edit-readonly-row">
                      <span>Balance</span>
                      <strong>{debt.balancePence != null ? formatPence(debt.balancePence) : '—'}</strong>
                      <span>from account</span>
                    </div>
                  )}

                  {isManual && (
                    <>
                      <div className="form-row">
                        <label>Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        />
                        {formErrors.name && <p className="fa-add-error">{formErrors.name}</p>}
                      </div>
                      <div className="form-row">
                        <label>Balance (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.balance_str}
                          placeholder="0.00"
                          onChange={e => setFormData(p => ({ ...p, balance_str: e.target.value }))}
                        />
                        {formErrors.balance_str && <p className="fa-add-error">{formErrors.balance_str}</p>}
                      </div>
                    </>
                  )}

                  <div className="form-row">
                    <label>APR % <span className="form-optional">(optional)</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.apr_str}
                      placeholder="e.g. 22.9"
                      onChange={e => setFormData(p => ({ ...p, apr_str: e.target.value }))}
                    />
                    {formErrors.apr_str && <p className="fa-add-error">{formErrors.apr_str}</p>}
                  </div>

                  <div className="form-row">
                    <label>Minimum payment (£) <span className="form-optional">(optional)</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.min_payment_str}
                      placeholder="0.00"
                      onChange={e => setFormData(p => ({ ...p, min_payment_str: e.target.value }))}
                    />
                    {formErrors.min_payment_str && <p className="fa-add-error">{formErrors.min_payment_str}</p>}
                  </div>

                  {canDelete && (
                    <div className="fdt-danger-zone">
                      <button
                        type="button"
                        className="fdt-danger-btn"
                        onClick={() => handleDeleteClick(debt)}
                        disabled={saving}
                      >
                        {deleteConfirming ? 'Click again to confirm' : deleteLabel}
                      </button>
                      {deleteConfirming && (
                        <span className="fdt-danger-confirm">This cannot be undone.</span>
                      )}
                    </div>
                  )}
                </div>
              )

              return (
                <Fragment key={debt.key}>
                  <tr>
                    <td>
                      <span className="fdt-debt-name">
                        {debt.name}
                        {isLinked && (
                          <span className="fdt-source-badge fdt-source-badge--linked">linked</span>
                        )}
                        {isManual && (
                          <span className="fdt-source-badge fdt-source-badge--manual">manual</span>
                        )}
                      </span>
                    </td>
                    <td className="fdt-col-balance">
                      {debt.balancePence != null ? formatPence(debt.balancePence) : '—'}
                    </td>
                    <td className="fdt-col-apr">
                      {debt.needsApr ? (
                        <button
                          type="button"
                          className="fdt-set-apr"
                          onClick={() => isEditing ? handleEditCancel() : handleEditOpen(debt)}
                        >
                          Set APR →
                        </button>
                      ) : (
                        formatApr(debt.aprBps)
                      )}
                    </td>
                    <td className="fdt-col-min">
                      {debt.minPaymentPence != null ? formatPence(debt.minPaymentPence) : '—'}
                    </td>
                    <td className="fdt-col-actions">
                      <button
                        type="button"
                        className={`fdt-edit-btn${isEditing ? ' fdt-edit-btn--active' : ''}`}
                        onClick={() => isEditing ? handleEditCancel() : handleEditOpen(debt)}
                      >
                        {isEditing ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="fdt-panel-row">
                      <td colSpan={5}>
                        <CadencePanel
                          open={true}
                          title={isAutoUnlinked ? `Set details — ${debt.name}` : `Edit — ${debt.name}`}
                          body={editBody}
                          confirmLabel={saving ? 'Saving…' : 'Save'}
                          confirmClass="btn-primary"
                          confirmDisabled={saving}
                          onConfirm={() => handleEditSave(debt)}
                          onCancel={handleEditCancel}
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

      <section className="fd-section">
        <h2 className="fd-section-title">Paydown simulator</h2>
        <p className="fd-placeholder">
          Avalanche vs snowball comparison — coming in the next release.
        </p>
      </section>
    </div>
  )
}
