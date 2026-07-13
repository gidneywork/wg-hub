'use client'

import { useEffect, useState } from 'react'
import { db } from '../../../lib/db'
import { apiFetch } from '../../../lib/api'

const FILE_SLOTS = [
  { key: 'physiological_cycles', label: 'physiological_cycles.csv', desc: 'Recovery, HRV, RHR, strain' },
  { key: 'sleeps',               label: 'sleeps.csv',               desc: 'Sleep scores, stages, efficiency' },
  { key: 'workouts',             label: 'workouts.csv',             desc: 'Workout strain and HR zones' },
  { key: 'journal_entries',      label: 'journal_entries.csv',      desc: 'Daily journal answers · optional' },
]

// "08 May, 21:26"
function fmtUploadDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date}, ${time}`
}

export default function WhoopUpload({ onAuditWritten }) {
  const [files, setFiles] = useState({})
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [lastUpload, setLastUpload] = useState(null)

  // Most recent whoop_upload audit row drives the "Last upload · …"
  // sub line in the section head. Recompute on mount and after every
  // successful import.
  const loadLastUpload = async () => {
    const rows = await db.loadAuditLog({ type: 'whoop_upload', limit: 1 })
    setLastUpload(rows?.[0]?.created_at || null)
  }
  useEffect(() => { loadLastUpload() }, [])

  const handleFile = (key, file) => {
    if (!file) return
    setFiles(prev => ({ ...prev, [key]: file }))
    setResult(null)
  }

  const hasAnyFile = Object.keys(files).length > 0

  const handleImport = async () => {
    if (!hasAnyFile) return
    setUploading(true)
    setResult(null)
    try {
      const fd = new FormData()
      Object.entries(files).forEach(([k, f]) => fd.append(k, f))
      const res = await apiFetch('/api/whoop/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) {
        setResult({ error: data.error })
      } else {
        setResult({ ok: true, message: data.message })
        setFiles({})
        await loadLastUpload()
        onAuditWritten?.()
      }
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setUploading(false)
    }
  }

  const subLine = lastUpload
    ? <span className="section-sub">Last upload · {fmtUploadDate(lastUpload)}</span>
    : <span className="section-sub italic">No uploads yet</span>

  return (
    <section className="settings-section r r-9">
      <div className="section-head">
        <span className="section-label">Whoop data import</span>
        {subLine}
      </div>
      <p className="section-blurb">Upload exported CSV files from the Whoop app · Account → Export Data.</p>

      <div className="upload-grid">
        {FILE_SLOTS.map(slot => {
          const picked = files[slot.key]
          return (
            <label key={slot.key} className={`upload-zone${picked ? ' has-file' : ''}`}>
              <div className="upload-filename">{slot.label}</div>
              <div className="upload-desc">{slot.desc}</div>
              <div className="upload-action">
                {picked ? `Selected · ${picked.name}` : 'Click to select file →'}
              </div>
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => handleFile(slot.key, e.target.files?.[0])}
              />
            </label>
          )
        })}
      </div>

      <div className="upload-import-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleImport}
          disabled={!hasAnyFile || uploading}
        >
          {uploading ? 'Importing…' : 'Import Whoop data'}
        </button>
        {result ? (
          <span className={`upload-result${result.error ? ' error' : ''}`}>
            {result.error ? `Import failed · ${result.error}` : result.message}
          </span>
        ) : null}
      </div>
    </section>
  )
}
