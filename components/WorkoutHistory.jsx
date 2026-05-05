'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/db'

// ── Strava type → display label + colour
const SESSION_TYPES = [
  { key: 'run',        label: 'Running',             color: '#00e676' },
  { key: 'functional', label: 'Functional Training', color: '#ff9f40' },
  { key: 'gym',        label: 'Gym',                 color: '#b388ff' },
  { key: 'yoga',       label: 'Yoga',                color: '#40a9ff' },
  { key: 'rest',       label: 'Rest Day',            color: '#ff6b6b' },
  { key: 'swim',       label: 'Swimming',            color: '#64b5f6' },
  { key: 'cycle',      label: 'Cycling',             color: '#ffd666' },
  { key: 'hike',       label: 'Hiking',              color: '#a5d6a7' },
  { key: 'stretch',    label: 'Stretching',          color: '#80deea' },
  { key: 'custom',     label: 'Custom',              color: '#e8edf5' },
]
const typeColor = (k) => SESSION_TYPES.find(t => t.key === k)?.color || '#e8edf5'
const typeLabel = (k) => SESSION_TYPES.find(t => t.key === k)?.label || k

// ── Format helpers
const fmtPace  = (a) => {
  const distKm = a.distance / 1000
  const mins   = a.moving_time / 60
  if (!distKm || !mins) return '—'
  const paceDecimal = mins / distKm
  const m = Math.floor(paceDecimal)
  const s = Math.round((paceDecimal - m) * 60).toString().padStart(2, '0')
  return `${m}:${s}/km`
}
const fmtDuration = (secs) => {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}
const fmtDist   = (m)    => m ? `${(m / 1000).toFixed(2)}km` : '—'
const fmtDate   = (iso)  => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
const timeAgo = (iso) => {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 2)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ── Manual activity form initial state
const blankManual = () => ({
  custom_name: '',
  custom_type: 'run',
  start_date:  new Date().toISOString().split('T')[0],
  notes: '',
  distance: '',
  duration: '',
})

export default function WorkoutHistory({ stravaConnection, onStravaConnectionChange }) {
  const [activities,   setActivities  ] = useState([])
  const [loading,      setLoading     ] = useState(true)
  const [syncing,      setSyncing     ] = useState(false)
  const [syncResult,   setSyncResult  ] = useState(null)
  const [expandedId,   setExpandedId  ] = useState(null)
  const [editForm,     setEditForm    ] = useState({})
  const [savingId,     setSavingId    ] = useState(null)
  const [manualOpen,   setManualOpen  ] = useState(false)
  const [manualForm,   setManualForm  ] = useState(blankManual())
  const [savingManual, setSavingManual] = useState(false)
  const [search,       setSearch      ] = useState('')
  const [typeFilter,   setTypeFilter  ] = useState('all')
  const [sortBy,       setSortBy      ] = useState('date_desc')

  useEffect(() => { loadActivities() }, [])

  const loadActivities = async () => {
    setLoading(true)
    const data = await db.loadActivities()
    setActivities(data)
    setLoading(false)
  }

  // ── Effective type for display (custom overrides strava)
  const effectiveType = (a) => a.custom_type || a.strava_type || 'custom'
  const effectiveName = (a) => a.custom_name || a.data?.name || 'Activity'

  // ── Filter + sort
  const filtered = useMemo(() => {
    let list = [...activities]
    if (typeFilter !== 'all') list = list.filter(a => effectiveType(a) === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => effectiveName(a).toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.start_date) - new Date(a.start_date)
      if (sortBy === 'date_asc')  return new Date(a.start_date) - new Date(b.start_date)
      if (sortBy === 'dist_desc') return (b.data?.distance || 0) - (a.data?.distance || 0)
      return 0
    })
    return list
  }, [activities, typeFilter, search, sortBy])

  // ── Sync
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res  = await fetch('/api/strava/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setSyncResult({ error: data.error }) }
      else {
        setSyncResult({ new: data.new, total: data.total })
        await loadActivities()
        onStravaConnectionChange?.()
      }
    } catch (e) {
      setSyncResult({ error: e.message })
    }
    setSyncing(false)
  }

  // ── Edit expand/save
  const openEdit = (a) => {
    setExpandedId(a.id)
    setEditForm({
      custom_name: a.custom_name || '',
      custom_type: a.custom_type || a.strava_type || 'run',
      notes:       a.notes       || '',
    })
  }
  const closeEdit = () => { setExpandedId(null); setEditForm({}) }

  const saveEdit = async (id) => {
    setSavingId(id)
    try {
      await db.updateActivity(id, editForm)
      setActivities(prev => prev.map(a => a.id === id ? { ...a, ...editForm } : a))
      closeEdit()
    } catch (e) { console.error(e) }
    setSavingId(null)
  }

  // ── Manual entry
  const saveManual = async () => {
    if (!manualForm.custom_name.trim()) return
    setSavingManual(true)
    try {
      await db.insertManualActivity({
        ...manualForm,
        start_date: new Date(manualForm.start_date).toISOString(),
      })
      await loadActivities()
      setManualOpen(false)
      setManualForm(blankManual())
    } catch (e) { console.error(e) }
    setSavingManual(false)
  }

  // ── Stats
  const totalKm = activities
    .filter(a => effectiveType(a) === 'run')
    .reduce((s, a) => s + (a.data?.distance || 0), 0) / 1000

  const thisWeekKm = activities
    .filter(a => {
      const dt = new Date(a.start_date)
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      return effectiveType(a) === 'run' && dt >= weekAgo
    })
    .reduce((s, a) => s + (a.data?.distance || 0), 0) / 1000

  const isConnected = !!stravaConnection

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1440, margin: '0 auto' }} className="fade">

      {/* ── Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 38, letterSpacing: 2, lineHeight: 1 }}>
            WORKOUT <span style={{ color: 'var(--accent)' }}>HISTORY</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 5, letterSpacing: 1 }}>
            {isConnected
              ? `${stravaConnection.athlete_name} · ${stravaConnection.activity_count || activities.length} activities · last synced ${timeAgo(stravaConnection.last_synced_at)}`
              : 'Connect Strava to sync your activities automatically'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isConnected && (
            <button onClick={handleSync} disabled={syncing} style={{
              background: syncing ? 'var(--s2)' : '#fc4c02',
              color: syncing ? 'var(--muted)' : '#fff',
              border: 'none', borderRadius: 8, padding: '10px 20px',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
              cursor: syncing ? 'default' : 'pointer', letterSpacing: 1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {syncing ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  SYNCING...
                </>
              ) : '⚡ SYNC STRAVA'}
            </button>
          )}
          {!isConnected && (
            <a href="/api/strava/connect" style={{
              background: '#fc4c02', color: '#fff', textDecoration: 'none',
              borderRadius: 8, padding: '10px 20px',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: 1,
            }}>🔗 CONNECT STRAVA</a>
          )}
          <button onClick={() => setManualOpen(true)} style={{
            background: 'var(--s2)', color: 'var(--text)',
            border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 20px',
            fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', letterSpacing: 1,
          }}>+ LOG ACTIVITY</button>
        </div>
      </div>

      {/* ── Sync result banner */}
      {syncResult && (
        <div style={{
          background: syncResult.error ? 'rgba(255,107,107,0.1)' : 'var(--accent-dim)',
          border: `1px solid ${syncResult.error ? '#ff6b6b' : 'var(--accent)'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: syncResult.error ? '#ff6b6b' : 'var(--accent)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {syncResult.error
            ? `Sync failed: ${syncResult.error}`
            : `✓ Sync complete — ${syncResult.new} new activities added · ${syncResult.total} total`}
          <button onClick={() => setSyncResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ── Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { l: 'TOTAL ACTIVITIES', v: activities.length, c: 'var(--accent)' },
          { l: 'TOTAL KM (running)', v: `${totalKm.toFixed(1)}km`, c: 'var(--blue)' },
          { l: 'KM THIS WEEK', v: `${thisWeekKm.toFixed(1)}km`, c: 'var(--orange)' },
          { l: 'ACTIVITY TYPES', v: [...new Set(activities.map(a => effectiveType(a)))].length, c: 'var(--purple)' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 18px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px', marginBottom: 6 }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 30, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Manual entry form */}
      {manualOpen && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--accent)', borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: '1.5px', marginBottom: 16 }}>LOG MANUAL ACTIVITY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 5 }}>ACTIVITY NAME</div>
              <input type="text" placeholder="Morning Run" value={manualForm.custom_name} onChange={e => setManualForm(p => ({ ...p, custom_name: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 5 }}>TYPE</div>
              <select value={manualForm.custom_type} onChange={e => setManualForm(p => ({ ...p, custom_type: e.target.value }))}
                style={{ color: typeColor(manualForm.custom_type), borderColor: `${typeColor(manualForm.custom_type)}55` }}>
                {SESSION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 5 }}>DATE</div>
              <input type="date" value={manualForm.start_date} onChange={e => setManualForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 5 }}>NOTES</div>
              <input type="text" placeholder="Optional notes..." value={manualForm.notes} onChange={e => setManualForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveManual} disabled={!manualForm.custom_name.trim() || savingManual} style={{
              background: manualForm.custom_name.trim() ? 'var(--accent)' : 'var(--s3)',
              color: manualForm.custom_name.trim() ? 'var(--bg)' : 'var(--muted)',
              border: 'none', borderRadius: 7, padding: '9px 24px',
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{savingManual ? 'SAVING...' : 'SAVE ACTIVITY'}</button>
            <button onClick={() => { setManualOpen(false); setManualForm(blankManual()) }} style={{
              background: 'none', border: '1px solid var(--border2)', borderRadius: 7, padding: '9px 16px',
              fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
            }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* ── Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input
          type="text" placeholder="Search activities..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280, fontSize: 13 }}
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ width: 160, fontSize: 13, color: typeFilter === 'all' ? 'var(--muted)' : typeColor(typeFilter) }}>
          <option value="all">All Types</option>
          {SESSION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 180, fontSize: 13 }}>
          <option value="date_desc">Date — Newest First</option>
          <option value="date_asc">Date — Oldest First</option>
          <option value="dist_desc">Distance — Longest First</option>
        </select>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
          {filtered.length} of {activities.length} activities
        </div>
      </div>

      {/* ── Activity list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
          <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>Loading activities...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 36, color: 'var(--muted)', marginBottom: 12 }}>
            {activities.length === 0 ? 'NO ACTIVITIES YET' : 'NO MATCHES'}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            {activities.length === 0
              ? 'Connect Strava and sync to import your activities, or log one manually.'
              : 'Try a different search or filter.'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 130px 90px 90px 90px 80px 80px', gap: 0, background: 'var(--s2)', borderBottom: '1px solid var(--border)', padding: '8px 16px' }}>
            {['DATE', 'ACTIVITY', 'TYPE', 'DISTANCE', 'DURATION', 'PACE', 'SOURCE', ''].map(h => (
              <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: '1.5px' }}>{h}</div>
            ))}
          </div>

          {filtered.map((a) => {
            const isExpanded = expandedId === a.id
            const type  = effectiveType(a)
            const name  = effectiveName(a)
            const color = typeColor(type)
            const isManual = a.data?.manual

            return (
              <div key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Activity row */}
                <div
                  onClick={() => isExpanded ? closeEdit() : openEdit(a)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 2fr 130px 90px 90px 90px 80px 80px',
                    gap: 0, padding: '12px 16px', cursor: 'pointer',
                    background: isExpanded ? 'var(--s2)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--s2)' }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{fmtDate(a.start_date)}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)', fontWeight: 500, paddingRight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                    {a.custom_name && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', marginLeft: 8 }}>EDITED</span>}
                  </div>
                  <div>
                    <span style={{ background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 5, padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 10, color, whiteSpace: 'nowrap' }}>
                      {typeLabel(type)}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>{fmtDist(a.data?.distance)}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>{fmtDuration(a.data?.moving_time)}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{a.data?.distance && a.data?.moving_time ? fmtPace(a.data) : '—'}</div>
                  <div>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                      color: isManual ? 'var(--orange)' : '#fc4c02',
                      background: isManual ? 'rgba(255,159,64,0.12)' : 'rgba(252,76,2,0.12)',
                      border: `1px solid ${isManual ? 'rgba(255,159,64,0.3)' : 'rgba(252,76,2,0.3)'}`,
                      borderRadius: 4, padding: '2px 7px',
                    }}>
                      {isManual ? 'MANUAL' : 'STRAVA'}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
                    {isExpanded ? '▲ CLOSE' : '▼ EDIT'}
                  </div>
                </div>

                {/* Expanded edit form */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px', background: `${color}08`, borderTop: `1px solid ${color}22` }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '1.5px', marginBottom: 14 }}>EDIT ACTIVITY</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr', gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 5 }}>
                          CUSTOM NAME <span style={{ color: 'var(--muted2)' }}>(leave blank to use Strava name)</span>
                        </div>
                        <input
                          type="text"
                          placeholder={a.data?.name || 'Activity name...'}
                          value={editForm.custom_name}
                          onChange={e => setEditForm(p => ({ ...p, custom_name: e.target.value }))}
                          style={{ fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 5 }}>SESSION TYPE</div>
                        <select
                          value={editForm.custom_type}
                          onChange={e => setEditForm(p => ({ ...p, custom_type: e.target.value }))}
                          style={{ color: typeColor(editForm.custom_type), borderColor: `${typeColor(editForm.custom_type)}55`, fontSize: 13 }}
                        >
                          {SESSION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', letterSpacing: 1, marginBottom: 5 }}>NOTES</div>
                        <input type="text" placeholder="Add notes..." value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} style={{ fontSize: 13 }} />
                      </div>
                    </div>
                    {/* Strava data readout */}
                    {!isManual && (
                      <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
                        {[
                          { l: 'FROM STRAVA', v: a.data?.name },
                          { l: 'STRAVA TYPE', v: a.data?.sport_type || a.data?.type },
                          { l: 'ELEVATION', v: a.data?.total_elevation_gain ? `${a.data.total_elevation_gain}m` : '—' },
                          { l: 'AVG HEART RATE', v: a.data?.average_heartrate ? `${Math.round(a.data.average_heartrate)}bpm` : '—' },
                          { l: 'MAX HEART RATE', v: a.data?.max_heartrate ? `${a.data.max_heartrate}bpm` : '—' },
                        ].map(({ l, v }) => (
                          <div key={l}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--muted2)', letterSpacing: 1 }}>{l}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>{v || '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => saveEdit(a.id)} disabled={savingId === a.id} style={{
                        background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                        borderRadius: 7, padding: '8px 24px', fontFamily: 'var(--font-mono)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 1,
                      }}>{savingId === a.id ? 'SAVING...' : 'SAVE CHANGES'}</button>
                      <button onClick={closeEdit} style={{
                        background: 'none', border: '1px solid var(--border2)', borderRadius: 7, padding: '8px 16px',
                        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
                      }}>CANCEL</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
