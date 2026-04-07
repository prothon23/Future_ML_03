// src/components/CandidateList.jsx
// Sortable, filterable table. Click candidate name → opens detail modal.
import React, { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import CandidateDetail from './CandidateDetail'

const COLS = [
  { key: 'rank',            label: '#',           width: 50  },
  { key: 'name',            label: 'Candidate',   width: 160 },
  { key: 'ats_score',       label: 'ATS Score',   width: 100 },
  { key: 'skill_match_pct', label: 'Skills %',    width: 90  },
  { key: 'years_exp',       label: 'Exp (yrs)',   width: 90  },
  { key: 'seniority',       label: 'Level',       width: 110 },
  { key: 'skills_count',    label: '# Skills',    width: 80  },
  { key: 'decision',        label: 'Decision',    width: 110 },
]

function DecisionBadge({ decision }) {
  const isShort = decision === 'Shortlist'
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      background: isShort ? '#22c55e22' : '#ef444422',
      color: isShort ? 'var(--green)' : 'var(--red)',
      border: `1px solid ${isShort ? '#22c55e44' : '#ef444444'}`,
    }}>
      {isShort ? '✅ Shortlist' : '❌ Reject'}
    </span>
  )
}

function ScorePill({ value, max = 100 }) {
  const pct = value / max
  const color = pct >= 0.7 ? 'var(--green)' : pct >= 0.4 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 50, height: 4, background: 'var(--surface2)', borderRadius: 2 }}>
        <div style={{ width: `${pct*100}%`, height: 4, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
    </div>
  )
}

export default function CandidateList({ candidates }) {
  const [selected, setSelected]   = useState(null)
  const [filter, setFilter]       = useState('all')   // all | shortlist | reject
  const [search, setSearch]       = useState('')
  const [sortKey, setSortKey]     = useState('ats_score')
  const [sortDir, setSortDir]     = useState('desc')

  const filtered = useMemo(() => {
    let arr = candidates || []
    if (filter === 'shortlist') arr = arr.filter(c => c.decision === 'Shortlist')
    if (filter === 'reject')    arr = arr.filter(c => c.decision === 'Reject')
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.seniority.toLowerCase().includes(q) ||
        (c.skills || []).some(s => s.includes(q))
      )
    }
    arr = [...arr].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return arr
  }, [candidates, filter, search, sortKey, sortDir])

  function toggleSort(key) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, skill, level..."
            style={{ paddingLeft: 36 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all','shortlist','reject'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? '#fff' : 'var(--muted)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
            }}>
              {f === 'all' ? 'All' : f === 'shortlist' ? '✅ Shortlisted' : '❌ Rejected'}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{filtered.length} candidates</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {COLS.map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)} style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                  color: 'var(--muted)', cursor: 'pointer', userSelect: 'none',
                  width: col.width, whiteSpace: 'nowrap',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {sortKey === col.key
                      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} style={{
                borderBottom: '1px solid var(--border)',
                background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)'}
              >
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{c.rank}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => setSelected(c)}
                    style={{
                      background: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 600,
                      textDecoration: 'underline', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {c.name}
                  </button>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <ScorePill value={c.ats_score} />
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.skill_match_pct}%</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.years_exp}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>{c.seniority}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.skills_count}</td>
                <td style={{ padding: '12px 16px' }}><DecisionBadge decision={c.decision} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No candidates match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selected && <CandidateDetail candidate={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
