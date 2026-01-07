import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('mut_token'));
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('mut_session'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('mut_token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('mut_token');
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    if (sessionToken) {
      localStorage.setItem('mut_session', sessionToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;
    } else {
      localStorage.removeItem('mut_session');
    }
  }, [sessionToken]);

  useEffect(() => {
    const initAuth = async () => {
      if (sessionToken) {
        try {
          const response = await api.get('/api/auth/session/progress');
          setUser(response.data);
        } catch (error) {
          console.error('Session validation failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    const newToken = response.data.token;

    // Set token immediately (both state and header)
    setToken(newToken);
    localStorage.setItem('mut_token', newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    setUser(response.data.player);
    return response.data;
  };

  const register = async (username, email, password) => {
    const response = await api.post('/api/auth/register', { username, email, password });
    return response.data;
  };

  const startSession = async () => {
    const response = await api.post('/api/auth/session/start');
    const newSessionToken = response.data.token;

    // Set session token immediately (both state and header)
    setSessionToken(newSessionToken);
    localStorage.setItem('mut_session', newSessionToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newSessionToken}`;

    setUser(prev => ({ ...prev, sessionId: response.data.sessionId, progress: response.data.progress }));
    return response.data;
  };

  const refreshProgress = async () => {
    if (sessionToken) {
      const response = await api.get('/api/auth/session/progress');
      setUser(prev => ({ ...prev, ...response.data }));
      return response.data;
    }
  };

  const updateToken = (newToken) => {
    setSessionToken(newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setSessionToken(null);
    localStorage.removeItem('mut_token');
    localStorage.removeItem('mut_session');
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      sessionToken,
      loading,
      login,
      register,
      startSession,
      refreshProgress,
      updateToken,
      logout,
      isAuthenticated: !!sessionToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
