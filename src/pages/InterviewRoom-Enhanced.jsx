import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

// Supported programming languages
const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', defaultCode: 'console.log("Hello World");' },
  { value: 'python', label: 'Python', defaultCode: 'print("Hello World")' },
  { value: 'java', label: 'Java', defaultCode: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello World");\n  }\n}' },
  { value: 'cpp', label: 'C++', defaultCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello World";\n  return 0;\n}' },
  { value: 'c', label: 'C', defaultCode: '#include <stdio.h>\n\nint main() {\n  printf("Hello World");\n  return 0;\n}' },
  { value: 'csharp', label: 'C#', defaultCode: 'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello World");\n  }\n}' },
  { value: 'go', label: 'Go', defaultCode: 'package main\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello World")\n}' },
  { value: 'rust', label: 'Rust', defaultCode: 'fn main() {\n  println!("Hello World");\n}' },
  { value: 'ruby', label: 'Ruby', defaultCode: 'puts "Hello World"' },
  { value: 'php', label: 'PHP', defaultCode: '<?php\necho "Hello World";\n?>' },
  { value: 'typescript', label: 'TypeScript', defaultCode: 'console.log("Hello World");' },
  { value: 'swift', label: 'Swift', defaultCode: 'print("Hello World")' },
  { value: 'kotlin', label: 'Kotlin', defaultCode: 'fun main() {\n  println("Hello World")\n}' },
  { value: 'bash', label: 'Bash', defaultCode: 'echo "Hello World"' },
];

export default function InterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Interview state
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('meeting');
  const [participants, setParticipants] = useState([]);
  
  // Code editor state
  const [code, setCode] = useState(LANGUAGES[0].defaultCode);
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [stdin, setStdin] = useState('');
  
  // Video state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [screenStream, setScreenStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const screenVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const editorRef = useRef(null);
  const codeChangeTimerRef = useRef(null);
  
  const isInterviewer = user?.role === 'interviewer' || user?.role === 'admin';
  const isCandidate = user?.role === 'candidate';
  
  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };
  
  // Fetch interview details
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await api.get(`/interviews/${id}`);
        setInterview(response.data);
        setLoading(false);
      } catch (error) {
        toast.error('Failed to load interview');
        navigate('/dashboard');
      }
    };
    fetchInterview();
  }, [id, navigate]);
  
  // Initialize Socket.IO
  useEffect(() => {
    if (!interview || !user) return;
    
    const socket = io('http://localhost:8000', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: {
        user_id: user.id,
        user_name: user.full_name,
        user_role: user.role,
        interview_id: id
      }
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      socket.emit('join-interview', {
        interviewId: id,
        userId: user.id,
        userName: user.full_name,
        userRole: user.role
      });
    });
    
    // Receive full participants list on join (including yourself)
    socket.on('participants-list', (data) => {
      console.log('📋 Participants list:', data.participants);
      setParticipants(data.participants || []);
    });

    socket.on('user-joined', (data) => {
      console.log('👤 User joined:', data);
      // Don't toast for own join
      if (data.userId !== user.id) {
        toast.success(`${data.userName} joined the interview`);
      }
      setParticipants(prev => [...prev.filter(p => p.userId !== data.userId), data]);
      
      // Create peer connection for new user (not self)
      if (data.userId !== user.id) {
        createPeerConnection(data.userId, true);
      }
    });
    
    socket.on('user-left', (data) => {
      console.log('👋 User left:', data);
      toast.info(`${data.userName} left the interview`);
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
      
      // Close peer connection
      if (peerConnectionsRef.current[data.userId]) {
        peerConnectionsRef.current[data.userId].close();
        delete peerConnectionsRef.current[data.userId];
      }
      
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[data.userId];
        return newStreams;
      });
    });
    
    socket.on('tab-switched', (data) => {
      // Only candidates should auto-switch when interviewer changes tabs
      if (isCandidate && data.userRole === 'interviewer') {
        console.log('🔄 Auto-switching tab to:', data.tab);
        setActiveTab(data.tab);
        toast.info(`Interviewer switched to ${data.tab} tab`);
      }
    });
    
    socket.on('code-changed', (data) => {
      if (data.userId !== user.id) {
        setCode(data.code);
        setLanguage(data.language);
      }
    });
    
    socket.on('code-executed', (data) => {
      setOutput(data.output);
      setExecuting(false);
    });
    
    // WebRTC signaling
    socket.on('webrtc-offer', async ({ from, offer }) => {
      console.log('📨 Received offer from:', from);
      await handleOffer(from, offer);
    });
    
    socket.on('webrtc-answer', async ({ from, answer }) => {
      console.log('📨 Received answer from:', from);
      const pc = peerConnectionsRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });
    
    socket.on('webrtc-ice-candidate', async ({ from, candidate }) => {
      console.log('🧊 Received ICE candidate from:', from);
      const pc = peerConnectionsRef.current[from];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });
    
    return () => {
      socket.disconnect();
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [interview, user, id, isCandidate]);
  
  // Initialize media streams
  useEffect(() => {
    if (!interview || !user) return;
    
    const initMedia = async () => {
      try {
        // Get camera and microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        console.log('✅ Camera and microphone initialized');
        
        // For candidates, also start screen sharing immediately
        if (isCandidate) {
          await startScreenShare();
        }
      } catch (error) {
        console.error('❌ Media initialization error:', error);
        toast.error('Failed to access camera/microphone. Please grant permissions.');
      }
    };
    
    initMedia();
  }, [interview, user, isCandidate]);
  
  // Create peer connection
  const createPeerConnection = useCallback((userId, createOffer) => {
    const pc = new RTCPeerConnection(configuration);
    peerConnectionsRef.current[userId] = pc;
    
    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📡 Received remote track from:', userId);
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: event.streams[0]
      }));
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-ice-candidate', {
          to: userId,
          interviewId: id,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
    };
    
    // Create offer if initiator
    if (createOffer) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current.emit('webrtc-offer', {
            to: userId,
            interviewId: id,
            offer: pc.localDescription
          });
        })
        .catch(error => console.error('Error creating offer:', error));
    }
    
    return pc;
  }, [localStream]);
  
  // Handle WebRTC offer
  const handleOffer = async (userId, offer) => {
    const pc = peerConnectionsRef.current[userId] || createPeerConnection(userId, false);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socketRef.current.emit('webrtc-answer', {
        to: userId,
        interviewId: id,
        answer: pc.localDescription
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };
  
  // Start screen sharing
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });
      
      setScreenStream(stream);
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
      
      // Replace video track in peer connections
      const videoTrack = stream.getVideoTracks()[0];
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      // Handle stream end
      videoTrack.onended = () => {
        stopScreenShare();
      };
      
      console.log('✅ Screen sharing started');
      toast.success('Screen sharing started');
    } catch (error) {
      console.error('❌ Screen share error:', error);
      toast.error('Failed to start screen sharing');
    }
  };
  
  // Stop screen sharing
  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      
      // Restore camera track
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
      
      console.log('⏹️ Screen sharing stopped');
      toast.info('Screen sharing stopped');
    }
  };
  
  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        toast.success(audioTrack.enabled ? 'Microphone enabled' : 'Microphone muted');
      }
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        toast.success(videoTrack.enabled ? 'Camera enabled' : 'Camera disabled');
      }
    }
  };
  
  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // If interviewer changes tab, notify all participants
    if (isInterviewer && socketRef.current) {
      socketRef.current.emit('switch-tab', {
        interviewId: id,
        tab,
        userId: user.id,
        userRole: user.role
      });
    }
  };
  
  // Handle code change
  const handleCodeChange = (value) => {
    setCode(value);
    
    // Debounce code sync to avoid too many emissions
    if (codeChangeTimerRef.current) {
      clearTimeout(codeChangeTimerRef.current);
    }
    
    codeChangeTimerRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('code-change', {
          interviewId: id,
          code: value,
          language,
          userId: user.id
        });
      }
    }, 500);
  };
  
  // Handle language change
  const handleLanguageChange = (newLanguage) => {
    const lang = LANGUAGES.find(l => l.value === newLanguage);
    setLanguage(newLanguage);
    setCode(lang?.defaultCode || '');
    setOutput('');
    
    if (socketRef.current) {
      socketRef.current.emit('code-change', {
        interviewId: id,
        code: lang?.defaultCode || '',
        language: newLanguage,
        userId: user.id
      });
    }
  };
  
  // Execute code
  const executeCode = async () => {
    if (!code.trim()) {
      toast.error('Please write some code first');
      return;
    }
    
    setExecuting(true);
    setOutput('Executing...');
    
    try {
      const response = await api.post('/code/execute', {
        code,
        language,
        stdin: stdin.trim() || null
      });
      
      const result = response.data;
      const outputText = result.stdout || result.stderr || result.output || 'No output';
      
      setOutput(outputText);
      
      // Broadcast execution result
      if (socketRef.current) {
        socketRef.current.emit('code-execute', {
          interviewId: id,
          output: outputText,
          userId: user.id
        });
      }
      
      if (result.success) {
        toast.success('Code executed successfully!');
      } else {
        toast.error('Execution failed');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Execution failed';
      setOutput(errorMsg);
      toast.error(errorMsg);
    } finally {
      setExecuting(false);
    }
  };
  
  // End interview
  const endInterview = () => {
    if (window.confirm('Are you sure you want to end this interview?')) {
      navigate('/dashboard');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading interview room...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 text-white px-6 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">{interview?.position}</h1>
          <span className="px-3 py-1 bg-green-600 rounded-full text-sm">Live</span>
          <span className="text-sm text-gray-400">
            {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Media controls */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {audioEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              )}
            </svg>
          </button>
          
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-lg ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}
            title={videoEnabled ? 'Stop Video' : 'Start Video'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {videoEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              )}
            </svg>
          </button>
          
          {isCandidate && !screenStream && (
            <button
              onClick={startScreenShare}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700"
              title="Share Screen"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          
          {screenStream && (
            <button
              onClick={stopScreenShare}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-700"
              title="Stop Sharing"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
          )}
          
          <button
            onClick={endInterview}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium"
          >
            End Interview
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex px-6">
          <button
            onClick={() => handleTabChange('meeting')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'meeting'
                ? 'bg-gray-900 text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            👥 Meeting
          </button>
          <button
            onClick={() => handleTabChange('code')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'code'
                ? 'bg-gray-900 text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            💻 Code Editor
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'meeting' && (
          <div className="h-full p-6 grid grid-cols-2 gap-6">
            {/* Local video */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded">
                {user?.full_name} (You)
              </div>
            </div>
            
            {/* Remote videos */}
            {Object.entries(remoteStreams).map(([userId, stream]) => {
              const participant = participants.find(p => p.userId === userId);
              return (
                <div key={userId} className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={(el) => {
                      if (el && stream) {
                        el.srcObject = stream;
                        remoteVideoRefs.current[userId] = el;
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded">
                    {participant?.userName || 'Participant'}
                  </div>
                </div>
              );
            })}
            
            {/* Empty slots */}
            {Object.keys(remoteStreams).length === 0 && (
              <div className="bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-gray-400">Waiting for others to join...</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'code' && (
          <div className="h-full flex">
            {/* Code editor area */}
            <div className="flex-1 flex flex-col">
              {/* Toolbar */}
              <div className="bg-gray-800 px-6 py-3 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-4">
                  <label className="text-white text-sm">Language:</label>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.value} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={executeCode}
                  disabled={executing}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  {executing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Executing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Run Code
                    </>
                  )}
                </button>
              </div>
              
              {/* Monaco Editor */}
              <div className="flex-1">
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
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                  onMount={(editor) => {
                    editorRef.current = editor;
                  }}
                />
              </div>
              
              {/* Input/Output section */}
              <div className="h-48 border-t border-gray-700 flex">
                {/* Standard Input */}
                <div className="flex-1 bg-gray-800 p-4 border-r border-gray-700">
                  <h3 className="text-white font-medium mb-2">Input (stdin):</h3>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Enter input for your program..."
                    className="w-full h-32 bg-gray-900 text-white p-2 rounded border border-gray-600 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  />
                </div>
                
                {/* Output */}
                <div className="flex-1 bg-gray-800 p-4">
                  <h3 className="text-white font-medium mb-2">Output:</h3>
                  <pre className="w-full h-32 bg-gray-900 text-green-400 p-2 rounded border border-gray-600 overflow-auto font-mono text-sm whitespace-pre-wrap">
                    {output || 'Output will appear here...'}
                  </pre>
                </div>
              </div>
            </div>
            
            {/* Picture-in-Picture video during coding */}
            <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 flex flex-col gap-4">
              <h3 className="text-white font-medium">Participants</h3>
              
              {/* Local video (small) */}
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '180px' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  {user?.full_name} (You)
                </div>
              </div>
              
              {/* Remote videos (small) */}
              {Object.entries(remoteStreams).map(([userId, stream]) => {
                const participant = participants.find(p => p.userId === userId);
                return (
                  <div key={userId} className="relative bg-black rounded-lg overflow-hidden" style={{ height: '180px' }}>
                    <video
                      ref={(el) => {
                        if (el && stream) {
                          el.srcObject = stream;
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                      {participant?.userName || 'Participant'}
                      {participant?.userRole && (
                        <span className="ml-1 text-xs text-gray-300">({participant.userRole})</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
