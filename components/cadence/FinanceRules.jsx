'use client'

import { Fragment, useState, useEffect, useRef } from 'react'
import {
  loadCategoryRules,
  insertCategoryRule,
  updateCategoryRule,
  deleteCategoryRule,
  loadCategories,
  applyRuleToExistingTransactions,
  loadCommonPaymentPatterns,
} from '../../lib/finance/db'
import {
  MATCHER_FIELD_LABELS,
  MATCH_TYPE_LABELS,
  validateRuleForm,
  getRootCategory,
} from '../../lib/finance/categories'

const RULE_BLANK   = { match_value: '', match_field: 'description',    match_type: 'contains', category_id: '', priority: 100 }
const ASSIGN_BLANK = { match_value: '', match_field: 'merchant_clean', match_type: 'exact',    category_id: '', priority: 100 }

function getCategoryLabel(categories, categoryId) {
  const cat = categories.find(c => c.id === categoryId)
  if (!cat) return '—'
  const root = getRootCategory(categories, cat)
  if (root.id === cat.id) return cat.name
  return `${root.name} / ${cat.name}`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function RuleFormBody({ form, onChange, categories }) {
  return (
    <div className="fr-form-grid">
      <label className="fr-field">
        <span className="fr-label">Pattern</span>
        <input
          type="text"
          className="fr-input"
          value={form.match_value}
          onChange={e => onChange(f => ({ ...f, match_value: e.target.value }))}
        />
      </label>
      <label className="fr-field">
        <span className="fr-label">Field</span>
        <select
          className="fr-select"
          value={form.match_field}
          onChange={e => onChange(f => ({ ...f, match_field: e.target.value }))}
        >
          {Object.entries(MATCHER_FIELD_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="fr-field">
        <span className="fr-label">Match type</span>
        <select
          className="fr-select"
          value={form.match_type}
          onChange={e => onChange(f => ({ ...f, match_type: e.target.value }))}
        >
          {Object.entries(MATCH_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="fr-field">
        <span className="fr-label">Category</span>
        <select
          className="fr-select"
          value={form.category_id}
          onChange={e => onChange(f => ({ ...f, category_id: e.target.value }))}
        >
          <option value="">Select category</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>
              {getCategoryLabel(categories, c.id)}
            </option>
          ))}
        </select>
      </label>
      <label className="fr-field">
        <span className="fr-label">Priority</span>
        <input
          type="number"
          className="fr-input fr-input--narrow"
          value={form.priority}
          onChange={e => onChange(f => ({ ...f, priority: e.target.value }))}
          min="1"
          max="999"
        />
      </label>
    </div>
  )
}

export default function FinanceRules() {
  const [rules,          setRules]          = useState([])
  const [categories,     setCategories]     = useState([])
  const [commonPayments, setCommonPayments] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [pageError,      setPageError]      = useState(null)

  // Edit panel state
  const [editId,      setEditId]      = useState(null)
  const [editForm,    setEditForm]    = useState(RULE_BLANK)
  const [editError,   setEditError]   = useState(null)
  const [editSaving,  setEditSaving]  = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const deleteTimerRef = useRef(null)

  const [reapplyConfirmId, setReapplyConfirmId] = useState(null)
  const [reapplyRunning,   setReapplyRunning]   = useState(false)
  const [reapplyResult,    setReapplyResult]    = useState(null)

  // Assign panel state (Common Payments section)
  const [assigningPattern, setAssigningPattern] = useState(null)
  const [assignForm,       setAssignForm]       = useState(ASSIGN_BLANK)
  const [assignError,      setAssignError]      = useState(null)
  const [assignSaving,     setAssignSaving]     = useState(false)
  const [assignResult,     setAssignResult]     = useState(null)

  async function reload() {
    const [r, cp] = await Promise.all([loadCategoryRules(), loadCommonPaymentPatterns(3)])
    setRules(r)
    setCommonPayments(cp)
  }

  useEffect(() => {
    Promise.all([loadCategoryRules(), loadCategories(), loadCommonPaymentPatterns(3)])
      .then(([r, c, cp]) => { setRules(r); setCategories(c); setCommonPayments(cp) })
      .catch(e => setPageError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // ── Edit panel handlers ────────────────────────────────────────────────────

  function handleEditOpen(rule) {
    if (editId === rule.id) { handleEditCancel(); return }
    clearTimeout(deleteTimerRef.current)
    // Close assign panel — single-panel invariant
    setAssigningPattern(null)
    setAssignForm(ASSIGN_BLANK)
    setAssignError(null)
    setAssignResult(null)
    setEditId(rule.id)
    setEditForm({
      match_value:  rule.match_value,
      match_field:  rule.match_field,
      match_type:   rule.match_type,
      category_id:  rule.category_id,
      priority:     rule.priority,
    })
    setEditError(null)
    setDeleteConfirmId(null)
    setReapplyConfirmId(null)
    setReapplyResult(null)
  }

  function handleEditCancel() {
    clearTimeout(deleteTimerRef.current)
    setEditId(null)
    setEditForm(RULE_BLANK)
    setEditError(null)
    setDeleteConfirmId(null)
    setReapplyConfirmId(null)
    setReapplyResult(null)
  }

  async function handleEditSave() {
    const err = validateRuleForm(editForm)
    if (err) { setEditError(err); return }
    setEditSaving(true)
    setEditError(null)
    try {
      const updates = {
        match_value:  editForm.match_value.trim(),
        match_field:  editForm.match_field,
        match_type:   editForm.match_type,
        category_id:  editForm.category_id,
        priority:     Number(editForm.priority) || 100,
      }
      await updateCategoryRule(editId, updates)
      setRules(prev => prev.map(r => r.id === editId ? { ...r, ...updates } : r))
      handleEditCancel()
    } catch (e) {
      setEditError(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  function handleDeleteClick(ruleId) {
    if (deleteConfirmId === ruleId) return
    clearTimeout(deleteTimerRef.current)
    setDeleteConfirmId(ruleId)
    deleteTimerRef.current = setTimeout(() => setDeleteConfirmId(null), 5000)
  }

  async function handleDeleteConfirm(ruleId) {
    clearTimeout(deleteTimerRef.current)
    setDeleteConfirmId(null)
    try {
      await deleteCategoryRule(ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
      handleEditCancel()
    } catch (e) {
      setEditError(e.message)
    }
  }

  function handleReapplyClick(ruleId) {
    setReapplyConfirmId(ruleId)
    setReapplyResult(null)
  }

  async function handleReapplyConfirm(rule) {
    setReapplyConfirmId(null)
    setReapplyRunning(true)
    setReapplyResult(null)
    try {
      const result = await applyRuleToExistingTransactions(rule, null)
      setReapplyResult({ ruleId: rule.id, updated: result.updated })
    } catch (e) {
      setReapplyResult({ ruleId: rule.id, error: e.message })
    } finally {
      setReapplyRunning(false)
    }
  }

  // ── Assign panel handlers ──────────────────────────────────────────────────

  function handleOpenAssign(item) {
    // Close edit panel — single-panel invariant
    handleEditCancel()
    setAssignResult(null)

    if (assigningPattern === item.pattern) {
      setAssigningPattern(null)
      setAssignForm(ASSIGN_BLANK)
      setAssignError(null)
      return
    }
    setAssigningPattern(item.pattern)
    setAssignForm({
      match_value:  item.pattern,
      match_field:  'merchant_clean',
      match_type:   'exact',
      category_id:  '',
      priority:     100,
    })
    setAssignError(null)
  }

  function handleAssignCancel() {
    setAssigningPattern(null)
    setAssignForm(ASSIGN_BLANK)
    setAssignError(null)
  }

  async function handleAssignSave() {
    const err = validateRuleForm(assignForm)
    if (err) { setAssignError(err); return }
    setAssignSaving(true)
    setAssignError(null)
    try {
      const insertedRule = await insertCategoryRule({
        match_value:  assignForm.match_value.trim(),
        match_field:  assignForm.match_field,
        match_type:   assignForm.match_type,
        category_id:  assignForm.category_id,
        priority:     Number(assignForm.priority) || 100,
      })
      const { updated } = await applyRuleToExistingTransactions(insertedRule, null)
      setAssignResult(`Created rule and categorised ${updated} transaction${updated !== 1 ? 's' : ''}.`)
      await reload()
      setAssigningPattern(null)
      setAssignForm(ASSIGN_BLANK)
    } catch (e) {
      setAssignError(e.message || 'Failed to create rule.')
    } finally {
      setAssignSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading)   return <div className="fr-loading">Loading rules…</div>
  if (pageError) return <div className="fr-error">{pageError}</div>

  return (
    <div className="fr-page">
      <div className="fr-header">
        <h1 className="fr-title">Rules</h1>
        <p className="fr-subtitle">Rules auto-categorise transactions on import. Higher priority (lower number) runs first.</p>
      </div>

      {commonPayments.length > 0 && (
        <section className="fr-common-section">
          <header className="fr-common-header">
            <h2 className="fr-common-title">Common payments</h2>
            <p className="fr-common-subtitle">
              Recurring merchants in your transaction history without a rule yet.
            </p>
          </header>

          {assignResult && (
            <p className="fr-common-result">{assignResult}</p>
          )}

          <ul className="fr-common-list">
            {commonPayments.map(item => (
              <Fragment key={item.pattern}>
                <li className="fr-common-row">
                  <span className="fr-common-pattern">{item.pattern}</span>
                  <span className="fr-common-count">{item.count} uncategorised</span>
                  <button
                    type="button"
                    className={`btn btn-ghost fr-common-assign-btn${assigningPattern === item.pattern ? ' fr-common-assign-btn--active' : ''}`}
                    onClick={() => handleOpenAssign(item)}
                  >
                    Assign rule
                  </button>
                </li>
                {assigningPattern === item.pattern && (
                  <li className="fr-common-panel-row">
                    <div className="fr-common-panel">
                      <RuleFormBody form={assignForm} onChange={setAssignForm} categories={categories} />
                      {assignError && <p className="fr-form-error">{assignError}</p>}
                      <div className="fr-form-actions">
                        <button type="button" className="btn btn-ghost" onClick={handleAssignCancel}>Cancel</button>
                        <button type="button" className="btn btn-primary" onClick={handleAssignSave} disabled={assignSaving}>
                          {assignSaving ? 'Saving…' : 'Save rule'}
                        </button>
                      </div>
                    </div>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
        </section>
      )}

      {rules.length === 0 ? (
        <p className="fr-empty">No rules yet. Rules are created from the Edit Transaction panel.</p>
      ) : (
        <table className="fr-table">
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Field</th>
              <th>Type</th>
              <th>Category</th>
              <th>Created</th>
              <th className="fr-actions-col"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => {
              const isEditing = editId === rule.id
              return (
                <Fragment key={rule.id}>
                  <tr className={isEditing ? 'fr-rule-row--editing' : ''}>
                    <td className="fr-pattern-cell">{rule.match_value}</td>
                    <td>{MATCHER_FIELD_LABELS[rule.match_field] ?? rule.match_field}</td>
                    <td>{MATCH_TYPE_LABELS[rule.match_type]   ?? rule.match_type}</td>
                    <td>{getCategoryLabel(categories, rule.category_id)}</td>
                    <td className="fr-date-cell">{fmtDate(rule.created_at)}</td>
                    <td className="fr-actions-cell">
                      <button
                        type="button"
                        className={`fr-edit-btn${isEditing ? ' fr-edit-btn--active' : ''}`}
                        onClick={() => handleEditOpen(rule)}
                        aria-label={isEditing ? 'Close edit panel' : 'Edit rule'}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="fr-rule-panel-row">
                      <td colSpan={6}>
                        <div className="fr-edit-panel">
                          <RuleFormBody form={editForm} onChange={setEditForm} categories={categories} />

                          {editError && <p className="fr-form-error">{editError}</p>}

                          <div className="fr-form-actions">
                            <button type="button" className="btn btn-ghost" onClick={handleEditCancel}>Cancel</button>
                            <button type="button" className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
                              {editSaving ? 'Saving…' : 'Save'}
                            </button>
                          </div>

                          <div className="fr-edit-danger-zone">
                            <div className="fr-reapply-section">
                              {reapplyConfirmId === rule.id ? (
                                <>
                                  <p className="fr-reapply-confirm-msg">
                                    This will categorise all uncategorised matching transactions as{' '}
                                    <strong>{getCategoryLabel(categories, editForm.category_id || rule.category_id)}</strong>.
                                    Existing categorisations will be preserved. Continue?
                                  </p>
                                  <div className="fr-confirm-actions">
                                    <button type="button" className="btn btn-ghost" onClick={() => setReapplyConfirmId(null)}>Cancel</button>
                                    <button type="button" className="btn btn-primary" onClick={() => handleReapplyConfirm(rule)} disabled={reapplyRunning}>Apply</button>
                                  </div>
                                </>
                              ) : reapplyResult?.ruleId === rule.id ? (
                                <p className={`fr-reapply-result${reapplyResult.error ? ' fr-reapply-result--error' : ''}`}>
                                  {reapplyResult.error
                                    ? `Error: ${reapplyResult.error}`
                                    : `Categorised ${reapplyResult.updated} transaction${reapplyResult.updated === 1 ? '' : 's'}.`
                                  }
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => handleReapplyClick(rule.id)}
                                  disabled={reapplyRunning}
                                >
                                  Re-apply to existing transactions
                                </button>
                              )}
                            </div>

                            <div className="fr-delete-section">
                              {deleteConfirmId === rule.id ? (
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  onClick={() => handleDeleteConfirm(rule.id)}
                                >
                                  Confirm delete
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-ghost fr-delete-btn"
                                  onClick={() => handleDeleteClick(rule.id)}
                                >
                                  Delete rule
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
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
  )
}
