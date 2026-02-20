import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import DashboardLayout from '../components/layouts/DashboardLayout';

const InterviewerList = () => {
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedInterviewer, setSelectedInterviewer] = useState(null);

  useEffect(() => {
    fetchInterviewers();
  }, [filter]);

  const fetchInterviewers = async () => {
    try {
      setLoading(true);
      const statusParam = filter !== 'all' ? `?status_filter=${filter}` : '';
      const response = await api.get(`/interviewers/${statusParam}`);
      setInterviewers(response.data || []);
    } catch (error) {
      console.error('Error fetching interviewers:', error);
      toast.error('Failed to fetch interviewers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (interviewer) => {
    setSelectedInterviewer(interviewer);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/interviewers/${selectedInterviewer.id}`);
      toast.success('Interviewer deleted successfully');
      setDeleteModalOpen(false);
      setSelectedInterviewer(null);
      fetchInterviewers();
    } catch (error) {
      console.error('Error deleting interviewer:', error);
      toast.error('Failed to delete interviewer');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Interviewers</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your interview team
            </p>
          </div>
          <Link
            to="/dashboard/interviewers/create"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Interviewer
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({interviewers.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filter === 'active'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filter === 'inactive'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Inactive
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Interviewers</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900">{interviewers.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Active</div>
            <div className="mt-2 text-3xl font-semibold text-green-600">
              {interviewers.filter(i => i.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Interviews</div>
            <div className="mt-2 text-3xl font-semibold text-indigo-600">
              {interviewers.reduce((sum, i) => sum + (i.total_interviews || 0), 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Completed</div>
            <div className="mt-2 text-3xl font-semibold text-blue-600">
              {interviewers.reduce((sum, i) => sum + (i.completed_interviews || 0), 0)}
            </div>
          </div>
        </div>

        {/* Interviewers List */}
        {interviewers.length === 0 ? (
          <div className="bg-white rounded-lg shadow text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No interviewers</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding a new interviewer.
            </p>
            <div className="mt-6">
              <Link
                to="/dashboard/interviewers/create"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Interviewer
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {interviewers.map((interviewer) => (
                <li key={interviewer.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0 flex-1">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                            {interviewer.full_name?.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="min-w-0 flex-1 px-4">
                          <div className="flex items-center gap-3">
                            <Link
                              to={`/dashboard/interviewers/${interviewer.id}`}
                              className="text-lg font-medium text-indigo-600 hover:text-indigo-900 truncate"
                            >
                              {interviewer.full_name}
                            </Link>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                interviewer.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {interviewer.status}
                            </span>
                          </div>
                          
                          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {interviewer.email}
                            </span>
                            {interviewer.title && (
                              <span className="flex items-center">
                                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {interviewer.title}
                              </span>
                            )}
                          </div>
                          
                          {/* Skills */}
                          {interviewer.programming_languages?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {interviewer.programming_languages.slice(0, 5).map((lang, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {lang}
                                </span>
                              ))}
                              {interviewer.programming_languages.length > 5 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  +{interviewer.programming_languages.length - 5} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-center">
                          <div className="text-2xl font-semibold text-gray-900">
                            {interviewer.total_interviews || 0}
                          </div>
                          <div className="text-xs text-gray-500">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-semibold text-green-600">
                            {interviewer.completed_interviews || 0}
                          </div>
                          <div className="text-xs text-gray-500">Completed</div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 ml-4">
                        <Link
                          to={`/dashboard/interviewers/${interviewer.id}/edit`}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(interviewer)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Delete Interviewer
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete {selectedInterviewer?.full_name}? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setSelectedInterviewer(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default InterviewerList;
