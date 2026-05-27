'use client'
import FinanceBills from './FinanceBills'

export default function AccountSummaryBills({ accountId, pendingBillPreFill, onPreFillConsumed }) {
  return (
    <FinanceBills
      accountId={accountId}
      pendingPreFill={pendingBillPreFill}
      onPreFillConsumed={onPreFillConsumed}
    />
  )
}
