'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { loadTransactions, loadCategories } from '../../lib/finance/db'
import { formatPence } from '../../lib/finance/transactions'
import {
  toYMD, getTimeRangeBounds,
  bucketByMonthAndCategory, aggregateByCategory, aggregateMerchants,
  penceToShort, fmtMonthShort,
} from '../../lib/finance/spending'

// Mirrors cadence-tokens.css --d1 through --d7 (light theme values).
// Must be kept in sync if tokens change. Cannot use CSS variables in SVG fill attributes.
const CHART_PALETTE = [
  '#6B7A5A', // d1 — moss
  '#B96A4D', // d2 — clay
  '#4A5F6E', // d3 — slate
  '#C9A24E', // d4 — sand
  '#8A7396', // d5 — mauve
  '#5F5C55', // d6 — stone
  '#A3493D', // d7 — brick
  '#B8B3A7', // neutral — Other bucket
]

const TIME_RANGES = [
  { value: '30d', label: 'Last 30 days' },
  { value: '3m',  label: '3 months'    },
  { value: '6m',  label: '6 months'    },
  { value: 'ytd', label: 'This year'   },
  { value: 'all', label: 'All time'    },
]

const CHART_MARGIN = { top: 4, right: 8, left: 8, bottom: 0 }

// Hex values for SVG props — CSS custom properties don't resolve in SVG attributes.
// Light-theme values; dark mode chart colours are future work.
const HEX = {
  grid:      '#DCD7CB', // --chart-grid
  tickQuiet: '#8A867D', // --text-quiet
  tickMuted: '#5F5C55', // --text-muted
  cursor:    '#EDE9E0', // --bg-elevated
  clayDeep:  '#A3493D', // --clay-deep
}

// ── Tooltip components ─────────────────────────────────────────────────────────

function StackedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)
  const TT = {
    background: 'var(--bg-paper)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '10px 14px', minWidth: 190,
    fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
  }
  return (
    <div style={TT}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
        {fmtMonthShort(label)}
      </div>
      {[...payload].reverse().map(entry => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
          <span style={{ color: entry.fill }}>■ {entry.dataKey}</span>
          <span>{formatPence(-entry.value)}</span>
        </div>
      ))}
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6,
        display: 'flex', justifyContent: 'space-between', gap: 24, fontWeight: 600,
      }}>
        <span>Total</span>
        <span>{formatPence(-total)}</span>
      </div>
    </div>
  )
}

function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, amount } = payload[0].payload
  return (
    <div style={{
      background: 'var(--bg-paper)', border: '1px solid var(--border)',
      borderRadius: 4, padding: '8px 12px',
      fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    }}>
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div style={{ color: HEX.clayDeep, marginTop: 2 }}>{formatPence(-amount)}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AccountSummarySpending({ accountId }) {
  const [transactions, setTransactions] = useState([])
  const [categories,   setCategories]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [pageError,    setPageError]    = useState(null)
  const [timeRange,    setTimeRange]    = useState('3m')

  useEffect(() => {
    setLoading(true)
    setPageError(null)
    Promise.all([loadTransactions(accountId), loadCategories()])
      .then(([txs, cats]) => { setTransactions(txs); setCategories(cats) })
      .catch(e => setPageError(e.message))
      .finally(() => setLoading(false))
  }, [accountId])

  const { from, to } = useMemo(() => getTimeRangeBounds(timeRange), [timeRange])
  const fromStr = from ? toYMD(from) : null
  const toStr   = toYMD(to)

  const spendingTxs = useMemo(() =>
    transactions.filter(tx => {
      if (Number(tx.amount_pence) >= 0) return false
      if (fromStr && tx.tx_date < fromStr) return false
      if (tx.tx_date > toStr) return false
      return true
    }),
  [transactions, fromStr, toStr])

  // Period-relative colour mapping: categories rank by spend in current period.
  // Same category may get a different colour when time range changes — acceptable for v1.
  const { data: monthlyData, cats: topCats } = useMemo(
    () => bucketByMonthAndCategory(spendingTxs, categories),
    [spendingTxs, categories]
  )
  const categoryTotals = useMemo(
    () => aggregateByCategory(spendingTxs, categories),
    [spendingTxs, categories]
  )
  const topMerchants = useMemo(
    () => aggregateMerchants(spendingTxs),
    [spendingTxs]
  )

  if (loading)   return <div className="ass-loading">Loading…</div>
  if (pageError) return <div className="ass-error">{pageError}</div>

  const hasAnyTxs   = transactions.length > 0
  const hasSpending = spendingTxs.length  > 0

  const timeSelector = (
    <div className="ass-time-range">
      {TIME_RANGES.map(r => (
        <button
          key={r.value}
          type="button"
          className={`ass-time-range-btn${timeRange === r.value ? ' ass-time-range-btn--active' : ''}`}
          onClick={() => setTimeRange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )

  if (!hasAnyTxs) return (
    <div className="ass-page">
      <p className="ass-empty">No transactions yet. Upload a statement to see spending breakdown.</p>
    </div>
  )

  if (!hasSpending) return (
    <div className="ass-page">
      {timeSelector}
      <p className="ass-empty">No spending in this time range. Try a longer period.</p>
    </div>
  )

  const horizBarHeight = Math.max(categoryTotals.length * 36 + 60, 80)
  const tickQ = { fontFamily: 'var(--mono)', fontSize: 11, fill: HEX.tickQuiet }
  const tickM = { fontFamily: 'var(--sans)', fontSize: 12, fill: HEX.tickMuted }

  return (
    <div className="ass-page">
      {timeSelector}

      {/* Stacked bar — spending by category over months */}
      <div className="ass-section">
        <p className="ass-section-title">Spending by category over time</p>
        <div className="ass-chart-container">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={HEX.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonthShort}
                tick={tickQ}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={penceToShort}
                tick={tickQ}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<StackedTooltip />} cursor={{ fill: HEX.cursor }} />
              <Legend
                wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}
              />
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
        </div>
      </div>

      {/* Horizontal bar — spending by category (period totals) */}
      <div className="ass-section">
        <p className="ass-section-title">Spending by category</p>
        <div className="ass-chart-container">
          <ResponsiveContainer width="100%" height={horizBarHeight}>
            <BarChart data={categoryTotals} layout="vertical" margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={HEX.grid} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={penceToShort}
                tick={tickQ}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={tickM}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CategoryTooltip />} cursor={{ fill: HEX.cursor }} />
              <Bar dataKey="amount" fill={CHART_PALETTE[0]} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top merchants table */}
      {topMerchants.length > 0 && (
        <div className="ass-section">
          <p className="ass-section-title">Top {topMerchants.length} merchants</p>
          <table className="ass-merchants-table">
            <thead>
              <tr>
                <th className="ass-merchants-rank">#</th>
                <th>Merchant</th>
                <th className="ass-merchants-tx-count">Transactions</th>
                <th className="ass-merchants-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {topMerchants.map(m => (
                <tr key={m.rank}>
                  <td className="ass-merchants-rank">{m.rank}</td>
                  <td className="ass-merchants-name">{m.merchant}</td>
                  <td className="ass-merchants-tx-count">{m.txCount}</td>
                  <td className="ass-merchants-total">{formatPence(-m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
