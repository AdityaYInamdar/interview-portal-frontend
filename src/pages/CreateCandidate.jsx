import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'

const candidateSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  position_applied: z.string().min(2, 'Position is required'),
  resume_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  github_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  portfolio_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  years_of_experience: z.number().min(0, 'Years must be 0 or more').optional(),
  current_company: z.string().optional(),
  location: z.string().optional(),
  education: z.string().optional(),
  source: z.string().optional(),
  application_notes: z.string().optional(),
})

export default function CreateCandidate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [skills, setSkills] = useState([])
  const [skillInput, setSkillInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      source: 'direct',
    },
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size exceeds 5MB limit')
        return
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
      const allowedExtensions = ['.pdf', '.docx', '.txt']
      
      if (!allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        toast.error('Please upload a PDF, DOCX, or TXT file')
        return
      }
      
      setSelectedFile(file)
    }
  }

  const parseResume = async () => {
    if (!selectedFile) {
      toast.error('Please select a resume file first')
      return
    }

    setIsParsing(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await api.post('/candidates/parse-resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const parsed = response.data.data

      // Auto-fill form fields
      if (parsed.full_name) setValue('full_name', parsed.full_name)
      if (parsed.email) setValue('email', parsed.email)
      if (parsed.phone) setValue('phone', parsed.phone)
      if (parsed.linkedin_url) setValue('linkedin_url', parsed.linkedin_url)
      if (parsed.github_url) setValue('github_url', parsed.github_url)
      if (parsed.portfolio_url) setValue('portfolio_url', parsed.portfolio_url)
      if (parsed.years_of_experience) setValue('years_of_experience', parsed.years_of_experience)
      if (parsed.education) setValue('education', parsed.education)
      if (parsed.location) setValue('location', parsed.location)
      
      // Set skills
      if (parsed.skills && parsed.skills.length > 0) {
        setSkills(parsed.skills)
      }

      toast.success('Resume parsed successfully! Review and edit the details.')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to parse resume')
    } finally {
      setIsParsing(false)
    }
  }

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()])
      setSkillInput('')
    }
  }

  const removeSkill = (skill) => {
    setSkills(skills.filter((s) => s !== skill))
  }

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      const payload = {
        ...data,
        skills,
        company_id: null, // Will be set by backend based on user's company
        years_of_experience: data.years_of_experience ? parseInt(data.years_of_experience) : undefined,
      }
      
      // Remove empty string values
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') {
          delete payload[key]
        }
      })

      console.log('validate from frontend', payload)

      await api.post('/candidates', payload)
      toast.success('Candidate created successfully!')
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      navigate('/dashboard/candidates')
    } catch (error) {
      console.log(error)
      toast.error(error.response?.data?.detail || 'Failed to create candidate')
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
            onClick={() => navigate('/dashboard/candidates')}
            className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Candidates
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Add New Candidate</h1>
          <p className="text-gray-600 mt-1">Fill in the candidate's information below</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Resume Upload Section */}
          <div className="card bg-blue-50 border-2 border-blue-200">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Import from Resume (Optional)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload a resume (PDF, DOCX, or TXT) to automatically extract candidate information
                </p>
                <div className="flex items-center space-x-3">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                  />
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={parseResume}
                      disabled={isParsing}
                      className="btn btn-primary"
                    >
                      {isParsing ? (
                        <>
                          <div className="spinner-small mr-2"></div>
                          Parsing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Parse Resume
                        </>
                      )}
                    </button>
                  )}
                </div>
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" {...register('full_name')} className="input" />
                  {errors.full_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input type="email" {...register('email')} className="input" />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone (optional)
                  </label>
                  <input type="tel" {...register('phone')} className="input" placeholder="+1 (555) 000-0000" />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position Applied <span className="text-red-500">*</span>
                  </label>
                  <input type="text" {...register('position_applied')} className="input" placeholder="Senior Software Engineer" />
                  {errors.position_applied && (
                    <p className="text-red-500 text-sm mt-1">{errors.position_applied.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Professional Details */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Professional Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Company
                  </label>
                  <input type="text" {...register('current_company')} className="input" placeholder="Tech Corp" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    {...register('years_of_experience', { valueAsNumber: true })}
                    className="input"
                    min="0"
                    step="0.5"
                  />
                  {errors.years_of_experience && (
                    <p className="text-red-500 text-sm mt-1">{errors.years_of_experience.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input type="text" {...register('location')} className="input" placeholder="San Francisco, CA" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Education
                  </label>
                  <input type="text" {...register('education')} className="input" placeholder="B.S. Computer Science" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select {...register('source')} className="input">
                    <option value="direct">Direct Application</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="referral">Employee Referral</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="job_board">Job Board</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Skills</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  className="input flex-1"
                  placeholder="Enter a skill (e.g., JavaScript, Python, AWS)"
                />
                <button type="button" onClick={addSkill} className="btn btn-secondary">
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="badge bg-blue-100 text-blue-800 flex items-center gap-1 px-3 py-1"
                  >
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="text-blue-600 hover:text-blue-800">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Online Profiles */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Online Profiles</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resume URL
                </label>
                <input type="url" {...register('resume_url')} className="input" placeholder="https://example.com/resume.pdf" />
                {errors.resume_url && (
                  <p className="text-red-500 text-sm mt-1">{errors.resume_url.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LinkedIn URL
                  </label>
                  <input type="url" {...register('linkedin_url')} className="input" placeholder="https://linkedin.com/in/username" />
                  {errors.linkedin_url && (
                    <p className="text-red-500 text-sm mt-1">{errors.linkedin_url.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GitHub URL
                  </label>
                  <input type="url" {...register('github_url')} className="input" placeholder="https://github.com/username" />
                  {errors.github_url && (
                    <p className="text-red-500 text-sm mt-1">{errors.github_url.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portfolio URL
                </label>
                <input type="url" {...register('portfolio_url')} className="input" placeholder="https://portfolio.com" />
                {errors.portfolio_url && (
                  <p className="text-red-500 text-sm mt-1">{errors.portfolio_url.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Application Notes */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application Notes
              </label>
              <textarea {...register('application_notes')} className="input" rows="4" placeholder="Any additional notes about the candidate..." />
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard/candidates')}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="spinner-small mr-2"></div>
                    Creating...
                  </>
                ) : (
                  'Create Candidate'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
