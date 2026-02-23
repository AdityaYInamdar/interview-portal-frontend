import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'
import toast from 'react-hot-toast'
import ConfirmModal from '../components/ConfirmModal'

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

const TYPE_COLORS = {
  phone_screen: 'bg-blue-100 text-blue-800',
  technical: 'bg-purple-100 text-purple-800',
  behavioral: 'bg-yellow-100 text-yellow-800',
  system_design: 'bg-indigo-100 text-indigo-800',
  hr: 'bg-green-100 text-green-800',
  final: 'bg-red-100 text-red-800',
  mixed: 'bg-pink-100 text-pink-800',
}

export default function InterviewList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = {
    status: searchParams.get('status') || '',
    interview_type: searchParams.get('type') || '',
  }
  const setFilters = (next) => setSearchParams(prev => {
    const n = new URLSearchParams(prev)
    next.status ? n.set('status', next.status) : n.delete('status')
    next.interview_type ? n.set('type', next.interview_type) : n.delete('type')
    return n
  })
  const queryClient = useQueryClient()
  const [confirmDialog, setConfirmDialog] = useState(null)

  const { data: interviews, isLoading } = useQuery({
    queryKey: ['interviews', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.interview_type) params.append('interview_type', filters.interview_type)
      params.append('page_size', '200')
      
      const response = await api.get(`/interviews?${params}`)
      return response.data.items || response.data
    },
  })

  const handleDelete = (id) => {
    setConfirmDialog({
      title: 'Delete Interview',
      message: 'This will permanently delete the interview and all associated data. This action cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.delete(`/interviews/${id}`)
          toast.success('Interview deleted successfully')
          queryClient.invalidateQueries({ queryKey: ['interviews'] })
        } catch (error) {
          toast.error('Failed to delete interview')
        }
      },
    })
  }

  const formatDateTime = (dateString) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  }

  return (
  <>
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Interviews</h1>
            <p className="text-gray-600 mt-1">Manage and schedule interviews</p>
          </div>
          <Link to="/dashboard/interviews/create" className="btn btn-primary">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Schedule Interview
          </Link>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input"
              >
                <option value="">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.interview_type}
                onChange={(e) => setFilters({ ...filters, interview_type: e.target.value })}
                className="input"
              >
                <option value="">All Types</option>
                <option value="phone_screen">Phone Screen</option>
                <option value="technical">Technical</option>
                <option value="system_design">System Design</option>
                <option value="behavioral">Behavioral</option>
                <option value="hr">HR</option>
                <option value="final">Final</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({ status: '', interview_type: '' })}
                className="btn btn-secondary w-full"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Interviews List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
          </div>
        ) : interviews && interviews.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {interviews.map((interview) => {
                    const { date, time } = formatDateTime(interview.scheduled_at)
                    return (
                      <tr key={interview.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-700 font-semibold">
                                {interview.candidate?.full_name?.charAt(0) || 'C'}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {interview.candidate?.full_name || 'Unknown Candidate'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {interview.candidate?.email || 'No email'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{date}</div>
                          <div className="text-sm text-gray-500">{time}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${TYPE_COLORS[interview.interview_type] || 'bg-gray-100 text-gray-800'}`}>
                            {interview.interview_type?.replace(/_/g, ' ') || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[interview.status] || 'bg-gray-100 text-gray-800'}`}>
                            {interview.status?.replace(/_/g, ' ') || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {interview.duration_minutes} min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <Link
                            to={`/interview/${interview.room_id || interview.id}`}
                            className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Join
                          </Link>
                          <Link
                            to={`/dashboard/interviews/${interview.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => handleDelete(interview.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews found</h3>
              <p className="text-gray-600 mb-4">Get started by scheduling your first interview</p>
              <Link to="/dashboard/interviews/create" className="btn btn-primary">
                Schedule Interview
              </Link>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
    {confirmDialog && <ConfirmModal {...confirmDialog} onCancel={() => setConfirmDialog(null)} />}
  </>
  )
}
