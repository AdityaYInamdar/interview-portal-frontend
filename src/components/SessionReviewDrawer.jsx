import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const LANG_LABEL = { python: 'Python', javascript: 'JavaScript', java: 'Java', cpp: 'C++', sql: 'SQL' }

function StatusBadge({ status }) {
  const map = {
    correct: 'bg-green-100 text-green-800',
    incorrect: 'bg-red-100 text-red-800',
    partial: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || map.pending}`}>
      {status || 'pending'}
    </span>
  )
}

function SubmissionCard({ sub, onGraded }) {
  const [expanded, setExpanded] = useState(false)
  const [grading, setGrading] = useState(false)
  const [marks, setMarks] = useState(sub.marks_obtained ?? '')
  const [feedback, setFeedback] = useState(sub.grader_feedback || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const needsManualGrade = sub.question_type === 'descriptive' && !sub.manually_graded

  async function submitGrade() {
    setSaving(true)
    setError(null)
    try {
      await api.post(`/sessions/admin/submission/${sub.id}/grade`, {
        marks_obtained: parseFloat(marks),
        grader_feedback: feedback,
        grading_notes: '',
      })
      setGrading(false)
      onGraded?.()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save grade')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-indigo-600 shrink-0">
            {sub.question_type?.toUpperCase() || 'Q'}
          </span>
          <span className="text-sm text-gray-800 truncate">{sub.question_text || `Question #${sub.question_id?.slice(-6)}`}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <StatusBadge status={sub.status} />
          <span className="text-xs text-gray-500">
            {sub.marks_obtained != null ? `${sub.marks_obtained}/${sub.max_marks}` : `0/${sub.max_marks}`}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-3 space-y-3 bg-white">
          {/* Answer */}
          {sub.answer_text && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Answer</p>
              <pre className="text-sm bg-gray-50 rounded p-2 whitespace-pre-wrap break-words font-mono max-h-48 overflow-y-auto">
                {sub.answer_text}
              </pre>
            </div>
          )}

          {/* Code answer */}
          {sub.code_answer && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-medium text-gray-500">Code</p>
                {sub.language && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {LANG_LABEL[sub.language] || sub.language}
                  </span>
                )}
              </div>
              <pre className="text-sm bg-gray-900 text-green-300 rounded p-2 whitespace-pre overflow-x-auto max-h-48 font-mono">
                {sub.code_answer}
              </pre>
            </div>
          )}

          {/* Execution result */}
          {(sub.execution_output || sub.execution_error) && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Execution Output</p>
              {sub.execution_error ? (
                <pre className="text-xs bg-red-50 text-red-700 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {sub.execution_error}
                </pre>
              ) : (
                <pre className="text-xs bg-gray-50 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {sub.execution_output}
                </pre>
              )}
              {sub.test_cases_total > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Test cases: {sub.test_cases_passed}/{sub.test_cases_total} passed
                </p>
              )}
            </div>
          )}

          {/* Existing feedback */}
          {sub.grader_feedback && !grading && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Grader Feedback</p>
              <p className="text-sm text-gray-700 italic">{sub.grader_feedback}</p>
            </div>
          )}

          {/* Manual grading area */}
          {needsManualGrade && !grading && (
            <button
              onClick={() => { setGrading(true) }}
              className="text-xs text-indigo-600 hover:underline"
            >
              Grade this answer →
            </button>
          )}
          {grading && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-semibold text-gray-700">Manual Grade</p>
              <div className="flex gap-2">
                <div className="w-28">
                  <label className="text-xs text-gray-500">Marks (max {sub.max_marks})</label>
                  <input
                    type="number"
                    min={0}
                    max={sub.max_marks}
                    step={0.5}
                    value={marks}
                    onChange={e => setMarks(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Feedback (optional)</label>
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={submitGrade}
                  disabled={saving || marks === ''}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Grade'}
                </button>
                <button
                  onClick={() => setGrading(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SessionReviewDrawer({ session, onClose, onUpdate }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState(null)

  const fetchSubmissions = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setFetchError(null)
    try {
      const res = await api.get(`/sessions/admin/session/${session.id}/submissions`)
      setSubmissions(res.data || [])
    } catch (e) {
      setFetchError(e.response?.data?.detail || 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function doReview(finalStatus, comments = '') {
    setActionPending(true)
    setActionError(null)
    try {
      await api.post(`/sessions/admin/session/${session.id}/review`, {
        final_status: finalStatus,
        admin_comments: comments,
      })
      onUpdate?.()
      onClose()
    } catch (e) {
      setActionError(e.response?.data?.detail || 'Action failed')
    } finally {
      setActionPending(false)
    }
  }

  if (!session) return null

  const totalMarks = submissions.reduce((s, x) => s + (x.max_marks || 0), 0)
  const earnedMarks = submissions.reduce((s, x) => s + (x.marks_obtained || 0), 0)
  const scorePercent = session.percentage_score != null
    ? Math.round(session.percentage_score)
    : totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : null
  const earnedDisplay = session.total_marks_obtained != null ? Math.round(session.total_marks_obtained) : earnedMarks
  const totalDisplay = session.total_marks || totalMarks
  const timeMins = session.started_at && session.ended_at
    ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 1000 / 60)
    : null
  const candidate = session.candidate || {}
  const name = candidate.full_name || session.candidate_name || session.candidate_email?.split('@')[0] || 'Unknown'
  const email = session.candidate_email || candidate.email || '—'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full md:w-3/5 xl:w-1/2 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">{name}</h2>
              {session.final_status === 'approved' && (
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Approved</span>
              )}
              {session.final_status === 'rejected' && (
                <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">Rejected</span>
              )}
              {!session.final_status && session.is_completed && (
                <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2 py-0.5 rounded-full">Pending Review</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50 border-b border-gray-200 shrink-0 flex-wrap">
          {scorePercent != null && (
            <div>
              <p className="text-xs text-gray-400">Score</p>
              <p className="text-sm font-semibold text-gray-800">{earnedDisplay}/{totalDisplay} ({scorePercent}%)</p>
            </div>
          )}
          {timeMins != null && (
            <div>
              <p className="text-xs text-gray-400">Time</p>
              <p className="text-sm font-semibold text-gray-800">{timeMins} min</p>
            </div>
          )}
          {(session.tab_switches != null || session.tab_switch_count != null) && (
            <div>
              <p className="text-xs text-gray-400">Tab Switches</p>
              {(() => { const c = session.tab_switches ?? session.tab_switch_count; return (
                <p className={`text-sm font-semibold ${c > 3 ? 'text-red-600' : 'text-gray-800'}`}>{c}</p>
              )})()}
            </div>
          )}
          {session.admin_comments && (
            <div className="ml-auto">
              <p className="text-xs text-gray-400">Admin Comment</p>
              <p className="text-xs text-gray-600 italic">{session.admin_comments}</p>
            </div>
          )}
        </div>

        {/* Submissions list (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : fetchError ? (
            <div className="text-center py-10">
              <p className="text-red-600 text-sm">{fetchError}</p>
              <button onClick={fetchSubmissions} className="mt-2 text-indigo-600 text-sm hover:underline">Retry</button>
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-10">No submissions recorded.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map(sub => (
                <SubmissionCard key={sub.id} sub={sub} onGraded={fetchSubmissions} />
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 p-4 shrink-0">
          {actionError && <p className="text-red-600 text-xs mb-2">{actionError}</p>}

          {showRejectInput ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                placeholder="Reason for rejection (optional)"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => doReview('rejected', rejectReason)}
                  disabled={actionPending}
                  className="flex-1 bg-red-600 text-white text-sm font-medium py-2 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {actionPending ? 'Rejecting…' : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="px-4 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {session.final_status !== 'approved' && (
                <button
                  onClick={() => doReview('approved', '')}
                  disabled={actionPending}
                  className="flex-1 bg-green-600 text-white text-sm font-medium py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {actionPending ? '…' : '✓ Approve'}
                </button>
              )}
              {session.final_status !== 'rejected' && (
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={actionPending}
                  className="flex-1 bg-red-50 border border-red-300 text-red-700 text-sm font-medium py-2 rounded hover:bg-red-100 disabled:opacity-50"
                >
                  ✗ Reject
                </button>
              )}
              {session.final_status && (
                <button
                  onClick={() => doReview('pending', '')}
                  disabled={actionPending}
                  className="px-4 bg-gray-100 text-gray-700 text-sm font-medium py-2 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  Re-review
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
