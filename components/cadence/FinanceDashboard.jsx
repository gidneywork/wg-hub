'use client'
import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  loadAccounts, loadAllTransactions, loadStatementDocuments,
  loadBills, loadAllBillPayments, loadDismissedPatterns, ensureTodaysSnapshot,
  loadCategories, loadNetWorthSnapshots, loadProperties, loadDebts, loadIncome,
} from '../../lib/finance/db'
import { formatPence } from '../../lib/finance/transactions'
import { deriveBillStatus } from '../../lib/finance/bills'
import {
  detectRecurringPatterns, CHART_PALETTE,
  getTimeRangeBounds, toYMD, bucketByMonthAndCategory,
  penceToShort, penceToShortSigned, fmtMonthShort, fmtDateShort,
} from '../../lib/finance/spending'
import {
  computeNetWorth, computeMonthlyBillsTotal, computeThisMonthSpending,
  computeMonthlyCashflow, computeHealthAlerts, computeActionItems,
} from '../../lib/finance/dashboard'
import { monthlyIncomeTotal } from '../../lib/finance/income'

// Chart constants — hex values because CSS vars don't resolve in SVG fill attributes.
// Light-theme values; dark chart theming is future work (matches c5 precedent).
const HEX = {
  grid:   '#DCD7CB', // --chart-grid (light)
  cursor: '#EDE9E0', // --bg-elevated (light)
}
const CHART_MARGIN    = { top: 4, right: 8, left: 8, bottom: 0 }
const mono11          = { fontFamily: 'var(--mono)', fontSize: 11, fill: '#8A867D' } // --text-quiet
const INCOME_COLOUR   = '#6B7A5A' // CHART_PALETTE[0] — moss
const SPENDING_COLOUR = '#C9A24E' // CHART_PALETTE[3] — sand

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, negative }) {
  return (
    <div className="fd-stat">
      <span className="fd-stat-label">{label}</span>
      <span className={`fd-stat-value${negative ? ' fd-stat-value--negative' : ''}`}>{value}</span>
      {sub && <span className="fd-stat-sub">{sub}</span>}
    </div>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────────

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

// ── Chart tooltips ────────────────────────────────────────────────────────────

const TT_STYLE = {
  background: 'var(--bg-paper)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '10px 14px',
  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
}

function StackedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, e) => sum + (e.value ?? 0), 0)
  return (
    <div style={{ ...TT_STYLE, minWidth: 190 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>{fmtMonthShort(label)}</div>
      {[...payload].reverse().map(e => (
        <div key={e.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
          <span style={{ color: e.fill }}>■ {e.dataKey}</span>
          <span>{formatPence(-e.value)}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 24, fontWeight: 600 }}>
        <span>Total</span>
        <span>{formatPence(-total)}</span>
      </div>
    </div>
  )
}

function NetWorthTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { date, netWorth } = payload[0].payload
  return (
    <div style={{ ...TT_STYLE, minWidth: 160 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>{date}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
        <span>Net worth</span>
        <span style={{ color: netWorth < 0 ? '#A3493D' : '#4F5A42' }}>{formatPence(netWorth)}</span>
      </div>
    </div>
  )
}

function CashflowTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const income   = payload.find(p => p.dataKey === 'incomePence')?.value   ?? 0
  const spending = payload.find(p => p.dataKey === 'spendingPence')?.value ?? 0
  const net      = income - spending
  return (
    <div style={{ ...TT_STYLE, minWidth: 190 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>{fmtMonthShort(label)}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
        <span style={{ color: INCOME_COLOUR }}>■ Income</span>
        <span>{formatPence(income)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
        <span style={{ color: SPENDING_COLOUR }}>■ Spending</span>
        <span>{formatPence(spending)}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 24, fontWeight: 600 }}>
        <span>Net</span>
        <span style={{ color: net < 0 ? '#A3493D' : '#4F5A42' }}>{formatPence(net)}</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FinanceDashboard({ onViewChange }) {
  const [loading,            setLoading           ] = useState(true)
  const [pageError,          setPageError          ] = useState(null)
  const [accounts,           setAccounts           ] = useState([])
  const [transactions,       setTransactions       ] = useState([])
  const [statementDocs,      setStatementDocs      ] = useState([])
  const [bills,              setBills              ] = useState([])
  const [billPayments,       setBillPayments       ] = useState([])
  const [dismissedByAccount, setDismissedByAccount ] = useState({})
  const [categories,         setCategories         ] = useState([])
  const [snapshots,          setSnapshots          ] = useState([])
  const [properties,         setProperties         ] = useState([])
  const [debtRows,           setDebtRows           ] = useState([])
  const [incomeRows,         setIncomeRows         ] = useState([])

  useEffect(() => {
    setLoading(true)
    setPageError(null)
    Promise.all([
      loadAccounts(), loadAllTransactions(), loadStatementDocuments(),
      loadBills(false), loadAllBillPayments(),
      loadCategories(), loadNetWorthSnapshots(),
      loadProperties(), loadDebts(), loadIncome(),
    ])
      .then(async ([accs, txs, docs, b, payments, cats, snaps, props, debts, inc]) => {
        const dpResults   = await Promise.all(accs.map(a => loadDismissedPatterns(a.id)))
        const dpByAccount = {}
        accs.forEach((a, i) => { dpByAccount[a.id] = dpResults[i].map(d => d.merchant_clean) })
        setAccounts(accs)
        setTransactions(txs)
        setStatementDocs(docs)
        setBills(b)
        setBillPayments(payments)
        setDismissedByAccount(dpByAccount)
        setCategories(cats)
        setSnapshots(snaps)
        setProperties(props)
        setDebtRows(debts)
        setIncomeRows(inc)
        if (accs.length > 0) {
          const { netWorth } = computeNetWorth(accs, txs, docs, props, debts)
          ensureTodaysSnapshot(netWorth).catch(e => console.error('snapshot:', e))
        }
      })
      .catch(e => setPageError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading)   return <div className="fd-loading">Loading…</div>
  if (pageError) return <div className="fd-error">{pageError}</div>

  const today = new Date().toISOString().split('T')[0]

  const { assets, debt, netWorth } = computeNetWorth(accounts, transactions, statementDocs, properties, debtRows)
  const monthlyBills               = computeMonthlyBillsTotal(bills)
  const monthlyIncome              = monthlyIncomeTotal(incomeRows)
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

  // Analytics datasets
  const { from: catFrom } = getTimeRangeBounds('6m')
  const catFromStr        = toYMD(catFrom)
  const spendingTxs       = transactions.filter(tx =>
    Number(tx.amount_pence) < 0 && tx.tx_date >= catFromStr && tx.tx_date <= today
  )
  const { data: categoryData, cats: topCats } = bucketByMonthAndCategory(spendingTxs, categories)

  const netWorthData = [...snapshots].reverse().map(s => ({
    date:     s.taken_at.split('T')[0],
    netWorth: Number(s.net_worth_pence),
  }))

  // properties loaded ascending by created_at; snapshots loaded descending by taken_at
  const earliestPropertyDate = properties.length > 0 ? properties[0].created_at : null
  const oldestSnapshotDate   = snapshots.length   > 0 ? snapshots[snapshots.length - 1].taken_at : null
  const showContinuityCaveat = (
    earliestPropertyDate !== null &&
    oldestSnapshotDate   !== null &&
    oldestSnapshotDate < earliestPropertyDate &&
    netWorthData.length >= 2
  )

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
        <StatCard
          label="Monthly income"
          value={monthlyIncome > 0 ? formatPence(monthlyIncome) : '—'}
          sub="recurring only"
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

      <section className="fd-section">
        <h2 className="fd-section-title">Analytics</h2>

        <div className="fd-chart-block">
          <p className="fd-chart-title">Spending by category — last 6 months</p>
          <div className="fd-chart-container">
            {categoryData.length === 0
              ? <p className="fd-chart-empty">No spending data in the last 6 months.</p>
              : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={categoryData} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke={HEX.grid} vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtMonthShort} tick={mono11} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={penceToShort} tick={mono11} axisLine={false} tickLine={false} width={52} />
                    <Tooltip content={<StackedTooltip />} cursor={{ fill: HEX.cursor }} />
                    <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }} />
                    {topCats.map((cat, idx) => (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        stackId="spend"
                        fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                        radius={idx === topCats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

        <div className="fd-chart-block">
          <p className="fd-chart-title">Net worth over time</p>
          <div className="fd-chart-container">
            {netWorthData.length < 2
              ? <p className="fd-chart-empty">Net worth history will appear here as you use Cadence over time. Check back after a few days.</p>
              : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={netWorthData} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke={HEX.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={mono11} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={penceToShortSigned} tick={mono11} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<NetWorthTooltip />} />
                    <Line type="monotone" dataKey="netWorth" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )
            }
          </div>
          {showContinuityCaveat && (
            <p className="fd-chart-note">Property equity now included in net worth. Earlier snapshots reflect account balances only.</p>
          )}
        </div>

        <div className="fd-chart-block">
          <p className="fd-chart-title">Cashflow — last 6 months</p>
          <div className="fd-chart-container">
            {cashflow.length === 0
              ? <p className="fd-chart-empty">No transaction data yet.</p>
              : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={cashflow} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke={HEX.grid} vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtMonthShort} tick={mono11} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={penceToShort} tick={mono11} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CashflowTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }} />
                    <Bar dataKey="incomePence"   name="Income"   fill={INCOME_COLOUR}   radius={[3, 3, 0, 0]} />
                    <Bar dataKey="spendingPence" name="Spending" fill={SPENDING_COLOUR} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>
        </div>

      </section>
    </div>
  )
}
