import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import WhiteboardCanvas from '../components/WhiteboardCanvas';

// Supported programming languages (Piston API)
const LANGUAGES = [
  { value: 'python',     label: 'Python 3',    defaultCode: 'print("Hello, World!")' },
  { value: 'javascript', label: 'JavaScript',  defaultCode: 'console.log("Hello, World!");' },
  { value: 'typescript', label: 'TypeScript',  defaultCode: 'const msg: string = "Hello, World!";\nconsole.log(msg);' },
  { value: 'java',       label: 'Java',        defaultCode: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}' },
  { value: 'cpp',        label: 'C++',         defaultCode: '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "Hello, World!" << endl;\n  return 0;\n}' },
  { value: 'c',          label: 'C',           defaultCode: '#include <stdio.h>\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}' },
  { value: 'csharp',     label: 'C#',          defaultCode: 'using System;\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, World!");\n  }\n}' },
  { value: 'go',         label: 'Go',          defaultCode: 'package main\nimport "fmt"\nfunc main() {\n  fmt.Println("Hello, World!")\n}' },
  { value: 'rust',       label: 'Rust',        defaultCode: 'fn main() {\n  println!("Hello, World!");\n}' },
  { value: 'ruby',       label: 'Ruby',        defaultCode: 'puts "Hello, World!"' },
  { value: 'php',        label: 'PHP',         defaultCode: '<?php\necho "Hello, World!";\n?>' },
  { value: 'swift',      label: 'Swift',       defaultCode: 'print("Hello, World!")' },
  { value: 'kotlin',     label: 'Kotlin',      defaultCode: 'fun main() {\n  println("Hello, World!")\n}' },
  { value: 'scala',      label: 'Scala',       defaultCode: 'object Main extends App {\n  println("Hello, World!")\n}' },
  { value: 'r',          label: 'R',           defaultCode: 'cat("Hello, World!\\n")' },
  { value: 'bash',       label: 'Bash',        defaultCode: 'echo "Hello, World!"' },
];

// ─── Small reusable video tile ──────────────────────────────────────────────────
function VideoTile({ stream, label, muted = false, badge = '', className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-300">
              {label?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="text-xs">{label || 'No video'}</span>
          </div>
        </div>
      )}
      {label && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
          <span className="text-white text-xs truncate max-w-[70%]">{label}</span>
          {badge && (
            <span className="text-xs bg-indigo-600/80 text-white px-1.5 py-0.5 rounded">{badge}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Icon helpers ───────────────────────────────────────────────────────────────
const IconMicOn  = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
const IconMicOff = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>;
const IconCamOn  = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const IconCamOff = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>;
const IconScreen = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const IconRun    = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function InterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ─── Guest (anonymous candidate) state ────────────────────────────────────────
  const [guestUser, setGuestUser]         = useState(null);
  const [guestName, setGuestName]         = useState('');
  const [joiningAsGuest, setJoiningAsGuest] = useState(false);
  // The effective user is the logged-in user OR the just-registered guest
  const effectiveUser = user || guestUser;

  // ─── Phase: 'prejoin' → 'room' (or 'expired') ────────────────────────────────
  const [phase, setPhase] = useState('prejoin');
  const previewVideoRef  = useRef(null);

  // State
  const [interview, setInterview]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState('meeting');
  const [participants, setParticipants] = useState([]);

  // Code editor
  const [code, setCode]             = useState(LANGUAGES[0].defaultCode);
  const [language, setLanguage]     = useState(LANGUAGES[0].value);
  const [stdin, setStdin]           = useState('');
  const [output, setOutput]         = useState('');
  const [outputType, setOutputType] = useState(''); // 'success' | 'error' | ''

  // Whiteboard
  const [wbCandidateCanEdit, setWbCandidateCanEdit] = useState(false);
  const [executing, setExecuting]   = useState(false);

  // Media
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});  // userId → MediaStream
  const [screenStream, setScreenStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaReady, setMediaReady]     = useState(false);
  const [endConfirm, setEndConfirm]     = useState(false);

  // Refs (stable across re-renders)
  const socketRef          = useRef(null);
  const peerConnRef        = useRef({});        // userId → RTCPeerConnection
  const localStreamRef     = useRef(null);      // always-current local stream
  const editorRef          = useRef(null);
  const codeDebounceRef    = useRef(null);
  const pendingCandidates  = useRef({});        // userId → RTCIceCandidate[]
  const wbRef              = useRef(null);       // WhiteboardCanvas imperative API

  const isInterviewer = effectiveUser?.role === 'interviewer' || effectiveUser?.role === 'admin';
  const isCandidate   = effectiveUser?.role === 'candidate';

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  // ─── Keep localStreamRef current ──────────────────────────────────────────────
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // ─── Guest join handler ────────────────────────────────────────────────────────
  const handleGuestJoin = async (e) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    setJoiningAsGuest(true);
    try {
      const res = await api.post(`/interviews/${id}/guest-join`, { name });
      const { access_token, user: guest } = res.data;
      sessionStorage.setItem('guest-token', access_token);
      setGuestUser(guest);
      toast.success(`Welcome, ${guest.full_name}!`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to join interview');
    } finally {
      setJoiningAsGuest(false);
    }
  };

  // ─── Load interview details ────────────────────────────────────────────────────
  useEffect(() => {
    if (!effectiveUser) return;  // wait until we have a user (guest or logged-in)
    api.get(`/interviews/${id}`)
      .then(r => {
        const data = r.data;
        // Expiry check: scheduled_at + duration_minutes + 30 min
        const expiry = new Date(data.scheduled_at).getTime() + (data.duration_minutes + 30) * 60000;
        if (Date.now() > expiry) {
          setInterview(data);
          setLoading(false);
          setPhase('expired');
          return;
        }
        setInterview(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load interview');
        navigate(user ? '/dashboard' : '/');
      });
  }, [id, navigate, effectiveUser]);

  // ─── Media initialisation (starts immediately for pre-join preview) ──────────
  useEffect(() => {
    if (!effectiveUser) return;  // start media as soon as we know the user (preview)

    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        setLocalStream(stream);
        localStreamRef.current = stream;
        setMediaReady(true);

        // Wire preview video element if in pre-join phase
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }

        // Auto screen-share for candidate (only when entering room)
        if (isCandidate && phase === 'room') {
          try {
            const screen = await navigator.mediaDevices.getDisplayMedia({
              video: { displaySurface: 'monitor', cursor: 'always' },
              audio: false,
            });
            if (!mounted) { screen.getTracks().forEach(t => t.stop()); return; }
            setScreenStream(screen);
            setScreenSharing(true);
            screen.getVideoTracks()[0].onended = () => {
              setScreenStream(null);
              setScreenSharing(false);
              toast.info('Screen sharing stopped');
            };
            toast.success('Screen sharing started');
          } catch {
            toast.error('Please share your screen — it is required for this interview');
          }
        }
      } catch (err) {
        console.error('Media error:', err);
        toast.error('Camera/microphone access denied — please allow and refresh');
      }
    })();

    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUser]);

  // ─── WebRTC peer connection factory ───────────────────────────────────────────
  const createPeerConnection = useCallback((userId, initiator) => {
    // Close stale connection if existing
    if (peerConnRef.current[userId]) {
      peerConnRef.current[userId].close();
      delete peerConnRef.current[userId];
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnRef.current[userId] = pc;

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(t =>
      pc.addTrack(t, localStreamRef.current)
    );

    // Remote stream arrives
    pc.ontrack = e => {
      const s = e.streams[0];
      if (s) setRemoteStreams(prev => ({ ...prev, [userId]: s }));
    };

    // ICE candidate
    pc.onicecandidate = e => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-ice-candidate', {
          to: userId, interviewId: id, candidate: e.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] ${userId} → ${state}`);
      if (state === 'failed') pc.restartIce();
    };

    if (initiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(o => pc.setLocalDescription(o))
        .then(() => {
          socketRef.current?.emit('webrtc-offer', {
            to: userId, interviewId: id, offer: pc.localDescription,
          });
        })
        .catch(console.error);
    }

    return pc;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Sync preview video element when local stream or phase changes ──────────
  useEffect(() => {
    if (phase === 'prejoin' && previewVideoRef.current && localStream) {
      previewVideoRef.current.srcObject = localStream;
    }
  }, [localStream, phase]);

  // ─── Socket.IO (only after user clicks "Join Now") ────────────────────────────
  useEffect(() => {
    if (!interview || !effectiveUser || !mediaReady || phase !== 'room') return;

    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('join-interview', {
        interviewId: id, userId: effectiveUser.id,
        userName: effectiveUser.full_name, userRole: effectiveUser.role,
      });
    });

    // Existing participants when we join
    // WE (the new joiner) are the initiator for every existing peer.
    socket.on('participants-list', ({ participants: list }) => {
      // Exclude self from state so user-joined won't double-add us
      const others = (list || []).filter(p => p.userId !== effectiveUser?.id);
      setParticipants(others);
      // Start WebRTC handshake with every peer already in the room
      others.forEach(p => createPeerConnection(p.userId, true));
      // Request whiteboard state sync if there are already people in the room
      if (others.length > 0) {
        socket.emit('whiteboard-request-sync', {
          interviewId: id,
          requesterId: effectiveUser?.id,
        });
      }
    });

    // A new participant joined — update state only; do NOT initiate WebRTC
    // (the new joiner is the initiator; we are the responder and will get an offer)
    socket.on('user-joined', data => {
      // Ignore self echo
      if (data.userId === effectiveUser?.id) return;
      toast.success(`${data.userName} joined`);
      setParticipants(prev => [
        ...prev.filter(p => p.userId !== data.userId),
        { userId: data.userId, userName: data.userName, userRole: data.userRole },
      ]);
    });

    // Participant left
    socket.on('user-left', data => {
      toast.info(`${data.userName || 'Someone'} left`);
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      peerConnRef.current[data.userId]?.close();
      delete peerConnRef.current[data.userId];
      setRemoteStreams(prev => { const n = { ...prev }; delete n[data.userId]; return n; });
    });

    // Interviewer switches tab → candidate screen auto-follows
    socket.on('tab-switched', data => {
      if (isCandidate && (data.userRole === 'interviewer' || data.userRole === 'admin')) {
        setActiveTab(data.tab);
        const TAB_LABELS = {
          code:       '💻 Switched to Code Editor',
          meeting:    '👥 Switched to Meeting',
          whiteboard: '🎨 Switched to Whiteboard',
        };
        toast.info(TAB_LABELS[data.tab] || `Switched to ${data.tab}`);
      }
    });

    // Collaborative code sync
    socket.on('code-changed', data => {
      if (data.userId !== effectiveUser?.id) {
        setCode(data.code ?? '');
        if (data.language) setLanguage(data.language);
      }
    });

    // Execution result broadcast (from whoever ran the code)
    socket.on('code-executed', data => {
      if (data.userId !== effectiveUser?.id) {
        setOutput(data.output ?? '');
        setOutputType(data.outputType ?? (data.success ? 'success' : 'error'));
      }
    });

    // ── Whiteboard collaboration ──────────────────────────────────────────
    // Remote stroke committed
    socket.on('whiteboard-stroke', data => {
      if (data.userId !== effectiveUser?.id) {
        wbRef.current?.applyStroke(data.stroke);
      }
    });
    // Remote undo
    socket.on('whiteboard-undo', data => {
      if (data.userId !== effectiveUser?.id) {
        wbRef.current?.applyUndo(data.strokeId);
      }
    });
    // Remote clear
    socket.on('whiteboard-clear', () => {
      wbRef.current?.applyClear();
    });
    // A newly joined peer requests our current board state
    socket.on('whiteboard-sync-request', data => {
      const strokes = wbRef.current?.getStrokes() ?? [];
      if (strokes.length > 0) {
        socket.emit('whiteboard-sync-response', {
          interviewId: id,
          targetUserId: data.requesterId,
          strokes,
        });
      }
    });
    // Receive full board state (response to our own request-sync)
    socket.on('whiteboard-sync', data => {
      if (data.strokes?.length > 0) {
        wbRef.current?.applyStrokes(data.strokes);
        toast.info('🎨 Whiteboard synced');
      }
    });
    // Interviewer toggled candidate edit access
    socket.on('whiteboard-access', data => {
      setWbCandidateCanEdit(data.canEdit);
      if (isCandidate) {
        toast(data.canEdit ? '✏️ You can now draw on the whiteboard' : '👁️ Whiteboard switched to view-only', {
          icon: data.canEdit ? '✏️' : '🔒',
        });
      }
    });

    // ── WebRTC signalling ─────────────────────────────────────────────────────
    socket.on('webrtc-offer', async ({ from, offer }) => {
      console.log('Received offer from', from);
      let pc = peerConnRef.current[from];
      if (!pc || pc.signalingState === 'closed') {
        pc = createPeerConnection(from, false);
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Flush buffered ICE candidates
        (pendingCandidates.current[from] || []).forEach(c => pc.addIceCandidate(c).catch(() => {}));
        pendingCandidates.current[from] = [];
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        socket.emit('webrtc-answer', { to: from, interviewId: id, answer: pc.localDescription });
      } catch (e) { console.error('offer error', e); }
    });

    socket.on('webrtc-answer', async ({ from, answer }) => {
      const pc = peerConnRef.current[from];
      if (pc && pc.signalingState !== 'closed') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); }
        catch (e) { console.error('answer error', e); }
      }
    });

    socket.on('webrtc-ice-candidate', async ({ from, candidate }) => {
      const pc = peerConnRef.current[from];
      if (!pc || pc.signalingState === 'closed') return;
      const iceCandidate = new RTCIceCandidate(candidate);
      if (pc.remoteDescription) {
        pc.addIceCandidate(iceCandidate).catch(() => {});
      } else {
        // Buffer until remote desc is set
        pendingCandidates.current[from] = pendingCandidates.current[from] || [];
        pendingCandidates.current[from].push(iceCandidate);
      }
    });

    return () => {
      socket.disconnect();
      Object.values(peerConnRef.current).forEach(pc => pc.close());
      peerConnRef.current = {};
    };
  }, [interview, effectiveUser, mediaReady, phase, id, isCandidate, createPeerConnection]);

  // ─── Tab change ────────────────────────────────────────────────────────────────
  const handleTabChange = tab => {
    setActiveTab(tab);
    // Interviewer broadcasts tab change to all (candidate auto-follows)
    if (isInterviewer) {
      socketRef.current?.emit('switch-tab', {
        interviewId: id, tab, userId: effectiveUser?.id, userRole: effectiveUser?.role,
      });
    }
  };

  // ─── Code editor ──────────────────────────────────────────────────────────────
  const handleCodeChange = val => {
    setCode(val);
    clearTimeout(codeDebounceRef.current);
    codeDebounceRef.current = setTimeout(() => {
      socketRef.current?.emit('code-change', {
        interviewId: id, code: val, language, userId: effectiveUser?.id,
      });
    }, 250);
  };

  const handleLanguageChange = lang => {
    const def = LANGUAGES.find(l => l.value === lang)?.defaultCode || '';
    setLanguage(lang);
    setCode(def);
    setOutput('');
    setOutputType('');
    socketRef.current?.emit('code-change', {
      interviewId: id, code: def, language: lang, userId: effectiveUser?.id,
    });
  };

  // ─── Code execution (Piston API via backend) ──────────────────────────────────
  const executeCode = async () => {
    if (!code.trim()) { toast.error('Write some code first'); return; }
    setExecuting(true);
    setOutput('Running…');
    setOutputType('');
    try {
      const { data } = await api.post('/code/execute', {
        code, language, stdin: stdin.trim() || null,
      });
      const out = data.stdout || data.stderr || data.output || data.error || '(no output)';
      setOutput(out);
      const resolvedOutputType = data.success ? 'success' : 'error';
      setOutputType(resolvedOutputType);
      socketRef.current?.emit('code-execute', {
        interviewId: id, output: out, success: data.success, outputType: resolvedOutputType, userId: effectiveUser?.id,
      });
      data.success ? toast.success('Executed') : toast.error('Runtime error');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Execution failed';
      setOutput(msg);
      setOutputType('error');
      toast.error(msg);
    } finally {
      setExecuting(false);
    }
  };

  // ─── Whiteboard collaboration callbacks ──────────────────────────────────────
  const handleWbStroke = useCallback((stroke) => {
    socketRef.current?.emit('whiteboard-stroke', {
      interviewId: id, stroke, userId: effectiveUser?.id,
    });
  }, [id, effectiveUser]);

  const handleWbUndo = useCallback((strokeId) => {
    socketRef.current?.emit('whiteboard-undo', {
      interviewId: id, strokeId, userId: effectiveUser?.id,
    });
  }, [id, effectiveUser]);

  const handleWbClear = useCallback(() => {
    socketRef.current?.emit('whiteboard-clear', {
      interviewId: id, userId: effectiveUser?.id,
    });
  }, [id, effectiveUser]);

  const handleWbAccessToggle = useCallback(() => {
    const next = !wbCandidateCanEdit;
    setWbCandidateCanEdit(next);
    socketRef.current?.emit('whiteboard-access', {
      interviewId: id, canEdit: next, userId: effectiveUser?.id,
    });
    toast.success(next ? '✏️ Candidate can now draw' : '🔒 Candidate drawing disabled');
  }, [id, effectiveUser, wbCandidateCanEdit]);

  // ─── Screen sharing ────────────────────────────────────────────────────────────
  const startScreenShare = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', displaySurface: 'monitor' }, audio: false,
      });
      const vt = screen.getVideoTracks()[0];
      setScreenStream(screen);
      setScreenSharing(true);
      // Replace video track in all peer connections
      Object.values(peerConnRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(vt);
      });
      vt.onended = stopScreenShare;
    } catch { toast.error('Screen share cancelled'); }
  };

  const stopScreenShare = () => {
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setScreenSharing(false);
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    if (camTrack) {
      Object.values(peerConnRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(camTrack);
      });
    }
  };

  const toggleAudio = () => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setAudioEnabled(t.enabled); }
  };

  const toggleVideo = () => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setVideoEnabled(t.enabled); }
  };

  const endInterview = () => {
    if (isInterviewer) {
      setEndConfirm(true);
      return;
    }
    // Guests (anonymous candidates) have no dashboard — take them to the homepage
    if (guestUser) {
      sessionStorage.removeItem('guest-token');
      navigate('/');
    } else {
      navigate('/dashboard');
    }
  };

  // ─── Helpers – pick remote peers by role ──────────────────────────────────────
  const remoteList = Object.entries(remoteStreams).map(([uid, stream]) => ({
    uid, stream,
    info: participants.find(p => p.userId === uid),
  }));
  const remoteCandidate   = remoteList.find(p => p.info?.userRole === 'candidate');
  const remoteInterviewer = remoteList.find(
    p => p.info?.userRole === 'interviewer' || p.info?.userRole === 'admin'
  );

  // ─── Pre-join lobby (for ALL users) ──────────────────────────────────────────
  if (phase === 'prejoin' || (!user && !guestUser)) {
    // For guests: first complete name entry, then show pre-join lobby
    const guestNeedsName = !user && !guestUser;

    const handleJoinNow = async () => {
      if (guestNeedsName) return; // shouldn't happen but guard
      setPhase('room');
      // Trigger screen-share for candidate when entering room
      if (isCandidate && localStream) {
        try {
          const screen = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'monitor', cursor: 'always' }, audio: false,
          });
          setScreenStream(screen);
          setScreenSharing(true);
          screen.getVideoTracks()[0].onended = () => {
            setScreenStream(null); setScreenSharing(false);
            toast.info('Screen sharing stopped');
          };
          toast.success('Screen sharing started');
        } catch {
          toast.error('Please share your screen — it is required for this interview');
        }
      }
    };

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {guestNeedsName ? "You're invited to an interview" : 'Ready to join?'}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Room: <span className="font-mono text-indigo-400">{id}</span>
              {interview?.position && <span className="ml-2 text-gray-300">· {interview.position}</span>}
            </p>
          </div>

          {guestNeedsName ? (
            /* ── Guest name entry ── */
            <div className="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-1">Enter the room</h2>
              <p className="text-gray-400 text-sm mb-6">
                Please enter your full name so the interviewer knows who you are.
              </p>
              <form onSubmit={handleGuestJoin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Your full name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    required
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={joiningAsGuest || !guestName.trim()}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {joiningAsGuest ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Joining…</>
                  ) : 'Continue'}
                </button>
              </form>
            </div>
          ) : (
            /* ── Camera / mic preview lobby ── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Camera preview */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="relative aspect-video bg-gray-800 flex items-center justify-center">
                  {mediaReady ? (
                    <video
                      ref={previewVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${!videoEnabled ? 'opacity-0' : ''}`}
                    />
                  ) : (
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Requesting camera…</p>
                    </div>
                  )}
                  {mediaReady && !videoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-2">
                          <span className="text-2xl">{effectiveUser?.full_name?.[0]?.toUpperCase() || '?'}</span>
                        </div>
                        <p className="text-gray-400 text-sm">Camera is off</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Controls */}
                <div className="p-4 flex items-center justify-center gap-4">
                  <button
                    onClick={toggleAudio}
                    title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                      audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-700 hover:bg-red-600'
                    }`}
                  >
                    {audioEnabled ? <IconMicOn /> : <IconMicOff />}
                    <span className="text-xs text-gray-300">{audioEnabled ? 'Mute' : 'Unmuted'}</span>
                  </button>
                  <button
                    onClick={toggleVideo}
                    title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-colors ${
                      videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-700 hover:bg-red-600'
                    }`}
                  >
                    {videoEnabled ? <IconCamOn /> : <IconCamOff />}
                    <span className="text-xs text-gray-300">{videoEnabled ? 'Camera On' : 'Camera Off'}</span>
                  </button>
                </div>
              </div>

              {/* Right panel — interview info + join button */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Interview Details</h2>
                  {interview ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Position</span>
                        <span className="text-white font-medium">{interview.position || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Type</span>
                        <span className="text-white capitalize">{interview.interview_type || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration</span>
                        <span className="text-white">{interview.duration_minutes} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Scheduled</span>
                        <span className="text-white">
                          {new Date(interview.scheduled_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Loading details…</p>
                  )}

                  <div className="mt-6 p-3 rounded-lg bg-gray-800 border border-gray-700">
                    <p className="text-xs text-gray-400">
                      Joining as{' '}
                      <span className="text-white font-semibold">{effectiveUser?.full_name}</span>
                      {' '}·{' '}
                      <span className="text-indigo-400 capitalize">{effectiveUser?.role}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <button
                    onClick={handleJoinNow}
                    disabled={!mediaReady}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {mediaReady ? (
                      <>Join Interview</>
                    ) : (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting up media…</>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    {isCandidate
                      ? 'You will be asked to share your screen after joining.'
                      : 'Your camera and microphone will be active in the interview.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-indigo-500 mx-auto" />
          <p className="mt-4 text-gray-400 text-sm">Loading interview room…</p>
        </div>
      </div>
    );
  }

  // ─── Expired ──────────────────────────────────────────────────────────────────
  if (phase === 'expired') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-700/30 mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Interview Session Expired</h1>
          <p className="text-gray-400 text-sm mb-6">
            This interview session ({interview?.position || 'Unknown'}) is no longer active.
            Sessions expire {interview?.duration_minutes} minutes after the scheduled start time plus a 30-minute grace period.
          </p>
          <button
            onClick={() => navigate(user ? '/dashboard' : '/')}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
          >
            {user ? 'Back to Dashboard' : 'Go to Homepage'}
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
  <>
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden select-none">

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════════ */}
      <header className="shrink-0 flex items-center justify-between px-5 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          {/* Live dot */}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-semibold truncate max-w-[220px]">{interview?.position}</span>
          </span>

          <span className="text-xs border border-gray-700 rounded px-2 py-0.5 text-gray-400">
            {participants.length + 1} participant{participants.length + 1 !== 1 ? 's' : ''}
          </span>

          {isInterviewer && (
            <span className="text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 rounded px-2 py-0.5">
              👑 Room Controller
            </span>
          )}
          {isCandidate && (
            <span className="text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 rounded px-2 py-0.5">
              🎓 Candidate
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mute */}
          <button
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            className={`p-2 rounded-lg transition-colors ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-700 hover:bg-red-600'}`}
          >
            {audioEnabled ? <IconMicOn /> : <IconMicOff />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleVideo}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            className={`p-2 rounded-lg transition-colors ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-700 hover:bg-red-600'}`}
          >
            {videoEnabled ? <IconCamOn /> : <IconCamOff />}
          </button>

          {/* Screen share */}
          <button
            onClick={screenSharing ? stopScreenShare : startScreenShare}
            title={screenSharing ? 'Stop sharing' : 'Share screen'}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${screenSharing ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-600'}`}
          >
            <IconScreen />
            <span className="text-xs hidden sm:inline">{screenSharing ? 'Stop' : 'Share'}</span>
          </button>

          {/* End / Leave */}
          <button
            onClick={endInterview}
            className="px-4 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
          >
            {isInterviewer ? '⏹ End Interview' : 'Leave'}
          </button>
        </div>
      </header>

      {/* ══ TAB BAR ══════════════════════════════════════════════════════════════ */}
      <nav className="shrink-0 flex items-center px-4 bg-gray-900 border-b border-gray-800">
        {[
          { id: 'meeting',    label: '👥 Meeting'     },
          { id: 'code',       label: '💻 Code Editor' },
          { id: 'whiteboard', label: '🎨 Whiteboard'  },
        ].map(({ id: tabId, label }) => (
          <button
            key={tabId}
            onClick={() => handleTabChange(tabId)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tabId
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
        {isCandidate && (
          <span className="ml-auto text-xs text-gray-600 pr-1 hidden sm:block">
            Tab follows interviewer
          </span>
        )}
      </nav>

      {/* ══ MAIN CONTENT ═════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-hidden">

        {/* ── MEETING TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'meeting' && (
          <div className="h-full relative bg-black">

            {/* ── INTERVIEWER: candidate as main + own PiP ── */}
            {isInterviewer && (
              <>
                {/* Main: candidate's video/screen */}
                {remoteCandidate ? (
                  <VideoTile
                    stream={remoteCandidate.stream}
                    label={remoteCandidate.info?.userName || 'Candidate'}
                    badge="Candidate"
                    className="w-full h-full rounded-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-600">
                    <IconCamOff />
                    <p>Waiting for candidate to join…</p>
                  </div>
                )}
                {/* Anti-cheat badge */}
                {remoteCandidate && (
                  <div className="absolute top-4 left-4 bg-red-700/80 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-10">
                    <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />
                    Candidate Monitoring Active
                  </div>
                )}
                {/* Own PiP */}
                <div className="absolute bottom-5 right-5 w-52 h-36 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl z-10">
                  <VideoTile stream={localStream} label="You" muted className="w-full h-full rounded-none" />
                </div>
              </>
            )}

            {/* ── CANDIDATE: interviewer as main + own PiP ── */}
            {isCandidate && (
              <>
                {/* Main: interviewer's video */}
                {remoteInterviewer ? (
                  <VideoTile
                    stream={remoteInterviewer.stream}
                    label={remoteInterviewer.info?.userName || 'Interviewer'}
                    badge="Interviewer"
                    className="w-full h-full rounded-none"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-600">
                    <IconCamOff />
                    <p>Waiting for interviewer to join…</p>
                  </div>
                )}
                {/* Screen share indicator */}
                {screenSharing && (
                  <div className="absolute top-4 left-4 bg-blue-700/80 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-10">
                    <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
                    Screen sharing active
                  </div>
                )}
                {/* Own PiP (shows screen stream if sharing, else camera) */}
                <div className="absolute bottom-5 right-5 w-52 h-36 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl z-10">
                  <VideoTile
                    stream={screenSharing ? screenStream : localStream}
                    label="You"
                    muted
                    className="w-full h-full rounded-none"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── WHITEBOARD TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'whiteboard' && (
          <div className="h-full flex overflow-hidden">
            {/* Whiteboard canvas — editing for interviewer, view-only for candidate */}
            <div className="flex-1 overflow-hidden">
              <WhiteboardCanvas
                ref={wbRef}
                onStroke={handleWbStroke}
                onUndo={handleWbUndo}
                onClear={handleWbClear}
                readOnly={isCandidate && !wbCandidateCanEdit}
              />
            </div>

            {/* ── Video sidebar (mirrors code tab layout) ─────────────────── */}
            <aside className="shrink-0 w-72 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto">
              {isInterviewer && (
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Candidate Monitor</span>
                  </div>
                  {remoteCandidate ? (
                    <VideoTile
                      stream={remoteCandidate.stream}
                      label={remoteCandidate.info?.userName || 'Candidate'}
                      badge="Candidate"
                      className="w-full h-48"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600 text-sm">
                      Candidate not connected
                    </div>
                  )}
                  <div className="border-t border-gray-800 pt-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">You</span>
                    <VideoTile stream={localStream} label="You" muted className="w-full h-32" />
                  </div>
                </div>
              )}
              {isCandidate && (
                <div className="flex flex-col gap-3 p-3">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Interviewer</span>
                  {remoteInterviewer ? (
                    <VideoTile
                      stream={remoteInterviewer.stream}
                      label={remoteInterviewer.info?.userName || 'Interviewer'}
                      badge="Interviewer"
                      className="w-full h-44"
                    />
                  ) : (
                    <div className="w-full h-44 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600 text-sm">
                      Interviewer not connected
                    </div>
                  )}
                  <div className="border-t border-gray-800 pt-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">You</span>
                    <VideoTile
                      stream={screenSharing ? screenStream : localStream}
                      label="You"
                      muted
                      className="w-full h-32"
                    />
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ── CODE EDITOR TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'code' && (
          <div className="h-full flex overflow-hidden">

            {/* Editor + I/O */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

              {/* Toolbar */}
              <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Language</span>
                  <select
                    value={language}
                    onChange={e => handleLanguageChange(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-600 hidden lg:block">
                    Powered by Piston API — 16+ languages
                  </span>
                </div>

                <button
                  onClick={executeCode}
                  disabled={executing}
                  className={`flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    executing
                      ? 'bg-gray-700 cursor-not-allowed'
                      : 'bg-green-700 hover:bg-green-600 active:bg-green-800'
                  }`}
                >
                  {executing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Running…
                    </>
                  ) : (
                    <><IconRun /> ▶ Run</>
                  )}
                </button>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={handleCodeChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    quickSuggestions: true,
                    suggestOnTriggerCharacters: true,
                    folding: true,
                    bracketPairColorization: { enabled: true },
                    cursorBlinking: 'smooth',
                    renderWhitespace: 'selection',
                  }}
                  onMount={e => { editorRef.current = e; }}
                />
              </div>

              {/* Input / Output panel */}
              <div className="shrink-0 h-44 flex border-t border-gray-800">
                {/* stdin */}
                <div className="w-2/5 flex flex-col bg-gray-900 border-r border-gray-800 p-3 gap-1.5">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">stdin</span>
                  <textarea
                    value={stdin}
                    onChange={e => setStdin(e.target.value)}
                    placeholder="Optional input for your program…"
                    className="flex-1 bg-gray-950 text-sm text-white font-mono p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                {/* stdout / stderr */}
                <div className="flex-1 flex flex-col bg-gray-900 p-3 gap-1.5">
                  <span className={`text-xs uppercase tracking-wider ${
                    outputType === 'success' ? 'text-green-400'
                    : outputType === 'error' ? 'text-red-400'
                    : 'text-gray-500'
                  }`}>
                    {outputType === 'success' ? '✔ Output' : outputType === 'error' ? '✖ Error / stderr' : 'Output'}
                  </span>
                  <pre className={`flex-1 font-mono text-sm overflow-auto bg-gray-950 p-2 rounded-lg border whitespace-pre-wrap ${
                    outputType === 'success' ? 'border-green-900 text-green-300'
                    : outputType === 'error' ? 'border-red-900 text-red-300'
                    : 'border-gray-700 text-gray-300'
                  }`}>
                    {output || 'Output will appear here…'}
                  </pre>
                </div>
              </div>
            </div>

            {/* ── Video sidebar (role-differentiated) ─────── */}
            <aside className="shrink-0 w-72 bg-gray-900 border-l border-gray-800 flex flex-col gap-0 overflow-y-auto">

              {/* INTERVIEWER in code tab: large candidate monitor */}
              {isInterviewer && (
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Candidate Monitor</span>
                  </div>
                  {remoteCandidate ? (
                    <VideoTile
                      stream={remoteCandidate.stream}
                      label={remoteCandidate.info?.userName || 'Candidate'}
                      badge="Candidate"
                      className="w-full h-48"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600 text-sm">
                      Candidate not connected
                    </div>
                  )}
                  <div className="border-t border-gray-800 pt-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">You</span>
                    <VideoTile stream={localStream} label="You" muted className="w-full h-32" />
                  </div>
                </div>
              )}

              {/* CANDIDATE in code tab: interviewer PiP + own feed */}
              {isCandidate && (
                <div className="flex flex-col gap-3 p-3">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Interviewer</span>
                  {remoteInterviewer ? (
                    <VideoTile
                      stream={remoteInterviewer.stream}
                      label={remoteInterviewer.info?.userName || 'Interviewer'}
                      badge="Interviewer"
                      className="w-full h-44"
                    />
                  ) : (
                    <div className="w-full h-44 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600 text-sm">
                      Interviewer not connected
                    </div>
                  )}
                  <div className="border-t border-gray-800 pt-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">
                      You {screenSharing && <span className="text-blue-400 ml-1">(screen)</span>}
                    </span>
                    <VideoTile
                      stream={screenSharing ? screenStream : localStream}
                      label="You"
                      muted
                      className="w-full h-32"
                    />
                    {screenSharing && (
                      <p className="text-xs text-center text-blue-400 mt-1.5">🖥 Screen sharing active</p>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
    {endConfirm && (
      <ConfirmModal
        title="End Interview"
        message="This will end the interview session for everyone. Are you sure?"
        confirmLabel="End for Everyone"
        danger={true}
        onConfirm={() => {
          setEndConfirm(false);
          if (guestUser) {
            sessionStorage.removeItem('guest-token');
            navigate('/');
          } else {
            navigate('/dashboard');
          }
        }}
        onCancel={() => setEndConfirm(false)}
      />
    )}
  </>
  );
}
