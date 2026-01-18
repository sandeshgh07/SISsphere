import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Bell,
  GraduationCap,
  CreditCard,
  LogOut,
  Menu,
  X,
  BarChart3,
  MessageCircle
} from 'lucide-react';
import AIChatWidget from '../components/AIChatWidget';
import SubscriptionBanner from '../components/SubscriptionBanner';
import AccountSuspended from './AccountSuspended';
import { useState, useEffect } from 'react';
import api from '../lib/api';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counts, setCounts] = useState({ notices: 0, complaints: 0 });

  useEffect(() => {
    if (user) {
        api.get('/stats/counts')
           .then(res => setCounts({
               notices: res.data.notices_count,
               complaints: res.data.complaints_count
           }))
           .catch(err => console.error("Failed to fetch counts", err));
    }
  }, [user]);

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
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-nepsis-primary border-r transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
             <div className="flex items-center gap-2">
                {/* School Logo - fetched from context */}
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden">
                   {user?.school_logo_url ? (
                      <img src={user.school_logo_url} alt="Logo" className="w-full h-full object-cover" />
                   ) : (
                      <span className="text-nepsis-primary font-bold">N</span>
                   )}
                </div>
                <span className="font-bold text-xl text-white">Nepsis</span>
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

          <nav className="flex-1 p-4 space-y-2">
            <NavLink to="/dashboard" end className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
              <LayoutDashboard size={20} />
              <span>Overview</span>
            </NavLink>

            <NavLink to="/dashboard/notices" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
              <div className="relative">
                  <Bell size={20} />
                  {counts.notices > 0 && (
                      <span className="absolute -top-2 -right-2 bg-nepsis-alert text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {counts.notices > 9 ? '9+' : counts.notices}
                      </span>
                  )}
              </div>
              <span>Notices</span>
            </NavLink>

            <NavLink to="/dashboard/complaints" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                <div className="relative">
                    <MessageCircle size={20} />
                     {counts.complaints > 0 && (
                      <span className="absolute -top-2 -right-2 bg-nepsis-alert text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {counts.complaints > 9 ? '9+' : counts.complaints}
                      </span>
                  )}
                </div>
                <span>Complaints</span>
            </NavLink>

            <NavLink to="/dashboard/profile" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
              <GraduationCap size={20} />
              <span>Student Profile</span>
            </NavLink>
            <NavLink to="/dashboard/fees" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
              <CreditCard size={20} />
              <span>Financials</span>
            </NavLink>
            {(user?.role === 'super_admin' || user?.role === 'principal') && (
                <NavLink to="/dashboard/board-analytics" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                  <BarChart3 size={20} />
                  <span>Board Room</span>
                </NavLink>
            )}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                    {user.sub ? user.sub[0].toUpperCase() : 'U'}
                </div>
                <div className="overflow-hidden text-white">
                    <p className="text-sm font-medium truncate">{user.sub}</p>
                    <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
            </div>
            <Button variant="outline" className="w-full justify-start gap-2 border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={logout}>
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b h-16 flex items-center px-4 md:px-8 sticky top-0 z-30">
          <button onClick={toggleSidebar} className="mr-4 md:hidden">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </header>

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
