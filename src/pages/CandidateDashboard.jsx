import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function CandidateDashboard() {
  const { user } = useAuthStore()

  const { data: candidateProfile } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: async () => {
      // In a real app, you'd fetch the candidate by user_id
      const response = await api.get('/candidates')
      const data = Array.isArray(response.data) ? response.data : []
      return data.find((c) => c.email === user?.email) || null
    },
  })

  const { data: myInterviews } = useQuery({
    queryKey: ['my-interviews', candidateProfile?.id],
    queryFn: async () => {
      if (!candidateProfile?.id) return []
      const response = await api.get(`/candidates/${candidateProfile.id}/interviews`)
      return Array.isArray(response.data) ? response.data : []
    },
    enabled: !!candidateProfile?.id,
  })

  const { data: evaluations } = useQuery({
    queryKey: ['my-evaluations'],
    queryFn: async () => {
      if (!myInterviews) return []
      const evaluationPromises = myInterviews
        .filter((i) => i.status === 'completed')
        .map((i) => api.get(`/evaluations?interview_id=${i.id}`).catch(() => ({ data: [] })))
      const results = await Promise.all(evaluationPromises)
      return results.flatMap((r) => Array.isArray(r.data) ? r.data : [])
    },
    enabled: !!myInterviews && myInterviews.length > 0,
  })

  const upcomingInterviews = myInterviews?.filter((i) => i.status === 'scheduled') || []
  const completedInterviews = myInterviews?.filter((i) => i.status === 'completed') || []

  const formatDateTime = (dateString) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isPast: date < new Date(),
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {candidateProfile?.full_name || user?.full_name || 'Candidate'}!
          </h1>
          <p className="text-gray-600 mt-1">Track your interview schedule and progress</p>
        </div>

        {/* Profile Status Card */}
        {candidateProfile && (
          <div className="card bg-gradient-to-r from-primary-500 to-primary-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                  {candidateProfile.avatar_url ? (
                    <img
                      src={candidateProfile.avatar_url}
                      alt={candidateProfile.full_name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-primary-700 font-bold text-2xl">
                      {candidateProfile.full_name?.charAt(0) || 'C'}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{candidateProfile.full_name}</h2>
                  <p className="text-primary-100">{candidateProfile.email}</p>
                  {candidateProfile.current_position && (
                    <p className="text-primary-100 mt-1">
                      {candidateProfile.current_position}
                      {candidateProfile.current_company && ` at ${candidateProfile.current_company}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-primary-100 text-sm">Status</div>
                <div className="text-2xl font-bold capitalize">{candidateProfile.status || 'Active'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 font-medium">Total Interviews</p>
                <p className="text-3xl font-bold text-blue-700 mt-2">{myInterviews?.length || 0}</p>
              </div>
              <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 font-medium">Upcoming</p>
                <p className="text-3xl font-bold text-green-700 mt-2">{upcomingInterviews.length}</p>
              </div>
              <svg className="w-12 h-12 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 font-medium">Completed</p>
                <p className="text-3xl font-bold text-purple-700 mt-2">{completedInterviews.length}</p>
              </div>
              <svg className="w-12 h-12 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Upcoming Interviews */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Upcoming Interviews</h2>
          {upcomingInterviews.length > 0 ? (
            <div className="space-y-4">
              {upcomingInterviews.map((interview) => {
                const { date, time, isPast } = formatDateTime(interview.scheduled_at)
                return (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(interview.status)}`}>
                          {interview.status?.replace(/_/g, ' ') || 'Unknown'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {interview.interview_type?.replace(/_/g, ' ') || 'Interview'}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">{date} at {time}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Duration: {interview.duration_minutes} minutes
                      </div>
                    </div>
                    <Link
                      to={`/interview/${interview.id}`}
                      className="btn btn-primary"
                    >
                      Join Interview
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No upcoming interviews</p>
            </div>
          )}
        </div>

        {/* Interview History */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Interview History</h2>
          {completedInterviews.length > 0 ? (
            <div className="space-y-4">
              {completedInterviews.map((interview) => {
                const { date, time } = formatDateTime(interview.scheduled_at)
                const evaluation = evaluations?.find((e) => e.interview_id === interview.id)
                
                return (
                  <div
                    key={interview.id}
                    className="p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Completed
                          </span>
                          <span className="text-sm text-gray-500">
                            {interview.interview_type?.replace(/_/g, ' ') || 'Interview'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">
                          {date} at {time}
                        </div>
                        {evaluation && (
                          <div className="mt-2 flex items-center space-x-4">
                            <div className="text-sm">
                              <span className="text-gray-600">Overall Rating:</span>
                              <span className="ml-2 font-semibold text-primary-600">
                                {evaluation.overall_rating}/10
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-600">Recommendation:</span>
                              <span className="ml-2 font-semibold capitalize">
                                {evaluation.recommendation.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No completed interviews yet</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
