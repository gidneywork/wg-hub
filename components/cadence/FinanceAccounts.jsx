'use client'
import { useState, useEffect } from 'react'
import {
  loadAccounts,
  loadCategories,
  loadCategoryRules,
  loadStatementDocuments,
  loadTransactions,
} from '../../lib/finance/db'
import { getBankLabel, ACCOUNT_TYPE_LABELS } from '../../lib/finance/accounts'
import { formatPence } from '../../lib/finance/transactions'

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

export default function FinanceAccounts() {
  const [accounts,      setAccounts     ] = useState([])
  const [categories,    setCategories   ] = useState([])
  const [rules,         setRules        ] = useState([])
  const [statementDocs, setStatementDocs] = useState([])
  const [txCache,       setTxCache      ] = useState({})  // { [accountId]: { txs, balance } }
  const [expanded,      setExpanded     ] = useState(null)
  const [txLoadingFor,  setTxLoadingFor ] = useState(null)
  const [loading,       setLoading      ] = useState(true)

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

  if (loading) return <div className="fa-loading">Loading…</div>

  return (
    <div className="fa-page">
      <div className="fa-header">
        <h2 className="fa-title">Accounts</h2>
      </div>

      {accounts.length === 0 ? (
        <p className="fa-empty">No accounts yet.</p>
      ) : (
        <ul className="fa-list">
          {accounts.map(account => {
            const isExpanded = expanded === account.id
            const cached     = txCache[account.id]
            const balance    = cached != null ? formatPence(cached.balance) : '—'

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
                    <span className="fa-account-balance">{balance}</span>
                  </div>
                  <svg className={`fa-chevron${isExpanded ? ' fa-chevron--open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {isExpanded && (
                  <div className="fa-account-body">
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
                          </tr>
                        </thead>
                        <tbody>
                          {cached.txs.slice(0, 50).map(tx => {
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
        <h3 className="fa-docs-title">Statements</h3>
        {statementDocs.length === 0 ? (
          <p className="fa-docs-empty">No statements uploaded yet.</p>
        ) : (
          <ul className="fa-docs-list">
            {statementDocs.map(doc => {
              const account = accounts.find(a => a.id === doc.account_id)
              return (
                <li key={doc.id} className="fa-doc-row">
                  <span className="fa-doc-date">{fmtUploadDate(doc.uploaded_at)}</span>
                  <span className="fa-doc-filename">{doc.file_name}</span>
                  <span className="fa-doc-account">{account?.name ?? '—'}</span>
                  <span className={`fa-doc-status fa-doc-status--${doc.status}`}>
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
