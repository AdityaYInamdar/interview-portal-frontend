import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AdminGradingDashboard() {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradingModal, setGradingModal] = useState(null);
  const [gradingData, setGradingData] = useState({ marks_obtained: 0, grader_feedback: '' });
  const [rejectModal, setRejectModal] = useState(null); // sessionId pending rejection
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchTestDetails();
    fetchSessions();
  }, [testId]);

  const fetchTestDetails = async () => {
    try {
      const response = await api.get(`/tests/${testId}`);
      setTest(response.data);
    } catch (error) {
      console.error('Failed to fetch test:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await api.get(`/sessions/admin/test/${testId}`);
      setSessions(response.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (sessionId) => {
    try {
      const response = await api.get(`/sessions/admin/session/${sessionId}/submissions`);
      setSubmissions(response.data);
      setSelectedSession(sessionId);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    }
  };

  const handleGradeDescriptive = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/sessions/admin/submission/${gradingModal.id}/grade`, {
        marks_obtained: parseFloat(gradingData.marks_obtained),
        grader_feedback: gradingData.grader_feedback
      });
      setGradingModal(null);
      setGradingData({ marks_obtained: 0, grader_feedback: '' });
      fetchSubmissions(selectedSession);
      fetchSessions(); // refresh scores in the left panel
      toast.success('Grading submitted successfully!');
    } catch (error) {
      toast.error('Failed to grade: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleReviewSession = async (sessionId, status, comments) => {
    try {
      await api.post(`/sessions/admin/session/${sessionId}/review`, {
        final_status: status,
        admin_comments: comments
      });
      fetchSessions();
      toast.success(status === 'approved' ? 'Submission approved.' : 'Submission rejected.');
    } catch (error) {
      toast.error('Failed to review: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      active: 'bg-blue-100 text-blue-800',
      expired: 'bg-red-100 text-red-800',
      terminated: 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to={`/dashboard/tests/${testId}/overview`} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Grading & Review</h1>
              <p className="text-gray-600 mt-1">{test?.title}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Submissions</div>
            <div className="text-3xl font-bold text-gray-900">{sessions.length}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Completed</div>
            <div className="text-3xl font-bold text-green-600">
              {sessions.filter(s => s.is_completed).length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Pending Review</div>
            <div className="text-3xl font-bold text-orange-600">
              {sessions.filter(s => s.is_completed && !s.admin_reviewed).length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Average Score</div>
            <div className="text-3xl font-bold text-blue-600">
              {sessions.filter(s => s.percentage_score).length > 0
                ? (sessions.reduce((sum, s) => sum + (s.percentage_score || 0), 0) / sessions.filter(s => s.percentage_score).length).toFixed(1)
                : 0}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sessions List */}
          <div className="col-span-5">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Test Sessions</h2>
              
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No test sessions yet
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => fetchSubmissions(session.id)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedSession === session.id ? 'border-primary-500 bg-primary-50' : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-gray-900">{session.candidate_name}</div>
                          <div className="text-sm text-gray-500">{session.candidate_email}</div>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                      
                      {session.is_completed && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Score:</span>
                            <span className="font-bold text-primary-600">
                              {session.total_marks_obtained} / {session.total_marks} ({session.percentage_score?.toFixed(1)}%)
                            </span>
                          </div>
                          {session.admin_reviewed && (
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                session.final_status === 'approved' ? 'bg-green-100 text-green-800' :
                                session.final_status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {session.final_status || 'Pending'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quick link to violation clips */}
                      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                        <Link
                          to={`/dashboard/tests/${testId}/sessions/${session.id}/violations`}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          View Violation Clips
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submissions Detail */}
          <div className="col-span-7">
            {!selectedSession ? (
              <div className="card text-center py-12">
                <div className="text-6xl mb-4">👈</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Session</h3>
                <p className="text-gray-600">Click on a session to view submissions and grade answers</p>
              </div>
            ) : (
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Submissions</h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReviewSession(selectedSession, 'approved', 'Approved by admin')}
                      className="btn btn-primary btn-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectModal(selectedSession); setRejectReason(''); }}
                      className="btn btn-secondary btn-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <div className="space-y-6 max-h-[600px] overflow-y-auto">
                  {submissions.map((submission) => {
                    const q = submission.question || {};
                    return (
                    <div key={submission.id} className="border rounded-lg p-4">
                      {/* Question Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{q.title || '(Question not found)'}</h3>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded capitalize">{submission.question_type}</span>
                            {q.difficulty && (
                              <span className={`text-xs px-2 py-1 rounded capitalize ${
                                q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>{q.difficulty}</span>
                            )}
                          </div>
                          {q.description && (
                            <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{q.description}</p>
                          )}
                        </div>
                        <div className="ml-4 text-right shrink-0">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="text-lg font-bold text-primary-600">
                              {submission.marks_obtained} / {submission.max_marks}
                            </div>
                            <button
                              title={submission.manually_graded ? 'Re-grade manually' : 'Grade manually'}
                              onClick={() => {
                                setGradingModal(submission);
                                setGradingData({ marks_obtained: submission.marks_obtained || 0, grader_feedback: submission.grader_feedback || '' });
                              }}
                              className="text-gray-400 hover:text-primary-600 transition-colors p-0.5 rounded"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                          {submission.auto_graded && <div className="text-xs text-gray-500">Auto-graded</div>}
                          {submission.manually_graded && <div className="text-xs text-blue-600">Manually graded</div>}
                          <div className={`text-xs mt-1 font-medium ${
                            submission.status === 'graded' ? 'text-green-600' :
                            submission.status === 'error' ? 'text-red-600' :
                            submission.status === 'pending' ? 'text-yellow-600' : 'text-gray-500'
                          }`}>{submission.status}</div>
                        </div>
                      </div>

                      {/* SQL Schema & Seed (for SQL questions) */}
                      {submission.question_type === 'sql' && q.sql_schema && (
                        <details className="mb-3">
                          <summary className="text-xs font-semibold text-gray-700 cursor-pointer mb-1 select-none">Database Schema &amp; Seed Data</summary>
                          <pre className="bg-gray-50 border text-gray-800 p-2 rounded text-xs overflow-x-auto mt-1">{q.sql_schema}</pre>
                          {q.sql_seed_data && (
                            <pre className="bg-gray-50 border text-gray-800 p-2 rounded text-xs overflow-x-auto mt-1">{q.sql_seed_data}</pre>
                          )}
                        </details>
                      )}

                      {/* Expected Query Result (SQL) */}
                      {submission.question_type === 'sql' && q.expected_query_result && (
                        <details className="mb-3">
                          <summary className="text-xs font-semibold text-green-700 cursor-pointer mb-1 select-none">Expected Query Result</summary>
                          <pre className="bg-green-50 border border-green-200 text-green-900 p-2 rounded text-xs overflow-x-auto mt-1">
                            {JSON.stringify(q.expected_query_result, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* MCQ Options with correct answers */}
                      {submission.question_type === 'mcq' && q.mcq_options && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Options:</div>
                          <ul className="space-y-1">
                            {q.mcq_options.map(opt => (
                              <li key={opt.id} className={`text-sm px-2 py-1 rounded flex items-center space-x-2 ${
                                opt.is_correct ? 'bg-green-50 text-green-800 border border-green-200' : 'text-gray-700'
                              }`}>
                                <span className="font-mono text-xs">{opt.id})</span>
                                <span>{opt.text}</span>
                                {opt.is_correct && <span className="text-xs text-green-600 font-semibold ml-auto">✓ Correct</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Ideal Answer (Descriptive) */}
                      {submission.question_type === 'descriptive' && q.ideal_answer && (
                        <details className="mb-3">
                          <summary className="text-xs font-semibold text-blue-700 cursor-pointer mb-1 select-none">Ideal Answer / Rubric</summary>
                          <div className="bg-blue-50 border border-blue-200 p-2 rounded text-sm text-blue-900 whitespace-pre-wrap mt-1">{q.ideal_answer}</div>
                          {q.grading_rubric && (
                            <div className="bg-indigo-50 border border-indigo-200 p-2 rounded text-sm text-indigo-900 whitespace-pre-wrap mt-2">{q.grading_rubric}</div>
                          )}
                        </details>
                      )}

                      <hr className="my-3 border-gray-200" />

                      {/* Candidate's Code Answer */}
                      {submission.code_answer && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Candidate's Code:</div>
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">{submission.code_answer}</pre>
                        </div>
                      )}

                      {/* Candidate's Text Answer */}
                      {submission.text_answer && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Candidate's Answer:</div>
                          <div className="bg-gray-50 p-3 rounded text-sm text-gray-900 whitespace-pre-wrap">{submission.text_answer}</div>
                        </div>
                      )}

                      {/* Candidate's MCQ Selection */}
                      {submission.mcq_selected_options && submission.mcq_selected_options.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Selected Options:</div>
                          <div className="text-sm text-gray-900">{submission.mcq_selected_options.join(', ')}</div>
                        </div>
                      )}

                      {/* Execution Output */}
                      {submission.execution_output && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Execution Output:</div>
                          <pre className="bg-green-50 border border-green-200 text-green-900 p-3 rounded text-sm overflow-x-auto">{submission.execution_output}</pre>
                        </div>
                      )}

                      {/* Execution Error */}
                      {submission.execution_error && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-red-700 mb-1">Execution Error:</div>
                          <pre className="bg-red-50 border border-red-200 text-red-900 p-3 rounded text-sm overflow-x-auto">{submission.execution_error}</pre>
                        </div>
                      )}

                      {/* Test Cases */}
                      {submission.test_cases_total > 0 && (
                        <div className="mt-2 text-sm">
                          <span className={`font-semibold ${submission.test_cases_passed === submission.test_cases_total ? 'text-green-600' : 'text-orange-600'}`}>
                            Test Cases: {submission.test_cases_passed} / {submission.test_cases_total} passed
                          </span>
                        </div>
                      )}

                      {/* Grader Feedback */}
                      {submission.grader_feedback && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 p-3 rounded">
                          <div className="text-xs font-semibold text-blue-900 mb-1">Grader Feedback:</div>
                          <div className="text-sm text-blue-800">{submission.grader_feedback}</div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reject Modal */}
        {rejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Reject Submission</h2>
              <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejection. This will be saved with the session record.</p>
              <textarea
                className="input w-full"
                rows="3"
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-end gap-3 mt-4">
                <button onClick={() => setRejectModal(null)} className="btn btn-secondary">Cancel</button>
                <button
                  disabled={!rejectReason.trim()}
                  onClick={() => { handleReviewSession(rejectModal, 'rejected', rejectReason); setRejectModal(null); }}
                  className="btn btn-primary disabled:opacity-50"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grading Modal */}
        {gradingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Grade Descriptive Answer</h2>
                <button onClick={() => setGradingModal(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{gradingModal.question?.title || gradingModal.question_title}</h3>
                  {gradingModal.text_answer && (
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-900 whitespace-pre-wrap mb-4">
                      {gradingModal.text_answer}
                    </div>
                  )}
                  {gradingModal.code_answer && (
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto mb-4">{gradingModal.code_answer}</pre>
                  )}
                </div>

                <form onSubmit={handleGradeDescriptive} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marks Obtained (Max: {gradingModal.max_marks}) *
                    </label>
                    <input
                      type="number"
                      value={gradingData.marks_obtained}
                      onChange={(e) => setGradingData({ ...gradingData, marks_obtained: e.target.value })}
                      className="input"
                      min="0"
                      max={gradingModal.max_marks}
                      step="0.5"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Feedback *</label>
                    <textarea
                      value={gradingData.grader_feedback}
                      onChange={(e) => setGradingData({ ...gradingData, grader_feedback: e.target.value })}
                      className="input"
                      rows="4"
                      placeholder="Provide feedback to the candidate..."
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button type="button" onClick={() => setGradingModal(null)} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Submit Grading
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
