import React, { useRef, useEffect, useState } from 'react';

const StreamViewer = ({ stream, socket, user, onBack }) => {
  const videoRef = useRef(null);
  const peerConnection = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    joinStream();

    socket.on('offer', async (data) => {
      await handleOffer(data.offer);
    });

    socket.on('ice-candidate', async (data) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on('stream-ended', () => {
      alert('Stream has ended');
      onBack();
    });

    return () => {
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      socket.off('offer');
      socket.off('ice-candidate');
      socket.off('stream-ended');
    };
  }, [stream, socket, onBack]);

  const joinStream = () => {
    socket.emit('join-stream', {
      streamId: stream._id,
      viewerId: user.id
    });

    createPeerConnection();
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          streamId: stream._id,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      videoRef.current.srcObject = event.streams[0];
      setIsConnected(true);
    };

    peerConnection.current = pc;
  };

  const handleOffer = async (offer) => {
    if (peerConnection.current) {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      
      socket.emit('answer', {
        answer: answer,
        to: socket.id
      });
    }
  };

  return (
    <div className="stream-viewer">
      <div className="viewer-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Dashboard
        </button>
        
        <div className="stream-info">
          <h2>{stream.title}</h2>
          <p>Streamed by {stream.streamer.username}</p>
        </div>
      </div>

      <div className="video-container">
        {!isConnected && (
          <div className="connecting-overlay">
            <p>Connecting to stream...</p>
          </div>
        )}
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="viewer-video"
          style={{ display: isConnected ? 'block' : 'none' }}
        />
      </div>

      {stream.description && (
        <div className="stream-description">
          <h3>About this stream</h3>
          <p>{stream.description}</p>
        </div>
      )}
    </div>
  );
};

export default StreamViewer;