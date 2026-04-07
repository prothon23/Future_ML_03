// src/components/CandidateDetail.jsx
// Full profile modal shown when user clicks a candidate name
import React from 'react'
import { X, Mail, Briefcase, Star, AlertCircle, CheckCircle, Brain } from 'lucide-react'

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}
const modal = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', width: '100%', maxWidth: 680,
  maxHeight: '90vh', overflowY: 'auto', padding: 28, position: 'relative',
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--text)', fontSize: 14 }}>{value}</span>
    </div>
  )
}

function ScoreBar({ label, value, max = 100, color = 'var(--accent)' }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
        <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function Pill({ text, color = 'var(--accent)', bg }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 500, margin: '2px 3px 2px 0',
      background: bg || `${color}22`, color,
      border: `1px solid ${color}44`,
    }}>{text}</span>
  )
}

export default function CandidateDetail({ candidate, onClose }) {
  if (!candidate) return null
  const isShortlisted = candidate.decision === 'Shortlist'

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16,
                background: isShortlisted ? '#22c55e22' : '#ef444422',
                color: isShortlisted ? 'var(--green)' : 'var(--red)',
                border: `2px solid ${isShortlisted ? '#22c55e' : '#ef4444'}`,
              }}>
                {candidate.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{candidate.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{candidate.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: isShortlisted ? '#22c55e22' : '#ef444422',
                color: isShortlisted ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${isShortlisted ? '#22c55e44' : '#ef444444'}`,
              }}>
                {isShortlisted ? '✅ Shortlisted' : '❌ Rejected'}
              </span>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13,
                background: 'var(--accent)22', color: 'var(--accent)', border: '1px solid var(--accent)44' }}>
                Rank #{candidate.rank}
              </span>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13,
                background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                Source: {candidate.source}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 8, color: 'var(--muted)',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* ATS Score big display */}
        <div style={{
          background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '16px 20px',
          marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>ATS SCORE</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: isShortlisted ? 'var(--green)' : 'var(--red)' }}>
              {candidate.ats_score}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>out of 100</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>ML PREDICTION</div>
            <div style={{ fontSize: 18, fontWeight: 700,
              color: candidate.ml_prediction === 'Shortlist' ? 'var(--green)' : 'var(--red)' }}>
              {candidate.ml_prediction}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>({candidate.ml_confidence}% confident)</div>
          </div>
        </div>

        {/* Score breakdown bars */}
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>SCORE BREAKDOWN</div>
          <ScoreBar label="Skill Match (40%)"      value={candidate.skill_match_pct} color="var(--blue)" />
          <ScoreBar label="Experience (25%)"        value={candidate.exp_pct}         color="var(--green)" />
          <ScoreBar label="Keyword Relevance (20%)" value={candidate.keyword_pct}     color="var(--amber)" />
          <ScoreBar label="Similarity (15%)"        value={candidate.similarity_pct}  color="var(--accent)" />
        </div>

        {/* Info rows */}
        <Row label="Years of Experience" value={`${candidate.years_exp} years`} />
        <Row label="Seniority Level"     value={candidate.seniority} />
        <Row label="Skills Found"        value={candidate.skills_count} color="var(--blue)" />

        {/* Skills found */}
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>
            <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--green)' }} />
            MATCHED REQUIRED SKILLS ({candidate.must_matched?.length || 0})
          </div>
          <div>
            {(candidate.must_matched || []).map(s => <Pill key={s} text={s} color="var(--green)" />)}
            {(!candidate.must_matched || candidate.must_matched.length === 0) &&
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>None matched</span>}
          </div>
        </div>

        {/* Missing skills */}
        {candidate.missing_skills?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>
              <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--red)' }} />
              MISSING REQUIRED SKILLS ({candidate.missing_skills.length})
            </div>
            <div>
              {candidate.missing_skills.map(s => <Pill key={s} text={s} color="var(--red)" />)}
            </div>
          </div>
        )}

        {/* All skills */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>
            ALL SKILLS DETECTED ({candidate.skills?.length || 0})
          </div>
          <div>
            {(candidate.skills || []).map(s => <Pill key={s} text={s} color="var(--muted)" />)}
          </div>
        </div>

        {/* Personality */}
        {candidate.personality?.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>
              <Brain size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent)' }} />
              PERSONALITY TRAITS
            </div>
            <div>
              {candidate.personality.map(t => <Pill key={t} text={t} color="var(--accent)" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
