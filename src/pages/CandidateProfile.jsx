import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
}

const CANDIDATE_STATUS_COLORS = {
  applied: 'bg-blue-100 text-blue-800',
  screening: 'bg-yellow-100 text-yellow-800',
  interviewing: 'bg-purple-100 text-purple-800',
  offered: 'bg-indigo-100 text-indigo-800',
  hired: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
}

const TABS = ['overview', 'interviews', 'tests']

// ── Inline submission viewer reused inside the Tests tab ──────────────
function SubmissionCard({ submission }) {
  const q = submission.question || {}
  return (
    <div className="border rounded-lg p-4 bg-white">
      {/* Question header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 text-sm">{q.title || '(Question not found)'}</span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded capitalize">{submission.question_type}</span>
            {q.difficulty && (
              <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                q.difficulty === 'easy' ? 'bg-green-100 text-green-700'
                  : q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>{q.difficulty}</span>
            )}
          </div>
          {q.description && <p className="text-xs text-gray-500 whitespace-pre-wrap">{q.description}</p>}
        </div>
        <div className="ml-4 text-right shrink-0">
          <div className="text-base font-bold text-primary-600">
            {submission.marks_obtained} / {submission.max_marks}
          </div>
          {submission.auto_graded && <div className="text-xs text-gray-400">Auto-graded</div>}
          {submission.manually_graded && <div className="text-xs text-blue-500">Manually graded</div>}
          <div className={`text-xs mt-0.5 font-medium ${
            submission.status === 'graded' ? 'text-green-600'
              : submission.status === 'error' ? 'text-red-600'
              : submission.status === 'pending' ? 'text-yellow-600'
              : 'text-gray-500'
          }`}>{submission.status}</div>
        </div>
      </div>

      {/* Candidate answer */}
      {submission.code_answer && (
        <details className="mb-2">
          <summary className="text-xs font-semibold text-gray-600 cursor-pointer select-none">Candidate's Code</summary>
          <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto mt-1">{submission.code_answer}</pre>
        </details>
      )}
      {submission.text_answer && (
        <div className="mb-2">
          <div className="text-xs font-semibold text-gray-600 mb-1">Candidate's Answer:</div>
          <div className="bg-gray-50 p-2 rounded text-xs text-gray-900 whitespace-pre-wrap">{submission.text_answer}</div>
        </div>
      )}
      {submission.mcq_selected_options?.length > 0 && (
        <div className="mb-2 text-xs text-gray-700">
          <span className="font-semibold">Selected: </span>{submission.mcq_selected_options.join(', ')}
        </div>
      )}

      {/* MCQ options with correct answers */}
      {submission.question_type === 'mcq' && q.mcq_options && (
        <div className="mb-2">
          <ul className="space-y-1">
            {q.mcq_options.map(opt => (
              <li key={opt.id} className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${
                opt.is_correct ? 'bg-green-50 text-green-800 border border-green-200' : 'text-gray-700'
              }`}>
                <span>{opt.text}</span>
                {opt.is_correct && <span className="text-green-600 font-semibold ml-auto">✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ideal answer for descriptive */}
      {submission.question_type === 'descriptive' && q.ideal_answer && (
        <details className="mb-2">
          <summary className="text-xs font-semibold text-blue-700 cursor-pointer select-none">Ideal Answer / Rubric</summary>
          <div className="bg-blue-50 border border-blue-100 p-2 rounded text-xs text-blue-900 whitespace-pre-wrap mt-1">{q.ideal_answer}</div>
        </details>
      )}

      {/* Execution output */}
      {submission.execution_output && (
        <details className="mb-2">
          <summary className="text-xs font-semibold text-gray-600 cursor-pointer select-none">Execution Output</summary>
          <pre className="bg-green-50 border border-green-200 text-green-900 p-2 rounded text-xs overflow-x-auto mt-1">{submission.execution_output}</pre>
        </details>
      )}
      {submission.execution_error && (
        <div className="mb-2">
          <div className="text-xs font-semibold text-red-600 mb-0.5">Execution Error</div>
          <pre className="bg-red-50 border border-red-200 text-red-900 p-2 rounded text-xs overflow-x-auto">{submission.execution_error}</pre>
        </div>
      )}

      {/* Test cases */}
      {submission.test_cases_total > 0 && (
        <div className="text-xs mt-1">
          <span className={`font-semibold ${submission.test_cases_passed === submission.test_cases_total ? 'text-green-600' : 'text-orange-600'}`}>
            Test Cases: {submission.test_cases_passed} / {submission.test_cases_total} passed
          </span>
        </div>
      )}

      {/* Grader feedback */}
      {submission.grader_feedback && (
        <div className="mt-2 bg-blue-50 border border-blue-100 p-2 rounded text-xs text-blue-900">
          <span className="font-semibold">Feedback: </span>{submission.grader_feedback}
        </div>
      )}
    </div>
  )
}

export default function CandidateProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  // Tracks which session is expanded in the Tests tab (shows inline submissions)
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  // Cache: sessionId → submissions array
  const [sessionSubmissions, setSessionSubmissions] = useState({})
  const [loadingSessionId, setLoadingSessionId] = useState(null)
  // Manual grade modal
  const [gradingModal, setGradingModal] = useState(null)
  const [gradingData, setGradingData] = useState({ marks_obtained: 0, grader_feedback: '' })
  // Approve / reject session modals
  const [rejectModal, setRejectModal] = useState(null) // sessionId awaiting rejection
  const [rejectReason, setRejectReason] = useState('')

  // Candidate details
  const { data: candidate, isLoading: loadingCandidate } = useQuery({
    queryKey: ['candidate', id],
    queryFn: async () => {
      const res = await api.get(`/candidates/${id}`)
      return res.data
    },
  })

  // Interview history
  const { data: interviewsData } = useQuery({
    queryKey: ['candidate-interviews', id],
    enabled: !!candidate,
    queryFn: async () => {
      const res = await api.get(`/interviews?candidate_id=${id}&page_size=50`)
      return res.data?.items || res.data || []
    },
  })

  // Test history (requires candidate email)
  const { data: testHistory } = useQuery({
    queryKey: ['candidate-tests', candidate?.email],
    enabled: !!candidate?.email,
    queryFn: async () => {
      const res = await api.get(`/sessions/admin/candidate-history?email=${encodeURIComponent(candidate.email)}`)
      return res.data || []
    },
  })

  const interviews = interviewsData || []
  const tests = testHistory || []

  const completedInterviews = interviews.filter(i => i.status === 'completed').length
  const scheduledInterviews = interviews.filter(i => i.status === 'scheduled').length
  const testsCompleted = tests.filter(t => t.session?.status === 'completed').length
  const avgScore = (() => {
    const scored = tests.filter(t => t.session?.percentage_score != null)
    if (!scored.length) return null
    return Math.round(scored.reduce((sum, t) => sum + (t.session.percentage_score || 0), 0) / scored.length)
  })()

  // Fetch submissions for a session and toggle inline expansion
  const toggleSessionExpand = async (sessionId) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
      return
    }
    setExpandedSessionId(sessionId)
    if (sessionSubmissions[sessionId]) return // already cached
    setLoadingSessionId(sessionId)
    try {
      const res = await api.get(`/sessions/admin/session/${sessionId}/submissions`)
      setSessionSubmissions(prev => ({ ...prev, [sessionId]: res.data || [] }))
    } catch (err) {
      toast.error('Failed to load submissions')
      setExpandedSessionId(null)
    } finally {
      setLoadingSessionId(null)
    }
  }

  const handleGradeSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/sessions/admin/submission/${gradingModal.id}/grade`, {
        marks_obtained: parseFloat(gradingData.marks_obtained),
        grader_feedback: gradingData.grader_feedback,
      })
      // Bust submissions cache for this session
      setSessionSubmissions(prev => {
        const updated = { ...prev }
        delete updated[gradingModal.session_id]
        return updated
      })
      setGradingModal(null)
      if (expandedSessionId) {
        const res = await api.get(`/sessions/admin/session/${expandedSessionId}/submissions`)
        setSessionSubmissions(prev => ({ ...prev, [expandedSessionId]: res.data || [] }))
      }
      toast.success('Grading saved!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to grade')
    }
  }

  const handleReviewSession = async (sessionId, finalStatus, comments) => {
    try {
      await api.post(`/sessions/admin/session/${sessionId}/review`, {
        final_status: finalStatus,
        admin_comments: comments,
      })
      toast.success(finalStatus === 'approved' ? 'Submission approved.' : 'Submission rejected.')
      // Invalidate test history cache so the status badges update without page reload
      queryClient.invalidateQueries({ queryKey: ['candidate-tests', candidate?.email] })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to review session')
    }
  }

  if (loadingCandidate) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="spinner" />
        </div>
      </DashboardLayout>
    )
  }

  if (!candidate) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold text-gray-700">Candidate not found</h2>
          <button onClick={() => navigate('/dashboard/candidates')} className="btn btn-primary mt-4">Back to Candidates</button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Back button ── */}
        <button onClick={() => navigate('/dashboard/candidates')} className="inline-flex items-center text-gray-500 hover:text-gray-800 text-sm">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Candidates
        </button>

        {/* ── Hero card ── */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-3xl font-bold text-primary-700 shrink-0">
              {candidate.avatar_url
                ? <img src={candidate.avatar_url} alt={candidate.full_name} className="w-20 h-20 rounded-full object-cover" />
                : candidate.full_name?.charAt(0)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{candidate.full_name}</h1>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${CANDIDATE_STATUS_COLORS[candidate.status] || 'bg-gray-100 text-gray-700'}`}>
                  {candidate.status}
                </span>
              </div>
              {(candidate.designation?.title || candidate.position_applied) && (
                <p className="text-gray-500 text-sm mb-2">{candidate.designation?.title || candidate.position_applied}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {candidate.email && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {candidate.phone}
                  </span>
                )}
                {candidate.location && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {candidate.location}
                  </span>
                )}
                {candidate.years_of_experience != null && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {candidate.years_of_experience} yr{candidate.years_of_experience !== 1 ? 's' : ''} experience
                  </span>
                )}
              </div>

              {/* Skills */}
              {candidate.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {candidate.skills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full border border-indigo-100">{skill}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              {candidate.linkedin_url && (
                <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">LinkedIn</a>
              )}
              {candidate.resume_url && (
                <a href={candidate.resume_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Resume</a>
              )}
              <Link to={`/dashboard/interviews/create?candidate_id=${id}`} className="btn btn-primary btn-sm">Schedule Interview</Link>
            </div>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-gray-900">{interviews.length}</p>
            <p className="text-sm text-gray-500 mt-1">Total Interviews</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-blue-600">{scheduledInterviews}</p>
            <p className="text-sm text-gray-500 mt-1">Scheduled</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-green-600">{completedInterviews}</p>
            <p className="text-sm text-gray-500 mt-1">Interviews Done</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-purple-600">{testsCompleted}</p>
            <p className="text-sm text-gray-500 mt-1">Tests Completed</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {tab === 'interviews' && interviews.length > 0 && (
                  <span className="ml-1.5 py-0.5 px-2 bg-gray-100 text-gray-600 text-xs rounded-full">{interviews.length}</span>
                )}
                {tab === 'tests' && tests.length > 0 && (
                  <span className="ml-1.5 py-0.5 px-2 bg-gray-100 text-gray-600 text-xs rounded-full">{tests.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ══ Overview tab ══ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal details */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900 text-lg">Personal Details</h2>
              <dl className="space-y-3">
                {[
                  ['Education', candidate.education],
                  ['Current Company', candidate.current_company],
                  ['Source', candidate.source],
                  ['Application Notes', candidate.application_notes],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
                    <dd className="mt-0.5 text-sm text-gray-800">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* External links */}
              <div className="flex flex-wrap gap-2 pt-2">
                {candidate.github_url && <a href={candidate.github_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">GitHub →</a>}
                {candidate.portfolio_url && <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Portfolio →</a>}
              </div>
            </div>

            {/* Recent activity snapshot */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900 text-lg">Recent Activity</h2>

              {/* Last interview */}
              {interviews.length > 0 ? (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Latest Interview</p>
                  <p className="text-sm font-medium text-gray-900">{interviews[0].title}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(interviews[0].scheduled_at).toLocaleDateString()} ·{' '}
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[interviews[0].status] || 'bg-gray-100 text-gray-700'}`}>{interviews[0].status}</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No interviews yet.</p>
              )}

              {/* Last test */}
              {tests.length > 0 ? (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs font-semibold text-purple-600 uppercase mb-1">Latest Test</p>
                  <p className="text-sm font-medium text-gray-900">{tests[0].test?.title || 'Unknown Test'}</p>
                  {tests[0].session ? (
                    <p className="text-xs text-gray-500">
                      Score: <span className="font-semibold">
                        {tests[0].session.total_marks_obtained != null
                          ? `${tests[0].session.total_marks_obtained}/${tests[0].session.total_marks} (${tests[0].session.percentage_score?.toFixed(1)}%)`
                          : '—'}
                      </span> ·{' '}
                      {tests[0].session.status}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Invited — not yet taken</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No test invitations yet.</p>
              )}

              {/* Average score */}
              {avgScore != null && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs font-semibold text-green-600 uppercase mb-1">Avg Test Score</p>
                  <p className="text-2xl font-bold text-green-700">{avgScore}%</p>
                  <p className="text-xs text-gray-500">across {tests.filter(t => t.session?.percentage_score != null).length} test(s)</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ Interviews tab ══ */}
        {activeTab === 'interviews' && (
          <div className="card overflow-hidden">
            {interviews.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                No interviews scheduled for this candidate.
                <div className="mt-4">
                  <Link to={`/dashboard/interviews/create?candidate_id=${id}`} className="btn btn-primary btn-sm">Schedule First Interview</Link>
                </div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Title / Position', 'Date & Time', 'Type', 'Status', 'Duration', 'Joined?', ''].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {interviews.map(interview => (
                    <tr key={interview.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{interview.title}</div>
                        <div className="text-xs text-gray-500">{interview.position}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(interview.scheduled_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(interview.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800">
                          {interview.interview_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[interview.status] || 'bg-gray-100 text-gray-700'}`}>
                          {interview.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{interview.duration_minutes} min</td>
                      <td className="px-6 py-4 text-sm">
                        {interview.candidate_joined_at ? (
                          <span className="text-green-600 flex items-center gap-1 text-xs">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            {new Date(interview.candidate_joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {interview.room_id && (
                          <Link to={`/interview/${interview.room_id}`} className="text-primary-600 hover:text-primary-800 text-xs font-medium">View Room →</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══ Tests tab ══ */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            {tests.length === 0 ? (
              <div className="card text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                No test invitations for this candidate.
              </div>
            ) : (
              tests.map(({ invitation, test, session }) => {
                const statusLabel = session
                  ? session.status
                  : new Date(invitation.expires_at) < new Date()
                    ? 'expired'
                    : 'pending'
                const statusColor =
                  session?.status === 'completed' ? 'bg-green-100 text-green-800'
                    : session?.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800'
                    : statusLabel === 'expired' ? 'bg-red-100 text-red-800'
                    : 'bg-blue-100 text-blue-800'

                const timeTaken = session?.started_at && session?.ended_at
                  ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000)
                  : null

                const isExpanded = expandedSessionId === session?.id
                const subs = sessionSubmissions[session?.id] || []

                return (
                  <div key={invitation.id} className="card overflow-hidden p-0">
                    {/* Test row */}
                    <div className="flex items-center gap-4 px-5 py-4 bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{test?.title || 'Unknown Test'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor}`}>
                            {statusLabel}
                          </span>
                          {session?.admin_reviewed && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              session.final_status === 'approved' ? 'bg-green-100 text-green-800'
                                : session.final_status === 'rejected' ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}>{session.final_status || 'reviewed'}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-3">
                          {test?.total_marks != null && (
                            <span>{test.total_marks} marks · {test.duration_minutes} min</span>
                          )}
                          <span>Invited {new Date(invitation.created_at).toLocaleDateString()}</span>
                          {timeTaken != null && <span>Time taken: {timeTaken} min</span>}
                        </div>
                      </div>

                      {/* Score */}
                      {session?.total_marks_obtained != null && (
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-primary-700">
                            {session.total_marks_obtained}/{session.total_marks}
                          </div>
                          <div className="text-xs text-gray-500">
                            {session.percentage_score?.toFixed(1)}%
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {session?.id && (
                          <>
                            <button
                              onClick={() => toggleSessionExpand(session.id)}
                              className={`btn btn-sm ${isExpanded ? 'btn-primary' : 'btn-secondary'}`}
                            >
                              {loadingSessionId === session.id ? (
                                <span className="flex items-center gap-1"><div className="spinner-small" />Loading…</span>
                              ) : isExpanded ? 'Hide Submissions ▲' : 'View Submissions ▼'}
                            </button>
                            <Link
                              to={`/dashboard/tests/${invitation.test_id}/sessions/${session.id}/violations`}
                              className="text-xs text-orange-600 hover:text-orange-800 font-medium whitespace-nowrap"
                            >
                              Violations
                            </Link>
                            {/* Approve / Reject — only for completed, unreviewed sessions */}
                            {session.is_completed && !session.admin_reviewed && (
                              <>
                                <button
                                  onClick={() => handleReviewSession(session.id, 'approved', 'Approved from candidate profile')}
                                  className="btn btn-sm text-xs bg-green-600 hover:bg-green-700 text-white border-0"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => { setRejectModal(session.id); setRejectReason('') }}
                                  className="btn btn-sm text-xs bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                                >
                                  ✕ Reject
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inline submissions panel */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-4">
                        {subs.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No submissions found for this session.</p>
                        ) : (
                          subs.map(sub => (
                            <div key={sub.id} className="relative">
                              <SubmissionCard submission={sub} />
                              {/* Manual grade button for any question type */}
                              <button
                                title="Grade / override marks"
                                onClick={() => {
                                  setGradingModal({ ...sub, session_id: session.id })
                                  setGradingData({ marks_obtained: sub.marks_obtained || 0, grader_feedback: sub.grader_feedback || '' })
                                }}
                                className="absolute top-3 right-3 text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Grade
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

      </div>

      {/* ── Manual grade modal ──────────────────────────────────────────── */}
      {gradingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Grade Answer</h2>
              <button onClick={() => setGradingModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-800 mb-1">
                  {gradingModal.question?.title || gradingModal.question_type}
                </p>
                {gradingModal.code_answer && (
                  <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto mb-3">{gradingModal.code_answer}</pre>
                )}
                {gradingModal.text_answer && (
                  <div className="bg-gray-50 p-3 rounded text-sm text-gray-900 whitespace-pre-wrap mb-3">{gradingModal.text_answer}</div>
                )}
              </div>
              <form onSubmit={handleGradeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marks Obtained (Max: {gradingModal.max_marks}) *
                  </label>
                  <input
                    type="number"
                    value={gradingData.marks_obtained}
                    onChange={(e) => setGradingData({ ...gradingData, marks_obtained: e.target.value })}
                    className="input"
                    min="0"
                    max={gradingModal.max_marks}
                    step="0.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
                  <textarea
                    value={gradingData.grader_feedback}
                    onChange={(e) => setGradingData({ ...gradingData, grader_feedback: e.target.value })}
                    className="input"
                    rows={3}
                    placeholder="Feedback for the candidate…"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setGradingModal(null)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Submit Grading</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ── Reject reason modal ──────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Reject Submission</h2>
              <button onClick={() => setRejectModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Enter reason…"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setRejectModal(null)} className="btn btn-secondary">Cancel</button>
                <button
                  onClick={() => {
                    handleReviewSession(rejectModal, 'rejected', rejectReason || 'Rejected by admin')
                    setRejectModal(null)
                  }}
                  className="btn bg-red-600 hover:bg-red-700 text-white border-0"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
