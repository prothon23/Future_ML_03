// src/App.jsx
import React, { useState } from 'react'
import Dashboard      from './components/Dashboard'
import CandidateList  from './components/CandidateList'
import UploadResumes  from './components/UploadResumes'
import JobConfig      from './components/JobConfig'

const TABS = [
  { id: 'upload',     label: 'Upload Resumes', icon: '📤' },
  { id: 'dashboard',  label: 'Dashboard',      icon: '📊' },
  { id: 'candidates', label: 'Candidates',     icon: '👥' },
  { id: 'config',     label: 'Job Config',     icon: '⚙️'  },
]

export default function App() {
  const [tab,     setTab]     = useState('upload')
  const [results, setResults] = useState(null)

  function handleResults(res) {
    setResults(res)
    setTab('dashboard')   // auto-switch to dashboard after screening
  }

  const isActive = id => id === tab

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e8eaf0', fontFamily: 'system-ui,sans-serif' }}>

      {/* ── Top navigation bar ────────────────────────────── */}
      <div style={{
        background: '#1a1d27', borderBottom: '1px solid #2e3347',
        padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 56,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#6c63ff', letterSpacing: '-0.5px' }}>
          🎯 ATS Screening
        </div>

        <nav style={{ display: 'flex', gap: 4 }}>
          {TABS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              display     : 'flex', alignItems: 'center', gap: 6,
              padding     : '7px 16px', borderRadius: 8,
              fontSize    : 13, fontWeight: 500,
              background  : isActive(id) ? '#6c63ff' : 'transparent',
              color       : isActive(id) ? '#fff'    : '#8b90a7',
              border      : `1px solid ${isActive(id) ? '#6c63ff' : 'transparent'}`,
              cursor      : 'pointer', transition: 'all .15s',
            }}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div style={{ fontSize: 12, color: '#8b90a7' }}>
          {results
            ? `${results.summary.total} screened · ${results.summary.shortlisted} shortlisted`
            : 'No screening data yet'}
        </div>
      </div>

      {/* ── Page content ──────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* Banner: nudge user to run screening if on a results tab with no data */}
        {!results && (tab === 'dashboard' || tab === 'candidates') && (
          <div style={{
            background: '#6c63ff12', border: '1px solid #6c63ff33',
            borderRadius: 10, padding: '12px 18px', marginBottom: 20,
            fontSize: 13, color: '#6c63ff',
          }}>
            No screening data yet — go to <strong>Upload Resumes</strong> tab and click
            &nbsp;<strong>Run Demo</strong> or upload your PDFs.
          </div>
        )}

        {/* Results summary banner */}
        {results && (tab === 'dashboard' || tab === 'candidates') && (
          <div style={{
            background: '#22c55e12', border: '1px solid #22c55e33',
            borderRadius: 10, padding: '12px 18px', marginBottom: 20,
            fontSize: 13, color: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 8,
          }}>
            <span>
              ✅ <strong>{results.summary.total}</strong> screened &nbsp;|&nbsp;
              <strong>{results.summary.shortlisted}</strong> shortlisted ({results.summary.selection_pct}%) &nbsp;|&nbsp;
              <strong>{results.summary.rejected}</strong> rejected &nbsp;|&nbsp;
              Best model: {results.summary.best_model}
            </span>
            <button onClick={() => setTab('upload')} style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 7,
              background: '#22c55e18', color: '#22c55e', border: '1px solid #22c55e44', cursor: 'pointer',
            }}>
              + Add more PDFs
            </button>
          </div>
        )}

        {/* Tab pages */}
        {tab === 'upload'     && <UploadResumes onResults={handleResults} />}
        {tab === 'dashboard'  && <Dashboard     results={results} />}
        {tab === 'candidates' && <CandidateList candidates={results?.candidates} />}
        {tab === 'config'     && <JobConfig     onSaved={() => {}} />}
      </div>
    </div>
  )
}
