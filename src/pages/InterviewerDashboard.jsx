import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'

export default function InterviewerDashboard() {
  const { data: upcomingInterviews } = useQuery({
    queryKey: ['interviewer-interviews'],
    queryFn: async () => {
      const response = await api.get('/interviews?status=scheduled')
      const data = response.data
      return (data.items || data).slice(0, 5) // Get next 5 interviews
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['interviewer-stats'],
    queryFn: async () => {
      const res = await api.get('/interviews?page_size=200')
      const interviews = res.data.items || res.data || []

      const today = new Date().toDateString()
      const todayInterviews = interviews.filter(
        (i) => new Date(i.scheduled_at).toDateString() === today
      )

      return {
        totalInterviews: interviews.length,
        todayInterviews: todayInterviews.length,
        completedInterviews: interviews.filter((i) => i.status === 'completed').length,
        scheduledInterviews: interviews.filter((i) => i.status === 'scheduled').length,
      }
    },
  })

  const formatDateTime = (dateString) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interviewer Dashboard</h1>
          <p className="text-gray-600 mt-1">Your interview schedule and performance overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Interviews</p>
                <p className="text-3xl font-bold mt-2">{stats?.totalInterviews || 0}</p>
              </div>
              <svg className="w-12 h-12 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Today's Interviews</p>
                <p className="text-3xl font-bold mt-2">{stats?.todayInterviews || 0}</p>
              </div>
              <svg className="w-12 h-12 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Completed</p>
                <p className="text-3xl font-bold mt-2">{stats?.completedInterviews || 0}</p>
              </div>
              <svg className="w-12 h-12 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100">Scheduled</p>
                <p className="text-3xl font-bold mt-2">{stats?.scheduledInterviews || 0}</p>
              </div>
              <svg className="w-12 h-12 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/dashboard/interviews" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">My Interviews</h3>
                <p className="text-sm text-gray-600">View all scheduled interviews</p>
              </div>
            </div>
          </Link>

          <Link to="/dashboard/candidates" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Candidates</h3>
                <p className="text-sm text-gray-600">View candidate profiles</p>
              </div>
            </div>
          </Link>

          <Link to="/dashboard/evaluations" className="card hover:shadow-lg transition-shadow group">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Evaluations</h3>
                <p className="text-sm text-gray-600">Submit pending evaluations</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Upcoming Interviews */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Upcoming Interviews</h2>
            <Link to="/dashboard/interviews" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All →
            </Link>
          </div>

          {upcomingInterviews && upcomingInterviews.length > 0 ? (
            <div className="space-y-4">
              {upcomingInterviews.map((interview) => {
                const { date, time } = formatDateTime(interview.scheduled_at)
                return (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-700 font-semibold">
                          {interview.candidate?.full_name?.charAt(0) || 'C'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {interview.candidate?.full_name || 'Unknown Candidate'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {interview.interview_type?.replace(/_/g, ' ') || 'Interview'} - {date} at {time}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/interview/${interview.room_id || interview.id}`}
                      className="btn btn-primary btn-sm"
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
              <p>No upcoming interviews scheduled</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
