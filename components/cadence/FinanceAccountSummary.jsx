'use client'

import { useState, useEffect } from 'react'
import {
  loadAccount,
  loadTransactions,
  loadStatementDocuments,
} from '../../lib/finance/db'
import {
  getBankLabel,
  ACCOUNT_TYPE_LABELS,
  getMostRecentImportedStatement,
  computeAccountBalance,
} from '../../lib/finance/accounts'
import { formatPence } from '../../lib/finance/transactions'
import CadenceTabs from './CadenceTabs'
import AccountSummaryOverview from './AccountSummaryOverview'
import AccountSummaryTransactions from './AccountSummaryTransactions'
import AccountSummaryBills from './AccountSummaryBills'
import AccountSummarySpending from './AccountSummarySpending'

const TABS = [
  { key: 'overview',     label: 'Overview' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'bills',        label: 'Bills' },
  { key: 'spending',     label: 'Spending' },
]

function fmtDate(iso) {
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function FinanceAccountSummary({ accountId, activeTab, onViewChange }) {
  const [account,            setAccount           ] = useState(null)
  const [transactions,       setTransactions      ] = useState([])
  const [statementDocs,      setStatementDocs     ] = useState([])
  const [loading,            setLoading           ] = useState(true)
  const [pageError,          setPageError         ] = useState(null)
  const [pendingBillPreFill, setPendingBillPreFill] = useState(null)

  useEffect(() => {
    setLoading(true)
    setPageError(null)
    Promise.all([
      loadAccount(accountId),
      loadTransactions(accountId),
      loadStatementDocuments(accountId),
    ])
      .then(([a, t, s]) => {
        setAccount(a)
        setTransactions(t)
        setStatementDocs(s)
      })
      .catch(e => setPageError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  function handleTabChange(newTab) {
    onViewChange(`finance-account:${accountId}:${newTab}`)
  }

  if (loading)   return <div className="fas-loading">Loading account…</div>
  if (pageError) return <div className="fas-error">{pageError}</div>
  if (!account)  return <div className="fas-error">Account not found.</div>

  const ccStmt       = getMostRecentImportedStatement(statementDocs, accountId)
  const balance      = computeAccountBalance(account, transactions, statementDocs)
  const lastStmtDate = ccStmt?.period_to || ccStmt?.uploaded_at
  const isNegative   = balance != null && balance < 0

  return (
    <div className="fas-page">
      <header className="fas-hero">
        <div className="fas-hero-meta">
          <span className="fas-hero-pill">{getBankLabel(account)}</span>
          <span className="fas-hero-pill">{ACCOUNT_TYPE_LABELS[account.account_type]}</span>
          {lastStmtDate && (
            <span className="fas-hero-pill">Last statement {fmtDate(lastStmtDate)}</span>
          )}
        </div>
        <h1 className="fas-hero-name">{account.name}</h1>
        <div className={`fas-hero-balance${isNegative ? ' fas-hero-balance--negative' : ''}`}>
          {balance != null ? formatPence(balance) : '—'}
        </div>
      </header>

      <CadenceTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="fas-tab-content">
        {activeTab === 'overview' && (
          <AccountSummaryOverview
            account={account}
            transactions={transactions}
            statementDocs={statementDocs}
          />
        )}
        {activeTab === 'transactions' && (
          <AccountSummaryTransactions accountId={accountId} />
        )}
        {activeTab === 'bills' && (
          <AccountSummaryBills
            accountId={accountId}
            pendingBillPreFill={pendingBillPreFill}
            onPreFillConsumed={() => setPendingBillPreFill(null)}
          />
        )}
        {activeTab === 'spending' && (
          <AccountSummarySpending
            accountId={accountId}
            onSuggestAsBill={(preFill) => {
              setPendingBillPreFill(preFill)
              onViewChange(`finance-account:${accountId}:bills`)
            }}
          />
        )}
      </div>
    </div>
  )
}
