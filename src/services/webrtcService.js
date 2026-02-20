import SimplePeer from 'simple-peer'
import socketService from './socketService'

class WebRTCService {
  constructor() {
    this.peers = new Map() // Map of userId -> Peer instance
    this.localStream = null
    this.roomId = null
    this.userId = null
  }

  async initializeMedia(constraints = { video: true, audio: true }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('✅ Local media stream acquired')
      return this.localStream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      throw error
    }
  }

  async getDisplayMedia() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      })
      console.log('✅ Screen share stream acquired')
      return screenStream
    } catch (error) {
      console.error('Error accessing display media:', error)
      throw error
    }
  }

  setRoomAndUser(roomId, userId) {
    this.roomId = roomId
    this.userId = userId
  }

  createPeerConnection(targetUserId, initiator = false, onStreamCallback) {
    if (!this.localStream) {
      console.error('Local stream not initialized')
      return null
    }

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: import.meta.env.VITE_TURN_SERVER_URL || 'turn:turnserver.example.com:3478',
            username: import.meta.env.VITE_TURN_USERNAME || 'username',
            credential: import.meta.env.VITE_TURN_CREDENTIAL || 'credential',
          },
        ],
      },
    })

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        socketService.sendWebRTCOffer(this.roomId, this.userId, targetUserId, data)
      } else if (data.type === 'answer') {
        socketService.sendWebRTCAnswer(this.roomId, this.userId, targetUserId, data)
      } else if (data.candidate) {
        socketService.sendWebRTCIceCandidate(this.roomId, this.userId, {
          candidate: data,
          target_id: targetUserId,
        })
      }
    })

    peer.on('stream', (remoteStream) => {
      console.log('✅ Remote stream received from:', targetUserId)
      if (onStreamCallback) {
        onStreamCallback(targetUserId, remoteStream)
      }
    })

    peer.on('error', (error) => {
      console.error('Peer connection error:', error)
    })

    peer.on('close', () => {
      console.log('Peer connection closed:', targetUserId)
      this.peers.delete(targetUserId)
    })

    this.peers.set(targetUserId, peer)
    return peer
  }

  handleOffer(fromUserId, offer, onStreamCallback) {
    const peer = this.createPeerConnection(fromUserId, false, onStreamCallback)
    if (peer) {
      peer.signal(offer)
    }
  }

  handleAnswer(fromUserId, answer) {
    const peer = this.peers.get(fromUserId)
    if (peer) {
      peer.signal(answer)
    } else {
      console.error('No peer found for:', fromUserId)
    }
  }

  handleIceCandidate(fromUserId, candidate) {
    const peer = this.peers.get(fromUserId)
    if (peer) {
      peer.signal(candidate)
    }
  }

  removePeer(userId) {
    const peer = this.peers.get(userId)
    if (peer) {
      peer.destroy()
      this.peers.delete(userId)
    }
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  async replaceVideoTrack(newStream) {
    const videoTrack = newStream.getVideoTracks()[0]
    
    this.peers.forEach((peer) => {
      const sender = peer._pc
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video')
      
      if (sender) {
        sender.replaceTrack(videoTrack)
      }
    })

    // Replace local stream video track
    const oldVideoTrack = this.localStream.getVideoTracks()[0]
    if (oldVideoTrack) {
      this.localStream.removeTrack(oldVideoTrack)
      oldVideoTrack.stop()
    }
    this.localStream.addTrack(videoTrack)
  }

  async stopScreenShare(originalVideoTrack) {
    if (originalVideoTrack) {
      await this.replaceVideoTrack(new MediaStream([originalVideoTrack]))
    }
  }

  cleanup() {
    // Stop all peer connections
    this.peers.forEach((peer) => {
      peer.destroy()
    })
    this.peers.clear()

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    this.roomId = null
    this.userId = null
  }
}

// Create singleton instance
const webrtcService = new WebRTCService()

export default webrtcService
