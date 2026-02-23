import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import DashboardLayout from '../components/layouts/DashboardLayout'
import CodePlayback from '../components/CodePlayback'

// ── helpers ──────────────────────────────────────────────────────────────────

function dur(startStr, endStr) {
  if (!startStr || !endStr) return '—'
  const secs = Math.round((new Date(endStr) - new Date(startStr)) / 1000)
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60), s = secs % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}
function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function scoreBarColor(pct) {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 40) return 'bg-yellow-400'
  return 'bg-red-500'
}
function evalColor(status) {
  if (status === 'approved') return 'bg-green-100 text-green-800 border-green-200'
  if (status === 'rejected') return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-yellow-100 text-yellow-800 border-yellow-200'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function TestCaseResult({ tc, idx }) {
  const passed = tc.passed || tc.status === 'passed'
  return (
    <div className={`rounded-lg border p-3 text-xs ${passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-700">Case #{idx + 1}</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
          {passed ? 'Passed' : 'Failed'}
        </span>
      </div>
      {tc.input !== undefined && (
        <div className="mb-1">
          <span className="text-gray-500 font-medium">Input: </span>
          <code className="text-gray-800 font-mono">{String(tc.input)}</code>
        </div>
      )}
      {tc.expected !== undefined && (
        <div className="mb-1">
          <span className="text-gray-500 font-medium">Expected: </span>
          <code className="text-gray-800 font-mono">{String(tc.expected)}</code>
        </div>
      )}
      {tc.actual !== undefined && !passed && (
        <div>
          <span className="text-gray-500 font-medium">Got: </span>
          <code className="text-red-800 font-mono">{String(tc.actual)}</code>
        </div>
      )}
    </div>
  )
}

function QuestionCard({ sub, idx, timeMs, sessionId }) {
  const [expanded, setExpanded] = useState(idx === 0)
  const [showPlayback, setShowPlayback] = useState(false)
  const q = sub.question || {}
  const qType = q.question_type || sub.question_type || 'unknown'
  const CODE_TYPES = ['coding', 'sql', 'python', 'javascript', 'java', 'cpp', 'c']
  const isCode = CODE_TYPES.includes(qType)
  const isMCQ  = qType === 'mcq'
  const isDesc = qType === 'descriptive' || qType === 'text'

  const maxMarks = sub.max_marks || q.marks || 0
  const obtained = sub.marks_obtained ?? null
  const pct = maxMarks > 0 && obtained != null ? Math.round((obtained / maxMarks) * 100) : null

  const testCases = sub.test_results || sub.test_cases_raw || []
  const tcPassed = sub.test_cases_passed || 0
  const tcTotal  = sub.test_cases_total || 0

  const timeSecs = timeMs ? Math.round(timeMs / 1000) : null
  const timeLabel = timeSecs
    ? timeSecs < 60 ? `${timeSecs}s` : `${Math.floor(timeSecs / 60)}m ${timeSecs % 60}s`
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          obtained == null ? 'bg-gray-100 text-gray-500' : pct >= 70 ? 'bg-green-100 text-green-700' : pct >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
        }`}>
          {idx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{q.title || q.question_text?.slice(0, 60) || `Question ${idx + 1}`}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400 capitalize">{qType}</span>
            {timeLabel && <span className="text-xs text-gray-400">⏱ {timeLabel}</span>}
            {isCode && tcTotal > 0 && (
              <span className={`text-xs font-medium ${tcPassed === tcTotal ? 'text-green-700' : 'text-orange-700'}`}>
                {tcPassed}/{tcTotal} test cases
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {obtained != null ? (
            <div>
              <span className="text-sm font-bold text-gray-900">{obtained}/{maxMarks}</span>
              {pct != null && (
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1 ml-auto">
                  <div className={`h-full rounded-full ${scoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">—/{maxMarks}</span>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Problem */}
          {(q.question_text || q.description) && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Problem</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.question_text || q.description}</p>
            </div>
          )}

          {/* MCQ */}
          {isMCQ && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Answer</p>
              <div className="space-y-1">
                {(q.options || []).map((opt, i) => {
                  const selected = sub.text_answer === opt || sub.text_answer === String(i)
                  const correct  = q.correct_answer === opt || q.correct_answer === String(i)
                  return (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                      correct ? 'bg-green-50 border-green-200 text-green-800' :
                      selected && !correct ? 'bg-red-50 border-red-200 text-red-800' :
                      'border-gray-100 text-gray-700'
                    }`}>
                      {correct && <span className="text-green-600">✓</span>}
                      {selected && !correct && <span className="text-red-500">✗</span>}
                      {!correct && !selected && <span className="w-4" />}
                      {opt}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Coding answer */}
          {isCode && (sub.code_answer || sub.answer_text) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Code Answer {sub.language && <span className="ml-1 text-indigo-600">({sub.language})</span>}
                </p>
                {sessionId && (
                  <button
                    onClick={() => setShowPlayback(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Code Playback
                  </button>
                )}
              </div>
              <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-80">
                {sub.code_answer || sub.answer_text}
              </pre>
            </div>
          )}

          {/* Code playback modal */}
          {showPlayback && sessionId && (
            <CodePlayback
              sessionId={sessionId}
              questionId={sub.question_id}
              language={sub.language || qType}
              onClose={() => setShowPlayback(false)}
            />
          )}

          {/* Descriptive answer */}
          {isDesc && sub.text_answer && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Answer</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{sub.text_answer}</p>
              {q.ideal_answer && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ideal Answer</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-green-50 rounded-lg p-3">{q.ideal_answer}</p>
                </div>
              )}
            </div>
          )}

          {/* Test cases */}
          {isCode && testCases.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Test Cases — {tcPassed}/{tcTotal} passed
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {testCases.map((tc, i) => <TestCaseResult key={i} tc={tc} idx={i} />)}
              </div>
            </div>
          )}

          {/* Execution output */}
          {sub.execution_output && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Execution Output</p>
              <pre className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto max-h-32">{sub.execution_output}</pre>
            </div>
          )}

          {/* Grader feedback */}
          {sub.grader_feedback && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <span className="font-semibold">Feedback: </span>{sub.grader_feedback}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EvaluationDetail() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  // Grade override form
  const [overrideScore, setOverrideScore] = useState('')
  const [overrideComment, setOverrideComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionMsg, setActionMsg]   = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await api.get(`/sessions/admin/session/${sessionId}/detail`)
      setSession(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load session')
    } finally { setLoading(false) }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  const doAction = async (status) => {
    try {
      setSubmitting(true); setActionMsg(null)
      await api.patch(`/sessions/admin/session/${sessionId}/grade-override`, {
        final_status: status,
        ...(overrideComment ? { admin_comments: overrideComment } : {}),
      })
      setActionMsg({ type: 'success', text: `Candidate ${status === 'approved' ? 'Approved' : 'Rejected'} successfully.` })
      load()
    } catch (err) {
      setActionMsg({ type: 'error', text: err?.response?.data?.detail || 'Action failed' })
    } finally { setSubmitting(false) }
  }

  const doScoreOverride = async () => {
    if (overrideScore === '') return
    try {
      setSubmitting(true); setActionMsg(null)
      const score = parseFloat(overrideScore)
      await api.patch(`/sessions/admin/session/${sessionId}/grade-override`, {
        total_marks_obtained: score,
        ...(session?.total_marks ? { percentage_score: Math.round((score / session.total_marks) * 100) } : {}),
        admin_reviewed: true,
        ...(overrideComment ? { admin_comments: overrideComment } : {}),
      })
      setActionMsg({ type: 'success', text: 'Score updated.' })
      setOverrideScore('')
      load()
    } catch (err) {
      setActionMsg({ type: 'error', text: err?.response?.data?.detail || 'Update failed' })
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }
  if (error) {
    return (
      <DashboardLayout>
        <div className="text-red-500 text-sm p-6">{error}</div>
      </DashboardLayout>
    )
  }
  if (!session) return null

  const cand          = session.candidate || {}
  const name          = session.candidate_name || cand.full_name || '—'
  const email         = session.candidate_email || cand.email || '—'
  const phone         = cand.phone || '—'
  const totalObtained = session.total_marks_obtained ?? null
  const totalMax      = session.total_marks ?? 0
  const pct           = totalMax > 0 && totalObtained != null ? Math.round((totalObtained / totalMax) * 100) : null
  const evalStatus    = session.final_status
  const submissions   = session.submissions || []
  const timeMap       = session.question_time_map || {}
  const test          = session.test || {}

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard/evaluations')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Evaluations
        </button>

        {/* Candidate header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-indigo-700">{(name[0] || '?').toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{name}</h1>
                <p className="text-sm text-gray-500">{email}</p>
                <div className="flex gap-3 mt-1 flex-wrap">
                  {phone !== '—' && <span className="text-xs text-gray-400">📞 {phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${evalColor(evalStatus)}`}>
                {evalStatus === 'approved' ? '✓ Approved' : evalStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending Review'}
              </span>
            </div>
          </div>

          {/* Test info */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Test</p>
            <p className="text-sm font-semibold text-gray-800">{test.title || '—'}</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InfoCard
            label="Score"
            value={pct != null ? `${pct}%` : '—'}
            sub={totalObtained != null ? `${totalObtained} / ${totalMax} marks` : undefined}
          />
          <InfoCard
            label="Duration"
            value={dur(session.started_at, session.ended_at)}
            sub={session.started_at ? `Started ${fmt(session.started_at)}` : undefined}
          />
          <InfoCard
            label="Submitted"
            value={session.ended_at ? new Date(session.ended_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            sub={session.ended_at ? new Date(session.ended_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined}
          />
          <InfoCard
            label="Tab Switches"
            value={session.tab_switches ?? '0'}
            sub={session.ip_country ? `IP: ${session.ip_country}` : undefined}
          />
        </div>

        {/* Score bar */}
        {pct != null && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Overall Score</p>
              <p className="text-sm font-bold text-gray-900">{pct}%</p>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${scoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Action panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Evaluation Decision</h2>

          {actionMsg && (
            <div className={`mb-3 p-3 rounded-lg text-sm ${actionMsg.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {actionMsg.text}
            </div>
          )}

          <div className="space-y-3">
            <textarea
              placeholder="Add a comment (optional)…"
              value={overrideComment}
              onChange={e => setOverrideComment(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <button
                disabled={submitting}
                onClick={() => doAction('approved')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
              <button
                disabled={submitting}
                onClick={() => doAction('rejected')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </button>

              <div className="flex-1" />

              {/* Manual score override */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={`Override score (max ${totalMax})`}
                  value={overrideScore}
                  onChange={e => setOverrideScore(e.target.value)}
                  min={0}
                  max={totalMax || undefined}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-44 focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <button
                  disabled={submitting || overrideScore === ''}
                  onClick={doScoreOverride}
                  className="px-3 py-2 text-sm font-medium text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                >
                  Set Score
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Question breakdown — {submissions.length} question{submissions.length !== 1 ? 's' : ''}
          </h2>
          <div className="space-y-3">
            {submissions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                No submissions found for this session.
              </div>
            ) : (
              submissions.map((sub, idx) => (
                <QuestionCard
                  key={sub.id || idx}
                  sub={sub}
                  idx={idx}
                  timeMs={timeMap[sub.question_id]}
                  sessionId={sessionId}
                />
              ))
            )}
          </div>
        </div>
      </div>

    </DashboardLayout>
  )
}
