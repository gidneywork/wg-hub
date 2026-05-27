'use client'

import { useState, useEffect } from 'react'
import { loadBills, loadAllBillPayments } from '../../lib/finance/db'
import { deriveBillStatus, BILL_TYPE_LABELS, FREQUENCY_LABELS, STATUS_LABELS } from '../../lib/finance/bills'

function formatAmount(pence) {
  return `£${(pence / 100).toFixed(2)}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function FinanceBills() {
  const [bills, setBills]             = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  useEffect(() => {
    Promise.all([loadBills(), loadAllBillPayments()])
      .then(([b, p]) => { setBills(b); setAllPayments(p) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="fb-page">
      <div className="fb-header"><h2 className="fb-title">Bills</h2></div>
      <p className="fb-loading">Loading…</p>
    </div>
  )

  if (error) return (
    <div className="fb-page">
      <div className="fb-header"><h2 className="fb-title">Bills</h2></div>
      <p className="fb-empty">{error}</p>
    </div>
  )

  const today = todayISO()

  const billsWithStatus = bills.map(bill => ({
    ...bill,
    _status: deriveBillStatus(bill, allPayments, today),
  }))

  const overdue  = billsWithStatus.filter(b => b._status === 'overdue')
  const dueSoon  = billsWithStatus.filter(b => b._status === 'due_soon')

  return (
    <div className="fb-page">
      <div className="fb-header">
        <h2 className="fb-title">Bills</h2>
        <button type="button" className="fb-add-btn" disabled>Add bill</button>
      </div>

      {overdue.length > 0 && (
        <div className="fb-section">
          <p className="fb-section-title">Overdue</p>
          <ul className="fb-bill-list">
            {overdue.map(bill => (
              <li key={bill.id} className="fb-bill-row">
                <span className="fb-bill-name">{bill.name}</span>
                <span className="fb-bill-type">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</span>
                <span className="fb-bill-amount">{formatAmount(bill.expected_amount_pence)}</span>
                <span className="fb-bill-date">Due {bill.next_due_date}</span>
                <span className="fb-status-badge fb-status-badge--overdue">Overdue</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dueSoon.length > 0 && (
        <div className="fb-section">
          <p className="fb-section-title">Due soon</p>
          <ul className="fb-bill-list">
            {dueSoon.map(bill => (
              <li key={bill.id} className="fb-bill-row">
                <span className="fb-bill-name">{bill.name}</span>
                <span className="fb-bill-type">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</span>
                <span className="fb-bill-amount">{formatAmount(bill.expected_amount_pence)}</span>
                <span className="fb-bill-date">Due {bill.next_due_date}</span>
                <span className="fb-status-badge fb-status-badge--due_soon">Due soon</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="fb-section">
        <p className="fb-section-title">All bills</p>
        {billsWithStatus.length === 0 ? (
          <p className="fb-section-empty">No bills added yet.</p>
        ) : (
          <table className="fb-bill-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Frequency</th>
                <th className="fb-bill-amount-col">Amount</th>
                <th>Next due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {billsWithStatus.map(bill => (
                <tr key={bill.id}>
                  <td className="fb-bill-name">{bill.name}</td>
                  <td className="fb-bill-type">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</td>
                  <td>{FREQUENCY_LABELS[bill.frequency] ?? bill.frequency}</td>
                  <td className="fb-bill-amount">{formatAmount(bill.expected_amount_pence)}</td>
                  <td className="fb-bill-date">{bill.next_due_date}</td>
                  <td>
                    <span className={`fb-status-badge fb-status-badge--${bill._status}`}>
                      {STATUS_LABELS[bill._status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
