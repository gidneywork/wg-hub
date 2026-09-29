'use client'

import { useCallback, useEffect, useState } from 'react'
import { db } from '../../lib/db'
import { apiFetch } from '../../lib/api'
import { syncStatus } from '../../lib/cronometer-shared'

/**
 * Cronometer refresh (FC-084). A manual sync through the signed-in path
 * (POST /api/cronometer/sync), shared by the Daily Data Nutrition header, the
 * Dashboard Fuel card and the Settings card. New numbers arrive through the
 * existing realtime subscription; this only reloads its own status.
 *
 * Not used on TV Mode, which is read-only.
 */
// One manual sync request. Returns a transient notice for the control, or
// null when the outcome is best read from the reloaded status (success, or a
// failure the route has recorded as last_error).
export async function requestRefresh(fetcher = apiFetch) {
  try {
    const res = await fetcher('/api/cronometer/sync', { method: 'POST' })
    if (res.status === 429) return 'No refreshes left today'
    return null
  } catch {
    return 'Cronometer unavailable'
  }
}

export function useCronometerSync() {
  const [conn, setConn] = useState(undefined) // undefined = loading
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)  // transient message from the last click

  const reload = useCallback(async () => setConn(await db.loadCronometerConnection()), [])
  useEffect(() => { reload() }, [reload])

  const refresh = useCallback(async () => {
    setBusy(true)
    setNotice(null)
    const n = await requestRefresh()
    setNotice(n)
    setBusy(false)
    await reload()
  }, [reload])

  const status = syncStatus(conn || null)
  return { conn, status, busy, notice, refresh, loading: conn === undefined }
}

export default function CronometerRefresh({ className = '' }) {
  const { status, busy, notice, refresh, loading } = useCronometerSync()
  if (loading) return null
  const failing = status.error && !busy
  return (
    <span className={`cronometer-refresh${className ? ` ${className}` : ''}`}>
      {failing
        ? <span className="error">{status.error}</span>
        : <span className="status">{notice || status.line}</span>}
      <button type="button" onClick={refresh} disabled={busy || status.spent}>
        {busy ? 'Refreshing…' : 'Refresh from Cronometer'}
      </button>
    </span>
  )
}
