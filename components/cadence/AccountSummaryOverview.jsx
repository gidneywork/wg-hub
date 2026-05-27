'use client'

import {
  getMostRecentImportedStatement,
  computeAccountBalance,
  computeAvailableToSpend,
} from '../../lib/finance/accounts'
import { formatPence } from '../../lib/finance/transactions'

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getLast30DaysStats(transactions) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = transactions.filter(tx => new Date(tx.tx_date + 'T00:00:00').getTime() >= cutoff)
  let income = 0, spending = 0
  for (const tx of recent) {
    if (tx.amount_pence > 0) income   += tx.amount_pence
    else                     spending += Math.abs(tx.amount_pence)
  }
  return { income, spending, netChange: income - spending, txCount: recent.length }
}

function CreditCardOverview({ account, statementDocs }) {
  const stmt = getMostRecentImportedStatement(statementDocs, account.id)

  if (!stmt) {
    return (
      <div className="fas-tab-empty">
        No statement uploaded yet. Upload one to see this account's overview.
      </div>
    )
  }

  const debt        = stmt.closing_balance_pence
  const limit       = stmt.credit_limit_pence
  const available   = computeAvailableToSpend(account, statementDocs)
  const utilisation = (limit != null && limit > 0 && debt != null)
    ? (Math.abs(Number(debt)) / Number(limit)) * 100
    : null

  return (
    <div className="fas-overview-grid">
      <div className="fas-stat">
        <span className="fas-stat-label">Owed</span>
        <span className="fas-stat-value fas-stat-value--negative">
          {formatPence(-Math.abs(Number(debt)))}
        </span>
      </div>
      {limit != null && (
        <div className="fas-stat">
          <span className="fas-stat-label">Limit</span>
          <span className="fas-stat-value">{formatPence(Number(limit))}</span>
        </div>
      )}
      {available != null && (
        <div className="fas-stat">
          <span className="fas-stat-label">Available</span>
          <span className={`fas-stat-value${available < 0 ? ' fas-stat-value--negative' : ''}`}>
            {formatPence(available)}
          </span>
        </div>
      )}
      {utilisation != null && (
        <div className="fas-stat">
          <span className="fas-stat-label">Utilisation</span>
          <span className={`fas-stat-value${utilisation > 80 ? ' fas-stat-value--warning' : ''}`}>
            {utilisation.toFixed(1)}%
          </span>
        </div>
      )}
      {stmt.minimum_payment_pence != null && (
        <div className="fas-stat">
          <span className="fas-stat-label">Min payment</span>
          <span className="fas-stat-value">{formatPence(stmt.minimum_payment_pence)}</span>
        </div>
      )}
      {stmt.payment_due_date && (
        <div className="fas-stat">
          <span className="fas-stat-label">Due</span>
          <span className="fas-stat-value">{fmtDate(stmt.payment_due_date)}</span>
        </div>
      )}
    </div>
  )
}

function CurrentAccountOverview({ account, transactions, statementDocs }) {
  const balance = computeAccountBalance(account, transactions, statementDocs)
  const stats   = getLast30DaysStats(transactions)

  if (transactions.length === 0) {
    return (
      <div className="fas-tab-empty">
        No transactions yet. Upload a statement to see activity on this account.
      </div>
    )
  }

  return (
    <div className="fas-overview-grid">
      <div className="fas-stat">
        <span className="fas-stat-label">Balance</span>
        <span className={`fas-stat-value${balance != null && balance < 0 ? ' fas-stat-value--negative' : ''}`}>
          {balance != null ? formatPence(balance) : '—'}
        </span>
      </div>
      <div className="fas-stat">
        <span className="fas-stat-label">Income (30d)</span>
        <span className="fas-stat-value">{formatPence(stats.income)}</span>
      </div>
      <div className="fas-stat">
        <span className="fas-stat-label">Spending (30d)</span>
        <span className="fas-stat-value">{formatPence(-stats.spending)}</span>
      </div>
      <div className="fas-stat">
        <span className="fas-stat-label">Net change (30d)</span>
        <span className={`fas-stat-value${stats.netChange < 0 ? ' fas-stat-value--negative' : ''}`}>
          {formatPence(stats.netChange)}
        </span>
      </div>
    </div>
  )
}

function SavingsOverview({ account, transactions, statementDocs }) {
  const balance = computeAccountBalance(account, transactions, statementDocs)

  if (transactions.length === 0) {
    return (
      <div className="fas-tab-empty">
        No transactions yet. Upload a statement to see activity on this account.
      </div>
    )
  }

  return (
    <div className="fas-overview-grid">
      <div className="fas-stat">
        <span className="fas-stat-label">Balance</span>
        <span className={`fas-stat-value${balance < 0 ? ' fas-stat-value--negative' : ''}`}>
          {formatPence(balance)}
        </span>
      </div>
    </div>
  )
}

export default function AccountSummaryOverview({ account, transactions, statementDocs }) {
  if (account.account_type === 'credit_card') {
    return <CreditCardOverview account={account} statementDocs={statementDocs} />
  }
  if (account.account_type === 'current') {
    return <CurrentAccountOverview account={account} transactions={transactions} statementDocs={statementDocs} />
  }
  return <SavingsOverview account={account} transactions={transactions} statementDocs={statementDocs} />
}
