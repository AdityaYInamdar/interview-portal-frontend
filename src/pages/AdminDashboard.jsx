import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b']

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalInterviews: 0,
    upcomingInterviews: 0,
    totalCandidates: 0,
    totalInterviewers: 0,
  })

  // Fetch dashboard stats
  const { data: interviews, isLoading: interviewsLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: async () => {
      const response = await api.get('/interviews/')
      return response.data
    },
  })

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: async () => {
      const response = await api.get('/candidates/')
      return response.data
    },
  })

  useEffect(() => {
    if (interviews?.items) {
      const upcoming = interviews.items.filter(
        (interview) => new Date(interview.scheduled_at) > new Date()
      ).length

      setStats((prev) => ({
        ...prev,
        totalInterviews: interviews.items.length,
        upcomingInterviews: upcoming,
      }))
    }

    if (candidates) {
      setStats((prev) => ({
        ...prev,
        totalCandidates: Array.isArray(candidates) ? candidates.length : 0,
      }))
    }
  }, [interviews, candidates])

  // Sample data for charts
  const interviewsByWeek = [
    { name: 'Mon', interviews: 12 },
    { name: 'Tue', interviews: 19 },
    { name: 'Wed', interviews: 15 },
    { name: 'Thu', interviews: 22 },
    { name: 'Fri', interviews: 18 },
    { name: 'Sat', interviews: 8 },
    { name: 'Sun', interviews: 5 },
  ]

  const interviewsByType = [
    { name: 'Technical', value: 45 },
    { name: 'Behavioral', value: 25 },
    { name: 'System Design', value: 20 },
    { name: 'Cultural Fit', value: 10 },
  ]

  const statCards = [
    {
      title: 'Total Interviews',
      value: stats.totalInterviews,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      ),
      color: 'primary',
      link: '/dashboard/interviews',
    },
    {
      title: 'Upcoming',
      value: stats.upcomingInterviews,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
      color: 'green',
      link: '/dashboard/interviews',
    },
    {
      title: 'Total Candidates',
      value: stats.totalCandidates,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      ),
      color: 'purple',
      link: '/dashboard/candidates',
    },
    {
      title: 'Active Interviewers',
      value: stats.totalInterviewers,
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      ),
      color: 'orange',
      link: '/dashboard/interviewers',
    },
  ]

  const upcomingInterviews = interviews?.items
    ?.filter((interview) => new Date(interview.scheduled_at) > new Date())
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 5) || []

  if (interviewsLoading || candidatesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <Link key={index} to={stat.link}>
              <div className={`card hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-${stat.color}-500`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                    <svg className={`w-6 h-6 text-${stat.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {stat.icon}
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interviews by Week */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Interviews This Week</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={interviewsByWeek}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="interviews" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Interviews by Type */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={interviewsByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {interviewsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Interviews */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Interviews</h3>
            <Link to="/dashboard/interviews" className="text-primary-600 hover:text-primary-700 font-medium">
              View All →
            </Link>
          </div>

          {upcomingInterviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No upcoming interviews scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingInterviews.map((interview) => (
                <Link
                  key={interview.id}
                  to={`/dashboard/interviews/${interview.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900">
                          {interview.candidate?.full_name || 'Candidate Name'}
                        </h4>
                        <span className={`badge ${interview.interview_type === 'technical' ? 'badge-primary' : 'badge-secondary'}`}>
                          {interview.interview_type?.replace(/_/g, ' ') || 'Interview'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {interview.candidate?.email || 'email@example.com'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(interview.scheduled_at).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(interview.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/dashboard/interviews/create" className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Schedule Interview</h4>
                <p className="text-sm text-gray-600">Create new interview</p>
              </div>
            </div>
          </Link>

          <Link to="/dashboard/candidates/create" className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Add Candidate</h4>
                <p className="text-sm text-gray-600">Import or create</p>
              </div>
            </div>
          </Link>

          <Link to="/dashboard/analytics" className="card hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">View Analytics</h4>
                <p className="text-sm text-gray-600">Insights & reports</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
