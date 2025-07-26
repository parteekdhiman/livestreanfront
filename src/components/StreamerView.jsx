import React, { useState, useRef, useEffect } from 'react';

const StreamerView = ({ socket, user, isStreaming, setIsStreaming }) => {
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [currentStream, setCurrentStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
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

  // Check available media devices
  const checkMediaDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      console.log('Available video devices:', videoDevices.length);
      console.log('Available audio devices:', audioDevices.length);
      
      if (videoDevices.length === 0) {
        throw new Error('No camera found on this device');
      }
      if (audioDevices.length === 0) {
        throw new Error('No microphone found on this device');
      }
      
      return true;
    } catch (error) {
      console.error('Error checking devices:', error);
      throw error;
    }
  };

  // Get media with fallback constraints
  const getMediaWithFallback = async () => {
    const constraints = [
      // Try high quality first
      { 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      },
      // Fallback to standard quality
      { 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        }, 
        audio: true 
      },
      // Fallback to any video quality
      { video: true, audio: true },
      // Last resort - video only (if audio fails)
      { video: true, audio: false }
    ];

    let lastError;
    
    for (let i = 0; i < constraints.length; i++) {
      try {
        console.log(`Trying media constraint ${i + 1}:`, constraints[i]);
        const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
        console.log('Media access successful with constraint:', constraints[i]);
        
        // Log stream details
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        console.log(`Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);
        
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          console.log('Video settings:', settings);
        }
        
        return stream;
      } catch (error) {
        console.log(`Constraint ${i + 1} failed:`, error.name, error.message);
        lastError = error;
        continue;
      }
    }
    
    throw lastError;
  };

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
          streamId: currentStream?._id,
          candidate: event.candidate
        });
      }
    };

    // Create offer for viewer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socket.emit('offer', {
      streamId: currentStream?._id,
      offer: offer
    });

    peerConnections.current.set(viewerId, pc);
  };

  const startStream = async () => {
    if (!streamTitle.trim()) {
      alert('Please enter a stream title');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Starting stream process...');
      
      // Step 1: Check if media devices are available
      console.log('Checking media devices...');
      await checkMediaDevices();
      
      // Step 2: Request media access with fallback
      console.log('Requesting media access...');
      const stream = await getMediaWithFallback();

      // Step 3: Set up video element
      localStream.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Step 4: Create stream record on server
      console.log('Creating stream record...');
      const response = await fetch('https://livestreanbackend.onrender.com/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: streamTitle,
          description: streamDescription,
          streamerId: user.id
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const streamData = await response.json();
      setCurrentStream(streamData);

      // Step 5: Notify server about stream start
      console.log('Notifying server about stream start...');
      socket.emit('start-stream', {
        streamId: streamData._id,
        streamerId: user.id,
        title: streamTitle,
        streamerName: user.username
      });

      setIsStreaming(true);
      console.log('Stream started successfully!');
      
    } catch (error) {
      console.error('Detailed error information:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      // Provide specific error messages based on error type
      let userMessage = 'Could not start stream. ';
      
      switch (error.name) {
        case 'NotFoundError':
          userMessage += 'Camera or microphone not found. Please check if your devices are connected and working.';
          break;
        case 'NotAllowedError':
          userMessage += 'Permission denied. Please allow camera and microphone access in your browser settings and try again.';
          break;
        case 'NotReadableError':
          userMessage += 'Camera or microphone is already in use. Please close other applications that might be using them and try again.';
          break;
        case 'OverconstrainedError':
          userMessage += 'Your camera does not support the required settings. This should have been handled automatically - please try again.';
          break;
        case 'SecurityError':
          userMessage += 'Security error. Make sure you\'re accessing this site over HTTPS.';
          break;
        case 'AbortError':
          userMessage += 'Media access was aborted. Please try again.';
          break;
        default:
          if (error.message.includes('devices')) {
            userMessage += error.message;
          } else if (error.message.includes('Server error')) {
            userMessage += 'Server connection failed. Please check your internet connection and try again.';
          } else {
            userMessage += `Unexpected error: ${error.message}`;
          }
      }
      
      alert(userMessage);
      
      // Clean up any partial setup
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const endStream = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    if (currentStream?._id) {
      socket.emit('end-stream', { streamId: currentStream._id });
    }
    
    setIsStreaming(false);
    setCurrentStream(null);
    setViewerCount(0);
    setStreamTitle('');
    setStreamDescription('');
  };

  // Test media access function for debugging
  const testMediaAccess = async () => {
    try {
      console.log('Testing media access...');
      await checkMediaDevices();
      const stream = await getMediaWithFallback();
      
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      alert('✅ Media access test successful! Your camera and microphone are working.');
    } catch (error) {
      console.error('Media test failed:', error);
      alert(`❌ Media access test failed: ${error.message}`);
    }
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
              disabled={isLoading}
            />
            
            <textarea
              placeholder="Stream Description (optional)"
              value={streamDescription}
              onChange={(e) => setStreamDescription(e.target.value)}
              className="stream-textarea"
              disabled={isLoading}
            />
            
            <div className="button-group">
              <button 
                onClick={startStream} 
                className="start-stream-btn"
                disabled={isLoading}
              >
                {isLoading ? '🔄 Setting up...' : '🔴 Go Live'}
              </button>
              
              <button 
                onClick={testMediaAccess} 
                className="test-media-btn"
                disabled={isLoading}
                style={{ 
                  marginLeft: '10px', 
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 15px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🧪 Test Camera/Mic
              </button>
            </div>
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