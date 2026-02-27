/**
 * PublicTestRegister — zero-auth page reachable via /test/:slug
 *
 * Candidates land here from LinkedIn / job-board links posted by HR.
 * No login required — they fill a short form and get their test link by email.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'

// Use plain axios (not the auth-wrapped api.js) because there is no token here.
// Empty string = relative URL → goes through Vite proxy just like api.js.
// Set VITE_API_URL in .env for production deployments.
const publicApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api/v1`,
  timeout: 30000,
})

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h2>
        <p className="text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  )
}

export default function PublicTestRegister() {
  const { slug } = useParams()
  const [submitted, setSubmitted] = useState(null) // null | { test_url, expires_at, message }
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', profile_description: '' })
  const [errors, setErrors] = useState({})

  // ── Fetch test info ──────────────────────────────────────────────────────────
  const { data: testInfo, isLoading, isError, error } = useQuery({
    queryKey: ['public-test', slug],
    queryFn: () => publicApi.get(`/public-tests/${slug}`).then(r => r.data),
    retry: false,
  })

  // ── Submit registration ──────────────────────────────────────────────────────
  const applyMutation = useMutation({
    mutationFn: (body) => publicApi.post(`/public-tests/${slug}/apply`, body).then(r => r.data),
    onSuccess: (data) => setSubmitted(data),
  })

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Full name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Invalid email address'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    applyMutation.mutate(form)
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) return <Spinner />

  // ── Error state ──────────────────────────────────────────────────────────────
  if (isError) {
    const msg = error?.response?.data?.detail || 'This test link is invalid or has expired.'
    return <ErrorScreen message={msg} />
  }

  const test = testInfo

  if (test.is_closed) {
    return <ErrorScreen message="This test has reached its maximum number of applicants. Applications are closed." />
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (submitted) {
    const expiryDate = submitted.expires_at
      ? new Date(submitted.expires_at).toLocaleString()
      : ''

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Registered!</h2>
          <p className="text-gray-600 text-sm mb-6">{submitted.message}</p>

          {expiryDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-700 mb-0.5">Test Link Expires</p>
              <p className="text-sm text-amber-900 font-medium">{expiryDate}</p>
            </div>
          )}

          <a
            href={submitted.test_url}
            className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-blue-700 transition mb-3"
          >
            Start Test Now
          </a>
          <p className="text-xs text-gray-400">A copy of this link has been sent to your email.</p>
        </div>
      </div>
    )
  }

  // ── Registration Form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-10">
      <div className="max-w-lg mx-auto">
        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{test.title}</h1>
              {test.company_name && <p className="text-sm text-gray-500">{test.company_name}</p>}
            </div>
          </div>

          {test.description && (
            <p className="text-sm text-gray-600 mb-3">{test.description}</p>
          )}

          <div className="flex flex-wrap gap-3">
            {test.duration_minutes && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {test.duration_minutes} mins
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-amber-100 rounded-lg px-2.5 py-1.5">
              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3C6.48 3 2 7.48 2 12s4.48 9 10 9 10-4.48 10-10S17.52 3 12 3z" />
              </svg>
              Link expires in {test.expiry_hours}h after registration
            </div>
            {test.max_applicants && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-blue-100 rounded-lg px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {test.applicant_count} / {test.max_applicants} applicants
              </div>
            )}
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Your Details</h2>

          {applyMutation.isError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {applyMutation.error?.response?.data?.detail || 'Failed to register. Please try again.'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="e.g. Priya Sharma"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.full_name ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="priya@example.com"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+91 9999999999"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brief Profile <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={form.profile_description}
                onChange={e => set('profile_description', e.target.value)}
                rows={3}
                placeholder="e.g. 3 years React experience, full-stack developer, open to remote roles"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={applyMutation.isPending}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {applyMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registering...
                </span>
              ) : (
                'Register & Get Test Link'
              )}
            </button>

            <p className="text-xs text-center text-gray-400">
              By registering, you agree that your email will be used to send the test link.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
