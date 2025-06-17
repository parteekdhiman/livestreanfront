import React, { useState, useEffect } from 'react';
import StreamViewer from './StreamViewer';

const ViewerDashboard = ({ socket, user }) => {
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreams();

    socket.on('new-stream', (streamData) => {
      setStreams(prev => [...prev, streamData]);
    });

    socket.on('stream-ended', () => {
      setSelectedStream(null);
      fetchStreams();
    });

    return () => {
      socket.off('new-stream');
      socket.off('stream-ended');
    };
  }, [socket]);

  const fetchStreams = async () => {
    try {
      const response = await fetch('https://livestreanbackend.onrender.com/api/streams');
      const streamsData = await response.json();
      setStreams(streamsData);
    } catch (error) {
      console.error('Error fetching streams:', error);
    }
    setLoading(false);
  };

  if (selectedStream) {
    return (
      <StreamViewer
        stream={selectedStream}
        socket={socket}
        user={user}
        onBack={() => setSelectedStream(null)}
      />
    );
  }

  return (
    <div className="viewer-dashboard">
      <h2>Live Streams</h2>
      
      {loading ? (
        <div className="loading">Loading streams...</div>
      ) : streams.length === 0 ? (
        <div className="no-streams">
          <p>No live streams at the moment</p>
          <p>Check back later or start your own stream!</p>
        </div>
      ) : (
        <div className="streams-grid">
          {streams.map(stream => (
            <div key={stream._id} className="stream-card">
              <div className="stream-thumbnail">
                <div className="live-badge">🔴 LIVE</div>
              </div>
              
              <div className="stream-details">
                <h3>{stream.title}</h3>
                <p className="streamer-name">by {stream.streamer.username}</p>
                <p className="viewer-count">👥 {stream.viewers.length} watching</p>
                
                <button
                  onClick={() => setSelectedStream(stream)}
                  className="watch-btn"
                >
                  Watch Stream
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewerDashboard;