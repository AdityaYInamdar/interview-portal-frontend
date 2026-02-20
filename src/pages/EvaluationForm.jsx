import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'

const evaluationSchema = z.object({
  technical_skills_rating: z.number().min(1, 'Rating required').max(10, 'Max rating is 10'),
  communication_rating: z.number().min(1, 'Rating required').max(10, 'Max rating is 10'),
  problem_solving_rating: z.number().min(1, 'Rating required').max(10, 'Max rating is 10'),
  cultural_fit_rating: z.number().min(1, 'Rating required').max(10, 'Max rating is 10'),
  overall_rating: z.number().min(1, 'Rating required').max(10, 'Max rating is 10'),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  additional_notes: z.string().optional(),
  recommendation: z.enum(['strong_yes', 'yes', 'maybe', 'no', 'strong_no']),
})

const RatingInput = ({ label, value, onChange, error }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={`w-10 h-10 rounded-lg font-medium transition-colors ${
              value === rating
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
      {value && (
        <p className="text-sm text-gray-500 mt-1">
          Selected: {value} / 10
        </p>
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  )
}

export default function EvaluationForm() {
  const { interviewId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ratings, setRatings] = useState({
    technical_skills_rating: 0,
    communication_rating: 0,
    problem_solving_rating: 0,
    cultural_fit_rating: 0,
    overall_rating: 0,
  })

  const { data: interview } = useQuery({
    queryKey: ['interview', interviewId],
    queryFn: async () => {
      const response = await api.get(`/interviews/${interviewId}`)
      return response.data
    },
    enabled: !!interviewId,
  })

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      recommendation: 'maybe',
    },
  })

  useEffect(() => {
    // Update form values when ratings change
    Object.keys(ratings).forEach((key) => {
      setValue(key, ratings[key])
    })
  }, [ratings, setValue])

  const setRating = (field, value) => {
    setRatings((prev) => ({ ...prev, [field]: value }))
  }

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      const payload = {
        interview_id: interviewId,
        ...data,
      }

      await api.post('/evaluations', payload)
      toast.success('Evaluation submitted successfully!')
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      navigate('/dashboard/interviews')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit evaluation')
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
          <h1 className="text-3xl font-bold text-gray-900">Interview Evaluation</h1>
          {interview && (
            <p className="text-gray-600 mt-1">
              Evaluating {interview.candidate?.full_name || 'Candidate'} - {interview.interview_type?.replace(/_/g, ' ') || 'Interview'}
            </p>
          )}
        </div>

        {/* Interview Info Card */}
        {interview && (
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center space-x-4">
              <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {interview.candidate?.full_name || 'Candidate'}
                </h3>
                <p className="text-sm text-gray-600">{interview.candidate?.email}</p>
                <p className="text-sm text-gray-600">
                  {new Date(interview.scheduled_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Evaluation Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Rating Sections */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Rating Criteria</h2>
            <div className="space-y-6">
              <RatingInput
                label="Technical Skills"
                value={ratings.technical_skills_rating}
                onChange={(value) => setRating('technical_skills_rating', value)}
                error={errors.technical_skills_rating?.message}
              />

              <RatingInput
                label="Communication Skills"
                value={ratings.communication_rating}
                onChange={(value) => setRating('communication_rating', value)}
                error={errors.communication_rating?.message}
              />

              <RatingInput
                label="Problem Solving"
                value={ratings.problem_solving_rating}
                onChange={(value) => setRating('problem_solving_rating', value)}
                error={errors.problem_solving_rating?.message}
              />

              <RatingInput
                label="Cultural Fit"
                value={ratings.cultural_fit_rating}
                onChange={(value) => setRating('cultural_fit_rating', value)}
                error={errors.cultural_fit_rating?.message}
              />

              <RatingInput
                label="Overall Rating"
                value={ratings.overall_rating}
                onChange={(value) => setRating('overall_rating', value)}
                error={errors.overall_rating?.message}
              />
            </div>
          </div>

          {/* Detailed Feedback */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Detailed Feedback</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strengths
                </label>
                <textarea
                  {...register('strengths')}
                  rows={4}
                  className="input"
                  placeholder="What did the candidate do well? Highlight their key strengths..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Areas for Improvement
                </label>
                <textarea
                  {...register('weaknesses')}
                  rows={4}
                  className="input"
                  placeholder="What areas need improvement? Be constructive..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  {...register('additional_notes')}
                  rows={4}
                  className="input"
                  placeholder="Any other observations or comments..."
                />
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Final Recommendation <span className="text-red-500">*</span>
            </h2>
            <div className="space-y-3">
              {[
                { value: 'strong_yes', label: 'Strong Yes', color: 'green', icon: '✓✓' },
                { value: 'yes', label: 'Yes', color: 'blue', icon: '✓' },
                { value: 'maybe', label: 'Maybe', color: 'yellow', icon: '?' },
                { value: 'no', label: 'No', color: 'orange', icon: '✗' },
                { value: 'strong_no', label: 'Strong No', color: 'red', icon: '✗✗' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    option.color === 'green'
                      ? 'border-green-300 hover:border-green-500'
                      : option.color === 'blue'
                      ? 'border-blue-300 hover:border-blue-500'
                      : option.color === 'yellow'
                      ? 'border-yellow-300 hover:border-yellow-500'
                      : option.color === 'orange'
                      ? 'border-orange-300 hover:border-orange-500'
                      : 'border-red-300 hover:border-red-500'
                  }`}
                >
                  <input
                    type="radio"
                    {...register('recommendation')}
                    value={option.value}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="ml-3 text-2xl">{option.icon}</span>
                  <span className="ml-3 font-medium text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
            {errors.recommendation && (
              <p className="text-red-500 text-sm mt-2">{errors.recommendation.message}</p>
            )}
          </div>

          {/* Submit Actions */}
          <div className="card">
            <div className="flex justify-end space-x-4">
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
                    Submitting...
                  </>
                ) : (
                  'Submit Evaluation'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
