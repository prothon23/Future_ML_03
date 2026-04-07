// src/components/Dashboard.jsx
import React from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const S = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px' },
  cardLabel: { fontSize: 12, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' },
  cardVal: { fontSize: 32, fontWeight: 700 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 },
  chartBox: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 },
  chartTitle: { fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--muted)' },
}

const PIE_COLORS = ['#22c55e', '#ef4444']

function StatCard({ label, value, color }) {
  return (
    <div style={S.card}>
      <div style={S.cardLabel}>{label}</div>
      <div style={{ ...S.cardVal, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

export default function Dashboard({ results }) {
  if (!results) return null
  const { summary, candidates } = results

  // Bar chart data — top 12
  const barData = (candidates || []).slice(0, 12).map(c => ({
    name  : c.name.split(' ')[0],
    score : c.ats_score,
    fill  : c.decision === 'Shortlist' ? '#6c63ff' : '#ef4444',
  }))

  // Pie data
  const pieData = [
    { name: 'Shortlisted', value: summary.shortlisted },
    { name: 'Rejected',    value: summary.rejected    },
  ]

  // Score distribution buckets
  const buckets = { '0–25': 0, '26–50': 0, '51–75': 0, '76–100': 0 }
  ;(candidates || []).forEach(c => {
    if (c.ats_score <= 25)                        buckets['0–25']++
    else if (c.ats_score <= 50)                   buckets['26–50']++
    else if (c.ats_score <= 75)                   buckets['51–75']++
    else                                          buckets['76–100']++
  })
  const distData = Object.entries(buckets).map(([name, count]) => ({ name, count }))

  return (
    <div>
      {/* KPI cards */}
      <div style={S.grid}>
        <StatCard label="Total Applied"      value={summary.total}          />
        <StatCard label="Shortlisted"         value={summary.shortlisted}    color="var(--green)" />
        <StatCard label="Rejected"            value={summary.rejected}       color="var(--red)" />
        <StatCard label="Selection Rate"      value={`${summary.selection_pct}%`} color="var(--accent)" />
        <StatCard label="Rejection Rate"      value={`${summary.rejection_pct}%`} color="var(--amber)" />
        <StatCard label="Avg ATS Score"       value={`${summary.avg_ats_score}`}  />
        <StatCard label="Top Score"           value={`${summary.top_score}`}       />
        <StatCard label="Best ML Model"       value={summary.best_model.split(' ')[0]} />
      </div>

      {/* Charts row */}
      <div style={S.row}>
        {/* Pie chart */}
        <div style={S.chartBox}>
          <div style={S.chartTitle}>Selection vs Rejection</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80}
                   dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                   labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => [v, 'Candidates']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution */}
        <div style={S.chartBox}>
          <div style={S.chartTitle}>Score Distribution</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text)' }}
              />
              <Bar dataKey="count" name="Candidates" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ATS score bar chart */}
      <div style={S.chartBox}>
        <div style={S.chartTitle}>ATS Scores — All Candidates (top 12)</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}>
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8 }}
              formatter={(v) => [`${v}`, 'ATS Score']}
            />
            {barData.map((entry, i) => (
              <Bar key={i} dataKey="score" fill={entry.fill} radius={[4, 4, 0, 0]} />
            ))}
            <Bar dataKey="score" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
