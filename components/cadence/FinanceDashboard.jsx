'use client'
import { useState, useEffect } from 'react'
import {
  loadAccounts, loadAllTransactions, loadStatementDocuments,
  loadBills, loadAllBillPayments, loadDismissedPatterns, ensureTodaysSnapshot,
} from '../../lib/finance/db'
import { formatPence } from '../../lib/finance/transactions'
import { deriveBillStatus } from '../../lib/finance/bills'
import { detectRecurringPatterns } from '../../lib/finance/spending'
import {
  computeNetWorth, computeMonthlyBillsTotal, computeThisMonthSpending,
  computeMonthlyCashflow, computeHealthAlerts, computeActionItems,
} from '../../lib/finance/dashboard'

function StatCard({ label, value, sub, negative }) {
  return (
    <div className="fd-stat">
      <span className="fd-stat-label">{label}</span>
      <span className={`fd-stat-value${negative ? ' fd-stat-value--negative' : ''}`}>{value}</span>
      {sub && <span className="fd-stat-sub">{sub}</span>}
    </div>
  )
}

function AlertCard({ item, onViewChange }) {
  return (
    <li className={`fd-card fd-card--${item.severity}`}>
      <div className="fd-card-status">
        {item.severity === 'warning' ? (
          <span className="fd-card-dot fd-card-dot--warning" aria-hidden="true">●</span>
        ) : item.severity === 'action' ? (
          item.count != null && <span className="fd-card-count">{item.count}</span>
        ) : (
          <span className="fd-card-dot fd-card-dot--clear" aria-hidden="true">✓</span>
        )}
      </div>
      <div className="fd-card-body">
        <p className="fd-card-title">{item.title}</p>
        {item.description && <p className="fd-card-description">{item.description}</p>}
      </div>
      {item.action && (
        <button type="button" className="fd-card-action" onClick={() => onViewChange(item.action.view)}>
          {item.action.label}
        </button>
      )}
    </li>
  )
}

export default function FinanceDashboard({ onViewChange }) {
  const [loading,            setLoading           ] = useState(true)
  const [pageError,          setPageError          ] = useState(null)
  const [accounts,           setAccounts           ] = useState([])
  const [transactions,       setTransactions       ] = useState([])
  const [statementDocs,      setStatementDocs      ] = useState([])
  const [bills,              setBills              ] = useState([])
  const [billPayments,       setBillPayments       ] = useState([])
  const [dismissedByAccount, setDismissedByAccount ] = useState({})

  useEffect(() => {
    setLoading(true)
    setPageError(null)
    Promise.all([
      loadAccounts(), loadAllTransactions(), loadStatementDocuments(),
      loadBills(false), loadAllBillPayments(),
    ])
      .then(async ([accs, txs, docs, b, payments]) => {
        const dpResults   = await Promise.all(accs.map(a => loadDismissedPatterns(a.id)))
        const dpByAccount = {}
        accs.forEach((a, i) => { dpByAccount[a.id] = dpResults[i].map(d => d.merchant_clean) })
        setAccounts(accs)
        setTransactions(txs)
        setStatementDocs(docs)
        setBills(b)
        setBillPayments(payments)
        setDismissedByAccount(dpByAccount)
        if (accs.length > 0) {
          const { netWorth } = computeNetWorth(accs, txs, docs)
          ensureTodaysSnapshot(netWorth).catch(e => console.error('snapshot:', e))
        }
      })
      .catch(e => setPageError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)   return <div className="fd-loading">Loading…</div>
  if (pageError) return <div className="fd-error">{pageError}</div>

  const today = new Date().toISOString().split('T')[0]

  const { assets, debt, netWorth } = computeNetWorth(accounts, transactions, statementDocs)
  const monthlyBills               = computeMonthlyBillsTotal(bills)
  const thisMonthSpending          = computeThisMonthSpending(transactions)
  const cashflow                   = computeMonthlyCashflow(transactions)
  const lastMonthNet               = cashflow.length > 0 ? cashflow[cashflow.length - 1].netPence : null

  const billsWithStatus  = bills.map(b => ({ ...b, _status: deriveBillStatus(b, billPayments, today) }))
  const suggestionCounts = accounts.map(acc => {
    const accTxs    = transactions.filter(tx => tx.account_id === acc.id)
    const accBills  = bills.filter(b => b.account_id === acc.id)
    const dismissed = dismissedByAccount[acc.id] ?? []
    return {
      accountId:        acc.id,
      accountName:      acc.name,
      suggestionsCount: detectRecurringPatterns(accTxs, accBills, dismissed).length,
    }
  })

  const healthAlerts = computeHealthAlerts(accounts, transactions, statementDocs, billsWithStatus)
  const actionItems  = computeActionItems(accounts, transactions, statementDocs, suggestionCounts)

  return (
    <div className="fd-page">
      <div className="fd-stat-grid">
        <StatCard
          label="Net worth"
          value={formatPence(netWorth)}
          sub={`${formatPence(assets)} assets · ${formatPence(-debt)} debt`}
          negative={netWorth < 0}
        />
        <StatCard
          label="Spending this month"
          value={thisMonthSpending > 0 ? formatPence(thisMonthSpending) : '—'}
        />
        <StatCard
          label="Monthly bills"
          value={monthlyBills > 0 ? formatPence(monthlyBills) : '—'}
          sub="monthly equivalent"
        />
        <StatCard
          label="Last month cashflow"
          value={lastMonthNet != null ? formatPence(lastMonthNet) : '—'}
          sub={lastMonthNet != null ? lastMonthNet >= 0 ? 'surplus' : 'deficit' : null}
          negative={lastMonthNet != null && lastMonthNet < 0}
        />
      </div>

      <section className="fd-section">
        <h2 className="fd-section-title">Health</h2>
        <ul className="fd-cards">
          {healthAlerts.map(alert => (
            <AlertCard key={alert.id} item={alert} onViewChange={onViewChange} />
          ))}
        </ul>
      </section>

      <section className="fd-section">
        <h2 className="fd-section-title">Actions</h2>
        <ul className="fd-cards">
          {actionItems.map(item => (
            <AlertCard key={item.id} item={item} onViewChange={onViewChange} />
          ))}
        </ul>
      </section>

      <div className="fd-section fd-section--placeholder">
        <p className="fd-section-title">Net worth over time</p>
        <p className="fd-placeholder">Trend chart and cashflow breakdown — coming in c3.</p>
      </div>
    </div>
  )
}
