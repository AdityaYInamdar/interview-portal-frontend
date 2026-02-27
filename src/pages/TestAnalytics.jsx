/**
 * TestAnalytics — HR analytics dashboard for a public test.
 *
 * Route: /dashboard/tests/:id/analytics
 *
 * Shows:
 *  - Stat cards: total applicants, submitted, not_started, expired, in_progress
 *  - Average score % + score distribution bar chart
 *  - Threshold settings panel (min score, required count, auto-close)
 *  - "Generate / Copy Public Link" panel
 *  - Shortlist table with per-candidate status control
 *  - "Export CSV" button
 */
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'
import toast from 'react-hot-toast'

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function ScoreBarChart({ distribution, total }) {
  const buckets = ['0-20', '20-40', '40-60', '60-80', '80-100']
  const max = Math.max(...buckets.map(b => distribution[b] || 0), 1)
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500']
  return (
    <div className="space-y-2">
      {buckets.map((bucket, i) => {
        const count = distribution[bucket] || 0
        const pct = total ? Math.round((count / total) * 100) : 0
        const barW = Math.round((count / max) * 100)
        return (
          <div key={bucket} className="flex items-center gap-3 text-sm">
            <span className="w-14 text-xs text-gray-500 shrink-0">{bucket}%</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`${colors[i]} h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                style={{ width: `${barW}%` }}
              >
                {count > 0 && <span className="text-white text-xs font-medium">{count}</span>}
              </div>
            </div>
            <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Threshold settings form ──────────────────────────────────────────────────
function ThresholdSettings({ testId, current, onSaved }) {
  const [form, setForm] = useState({
    min_passing_score_pct: current?.min_passing_score_pct || '',
    required_shortlist_count: current?.required_shortlist_count || '',
    auto_close_on_shortlist: current?.auto_close_on_shortlist || false,
    expiry_hours: current?.expiry_hours || 72,
    max_applicants: current?.max_applicants || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/tests/${testId}/public-settings`, {
        min_passing_score_pct: form.min_passing_score_pct ? parseFloat(form.min_passing_score_pct) : null,
        required_shortlist_count: form.required_shortlist_count ? parseInt(form.required_shortlist_count) : null,
        auto_close_on_shortlist: form.auto_close_on_shortlist,
        expiry_hours: parseInt(form.expiry_hours) || 72,
        max_applicants: form.max_applicants ? parseInt(form.max_applicants) : null,
      })
      toast.success('Settings saved')
      onSaved()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Min Score to Shortlist (%)</label>
          <input
            type="number" min="0" max="100"
            value={form.min_passing_score_pct}
            onChange={e => setForm(f => ({ ...f, min_passing_score_pct: e.target.value }))}
            placeholder="e.g. 70"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Required Shortlist Count</label>
          <input
            type="number" min="1"
            value={form.required_shortlist_count}
            onChange={e => setForm(f => ({ ...f, required_shortlist_count: e.target.value }))}
            placeholder="e.g. 10"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link Expiry (hours)</label>
          <input
            type="number" min="1"
            value={form.expiry_hours}
            onChange={e => setForm(f => ({ ...f, expiry_hours: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Max Applicants</label>
          <input
            type="number" min="1"
            value={form.max_applicants}
            onChange={e => setForm(f => ({ ...f, max_applicants: e.target.value }))}
            placeholder="Unlimited"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.auto_close_on_shortlist}
          onChange={e => setForm(f => ({ ...f, auto_close_on_shortlist: e.target.checked }))}
          className="rounded text-blue-600"
        />
        <span className="text-sm text-gray-700">Auto-close applications once shortlist target is reached</span>
      </label>
      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TestAnalytics() {
  const { id: testId } = useParams()
  const qc = useQueryClient()
  const [publicLinkState, setPublicLinkState] = useState(null) // { public_url, slug }
  const [generatingLink, setGeneratingLink] = useState(false)
  const [scoreFilter, setScoreFilter] = useState({ min: '', max: '' })

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['test-analytics', testId],
    queryFn: () => api.get(`/tests/${testId}/analytics`).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: shortlist = [], refetch: refetchShortlist } = useQuery({
    queryKey: ['test-shortlist', testId],
    queryFn: () => api.get(`/tests/${testId}/shortlist`).then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ candidateId, status }) =>
      api.patch(`/tests/${testId}/shortlist/${candidateId}`, { status }),
    onSuccess: () => {
      refetchShortlist()
      toast.success('Status updated')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to update status'),
  })

  const handleGenerateLink = async () => {
    setGeneratingLink(true)
    try {
      const res = await api.post(`/tests/${testId}/generate-public-link`, {
        expiry_hours: analytics?.thresholds?.expiry_hours || 72,
        min_passing_score_pct: analytics?.thresholds?.min_passing_score_pct,
        required_shortlist_count: analytics?.thresholds?.required_shortlist_count,
        auto_close_on_shortlist: false,
      })
      setPublicLinkState(res.data)
      toast.success('Public link generated!')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate link')
    } finally {
      setGeneratingLink(false)
    }
  }

  const copyLink = () => {
    const url = publicLinkState?.public_url
    if (!url) return
    navigator.clipboard.writeText(url)
    toast.success('Link copied!')
  }

  const exportCSV = () => {
    const token = localStorage.getItem('access_token') || ''
    const base = (import.meta.env.VITE_API_URL || 'https://interview-portal-api-ujuh.onrender.com/api/v1')
    window.open(`${base}/tests/${testId}/export-csv?token=${token}`)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-gray-400">Loading analytics...</div>
      </DashboardLayout>
    )
  }

  if (!analytics) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-red-500">Failed to load analytics.</div>
      </DashboardLayout>
    )
  }

  const { totals, scores, shortlists, thresholds, test } = analytics
  const submittedCount = totals.submitted || 0

  const statusColors = {
    shortlisted: 'bg-blue-100 text-blue-700',
    in_review:   'bg-amber-100 text-amber-700',
    hired:       'bg-green-100 text-green-700',
    rejected:    'bg-red-100 text-red-700',
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link to="/dashboard/tests" className="hover:text-blue-600">Tests</Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{test?.title || 'Test'}</span>
              <span>/</span>
              <span>Analytics</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total Applicants" value={totals.applicants} color="blue" />
          <StatCard label="Submitted" value={totals.submitted} color="green" />
          <StatCard label="Not Started" value={totals.not_started} color="amber" />
          <StatCard label="In Progress" value={totals.in_progress} color="purple" />
          <StatCard label="Expired" value={totals.expired} color="red" />
        </div>

        {/* Score + Public Link row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score distribution */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Score Distribution</h2>
              {scores.average_pct !== null && (
                <span className="text-sm font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                  Avg: {scores.average_pct}%
                </span>
              )}
            </div>
            {submittedCount === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No submissions yet</p>
            ) : (
              <ScoreBarChart distribution={scores.distribution} total={submittedCount} />
            )}
          </div>

          {/* Public link panel */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Public Test Link</h2>
            <p className="text-sm text-gray-500 mb-4">
              Share this link on LinkedIn or job boards. Applicants self-register and receive a unique test link by email.
            </p>
            {publicLinkState ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={publicLinkState.public_url}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-mono truncate"
                  />
                  <button onClick={copyLink} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                    Copy
                  </button>
                </div>
                <button
                  onClick={handleGenerateLink}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Regenerate link
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateLink}
                disabled={generatingLink}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {generatingLink ? 'Generating…' : 'Generate Public Link'}
              </button>
            )}
          </div>
        </div>

        {/* Shortlist stats */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Shortlist Overview</h2>
            {thresholds.required_shortlist_count && (
              <span className="text-sm text-gray-500">
                Target: {shortlists.total} / {thresholds.required_shortlist_count}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(shortlists.by_status || {}).map(([status, count]) => (
              <div key={status} className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>
                {status.replace('_', ' ')}: {count}
              </div>
            ))}
            {Object.keys(shortlists.by_status || {}).length === 0 && (
              <p className="text-sm text-gray-400">No shortlisted candidates yet</p>
            )}
          </div>
        </div>

        {/* Threshold settings */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Threshold & Capacity Settings</h2>
          <ThresholdSettings testId={testId} current={thresholds} onSaved={refetch} />
        </div>

        {/* Shortlist table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Shortlisted Candidates</h2>
          </div>
          {shortlist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No shortlisted candidates</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Candidate</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Auto</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {shortlist.map(sl => (
                  <tr key={sl.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{sl.candidates?.name || sl.candidate_id}</p>
                      <p className="text-xs text-gray-500">{sl.candidates?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {sl.score_percentage != null
                        ? <span className="font-semibold text-gray-900">{sl.score_percentage.toFixed(1)}%</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {sl.auto_shortlisted ? 'Auto' : 'Manual'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[sl.status] || 'bg-gray-100 text-gray-600'}`}>
                        {sl.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{sl.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={sl.status}
                        onChange={e => updateStatus.mutate({ candidateId: sl.candidate_id, status: e.target.value })}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="shortlisted">Shortlisted</option>
                        <option value="in_review">In Review</option>
                        <option value="hired">Hired</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
