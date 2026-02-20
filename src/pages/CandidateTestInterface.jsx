import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import toast from 'react-hot-toast';

// ── Recording constants (used by handleStartTest + stopRecording) ────────────
const CHUNK_MS    = 2000;  // timeslice duration in ms
const PRE_CHUNKS  = 3;     // rolling pre-violation chunks to keep
const POST_CHUNKS = 4;     // post-violation chunks to collect

/**
 * Patch the Duration field inside a MediaRecorder-produced WebM blob.
 * Without this, the Duration element value is 0/-1 (live stream), which
 * prevents video players from buffering/seeking the full clip — they play
 * a few seconds then stall.  We walk the EBML bytes and overwrite the
 * 8-byte float64 Duration value at the known offset.
 */
async function fixWebmDuration(blob, durationMs) {
  try {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // EBML element ID for Duration is 0x4489; MediaRecorder writes it as an
    // 8-byte float64 (size indicator 0x88) in the Segment Info block.
    for (let i = 0; i < bytes.length - 10; i++) {
      if (bytes[i] === 0x44 && bytes[i + 1] === 0x89 && bytes[i + 2] === 0x88) {
        new DataView(buf, i + 3, 8).setFloat64(0, durationMs, false); // big-endian
        break;
      }
    }
    return new Blob([buf], { type: 'video/webm' });
  } catch (e) {
    // If anything goes wrong just return the original blob unchanged
    return blob;
  }
}

export default function CandidateTestInterface() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invitationToken = searchParams.get('token'); // This is the invitation token from URL
  
  const [testStarted, setTestStarted] = useState(false);
  const [test, setTest] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionToken, setSessionToken] = useState(null); // Store session token after starting
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [violations, setViolations] = useState([]);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [showMonitorWarning, setShowMonitorWarning] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedTables, setExpandedTables] = useState({});
  const [startingTest, setStartingTest] = useState(false); // prevent double-click on Start Test
  // Tracks whether screen / webcam permissions have been granted BEFORE starting
  const [permissionsGranted, setPermissionsGranted] = useState({ screen: false, webcam: false });
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  // Shown when the candidate stops screen sharing mid-test (blocks until re-shared)
  const [screenShareStopped, setScreenShareStopped] = useState(false);

  const timerRef = useRef(null);
  // Keep a ref to sessionToken so beforeunload closure always sees latest value
  const sessionTokenRef = useRef(null);
  // Prevent double-submission (timer expiry racing with manual submit)
  const isSubmittingRef = useRef(false);

  // ── Recording / proctoring refs ─────────────────────────────────────────────
  const screenRecorderRef = useRef(null);   // MediaRecorder on screen stream
  const screenStreamRef   = useRef(null);   // getDisplayMedia stream
  const webcamStreamRef   = useRef(null);   // getUserMedia stream
  const webcamVideoRef    = useRef(null);   // <video> element for PiP
  const rollingBufferRef  = useRef([]);     // circular pre-violation buffer
  const initChunkRef      = useRef(null);   // WebM init segment (first chunk) — always prepended
  const captureStateRef   = useRef({        // violation clip state machine
    status: 'idle',  // 'idle' | 'capturing'
    preBlobs: [],
    postBlobs: [],
    type: '',
    desc: '',
    time: null,
  });

  // Grace period: suppress violation events while permission dialogs are open
  const violationGraceRef  = useRef(false);
  const graceTimerRef      = useRef(null);
  // Stable ref to logViolation so event listeners defined before it can call it
  const logViolationRef    = useRef(null);

  // ── State for recording UI ──────────────────────────────────────────────────
  const [webcamActive, setWebcamActive]       = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);

  // Sync ref whenever state changes
  useEffect(() => { sessionTokenRef.current = sessionToken; }, [sessionToken]);

  // Wire webcam srcObject whenever the <video> element may have (re-)mounted.
  // Two scenarios require this:
  //   1. webcamActive becomes true  → element mounts for the first time
  //   2. testStarted becomes true   → entire DOM switches from start-screen to
  //      test UI, remounting the <video> while webcamActive is already true,
  //      so the [webcamActive]-only dependency would never re-fire.
  useEffect(() => {
    if (webcamActive && webcamVideoRef.current && webcamStreamRef.current) {
      if (webcamVideoRef.current.srcObject !== webcamStreamRef.current) {
        webcamVideoRef.current.srcObject = webcamStreamRef.current;
        webcamVideoRef.current.play?.().catch(() => {});
      }
    }
  }, [webcamActive, testStarted]);

  // Parse SQL schema to extract table structure
  const parseSQLSchema = (schema) => {
    if (!schema) return [];
    
    const tables = [];
    const tableRegex = /CREATE TABLE (\w+)\s*\(([\s\S]*?)\);/gi;
    let match;
    
    while ((match = tableRegex.exec(schema)) !== null) {
      const tableName = match[1];
      const columnsText = match[2];
      
      const columns = columnsText
        .split(',')
        .map(col => col.trim())
        .filter(col => col && !col.toUpperCase().startsWith('PRIMARY KEY') && !col.toUpperCase().startsWith('FOREIGN KEY'))
        .map(col => {
          const parts = col.split(/\s+/);
          return {
            name: parts[0],
            type: parts.slice(1).join(' ')
          };
        });
      
      tables.push({ name: tableName, columns });
    }
    
    return tables;
  };

  // Parse SQL seed data to extract table rows
  const parseSQLSeedData = (seedData, tableName) => {
    if (!seedData || !tableName) return [];
    
    const rows = [];
    const insertRegex = new RegExp(`INSERT INTO ${tableName}.*?VALUES\\s*([\\s\\S]*?)(?:;|$)`, 'gi');
    let match;
    
    while ((match = insertRegex.exec(seedData)) !== null) {
      const valuesText = match[1];
      const rowRegex = /\((.*?)\)/g;
      let rowMatch;
      
      while ((rowMatch = rowRegex.exec(valuesText)) !== null) {
        const values = rowMatch[1]
          .split(',')
          .map(v => v.trim().replace(/^'|'$/g, ''));
        rows.push(values);
      }
    }
    
    return rows;
  };

  // Monitor detection and tab switching prevention
  useEffect(() => {
    if (!testStarted) return;

    // Check for multiple monitors
    const checkMultipleMonitors = () => {
      if (window.screen.isExtended || window.screen.mozOrientation) {
        const screenCount = window.screen.availWidth / window.screen.width;
        if (screenCount > 1.1) {
          logViolation('multiple_monitors', 'Multiple monitors detected');
          setShowMonitorWarning(true);
        }
      }
    };

    // Detect tab switching / window blur
    const handleVisibilityChange = () => {
      if (document.hidden && !violationGraceRef.current) {
        logViolation('tab_switch', 'Candidate switched tabs or minimized window');
        setShowViolationWarning(true);
        setTimeout(() => setShowViolationWarning(false), 5000);
      }
    };

    // Detect window blur (switching to another window)
    const handleWindowBlur = () => {
      if (!violationGraceRef.current) {
        logViolation('window_blur', 'Candidate switched to another window');
        setShowViolationWarning(true);
        setTimeout(() => setShowViolationWarning(false), 5000);
      }
    };

    // Prevent right-click
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Check monitors on start
    checkMultipleMonitors();

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', handleContextMenu);

    // Periodic monitor check
    const monitorInterval = setInterval(checkMultipleMonitors, 10000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(monitorInterval);
    };
  }, [testStarted, sessionToken]);

  // ── Block Ctrl+C / Ctrl+V globally — allow inside Monaco & plain inputs ────
  useEffect(() => {
    if (!testStarted) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        // Allow if the focused element is inside the Monaco editor widget
        const monacoEl = document.querySelector('.monaco-editor');
        if (monacoEl && monacoEl.contains(document.activeElement)) return;
        // Allow in textarea / input (e.g. SQL answer boxes)
        const tag = document.activeElement?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [testStarted]);

  // ── Violation clip helpers ──────────────────────────────────────────────────
  const captureViolationClip = (type, desc) => {
    if (captureStateRef.current.status !== 'idle') return;
    if (!screenRecorderRef.current || screenRecorderRef.current.state !== 'recording') return;
    captureStateRef.current = {
      status: 'capturing',
      preBlobs: [...rollingBufferRef.current],
      postBlobs: [],
      type,
      desc,
      time: new Date().toISOString(),
    };
  };

  const uploadViolationClip = async (blobs, type, desc, occurredAt, durationMs = 0) => {
    const token = sessionTokenRef.current;
    if (!token || blobs.length === 0) return;
    try {
      const rawBlob = new Blob(blobs, { type: 'video/webm' });
      // Patch the WebM Duration header so video players can buffer the full clip.
      // Without this the player stalls after a few seconds (Duration = 0/live).
      const blob = durationMs > 0 ? await fixWebmDuration(rawBlob, durationMs) : rawBlob;
      const formData = new FormData();
      formData.append('clip', blob, `${type}_${Date.now()}.webm`);
      formData.append('violation_type', type);
      formData.append('description', desc);
      formData.append('occurred_at', occurredAt);
      await api.post(`/sessions/${token}/violation-clip`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      console.error('Violation clip upload failed:', err);
    }
  };

  const stopRecording = () => {
    // Cancel any pending grace-period timer so it doesn't fire after the test ends
    clearTimeout(graceTimerRef.current);
    violationGraceRef.current = false;

    // Flush any in-progress violation clip capture before stopping, even if we
    // haven't collected all POST_CHUNKS yet — better a short clip than none.
    const pending = captureStateRef.current;
    if (pending.status === 'capturing') {
      const initBlob = initChunkRef.current ? [initChunkRef.current] : [];
      const allBlobs = [...initBlob, ...pending.preBlobs, ...pending.postBlobs];
      if (allBlobs.length > 0) {
        uploadViolationClip(allBlobs, pending.type, pending.desc, pending.time, allBlobs.length * CHUNK_MS);
      }
      captureStateRef.current = { status: 'idle', preBlobs: [], postBlobs: [], type: '', desc: '', time: null };
    }
    initChunkRef.current = null;

    try {
      if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
        screenRecorderRef.current.stop();
      }
    } catch (_) {}
    try { screenStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { webcamStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    setWebcamActive(false);
    setRecordingActive(false);
  };

  const logViolation = async (type, description) => {
    setViolations(prev => [...prev, { type, description, timestamp: new Date() }]);

    // Trigger 10-second violation clip capture (best-effort)
    captureViolationClip(type, description);

    // Log to backend if session is active
    if (sessionToken) {
      try {
        await api.post(`/sessions/${sessionToken}/activity`, {
          activity_type: type,
          activity_data: { description, timestamp: new Date().toISOString() }
        });
      } catch (error) {
        console.error('Failed to log violation:', error);
      }
    }
  };
  // Keep ref in sync so event listeners defined before this function can call it safely
  logViolationRef.current = logViolation;

  // NOTE: intentionally no beforeunload sendBeacon here.
  // The candidate submits explicitly, and the timer auto-submits on expiry.
  // A sendBeacon on beforeunload was spuriously completing sessions during
  // browser-internal navigations triggered by getDisplayMedia().

  useEffect(() => {
    if (!invitationToken) {
      setErrorMessage('Invalid invitation link');
      return;
    }
    validateInvitation();
  }, [invitationToken]);

  // Initialize expanded tables when viewing a SQL question
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length) {
      const currentQ = questions[currentQuestionIndex];
      if (currentQ.question_type === 'sql' && currentQ.sql_schema) {
        const tables = parseSQLSchema(currentQ.sql_schema);
        const initialExpanded = {};
        tables.forEach(table => {
          initialExpanded[table.name] = true;
        });
        setExpandedTables(initialExpanded);
      }
    }
  }, [currentQuestionIndex, questions]);

  useEffect(() => {
    if (testStarted && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleCompleteTest(true); // force=true: no confirm dialog on expiry
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [testStarted, timeRemaining]);

  const validateInvitation = async () => {
    try {
      const response = await api.get(`/sessions/invitations/validate/${invitationToken}`);
      setTest(response.data.test);

      // Invitation was already used but there is still an active session →
      // the page was reloaded after screen-share permission (common in some browsers).
      // Resume directly without showing the start screen again.
      if (response.data.is_resuming && response.data.session) {
        await resumeExistingSession(response.data.session);
      } else {
        setLoading(false);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Invalid or expired invitation.');
      setLoading(false);
    }
  };

  // Re-enter an in-progress session (e.g. after page reload mid-test)
  const resumeExistingSession = async (sessionData) => {
    try {
      await applySession(sessionData);
    } catch (err) {
      setErrorMessage('Failed to resume your session. Please contact the administrator.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: request screen-share + webcam BEFORE API call ──────────────────
  // This is the critical fix: getDisplayMedia() can trigger a browser
  // navigation/reload on some OS/browser combos.  If that happens before
  // POST /sessions/start the invitation is still unused and validation
  // succeeds on reload.  Only after streams are in-hand do we call the API.
  const handleRequestPermissions = async () => {
    setRequestingPermissions(true);
    violationGraceRef.current = true;
    clearTimeout(graceTimerRef.current);

    // Screen share (required for proctoring)
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        // displaySurface: 'monitor' tells the browser to pre-select "Entire Screen"
        // in its picker UI (Chrome 107+). We also validate after acquisition.
        video: { displaySurface: 'monitor', cursor: 'always', frameRate: { ideal: 10 } },
        audio: false,
      });
      // Enforce entire-screen sharing — window/tab sharing is not permitted.
      const screenTrack = screenStream.getVideoTracks()[0];
      const surfaceType = screenTrack?.getSettings()?.displaySurface;
      if (surfaceType && surfaceType !== 'monitor') {
        screenStream.getTracks().forEach(t => t.stop());
        throw new Error('Please share your ENTIRE screen (not a window or tab). Re-open the picker and select a screen.');
      }
      screenStreamRef.current = screenStream;
      // If the candidate clicks "Stop sharing" in the browser toolbar mid-test,
      // block the UI with an overlay and log a proctoring violation.
      screenTrack?.addEventListener('ended', () => {
        setRecordingActive(false);
        setScreenShareStopped(true);
        // logViolation is defined later in the component but accessed via ref-safe closure
        // Use a small timeout so state has settled before logging
        setTimeout(() => logViolationRef.current?.('screen_share_stopped', 'Candidate stopped screen sharing during test'), 100);
      });
      setPermissionsGranted(prev => ({ ...prev, screen: true }));
    } catch (err) {
      // If the user deliberately chose a window/tab (not cancel), tell them why
      if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
        toast.error(err.message || 'Please share your entire screen to continue.');
      }
      console.warn('Screen share not granted:', err);
    }

    // Webcam (best-effort)
    try {
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 15 },
        audio: false,
      });
      webcamStreamRef.current = webcamStream;
      // Don't set srcObject here — the <video> element isn't in the DOM yet
      // (webcamActive is still false). The useEffect([webcamActive, testStarted])
      // wires it after each mount.
      setWebcamActive(true);
      setPermissionsGranted(prev => ({ ...prev, webcam: true }));
    } catch (err) {
      console.warn('Webcam unavailable:', err);
    }

    setRequestingPermissions(false);
    // Short grace period to flush any focus-loss events from the dialogs
    graceTimerRef.current = setTimeout(() => {
      violationGraceRef.current = false;
    }, 2000);
  };

  const handleStartTest = async () => {
    if (startingTest) return;
    setStartingTest(true);
    try {
      const response = await api.post('/sessions/start', { invitation_token: invitationToken });

      // response.data IS the session object (backend returns session directly, not wrapped)
      const sessionData = response.data;
      await applySession(sessionData);

      // ── Wire up recording from already-granted streams (stored in refs) ─────
      // Wrap in its own try/catch: a recording setup failure should never
      // show an error toast or interfere with the test that just started.
      try {
        const screenStream = screenStreamRef.current;
        const webcamStream = webcamStreamRef.current;

        if (webcamStream) {
          // Don't assign srcObject here — the useEffect([webcamActive, testStarted])
          // handles it after the test UI has mounted and the ref is live.
          setWebcamActive(true);
        }

        if (screenStream) {
          // Prefer VP9; fall back to VP8 then generic webm
          const mimeType =
            MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
              ? 'video/webm;codecs=vp8'
              : 'video/webm';

          // CHUNK_MS / PRE_CHUNKS / POST_CHUNKS are module-level constants.

          // videoKeyFrameIntervalDuration is Chrome 99+ only — use a try/catch
          // so unsupported browsers just omit it and still record.
          let recorderOptions = { mimeType, videoBitsPerSecond: 1_500_000 };
          try {
            recorderOptions = {
              ...recorderOptions,
              videoKeyFrameIntervalDuration: CHUNK_MS,
              videoKeyFrameIntervalCount: 30,
            };
            // Test that the browser accepts these options by constructing a
            // throwaway recorder; if it throws we fall back below.
            new MediaRecorder(screenStream, recorderOptions); // eslint-disable-line no-new
          } catch (_) {
            recorderOptions = { mimeType, videoBitsPerSecond: 1_500_000 };
          }

          const recorder = new MediaRecorder(screenStream, recorderOptions);

          recorder.ondataavailable = (e) => {
            if (!e.data || e.data.size === 0) return;
            if (!initChunkRef.current) {
              initChunkRef.current = e.data;
              return;
            }
            const state = captureStateRef.current;
            if (state.status === 'idle') {
              rollingBufferRef.current.push(e.data);
              if (rollingBufferRef.current.length > PRE_CHUNKS) rollingBufferRef.current.shift();
            } else if (state.status === 'capturing') {
              state.postBlobs.push(e.data);
              if (state.postBlobs.length >= POST_CHUNKS) {
                const initBlob = initChunkRef.current ? [initChunkRef.current] : [];
                const allBlobs = [...initBlob, ...state.preBlobs, ...state.postBlobs];
                const durationMs = allBlobs.length * CHUNK_MS;
                uploadViolationClip(allBlobs, state.type, state.desc, state.time, durationMs);
                rollingBufferRef.current = [];
                captureStateRef.current = { status: 'idle', preBlobs: [], postBlobs: [], type: '', desc: '', time: null };
              }
            }
          };

          recorder.start(CHUNK_MS);
          screenRecorderRef.current = recorder;
          setRecordingActive(true);
        }

        // End the grace period after dialogs have settled
        graceTimerRef.current = setTimeout(() => {
          violationGraceRef.current = false;
        }, 3000);
      } catch (recErr) {
        // Recording failed — test is still running, just without screen capture
        console.warn('Screen recording setup failed:', recErr);
        violationGraceRef.current = false;
      }
    } catch (error) {
      const detail = error.response?.data?.detail || '';
      // "Already used" means a page-reload happened after POST /sessions/start ran
      // but before testStarted was set. Re-validate to get the active session.
      if (error.response?.status === 400 &&
          (detail.toLowerCase().includes('already') || detail.toLowerCase().includes('used'))) {
        try {
          const valRes = await api.get(`/sessions/invitations/validate/${invitationToken}`);
          if (valRes.data.is_resuming && valRes.data.session) {
            await applySession(valRes.data.session);
            return;
          }
        } catch (_) {}
      }
      // Show as toast so the start screen stays visible and the candidate can retry
      toast.error(detail || 'Failed to start test. Please try again.');
    } finally {
      setStartingTest(false);
    }
  };

  // Central helper: given a session object, load questions and enter the test.
  const applySession = async (sessionData) => {
    setSession(sessionData);
    setSessionToken(sessionData.session_token);

    const questionsResponse = await api.get(`/sessions/${sessionData.session_token}/questions`);
    setQuestions(questionsResponse.data);

    const initialAnswers = {};
    questionsResponse.data.forEach(q => {
      initialAnswers[q.id] = {
        code_answer: q.code_template || '',
        mcq_selected_options: [],
        text_answer: ''
      };
    });
    setAnswers(initialAnswers);
    setTimeRemaining(sessionData.time_remaining_seconds || (test?.duration_minutes ?? 0) * 60);
    setTestStarted(true);
  };

  const handleAnswerChange = (questionId, field, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
    setExecutionResult(null);
  };

  const handleMCQOptionToggle = (questionId, optionId, isMultiple) => {
    setAnswers(prev => {
      const current = prev[questionId].mcq_selected_options || [];
      let newSelection;
      
      if (isMultiple) {
        newSelection = current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId];
      } else {
        newSelection = [optionId];
      }
      
      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          mcq_selected_options: newSelection
        }
      };
    });
  };

  const toggleTableExpansion = (tableName) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  const handleExecuteCode = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const answer = answers[currentQuestion.id];
    
    // Ensure we have code to execute
    if (!answer || !answer.code_answer || !answer.code_answer.trim()) {
      toast.error('Please write some code first.');
      return;
    }
    
    setExecuting(true);
    setExecutionResult(null); // Clear any previous results
    
    try {
      const response = await api.post(`/sessions/${sessionToken}/submit`, {
        question_id: currentQuestion.id,
        code_answer: answer.code_answer, // Always use code_answer regardless of type
        mcq_selected_options: null,
        text_answer: null
      });
      
      // Force update the execution result with fresh data
      setExecutionResult(response.data);
    } catch (error) {
      setExecutionResult({
        success: false,
        error: error.response?.data?.detail || error.message
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setExecutionResult(null);
    }
  };

  const handleCompleteTest = async (force = false) => {
    if (isSubmittingRef.current) return;
    if (!force) {
      setShowSubmitConfirm(true);
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    stopRecording();
    try {
      // Batch-submit every question's latest answer before completing
      await Promise.all(
        questions.map(q => {
          const ans = answers[q.id] || {};
          return api.post(`/sessions/${sessionToken}/submit`, {
            question_id: q.id,
            code_answer: ans.code_answer || null,
            mcq_selected_options: ans.mcq_selected_options?.length ? ans.mcq_selected_options : null,
            text_answer: ans.text_answer || null,
          }).catch(() => {});
        })
      );
      await api.post(`/sessions/${sessionToken}/complete`);
      // Reset the guard BEFORE navigating — navigate() unmounts the component
      // so the finally block would never run, leaving the ref permanently true.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      navigate('/test/complete');
    } catch (error) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      if (error.response?.status === 400) {
        navigate('/test/complete');
        return;
      }
      toast.error('Failed to submit test: ' + (error.response?.data?.detail || error.message));
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageMode = (type) => {
    switch(type) {
      case 'sql': return 'sql';
      case 'python': return 'python';
      case 'javascript': return 'javascript';
      default: return 'plaintext';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner"></div>
      </div>
    );
  }

  if (errorMessage) {
    const isUnpublished = errorMessage.toLowerCase().includes('not been published');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md text-center">
          <div className="text-6xl mb-4">{isUnpublished ? '🔒' : '❌'}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isUnpublished ? 'Test Not Available' : 'Invalid Invitation'}
          </h2>
          <p className="text-gray-600">{errorMessage}</p>
          {isUnpublished && (
            <p className="text-sm text-gray-400 mt-3">The administrator needs to publish the test before you can access it.</p>
          )}
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600">This invitation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (!testStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-50 p-4">
        <div className="card max-w-2xl w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">📝</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{test.title}</h1>
            <p className="text-gray-600">{test.description}</p>
          </div>

          <div className="border-t border-b border-gray-200 py-6 my-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">{test.duration_minutes}</div>
                <div className="text-sm text-gray-600 mt-1">Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{test.total_marks}</div>
                <div className="text-sm text-gray-600 mt-1">Total Marks</div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Instructions:</h3>
            <div className="prose text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
              {test.instructions || 'No specific instructions provided.'}
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Important Instructions</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Once started, the test cannot be paused or reopened</li>
                    <li>Timer will start immediately after clicking "Start Test"</li>
                    <li>Your test will auto-submit when time expires</li>
                    <li>Do not refresh or close the browser during the test</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">⚠️ Proctoring & Monitoring</h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Tab switching is NOT allowed</strong> - Violations will be recorded</li>
                    <li><strong>Multiple monitors are NOT allowed</strong> - Please disconnect extra displays</li>
                    <li><strong>Copy &amp; paste outside the code editor is disabled</strong></li>
                    <li><strong>Window switching is tracked</strong> - Stay on the test window at all times</li>
                    <li>All suspicious activities will be reported to the administrator</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900">Screen &amp; Webcam Recording</p>
              <p className="text-xs text-blue-700 mt-1">
                When you click Start, your browser will ask you to <strong>share your screen</strong> and grant <strong>camera access</strong>.
                Both are required for proctoring. Your webcam will be visible as a small overlay during the test.
                A ~12-second clip is captured around each detected violation and reviewed by the administrator.
              </p>
            </div>
          </div>

          {/* ── Proctoring setup: must grant screen share before starting ── */}
          <div className="border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Step 1 — Grant Proctoring Access</h3>

            {/* Screen share status */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${
              permissionsGranted.screen ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${permissionsGranted.screen ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Screen Sharing</span>
                <span className="text-xs text-gray-400">(required)</span>
              </div>
              {permissionsGranted.screen
                ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Granted</span>
                : <span className="text-xs text-gray-400">Not granted</span>}
            </div>

            {/* Webcam status */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${
              permissionsGranted.webcam ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${permissionsGranted.webcam ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Webcam</span>
                <span className="text-xs text-gray-400">(recommended)</span>
              </div>
              {permissionsGranted.webcam
                ? <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Granted</span>
                : <span className="text-xs text-gray-400">Not granted</span>}
            </div>

            {!permissionsGranted.screen && (
              <button
                onClick={handleRequestPermissions}
                disabled={requestingPermissions}
                className="btn btn-secondary w-full mt-1 disabled:opacity-60"
              >
                {requestingPermissions ? 'Waiting for your browser…' : 'Grant Screen & Camera Access'}
              </button>
            )}
          </div>

          {/* ── Step 2: start test (only once screen share is active) ── */}
          <button
            onClick={handleStartTest}
            disabled={!permissionsGranted.screen || startingTest}
            className="btn btn-primary w-full text-lg py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {startingTest ? 'Starting test…' : permissionsGranted.screen ? 'Step 2 — Start Test' : 'Grant screen access above to continue'}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestion?.id] || {};

  // Guard clause: ensure question is loaded before rendering
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
  <>
    <div className="min-h-screen bg-gray-50">
      {/* Violation Warning Banner */}
      {showViolationWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-center space-x-2">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">⚠️ WARNING: Suspicious activity detected! Tab switching or window changes are being monitored.</span>
          </div>
        </div>
      )}

      {/* Screen Share Stopped — blocking overlay ────────────────────────────
           Shows when the candidate stops screen sharing mid-test.            */}
      {screenShareStopped && testStarted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="text-5xl mb-4">🖥️</div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Screen Sharing Stopped</h2>
            <p className="text-gray-600 mb-2">
              Screen sharing is <strong>required</strong> for the duration of this test.
              This incident has been logged.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              You must re-share your <strong>entire screen</strong> to continue.
            </p>
            <button
              onClick={async () => {
                try {
                  const newStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: 'monitor', cursor: 'always', frameRate: { ideal: 10 } },
                    audio: false,
                  });
                  const newTrack = newStream.getVideoTracks()[0];
                  const surface = newTrack?.getSettings()?.displaySurface;
                  if (surface && surface !== 'monitor') {
                    newStream.getTracks().forEach(t => t.stop());
                    toast.error('Please share your ENTIRE screen, not a window or tab.');
                    return;
                  }
                  // Stop old tracks and swap in the new stream
                  screenStreamRef.current?.getTracks().forEach(t => t.stop());
                  screenStreamRef.current = newStream;
                  // Restart recorder on new stream
                  try {
                    if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
                      screenRecorderRef.current.stop();
                    }
                  } catch (_) {}
                  rollingBufferRef.current = [];
                  initChunkRef.current = null;
                  captureStateRef.current = { status: 'idle', preBlobs: [], postBlobs: [], type: '', desc: '', time: null };
                  const mimeType =
                    MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
                    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
                    : 'video/webm';
                  let opts = { mimeType, videoBitsPerSecond: 1_500_000 };
                  try {
                    const probe = { ...opts, videoKeyFrameIntervalDuration: CHUNK_MS, videoKeyFrameIntervalCount: 30 };
                    new MediaRecorder(newStream, probe); // eslint-disable-line no-new
                    opts = probe;
                  } catch (_) {}
                  const recorder = new MediaRecorder(newStream, opts);
                  recorder.ondataavailable = screenRecorderRef.current?.ondataavailable;
                  recorder.start(CHUNK_MS);
                  screenRecorderRef.current = recorder;
                  newTrack.addEventListener('ended', () => {
                    setRecordingActive(false);
                    setScreenShareStopped(true);
                    setTimeout(() => logViolationRef.current?.('screen_share_stopped', 'Candidate stopped screen sharing during test'), 100);
                  });
                  setRecordingActive(true);
                  setScreenShareStopped(false);
                } catch (err) {
                  toast.error('Screen share cancelled. You must share your screen to continue.');
                }
              }}
              className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
            >
              Re-share My Screen
            </button>
          </div>
        </div>
      )}

      {/* Multiple Monitor Warning Banner */}
      {showMonitorWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">⚠️ Multiple monitors detected! Please disconnect extra displays to continue. This violation has been logged.</span>
            </div>
            <button onClick={() => setShowMonitorWarning(false)} className="ml-4 text-white/80 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Webcam PiP Preview ──────────────────────────────────────────────────── */}
      {webcamActive && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-1 select-none">
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-indigo-500/70">
            <video
              ref={webcamVideoRef}
              autoPlay
              muted
              playsInline
              className="w-36 h-24 object-cover"
            />
            <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg" />
            <div className="absolute bottom-1 left-1 text-[10px] text-white/80 font-semibold bg-black/40 px-1 rounded">
              📷 You
            </div>
          </div>
          {recordingActive && (
            <div className="flex items-center gap-1 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              REC
            </div>
          )}
        </div>
      )}

      {/* Top Bar with Timer */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">{test.title}</h1>
              <span className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              {violations.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {violations.length} violation{violations.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className={`text-2xl font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-primary-600'}`}>
                ⏱️ {formatTime(timeRemaining)}
              </div>
              <button
                onClick={handleCompleteTest}
                disabled={isSubmitting}
                className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Submit Test
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Question Navigation */}
          <div className="col-span-2">
            <div className="card sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Questions</h3>
              <div className="grid grid-cols-1 gap-2">
                {questions.map((q, index) => (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentQuestionIndex(index); setExecutionResult(null); }}
                    className={`p-2 rounded text-sm font-medium text-center ${
                      index === currentQuestionIndex
                        ? 'bg-primary-600 text-white'
                        : answers[q.id]?.code_answer || answers[q.id]?.text_answer || answers[q.id]?.mcq_selected_options?.length
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Question Area */}
          <div className="col-span-10 space-y-6">
            {/* Question */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-2xl">
                      {currentQuestion.question_type === 'sql' ? '🗄️' : 
                       currentQuestion.question_type === 'python' ? '🐍' : 
                       currentQuestion.question_type === 'javascript' ? '⚡' : 
                       currentQuestion.question_type === 'mcq' ? '☑️' : '📝'}
                    </span>
                    <h2 className="text-2xl font-bold text-gray-900">{currentQuestion.title}</h2>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{currentQuestion.description}</p>
                </div>
                <div className="ml-4">
                  <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-semibold">
                    {currentQuestion.marks} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Database Schema & Sample Data (SQL Questions Only) */}
            {currentQuestion.question_type === 'sql' && (currentQuestion.sql_schema || currentQuestion.sql_seed_data) && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  Database Structure
                </h3>
                
                {(() => {
                  const tables = parseSQLSchema(currentQuestion.sql_schema);
                  
                  return (
                    <>
                      {/* Tables Summary */}
                      {tables.length > 1 && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="text-sm font-semibold text-blue-900 mb-2">
                            📊 Available Tables ({tables.length}):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tables.map((table, idx) => (
                              <button
                                key={idx}
                                onClick={() => toggleTableExpansion(table.name)}
                                className="px-3 py-1 bg-white border border-blue-300 rounded-md text-sm font-mono text-blue-800 hover:bg-blue-100 transition-colors"
                              >
                                {table.name}
                                <span className="ml-1 text-xs text-blue-600">
                                  ({table.columns.length} cols)
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Individual Tables */}
                      {tables.map((table, tableIndex) => {
                        const rows = parseSQLSeedData(currentQuestion.sql_seed_data, table.name);
                        const isExpanded = expandedTables[table.name] !== false; // Default to expanded
                        
                        return (
                          <div key={tableIndex} className={`border border-gray-200 rounded-lg overflow-hidden ${tableIndex > 0 ? 'mt-4' : ''}`}>
                            {/* Table Header - Clickable to expand/collapse */}
                            <button
                              onClick={() => toggleTableExpansion(table.name)}
                              className="w-full px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-3">
                                <svg 
                                  className={`w-5 h-5 text-blue-600 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-mono font-semibold">
                                  {table.name}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {table.columns.length} columns • {rows.length} rows
                                </span>
                              </div>
                              <span className="text-xs text-blue-600 font-medium">
                                {isExpanded ? 'Click to collapse' : 'Click to expand'}
                              </span>
                            </button>
                            
                            {/* Table Content - Collapsible */}
                            {isExpanded && (
                              <div className="p-4 bg-white">
                                {/* Schema Table */}
                                <div className="mb-4">
                                  <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center">
                                    <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Column Definitions
                                  </div>
                                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Column Name
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Data Type
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {table.columns.map((column, colIndex) => (
                                          <tr key={colIndex} className={colIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-900 font-semibold">
                                              {column.name}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-600">
                                              {column.type}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                                
                                {/* Data Table */}
                                {rows.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center">
                                      <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                      </svg>
                                      Sample Data ({rows.length} {rows.length === 1 ? 'row' : 'rows'})
                                    </div>
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-blue-50">
                                          <tr>
                                            {table.columns.map((column, colIndex) => (
                                              <th key={colIndex} className="px-4 py-2 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                                {column.name}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {rows.map((row, rowIndex) => (
                                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                                              {row.map((cell, cellIndex) => (
                                                <td key={cellIndex} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                                  {cell}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Answer Area */}
            {['sql', 'python', 'javascript'].includes(currentQuestion.question_type) && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Code Editor</h3>
                  <button
                    onClick={handleExecuteCode}
                    disabled={executing}
                    className="btn btn-secondary flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{executing ? 'Running...' : 'Run Code'}</span>
                  </button>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Editor
                    height="400px"
                    language={getLanguageMode(currentQuestion.question_type)}
                    value={currentAnswer.code_answer}
                    onChange={(value) => handleAnswerChange(currentQuestion.id, 'code_answer', value)}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true
                    }}
                  />
                </div>

                {executionResult && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Execution Result:</h4>
                    <div className={`p-4 rounded-lg ${
                      executionResult.status === 'error' || executionResult.execution_error 
                        ? 'bg-red-50 border border-red-200' 
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      {executionResult.execution_error ? (
                        <div className="text-red-800 font-mono text-sm whitespace-pre-wrap">
                          <strong>Error:</strong><br/>
                          {executionResult.execution_error}
                        </div>
                      ) : executionResult.execution_output ? (
                        <div>
                          <div className="text-gray-900 font-mono text-sm whitespace-pre-wrap" style={{maxHeight: '400px', overflowY: 'auto'}}>
                            {executionResult.execution_output}
                          </div>
                          {executionResult.execution_time_ms !== undefined && (
                            <div className="text-xs text-gray-500 mt-2">
                              Execution time: {executionResult.execution_time_ms}ms
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-600 text-sm">
                          Code executed successfully. No output returned.
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500 italic">
                      ℹ️ Your answer has been saved. Results will be evaluated after test submission.
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentQuestion.question_type === 'mcq' && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Options</h3>
                <div className="space-y-3">
                  {currentQuestion.mcq_options?.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type={currentQuestion.is_multiple_correct ? 'checkbox' : 'radio'}
                        name={`mcq_${currentQuestion.id}`}
                        checked={currentAnswer.mcq_selected_options?.includes(option.id)}
                        onChange={() => handleMCQOptionToggle(currentQuestion.id, option.id, currentQuestion.is_multiple_correct)}
                        className="mt-1"
                      />
                      <span className="flex-1 text-gray-900">{option.text}</span>
                    </label>
                  ))}
                </div>
                {currentQuestion.is_multiple_correct && (
                  <p className="text-sm text-gray-500 mt-3">Multiple answers may be correct</p>
                )}
              </div>
            )}

            {currentQuestion.question_type === 'descriptive' && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Answer</h3>
                <textarea
                  value={currentAnswer.text_answer}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, 'text_answer', e.target.value)}
                  className="input"
                  rows="12"
                  placeholder="Type your detailed answer here..."
                />
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1)); setExecutionResult(null); }}
                disabled={currentQuestionIndex === 0}
                className="btn btn-secondary"
              >
                ← Previous
              </button>

              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  onClick={handleNextQuestion}
                  className="btn btn-primary"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleCompleteTest}
                  disabled={isSubmitting}
                  className="btn bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg flex items-center gap-2"
                >
                  {isSubmitting
                    ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting…</>
                    : '🏁 Submit Test'
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Submit Confirmation Modal */}
    {showSubmitConfirm && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Submit Test?</h3>
              <p className="text-sm text-gray-600 mt-1">
                All your answers will be submitted and <strong>you will not be able to make any changes</strong> after this point.
                Unanswered questions will be marked as blank.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-green-100 text-green-700 flex items-center justify-center font-bold text-[10px]">✓</span>
                  Attempted: {Object.values(answers).filter(a => a.code_answer?.trim() || a.text_answer?.trim() || a.mcq_selected_options?.length).length} / {questions.length}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-[10px]">–</span>
                  Skipped: {questions.length - Object.values(answers).filter(a => a.code_answer?.trim() || a.text_answer?.trim() || a.mcq_selected_options?.length).length} / {questions.length}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowSubmitConfirm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Continue Test
            </button>
            <button
              onClick={() => { setShowSubmitConfirm(false); handleCompleteTest(true); }}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting…</>
                : '🏁 Submit & Finish'
              }
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
