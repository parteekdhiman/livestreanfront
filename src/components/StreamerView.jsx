import React, { useState, useRef, useEffect } from 'react';

const StreamerView = ({ socket, user, isStreaming, setIsStreaming }) => {
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [currentStream, setCurrentStream] = useState(null);
  
  const videoRef = useRef(null);
  const peerConnections = useRef(new Map());
  const localStream = useRef(null);

  useEffect(() => {
    socket.on('viewer-joined', (data) => {
      setViewerCount(data.viewerCount);
      // Create peer connection for new viewer
      createPeerConnection(data.viewerId);
    });

    socket.on('answer', async (data) => {
      const pc = peerConnections.current.get(data.from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on('ice-candidate', async (data) => {
      const pc = peerConnections.current.get(data.from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    return () => {
      socket.off('viewer-joined');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket]);

  const createPeerConnection = async (viewerId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Add local stream to peer connection
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          streamId: currentStream?.id,
          candidate: event.candidate
        });
      }
    };

    // Create offer for viewer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socket.emit('offer', {
      streamId: currentStream?.id,
      offer: offer
    });

    peerConnections.current.set(viewerId, pc);
  };

  const startStream = async () => {
    if (!streamTitle.trim()) {
      alert('Please enter a stream title');
      return;
    }

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      localStream.current = stream;
      videoRef.current.srcObject = stream;

      // Create stream record
      const response = await fetch('https://livestreanbackend.onrender.com/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: streamTitle,
          description: streamDescription,
          streamerId: user.id
        })
      });

      const streamData = await response.json();
      setCurrentStream(streamData);

      // Notify server about stream start
      socket.emit('start-stream', {
        streamId: streamData._id,
        streamerId: user.id,
        title: streamTitle,
        streamerName: user.username
      });

      setIsStreaming(true);
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('Could not access camera/microphone');
    }
  };

  const endStream = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    socket.emit('end-stream', { streamId: currentStream?.id });
    
    setIsStreaming(false);
    setCurrentStream(null);
    setViewerCount(0);
    setStreamTitle('');
    setStreamDescription('');
  };

  return (
    <div className="streamer-view">
      {!isStreaming ? (
        <div className="stream-setup">
          <h2>Start Your Live Stream</h2>
          
          <div className="setup-form">
            <input
              type="text"
              placeholder="Stream Title"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              className="stream-input"
            />
            
            <textarea
              placeholder="Stream Description (optional)"
              value={streamDescription}
              onChange={(e) => setStreamDescription(e.target.value)}
              className="stream-textarea"
            />
            
            <button onClick={startStream} className="start-stream-btn">
              🔴 Go Live
            </button>
          </div>
        </div>
      ) : (
        <div className="live-stream">
          <div className="stream-header">
            <div className="stream-info">
              <h2>{streamTitle}</h2>
              <div className="stream-stats">
                <span className="live-indicator">🔴 LIVE</span>
                <span className="viewer-count">👥 {viewerCount} viewers</span>
              </div>
            </div>
            
            <button onClick={endStream} className="end-stream-btn">
              End Stream
            </button>
          </div>
          
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="stream-video"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamerView;