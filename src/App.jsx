import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import StreamerView from './components/StreamerView';
import ViewerDashboard from './components/ViewerDashboard';
import Auth from './components/Auth';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [user, setUser] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and set user
      const userData = JSON.parse(localStorage.getItem('user'));
      setUser(userData);
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsStreaming(false);
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading LiveStream...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>🔴 LiveStream</h1>
          <div className="header-controls">
            <span>Welcome, {user.username}!</span>
            <button 
              className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`nav-btn ${currentView === 'stream' ? 'active' : ''}`}
              onClick={() => setCurrentView('stream')}
            >
              Go Live
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {currentView === 'dashboard' ? (
          <ViewerDashboard socket={socket} user={user} />
        ) : (
          <StreamerView 
            socket={socket} 
            user={user} 
            isStreaming={isStreaming}
            setIsStreaming={setIsStreaming}
          />
        )}
      </main>
    </div>
  );
}

export default App;