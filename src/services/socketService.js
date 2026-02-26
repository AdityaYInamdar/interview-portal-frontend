import { io } from 'socket.io-client'

// Use VITE_API_URL (same var as the REST API) so there's one source of truth.
// Socket.IO automatically uses wss:// when the base URL is https://.
const WS_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class SocketService {
  constructor() {
    this.socket = null
    this.connected = false
  }

  connect(userId, userName, token) {
    if (this.socket) {
      return this.socket
    }

    this.socket = io(WS_URL, {
      auth: {
        token,
        userId,
        userName,
      },
      transports: ['polling', 'websocket'],
    })

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id)
      this.connected = true
    })

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
      this.connected = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
    }
  }

  joinRoom(roomId, userId, userName, role) {
    if (!this.socket) {
      console.error('Socket not connected')
      return
    }

    this.socket.emit('join_room', {
      room_id: roomId,
      user_id: userId,
      user_name: userName,
      role,
    })
  }

  leaveRoom(roomId, userId, userName) {
    if (!this.socket) {
      return
    }

    this.socket.emit('leave_room', {
      room_id: roomId,
      user_id: userId,
      user_name: userName,
    })
  }

  sendCodeChange(roomId, userId, code, language, cursorPosition) {
    if (!this.socket) {
      return
    }

    this.socket.emit('code_change', {
      room_id: roomId,
      user_id: userId,
      code,
      language,
      cursor_position: cursorPosition,
    })
  }

  sendCursorPosition(roomId, userId, position) {
    if (!this.socket) {
      return
    }

    this.socket.emit('cursor_position', {
      room_id: roomId,
      user_id: userId,
      position,
    })
  }

  sendCodeExecution(roomId, userId, language, code) {
    if (!this.socket) {
      return
    }

    this.socket.emit('code_execution', {
      room_id: roomId,
      user_id: userId,
      language,
      code,
    })
  }

  sendCodeExecutionResult(roomId, result) {
    if (!this.socket) {
      return
    }

    this.socket.emit('code_execution_result', {
      room_id: roomId,
      result,
    })
  }

  sendWhiteboardUpdate(roomId, userId, data) {
    if (!this.socket) {
      return
    }

    this.socket.emit('whiteboard_update', {
      room_id: roomId,
      user_id: userId,
      data,
    })
  }

  sendWhiteboardClear(roomId, userId) {
    if (!this.socket) {
      return
    }

    this.socket.emit('whiteboard_clear', {
      room_id: roomId,
      user_id: userId,
    })
  }

  sendChatMessage(roomId, userId, userName, message) {
    if (!this.socket) {
      return
    }

    this.socket.emit('chat_message', {
      room_id: roomId,
      user_id: userId,
      user_name: userName,
      message,
    })
  }

  sendWebRTCOffer(roomId, userId, targetId, offer) {
    if (!this.socket) {
      return
    }

    this.socket.emit('webrtc_offer', {
      room_id: roomId,
      user_id: userId,
      target_id: targetId,
      offer,
    })
  }

  sendWebRTCAnswer(roomId, userId, targetId, answer) {
    if (!this.socket) {
      return
    }

    this.socket.emit('webrtc_answer', {
      room_id: roomId,
      user_id: userId,
      target_id: targetId,
      answer,
    })
  }

  sendWebRTCIceCandidate(roomId, userId, candidate) {
    if (!this.socket) {
      return
    }

    this.socket.emit('webrtc_ice_candidate', {
      room_id: roomId,
      user_id: userId,
      candidate,
    })
  }

  startRecording(roomId, userId) {
    if (!this.socket) {
      return
    }

    this.socket.emit('start_recording', {
      room_id: roomId,
      user_id: userId,
    })
  }

  stopRecording(roomId, userId) {
    if (!this.socket) {
      return
    }

    this.socket.emit('stop_recording', {
      room_id: roomId,
      user_id: userId,
    })
  }

  startInterview(roomId, userId) {
    if (!this.socket) {
      return
    }

    this.socket.emit('interview_start', {
      room_id: roomId,
      user_id: userId,
    })
  }

  endInterview(roomId, userId) {
    if (!this.socket) {
      return
    }

    this.socket.emit('interview_end', {
      room_id: roomId,
      user_id: userId,
    })
  }

  on(event, callback) {
    if (!this.socket) {
      return
    }

    this.socket.on(event, callback)
  }

  off(event, callback) {
    if (!this.socket) {
      return
    }

    this.socket.off(event, callback)
  }
}

// Create singleton instance
const socketService = new SocketService()

export default socketService
