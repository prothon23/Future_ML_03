// src/components/UploadResumes.jsx
//
// Full PDF upload panel with:
//   - Drag and drop zone (or click to browse)
//   - Multiple files at once
//   - Per-file parse status (success / failed / skipped)
//   - Session file list showing all uploaded PDFs
//   - Remove individual files
//   - Toggle to include/exclude builtin 25 resumes
//   - Run Screening button
//   - Clear session button

import React, { useState, useRef, useCallback, useEffect } from 'react'

const API = '/api'

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
  return data
}

// ── colour helpers ────────────────────────────────────────────
const c = {
  success : { bg: '#22c55e18', border: '#22c55e44', text: '#22c55e' },
  error   : { bg: '#ef444418', border: '#ef444444', text: '#ef4444' },
  warning : { bg: '#f59e0b18', border: '#f59e0b44', text: '#f59e0b' },
  info    : { bg: '#3b82f618', border: '#3b82f644', text: '#3b82f6' },
  accent  : { bg: '#6c63ff18', border: '#6c63ff44', text: '#6c63ff' },
}

function Badge({ type = 'info', text, style = {} }) {
  const col = c[type] || c.info
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      background: col.bg, color: col.text, border: `1px solid ${col.border}`,
      ...style,
    }}>{text}</span>
  )
}

function Btn({ label, onClick, disabled, type = 'accent', icon, fullWidth, small }) {
  const col = c[type] || c.accent
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display     : 'flex', alignItems: 'center', justifyContent: 'center',
      gap         : 7, padding: small ? '7px 14px' : '11px 22px',
      borderRadius: 9, fontSize: small ? 13 : 14, fontWeight: 600,
      background  : disabled ? 'var(--color-background-secondary)' : col.bg,
      color       : disabled ? 'var(--color-text-tertiary)' : col.text,
      border      : `1px solid ${disabled ? 'var(--color-border-tertiary)' : col.border}`,
      cursor      : disabled ? 'not-allowed' : 'pointer',
      width       : fullWidth ? '100%' : 'auto',
      transition  : 'opacity .15s',
      opacity     : disabled ? .6 : 1,
    }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      {label}
    </button>
  )
}

// file size human readable
function fsize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(0)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}

// ── Main component ────────────────────────────────────────────

export default function UploadResumes({ onResults }) {
  const [dragging,    setDragging]    = useState(false)
  const [queued,      setQueued]      = useState([])      // files waiting to upload
  const [sessionFiles,setSession]     = useState([])      // files already on server
  const [parseResults,setParseRes]    = useState([])      // per-file status from last upload
  const [useBuiltin,  setBuiltin]     = useState(true)
  const [loading,     setLoading]     = useState(false)
  const [loadingClear,setLoadingClear]= useState(false)
  const [error,       setError]       = useState(null)
  const [runStatus,   setRunStatus]   = useState(null)    // 'running' | 'done' | 'error'
  const fileInputRef = useRef()

  // Load any already-uploaded files on mount
  useEffect(() => {
    apiFetch('/uploaded-files')
      .then(d => setSession(d.files || []))
      .catch(() => {})
  }, [])

  // ── Drag handlers ─────────────────────────────────────────
  const onDragOver  = useCallback(e => { e.preventDefault(); setDragging(true)  }, [])
  const onDragLeave = useCallback(e => { e.preventDefault(); setDragging(false) }, [])
  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (files.length) addToQueue(files)
    else setError('Please drop PDF files only.')
  }, [])

  function addToQueue(files) {
    setError(null)
    setQueued(prev => {
      const existing = new Set(prev.map(f => f.name))
      const fresh = files.filter(f => !existing.has(f.name))
      return [...prev, ...fresh]
    })
  }

  function removeFromQueue(name) {
    setQueued(prev => prev.filter(f => f.name !== name))
  }

  // ── Upload and run ────────────────────────────────────────
  async function handleUploadAndRun() {
    if (queued.length === 0 && sessionFiles.length === 0 && !useBuiltin) {
      setError('Add at least one PDF or enable the built-in demo data.')
      return
    }
    setLoading(true)
    setError(null)
    setRunStatus('running')
    setParseRes([])

    try {
      let pipelineResults = null

      // Step 1: upload queued files if any
      if (queued.length > 0) {
        const form = new FormData()
        queued.forEach(f => form.append('files', f))
        form.append('use_builtin', useBuiltin)
        form.append('run_now', 'true')

        const res = await apiFetch('/upload-pdfs', { method: 'POST', body: form })
        setParseRes(res.file_results || [])
        setSession(res.session_files || [])
        setQueued([])  // clear queue after upload
        pipelineResults = res.pipeline_results

        if (res.pipeline_error) {
          throw new Error(res.pipeline_error)
        }
      } else {
        // No new files — just re-run on existing session + builtin
        pipelineResults = await apiFetch('/run-with-uploaded' + (useBuiltin ? '?use_builtin=true' : '?use_builtin=false'), {
          method: 'POST',
        })
      }

      if (pipelineResults) {
        setRunStatus('done')
        if (onResults) onResults(pipelineResults)
      }
    } catch (e) {
      setError(e.message)
      setRunStatus('error')
    } finally {
      setLoading(false)
    }
  }

  // ── Remove from server session ────────────────────────────
  async function removeSessionFile(filename) {
    try {
      await apiFetch(`/uploaded-files/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      setSession(prev => prev.filter(f => f.name !== filename))
      setParseRes(prev => prev.filter(f => f.name !== filename))
    } catch (e) {
      setError(e.message)
    }
  }

  // ── Clear everything ──────────────────────────────────────
  async function handleClear() {
    setLoadingClear(true)
    try {
      await apiFetch('/clear', { method: 'POST' })
      setSession([])
      setQueued([])
      setParseRes([])
      setRunStatus(null)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingClear(false)
    }
  }

  // ── Run demo ──────────────────────────────────────────────
  async function handleDemo() {
    setLoading(true)
    setError(null)
    setRunStatus('running')
    try {
      const res = await apiFetch('/run-demo', { method: 'POST' })
      setRunStatus('done')
      if (onResults) onResults(res)
    } catch (e) {
      setError(e.message)
      setRunStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const totalCandidates =
    (useBuiltin ? 25 : 0) +
    sessionFiles.length +
    queued.length

  const card = {
    background  : 'var(--color-background-primary)',
    border      : '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding     : '20px 22px',
    marginBottom: 16,
  }
  const sectionLabel = {
    fontSize    : 11,
    fontWeight  : 500,
    color       : 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: 10,
    display     : 'block',
  }

  return (
    <div style={{ maxWidth: 700 }}>

      {/* ── Quick demo ──────────────────────────────────────── */}
      <div style={card}>
        <span style={sectionLabel}>Quick demo — no files needed</span>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
          Screen 25 built-in synthetic candidates instantly to explore the dashboard before uploading your own PDFs.
        </p>
        <Btn label={loading ? 'Running…' : 'Run Demo (25 candidates)'} icon="▶"
             onClick={handleDemo} disabled={loading} type="success" />
      </div>

      {/* ── Toggle builtin ──────────────────────────────────── */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Include 25 built-in demo candidates</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Screen your PDFs alongside the synthetic dataset
          </div>
        </div>
        <button onClick={() => setBuiltin(p => !p)} style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: useBuiltin ? '#22c55e' : 'var(--color-border-secondary)',
          position: 'relative', transition: 'background .2s',
        }}>
          <span style={{
            position: 'absolute', top: 3, left: useBuiltin ? 23 : 3,
            width: 18, height: 18, borderRadius: 9, background: '#fff',
            transition: 'left .2s',
          }} />
        </button>
      </div>

      {/* ── Drop zone ───────────────────────────────────────── */}
      <div style={card}>
        <span style={sectionLabel}>Upload PDF resumes</span>

        {/* Drop area */}
        <div
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => fileInputRef.current.click()}
          style={{
            border      : `2px dashed ${dragging ? '#6c63ff' : 'var(--color-border-secondary)'}`,
            borderRadius: 'var(--border-radius-lg)',
            padding     : '36px 24px',
            textAlign   : 'center',
            cursor      : 'pointer',
            background  : dragging ? '#6c63ff0a' : 'var(--color-background-secondary)',
            transition  : 'all .15s',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
            Drag &amp; drop PDF files here
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            or click to browse your computer
          </div>
          <div style={{
            display: 'inline-block', padding: '8px 20px', borderRadius: 8,
            background: '#6c63ff18', color: '#6c63ff', border: '1px solid #6c63ff44',
            fontSize: 13, fontWeight: 600,
          }}>
            Choose PDF files
          </div>
          <input
            ref={fileInputRef} type="file" multiple accept=".pdf"
            style={{ display: 'none' }}
            onChange={e => { addToQueue(Array.from(e.target.files)); e.target.value = '' }}
          />
        </div>

        {/* Queued files (not yet uploaded) */}
        {queued.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...sectionLabel, marginBottom: 8 }}>
              Ready to upload ({queued.length} file{queued.length > 1 ? 's' : ''})
            </span>
            {queued.map(f => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', borderRadius: 8, marginBottom: 6,
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{fsize(f.size)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge type="info" text="Queued" />
                  <button onClick={() => removeFromQueue(f.name)}
                    style={{ background: 'none', color: 'var(--color-text-tertiary)', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Already-on-server session files */}
        {sessionFiles.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...sectionLabel, marginBottom: 8 }}>
              Uploaded this session ({sessionFiles.length} file{sessionFiles.length > 1 ? 's' : ''})
            </span>
            {sessionFiles.map(f => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', borderRadius: 8, marginBottom: 6,
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      {f.chars ? `${(f.chars/1000).toFixed(1)} KB text extracted` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge type="success" text="On server" />
                  <button onClick={() => removeSessionFile(f.name)}
                    style={{ background: 'none', color: 'var(--color-text-tertiary)', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parse results from last upload */}
        {parseResults.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...sectionLabel, marginBottom: 8 }}>Last upload results</span>
            {parseResults.map(r => (
              <div key={r.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 14px', borderRadius: 8, marginBottom: 5,
                background: r.status === 'success' ? '#22c55e0a' : '#ef44440a',
                border: `0.5px solid ${r.status === 'success' ? '#22c55e33' : '#ef444433'}`,
              }}>
                <span style={{ fontSize: 13 }}>{r.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.chars > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                      {(r.chars/1000).toFixed(1)} KB
                    </span>
                  )}
                  <Badge
                    type={r.status === 'success' ? 'success' : 'error'}
                    text={r.status === 'success' ? '✓ Parsed' : `✗ ${r.reason || 'Failed'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary line */}
        <div style={{
          fontSize: 13, color: 'var(--color-text-secondary)',
          padding: '10px 14px', borderRadius: 8,
          background: 'var(--color-background-secondary)',
          marginBottom: 14,
        }}>
          Will screen: <strong style={{ color: 'var(--color-text-primary)' }}>{totalCandidates}</strong> candidates
          {useBuiltin ? ` (25 built-in + ${sessionFiles.length + queued.length} PDF${sessionFiles.length + queued.length !== 1 ? 's' : ''})` : ` PDFs`}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn
            label={loading
              ? (runStatus === 'running' ? 'Running pipeline…' : 'Uploading…')
              : (queued.length > 0
                  ? `Upload ${queued.length} PDF${queued.length > 1 ? 's' : ''} & Screen`
                  : 'Run Screening')}
            icon={loading ? '⏳' : '▶'}
            onClick={handleUploadAndRun}
            disabled={loading || (queued.length === 0 && sessionFiles.length === 0 && !useBuiltin)}
            type={runStatus === 'done' ? 'success' : 'accent'}
          />
          {(sessionFiles.length > 0 || queued.length > 0) && (
            <Btn
              label={loadingClear ? 'Clearing…' : 'Clear All'}
              icon="🗑"
              onClick={handleClear}
              disabled={loadingClear || loading}
              type="error"
              small
            />
          )}
        </div>
      </div>

      {/* ── Status messages ────────────────────────────────── */}
      {runStatus === 'done' && !error && (
        <div style={{
          background: '#22c55e12', border: '1px solid #22c55e33', borderRadius: 10,
          padding: '12px 16px', fontSize: 13, color: '#22c55e',
        }}>
          ✅ Screening complete! Switch to the <strong>Dashboard</strong> or <strong>Candidates</strong> tab to see results.
        </div>
      )}

      {error && (
        <div style={{
          background: '#ef444412', border: '1px solid #ef444433', borderRadius: 10,
          padding: '12px 16px', fontSize: 13, color: '#ef4444',
        }}>
          ❌ {error}
        </div>
      )}

      {/* ── Tips ─────────────────────────────────────────────── */}
      <div style={{
        ...card, marginTop: 4,
        background: 'var(--color-background-secondary)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}>
        <span style={sectionLabel}>Tips for best results</span>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 2 }}>
          ✓ Use text-based PDFs — not scanned images (photos of pages)<br/>
          ✓ Upload multiple PDFs at once by selecting them all in the file picker<br/>
          ✓ You can add more PDFs after the first run — they accumulate in the session<br/>
          ✓ Change the job role in <strong style={{ color: 'var(--color-text-primary)' }}>Job Config</strong> tab, then re-run to re-score everyone<br/>
          ✓ Click Clear to remove all uploaded PDFs and start fresh
        </div>
      </div>

    </div>
  )
}
