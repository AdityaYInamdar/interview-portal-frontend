import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import api from '../services/api';

const VIOLATION_META = {
  tab_switch:        { label: 'Tab Switch',        color: 'bg-orange-100 text-orange-800',  icon: '🔀' },
  window_blur:       { label: 'Window Switch',      color: 'bg-orange-100 text-orange-800',  icon: '🪟' },
  multiple_monitors: { label: 'Multiple Monitors',  color: 'bg-red-100    text-red-800',     icon: '🖥️' },
  copy_attempt:      { label: 'Copy Attempt',       color: 'bg-yellow-100 text-yellow-800',  icon: '📋' },
  paste_attempt:     { label: 'Paste Attempt',      color: 'bg-yellow-100 text-yellow-800',  icon: '📋' },
};

function ViolationBadge({ type }) {
  const meta = VIOLATION_META[type] || { label: type, color: 'bg-gray-100 text-gray-700', icon: '⚠️' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

export default function AdminViolations() {
  const { testId, sessionId } = useParams();
  const [clips, setClips] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeClip, setActiveClip] = useState(null);

  useEffect(() => {
    fetchClips();
    fetchSession();
  }, [sessionId]);

  const fetchClips = async () => {
    try {
      const res = await api.get(`/sessions/admin/session/${sessionId}/violation-clips`);
      setClips(res.data || []);
    } catch (err) {
      console.error('Failed to fetch violation clips:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSession = async () => {
    try {
      // Fetch session list for the test and find this session
      const res = await api.get(`/sessions/admin/test/${testId}`);
      const found = (res.data || []).find(s => s.id === sessionId);
      if (found) setSession(found);
    } catch (err) {
      console.error('Failed to fetch session:', err);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
  };

  // group by violation type for the summary bar
  const typeCounts = clips.reduce((acc, c) => {
    acc[c.violation_type] = (acc[c.violation_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/dashboard/tests/${testId}/overview`}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Violation Clips</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {session ? `${session.candidate_name || session.candidate_email} · Session ${sessionId.slice(0, 8)}…` : `Session ${sessionId.slice(0, 8)}…`}
              </p>
            </div>
          </div>
          {clips.length > 0 && (
            <div className="flex items-center gap-2">
              {Object.entries(typeCounts).map(([type, count]) => (
                <span key={type} className="flex items-center gap-1">
                  <ViolationBadge type={type} />
                  <span className="text-xs text-gray-500 font-medium">×{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : clips.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No violations recorded</h3>
            <p className="text-gray-500">No violation clips were captured for this session.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Video thumbnail / player */}
                <div className="relative bg-gray-900 aspect-video">
                  {clip.clip_url ? (
                    <video
                      src={clip.clip_url}
                      controls
                      preload="metadata"
                      className="w-full h-full object-contain"
                      onClick={() => setActiveClip(clip)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-gray-400">No clip available</span>
                    </div>
                  )}
                  {/* Violation type badge overlay */}
                  <div className="absolute top-2 left-2">
                    <ViolationBadge type={clip.violation_type} />
                  </div>
                </div>

                {/* Metadata */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {VIOLATION_META[clip.violation_type]?.label || clip.violation_type}
                    </span>
                    <span className="text-xs text-gray-400">{clip.duration_seconds ?? 8}s clip</span>
                  </div>
                  {clip.description && (
                    <p className="text-xs text-gray-600">{clip.description}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    🕒 {formatTime(clip.occurred_at)}
                  </p>
                  {clip.clip_url && (
                    <a
                      href={clip.clip_url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox / fullscreen player */}
      {activeClip && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setActiveClip(null)}
        >
          <div
            className="relative bg-gray-950 rounded-2xl overflow-hidden shadow-2xl max-w-3xl w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ViolationBadge type={activeClip.violation_type} />
                <span className="text-sm text-gray-300">{formatTime(activeClip.occurred_at)}</span>
              </div>
              <button
                onClick={() => setActiveClip(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <video
              src={activeClip.clip_url}
              controls
              autoPlay
              className="w-full"
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
