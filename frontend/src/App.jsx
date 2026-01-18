import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';

import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import NoticeFeed from './components/NoticeFeed';
import StudentDashboard from './pages/StudentDashboard';
import FeesTab from './pages/FeesTab';
import GuardScanner from './pages/GuardScanner';
import BoardDashboard from './pages/BoardDashboard';
import ParentDashboard from './pages/ParentDashboard';
import PasswordReset from './pages/PasswordReset';

// Simple wrapper to force auth check
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  if (user.must_change_password) {
      return <Navigate to="/password-reset" />;
  }

  return children;
};

const RequireReset = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" />;
    if (!user.must_change_password) return <Navigate to="/dashboard" />;
    return children;
}

const DashboardHome = () => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Welcome back!</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Quick Stats or Widgets can go here */}
                <NoticeFeed />
            </div>
        </div>
    )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/password-reset" element={
              <RequireReset>
                  <PasswordReset />
              </RequireReset>
          } />

          <Route path="/guard/scan" element={
            <ProtectedRoute>
              <GuardScanner />
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardHome />} />
            <Route path="notices" element={<NoticeFeed />} />
            <Route path="profile" element={<StudentDashboard />} />
            <Route path="fees" element={<FeesTab />} />
            <Route path="board-analytics" element={<BoardDashboard />} />
            <Route path="parent-dashboard" element={<ParentDashboard />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
