// src/components/JobConfig.jsx
// Edit job role, required skills, preferred skills, experience, threshold.
// Changes POST to /api/config — no Python file editing needed.
import React, { useState, useEffect } from 'react'
import { Save, Plus, X, RefreshCw } from 'lucide-react'
import { getConfig, saveConfig, getSkillsList } from '../hooks/useApi'

const S = {
  section: { marginBottom: 28 },
  label  : { fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' },
  row    : { display: 'flex', gap: 12, marginBottom: 16 },
  chip   : { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 20, fontSize: 12, fontWeight: 500, margin: '3px',
              border: '1px solid', cursor: 'default' },
  btn    : (color = 'var(--accent)') => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
    background: `${color}22`, color, border: `1px solid ${color}44`, cursor: 'pointer',
  }),
  success: { background: '#22c55e22', border: '1px solid #22c55e44', borderRadius: 8,
              padding: '10px 16px', color: 'var(--green)', fontSize: 13, marginTop: 12 },
  error  : { background: '#ef444422', border: '1px solid #ef444444', borderRadius: 8,
              padding: '10px 16px', color: 'var(--red)', fontSize: 13, marginTop: 12 },
}

function SkillChips({ skills, color, onRemove }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
      {skills.map(s => (
        <span key={s} style={{ ...S.chip, background: `${color}18`, color, borderColor: `${color}44` }}>
          {s}
          {onRemove && (
            <button onClick={() => onRemove(s)}
              style={{ background: 'none', color, lineHeight: 1, padding: 0 }}>
              <X size={12} />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function AddSkillInput({ onAdd, placeholder, allSkills }) {
  const [val, setVal] = useState('')
  const [suggestions, setSuggestions] = useState([])

  function handleChange(e) {
    const v = e.target.value
    setVal(v)
    if (v.length >= 2) {
      setSuggestions(allSkills.filter(s => s.includes(v.toLowerCase())).slice(0, 6))
    } else {
      setSuggestions([])
    }
  }

  function commit(skill) {
    const clean = (skill || val).trim().toLowerCase()
    if (clean) { onAdd(clean); setVal(''); setSuggestions([]) }
  }

  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={val} onChange={handleChange}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          placeholder={placeholder} style={{ flex: 1 }} />
        <button onClick={() => commit()} style={S.btn()}>
          <Plus size={14} /> Add
        </button>
      </div>
      {suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 60, zIndex: 10,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 8, marginTop: 4, overflow: 'hidden',
        }}>
          {suggestions.map(s => (
            <div key={s} onClick={() => commit(s)} style={{
              padding: '8px 14px', fontSize: 13, cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function JobConfig({ onSaved }) {
  const [cfg, setCfg]         = useState(null)
  const [allSkills, setAll]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState(null)

  useEffect(() => {
    Promise.all([getConfig(), getSkillsList()]).then(([c, s]) => {
      setCfg(c)
      setAll(s.skills || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading || !cfg) return (
    <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Loading configuration...</div>
  )

  function removeSkill(key, skill) {
    setCfg(prev => ({ ...prev, [key]: prev[key].filter(s => s !== skill) }))
  }
  function addSkill(key, skill) {
    if (!cfg[key].includes(skill))
      setCfg(prev => ({ ...prev, [key]: [...prev[key], skill] }))
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const saved = await saveConfig(cfg)
      setMsg({ type: 'success', text: `Configuration saved! Job: "${saved.config.title}" with ${cfg.must_have.length} required skills.` })
      if (onSaved) onSaved(saved.config)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Job Configuration</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          Configure the job role and required technologies. Changes apply immediately when you save —
          no Python file editing required.
        </p>
      </div>

      {/* Job title */}
      <div style={S.section}>
        <label style={S.label}>Job Title</label>
        <input value={cfg.title} onChange={e => setCfg(p => ({ ...p, title: e.target.value }))}
          placeholder="e.g. Senior Data Scientist" />
      </div>

      {/* Min experience + threshold */}
      <div style={S.row}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Minimum Experience (years)</label>
          <input type="number" min={0} max={20} value={cfg.min_experience}
            onChange={e => setCfg(p => ({ ...p, min_experience: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Shortlist Threshold (ATS score ≥)</label>
          <input type="number" min={10} max={90} value={cfg.threshold}
            onChange={e => setCfg(p => ({ ...p, threshold: parseFloat(e.target.value) || 50 }))} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Candidates scoring ≥ this are shortlisted (default: 50)
          </div>
        </div>
      </div>

      {/* Must-have skills */}
      <div style={S.section}>
        <label style={S.label}>Required Skills (must-have) — contribute 40% to ATS score</label>
        <SkillChips skills={cfg.must_have} color="var(--blue)"
          onRemove={s => removeSkill('must_have', s)} />
        <AddSkillInput onAdd={s => addSkill('must_have', s)}
          placeholder="Type a skill + Enter (e.g. python, tensorflow, docker)"
          allSkills={allSkills} />
      </div>

      {/* Preferred skills */}
      <div style={S.section}>
        <label style={S.label}>Preferred Skills (good-to-have) — up to +5 bonus points</label>
        <SkillChips skills={cfg.preferred} color="var(--accent)"
          onRemove={s => removeSkill('preferred', s)} />
        <AddSkillInput onAdd={s => addSkill('preferred', s)}
          placeholder="Type a bonus skill + Enter (e.g. mlflow, kubernetes)"
          allSkills={allSkills} />
      </div>

      {/* Custom JD text */}
      <div style={S.section}>
        <label style={S.label}>Job Description Text (optional — used for keyword matching)</label>
        <textarea rows={5} value={cfg.jd_text || ''}
          onChange={e => setCfg(p => ({ ...p, jd_text: e.target.value }))}
          placeholder="Paste the full job description here for better keyword matching. If left empty, it is auto-generated from the skills above." />
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{
          ...S.btn('var(--green)'),
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {msg && (
        <div style={msg.type === 'success' ? S.success : S.error}>
          {msg.text}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
