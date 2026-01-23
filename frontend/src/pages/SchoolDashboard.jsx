import { useEffect, useState, useCallback } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import ReportsPage from "./ReportsPage";
import StudentsPage from "./StudentsPage";
import StudentProfilePage from "./StudentProfilePage";
import AuditLogPage from "./AuditLogPage";
import UsersPage from "./UsersPage";
import FeesPage from "./FeesPage";
import NoticesPage from "./NoticesPage";
import ComplaintsPage from "./ComplaintsPage";
import AcademicYearsPage from "./AcademicYearsPage";
import GradesManagementPage from "./GradesManagementPage";
import GradesManagementPage from "./GradesManagementPage";
import CheckoutPage from "./CheckoutPage";
import BoardDashboard from "./BoardDashboard";
import PrincipalOverview from "@/components/PrincipalOverview";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { ShieldAlert, ChevronDown, RefreshCw, Building2, Calendar } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

// Role display labels
const ROLE_LABELS = {
  superuser: "Superuser",
  principal: "Principal",
  school_admin: "School Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  parent: "Parent",
  student: "Student",
};

// ============================================
// RBAC CONFIGURATION - Role-based access control
// ============================================
const RBAC_CONFIG = {
  routes: {
    overview: ["principal", "super_admin", "teacher", "accountant", "parent", "student"],
    users: ["principal", "super_admin"],
    students: ["principal", "super_admin", "teacher", "accountant", "parent"],
    "students/:studentId": ["principal", "super_admin", "teacher", "accountant", "parent"],
    fees: ["principal", "super_admin", "accountant"],
    notices: ["principal", "super_admin", "teacher", "accountant", "parent", "student"],
    complaints: ["principal", "super_admin", "teacher", "parent"],  // Phase 6.1: Added parent
    reports: ["principal", "super_admin"],
    "audit-logs": ["principal", "super_admin"],
    "academic-years": ["principal"],  // Phase 7C: Academic Year management
    "grades": ["principal"],  // Grade & Section Management
    "checkout": ["principal", "super_admin", "accountant", "school_admin"],
    "board-analytics": ["super_admin", "board"], // Executive Dashboard
  },
  sidebar: {
    overview: ["principal", "super_admin", "teacher", "accountant", "parent", "student"],
    users: ["principal", "super_admin"],
    students: ["principal", "super_admin", "teacher", "accountant", "parent"],
    fees: ["principal", "super_admin", "accountant"],
    notices: ["principal", "super_admin", "teacher", "accountant", "parent", "student"],
    complaints: ["principal", "super_admin", "teacher", "parent"],  // Phase 6.1: Added parent
    reports: ["principal", "super_admin"],
    "audit-logs": ["principal", "super_admin"],
    "academic-years": ["principal"],  // Phase 7C: Academic Year management
    "grades": ["principal"],  // Grade & Section Management
    "checkout": ["principal", "super_admin", "accountant", "school_admin"],
    "board-analytics": ["super_admin", "board"], // Executive Dashboard
  },
};

const ROUTE_CONFIG = {
  overview: { title: "Overview", id: "nav-overview" },
  users: { title: "Users", id: "nav-users" },
  students: { title: "Students", id: "nav-students" },
  fees: { title: "Fees & Payments", id: "nav-fees" },
  notices: { title: "Notices", id: "nav-notices" },
  complaints: { title: "Complaints", id: "nav-complaints" },
  reports: { title: "Reports", id: "nav-reports" },
  "audit-logs": { title: "Audit Logs", id: "nav-audit-logs" },
  "academic-years": { title: "Academic Years", id: "nav-academic-years" },
  "grades": { title: "Grades & Sections", id: "nav-grades" },
  "checkout": { title: "Checkout", id: "nav-checkout" },
  "board-analytics": { title: "Board Room", id: "nav-board-analytics" },
};

function canAccessRoute(role, route) {
  if (!role) return false;
  const routeKey = route.includes(":") ? route : route;
  const config = RBAC_CONFIG.routes[routeKey];
  if (!config) {
    // Check for dynamic routes
    if (route.startsWith("students/")) {
      return RBAC_CONFIG.routes["students/:studentId"]?.includes(role) || false;
    }
    return false;
  }
  return config.includes(role);
}

function canSeeSidebarItem(role, route) {
  if (!role || !RBAC_CONFIG.sidebar[route]) return false;
  return RBAC_CONFIG.sidebar[route].includes(role);
}

// Access Denied Component
function AccessDenied() {
  return (
    <div className="col-span-full space-y-6">
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="py-12 text-center">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-4">You do not have permission to access this section.</p>
          <NavLink to="/school/overview">
            <Button variant="outline" className="border-slate-600 text-slate-300">
              Go to Overview
            </Button>
          </NavLink>
        </CardContent>
      </Card>
    </div>
  );
}

// Protected Route Wrapper
function ProtectedRoute({ children, route, userRole }) {
  if (!canAccessRoute(userRole, route)) {
    return <AccessDenied />;
  }
  return children;
}

// ============================================
// Role Switcher Component
// ============================================
function RoleSwitcher({ user, onSwitch, switching }) {
  const { getAvailableRoles, isDualRole, getEffectiveRole } = useAuth();

  const availableRoles = getAvailableRoles();
  const currentRole = getEffectiveRole();
  const hasDualRole = isDualRole();

  if (!hasDualRole) {
    return (
      <div className="text-xs text-slate-400">
        {ROLE_LABELS[currentRole] || currentRole}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
          disabled={switching}
        >
          {switching ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          {ROLE_LABELS[currentRole] || currentRole}
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-slate-900 border-slate-700">
        {availableRoles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => role !== currentRole && onSwitch(role)}
            className={`text-slate-300 hover:bg-slate-800 cursor-pointer ${role === currentRole ? "bg-slate-800 font-medium" : ""
              }`}
          >
            {ROLE_LABELS[role] || role}
            {role === currentRole && " ✓"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// Overview Component
// ============================================
function Overview() {
  const { accessToken, isHydrated, user, getEffectiveRole } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const effectiveRole = getEffectiveRole();

  useEffect(() => {
    const load = async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/dashboard/summary`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setSummary(res.data);
      } catch (e) {
        console.error("[Overview] Error:", e);
        setSummary({
          student_count: 0,
          pending_dues_count: 0,
          fees_collected_this_month: 0,
          notices_count: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    if (isHydrated) {
      load();
    }
  }, [accessToken, isHydrated]);

  // Fetch Critical Notices for Banner
  const [criticalNotices, setCriticalNotices] = useState([]);

  useEffect(() => {
    if (!accessToken) return;
    const loadCritical = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/notices`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const all = Array.isArray(res.data) ? res.data : [];
        const now = new Date();
        const filtered = all.filter(n => {
          if (n.priority !== "CRITICAL") return false;
          // Active Check (Server does filtering for non-admins, but admins get all. We must double check for banner.)
          if (n.expires_at && new Date(n.expires_at) <= now) return false;
          if (n.scheduled_at && new Date(n.scheduled_at) > now) return false;
          return true;
        });
        setCriticalNotices(filtered);
      } catch (e) { console.error("Critical notice fetch failed", e); }
    };
    loadCritical();
  }, [accessToken]);

  // Loading state
  if (!isHydrated || loading) {
    return (
      <div className="col-span-full space-y-6">
        <div className="h-8 w-32 bg-slate-700 rounded animate-pulse" />
        <Card className="bg-slate-900 border-slate-700 animate-pulse">
          <CardContent className="py-12" />
        </Card>
      </div>
    );
  }

  // Use PrincipalOverview for principal and super_admin roles (after hydration is complete)
  if (effectiveRole === "principal" || effectiveRole === "super_admin") {
    return <PrincipalOverview />;
  }

  // Role-based card visibility
  const canSeeFinancials = effectiveRole && ["principal", "super_admin", "accountant"].includes(effectiveRole);
  const canSeeStudents = effectiveRole && ["principal", "super_admin", "teacher", "accountant"].includes(effectiveRole);

  const cards = [
    canSeeStudents && {
      key: "students",
      label: "Students",
      value: summary?.student_count ?? 0,
      link: "/school/students",
    },
    canSeeFinancials && {
      key: "pending_dues",
      label: "Pending Dues",
      value: summary?.pending_dues_count ?? 0,
      link: "/school/fees",
    },
    canSeeFinancials && {
      key: "fees_collected",
      label: "Fees Collected (Month)",
      value: `NPR ${(summary?.fees_collected_this_month ?? 0).toLocaleString()}`,
      link: "/school/fees",
    },
    {
      key: "notices",
      label: "Notices",
      value: summary?.notices_count ?? 0,
      link: "/school/notices",
    },
  ].filter(Boolean);

  if (!isHydrated || loading) {
    return (
      <div className="col-span-full space-y-6">
        <h1 className="text-2xl font-semibold text-slate-100">Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 animate-pulse">
              <div className="h-3 bg-slate-700 rounded w-20 mb-2" />
              <div className="h-8 bg-slate-700 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Role-specific welcome message
  const getWelcomeMessage = () => {
    switch (effectiveRole) {
      case "principal":
        return "Welcome back! You have full administrative access.";
      case "teacher":
        return `Welcome! You can view students in your assigned grades.`;
      case "parent":
        return "Welcome! You can view your children's information.";
      case "accountant":
        return "Welcome! You have access to financial and payment data.";
      default:
        return "Welcome to your dashboard!";
    }
  };

  // Parent-specific dashboard
  if (effectiveRole === "parent") {
    return (
      <div className="col-span-full space-y-6">
        <h1 className="text-2xl font-semibold text-slate-100">My Children</h1>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-3">
            <p className="text-sm text-slate-300">{getWelcomeMessage()}</p>
          </CardContent>
        </Card>

        {/* Children List with Fees */}
        {summary?.children && summary.children.length > 0 ? (
          <div className="space-y-4">
            {summary.children.map((child) => (
              <Card key={child.id} className="bg-slate-900 border-slate-700">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">
                        {child.first_name} {child.last_name}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {child.grade_name || "Grade N/A"}{child.section_name ? ` (${child.section_name})` : ""}
                      </p>
                    </div>
                    <NavLink
                      to={`/school/students/${child.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View Profile →
                    </NavLink>
                  </div>
                  {child.outstanding_fees > 0 && (
                    <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                      <p className="text-red-400 text-sm">
                        Outstanding Fees: <span className="font-semibold">NPR {child.outstanding_fees.toLocaleString()}</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Total Outstanding */}
            {summary.total_outstanding > 0 && (
              <Card className="bg-red-900/30 border-red-700">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-red-200">Total Outstanding Fees</span>
                    <span className="text-2xl font-bold text-red-400">
                      NPR {summary.total_outstanding.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="py-8 text-center">
              <p className="text-slate-400">No children linked to your account.</p>
              <p className="text-slate-500 text-sm mt-2">Contact school administration to link your children.</p>
            </CardContent>
          </Card>
        )}

        {/* Notices */}
        <NavLink
          to="/school/notices"
          className="block rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 hover:border-blue-600 transition-colors"
        >
          <div className="text-xs text-slate-400 mb-1">School Notices</div>
          <div className="text-2xl font-semibold text-slate-50">{summary?.notices_count ?? 0}</div>
        </NavLink>
      </div>
    );
  }

  return (
    <div className="col-span-full space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Overview</h1>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="py-3">
          <p className="text-sm text-slate-300">{getWelcomeMessage()}</p>
        </CardContent>
      </Card>

      {/* Critical Notices Banner */}
      {criticalNotices.length > 0 && (
        <div className="space-y-4">
          {criticalNotices.map(notice => (
            <Card key={notice.id} className="bg-red-50 border-red-200 shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600" />
              <CardContent className="p-4 pl-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-600 text-white hover:bg-red-700 border-none">
                      <ShieldAlert className="w-3 h-3 mr-1" />
                      CRITICAL NOTICE
                    </Badge>
                    <span className="text-xs text-red-700 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(notice.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {notice.title}
                  </h3>
                  <p className="text-slate-600 line-clamp-1 text-sm">
                    {notice.content}
                  </p>
                </div>
                <NavLink to={`/school/notices?noticeId=${notice.id}`}>
                  <Button size="sm" className="bg-white text-red-700 border border-red-200 hover:bg-red-50 hover:text-red-800 shadow-sm shrink-0">
                    View Details
                  </Button>
                </NavLink>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((card) => (
            <NavLink
              key={card.key}
              to={card.link}
              className="block rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 hover:border-blue-600 transition-colors"
            >
              <div className="text-xs text-slate-400 mb-1">{card.label}</div>
              <div className="text-2xl font-semibold text-slate-50">{card.value}</div>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main SchoolDashboard Component
// ============================================
function SchoolDashboard() {
  const navigate = useNavigate();
  const { logout, user, accessToken, isHydrated, switchRole, getEffectiveRole } = useAuth();
  const location = useLocation();
  const [switching, setSwitching] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [schoolLoading, setSchoolLoading] = useState(true);

  const effectiveRole = getEffectiveRole();

  // Extract current route segment
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const currentRoute = pathSegments[pathSegments.length - 1] || "overview";

  // Fetch school information based on user's school_id
  const fetchSchoolInfo = useCallback(async () => {
    if (!accessToken || !user?.school_id) {
      setSchoolLoading(false);
      return;
    }

    try {
      // Try to get school info from dashboard summary which includes school_name and logo
      const res = await axios.get(`${API_BASE}/api/dashboard/summary`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.data?.school_name) {
        setSchoolInfo({
          name: res.data.school_name,
          logo_url: res.data.school_logo_url,
          type: res.data.school_type,
          id: user.school_id,
        });
      }
    } catch (err) {
      console.error("[SchoolDashboard] Failed to fetch school info:", err);
      // Fallback - just use school_id
      setSchoolInfo({
        name: null,
        logo_url: null,
        type: null,
        id: user.school_id,
      });
    } finally {
      setSchoolLoading(false);
    }
  }, [accessToken, user?.school_id]);

  useEffect(() => {
    if (isHydrated && accessToken && user?.school_id) {
      fetchSchoolInfo();
    }
  }, [isHydrated, accessToken, user?.school_id, fetchSchoolInfo]);

  // Handle role switch
  const handleRoleSwitch = async (newRole) => {
    setSwitching(true);
    const success = await switchRole(newRole);
    if (success) {
      // Navigate to overview on role switch to avoid access issues
      navigate("/school/overview");
    }
    setSwitching(false);
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Get sidebar items based on effective role
  const sidebarItems = Object.entries(ROUTE_CONFIG).filter(([path]) =>
    canSeeSidebarItem(effectiveRole, path)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 border-r border-slate-800 bg-nepsis-primary px-4 py-6 space-y-2 flex-shrink-0">
        {/* School Branding - Logo + Name */}
        <div className="mb-6 pb-4 border-b border-white/10">
          {schoolLoading ? (
            <div className="h-12 bg-slate-800 animate-pulse rounded" />
          ) : (
            <div className="flex items-center gap-3">
              {schoolInfo?.logo_url ? (
                <img
                  src={schoolInfo.logo_url}
                  alt={schoolInfo.name}
                  className="h-10 w-10 rounded object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`${schoolInfo?.logo_url ? 'hidden' : 'flex'} h-10 w-10 rounded bg-white/10 items-center justify-center shrink-0`}>
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate" title={schoolInfo?.name}>
                  {schoolInfo?.name || "School"}
                </div>
                <div className="text-xs text-gray-400 capitalize">
                  {schoolInfo?.type || "school"}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Navigation</div>
        {sidebarItems.map(([path, config]) => (
          <NavLink
            key={config.id}
            to={`/school/${path}`}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-full text-sm ${isActive ? "bg-white/10 text-white font-medium" : "text-gray-300 hover:bg-white/5"
              }`
            }
          >
            {config.title}
          </NavLink>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-6 py-6 space-y-6 overflow-auto">
        {/* Header Bar with School Logo + Name and Role Switcher */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {/* School Logo + Name - Prominent Display */}
            {schoolInfo?.name && (
              <>
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
                  {schoolInfo.logo_url ? (
                    <img
                      src={schoolInfo.logo_url}
                      alt={schoolInfo.name}
                      className="h-6 w-6 rounded object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-nepsis-primary" />
                  )}
                  <span className="text-sm font-medium text-slate-200">{schoolInfo.name}</span>
                </div>
                {/* National Flag Placeholder (Top-Right in instructions, but putting it near logo for context if preferred, or floating right) */}
                {/* Requirement says Top-Right of Global Header. This is the main content header. */}
                {/* I will add it to the right side next to logout. */}
                <span className="text-slate-600">/</span>
              </>
            )}
            <span className="text-sm font-medium text-slate-300">
              {ROUTE_CONFIG[currentRoute]?.title || "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* National Flag */}
            <span className="text-2xl" role="img" aria-label="Flag">
              {schoolInfo?.country === 'India' ? '🇮🇳' :
                schoolInfo?.country === 'USA' ? '🇺🇸' :
                  schoolInfo?.country === 'UK' ? '🇬🇧' :
                    schoolInfo?.country === 'Australia' ? '🇦🇺' :
                      '🇳🇵'}
            </span>
            {/* Role Switcher */}
            <RoleSwitcher user={user} onSwitch={handleRoleSwitch} switching={switching} />
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-slate-600 text-slate-100 hover:bg-slate-800"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </header>

        {/* Route Content */}
        <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <Routes key={location.pathname}>
            <Route path="overview" element={<Overview />} />
            <Route
              path="users"
              element={
                <ProtectedRoute route="users" userRole={effectiveRole}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="students"
              element={
                <ProtectedRoute route="students" userRole={effectiveRole}>
                  <StudentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="students/:studentId"
              element={
                <ProtectedRoute route="students/:studentId" userRole={effectiveRole}>
                  <StudentProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="fees"
              element={
                <ProtectedRoute route="fees" userRole={effectiveRole}>
                  <FeesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="notices"
              element={
                <ProtectedRoute route="notices" userRole={effectiveRole}>
                  <NoticesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="complaints"
              element={
                <ProtectedRoute route="complaints" userRole={effectiveRole}>
                  <ComplaintsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute route="reports" userRole={effectiveRole}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute route="audit-logs" userRole={effectiveRole}>
                  <AuditLogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="board-analytics"
              element={
                <ProtectedRoute route="board-analytics" userRole={effectiveRole}>
                  <BoardDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="academic-years"
              element={
                <ProtectedRoute route="academic-years" userRole={effectiveRole}>
                  <AcademicYearsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="grades"
              element={
                <ProtectedRoute route="grades" userRole={effectiveRole}>
                  <GradesManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="checkout"
              element={
                <ProtectedRoute route="checkout" userRole={effectiveRole}>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Overview />} />
          </Routes>
        </section>
      </main>
    </div>
  );
}

export default SchoolDashboard;

