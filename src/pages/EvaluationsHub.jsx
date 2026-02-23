import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import DashboardLayout from '../components/layouts/DashboardLayout'

// ── EvaluationsHub — flat table view ────────────────────────────────────────

function evalStatusColor(finalStatus, adminReviewed) {
  if (finalStatus === 'approved') return 'bg-green-100 text-green-800'
  if (finalStatus === 'rejected') return 'bg-red-100 text-red-700'
  if (adminReviewed) return 'bg-blue-100 text-blue-800'
  return 'bg-yellow-100 text-yellow-800'
}
function evalStatusLabel(finalStatus, adminReviewed) {
  if (finalStatus === 'approved') return 'Approved'
  if (finalStatus === 'rejected') return 'Rejected'
  if (adminReviewed) return 'Reviewed'
  return 'Pending'
}
function testStatusColor(isCompleted) {
  return isCompleted ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'
}
function duration(session) {
  if (!session.started_at || !session.ended_at) return '—'
  const secs = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 1000)
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60), s = secs % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}
function scoreLabel(session) {
  if (session.total_marks_obtained == null || !session.total_marks) return '—'
  const pct = Math.round((session.total_marks_obtained / session.total_marks) * 100)
  return `${session.total_marks_obtained}/${session.total_marks} (${pct}%)`
}
function scoreBarColor(session) {
  if (session.total_marks_obtained == null || !session.total_marks) return 'bg-gray-200'
  const pct = (session.total_marks_obtained / session.total_marks) * 100
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 40) return 'bg-yellow-400'
  return 'bg-red-500'
}
function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const FILTERS = [
  { key: 'all',      label: 'All',      color: 'gray' },
  { key: 'pending',  label: 'Pending',  color: 'yellow' },
  { key: 'approved', label: 'Approved', color: 'green' },
  { key: 'rejected', label: 'Rejected', color: 'red' },
]
const palette = {
  gray:   { active: 'bg-gray-700 text-white',    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  yellow: { active: 'bg-yellow-500 text-white',  inactive: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
  green:  { active: 'bg-green-600 text-white',   inactive: 'bg-green-100 text-green-800 hover:bg-green-200' },
  red:    { active: 'bg-red-600 text-white',     inactive: 'bg-red-100 text-red-700 hover:bg-red-200' },
}

export default function EvaluationsHub() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const filterParam = searchParams.get('filter') || 'all'
  const searchParam = searchParams.get('q') || ''
  const testParam   = searchParams.get('test') || ''

  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [tests, setTests]       = useState([])
  const [counts, setCounts]     = useState({ all: 0, pending: 0, approved: 0, rejected: 0 })
  const [sortBy, setSortBy]     = useState('ended_at')
  const [sortDir, setSortDir]   = useState('desc')

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams()
      if (filterParam && filterParam !== 'all') params.append('review_filter', filterParam)
      if (testParam)   params.append('test_id', testParam)
      if (searchParam) params.append('search', searchParam)
      const res = await api.get(`/sessions/admin/evaluations?${params.toString()}`)
      setSessions(res.data || [])
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load evaluations')
    } finally { setLoading(false) }
  }, [filterParam, searchParam, testParam])

  const loadCounts = useCallback(async () => {
    try {
      const res = await api.get('/sessions/admin/evaluation-counts')
      const d = res.data || {}
      setCounts({ all: d.total || 0, pending: d.pending || 0, approved: d.approved || 0, rejected: d.rejected || 0 })
    } catch (_) {}
  }, [])

  const loadTests = useCallback(async () => {
    try {
      const res = await api.get('/tests/')
      setTests(res.data || [])
    } catch (_) {}
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadCounts(); loadTests() }, [loadCounts, loadTests])

  const setFilter = (f) => {
    const p = new URLSearchParams(searchParams)
    if (f === 'all') p.delete('filter'); else p.set('filter', f)
    setSearchParams(p)
  }
  const setSearch = (v) => {
    const p = new URLSearchParams(searchParams)
    if (v) p.set('q', v); else p.delete('q')
    setSearchParams(p)
  }
  const setTestFilter = (v) => {
    const p = new URLSearchParams(searchParams)
    if (v) p.set('test', v); else p.delete('test')
    setSearchParams(p)
  }
  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const sorted = [...sessions].sort((a, b) => {
    let av, bv
    if (sortBy === 'candidate') {
      av = (a.candidate_name || a.candidate_email || '').toLowerCase()
      bv = (b.candidate_name || b.candidate_email || '').toLowerCase()
    } else if (sortBy === 'score') {
      av = a.total_marks_obtained ?? -1
      bv = b.total_marks_obtained ?? -1
    } else if (sortBy === 'ended_at') {
      av = new Date(a.ended_at || 0); bv = new Date(b.ended_at || 0)
    } else { av = a[sortBy] ?? ''; bv = b[sortBy] ?? '' }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ col }) => sortBy !== col
    ? <span className="ml-1 text-gray-300">↕</span>
    : <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evaluations</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review candidate test submissions</p>
          </div>
          <button
            onClick={() => { loadData(); loadCounts() }}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(f => {
              const active = filterParam === f.key
              const c = palette[f.color]
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${active ? c.active : c.inactive}`}>
                  {f.label}<span className="ml-1.5 opacity-80">· {counts[f.key]}</span>
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <select value={testParam} onChange={e => setTestFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-400 outline-none min-w-[160px]">
            <option value="">All Tests</option>
            {tests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search candidate or test…" value={searchParam}
              onChange={e => setSearch(e.target.value)}
              className="text-sm pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 outline-none w-56" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48 text-red-500 text-sm">{error}</div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <svg className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">No evaluations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort('candidate')}>
                      Candidate <SortIcon col="candidate" />
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Test</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort('score')}>
                      Score <SortIcon col="score" />
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Test Status</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Eval Status</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort('ended_at')}>
                      Submitted <SortIcon col="ended_at" />
                    </th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map(session => {
                    const name  = session.candidate_name || session.candidate?.full_name || '—'
                    const email = session.candidate_email || '—'
                    const pct   = session.total_marks && session.total_marks_obtained != null
                      ? Math.round((session.total_marks_obtained / session.total_marks) * 100) : null
                    return (
                      <tr key={session.id}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                        onClick={() => navigate(`/dashboard/evaluations/${session.id}`)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-indigo-700">{(name[0] || '?').toUpperCase()}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{name}</p>
                              <p className="text-xs text-gray-500 truncate">{email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700 max-w-[180px]">
                          <p className="truncate">{session.test_title || '—'}</p>
                        </td>
                        <td className="py-3 px-4">
                          {pct !== null ? (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-gray-800">{scoreLabel(session)}</p>
                              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${scoreBarColor(session)}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${testStatusColor(session.is_completed)}`}>
                            {session.is_completed ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${evalStatusColor(session.final_status, session.admin_reviewed)}`}>
                            {evalStatusLabel(session.final_status, session.admin_reviewed)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">{duration(session)}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{fmt(session.ended_at)}</td>
                        <td className="py-3 px-4">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && !error && (
          <p className="text-xs text-gray-400 text-right">{sorted.length} result{sorted.length !== 1 ? 's' : ''}</p>
        )}
      </div>
    </DashboardLayout>
  )
}

