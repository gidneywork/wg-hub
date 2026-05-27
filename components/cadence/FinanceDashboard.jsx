'use client'
import { useState, useEffect } from 'react'
import {
  loadAccounts,
  loadAllTransactions,
  loadStatementDocuments,
  loadBills,
  ensureTodaysSnapshot,
} from '../../lib/finance/db'
import { formatPence } from '../../lib/finance/transactions'
import {
  computeNetWorth,
  computeMonthlyBillsTotal,
  computeThisMonthSpending,
  computeMonthlyCashflow,
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

export default function FinanceDashboard({ onViewChange }) {
  const [loading,  setLoading ] = useState(true)
  const [error,    setError   ] = useState(null)
  const [stats,    setStats   ] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      loadAccounts(),
      loadAllTransactions(),
      loadStatementDocuments(),
      loadBills(false),
    ])
      .then(([accounts, txs, docs, bills]) => {
        const { assets, debt, netWorth } = computeNetWorth(accounts, txs, docs)
        const monthlyBills               = computeMonthlyBillsTotal(bills)
        const thisMonthSpending          = computeThisMonthSpending(txs)
        const cashflow                   = computeMonthlyCashflow(txs)
        const lastMonthNet               = cashflow.length > 0
          ? cashflow[cashflow.length - 1].netPence
          : null

        setStats({ assets, debt, netWorth, monthlyBills, thisMonthSpending, lastMonthNet })

        if (accounts.length > 0) {
          ensureTodaysSnapshot(netWorth).catch(e => console.error('snapshot:', e))
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="fd-loading">Loading…</div>
  if (error)   return <div className="fd-error">{error}</div>

  const {
    assets, debt, netWorth,
    monthlyBills, thisMonthSpending, lastMonthNet,
  } = stats

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
          value={thisMonthSpending > 0 ? formatPence(-thisMonthSpending) : '—'}
          negative={thisMonthSpending > 0}
        />
        <StatCard
          label="Monthly bills"
          value={monthlyBills > 0 ? formatPence(-monthlyBills) : '—'}
          sub="monthly equivalent"
          negative={monthlyBills > 0}
        />
        <StatCard
          label="Last month cashflow"
          value={lastMonthNet != null ? formatPence(lastMonthNet) : '—'}
          sub={lastMonthNet != null
            ? lastMonthNet >= 0 ? 'surplus' : 'deficit'
            : null}
          negative={lastMonthNet != null && lastMonthNet < 0}
        />
      </div>

      <div className="fd-section fd-section--placeholder">
        <p className="fd-section-title">Health &amp; actions</p>
        <p className="fd-placeholder">Upcoming bills, overdue alerts, and suggested actions — coming in c2.</p>
      </div>

      <div className="fd-section fd-section--placeholder">
        <p className="fd-section-title">Net worth over time</p>
        <p className="fd-placeholder">Trend chart and cashflow breakdown — coming in c3.</p>
      </div>
    </div>
  )
}
