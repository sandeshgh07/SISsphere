import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeRole, setActiveRole] = useState(localStorage.getItem('activeRole'));
  const [availableRoles, setAvailableRoles] = useState(JSON.parse(localStorage.getItem('availableRoles') || '[]'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));

            // Determine active role: either from storage or token
            let currentRole = localStorage.getItem('activeRole');
            if (!currentRole) {
                currentRole = payload.role;
                localStorage.setItem('activeRole', currentRole);
            }

            const roles = JSON.parse(localStorage.getItem('availableRoles') || '[]');
            // Fallback if availableRoles is empty but we have token
            const finalRoles = roles.length > 0 ? roles : [payload.role];

            // Set User with the ACTIVE role so the rest of the app sees the context
            setUser({ ...payload, role: currentRole, roles: finalRoles });
            setActiveRole(currentRole);
            setAvailableRoles(finalRoles);

        } catch (e) {
            console.error("Token parse failed", e);
            localStorage.removeItem('token');
            setToken(null);
        }
    }
    setLoading(false);
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { access_token, available_roles } = response.data;

      localStorage.setItem('token', access_token);
      setToken(access_token);

      const { require_password_change } = response.data;

      const payload = JSON.parse(atob(access_token.split('.')[1]));

      // Handle Roles
      const roles = available_roles || [payload.role];
      localStorage.setItem('availableRoles', JSON.stringify(roles));
      setAvailableRoles(roles);

      // Default Active Role to Primary (token role)
      const primaryRole = payload.role;
      localStorage.setItem('activeRole', primaryRole);
      localStorage.setItem('role', primaryRole); // Legacy
      setActiveRole(primaryRole);

      const userData = { ...payload, role: primaryRole, roles: roles, require_password_change };
      setUser(userData);

      return userData;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const switchRole = (newRole) => {
      if (!availableRoles.includes(newRole)) return;

      localStorage.setItem('activeRole', newRole);
      localStorage.setItem('role', newRole); // Update legacy key just in case
      setActiveRole(newRole);

      // Soft Refresh: Reload page to clear local state/cache as requested
      // This ensures components re-mount and fetch fresh data with new role
      window.location.reload();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('activeRole');
    localStorage.removeItem('availableRoles');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, switchRole, availableRoles, activeRole, isAuthenticated: !!token, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
