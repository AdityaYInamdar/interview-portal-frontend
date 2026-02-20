import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import api from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  not_started: { label: 'Invited',     color: 'bg-gray-100 text-gray-700' },
  active:      { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  expired:     { label: 'Expired',     color: 'bg-red-100 text-red-700' },
  terminated:  { label: 'Terminated',  color: 'bg-gray-100 text-gray-600' },
};

const REVIEW_META = {
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  pending:  { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.color}`}>{m.label}</span>;
}

function ReviewBadge({ session }) {
  if (!session?.is_completed) return null;
  const key = session.admin_reviewed ? (session.final_status || 'pending') : 'pending';
  const m = REVIEW_META[key] || REVIEW_META.pending;
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.color}`}>{m.label}</span>;
}

function ScoreBar({ obtained, total }) {
  if (total == null || total === 0) return <span className="text-xs text-gray-400">—</span>;
  const pct = Math.min(100, (obtained / total) * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
        {obtained ?? '—'} / {total} <span className="text-gray-400">({pct.toFixed(0)}%)</span>
      </span>
    </div>
  );
}

// ─── Submission report panel (reused inside expanded row) ─────────────────────
function SubmissionReport({ session, testId, testQuestions, onRefresh }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradingModal, setGradingModal] = useState(null);
  const [gradingData, setGradingData] = useState({ marks_obtained: 0, grader_feedback: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  useEffect(() => {
    if (!session?.id) return;
    setLoading(true);
    api.get(`/sessions/admin/session/${session.id}/submissions`)
      .then(r => setSubmissions(r.data || []))
      .catch(() => toast.error('Failed to load submissions'))
      .finally(() => setLoading(false));
  }, [session?.id]);

  const handleGrade = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/sessions/admin/submission/${gradingModal.id}/grade`, {
        marks_obtained: parseFloat(gradingData.marks_obtained),
        grader_feedback: gradingData.grader_feedback,
      });
      toast.success('Grading saved');
      setGradingModal(null);
      setGradingData({ marks_obtained: 0, grader_feedback: '' });
      // reload submissions
      const r = await api.get(`/sessions/admin/session/${session.id}/submissions`);
      setSubmissions(r.data || []);
      onRefresh();
    } catch (err) {
      toast.error('Grading failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleReview = async (status, reason) => {
    try {
      await api.post(`/sessions/admin/session/${session.id}/review`, {
        final_status: status,
        admin_comments: reason || (status === 'approved' ? 'Approved by admin' : ''),
      });
      toast.success(status === 'approved' ? 'Submission approved' : 'Submission rejected');
      setShowRejectBox(false);
      onRefresh();
    } catch (err) {
      toast.error('Review failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-6 py-5 space-y-5">
      {/* Score summary + approve/reject */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Total Score</div>
            <div className="text-2xl font-bold text-indigo-600">
              {session.total_marks_obtained ?? '—'} / {session.total_marks ?? '—'}
              {session.percentage_score != null && (
                <span className="ml-2 text-base font-semibold text-gray-500">
                  ({session.percentage_score.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Review Status</div>
            <ReviewBadge session={session} />
          </div>
          <Link
            to={`/dashboard/tests/${testId}/sessions/${session.id}/violations`}
            className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-800 font-medium"
            onClick={e => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            View Violation Clips
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleReview('approved', '')}
            className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => setShowRejectBox(v => !v)}
            className="px-4 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 font-medium"
          >
            ✕ Reject
          </button>
        </div>
      </div>

      {/* Inline reject reason box */}
      {showRejectBox && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">Rejection reason (required)</p>
          <textarea
            className="w-full input text-sm"
            rows="2"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection…"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              disabled={!rejectReason.trim()}
              onClick={() => handleReview('rejected', rejectReason)}
              className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              Confirm Reject
            </button>
            <button
              onClick={() => setShowRejectBox(false)}
              className="px-4 py-1.5 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Per-question submissions */}
      {(() => {
        // Merge test questions (all, sorted by order) with whatever was submitted.
        // This ensures questions that weren't attempted still appear as "Not attempted".
        const sorted = (testQuestions || []).slice().sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0));
        const subsMap = Object.fromEntries(submissions.map(s => [s.question_id, s]));

        if (sorted.length === 0 && submissions.length === 0) {
          return <div className="text-sm text-gray-500 italic">No submissions recorded for this session.</div>;
        }

        // Fall back to raw submissions list if we have no question definitions yet
        const rows = sorted.length > 0
          ? sorted.map(tq => ({ tq, sub: subsMap[tq.id] || null }))
          : submissions.map(s => ({ tq: s.question || s, sub: s }));

        return (
          <div className="space-y-4">
            {rows.map(({ tq, sub }, idx) => {
              const q = sub?.question || tq || {};
              const qNum = idx + 1;

              if (!sub) {
                // Question exists but candidate never answered it
                return (
                  <div key={tq.id || idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm opacity-70">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400 font-semibold">Q{qNum}</span>
                          <span className="font-semibold text-gray-700">{tq.title || '(Question)'}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded capitalize">{tq.question_type}</span>
                        </div>
                        {tq.description && <p className="text-sm text-gray-400 line-clamp-2">{tq.description}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-base font-bold text-gray-400">— / {tq.marks}</div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not attempted</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Question has a submission — render full detail
              return (
              <div key={sub.id || idx} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                {/* Question header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 font-semibold">Q{qNum}</span>
                      <span className="font-semibold text-gray-900">{q.title || '(Question not found)'}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize">{sub.question_type}</span>
                      {q.difficulty && (
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                          q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                          q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{q.difficulty}</span>
                      )}
                    </div>
                    {q.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{q.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="text-lg font-bold text-indigo-600">{sub.marks_obtained} / {sub.max_marks}</div>
                      <button
                        title={sub.manually_graded ? 'Re-grade' : 'Grade manually'}
                        onClick={() => {
                          setGradingModal({ ...sub, questionTitle: q.title || tq?.title || `Question ${qNum}` });
                          setGradingData({ marks_obtained: sub.marks_obtained || 0, grader_feedback: sub.grader_feedback || '' });
                        }}
                        className="text-gray-400 hover:text-indigo-600 transition-colors p-0.5 rounded"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                    <div className={`text-xs font-medium mt-0.5 ${
                      sub.status === 'graded' ? 'text-green-600' :
                      sub.status === 'error' ? 'text-red-600' :
                      sub.status === 'pending' ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      {sub.auto_graded ? 'Auto-graded' : sub.manually_graded ? 'Manually graded' : sub.status}
                    </div>
                  </div>
                </div>

                {/* SQL schema/seed */}
                {sub.question_type === 'sql' && q.sql_schema && (
                  <details className="mb-3 text-xs">
                    <summary className="font-semibold text-gray-600 cursor-pointer select-none">Schema &amp; Seed Data</summary>
                    <pre className="mt-1 bg-gray-50 border rounded p-2 overflow-x-auto text-gray-700">{q.sql_schema}</pre>
                    {q.sql_seed_data && <pre className="mt-1 bg-gray-50 border rounded p-2 overflow-x-auto text-gray-700">{q.sql_seed_data}</pre>}
                  </details>
                )}

                {/* MCQ Options */}
                {sub.question_type === 'mcq' && q.mcq_options && (
                  <div className="mb-3 space-y-1">
                    {q.mcq_options.map(opt => {
                      const selected = sub.mcq_selected_options?.includes(opt.id);
                      return (
                        <div key={opt.id} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                          opt.is_correct ? 'bg-green-50 border border-green-200' :
                          selected ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                        }`}>
                          {opt.is_correct
                            ? <span className="text-green-600 font-bold">✓</span>
                            : selected
                            ? <span className="text-red-500 font-bold">✗</span>
                            : <span className="w-4" />}
                          <span className={opt.is_correct ? 'text-green-800 font-medium' : selected ? 'text-red-700' : 'text-gray-700'}>{opt.text}</span>
                          {selected && !opt.is_correct && <span className="ml-auto text-xs text-red-500">Candidate's pick</span>}
                          {selected && opt.is_correct && <span className="ml-auto text-xs text-green-600">Correct ✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Ideal answer / rubric */}
                {sub.question_type === 'descriptive' && q.ideal_answer && (
                  <details className="mb-3 text-xs">
                    <summary className="font-semibold text-blue-700 cursor-pointer select-none">Ideal Answer / Rubric</summary>
                    <div className="mt-1 bg-blue-50 border border-blue-200 rounded p-2 text-blue-900 whitespace-pre-wrap">{q.ideal_answer}</div>
                    {q.grading_rubric && <div className="mt-1 bg-indigo-50 border border-indigo-200 rounded p-2 text-indigo-900 whitespace-pre-wrap">{q.grading_rubric}</div>}
                  </details>
                )}

                {/* Expected query result */}
                {sub.question_type === 'sql' && q.expected_query_result && (
                  <details className="mb-3 text-xs">
                    <summary className="font-semibold text-green-700 cursor-pointer select-none">Expected Result</summary>
                    <pre className="mt-1 bg-green-50 border border-green-200 rounded p-2 overflow-x-auto text-green-900">
                      {JSON.stringify(q.expected_query_result, null, 2)}
                    </pre>
                  </details>
                )}

                <hr className="my-3 border-gray-100" />

                {/* Candidate's answer */}
                {sub.code_answer && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Candidate's Code</div>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">{sub.code_answer}</pre>
                  </div>
                )}
                {sub.text_answer && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Candidate's Answer</div>
                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-900 whitespace-pre-wrap">{sub.text_answer}</div>
                  </div>
                )}

                {/* Execution output / error */}
                {sub.execution_output && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Execution Output</div>
                    <pre className="bg-green-50 border border-green-200 text-green-900 p-3 rounded text-xs overflow-x-auto">{sub.execution_output}</pre>
                  </div>
                )}
                {sub.execution_error && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-red-600 mb-1">Execution Error</div>
                    <pre className="bg-red-50 border border-red-200 text-red-900 p-3 rounded text-xs overflow-x-auto">{sub.execution_error}</pre>
                  </div>
                )}
                {sub.test_cases_total > 0 && (
                  <div className={`text-sm font-semibold mb-2 ${sub.test_cases_passed === sub.test_cases_total ? 'text-green-600' : 'text-amber-600'}`}>
                    Test Cases: {sub.test_cases_passed} / {sub.test_cases_total} passed
                  </div>
                )}

                {/* Grader feedback */}
                {sub.grader_feedback && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-3">
                    <div className="text-xs font-semibold text-blue-800 mb-1">Grader Feedback</div>
                    <div className="text-sm text-blue-800">{sub.grader_feedback}</div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        );
      })()}

      {/* Grading modal */}
      {gradingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setGradingModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Grade Answer</h2>
              <button onClick={() => setGradingModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">{gradingModal.questionTitle}</h3>
              {gradingModal.text_answer && (
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-900 whitespace-pre-wrap">{gradingModal.text_answer}</div>
              )}
              {gradingModal.code_answer && (
                <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">{gradingModal.code_answer}</pre>
              )}
              <form onSubmit={handleGrade} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marks Obtained (max {gradingModal.max_marks}) *
                  </label>
                  <input
                    type="number" required min="0" max={gradingModal.max_marks} step="0.5"
                    value={gradingData.marks_obtained}
                    onChange={e => setGradingData({ ...gradingData, marks_obtained: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
                  <textarea
                    rows="3" value={gradingData.grader_feedback}
                    onChange={e => setGradingData({ ...gradingData, grader_feedback: e.target.value })}
                    className="input" placeholder="Provide feedback to the candidate…"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setGradingModal(null)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Grade</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main TestOverview Page ───────────────────────────────────────────────────

export default function TestOverview() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [test, setTest] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  // Read initial tab from navigation state (Manage → questions, Candidates → candidates)
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'candidates');
  const [expandedRow, setExpandedRow] = useState(null); // invitation or session id
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteForm, setInviteForm] = useState({ candidate_id: '', expires_in_hours: 72 });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [resetModal, setResetModal] = useState(null);   // invitation id
  const [resetReason, setResetReason] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [testRes, invRes, sessRes] = await Promise.all([
        api.get(`/tests/${testId}`),
        api.get(`/sessions/invitations/${testId}`),
        api.get(`/sessions/admin/test/${testId}`),
      ]);
      setTest(testRes.data);
      setInvitations(invRes.data || []);
      setSessions(sessRes.data || []);
    } catch (err) {
      toast.error('Failed to load test data');
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    api.get('/candidates?limit=500')
      .then(r => setCandidates(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  // Build a merged candidate rows list (invitation + matched session)
  const rows = invitations.map(inv => {
    const session = sessions.find(s => s.candidate_email === inv.candidate_email);
    return { inv, session };
  });

  // Also include sessions with no invitation (edge-case)
  sessions.forEach(s => {
    if (!invitations.find(i => i.candidate_email === s.candidate_email)) {
      rows.push({ inv: null, session: s });
    }
  });

  const filteredRows = rows.filter(({ inv, session }) => {
    const name = (inv?.candidate_name || session?.candidate_name || '').toLowerCase();
    const email = (inv?.candidate_email || session?.candidate_email || '').toLowerCase();
    const q = searchQ.toLowerCase();
    if (q && !name.includes(q) && !email.includes(q)) return false;
    if (statusFilter !== 'all') {
      const status = session?.status || 'not_started';
      if (statusFilter === 'not_started' && status !== 'not_started') return false;
      if (statusFilter === 'completed' && status !== 'completed') return false;
      if (statusFilter === 'active' && status !== 'active') return false;
      if (statusFilter === 'pending_review' && !(session?.is_completed && !session?.admin_reviewed)) return false;
    }
    return true;
  });

  // Stats
  const totalInvited   = invitations.length;
  const totalCompleted = sessions.filter(s => s.is_completed).length;
  const totalActive    = sessions.filter(s => s.status === 'active').length;
  const pendingReview  = sessions.filter(s => s.is_completed && !s.admin_reviewed).length;
  const avgScore       = sessions.filter(s => s.percentage_score != null).length > 0
    ? (sessions.reduce((sum, s) => sum + (s.percentage_score || 0), 0) /
       sessions.filter(s => s.percentage_score != null).length).toFixed(1)
    : null;

  const alreadyInvitedEmails = new Set(invitations.map(i => i.candidate_email));
  const filteredCandidatesForInvite = candidates.filter(c => {
    if (alreadyInvitedEmails.has(c.email)) return false;
    const q = inviteSearch.toLowerCase();
    return !q || c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    const cand = candidates.find(c => c.id === inviteForm.candidate_id);
    if (!cand) return;
    setSendingInvite(true);
    try {
      await api.post('/sessions/invitations', {
        test_id: testId,
        candidate_email: cand.email,
        candidate_name: cand.full_name,
        expires_in_hours: inviteForm.expires_in_hours,
      });
      toast.success(`Invitation sent to ${cand.full_name}`);
      setShowInviteModal(false);
      setInviteForm({ candidate_id: '', expires_in_hours: 72 });
      setInviteSearch('');
      fetchAll();
    } catch (err) {
      toast.error('Failed to send invitation: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSendingInvite(false);
    }
  };

  const copyInvitationLink = (token) => {
    const link = `${window.location.origin}/test/start?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied to clipboard!');
  };

  const handleResetAttempt = (invitationId) => {
    setResetModal(invitationId);
    setResetReason('');
  };

  const handleSubmitReset = async () => {
    if (!resetReason.trim()) return;
    try {
      await api.post(`/sessions/admin/invitation/${resetModal}/reset`, { reason: resetReason });
      setResetModal(null);
      setResetReason('');
      toast.success('Attempt reset successfully!');
      fetchAll();
    } catch (err) {
      toast.error('Failed to reset: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handlePublishToggle = () => {
    const publishing = !test.is_published;
    setConfirmDialog({
      title: publishing ? 'Publish Test' : 'Unpublish Test',
      message: publishing
        ? 'Candidates will be able to access the test via invitation links.'
        : 'The test will be hidden from candidates. Existing sessions are not affected.',
      confirmLabel: publishing ? 'Publish' : 'Unpublish',
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.post(`/tests/${testId}/${publishing ? 'publish' : 'unpublish'}`);
          toast.success(publishing ? 'Test published' : 'Test unpublished');
          fetchAll();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Failed to update');
        }
      },
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <DashboardLayout>
        <div className="space-y-6">
          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/tests" className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{test?.title}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    test?.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {test?.is_published ? '✓ Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{test?.description || 'No description'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/dashboard/tests/${testId}`}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ✏️ Edit Questions
              </Link>
              <button
                onClick={handlePublishToggle}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  test?.is_published
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {test?.is_published ? 'Unpublish' : 'Publish Test'}
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite Candidate
              </button>
            </div>
          </div>

          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Invited',   value: totalInvited,   color: 'text-gray-900',   bg: 'bg-white' },
              { label: 'Completed',       value: totalCompleted, color: 'text-green-600',  bg: 'bg-white' },
              { label: 'In Progress',     value: totalActive,    color: 'text-blue-600',   bg: 'bg-white' },
              { label: 'Pending Review',  value: pendingReview,  color: 'text-amber-600',  bg: pendingReview > 0 ? 'bg-amber-50' : 'bg-white' },
              { label: 'Avg Score',       value: avgScore != null ? `${avgScore}%` : '—', color: 'text-indigo-600', bg: 'bg-white' },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => {
                  if (s.label === 'Pending Review') { setStatusFilter('pending_review'); setActiveTab('candidates'); }
                  else if (s.label === 'Completed') { setStatusFilter('completed'); setActiveTab('candidates'); }
                  else if (s.label === 'In Progress') { setStatusFilter('active'); setActiveTab('candidates'); }
                  else setStatusFilter('all');
                }}
                className={`${s.bg} rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow`}
              >
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex gap-6">
              {[
                { id: 'candidates', label: `Candidates${totalInvited > 0 ? ` (${totalInvited})` : ''}` },
                { id: 'questions',  label: `Questions${test?.question_count ? ` (${test.question_count})` : ''}` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* CANDIDATES TAB                                                */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'candidates' && (
            <div className="space-y-4">
              {/* Search + filter bar */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All statuses</option>
                  <option value="not_started">Invited (not started)</option>
                  <option value="active">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="pending_review">Pending Review</option>
                </select>
                {statusFilter !== 'all' && (
                  <button onClick={() => setStatusFilter('all')} className="text-xs text-indigo-600 hover:underline">
                    Clear filter
                  </button>
                )}
              </div>

              {filteredRows.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                  <div className="text-4xl mb-3">👥</div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {totalInvited === 0 ? 'No candidates invited yet' : 'No candidates match your filter'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {totalInvited === 0 ? 'Click "Invite Candidate" to get started.' : 'Try clearing the search or filter.'}
                  </p>
                  {totalInvited === 0 && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                    >
                      Invite Candidate
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_2fr_1fr_2fr_1fr_1fr] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <div>Candidate</div>
                    <div>Email</div>
                    <div>Status</div>
                    <div>Score</div>
                    <div>Review</div>
                    <div>Actions</div>
                  </div>

                  {/* Rows */}
                  {filteredRows.map(({ inv, session }, idx) => {
                    const rowId = inv?.id || session?.id;
                    const isExpanded = expandedRow === rowId;
                    const name  = inv?.candidate_name  || session?.candidate_name  || '—';
                    const email = inv?.candidate_email || session?.candidate_email || '—';
                    const status = session?.status || 'not_started';

                    return (
                      <div key={rowId || idx} className={`border-b border-gray-100 last:border-0 ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-gray-50'}`}>
                        {/* Main row */}
                        <div
                          className="grid grid-cols-[2fr_2fr_1fr_2fr_1fr_1fr] gap-4 px-5 py-4 cursor-pointer items-center"
                          onClick={() => setExpandedRow(isExpanded ? null : rowId)}
                        >
                          {/* Name */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900 truncate">{name}</span>
                          </div>

                          {/* Email */}
                          <div className="text-sm text-gray-500 truncate">{email}</div>

                          {/* Status */}
                          <div><StatusBadge status={status} /></div>

                          {/* Score bar */}
                          <div>
                            {session?.is_completed
                              ? <ScoreBar obtained={session.total_marks_obtained} total={session.total_marks} />
                              : <span className="text-xs text-gray-400">{status === 'not_started' ? 'Not started' : 'In progress…'}</span>
                            }
                          </div>

                          {/* Review badge */}
                          <div><ReviewBadge session={session} /></div>

                          {/* Actions / expand toggle */}
                          <div className="flex items-center gap-2">
                            {/* Copy invite link */}
                            {inv?.invitation_token && (
                              <button
                                onClick={e => { e.stopPropagation(); copyInvitationLink(inv.invitation_token); }}
                                title="Copy invitation link"
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            )}
                            {/* Reset attempt (only if candidate has used the invitation) */}
                            {inv?.is_used && (
                              <button
                                onClick={e => { e.stopPropagation(); handleResetAttempt(inv.id); }}
                                title="Reset attempt"
                                className="text-orange-500 hover:text-orange-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            )}
                            {/* Proctoring violations */}
                            {session && (
                              <Link
                                to={`/dashboard/tests/${testId}/sessions/${session.id}/violations`}
                                onClick={e => e.stopPropagation()}
                                title="View violation clips"
                                className="text-red-400 hover:text-red-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </Link>
                            )}
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded report */}
                        {isExpanded && (
                          session ? (
                            <SubmissionReport
                              session={session}
                              testId={testId}
                              testQuestions={test?.questions || []}
                              onRefresh={fetchAll}
                            />
                          ) : (
                            <div className="bg-gray-50 border-t border-gray-200 px-6 py-5 text-sm text-gray-500 italic">
                              This candidate has not started the test yet.
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* QUESTIONS TAB                                                 */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{test?.question_count || 0} question(s) · {test?.total_marks || 0} total marks</p>
                <Link
                  to={`/dashboard/tests/${testId}`}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  ✏️ Edit Questions
                </Link>
              </div>
              {(test?.questions?.length || 0) === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-gray-500">No questions added yet.</p>
                  <Link to={`/dashboard/tests/${testId}`} className="mt-3 inline-block px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                    Add Questions
                  </Link>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                  {(test?.questions || [])
                    .slice()
                    .sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0))
                    .map((q, i) => (
                      <div key={q.id} className="flex items-center gap-4 px-5 py-4">
                        <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{q.title}</div>
                          {q.description && <div className="text-xs text-gray-500 truncate mt-0.5">{q.description}</div>}
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded capitalize shrink-0">{q.question_type}</span>
                        {q.difficulty && (
                          <span className={`text-xs px-2 py-0.5 rounded capitalize shrink-0 ${
                            q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                            q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>{q.difficulty}</span>
                        )}
                        <span className="text-sm font-semibold text-indigo-600 shrink-0">{q.marks} pts</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>

      {/* ── Invite candidate modal ────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Invite Candidate</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSendInvitation} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Candidate</label>
                <input
                  type="text"
                  value={inviteSearch}
                  onChange={e => setInviteSearch(e.target.value)}
                  placeholder="Type name or email…"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Candidate</label>
                <select
                  required
                  value={inviteForm.candidate_id}
                  onChange={e => setInviteForm({ ...inviteForm, candidate_id: e.target.value })}
                  className="input w-full"
                  size={Math.min(6, filteredCandidatesForInvite.length + 1)}
                >
                  <option value="">— choose —</option>
                  {filteredCandidatesForInvite.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
                {filteredCandidatesForInvite.length === 0 && inviteSearch && (
                  <p className="text-xs text-gray-400 mt-1">No candidates found. Try a different search.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expires in (hours)</label>
                <input
                  type="number" min="1" max="720"
                  value={inviteForm.expires_in_hours}
                  onChange={e => setInviteForm({ ...inviteForm, expires_in_hours: parseInt(e.target.value) })}
                  className="input w-full"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowInviteModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={sendingInvite || !inviteForm.candidate_id} className="btn btn-primary disabled:opacity-60">
                  {sendingInvite ? 'Sending…' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && <ConfirmModal {...confirmDialog} onCancel={() => setConfirmDialog(null)} />}

      {/* Reset Attempt Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setResetModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Reset Candidate Attempt</h2>
            <p className="text-sm text-gray-500 mb-4">This will allow the candidate to retake the test. Please provide a reason.</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="Reason for reset (required)"
              value={resetReason}
              onChange={e => setResetReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setResetModal(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSubmitReset}
                disabled={!resetReason.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                Reset Attempt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
