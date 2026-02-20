import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import DashboardLayout from '../components/layouts/DashboardLayout';

const CreateInterviewer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState([]);
  const [expertise, setExpertise] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [expertiseInput, setExpertiseInput] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const commonSkills = [
    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'TypeScript',
    'React', 'Angular', 'Vue', 'Node.js', 'Django', 'Flask', 'Spring Boot',
    'SQL', 'MongoDB', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure'
  ];

  const commonExpertise = [
    'Frontend Development', 'Backend Development', 'Full Stack', 'DevOps',
    'System Design', 'Data Structures', 'Algorithms', 'Machine Learning',
    'Mobile Development', 'Cloud Architecture', 'Microservices', 'Security'
  ];

  const addSkill = (skill) => {
    if (skill && !skills.includes(skill)) {
      setSkills([...skills, skill]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const addExpertise = (area) => {
    if (area && !expertise.includes(area)) {
      setExpertise([...expertise, area]);
      setExpertiseInput('');
    }
  };

  const removeExpertise = (area) => {
    setExpertise(expertise.filter(e => e !== area));
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      
      const interviewerData = {
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || null,
        password: data.password,
        title: data.title || null,
        bio: data.bio || null,
        expertise_areas: expertise,
        programming_languages: skills,
        years_of_experience: data.years_of_experience ? parseInt(data.years_of_experience) : null,
        linkedin_url: data.linkedin_url || null,
      };

      await api.post('/interviewers', interviewerData);

      toast.success('Interviewer created successfully');
      navigate('/dashboard/interviewers');
    } catch (error) {
      console.error('Error creating interviewer:', error);
      toast.error(error.response?.data?.detail || 'Failed to create interviewer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Add New Interviewer</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new interviewer account and profile
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Account Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  {...register('full_name', { required: 'Full name is required' })}
                  className="input mt-1"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className="input mt-1"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <input
                  type="password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                  })}
                  className="input mt-1"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  {...register('phone')}
                  className="input mt-1"
                />
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Professional Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Job Title
                </label>
                <input
                  type="text"
                  {...register('title')}
                  placeholder="e.g., Senior Software Engineer"
                  className="input mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Years of Experience
                </label>
                <input
                  type="number"
                  {...register('years_of_experience')}
                  min="0"
                  max="50"
                  className="input mt-1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  LinkedIn Profile
                </label>
                <input
                  type="url"
                  {...register('linkedin_url')}
                  placeholder="https://linkedin.com/in/username"
                  className="input mt-1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  {...register('bio')}
                  rows={4}
                  placeholder="Brief professional background..."
                  className="input mt-1"
                />
              </div>
            </div>
          </div>

          {/* Programming Languages */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Programming Languages</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Add
              </label>
              <div className="flex flex-wrap gap-2">
                {commonSkills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => addSkill(skill)}
                    disabled={skills.includes(skill)}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      skills.includes(skill)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill(skillInput);
                  }
                }}
                placeholder="Or type custom language..."
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => addSkill(skillInput)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Add
              </button>
            </div>

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expertise Areas */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Expertise Areas</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Add
              </label>
              <div className="flex flex-wrap gap-2">
                {commonExpertise.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => addExpertise(area)}
                    disabled={expertise.includes(area)}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      expertise.includes(area)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExpertise(expertiseInput);
                  }
                }}
                placeholder="Or type custom expertise area..."
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => addExpertise(expertiseInput)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Add
              </button>
            </div>

            {expertise.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {expertise.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => removeExpertise(area)}
                      className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-green-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/interviewers')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Interviewer'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default CreateInterviewer;
