import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import api from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

export default function TestEditor() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [selectedQIds, setSelectedQIds] = useState(new Set());
  const [addingBulk, setAddingBulk] = useState(false);

  // Drag-to-reorder state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [reordering, setReordering] = useState(false);
  const dragNode = useRef(null);

  // Inline passing-marks edit
  const [editingPassingMarks, setEditingPassingMarks] = useState(false);
  const [passingMarksInput, setPassingMarksInput] = useState('');
  const [savingPassingMarks, setSavingPassingMarks] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    fetchTestDetails();
    fetchAvailableQuestions();
  }, [testId]);

  const fetchTestDetails = async () => {
    try {
      const response = await api.get(`/tests/${testId}`);
      setTest(response.data);
      // Always display in question_order
      const sorted = (response.data.questions || []).slice().sort(
        (a, b) => (a.question_order ?? 0) - (b.question_order ?? 0)
      );
      setQuestions(sorted);
    } catch (error) {
      console.error('Failed to fetch test:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableQuestions = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('question_type', filterType);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await api.get(`/questions?${params}`);
      setAvailableQuestions(response.data);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };

  const handleAddQuestion = async (questionId) => {
    try {
      await api.post(`/tests/${testId}/questions`, {
        question_id: questionId,
        question_order: questions.length + 1,
        is_mandatory: true
      });
      fetchTestDetails();
    } catch (error) {
      console.error('Failed to add question:', error);
      toast.error('Failed to add question: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleAddSelected = async () => {
    if (selectedQIds.size === 0) return;
    setAddingBulk(true);
    try {
      const res = await api.post(`/tests/${testId}/questions/bulk`, {
        question_ids: Array.from(selectedQIds),
        is_mandatory: true,
      });
      await fetchTestDetails();
      setSelectedQIds(new Set());
      setShowAddModal(false);
      toast.success(res.data?.message || `Added ${selectedQIds.size} question(s)`);
    } catch (error) {
      console.error('Failed to bulk-add questions:', error);
      toast.error('Failed to add questions: ' + (error.response?.data?.detail || error.message));
    } finally {
      setAddingBulk(false);
    }
  };

  const openAddModal = () => {
    setSelectedQIds(new Set());
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setSelectedQIds(new Set());
    setShowAddModal(false);
  };

  const toggleSelectQuestion = (id) => {
    setSelectedQIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectableQuestions = availableQuestions.filter(q => !questions.some(tq => tq.id === q.id));
  const allSelectableSelected = selectableQuestions.length > 0 && selectableQuestions.every(q => selectedQIds.has(q.id));

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedQIds(new Set());
    } else {
      setSelectedQIds(new Set(selectableQuestions.map(q => q.id)));
    }
  };

  const handleRemoveQuestion = (questionId) => {
    setConfirmDialog({
      title: 'Remove Question',
      message: 'Remove this question from the test? The question will remain in the question bank.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.delete(`/tests/${testId}/questions/${questionId}`);
          fetchTestDetails();
        } catch (error) {
          console.error('Failed to remove question:', error);
          toast.error('Failed to remove question: ' + (error.response?.data?.detail || error.message));
        }
      },
    });
  };

  // Persist a new ordering to the backend
  const persistOrder = useCallback(async (ordered) => {
    setReordering(true);
    try {
      await api.put(`/tests/${testId}/questions/reorder`, {
        questions: ordered.map((q, i) => ({ question_id: q.id, question_order: i + 1 })),
      });
    } catch (e) {
      console.error('Reorder failed', e);
      toast.error('Failed to save new order');
      fetchTestDetails(); // revert
    } finally {
      setReordering(false);
    }
  }, [testId]);

  // ↑ / ↓ arrow buttons
  const handleMoveQuestion = (index, direction) => {
    const newOrder = [...questions];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
    setQuestions(newOrder);
    persistOrder(newOrder);
  };

  // Drag handlers
  const handleDragStart = (e, id) => {
    setDraggingId(id);
    dragNode.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnter = (id) => {
    if (id !== draggingId) setDragOverId(id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    const newOrder = [...questions];
    const fromIdx = newOrder.findIndex(q => q.id === draggingId);
    const toIdx   = newOrder.findIndex(q => q.id === targetId);
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setQuestions(newOrder);
    persistOrder(newOrder);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handlePublish = () => {
    if (questions.length === 0) {
      toast.error('Please add at least one question before publishing.');
      return;
    }
    setConfirmDialog({
      title: 'Publish Test',
      message: 'Publishing this test will make it available to candidates with valid invitations.',
      confirmLabel: 'Publish',
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.post(`/tests/${testId}/publish`);
          fetchTestDetails();
          toast.success('Test published successfully!');
        } catch (error) {
          console.error('Failed to publish test:', error);
          toast.error('Failed to publish: ' + (error.response?.data?.detail || error.message));
        }
      },
    });
  };

  const handleUnpublish = () => {
    setConfirmDialog({
      title: 'Unpublish Test',
      message: 'Unpublishing will hide the test from new candidates. Existing active sessions will not be affected.',
      confirmLabel: 'Unpublish',
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.post(`/tests/${testId}/unpublish`);
          fetchTestDetails();
          toast.success('Test unpublished successfully.');
        } catch (error) {
          console.error('Failed to unpublish test:', error);
          toast.error('Failed to unpublish: ' + (error.response?.data?.detail || error.message));
        }
      },
    });
  };

  const handleSavePassingMarks = async () => {
    const val = parseInt(passingMarksInput, 10);
    if (isNaN(val) || val < 0) {
      toast.error('Please enter a valid number (0 or more).');
      return;
    }
    if (val > (test?.total_marks || 0)) {
      toast.error(`Passing marks cannot exceed total marks (${test?.total_marks || 0}).`);
      return;
    }
    setSavingPassingMarks(true);
    try {
      const response = await api.put(`/tests/${testId}`, { passing_marks: val });
      setTest(prev => ({ ...prev, passing_marks: response.data.passing_marks ?? val }));
      setEditingPassingMarks(false);
      toast.success('Passing marks updated.');
    } catch (error) {
      toast.error('Failed to save: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSavingPassingMarks(false);
    }
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
  <>
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to={`/dashboard/tests/${testId}/overview`} state={{ tab: 'questions' }} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{test?.title}</h1>
              <p className="text-gray-600 mt-1">{test?.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {test?.is_published ? (
              <>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  Published
                </span>
                <button onClick={handleUnpublish} className="btn btn-secondary">
                  Unpublish
                </button>
              </>
            ) : (
              <button onClick={handlePublish} className="btn btn-primary">
                Publish Test
              </button>
            )}
            <Link to={`/dashboard/tests/${testId}/invite`} className="btn btn-secondary">
              Invite Candidates
            </Link>
          </div>
        </div>

        {/* Test Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Questions</div>
            <div className="text-3xl font-bold text-gray-900">{questions.length}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Marks</div>
            <div className="text-3xl font-bold text-primary-600">{test?.total_marks || 0}</div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-gray-600">Passing Marks</div>
              {!editingPassingMarks && (
                <button
                  onClick={() => { setPassingMarksInput(String(test?.passing_marks ?? 0)); setEditingPassingMarks(true); }}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                  title="Edit passing marks"
                >
                  Edit
                </button>
              )}
            </div>
            {editingPassingMarks ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="0"
                  max={test?.total_marks || 9999}
                  value={passingMarksInput}
                  onChange={e => setPassingMarksInput(e.target.value)}
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-lg font-bold text-orange-600 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePassingMarks(); if (e.key === 'Escape') setEditingPassingMarks(false); }}
                />
                <button
                  onClick={handleSavePassingMarks}
                  disabled={savingPassingMarks}
                  className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingPassingMarks ? '…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingPassingMarks(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-1 py-1"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="text-3xl font-bold text-orange-600">{test?.passing_marks ?? 0}</div>
            )}
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Duration</div>
            <div className="text-3xl font-bold text-blue-600">{test?.duration_minutes} min</div>
          </div>
        </div>

        {/* Questions List */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Questions</h2>
              {questions.length > 1 && (
                <p className="text-xs text-gray-400 mt-0.5">Drag ⠿ or use ↑↓ to reorder</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {reordering && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                  Saving order…
                </span>
              )}
              <button
                onClick={openAddModal}
                className="btn btn-primary flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No questions added yet</h3>
              <p className="text-gray-600 mb-6">Add questions from the question bank to build your test</p>
              <button onClick={openAddModal} className="btn btn-primary">
                Add Questions
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, question.id)}
                  onDragEnter={() => handleDragEnter(question.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, question.id)}
                  onDragEnd={handleDragEnd}
                  className={`border rounded-lg p-4 transition-all select-none ${
                    draggingId === question.id
                      ? 'opacity-40 border-dashed border-primary-400 bg-primary-50'
                      : dragOverId === question.id
                      ? 'border-primary-400 border-2 bg-primary-50 shadow-md'
                      : 'bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 px-1"
                      title="Drag to reorder"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="7" cy="4" r="1.3"/><circle cx="13" cy="4" r="1.3"/>
                        <circle cx="7" cy="10" r="1.3"/><circle cx="13" cy="10" r="1.3"/>
                        <circle cx="7" cy="16" r="1.3"/><circle cx="13" cy="16" r="1.3"/>
                      </svg>
                    </div>

                    {/* Position badge */}
                    <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600">
                      {index + 1}
                    </div>

                    {/* Question info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{getQuestionTypeIcon(question.question_type)}</span>
                        <h3 className="text-base font-semibold text-gray-900 truncate">{question.title}</h3>
                        <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded ${getDifficultyColor(question.difficulty)}`}>
                          {question.difficulty}
                        </span>
                        <span className="text-sm font-bold text-primary-600 flex-shrink-0">{question.marks} pts</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{question.description}</p>
                    </div>

                    {/* ↑ ↓ buttons */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => handleMoveQuestion(index, -1)}
                        disabled={index === 0 || reordering}
                        title="Move up"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveQuestion(index, 1)}
                        disabled={index === questions.length - 1 || reordering}
                        title="Move down"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemoveQuestion(question.id)}
                      title="Remove from test"
                      className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
        </div>

        {/* Instructions */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Test Instructions</h2>
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{test?.instructions || 'No instructions provided'}</p>
          </div>
        </div>

        {/* Add Question Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full flex flex-col" style={{maxHeight: '90vh'}}>
              {/* ── Sticky header ── */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Add Questions to Test</h2>
                    {selectableQuestions.length > 0 && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {selectedQIds.size} of {selectableQuestions.length} selectable question{selectableQuestions.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                  <button onClick={closeAddModal} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search questions..."
                      className="input"
                      onKeyPress={(e) => e.key === 'Enter' && fetchAvailableQuestions()}
                    />
                  </div>
                  <div>
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
                    <button onClick={fetchAvailableQuestions} className="btn btn-secondary w-full">
                      Apply Filters
                    </button>
                  </div>
                </div>

                {/* Select-all row */}
                {selectableQuestions?.length > 0 && (
                  <div className="flex items-center mt-3 pt-3 border-t border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={allSelectableSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      {allSelectableSelected ? 'Deselect all' : `Select all ${selectableQuestions.length}`}
                    </label>
                  </div>
                )}
              </div>

              {/* ── Scrollable question list ── */}
              <div className="overflow-y-auto flex-1 p-6">
                {availableQuestions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No questions available</p>
                    <Link to="/dashboard/questions" className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block">
                      Create a question first
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {availableQuestions?.map((question) => {
                      const alreadyAdded = questions.some(q => q.id === question.id);
                      const isSelected = selectedQIds.has(question.id);
                      const isExpanded = expandedQuestion === question.id;
                      return (
                        <div
                          key={question.id}
                          className={`border rounded-lg transition-all ${
                            alreadyAdded
                              ? 'bg-gray-50 opacity-60'
                              : isSelected
                              ? 'bg-primary-50 border-primary-300 shadow-sm'
                              : 'bg-white hover:shadow-md'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-3 flex-1">
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={isSelected || alreadyAdded}
                                  disabled={alreadyAdded}
                                  onChange={() => !alreadyAdded && toggleSelectQuestion(question.id)}
                                  className="w-4 h-4 mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span className="text-2xl">{getQuestionTypeIcon(question.question_type)}</span>
                                <div className="flex-1">
                                  <h3 className="text-base font-semibold text-gray-900">{question.title}</h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getDifficultyColor(question.difficulty)}`}>
                                      {question.difficulty}
                                    </span>
                                    <span className="text-xs text-gray-600 capitalize">
                                      {question.question_type.replace('_', ' ')}
                                    </span>
                                    <span className="text-sm font-bold text-primary-600">{question.marks} pts</span>
                                    {alreadyAdded && (
                                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ In test</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
                                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded ml-2 flex-shrink-0"
                              >
                                {isExpanded ? '△ Less' : '▽ More'}
                              </button>
                            </div>

                            <p className={`text-sm text-gray-600 mt-2 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                              {question.description}
                            </p>
                          </div>

                          {/* Expanded Details (unchanged) */}
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3 mt-2">
                              {question.question_type === 'sql' && (
                                <>
                                  {question.sql_schema && (
                                    <div>
                                      <h5 className="text-xs font-semibold text-gray-700 mb-1">Database Schema:</h5>
                                      <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto max-h-40">{question.sql_schema}</pre>
                                    </div>
                                  )}
                                </>
                              )}
                              {['python', 'javascript'].includes(question.question_type) && (
                                <>
                                  {question.code_template && (
                                    <div>
                                      <h5 className="text-xs font-semibold text-gray-700 mb-1">Code Template:</h5>
                                      <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto max-h-32">{question.code_template}</pre>
                                    </div>
                                  )}
                                  {question.test_cases && question.test_cases.length > 0 && (
                                    <div>
                                      <h5 className="text-xs font-semibold text-gray-700 mb-1">Test Cases ({question.test_cases.length}):</h5>
                                      <div className="space-y-2">
                                        {question.test_cases.slice(0, 2).map((tc, idx) => (
                                          <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                                            <div className="grid grid-cols-2 gap-2">
                                              <div><span className="font-semibold text-gray-600">Input:</span><pre className="mt-1">{tc.input}</pre></div>
                                              <div><span className="font-semibold text-gray-600">Output:</span><pre className="mt-1">{tc.expected_output}</pre></div>
                                            </div>
                                            <div className="mt-1 text-gray-500">{tc.is_hidden ? '🔒 Hidden' : '👁 Visible'} · {tc.marks} marks</div>
                                          </div>
                                        ))}
                                        {question.test_cases.length > 2 && (
                                          <p className="text-xs text-gray-500 italic">+ {question.test_cases.length - 2} more test cases</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                              {question.question_type === 'mcq' && question.mcq_options && (
                                <div>
                                  <h5 className="text-xs font-semibold text-gray-700 mb-1">Options: {question.is_multiple_correct ? '(Multiple Correct)' : '(Single Correct)'}</h5>
                                  <div className="space-y-1">
                                    {question.mcq_options.map((option, idx) => (
                                      <div key={idx} className={`text-xs p-2 rounded ${option.is_correct ? 'bg-green-50 text-green-900 font-medium' : 'bg-gray-50 text-gray-700'}`}>
                                        {option.is_correct && '✓ '}{option.text}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {question.question_type === 'descriptive' && (
                                <>
                                  {question.ideal_answer && (
                                    <div>
                                      <h5 className="text-xs font-semibold text-gray-700 mb-1">Ideal Answer:</h5>
                                      <p className="text-xs bg-gray-50 p-2 rounded text-gray-700">{question.ideal_answer.substring(0, 200)}{question.ideal_answer.length > 200 && '...'}</p>
                                    </div>
                                  )}
                                </>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                                <span>Created: {new Date(question.created_at).toLocaleDateString()}</span>
                                {question.tags && question.tags.length > 0 && <span>Tags: {question.tags.join(', ')}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Sticky footer ── */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg flex items-center justify-between gap-4">
                <p className="text-sm text-gray-600">
                  {selectedQIds.size > 0
                    ? <><span className="font-semibold text-primary-600">{selectedQIds.size}</span> question{selectedQIds.size !== 1 ? 's' : ''} selected</>
                    : 'Select questions to add them to the test'}
                </p>
                <div className="flex gap-3">
                  <button onClick={closeAddModal} className="btn btn-secondary">Cancel</button>
                  <button
                    onClick={handleAddSelected}
                    disabled={selectedQIds.size === 0 || addingBulk}
                    className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {addingBulk && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    {addingBulk ? 'Adding…' : `Add ${selectedQIds.size > 0 ? selectedQIds.size + ' ' : ''}Question${selectedQIds.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
    {confirmDialog && <ConfirmModal {...confirmDialog} onCancel={() => setConfirmDialog(null)} />}
  </>
  );
}
