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
  FileText
} from 'lucide-react';
import AIChatWidget from '../components/AIChatWidget';
import { useState } from 'react';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="/login" />;

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
            <NavLink to="/dashboard/notices" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
              <Bell size={20} />
              <span>Notices</span>
            </NavLink>
            <NavLink to="/dashboard/profile" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
              <GraduationCap size={20} />
              <span>Student Profile</span>
            </NavLink>
            <NavLink to="/dashboard/fees" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
              <CreditCard size={20} />
              <span>Financials</span>
            </NavLink>
            {(user.role === 'principal' || user.role === 'accountant') && (
                <NavLink to="/dashboard/admissions" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5'}`}>
                <FileText size={20} />
                <span>Admissions</span>
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
  );
};

export default DashboardLayout;
