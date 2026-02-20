import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function TestInvitations() {
  const { testId } = useParams();
  const [test, setTest] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [resetModal, setResetModal] = useState(null);
  const [resetReason, setResetReason] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');

  // Selected candidate ids for bulk
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);

  const [inviteForm, setInviteForm] = useState({
    candidate_id: '',
    expires_in_hours: 72
  });

  useEffect(() => {
    fetchTestDetails();
    fetchInvitations();
    fetchCandidates();
  }, [testId]);

  const fetchTestDetails = async () => {
    try {
      const response = await api.get(`/tests/${testId}`);
      setTest(response.data);
    } catch (error) {
      console.error('Failed to fetch test:', error);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await api.get(`/sessions/invitations/${testId}`);
      setInvitations(response.data);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      const response = await api.get('/candidates?limit=200');
      setCandidates(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    }
  };

  // Already-invited candidate ids (to avoid duplicates)
  const alreadyInvitedEmails = new Set(invitations.map(inv => inv.candidate_email));

  const filteredCandidates = candidates.filter(c => {
    const q = candidateSearch.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    const candidate = candidates.find(c => c.id === inviteForm.candidate_id);
    if (!candidate) return;
    try {
      await api.post('/sessions/invitations', {
        test_id: testId,
        candidate_email: candidate.email,
        candidate_name: candidate.full_name,
        expires_in_hours: inviteForm.expires_in_hours,
      });
      setShowInviteModal(false);
      setInviteForm({ candidate_id: '', expires_in_hours: 72 });
      setCandidateSearch('');
      fetchInvitations();
      toast.success('Invitation sent successfully!');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleBulkInvitations = async (e) => {
    e.preventDefault();
    if (selectedCandidateIds.length === 0) {
      toast.error('Please select at least one candidate.');
      return;
    }
    const selected = candidates.filter(c => selectedCandidateIds.includes(c.id));
    try {
      await api.post('/sessions/invitations/bulk', {
        test_id: testId,
        candidates: selected.map(c => ({ candidate_name: c.full_name, candidate_email: c.email })),
        expires_in_hours: 72,
      });
      setShowBulkModal(false);
      setSelectedCandidateIds([]);
      fetchInvitations();
      toast.success(`${selected.length} invitation${selected.length !== 1 ? 's' : ''} sent successfully!`);
    } catch (error) {
      console.error('Failed to send bulk invitations:', error);
      toast.error('Failed to send invitations: ' + (error.response?.data?.detail || error.message));
    }
  };

  const toggleCandidateSelection = (id) => {
    setSelectedCandidateIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
      fetchInvitations();
      toast.success('Attempt reset successfully!');
    } catch (error) {
      console.error('Failed to reset attempt:', error);
      toast.error('Failed to reset: ' + (error.response?.data?.detail || error.message));
    }
  };

  const copyInvitationLink = (token) => {
    const link = `${window.location.origin}/test/start?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied to clipboard!');
  };

  const getStatusBadge = (invitation) => {
    if (invitation.is_used) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Used</span>;
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Expired</span>;
    }
    return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Pending</span>;
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
            <Link to={`/dashboard/tests/${testId}`} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Test Invitations</h1>
              <p className="text-gray-600 mt-1">{test?.title}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowBulkModal(true)} className="btn btn-secondary flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Bulk Invite</span>
            </button>
            <button onClick={() => setShowInviteModal(true)} className="btn btn-primary flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Invite Candidate</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Total Invitations</div>
            <div className="text-3xl font-bold text-gray-900">{invitations.length}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Pending</div>
            <div className="text-3xl font-bold text-blue-600">
              {invitations.filter(inv => !inv.is_used && new Date(inv.expires_at) > new Date()).length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Used</div>
            <div className="text-3xl font-bold text-green-600">
              {invitations.filter(inv => inv.is_used).length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">Expired</div>
            <div className="text-3xl font-bold text-red-600">
              {invitations.filter(inv => !inv.is_used && new Date(inv.expires_at) < new Date()).length}
            </div>
          </div>
        </div>

        {/* Invitations Table */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Invitation List</h2>
          
          {invitations.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✉️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No invitations sent yet</h3>
              <p className="text-gray-600 mb-6">Invite candidates to take this test</p>
              <button onClick={() => setShowInviteModal(true)} className="btn btn-primary">
                Send Invitation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires At
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invitations.map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{invitation.candidate_name}</div>
                        <div className="text-sm text-gray-500">{invitation.candidate_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(invitation)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invitation.sent_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invitation.expires_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => copyInvitationLink(invitation.invitation_token)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Copy Link"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {invitation.is_used && (
                            <button
                              onClick={() => handleResetAttempt(invitation.id)}
                              className="text-orange-600 hover:text-orange-700"
                              title="Reset Attempt"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <Link
                            to={`/dashboard/tests/${testId}/sessions`}
                            className="text-primary-600 hover:text-primary-700"
                            title="View Sessions"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Single Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Invite Candidate</h2>
                <button onClick={() => { setShowInviteModal(false); setCandidateSearch(''); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSendInvitation} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Candidate</label>
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={e => setCandidateSearch(e.target.value)}
                    className="input"
                    placeholder="Type name or email..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Candidate *</label>
                  <select
                    value={inviteForm.candidate_id}
                    onChange={e => setInviteForm({ ...inviteForm, candidate_id: e.target.value })}
                    className="input"
                    required
                    size={Math.min(filteredCandidates.length + 1, 6)}
                  >
                    <option value="">-- Select a candidate --</option>
                    {filteredCandidates.map(c => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={alreadyInvitedEmails.has(c.email)}
                        className={alreadyInvitedEmails.has(c.email) ? 'text-gray-400' : ''}
                      >
                        {c.full_name} ({c.email}){alreadyInvitedEmails.has(c.email) ? ' — already invited' : ''}
                      </option>
                    ))}
                  </select>
                  {filteredCandidates.length === 0 && (
                    <p className="text-sm text-red-500 mt-1">No candidates match your search.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires In (hours)</label>
                  <input
                    type="number"
                    value={inviteForm.expires_in_hours}
                    onChange={e => setInviteForm({ ...inviteForm, expires_in_hours: parseInt(e.target.value) })}
                    className="input"
                    min="1"
                    max="720"
                  />
                  <p className="text-xs text-gray-500 mt-1">Default: 72 hours (3 days)</p>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => { setShowInviteModal(false); setCandidateSearch(''); }} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!inviteForm.candidate_id}>
                    Send Invitation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Invite Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Bulk Invite Candidates</h2>
                <button onClick={() => { setShowBulkModal(false); setSelectedCandidateIds([]); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleBulkInvitations} className="p-6 flex flex-col gap-4 overflow-hidden">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={e => setCandidateSearch(e.target.value)}
                    className="input"
                    placeholder="Filter candidates..."
                  />
                </div>

                <div className="overflow-y-auto flex-1 border rounded-lg divide-y max-h-72">
                  {filteredCandidates.length === 0 ? (
                    <p className="text-center text-gray-500 py-6">No candidates found</p>
                  ) : filteredCandidates.map(c => {
                    const invited = alreadyInvitedEmails.has(c.email);
                    const selected = selectedCandidateIds.includes(c.id);
                    return (
                      <label key={c.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${invited ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={invited}
                          onChange={() => !invited && toggleCandidateSelection(c.id)}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{c.full_name}</div>
                          <div className="text-gray-500 text-xs truncate">{c.email}{invited ? ' — already invited' : ''}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                      </label>
                    );
                  })}
                </div>

                <p className="text-sm text-gray-600">{selectedCandidateIds.length} candidate{selectedCandidateIds.length !== 1 ? 's' : ''} selected</p>

                <div className="flex items-center justify-end space-x-3 pt-2 border-t">
                  <button type="button" onClick={() => { setShowBulkModal(false); setSelectedCandidateIds([]); }} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={selectedCandidateIds.length === 0}>
                    Send {selectedCandidateIds.length > 0 ? selectedCandidateIds.length : ''} Invitation{selectedCandidateIds.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>

    {/* Reset Attempt Modal */}
    {resetModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset Attempt</h3>
          <p className="text-sm text-gray-600 mb-4">Please provide a reason for resetting this candidate's attempt.</p>
          <textarea
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value)}
            placeholder="Enter reason for reset..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setResetModal(null); setResetReason(''); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReset}
              disabled={!resetReason.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
