import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ChevronsUpDown,
  User,
  LayoutDashboard,
  Bell,
  GraduationCap,
  CreditCard,
  LogOut,
  Menu,
  X,
  BarChart3,
  MessageCircle,
  Users,
  FileText,
  QrCode,
  ClipboardList,
  Settings,
  CheckCircle,
  Calendar,
  BookOpen
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import AIChatWidget from '../components/AIChatWidget';
import SubscriptionBanner from '../components/SubscriptionBanner';
import AccountSuspended from './AccountSuspended';
import ChildSwitcher from '../components/dashboard/ChildSwitcher';
import { useSearchParams, useNavigate } from 'react-router-dom';


const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [childrenList, setChildrenList] = useState([]);
  const selectedChildId = searchParams.get('child_id');
  const [counts, setCounts] = useState({ notices: 0, complaints: 0, highest_priority: null });

  useEffect(() => {
    const fetchCounts = () => {
      if (user) {
        api.get('/stats/counts')
          .then(res => setCounts({
            notices: res.data.notices_count,
            complaints: res.data.complaints_count,
            highest_priority: res.data.highest_notice_priority || null
          }))
          .catch(err => console.error("Failed to fetch counts", err));
      }
    };

    if (user) {
      fetchCounts();

      if (user.role === 'parent') {
        api.get('/students/parent/dashboard/summary')
          .then(res => setChildrenList(res.data))
          .catch(err => console.error("Failed to fetch children", err));
      }
    }

    const handleRefresh = () => fetchCounts();
    window.addEventListener('sis-refresh-counts', handleRefresh);

    return () => {
      window.removeEventListener('sis-refresh-counts', handleRefresh);
    };
  }, [user]);

  const handleChildSwitch = (childId) => {
    if (childId === 'overview') {
      searchParams.delete('child_id');
      setSearchParams(searchParams);
      navigate('/dashboard');
    } else {
      setSearchParams({ child_id: childId });
      navigate(`/dashboard?child_id=${childId}`);
    }
  };

  if (!user) return <Navigate to="/login" />;

  // Hard Lockout Check (Phase 4)
  if (user.subscription_expiry) {
    const expiry = new Date(user.subscription_expiry);
    const now = new Date();
    const diffTime = now - expiry;
    const daysPast = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysPast >= 34) {
      return <AccountSuspended />;
    }
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SubscriptionBanner />
      <div className="flex flex-1 relative">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed md:sticky md:top-0 h-screen inset-y-0 left-0 z-50 w-64 bg-sissphere-primary border-r transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 flex flex-col shadow-xl md:shadow-none
      `}>
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                {/* School Logo - fetched from context */}
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden">
                  {user?.school_logo_url ? (
                    <img src={user.school_logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sissphere-primary font-bold">N</span>
                  )}
                </div>
                <span className="font-bold text-xl text-white">{user?.school_name || "Nepsis"}</span>
              </div>
              {/* National Flag */}
              <span className="text-2xl" role="img" aria-label="Flag">
                {user?.school_country === 'India' ? '🇮🇳' :
                  user?.school_country === 'USA' ? '🇺🇸' :
                    user?.school_country === 'UK' ? '🇬🇧' :
                      user?.school_country === 'Australia' ? '🇦🇺' :
                        '🇳🇵'}
              </span>
              <button onClick={toggleSidebar} className="md:hidden text-white">
                <X size={20} />
              </button>
            </div>

            {/* Parent Child Switcher */}
            {user?.role === 'parent' && (
              <div className="shrink-0">
                <ChildSwitcher
                  children={childrenList}
                  selectedChildId={selectedChildId}
                  onSelect={handleChildSwitch}
                />
              </div>
            )}

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
              <NavLink to="/dashboard" end className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                <LayoutDashboard size={20} />
                <span>{user?.role === 'parent' && selectedChildId ? 'Student Overview' : 'Overview'}</span>
              </NavLink>

              {user?.role === 'parent' && (
                <>
                  <NavLink to="/dashboard/parent/academics" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                    <GraduationCap size={20} />
                    <span>Academics</span>
                  </NavLink>
                  <NavLink to="/dashboard/parent/financials" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                    <CreditCard size={20} />
                    <span>Financials</span>
                  </NavLink>
                  <NavLink to="/dashboard/parent/directory" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                    <Users size={20} />
                    <span>Directory</span>
                  </NavLink>
                </>
              )}

              <NavLink
                to="/dashboard/notices"
                className={({ isActive }) => {
                  // Dynamic color based on highest priority unread notice
                  const priorityBg = counts.highest_priority === 'CRITICAL' || counts.highest_priority === 'IMPORTANT'
                    ? 'bg-red-800 hover:bg-red-700'
                    : isActive ? 'bg-white/10' : 'hover:bg-white/5';
                  return `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${priorityBg} ${isActive ? 'text-white font-medium' : 'text-gray-300'}`;
                }}
              >
                <div className="relative">
                  <Bell size={20} />
                  {counts.notices > 0 && (
                    <span className={`absolute -top-2 -right-2 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold ${counts.highest_priority === 'CRITICAL' || counts.highest_priority === 'IMPORTANT' ? 'bg-red-500' : 'bg-sissphere-alert'
                      }`}>
                      {counts.notices > 9 ? '9+' : counts.notices}
                    </span>
                  )}
                </div>
                <span>Notices</span>
              </NavLink>

              {user?.role !== 'school_admin' && (
                <NavLink to="/dashboard/complaints" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <div className="relative">
                    <MessageCircle size={20} />
                    {counts.complaints > 0 && (
                      <span className="absolute -top-2 -right-2 bg-sissphere-alert text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {counts.complaints > 9 ? '9+' : counts.complaints}
                      </span>
                    )}
                  </div>
                  <span>Complaints</span>
                </NavLink>
              )}

              {user?.role !== 'security_guard' && (
                <NavLink to="/dashboard/profile" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <GraduationCap size={20} />
                  <span>Profile</span>
                </NavLink>
              )}

              {user?.role === 'security_guard' && (
                <NavLink to="/dashboard/scan" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <QrCode size={20} />
                  <span>Scan Gate Pass</span>
                </NavLink>
              )}

              {['principal', 'school_admin'].includes(user?.role) && (
                <NavLink to="/dashboard/academics" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <GraduationCap size={20} />
                  <span>Academics</span>
                </NavLink>
              )}
              {['principal'].includes(user?.role) && (
                <NavLink to="/dashboard/academic-setup" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <Settings size={20} />
                  <span>Academic Setup</span>
                </NavLink>
              )}
              {user?.role !== 'security_guard' && (
                <>
                  {/* Main Financials Dashboard (Restricted) */}
                  {['principal', 'super_admin', 'school_admin', 'accountant'].includes(user?.role) && (
                    <NavLink to="/dashboard/financials/overview" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                      <CreditCard size={20} />
                      <span>Financials</span>
                    </NavLink>
                  )}

                  {/* Financial Setup (Old Fees Module) */}
                  {['principal', 'school_admin'].includes(user?.role) && (
                    <NavLink to="/dashboard/fees" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                      <Settings size={20} />
                      <span>Financial Setup</span>
                    </NavLink>
                  )}
                </>
              )}
              {(['board', 'school_admin'].includes(user?.role)) && (
                <NavLink to="/dashboard/board-analytics" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <BarChart3 size={20} />
                  <span>Board Room</span>
                </NavLink>
              )}
              {(user?.role === 'principal' || user?.role === 'super_admin') && (
                <NavLink to="/dashboard/users" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <Users size={20} />
                  <span>User Management</span>
                </NavLink>
              )}
              {/* Teacher Features */}
              {user?.role === 'teacher' && (
                <NavLink to="/dashboard/my-students" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <Users size={20} />
                  <span>My Students</span>
                </NavLink>
              )}

              {['principal', 'teacher'].includes(user?.role) && (
                <NavLink to="/dashboard/grading" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <ClipboardList size={20} />
                  <span>Grading</span>
                </NavLink>
              )}

              {/* Attendance Management (Teacher) */}
              {['teacher', 'principal'].includes(user?.role) && (
                <NavLink to="/dashboard/attendance/record" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <CheckCircle size={20} />
                  <span>Record Attendance</span>
                </NavLink>
              )}

              {/* Student Features */}
              {user?.role === 'student' && (
                <>
                  <NavLink to="/dashboard/attendance" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                    <Calendar size={20} />
                    <span>Attendance</span>
                  </NavLink>
                  <NavLink to="/dashboard/assessments" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                    <BookOpen size={20} />
                    <span>Assessments</span>
                  </NavLink>
                </>
              )}
              {['super_admin', 'principal'].includes(user?.role) && (
                <NavLink to="/dashboard/analytics/class" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <BarChart3 size={20} />
                  <span>Class Analytics</span>
                </NavLink>
              )}
              {['super_admin', 'principal', 'school_admin', 'accountant'].includes(user?.role) && (
                <NavLink to="/dashboard/audit-logs" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <FileText size={20} />
                  <span>Audit Logs</span>
                </NavLink>
              )}
            </nav>

            <div className="p-4 border-t border-white/10 shrink-0 mt-auto bg-sissphere-primary">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-2 px-2 hover:bg-white/10 text-white group">
                    <Avatar className="h-8 w-8 border border-white/20">
                      <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback className="bg-sissphere-primary-light text-sissphere-primary font-bold">
                        {user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start overflow-hidden text-left flex-1 min-w-0">
                      <span className="text-sm font-medium truncate w-full group-hover:text-white transition-colors capitalize">
                        {user.role?.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-300 truncate w-full">
                        {user?.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50 text-gray-300" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 mb-2" side="right" align="end">
                  <div className="flex flex-col space-y-2">
                    <div className="px-2 py-1.5 text-sm text-gray-500 font-medium border-b border-gray-100">
                      Signed in as <span className="text-gray-900 font-semibold">{user?.email}</span>
                    </div>
                    <div className="px-2 py-1 text-xs text-gray-400 uppercase tracking-wider font-bold">
                      {user.role?.replace('_', ' ')}
                    </div>
                    <Button variant="ghost" className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={logout}>
                      <LogOut size={16} />
                      Sign Out
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile Header / Sidebar Toggle */}
          <div className="md:hidden flex items-center p-4 bg-white border-b sticky top-0 z-30">
            <button onClick={toggleSidebar} className="mr-4 text-gray-600">
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-semibold capitalize">
              {useLocation().pathname.split('/').pop().replace(/-/g, ' ') || 'Dashboard'}
            </h1>
          </div>

          <div className="flex-1 p-4 md:p-8 overflow-y-auto">
            <Outlet />
          </div>
        </main>

        <AIChatWidget />
      </div>
    </div>
  );
};

export default DashboardLayout;
