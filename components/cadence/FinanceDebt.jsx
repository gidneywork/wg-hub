'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import {
  loadAccounts, loadAllTransactions, loadStatementDocuments,
  loadDebts, createDebt, updateDebt, deleteDebt,
} from '../../lib/finance/db'
import { computeAccountBalance } from '../../lib/finance/accounts'
import {
  buildWorkingDebts, simulateStrategy, buildComparisonChartData,
  bpsToPercent, percentToBps, formatApr,
  computeAmortisationPayment, projectAmortisation, formatMonths,
} from '../../lib/finance/debt'
import { formatPence } from '../../lib/finance/transactions'
import { CHART_PALETTE, penceToShort } from '../../lib/finance/spending'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import CadencePanel from './CadencePanel'

const DEBT_BLANK = {
  name:                    '',
  balance_str:             '',
  apr_str:                 '',
  min_payment_str:         '',
  term_months_str:         '',
  monthly_payment_str:     '',
  arrears_str:             '',
  fixed_period_months_str: '',
  revert_apr_str:          '',
  include_in_strategy:     true,
}

function parsePoundsToMaybePence(str) {
  if (!str || !str.trim()) return null
  const n = parseFloat(str)
  return isNaN(n) ? null : Math.round(n * 100)
}

function penceToStr(pence) {
  if (pence == null) return ''
  return (Number(pence) / 100).toFixed(2)
}

function validateDebtForm(formData, debtType, isManual) {
  const errors = {}

  if (!formData.name.trim()) errors.name = 'Name is required.'

  if (isManual) {
    if (!formData.balance_str.trim()) {
      errors.balance_str = debtType === 'revolving' ? 'Balance is required.' : 'Principal is required.'
    } else {
      const n = parseFloat(formData.balance_str)
      if (isNaN(n) || n <= 0) errors.balance_str = 'Enter a positive number.'
    }
  }

  if (formData.apr_str.trim()) {
    const n = parseFloat(formData.apr_str)
    if (isNaN(n) || n < 0 || n > 100) errors.apr_str = 'Enter a number between 0 and 100.'
  }

  if (debtType === 'revolving') {
    if (formData.min_payment_str.trim()) {
      const n = parseFloat(formData.min_payment_str)
      if (isNaN(n) || n < 0) errors.min_payment_str = 'Enter a positive number.'
    }
  } else {
    if (!formData.term_months_str.trim()) {
      errors.term_months_str = 'Term is required.'
    } else {
      const n = parseInt(formData.term_months_str, 10)
      if (isNaN(n) || n <= 0 || String(n) !== formData.term_months_str.trim()) {
        errors.term_months_str = 'Enter a whole number of months (e.g. 240).'
      }
    }

    if (formData.monthly_payment_str.trim()) {
      const n = parseFloat(formData.monthly_payment_str)
      if (isNaN(n) || n <= 0) errors.monthly_payment_str = 'Enter a positive number.'
    }

    if (formData.arrears_str.trim()) {
      const n = parseFloat(formData.arrears_str)
      if (isNaN(n) || n < 0) errors.arrears_str = 'Enter 0 or a positive number.'
    }

    const hasFixed  = formData.fixed_period_months_str.trim() !== ''
    const hasRevert = formData.revert_apr_str.trim() !== ''

    if (hasFixed !== hasRevert) {
      const msg = 'Enter both a fixed period and a revert rate, or leave both blank.'
      if (!hasFixed) errors.fixed_period_months_str = msg
      else           errors.revert_apr_str = msg
    }

    if (hasFixed) {
      const fp   = parseInt(formData.fixed_period_months_str, 10)
      const term = parseInt(formData.term_months_str, 10)
      if (isNaN(fp) || fp <= 0) {
        errors.fixed_period_months_str = 'Enter a whole number of months.'
      } else if (!isNaN(term) && fp >= term) {
        errors.fixed_period_months_str = 'Fixed period must be shorter than the total term.'
      }
    }

    if (hasRevert) {
      const n = parseFloat(formData.revert_apr_str)
      if (isNaN(n) || n < 0 || n > 100) errors.revert_apr_str = 'Enter a number between 0 and 100.'
    }
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
  const [addType,          setAddType         ] = useState(null)
  const [expandedKey,      setExpandedKey     ] = useState(null)
  const [editingKey,       setEditingKey      ] = useState(null)
  const [editingDebtType,  setEditingDebtType ] = useState(null)
  const [saving,           setSaving          ] = useState(false)
  const [formData,         setFormData        ] = useState(DEBT_BLANK)
  const [formErrors,       setFormErrors      ] = useState({})
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [budgetStr,        setBudgetStr        ] = useState('')

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

  // useMemo must be above early returns — Rules of Hooks (React #310)
  const simMemo = useMemo(() => {
    const wd         = buildWorkingDebts(accounts, transactions, statementDocs, debtRows)
    const startTotal = wd.reduce((s, d) => s + (d.balancePence ?? 0), 0)
    const minTotal   = wd.reduce((s, d) => s + (d.minPaymentPence ?? 0), 0)
    const parsedBudget = budgetStr.trim() && !isNaN(parseFloat(budgetStr))
      ? Math.round(parseFloat(budgetStr) * 100)
      : null
    const budgetP = parsedBudget != null ? parsedBudget : minTotal
    const a = simulateStrategy(wd, budgetP, 'avalanche')
    const s = simulateStrategy(wd, budgetP, 'snowball')
    return {
      workingDebts:       wd,
      minimumsTotalPence: minTotal,
      budgetPence:        budgetP,
      avalanche:          a,
      snowball:           s,
      startTotal,
      chartData:          buildComparisonChartData(a, s, startTotal),
    }
  }, [accounts, transactions, statementDocs, debtRows, budgetStr])

  async function reload() {
    const rows = await loadDebts()
    setDebtRows(rows)
  }

  // ── Add ────────────────────────────────────────────────────────────────────

  function openAdd(type) {
    setAddType(type)
    setEditingKey(null)
    setEditingDebtType(null)
    setExpandedKey(null)
    setFormData(DEBT_BLANK)
    setFormErrors({})
  }

  function handleAddCancel() {
    setAddType(null)
    setFormData(DEBT_BLANK)
    setFormErrors({})
  }

  async function handleAddSave() {
    const { ok, errors } = validateDebtForm(formData, addType, true)
    if (!ok) { setFormErrors(errors); return }
    setSaving(true)
    try {
      if (addType === 'revolving') {
        await createDebt({
          account_id:          null,
          debt_type:           'revolving',
          name:                formData.name.trim(),
          balance_pence:       parsePoundsToMaybePence(formData.balance_str),
          apr_bps:             formData.apr_str.trim() ? percentToBps(formData.apr_str) : null,
          min_payment_pence:   parsePoundsToMaybePence(formData.min_payment_str),
          include_in_strategy: formData.include_in_strategy,
        })
      } else {
        await createDebt({
          account_id:            null,
          debt_type:             addType,
          name:                  formData.name.trim(),
          balance_pence:         parsePoundsToMaybePence(formData.balance_str),
          apr_bps:               formData.apr_str.trim() ? percentToBps(formData.apr_str) : null,
          term_months:           parseInt(formData.term_months_str, 10),
          monthly_payment_pence: formData.monthly_payment_str.trim() ? parsePoundsToMaybePence(formData.monthly_payment_str) : null,
          arrears_pence:         formData.arrears_str.trim() ? parsePoundsToMaybePence(formData.arrears_str) : null,
          fixed_period_months:   formData.fixed_period_months_str.trim() ? parseInt(formData.fixed_period_months_str, 10) : null,
          revert_apr_bps:        formData.revert_apr_str.trim() ? percentToBps(formData.revert_apr_str) : null,
          include_in_strategy:   formData.include_in_strategy,
        })
      }
      setAddType(null)
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
    const rowData = debt.debtRowId ? debtRows.find(r => r.id === debt.debtRowId) : null
    setEditingKey(debt.key)
    setEditingDebtType('revolving')
    setAddType(null)
    setExpandedKey(null)
    setFormData({
      ...DEBT_BLANK,
      name:                debt.name,
      balance_str:         penceToStr(debt.balancePence),
      apr_str:             bpsToPercent(debt.aprBps),
      min_payment_str:     penceToStr(debt.minPaymentPence),
      include_in_strategy: rowData?.include_in_strategy ?? true,
    })
    setFormErrors({})
    setDeleteConfirming(false)
  }

  function handleLoanEditOpen(row) {
    setEditingKey(row.id)
    setEditingDebtType(row.debt_type)
    setAddType(null)
    setExpandedKey(null)
    setFormData({
      ...DEBT_BLANK,
      name:                    row.name,
      balance_str:             penceToStr(row.balance_pence),
      apr_str:                 bpsToPercent(row.apr_bps),
      term_months_str:         row.term_months != null ? String(row.term_months) : '',
      monthly_payment_str:     penceToStr(row.monthly_payment_pence),
      arrears_str:             penceToStr(row.arrears_pence),
      fixed_period_months_str: row.fixed_period_months != null ? String(row.fixed_period_months) : '',
      revert_apr_str:          bpsToPercent(row.revert_apr_bps),
      include_in_strategy:     row.include_in_strategy ?? true,
    })
    setFormErrors({})
    setDeleteConfirming(false)
  }

  function handleEditCancel() {
    setEditingKey(null)
    setEditingDebtType(null)
    setFormData(DEBT_BLANK)
    setFormErrors({})
    setDeleteConfirming(false)
  }

  async function handleEditSave(debt) {
    const isManual       = debt.kind === 'manual'
    const { ok, errors } = validateDebtForm(formData, 'revolving', isManual)
    if (!ok) { setFormErrors(errors); return }
    setSaving(true)
    try {
      const aprBps          = formData.apr_str.trim() ? percentToBps(formData.apr_str) : null
      const minPaymentPence = parsePoundsToMaybePence(formData.min_payment_str)
      if (debt.kind === 'linked') {
        await updateDebt(debt.debtRowId, {
          apr_bps: aprBps, min_payment_pence: minPaymentPence,
          include_in_strategy: formData.include_in_strategy,
        })
      } else if (debt.kind === 'auto-unlinked') {
        await createDebt({
          account_id:          debt.accountId,
          name:                debt.name,
          balance_pence:       null,
          apr_bps:             aprBps,
          min_payment_pence:   minPaymentPence,
          debt_type:           'revolving',
          include_in_strategy: formData.include_in_strategy,
        })
      } else {
        await updateDebt(debt.debtRowId, {
          name:                formData.name.trim(),
          balance_pence:       parsePoundsToMaybePence(formData.balance_str),
          apr_bps:             aprBps,
          min_payment_pence:   minPaymentPence,
          include_in_strategy: formData.include_in_strategy,
        })
      }
      setEditingKey(null)
      setEditingDebtType(null)
      setFormData(DEBT_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleLoanEditSave(row) {
    const { ok, errors } = validateDebtForm(formData, row.debt_type, true)
    if (!ok) { setFormErrors(errors); return }
    setSaving(true)
    try {
      await updateDebt(row.id, {
        name:                  formData.name.trim(),
        balance_pence:         parsePoundsToMaybePence(formData.balance_str),
        apr_bps:               formData.apr_str.trim() ? percentToBps(formData.apr_str) : null,
        term_months:           parseInt(formData.term_months_str, 10),
        monthly_payment_pence: formData.monthly_payment_str.trim() ? parsePoundsToMaybePence(formData.monthly_payment_str) : null,
        arrears_pence:         formData.arrears_str.trim() ? parsePoundsToMaybePence(formData.arrears_str) : null,
        fixed_period_months:   formData.fixed_period_months_str.trim() ? parseInt(formData.fixed_period_months_str, 10) : null,
        revert_apr_bps:        formData.revert_apr_str.trim() ? percentToBps(formData.revert_apr_str) : null,
        include_in_strategy:   formData.include_in_strategy,
      })
      setEditingKey(null)
      setEditingDebtType(null)
      setFormData(DEBT_BLANK)
      await reload()
    } catch (e) {
      setFormErrors({ _form: e?.message || 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDeleteClick(id) {
    if (!deleteConfirming) {
      setDeleteConfirming(true)
      setTimeout(() => setDeleteConfirming(false), 5000)
      return
    }
    handleDeleteConfirm(id)
  }

  async function handleDeleteConfirm(id) {
    setSaving(true)
    try {
      await deleteDebt(id)
      setEditingKey(null)
      setEditingDebtType(null)
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

  // ── Computed data ──────────────────────────────────────────────────────────

  const { workingDebts, minimumsTotalPence, budgetPence, avalanche, snowball, startTotal, chartData } = simMemo

  const revolvingIncluded = workingDebts.filter(d => !d.isArrears)

  // Excluded revolving rows: include_in_strategy=false filtered out of workingDebts.
  // For linked excluded rows (account_id set), resolve live balance via computeAccountBalance.
  const revolvingExcluded = debtRows
    .filter(r => r.debt_type === 'revolving' && r.include_in_strategy === false)
    .map(row => {
      if (row.account_id != null) {
        const acc   = accounts.find(a => a.id === row.account_id)
        const acTxs = transactions.filter(tx => tx.account_id === row.account_id)
        const bal   = acc ? computeAccountBalance(acc, acTxs, statementDocs) : null
        return {
          ...row,
          _displayName:    acc?.name ?? row.name,
          _displayBalance: bal != null ? Math.abs(bal) : null,
          _isLinked:       true,
        }
      }
      return {
        ...row,
        _displayName:    row.name,
        _displayBalance: row.balance_pence != null ? Number(row.balance_pence) : null,
        _isLinked:       false,
      }
    })

  const loanRows   = debtRows.filter(r => r.debt_type === 'loan' || r.debt_type === 'mortgage')
  const hasAnyDebt = revolvingIncluded.length > 0 || revolvingExcluded.length > 0 || loanRows.length > 0

  // ── Shared form element ────────────────────────────────────────────────────

  const includeToggle = (
    <div className="form-row fdt-toggle-row">
      <label>Include in repayment strategy</label>
      <button
        type="button"
        role="switch"
        aria-checked={formData.include_in_strategy}
        className={`fdt-toggle${formData.include_in_strategy ? ' fdt-toggle--on' : ''}`}
        onClick={() => setFormData(p => ({ ...p, include_in_strategy: !p.include_in_strategy }))}
      >
        {formData.include_in_strategy ? 'On' : 'Off'}
      </button>
    </div>
  )

  // ── Add form bodies ────────────────────────────────────────────────────────

  const revolvingAddBody = (
    <div className="bm-add-form">
      {formErrors._form && <p className="fa-add-error">{formErrors._form}</p>}
      <div className="form-row">
        <label>Name</label>
        <input type="text" value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        {formErrors.name && <p className="fa-add-error">{formErrors.name}</p>}
      </div>
      <div className="form-row">
        <label>Balance (£)</label>
        <input type="number" step="0.01" min="0" value={formData.balance_str} placeholder="0.00"
          onChange={e => setFormData(p => ({ ...p, balance_str: e.target.value }))} />
        {formErrors.balance_str && <p className="fa-add-error">{formErrors.balance_str}</p>}
      </div>
      <div className="form-row">
        <label>APR % <span className="form-optional">(optional)</span></label>
        <input type="number" step="0.01" min="0" value={formData.apr_str} placeholder="e.g. 22.9"
          onChange={e => setFormData(p => ({ ...p, apr_str: e.target.value }))} />
        {formErrors.apr_str && <p className="fa-add-error">{formErrors.apr_str}</p>}
      </div>
      <div className="form-row">
        <label>Minimum payment (£) <span className="form-optional">(optional)</span></label>
        <input type="number" step="0.01" min="0" value={formData.min_payment_str} placeholder="0.00"
          onChange={e => setFormData(p => ({ ...p, min_payment_str: e.target.value }))} />
        {formErrors.min_payment_str && <p className="fa-add-error">{formErrors.min_payment_str}</p>}
      </div>
      {includeToggle}
    </div>
  )

  const loanAddBody = (
    <div className="bm-add-form">
      {formErrors._form && <p className="fa-add-error">{formErrors._form}</p>}
      <div className="form-row">
        <label>Name</label>
        <input type="text" value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
        {formErrors.name && <p className="fa-add-error">{formErrors.name}</p>}
      </div>
      <div className="form-row">
        <label>Principal (£)</label>
        <input type="number" step="0.01" min="0" value={formData.balance_str} placeholder="0.00"
          onChange={e => setFormData(p => ({ ...p, balance_str: e.target.value }))} />
        {formErrors.balance_str && <p className="fa-add-error">{formErrors.balance_str}</p>}
      </div>
      <div className="form-row">
        <label>APR % <span className="form-optional">(optional)</span></label>
        <input type="number" step="0.01" min="0" max="100" value={formData.apr_str} placeholder="e.g. 4.5"
          onChange={e => setFormData(p => ({ ...p, apr_str: e.target.value }))} />
        {formErrors.apr_str && <p className="fa-add-error">{formErrors.apr_str}</p>}
      </div>
      <div className="form-row">
        <label>Term (months)</label>
        <input type="number" step="1" min="1" value={formData.term_months_str} placeholder="e.g. 240"
          onChange={e => setFormData(p => ({ ...p, term_months_str: e.target.value }))} />
        {formErrors.term_months_str && <p className="fa-add-error">{formErrors.term_months_str}</p>}
      </div>
      <div className="form-row">
        <label>Monthly payment (£) <span className="form-optional">(optional)</span></label>
        <input type="number" step="0.01" min="0" value={formData.monthly_payment_str} placeholder="0.00"
          onChange={e => setFormData(p => ({ ...p, monthly_payment_str: e.target.value }))} />
        {formErrors.monthly_payment_str && <p className="fa-add-error">{formErrors.monthly_payment_str}</p>}
      </div>
      <div className="form-row">
        <label>Arrears (£) <span className="form-optional">(optional)</span></label>
        <input type="number" step="0.01" min="0" value={formData.arrears_str} placeholder="0.00"
          onChange={e => setFormData(p => ({ ...p, arrears_str: e.target.value }))} />
        {formErrors.arrears_str && <p className="fa-add-error">{formErrors.arrears_str}</p>}
      </div>
      <div className="form-row">
        <label>Fixed period (months) <span className="form-optional">(optional)</span></label>
        <input type="number" step="1" min="1" value={formData.fixed_period_months_str} placeholder="e.g. 24"
          onChange={e => setFormData(p => ({ ...p, fixed_period_months_str: e.target.value }))} />
        {formErrors.fixed_period_months_str && <p className="fa-add-error">{formErrors.fixed_period_months_str}</p>}
      </div>
      <div className="form-row">
        <label>Revert APR % <span className="form-optional">(optional)</span></label>
        <input type="number" step="0.01" min="0" max="100" value={formData.revert_apr_str} placeholder="e.g. 7.5"
          onChange={e => setFormData(p => ({ ...p, revert_apr_str: e.target.value }))} />
        {formErrors.revert_apr_str && <p className="fa-add-error">{formErrors.revert_apr_str}</p>}
      </div>
      {includeToggle}
    </div>
  )

  // ── Edit form bodies ───────────────────────────────────────────────────────

  function revolvingEditBody(debt) {
    const isManual       = debt.kind === 'manual'
    const isLinked       = debt.kind === 'linked'
    const isAutoUnlinked = debt.kind === 'auto-unlinked'
    const canDelete      = isLinked || isManual
    const deleteLabel    = isLinked ? 'Remove APR override' : 'Delete debt'

    return (
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
              <input type="text" value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
              {formErrors.name && <p className="fa-add-error">{formErrors.name}</p>}
            </div>
            <div className="form-row">
              <label>Balance (£)</label>
              <input type="number" step="0.01" min="0" value={formData.balance_str} placeholder="0.00"
                onChange={e => setFormData(p => ({ ...p, balance_str: e.target.value }))} />
              {formErrors.balance_str && <p className="fa-add-error">{formErrors.balance_str}</p>}
            </div>
          </>
        )}

        <div className="form-row">
          <label>APR % <span className="form-optional">(optional)</span></label>
          <input type="number" step="0.01" min="0" value={formData.apr_str} placeholder="e.g. 22.9"
            onChange={e => setFormData(p => ({ ...p, apr_str: e.target.value }))} />
          {formErrors.apr_str && <p className="fa-add-error">{formErrors.apr_str}</p>}
        </div>

        <div className="form-row">
          <label>Minimum payment (£) <span className="form-optional">(optional)</span></label>
          <input type="number" step="0.01" min="0" value={formData.min_payment_str} placeholder="0.00"
            onChange={e => setFormData(p => ({ ...p, min_payment_str: e.target.value }))} />
          {formErrors.min_payment_str && <p className="fa-add-error">{formErrors.min_payment_str}</p>}
        </div>

        {includeToggle}

        {canDelete && (
          <div className="fdt-danger-zone">
            <button type="button" className="fdt-danger-btn"
              onClick={() => handleDeleteClick(debt.debtRowId)} disabled={saving}>
              {deleteConfirming ? 'Click again to confirm' : deleteLabel}
            </button>
            {deleteConfirming && <span className="fdt-danger-confirm">This cannot be undone.</span>}
          </div>
        )}
      </div>
    )
  }

  function loanEditBody(row) {
    return (
      <div className="bm-add-form">
        {formErrors._form && <p className="fa-add-error">{formErrors._form}</p>}
        <div className="form-row">
          <label>Name</label>
          <input type="text" value={formData.name}
            onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
          {formErrors.name && <p className="fa-add-error">{formErrors.name}</p>}
        </div>
        <div className="form-row">
          <label>Principal (£)</label>
          <input type="number" step="0.01" min="0" value={formData.balance_str} placeholder="0.00"
            onChange={e => setFormData(p => ({ ...p, balance_str: e.target.value }))} />
          {formErrors.balance_str && <p className="fa-add-error">{formErrors.balance_str}</p>}
        </div>
        <div className="form-row">
          <label>APR % <span className="form-optional">(optional)</span></label>
          <input type="number" step="0.01" min="0" max="100" value={formData.apr_str} placeholder="e.g. 4.5"
            onChange={e => setFormData(p => ({ ...p, apr_str: e.target.value }))} />
          {formErrors.apr_str && <p className="fa-add-error">{formErrors.apr_str}</p>}
        </div>
        <div className="form-row">
          <label>Term (months)</label>
          <input type="number" step="1" min="1" value={formData.term_months_str} placeholder="e.g. 240"
            onChange={e => setFormData(p => ({ ...p, term_months_str: e.target.value }))} />
          {formErrors.term_months_str && <p className="fa-add-error">{formErrors.term_months_str}</p>}
        </div>
        <div className="form-row">
          <label>Monthly payment (£) <span className="form-optional">(optional)</span></label>
          <input type="number" step="0.01" min="0" value={formData.monthly_payment_str} placeholder="0.00"
            onChange={e => setFormData(p => ({ ...p, monthly_payment_str: e.target.value }))} />
          {formErrors.monthly_payment_str && <p className="fa-add-error">{formErrors.monthly_payment_str}</p>}
        </div>
        <div className="form-row">
          <label>Arrears (£) <span className="form-optional">(optional)</span></label>
          <input type="number" step="0.01" min="0" value={formData.arrears_str} placeholder="0.00"
            onChange={e => setFormData(p => ({ ...p, arrears_str: e.target.value }))} />
          {formErrors.arrears_str && <p className="fa-add-error">{formErrors.arrears_str}</p>}
        </div>
        <div className="form-row">
          <label>Fixed period (months) <span className="form-optional">(optional)</span></label>
          <input type="number" step="1" min="1" value={formData.fixed_period_months_str} placeholder="e.g. 24"
            onChange={e => setFormData(p => ({ ...p, fixed_period_months_str: e.target.value }))} />
          {formErrors.fixed_period_months_str && <p className="fa-add-error">{formErrors.fixed_period_months_str}</p>}
        </div>
        <div className="form-row">
          <label>Revert APR % <span className="form-optional">(optional)</span></label>
          <input type="number" step="0.01" min="0" max="100" value={formData.revert_apr_str} placeholder="e.g. 7.5"
            onChange={e => setFormData(p => ({ ...p, revert_apr_str: e.target.value }))} />
          {formErrors.revert_apr_str && <p className="fa-add-error">{formErrors.revert_apr_str}</p>}
        </div>
        {includeToggle}
        <div className="fdt-danger-zone">
          <button type="button" className="fdt-danger-btn"
            onClick={() => handleDeleteClick(row.id)} disabled={saving}>
            {deleteConfirming ? 'Click again to confirm' : 'Delete'}
          </button>
          {deleteConfirming && <span className="fdt-danger-confirm">This cannot be undone.</span>}
        </div>
      </div>
    )
  }

  // ── Loan/mortgage amortisation drawer ─────────────────────────────────────

  function renderLoanDrawer(row) {
    const principal  = row.balance_pence != null ? Number(row.balance_pence) : 0
    const aprBps     = row.apr_bps ?? 0
    const termMonths = row.term_months ?? 0
    const hasPayment = row.monthly_payment_pence != null
    const effectiveP = hasPayment
      ? Number(row.monthly_payment_pence)
      : computeAmortisationPayment(principal, aprBps, termMonths)
    const arrears    = row.arrears_pence != null ? Number(row.arrears_pence) : 0

    const proj = projectAmortisation(
      principal, aprBps, termMonths, effectiveP,
      row.fixed_period_months ?? null,
      row.revert_apr_bps ?? null,
    )

    return (
      <div className="fdt-drawer">
        <div className="fdt-drawer-line">
          {hasPayment
            ? <>Monthly payment: <strong>{formatPence(effectiveP)}</strong></>
            : <>Suggested payment: <strong>{formatPence(effectiveP)}</strong>{' — enter your actual payment when editing to refine the projection'}</>
          }
        </div>

        {!proj.feasible ? (
          <div className="fdt-drawer-line fdt-drawer-infeasible">
            This payment doesn&apos;t cover the interest — the balance would grow. Check the figures.
          </div>
        ) : proj.neverClears ? (
          <div className="fdt-drawer-line fdt-drawer-infeasible">
            Won&apos;t clear within 50 years at this payment.
          </div>
        ) : (
          <div className="fdt-drawer-line">
            Paid off in <strong>{formatMonths(proj.months)}</strong>{' · '}Total interest <strong>{formatPence(proj.totalInterestPence)}</strong>
          </div>
        )}

        {proj.revertMonth != null && proj.recalculatedPaymentPence != null && (
          <div className="fdt-drawer-line">
            Rate reverts to <strong>{formatApr(row.revert_apr_bps)}</strong> after <strong>{formatMonths(row.fixed_period_months)}</strong> — payment rises to <strong>{formatPence(proj.recalculatedPaymentPence)}</strong>
          </div>
        )}

        {arrears > 0 && (
          <div className="fdt-drawer-line">
            Arrears: <strong>{formatPence(arrears)}</strong>
            {row.include_in_strategy !== false
              ? ' — included in repayment strategy'
              : ' — not included in repayment strategy'
            }
          </div>
        )}

        {row.include_in_strategy === false && arrears === 0 && (
          <div className="fdt-drawer-line fdt-drawer-muted">
            Excluded from repayment strategy
          </div>
        )}

        {arrears > 0 && (
          <p className="fdt-signpost">
            In arrears? Free, confidential debt advice is available from National Debtline (0808 808 4000) and StepChange (0800 138 1111).
          </p>
        )}
      </div>
    )
  }

  // ── Strategy comparison ────────────────────────────────────────────────────

  const eligibleDebts = workingDebts
  const bothFeasible  = avalanche.feasible && snowball.feasible
  const bothClear     = bothFeasible && !avalanche.neverClears && !snowball.neverClears
  const isTie         = bothClear
    && avalanche.months === snowball.months
    && avalanche.totalInterestPence === snowball.totalInterestPence
  const interestDiff  = bothClear && !isTie ? Math.abs(avalanche.totalInterestPence - snowball.totalInterestPence) : 0
  const monthsDiff    = bothClear && !isTie ? Math.abs(avalanche.months - snowball.months) : 0
  const cheaperIs     = bothClear && !isTie
    ? (avalanche.totalInterestPence <= snowball.totalInterestPence ? 'avalanche' : 'snowball') : null
  const fasterIs      = bothClear && !isTie
    ? (avalanche.months <= snowball.months ? 'avalanche' : 'snowball') : null
  const showChart     = bothClear

  function PaydownTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div className="fdt-chart-tooltip" data-cadence="">
        <div className="fdt-chart-tooltip-month">Month {label}</div>
        {payload.map(p => (
          <div key={p.dataKey} className="fdt-chart-tooltip-row">
            <span style={{ color: p.color }}>{p.name}</span>
            <span>{formatPence(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fdt-page">
      <div className="fdt-header">
        <h2 className="fb-title">Holdings</h2>
        <div className="fdt-header-actions">
          <button type="button"
            className={`btn btn-primary fdt-add-btn${addType === 'revolving' ? ' fdt-add-btn--active' : ''}`}
            onClick={() => openAdd('revolving')} disabled={addType === 'revolving'}>
            + Add debt
          </button>
          <button type="button"
            className={`btn btn-ghost fdt-add-btn${addType === 'loan' ? ' fdt-add-btn--active' : ''}`}
            onClick={() => openAdd('loan')} disabled={addType === 'loan'}>
            + Add loan
          </button>
          <button type="button"
            className={`btn btn-ghost fdt-add-btn${addType === 'mortgage' ? ' fdt-add-btn--active' : ''}`}
            onClick={() => openAdd('mortgage')} disabled={addType === 'mortgage'}>
            + Add mortgage
          </button>
        </div>
      </div>

      <p className="fdt-intro">
        Your financial position — what you own and what you owe. Cadence auto-detects
        accounts with a negative balance; set an APR to enable paydown projections.
        Loans and mortgages can be added separately. Property and other assets will follow.
      </p>

      <CadencePanel
        open={addType !== null}
        title={addType === 'revolving' ? 'Add debt' : addType === 'loan' ? 'Add loan' : 'Add mortgage'}
        body={addType === 'revolving' ? revolvingAddBody : loanAddBody}
        confirmLabel={saving ? 'Saving…' : addType === 'revolving' ? 'Add debt' : addType === 'loan' ? 'Add loan' : 'Add mortgage'}
        confirmClass="btn-primary"
        confirmDisabled={saving}
        onConfirm={handleAddSave}
        onCancel={handleAddCancel}
      />

      {!hasAnyDebt ? (
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
              <th className="fdt-col-min">Payment</th>
              <th className="fdt-col-actions"></th>
            </tr>
          </thead>
          <tbody>

            {/* Section A: revolving included (from workingDebts) */}
            {revolvingIncluded.map(debt => {
              const isEditing      = editingKey === debt.key
              const isLinked       = debt.kind === 'linked'
              const isAutoUnlinked = debt.kind === 'auto-unlinked'
              const isManual       = debt.kind === 'manual'

              return (
                <Fragment key={debt.key}>
                  <tr>
                    <td>
                      <span className="fdt-debt-name">
                        {debt.name}
                        {isLinked && <span className="fdt-source-badge fdt-source-badge--linked">linked</span>}
                        {isManual && <span className="fdt-source-badge fdt-source-badge--manual">manual</span>}
                      </span>
                    </td>
                    <td className="fdt-col-balance">
                      {debt.balancePence != null ? formatPence(debt.balancePence) : '—'}
                    </td>
                    <td className="fdt-col-apr">
                      {debt.needsApr ? (
                        <button type="button" className="fdt-set-apr"
                          onClick={() => isEditing ? handleEditCancel() : handleEditOpen(debt)}>
                          Set APR →
                        </button>
                      ) : formatApr(debt.aprBps)}
                    </td>
                    <td className="fdt-col-min">
                      {debt.minPaymentPence != null ? formatPence(debt.minPaymentPence) : '—'}
                    </td>
                    <td className="fdt-col-actions">
                      <button type="button"
                        className={`fdt-edit-btn${isEditing ? ' fdt-edit-btn--active' : ''}`}
                        onClick={() => isEditing ? handleEditCancel() : handleEditOpen(debt)}>
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
                          body={revolvingEditBody(debt)}
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

            {/* Section A2: revolving excluded (include_in_strategy = false) */}
            {revolvingExcluded.map(row => {
              const synthetic = {
                key:             row._isLinked ? `linked:${row.account_id}` : `manual:${row.id}`,
                kind:            row._isLinked ? 'linked' : 'manual',
                accountId:       row.account_id ?? null,
                accountName:     row._displayName,
                debtRowId:       row.id,
                name:            row._displayName,
                balancePence:    row._displayBalance,
                aprBps:          row.apr_bps,
                minPaymentPence: row.min_payment_pence != null ? Number(row.min_payment_pence) : null,
                needsApr:        false,
                isArrears:       false,
              }
              const isEditing = editingKey === synthetic.key

              return (
                <Fragment key={`excluded:${row.id}`}>
                  <tr className="fdt-excluded-row">
                    <td>
                      <span className="fdt-debt-name">
                        {row._displayName}
                        {row._isLinked
                          ? <span className="fdt-source-badge fdt-source-badge--linked">linked</span>
                          : <span className="fdt-source-badge fdt-source-badge--manual">manual</span>
                        }
                        <span className="fdt-source-badge fdt-source-badge--excluded">excluded</span>
                      </span>
                    </td>
                    <td className="fdt-col-balance">
                      {row._displayBalance != null ? formatPence(row._displayBalance) : '—'}
                    </td>
                    <td className="fdt-col-apr">{formatApr(row.apr_bps)}</td>
                    <td className="fdt-col-min">—</td>
                    <td className="fdt-col-actions">
                      <button type="button"
                        className={`fdt-edit-btn${isEditing ? ' fdt-edit-btn--active' : ''}`}
                        onClick={() => isEditing ? handleEditCancel() : handleEditOpen(synthetic)}>
                        {isEditing ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="fdt-panel-row">
                      <td colSpan={5}>
                        <CadencePanel
                          open={true}
                          title={`Edit — ${row._displayName}`}
                          body={revolvingEditBody(synthetic)}
                          confirmLabel={saving ? 'Saving…' : 'Save'}
                          confirmClass="btn-primary"
                          confirmDisabled={saving}
                          onConfirm={() => handleEditSave(synthetic)}
                          onCancel={handleEditCancel}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}

            {/* Section B: loans & mortgages */}
            {loanRows.length > 0 && (
              <tr className="fdt-section-row">
                <td colSpan={5}>Loans &amp; mortgages</td>
              </tr>
            )}

            {loanRows.map(row => {
              const isEditing  = editingKey === row.id
              const isExpanded = expandedKey === row.id && !isEditing
              const principal  = row.balance_pence != null ? Number(row.balance_pence) : 0
              const hasPayment = row.monthly_payment_pence != null
              const suggestedP = (row.apr_bps != null && row.term_months)
                ? computeAmortisationPayment(principal, row.apr_bps, row.term_months)
                : null

              return (
                <Fragment key={row.id}>
                  <tr
                    className="fdt-loan-row"
                    tabIndex={0}
                    onClick={() => {
                      if (isEditing) return
                      setExpandedKey(isExpanded ? null : row.id)
                      setEditingKey(null)
                      setEditingDebtType(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (!isEditing) {
                          setExpandedKey(isExpanded ? null : row.id)
                          setEditingKey(null)
                          setEditingDebtType(null)
                        }
                      }
                    }}
                  >
                    <td>
                      <span className="fdt-debt-name">
                        {row.name}
                        <span className={`fdt-source-badge fdt-source-badge--${row.debt_type}`}>{row.debt_type}</span>
                        {row.include_in_strategy === false && (
                          <span className="fdt-source-badge fdt-source-badge--excluded">excluded</span>
                        )}
                      </span>
                    </td>
                    <td className="fdt-col-balance">{principal ? formatPence(principal) : '—'}</td>
                    <td className="fdt-col-apr">{formatApr(row.apr_bps)}</td>
                    <td className="fdt-col-min">
                      {hasPayment
                        ? formatPence(Number(row.monthly_payment_pence))
                        : suggestedP != null
                          ? <span className="fdt-suggested">{formatPence(suggestedP)}</span>
                          : '—'
                      }
                    </td>
                    <td className="fdt-col-actions">
                      <button type="button"
                        className={`fdt-edit-btn${isEditing ? ' fdt-edit-btn--active' : ''}`}
                        onClick={e => {
                          e.stopPropagation()
                          isEditing ? handleEditCancel() : handleLoanEditOpen(row)
                        }}>
                        {isEditing ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="fdt-drawer-row">
                      <td colSpan={5}>
                        {renderLoanDrawer(row)}
                      </td>
                    </tr>
                  )}

                  {isEditing && (
                    <tr className="fdt-panel-row">
                      <td colSpan={5}>
                        <CadencePanel
                          open={true}
                          title={`Edit — ${row.name}`}
                          body={loanEditBody(row)}
                          confirmLabel={saving ? 'Saving…' : 'Save'}
                          confirmClass="btn-primary"
                          confirmDisabled={saving}
                          onConfirm={() => handleLoanEditSave(row)}
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

      <section className="fdt-strategy">
        <h2 className="fd-section-title">Strategy comparison</h2>
        <p className="fdt-strategy-scope">
          Covers your revolving debts and any arrears. Loan and mortgage principal follows its own amortisation schedule — see each loan&apos;s projection in the table above.
        </p>

        <div className="fdt-budget-row">
          <label className="fdt-budget-label" htmlFor="fdt-budget">Monthly budget</label>
          <div className="fdt-budget-input-wrap">
            <span className="fdt-budget-prefix">£</span>
            <input
              id="fdt-budget"
              type="number"
              step="0.01"
              min="0"
              className="fdt-budget-input"
              value={budgetStr}
              placeholder={(minimumsTotalPence / 100).toFixed(2)}
              onChange={e => setBudgetStr(e.target.value)}
            />
          </div>
        </div>
        <p className="fdt-budget-helper">
          Defaults to your minimum payments ({formatPence(minimumsTotalPence)}). Increase it to see faster payoff.
        </p>

        {eligibleDebts.length === 0 ? (
          <p className="fdt-strategy-empty">
            No debts are currently included in the comparison. Add a debt, or enable &apos;include in strategy&apos; on an existing one.
          </p>
        ) : !avalanche.feasible ? (
          <p className="fdt-strategy-infeasible">
            Your budget of {formatPence(budgetPence)} doesn&apos;t cover the minimum payments, which total {formatPence(avalanche.minimumsTotalPence)}. Increase your budget to see projections.
          </p>
        ) : (
          <>
            {bothClear && (isTie ? (
              <p className="fdt-takeaway">
                Both strategies clear your debt in the same time and cost — the order doesn&apos;t change the outcome here.
              </p>
            ) : cheaperIs === fasterIs ? (
              <p className="fdt-takeaway">
                {cheaperIs === 'avalanche' ? 'Avalanche' : 'Snowball'} clears your debt{' '}
                {monthsDiff > 0 && <><strong>{formatMonths(monthsDiff)}</strong> sooner and </>}
                saves <strong>{formatPence(interestDiff)}</strong> in interest.
              </p>
            ) : (
              <p className="fdt-takeaway">
                {cheaperIs === 'avalanche' ? 'Avalanche' : 'Snowball'} saves <strong>{formatPence(interestDiff)}</strong> in interest.
                {' '}{fasterIs === 'avalanche' ? 'Avalanche' : 'Snowball'} clears <strong>{formatMonths(monthsDiff)}</strong> sooner.
              </p>
            ))}

            <div className="fdt-comparison-grid">
              {[
                { key: 'avalanche', result: avalanche, title: 'Avalanche', method: 'Highest APR first' },
                { key: 'snowball',  result: snowball,  title: 'Snowball',  method: 'Smallest balance first' },
              ].map(({ key, result, title, method }) => {
                const isAccent = cheaperIs === key && !isTie
                return (
                  <div key={key} className={`fdt-card${isAccent ? ' fdt-card--accent' : ''}`}>
                    <div className="fdt-card-title">{title}</div>
                    <div className="fdt-card-method">{method}</div>
                    {result.neverClears ? (
                      <div className="fdt-card-figure fdt-card-figure--muted">
                        Won&apos;t clear within 50 years at this budget
                      </div>
                    ) : (
                      <div className="fdt-card-figure">
                        Debt-free in <strong>{formatMonths(result.months)}</strong>
                      </div>
                    )}
                    <div className="fdt-card-figure">
                      Total interest <strong>{formatPence(result.totalInterestPence)}</strong>
                    </div>
                    {result.payoffOrder.length > 0 && (
                      <ol className="fdt-card-order">
                        {result.payoffOrder.map((item) => (
                          <li key={item.key}>
                            {item.name} <span className="fdt-card-order-month">(month {item.month})</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )
              })}
            </div>

            {showChart && chartData.length > 1 ? (
              <div className="fdt-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontFamily: 'var(--mono)', fontSize: 11, fill: '#8A867D' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={penceToShort} tick={{ fontFamily: 'var(--mono)', fontSize: 11, fill: '#8A867D' }} axisLine={false} tickLine={false} width={56} />
                    <Tooltip content={<PaydownTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }} />
                    <Line type="monotone" dataKey="avalanche" name="Avalanche" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="snowball"  name="Snowball"  stroke={CHART_PALETTE[1]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : !showChart && bothFeasible && (
              <p className="fdt-chart-note">
                Chart not available — at this budget, one or more debts won&apos;t clear within 50 years. Increase your budget to see the projection.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
