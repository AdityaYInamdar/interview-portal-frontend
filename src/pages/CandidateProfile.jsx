import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'

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

export default function CandidateProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

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
              {candidate.position_applied && (
                <p className="text-gray-500 text-sm mb-2">{candidate.position_applied}</p>
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
          <div className="card overflow-hidden">
            {tests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                No test invitations for this candidate.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Test', 'Invited', 'Status', 'Score', 'Time Taken', ''].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tests.map(({ invitation, test, session }) => {
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

                    return (
                      <tr key={invitation.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{test?.title || 'Unknown Test'}</div>
                          {test?.total_marks != null && (
                            <div className="text-xs text-gray-500">{test.total_marks} marks · {test.duration_minutes} min</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {session?.total_marks_obtained != null ? (
                            <span className="font-semibold text-gray-900">
                              {session.total_marks_obtained}/{session.total_marks} ({session.percentage_score?.toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {timeTaken != null ? `${timeTaken} min` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-medium">
                          {session?.id && (
                            <Link
                              to={`/dashboard/tests/${invitation.test_id}/sessions`}
                              className="text-primary-600 hover:text-primary-800"
                            >
                              View Submission →
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
