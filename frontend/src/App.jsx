import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';

import LoginPage from './pages/LoginPage';
import FindSchool from './pages/FindSchool';
import AdminLogin from './pages/AdminLogin';
import SchoolLoginPage from './pages/SchoolLoginPage';
import DashboardLayout from './pages/DashboardLayout';
import NoticeFeed from './components/NoticeFeed';
import NoticesPage from './pages/NoticesPage';
import StudentDashboard from './pages/StudentDashboard';
import FeesPage from './pages/FeesPage';
import GuardScanner from './pages/GuardScanner';
import FinanceOverviewDashboard from './pages/FinanceOverviewDashboard';
import BoardExecutiveDashboard from './pages/BoardExecutiveDashboard';
import ParentDashboard from './pages/ParentDashboard';
import ParentAcademics from './pages/ParentAcademics';
import ParentFinancials from './pages/ParentFinancials';
import ParentDirectory from './pages/ParentDirectory';
import PublicAdmission from './pages/PublicAdmission';
import AdmissionsWorkspace from './pages/AdmissionsWorkspace';
import ResetPassword from './pages/ResetPassword';
import PasswordReset from './pages/PasswordReset';
import LandingPage from './pages/LandingPage';
import AccountSuspended from './pages/AccountSuspended';
import ContactUs from './pages/ContactUs';
import UserManagement from './pages/UserManagement';
import ComplaintsPage from './pages/ComplaintsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import AcademicsPage from './pages/AcademicsPage';
import AcademicSetupHub from './pages/AcademicSetupHub';
import PrincipalOverview from './components/PrincipalOverview';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import PlatformAdminDashboard from './pages/PlatformAdminDashboard';
import SuperAdminLayout from './pages/SuperAdminLayout';
import {
  GodViewOverview,
  GodViewSchools,
  GodViewFinance,
  GodViewRetention,
  GodViewFeatures,
  GodViewHealth,
  GodViewAuditLogs,
  GodViewInquiries
} from './pages/godview';
import ClassAnalytics from './pages/ClassAnalytics';
import RecordAttendancePage from './pages/RecordAttendancePage';
import StudentAttendancePage from './pages/StudentAttendancePage';
import StudentAssessmentsPage from './pages/StudentAssessmentsPage';
import Student360Profile from './pages/Student360Profile';
import TeacherDashboard from './pages/TeacherDashboard';
import MyStudentsPage from './pages/MyStudentsPage';

import GradingWorkspace from './pages/GradingWorkspace';
import AccountOverviewPage from './pages/AccountOverviewPage';

// Simple wrapper to force auth check
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  if (user.require_password_change && window.location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" />;
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

const RequireRole = ({ children, allowedRoles, forbiddenRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  if (allowedRoles && !allowedRoles.some(r => r.toLowerCase() === user.role.toLowerCase())) {
    console.warn(`Redirecting role mismatch: User ${user.role} not in ${allowedRoles}`);
    return <Navigate to="/dashboard" />;
  }

  if (forbiddenRoles && forbiddenRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

const DashboardHome = () => {
  const { getEffectiveRole, isHydrated } = useAuth();
  const effectiveRole = getEffectiveRole();

  // Show loading state while hydrating
  if (!isHydrated) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  // Executive Roles: Landing Logic
  if (effectiveRole === "board") {
    return <Navigate to="/dashboard/board-analytics" replace />;
  }

  if (effectiveRole === "super_admin") {
    /* 
      Render Board Dashboard directly at /dashboard so "Overview" link stays active.
      Previously this redirected to /board-analytics which caused visual duplication 
      or URL mismatches. 
    */
    return <BoardExecutiveDashboard />;
  }

  // Use PrincipalOverview for principal
  if (effectiveRole === "principal") {
    return <PrincipalOverview />;
  }

  if (effectiveRole === "parent") {
    return <ParentDashboard />;
  }

  if (effectiveRole === "teacher") {
    return <TeacherDashboard />;
  }

  if (effectiveRole === "student") {
    return <StudentDashboard />;
  }

  // Default for other roles
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
          <Route path="/find-school" element={<FindSchool />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/platform-admin" element={
            <ProtectedRoute>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/school/:schoolSlug/login" element={<SchoolLoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account-suspended" element={<AccountSuspended />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/public/admissions/:school_uuid" element={<PublicAdmission />} />

          <Route path="/reset-password" element={
            <ProtectedRoute>
              <ResetPassword />
            </ProtectedRoute>
          } />

          <Route path="/password-reset" element={
            <RequireReset>
              <PasswordReset />
            </RequireReset>
          } />

          <Route path="/dashboard" element={
            <ErrorBoundary>
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            </ErrorBoundary>
          }>
            <Route index element={<DashboardHome />} />
            <Route path="scan" element={
              <RequireRole allowedRoles={['security_guard', 'principal', 'super_admin']}>
                <GuardScanner />
              </RequireRole>
            } />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="profile" element={
              <AccountOverviewPage />
            } />
            <Route path="fees" element={
              <RequireRole allowedRoles={['principal', 'super_admin', 'school_admin', 'accountant']}>
                <FeesPage />
              </RequireRole>
            } />
            <Route path="financials/overview" element={
              <RequireRole allowedRoles={['principal', 'super_admin', 'school_admin', 'accountant']}>
                <FinanceOverviewDashboard />
              </RequireRole>
            } />
            <Route path="board-analytics" element={
              <RequireRole allowedRoles={['super_admin', 'board']}>
                <BoardExecutiveDashboard />
              </RequireRole>
            } />
            <Route path="parent-dashboard" element={<ParentDashboard />} />
            <Route path="admissions" element={<AdmissionsWorkspace />} />
            <Route path="users" element={<UserManagement />} />

            {/* Parent Routes */}
            <Route path="parent/academics" element={<ParentAcademics />} />
            <Route path="parent/financials" element={<ParentFinancials />} />
            <Route path="parent/directory" element={<ParentDirectory />} />

            <Route path="complaints" element={
              <RequireRole allowedRoles={['student', 'parent', 'teacher', 'principal', 'super_admin', 'school_admin']}>
                <ComplaintsPage />
              </RequireRole>
            } />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="academics" element={
              <RequireRole forbiddenRoles={['security_guard']}>
                <AcademicsPage />
              </RequireRole>
            } />
            <Route path="academic-setup" element={
              <RequireRole allowedRoles={['principal', 'super_admin']}>
                <AcademicSetupHub />
              </RequireRole>
            } />
            <Route path="analytics/class" element={
              <RequireRole allowedRoles={['principal', 'super_admin']}>
                <ClassAnalytics />
              </RequireRole>
            } />
            <Route path="grading" element={
              <RequireRole allowedRoles={['principal', 'super_admin', 'teacher']}>
                <GradingWorkspace />
              </RequireRole>
            } />

            {/* --- NEW ATTENDANCE & ASSESSMENT ROUTES --- */}
            <Route path="attendance/record" element={
              <RequireRole allowedRoles={['teacher', 'principal', 'super_admin']}>
                <RecordAttendancePage />
              </RequireRole>
            } />

            <Route path="attendance" element={
              <RequireRole allowedRoles={['student']}>
                <StudentAttendancePage />
              </RequireRole>
            } />

            <Route path="assessments" element={
              <RequireRole allowedRoles={['student']}>
                <StudentAssessmentsPage />
              </RequireRole>
            } />

            <Route path="my-students" element={
              <RequireRole allowedRoles={['teacher']}>
                <MyStudentsPage />
              </RequireRole>
            } />

            <Route path="students/:studentId" element={
              <RequireRole allowedRoles={['teacher', 'principal', 'super_admin', 'school_admin', 'accountant']}>
                <Student360Profile />
              </RequireRole>
            } />
          </Route>

          {/* God View - Separate layout, superuser only */}
          <Route path="/god-view" element={
            <ProtectedRoute>
              <RequireRole allowedRoles={['superuser']}>
                <SuperAdminLayout />
              </RequireRole>
            </ProtectedRoute>
          }>
            <Route index element={<GodViewOverview />} />
            <Route path="schools" element={<GodViewSchools />} />
            <Route path="finance" element={<GodViewFinance />} />
            <Route path="retention" element={<GodViewRetention />} />
            <Route path="features" element={<GodViewFeatures />} />
            <Route path="health" element={<GodViewHealth />} />
            <Route path="audit-logs" element={<GodViewAuditLogs />} />
            <Route path="inquiries" element={<GodViewInquiries />} />
          </Route>

          <Route path="/" element={<LandingPage />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
