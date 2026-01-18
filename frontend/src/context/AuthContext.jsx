import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const role = payload.role;
            localStorage.setItem('role', role);
            setUser({ role, ...payload });
        } catch (e) {
            localStorage.removeItem('token');
            setToken(null);
        }
    }
    setLoading(false);
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { access_token } = response.data;

      localStorage.setItem('token', access_token);
      setToken(access_token);

      const { require_password_change } = response.data;

      const payload = JSON.parse(atob(access_token.split('.')[1]));
      const role = payload.role;
      localStorage.setItem('role', role);

      const userData = { role, ...payload, require_password_change };
      setUser(userData);

      return userData;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
