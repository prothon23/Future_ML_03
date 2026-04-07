// src/hooks/useApi.js
// All API calls to the Python backend.
// UploadResumes.jsx calls these directly with fetch(),
// but other components can import these helpers.

const BASE = '/api'

export async function getConfig() {
  const res = await fetch(`${BASE}/config`)
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

export async function saveConfig(config) {
  const res = await fetch(`${BASE}/config`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(config),
  })
  if (!res.ok) throw new Error('Failed to save config')
  return res.json()
}

export async function runDemo() {
  const res = await fetch(`${BASE}/run-demo`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Demo run failed')
  }
  return res.json()
}

// Upload PDFs and optionally run the pipeline immediately
export async function uploadPdfs(files, useBuiltin = true, runNow = true) {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  form.append('use_builtin', useBuiltin)
  form.append('run_now', runNow)
  const res = await fetch(`${BASE}/upload-pdfs`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'PDF upload failed')
  }
  return res.json()
}

// Re-run pipeline on all session PDFs (+ optional builtin)
export async function runWithUploaded(useBuiltin = true) {
  const res = await fetch(`${BASE}/run-with-uploaded?use_builtin=${useBuiltin}`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Pipeline run failed')
  }
  return res.json()
}

// Get list of PDFs already uploaded in this session
export async function getUploadedFiles() {
  const res = await fetch(`${BASE}/uploaded-files`)
  if (!res.ok) return { files: [], count: 0 }
  return res.json()
}

// Remove one PDF from the session by filename
export async function removeUploadedFile(filename) {
  const res = await fetch(`${BASE}/uploaded-files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Remove failed')
  }
  return res.json()
}

// Clear all uploaded PDFs and results
export async function clearSession() {
  const res = await fetch(`${BASE}/clear`, { method: 'POST' })
  if (!res.ok) throw new Error('Clear failed')
  return res.json()
}

export async function uploadCsv(file, textCol, nameCol, useBuiltin = true, maxRows = 200) {
  const form = new FormData()
  form.append('file', file)
  if (textCol) form.append('text_col', textCol)
  if (nameCol) form.append('name_col', nameCol)
  form.append('use_builtin', useBuiltin)
  form.append('max_rows', maxRows)
  const res = await fetch(`${BASE}/upload-csv`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'CSV upload failed')
  }
  return res.json()
}

export async function getResults() {
  const res = await fetch(`${BASE}/results`)
  if (!res.ok) throw new Error('No results yet')
  return res.json()
}

export async function getCandidate(id) {
  const res = await fetch(`${BASE}/candidate/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('Candidate not found')
  return res.json()
}

export async function getSkillsList() {
  const res = await fetch(`${BASE}/skills-list`)
  if (!res.ok) return { skills: [] }
  return res.json()
}
