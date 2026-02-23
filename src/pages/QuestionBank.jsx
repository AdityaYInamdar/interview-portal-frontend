import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import api from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

export default function QuestionBank() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterType = searchParams.get('type') || 'all';
  const filterDifficulty = searchParams.get('difficulty') || 'all';
  const searchQuery = searchParams.get('q') || '';
  const setFilterType = (v) => setSearchParams(prev => { const n = new URLSearchParams(prev); v && v !== 'all' ? n.set('type', v) : n.delete('type'); return n });
  const setFilterDifficulty = (v) => setSearchParams(prev => { const n = new URLSearchParams(prev); v && v !== 'all' ? n.set('difficulty', v) : n.delete('difficulty'); return n });
  const setSearchQuery = (v) => setSearchParams(prev => { const n = new URLSearchParams(prev); v ? n.set('q', v) : n.delete('q'); return n });
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    question_type: 'python',
    difficulty: 'medium',
    marks: 10,
    code_template: '',
    test_cases: [{ input: '', expected_output: '', is_hidden: false, marks: 10 }],
    sql_schema: '',
    sql_seed_data: '',
    expected_query_result: '',
    mcq_options: [
      { id: '1', text: '', is_correct: false },
      { id: '2', text: '', is_correct: false },
      { id: '3', text: '', is_correct: false },
      { id: '4', text: '', is_correct: false }
    ],
    is_multiple_correct: false,
    ideal_answer: '',
    grading_rubric: '',
    tags: []
  });

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('question_type', filterType);
      if (filterDifficulty !== 'all') params.append('difficulty', filterDifficulty);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await api.get(`/questions?${params}`);
      setQuestions(response.data);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterDifficulty, searchQuery]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      
      // Clean up based on question type
      if (formData.question_type === 'sql') {
        payload.test_cases = null;
        payload.mcq_options = null;
        payload.is_multiple_correct = null;
        payload.ideal_answer = null;
        payload.grading_rubric = null;
        payload.expected_query_result = JSON.parse(formData.expected_query_result || '[]');
      } else if (['python', 'javascript'].includes(formData.question_type)) {
        payload.sql_schema = null;
        payload.sql_seed_data = null;
        payload.expected_query_result = null;
        payload.mcq_options = null;
        payload.is_multiple_correct = null;
        payload.ideal_answer = null;
        payload.grading_rubric = null;
      } else if (formData.question_type === 'mcq') {
        payload.code_template = null;
        payload.test_cases = null;
        payload.sql_schema = null;
        payload.sql_seed_data = null;
        payload.expected_query_result = null;
        payload.ideal_answer = null;
        payload.grading_rubric = null;
      } else if (formData.question_type === 'descriptive') {
        payload.code_template = null;
        payload.test_cases = null;
        payload.sql_schema = null;
        payload.sql_seed_data = null;
        payload.expected_query_result = null;
        payload.mcq_options = null;
        payload.is_multiple_correct = null;
      }

      await api.post('/questions', payload);
      setShowCreateModal(false);
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error('Failed to create question:', error);
      toast.error('Failed to create question: ' + (error.response?.data?.detail || error.message));
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      question_type: 'python',
      difficulty: 'medium',
      marks: 10,
      code_template: '',
      test_cases: [{ input: '', expected_output: '', is_hidden: false, marks: 10 }],
      sql_schema: '',
      sql_seed_data: '',
      expected_query_result: '',
      mcq_options: [
        { id: '1', text: '', is_correct: false },
        { id: '2', text: '', is_correct: false },
        { id: '3', text: '', is_correct: false },
        { id: '4', text: '', is_correct: false }
      ],
      is_multiple_correct: false,
      ideal_answer: '',
      grading_rubric: '',
      tags: []
    });
  };

  const handleViewQuestion = (question) => {
    setSelectedQuestion(question);
    setShowViewModal(true);
  };

  const handleEditQuestion = (question) => {
    setSelectedQuestion(question);
    setFormData({
      title: question.title,
      description: question.description,
      question_type: question.question_type,
      difficulty: question.difficulty,
      marks: question.marks,
      code_template: question.code_template || '',
      test_cases: question.test_cases || [{ input: '', expected_output: '', is_hidden: false, marks: 10 }],
      sql_schema: question.sql_schema || '',
      sql_seed_data: question.sql_seed_data || '',
      expected_query_result: question.expected_query_result ? JSON.stringify(question.expected_query_result, null, 2) : '',
      mcq_options: question.mcq_options || [
        { id: '1', text: '', is_correct: false },
        { id: '2', text: '', is_correct: false },
        { id: '3', text: '', is_correct: false },
        { id: '4', text: '', is_correct: false }
      ],
      is_multiple_correct: question.is_multiple_correct || false,
      ideal_answer: question.ideal_answer || '',
      grading_rubric: question.grading_rubric || '',
      tags: question.tags || []
    });
    setShowEditModal(true);
  };

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      
      // Clean up based on question type (same logic as create)
      if (formData.question_type === 'sql') {
        payload.test_cases = null;
        payload.mcq_options = null;
        payload.is_multiple_correct = null;
        payload.ideal_answer = null;
        payload.grading_rubric = null;
        payload.expected_query_result = JSON.parse(formData.expected_query_result || '[]');
      } else if (['python', 'javascript'].includes(formData.question_type)) {
        payload.sql_schema = null;
        payload.sql_seed_data = null;
        payload.expected_query_result = null;
        payload.mcq_options = null;
        payload.is_multiple_correct = null;
        payload.ideal_answer = null;
        payload.grading_rubric = null;
      } else if (formData.question_type === 'mcq') {
        payload.code_template = null;
        payload.test_cases = null;
        payload.sql_schema = null;
        payload.sql_seed_data = null;
        payload.expected_query_result = null;
        payload.ideal_answer = null;
        payload.grading_rubric = null;
      } else if (formData.question_type === 'descriptive') {
        payload.code_template = null;
        payload.test_cases = null;
        payload.sql_schema = null;
        payload.sql_seed_data = null;
        payload.expected_query_result = null;
        payload.mcq_options = null;
        payload.is_multiple_correct = null;
      }

      await api.put(`/questions/${selectedQuestion.id}`, payload);
      setShowEditModal(false);
      setSelectedQuestion(null);
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error('Failed to update question:', error);
      toast.error('Failed to update question: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteQuestion = (questionId) => {
    setConfirmDialog({
      title: 'Delete Question',
      message: 'This will permanently delete the question and remove it from all tests. This action cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.delete(`/questions/${questionId}`);
          toast.success('Question deleted');
          fetchQuestions();
        } catch (error) {
          console.error('Failed to delete question:', error);
          toast.error('Failed to delete question: ' + (error.response?.data?.detail || error.message));
        }
      },
    });
  };

  const addTestCase = () => {
    setFormData({
      ...formData,
      test_cases: [...formData.test_cases, { input: '', expected_output: '', is_hidden: false, marks: 5 }]
    });
  };

  const updateTestCase = (index, field, value) => {
    const newTestCases = [...formData.test_cases];
    newTestCases[index][field] = value;
    setFormData({ ...formData, test_cases: newTestCases });
  };

  const removeTestCase = (index) => {
    const newTestCases = formData.test_cases.filter((_, i) => i !== index);
    setFormData({ ...formData, test_cases: newTestCases });
  };

  const updateMCQOption = (index, field, value) => {
    const newOptions = [...formData.mcq_options];
    newOptions[index][field] = value;
    setFormData({ ...formData, mcq_options: newOptions });
  };

  const addMCQOption = () => {
    setFormData({
      ...formData,
      mcq_options: [...formData.mcq_options, { id: String(formData.mcq_options.length + 1), text: '', is_correct: false }]
    });
  };

  const getQuestionTypeIcon = (type) => {
    switch(type) {
      case 'sql': return '🗄️';
      case 'python': return '🐍';
      case 'javascript': return '⚡';
      case 'mcq': return '☑️';
      case 'descriptive': return '📝';
      default: return '❓';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
  <>
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-gray-600 mt-1">Create and manage coding questions, MCQs, and descriptive questions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Question</span>
          </button>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions..."
                  className="input flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && fetchQuestions()}
                />
                <button onClick={fetchQuestions} className="btn btn-secondary">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input"
              >
                <option value="all">All Types</option>
                <option value="sql">SQL</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="mcq">MCQ</option>
                <option value="descriptive">Descriptive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="input"
              >
                <option value="all">All Levels</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setFilterType('all'); setFilterDifficulty('all'); setSearchQuery(''); }}
                className="btn btn-secondary w-full"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Questions Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        ) : questions.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">❓</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No questions found</h3>
            <p className="text-gray-600 mb-6">Create your first question to get started</p>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              Create Question
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {questions.map((question) => (
              <div key={question.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getQuestionTypeIcon(question.question_type)}</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getDifficultyColor(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-primary-600">{question.marks} pts</span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {question.title}
                </h3>
                
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                  {question.description}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span className="capitalize">{question.question_type.replace('_', ' ')}</span>
                  <span>{new Date(question.created_at).toLocaleDateString()}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleViewQuestion(question)}
                    className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View
                  </button>
                  <button
                    onClick={() => handleEditQuestion(question)}
                    className="flex-1 px-3 py-2 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100 flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Question Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Create New Question</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateQuestion} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Type *</label>
                    <select
                      value={formData.question_type}
                      onChange={(e) => setFormData({ ...formData, question_type: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="sql">SQL</option>
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="mcq">MCQ</option>
                      <option value="descriptive">Descriptive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty *</label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marks *</label>
                    <input
                      type="number"
                      value={formData.marks}
                      onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                      className="input"
                      min="1"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input"
                      rows="4"
                      required
                    />
                  </div>
                </div>

                {/* SQL Question Fields */}
                {formData.question_type === 'sql' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900">SQL Configuration</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Schema (CREATE TABLE) *</label>
                      <textarea
                        value={formData.sql_schema}
                        onChange={(e) => setFormData({ ...formData, sql_schema: e.target.value })}
                        className="input font-mono text-sm"
                        rows="6"
                        placeholder="CREATE TABLE users (id INT, name VARCHAR(100));"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Seed Data (INSERT) *</label>
                      <textarea
                        value={formData.sql_seed_data}
                        onChange={(e) => setFormData({ ...formData, sql_seed_data: e.target.value })}
                        className="input font-mono text-sm"
                        rows="6"
                        placeholder="INSERT INTO users VALUES (1, 'John');"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expected Query Result (JSON Array) *</label>
                      <textarea
                        value={formData.expected_query_result}
                        onChange={(e) => setFormData({ ...formData, expected_query_result: e.target.value })}
                        className="input font-mono text-sm"
                        rows="4"
                        placeholder='[{"id": 1, "name": "John"}]'
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Python/JavaScript Question Fields */}
                {['python', 'javascript'].includes(formData.question_type) && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900">Code Configuration</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code Template (Optional)</label>
                      <textarea
                        value={formData.code_template}
                        onChange={(e) => setFormData({ ...formData, code_template: e.target.value })}
                        className="input font-mono text-sm"
                        rows="6"
                        placeholder={formData.question_type === 'python' ? 'def solution():\n    # Your code here\n    pass' : 'function solution() {\n    // Your code here\n}'}
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Test Cases *</label>
                        <button type="button" onClick={addTestCase} className="text-sm text-primary-600 hover:text-primary-700">
                          + Add Test Case
                        </button>
                      </div>
                      {formData.test_cases.map((testCase, index) => (
                        <div key={index} className="border rounded-lg p-4 mb-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Test Case {index + 1}</span>
                            {formData.test_cases.length > 1 && (
                              <button type="button" onClick={() => removeTestCase(index)} className="text-red-600 hover:text-red-700 text-sm">
                                Remove
                              </button>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Input</label>
                            <input
                              type="text"
                              value={testCase.input}
                              onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                              className="input text-sm"
                              placeholder="e.g., 5, 10"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Expected Output</label>
                            <input
                              type="text"
                              value={testCase.expected_output}
                              onChange={(e) => updateTestCase(index, 'expected_output', e.target.value)}
                              className="input text-sm"
                              placeholder="e.g., 15"
                              required
                            />
                          </div>
                          <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={testCase.is_hidden}
                                onChange={(e) => updateTestCase(index, 'is_hidden', e.target.checked)}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-700">Hidden Test Case</span>
                            </label>
                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-600">Marks:</label>
                              <input
                                type="number"
                                value={testCase.marks}
                                onChange={(e) => updateTestCase(index, 'marks', parseInt(e.target.value))}
                                className="input text-sm w-20"
                                min="1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MCQ Question Fields */}
                {formData.question_type === 'mcq' && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">MCQ Options</h3>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.is_multiple_correct}
                          onChange={(e) => setFormData({ ...formData, is_multiple_correct: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">Multiple Correct Answers</span>
                      </label>
                    </div>
                    {formData.mcq_options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={option.is_correct}
                          onChange={(e) => updateMCQOption(index, 'is_correct', e.target.checked)}
                          className="rounded"
                        />
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => updateMCQOption(index, 'text', e.target.value)}
                          className="input flex-1"
                          placeholder={`Option ${index + 1}`}
                          required
                        />
                      </div>
                    ))}
                    <button type="button" onClick={addMCQOption} className="text-sm text-primary-600 hover:text-primary-700">
                      + Add Option
                    </button>
                  </div>
                )}

                {/* Descriptive Question Fields */}
                {formData.question_type === 'descriptive' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900">Descriptive Answer Configuration</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ideal Answer (Optional)</label>
                      <textarea
                        value={formData.ideal_answer}
                        onChange={(e) => setFormData({ ...formData, ideal_answer: e.target.value })}
                        className="input"
                        rows="4"
                        placeholder="Sample ideal answer for reference..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grading Rubric (Optional)</label>
                      <textarea
                        value={formData.grading_rubric}
                        onChange={(e) => setFormData({ ...formData, grading_rubric: e.target.value })}
                        className="input"
                        rows="4"
                        placeholder="Grading criteria for manual evaluation..."
                      />
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-3 border-t pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Question Modal */}
        {showViewModal && selectedQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Question Details</h2>
                <button onClick={() => { setShowViewModal(false); setSelectedQuestion(null); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{getQuestionTypeIcon(selectedQuestion.question_type)}</span>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{selectedQuestion.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                          {selectedQuestion.difficulty}
                        </span>
                        <span className="text-sm text-gray-600">Type: {selectedQuestion.question_type.toUpperCase()}</span>
                        <span className="text-sm font-bold text-primary-600">{selectedQuestion.marks} points</span>
                      </div>
                    </div>
                  </div>
                  <div className="prose max-w-none bg-gray-50 p-4 rounded">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedQuestion.description}</p>
                  </div>
                </div>

                {/* SQL Question Details */}
                {selectedQuestion.question_type === 'sql' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Database Schema</h4>
                      <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm">{selectedQuestion.sql_schema}</pre>
                    </div>
                    {selectedQuestion.sql_seed_data && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Seed Data</h4>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm">{selectedQuestion.sql_seed_data}</pre>
                      </div>
                    )}
                    {selectedQuestion.expected_query_result && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Expected Query Result</h4>
                        <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-sm">{JSON.stringify(selectedQuestion.expected_query_result, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Python/JavaScript Question Details */}
                {['python', 'javascript'].includes(selectedQuestion.question_type) && (
                  <div className="space-y-4">
                    {selectedQuestion.code_template && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Code Template</h4>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm">{selectedQuestion.code_template}</pre>
                      </div>
                    )}
                    {selectedQuestion.test_cases && selectedQuestion.test_cases.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Test Cases</h4>
                        <div className="space-y-2">
                          {selectedQuestion.test_cases.map((tc, idx) => (
                            <div key={idx} className="bg-gray-50 p-3 rounded">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <span className="text-xs font-semibold text-gray-600">Input:</span>
                                  <pre className="text-sm mt-1">{tc.input}</pre>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-gray-600">Expected Output:</span>
                                  <pre className="text-sm mt-1">{tc.expected_output}</pre>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                                <span>{tc.is_hidden ? '🔒 Hidden' : '👁️ Visible'}</span>
                                <span>Marks: {tc.marks}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ Question Details */}
                {selectedQuestion.question_type === 'mcq' && selectedQuestion.mcq_options && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Options {selectedQuestion.is_multiple_correct && '(Multiple Correct)'}
                    </h4>
                    <div className="space-y-2">
                      {selectedQuestion.mcq_options.map((option, idx) => (
                        <div key={idx} className={`p-3 rounded border-2 ${option.is_correct ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center gap-2">
                            {option.is_correct && <span className="text-green-600 font-bold">✓</span>}
                            <span className="font-semibold text-gray-700">Option {idx + 1}:</span>
                            <span className="text-gray-900">{option.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Descriptive Question Details */}
                {selectedQuestion.question_type === 'descriptive' && (
                  <div className="space-y-4">
                    {selectedQuestion.ideal_answer && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Ideal Answer</h4>
                        <div className="bg-gray-50 p-4 rounded">
                          <p className="text-gray-700 whitespace-pre-wrap">{selectedQuestion.ideal_answer}</p>
                        </div>
                      </div>
                    )}
                    {selectedQuestion.grading_rubric && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Grading Rubric</h4>
                        <div className="bg-gray-50 p-4 rounded">
                          <p className="text-gray-700 whitespace-pre-wrap">{selectedQuestion.grading_rubric}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between">
                <button
                  onClick={() => { setShowViewModal(false); handleEditQuestion(selectedQuestion); }}
                  className="btn btn-primary"
                >
                  Edit Question
                </button>
                <button
                  onClick={() => { setShowViewModal(false); setSelectedQuestion(null); }}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Question Modal - Reuse create modal structure */}
        {showEditModal && selectedQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Edit Question</h2>
                <button onClick={() => { setShowEditModal(false); setSelectedQuestion(null); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUpdateQuestion} className="p-6 space-y-6">
                {/* Use same form fields as create modal - the form data is already populated */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Question type cannot be changed. To use a different type, create a new question.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question Type *</label>
                    <input
                      type="text"
                      value={formData.question_type.toUpperCase()}
                      className="input bg-gray-100 cursor-not-allowed"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty *</label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marks *</label>
                    <input
                      type="number"
                      value={formData.marks}
                      onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                      className="input"
                      min="1"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input"
                      rows="4"
                      required
                    />
                  </div>
                </div>

                {/* Include all the type-specific form fields from the create modal */}
                {/* SQL Fields */}
                {formData.question_type === 'sql' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900">SQL Configuration</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Schema (CREATE TABLE) *</label>
                      <textarea
                        value={formData.sql_schema}
                        onChange={(e) => setFormData({ ...formData, sql_schema: e.target.value })}
                        className="input font-mono text-sm"
                        rows="8"
                        placeholder="CREATE TABLE..."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Seed Data (INSERT INTO) *</label>
                      <textarea
                        value={formData.sql_seed_data}
                        onChange={(e) => setFormData({ ...formData, sql_seed_data: e.target.value })}
                        className="input font-mono text-sm"
                        rows="8"
                        placeholder="INSERT IN TO..."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expected Query Result (JSON Array) *</label>
                      <textarea
                        value={formData.expected_query_result}
                        onChange={(e) => setFormData({ ...formData, expected_query_result: e.target.value })}
                        className="input font-mono text-sm"
                        rows="6"
                        placeholder='[{"column1": "value1", "column2": "value2"}]'
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter expected result as JSON array of objects</p>
                    </div>
                  </div>
                )}

                {/* Python/JavaScript Fields */}
                {['python', 'javascript'].includes(formData.question_type) && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900">{formData.question_type === 'python' ? 'Python' : 'JavaScript'} Configuration</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code Template</label>
                      <textarea
                        value={formData.code_template}
                        onChange={(e) => setFormData({ ...formData, code_template: e.target.value })}
                        className="input font-mono text-sm"
                        rows="8"
                        placeholder={formData.question_type === 'python' ? 'def solution():\n    pass' : 'function solution() {\n    // your code\n}'}
                      />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Test Cases *</h4>
                      {formData.test_cases.map((tc, index) => (
                        <div key={index} className="border rounded-lg p-4 mb-3 bg-gray-50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-sm">Test Case {index + 1}</span>
                            {formData.test_cases.length > 1 && (
                              <button type="button" onClick={() => removeTestCase(index)} className="text-red-600 hover:text-red-700 text-sm">
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Input</label>
                              <textarea
                                value={tc.input}
                                onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                                className="input text-sm"
                                rows="2"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Expected Output</label>
                              <textarea
                                value={tc.expected_output}
                                onChange={(e) => updateTestCase(index, 'expected_output', e.target.value)}
                                className="input text-sm"
                                rows="2"
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="flex items-center space-x-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={tc.is_hidden}
                                  onChange={(e) => updateTestCase(index, 'is_hidden', e.target.checked)}
                                  className="rounded"
                                />
                                <span>Hidden from candidate</span>
                              </label>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Marks</label>
                              <input
                                type="number"
                                value={tc.marks}
                                onChange={(e) => updateTestCase(index, 'marks', parseInt(e.target.value))}
                                className="input text-sm"
                                min="1"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={addTestCase} className="text-sm text-primary-600 hover:text-primary-700">
                        + Add Test Case
                      </button>
                    </div>
                  </div>
                )}

                {/* MCQ Fields */}
                {formData.question_type === 'mcq' && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">MCQ Options</h3>
                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.is_multiple_correct}
                          onChange={(e) => setFormData({ ...formData, is_multiple_correct: e.target.checked })}
                          className="rounded"
                        />
                        <span>Multiple correct answers</span>
                      </label>
                    </div>
                    <div className="space-y-3">
                      {formData.mcq_options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={option.is_correct}
                            onChange={(e) => updateMCQOption(index, 'is_correct', e.target.checked)}
                            className="rounded"
                          />
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => updateMCQOption(index, 'text', e.target.value)}
                            className="input flex-1"
                            placeholder={`Option ${index + 1}`}
                            required
                          />
                        </div>
                      ))}
                      <button type="button" onClick={addMCQOption} className="text-sm text-primary-600 hover:text-primary-700">
                        + Add Option
                      </button>
                    </div>
                  </div>
                )}

                {/* Descriptive Fields */}
                {formData.question_type === 'descriptive' && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-900">Descriptive Answer Configuration</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ideal Answer (Optional)</label>
                      <textarea
                        value={formData.ideal_answer}
                        onChange={(e) => setFormData({ ...formData, ideal_answer: e.target.value })}
                        className="input"
                        rows="4"
                        placeholder="Sample ideal answer for reference..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grading Rubric (Optional)</label>
                      <textarea
                        value={formData.grading_rubric}
                        onChange={(e) => setFormData({ ...formData, grading_rubric: e.target.value })}
                        className="input"
                        rows="4"
                        placeholder="Grading criteria for manual evaluation..."
                      />
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-3 border-t pt-4">
                  <button type="button" onClick={() => { setShowEditModal(false); setSelectedQuestion(null); resetForm(); }} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Update Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
    {confirmDialog && <ConfirmModal {...confirmDialog} onCancel={() => setConfirmDialog(null)} />}
  </>
  );
}
