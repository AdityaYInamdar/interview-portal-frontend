import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'
import { useAuthStore } from '../store/authStore'

const interviewSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  designation_id: z.string().min(1, 'Please select a position'),
  candidate_id: z.string().uuid('Please select a candidate'),
  interviewer_id: z.string().uuid('Please select an interviewer'),
  interview_type: z.enum(['phone_screen', 'technical', 'system_design', 'behavioral', 'hr', 'final', 'mixed']),
  scheduled_at: z.string().min(1, 'Schedule date and time is required'),
  duration_minutes: z.number().min(15, 'Minimum duration is 15 minutes').max(240, 'Maximum duration is 4 hours'),
  description: z.string().optional(),
})

export default function CreateInterview() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [designations, setDesignations] = useState([])
  const [loadingDesignations, setLoadingDesignations] = useState(true)

  useEffect(() => {
    api.get('/designations/', { params: { active_only: true } })
      .then(res => setDesignations(res.data || []))
      .catch(() => setDesignations([]))
      .finally(() => setLoadingDesignations(false))
  }, [])

  const { data: candidates } = useQuery({
    queryKey: ['candidates'],
    queryFn: async () => {
      const response = await api.get('/candidates')
      return Array.isArray(response.data) ? response.data : []
    },
  })

  const { data: interviewers } = useQuery({
    queryKey: ['interviewers'],
    queryFn: async () => {
      const response = await api.get('/users?role=interviewer')
      return Array.isArray(response.data) ? response.data : []
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      duration_minutes: 60,
      interview_type: 'technical',
    },
  })

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      // Convert the local datetime-local string to a proper UTC ISO string
      const scheduledAtISO = new Date(data.scheduled_at).toISOString()
      await api.post('/interviews', {
        ...data,
        scheduled_at: scheduledAtISO,
        duration_minutes: parseInt(data.duration_minutes),
        company_id: user?.company_id,
      })
      toast.success('Interview scheduled successfully!')
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      navigate('/dashboard/interviews')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to schedule interview')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate('/dashboard/interviews')}
            className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Interviews
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Schedule Interview</h1>
          <p className="text-gray-600 mt-1">Fill in the details below to schedule a new interview</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interview Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('title')}
              className="input"
              placeholder="e.g., Technical Interview - Round 1"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Position <span className="text-red-500">*</span>
            </label>
            <select
              {...register('designation_id')}
              className="input"
              disabled={loadingDesignations}
            >
              <option value="">{loadingDesignations ? 'Loading positions...' : 'Select a position'}</option>
              {designations.map(d => (
                <option key={d.id} value={d.id}>
                  {d.title}{d.department ? ` — ${d.department}` : ''}{d.level ? ` (${d.level})` : ''}
                </option>
              ))}
            </select>
            {errors.designation_id && (
              <p className="text-red-500 text-sm mt-1">{errors.designation_id.message}</p>
            )}
          </div>

          {/* Candidate Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Candidate <span className="text-red-500">*</span>
            </label>
            <select {...register('candidate_id')} className="input">
              <option value="">Select a candidate</option>
              {candidates?.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.full_name} ({candidate.email})
                </option>
              ))}
            </select>
            {errors.candidate_id && (
              <p className="text-red-500 text-sm mt-1">{errors.candidate_id.message}</p>
            )}
          </div>

          {/* Interviewer Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interviewer <span className="text-red-500">*</span>
            </label>
            <select {...register('interviewer_id')} className="input">
              <option value="">Select an interviewer</option>
              {interviewers?.map((interviewer) => (
                <option key={interviewer.id} value={interviewer.id}>
                  {interviewer.full_name} ({interviewer.email})
                </option>
              ))}
            </select>
            {errors.interviewer_id && (
              <p className="text-red-500 text-sm mt-1">{errors.interviewer_id.message}</p>
            )}
          </div>

          {/* Interview Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interview Type <span className="text-red-500">*</span>
            </label>
            <select {...register('interview_type')} className="input">
              <option value="phone_screen">Phone Screen</option>
              <option value="technical">Technical Interview</option>
              <option value="system_design">System Design Interview</option>
              <option value="behavioral">Behavioral Interview</option>
              <option value="hr">HR Interview</option>
              <option value="final">Final Interview</option>
              <option value="mixed">Mixed Interview</option>
            </select>
            {errors.interview_type && <p className="text-red-500 text-sm mt-1">{errors.interview_type.message}</p>}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                {...register('scheduled_at')}
                className="input"
                min={new Date().toISOString().slice(0, 16)}
              />
              {errors.scheduled_at && (
                <p className="text-red-500 text-sm mt-1">{errors.scheduled_at.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...register('duration_minutes', { valueAsNumber: true })}
                className="input"
                min="15"
                max="480"
                step="15"
              />
              {errors.duration_minutes && (
                <p className="text-red-500 text-sm mt-1">{errors.duration_minutes.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="input"
              placeholder="Any additional details about the interview..."
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => navigate('/dashboard/interviews')}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="spinner-small mr-2"></div>
                  Scheduling...
                </>
              ) : (
                'Schedule Interview'
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
