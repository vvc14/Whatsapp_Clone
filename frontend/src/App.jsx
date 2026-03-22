import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ChatProvider } from './contexts/ChatContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Sidebar from './components/Sidebar/Sidebar';
import ChatWindow from './components/Chat/ChatWindow';
import { useState, useEffect } from 'react';
import { getGoogleClientId } from './services/api';
import './index.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-primary)',
      }}>
        <div className="spinner" style={{ width: 48, height: 48 }}></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ChatApp() {
  return (
    <SocketProvider>
      <ChatProvider>
        <div className="app-layout">
          <Sidebar />
          <ChatWindow />
        </div>
      </ChatProvider>
    </SocketProvider>
  );
}

function App() {
  const [googleClientId, setGoogleClientId] = useState('');
  const [clientIdLoaded, setClientIdLoaded] = useState(false);

  useEffect(() => {
    // Fetch Google Client ID from backend
    getGoogleClientId()
      .then(res => {
        setGoogleClientId(res.data.client_id);
      })
      .catch(err => {
        console.warn('Could not fetch Google Client ID:', err);
      })
      .finally(() => {
        setClientIdLoaded(true);
      });
  }, []);

  if (!clientIdLoaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#111b21',
      }}>
        <div className="spinner" style={{ width: 48, height: 48 }}></div>
      </div>
    );
  }

  const appContent = (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <ProtectedRoute>
              <ChatApp />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );

  // If we have a valid Google Client ID, wrap with GoogleOAuthProvider
  if (googleClientId && googleClientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {appContent}
      </GoogleOAuthProvider>
    );
  }

  // Otherwise render without Google OAuth (Google buttons won't show)
  return appContent;
}

export default App;
