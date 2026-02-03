import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Building2,
    DollarSign,
    TrendingDown,
    BarChart3,
    Activity,
    FileText,
    LogOut,
    Globe,
    Mail,
    ArrowLeft
} from 'lucide-react';

const SuperAdminLayout = () => {
    const { user, logout } = useAuth();

    const navItems = [
        {
            section: 'DASHBOARD', items: [
                { path: '/god-view', label: 'Overview', icon: LayoutDashboard },
                { path: '/god-view/schools', label: 'Schools', icon: Building2 },
                { path: '/god-view/finance', label: 'Finance', icon: DollarSign },
                { path: '/god-view/inquiries', label: 'Inquiries', icon: Mail },
            ]
        },
        {
            section: 'ANALYSIS', items: [
                { path: '/god-view/retention', label: 'Retention & Churn', icon: TrendingDown },
                { path: '/god-view/features', label: 'Feature Adoption', icon: BarChart3 },
            ]
        },
        {
            section: 'INFRASTRUCTURE', items: [
                { path: '/god-view/health', label: 'System Health', icon: Activity },
                { path: '/god-view/audit-logs', label: 'Audit Logs', icon: FileText },
            ]
        },
    ];

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                {/* Logo */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                            <Globe className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">Admin Console</p>
                            <p className="text-xs text-gray-400">God View Mode</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                    {navItems.map((group) => (
                        <div key={group.section}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                {group.section}
                            </p>
                            <ul className="space-y-1">
                                {group.items.map((item) => (
                                    <li key={item.path}>
                                        <NavLink
                                            to={item.path}
                                            end={item.path === '/god-view'}
                                            className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                        ${isActive
                                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                                    : 'text-gray-600 hover:bg-gray-50'
                                                }
                      `}
                                        >
                                            <item.icon className="w-4 h-4" />
                                            {item.label}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Return to Dashboard */}
                <div className="px-4 pb-2">
                    <NavLink
                        to="/platform-admin"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 font-medium transition-colors border border-slate-200 justify-center"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return to Dashboard
                    </NavLink>
                </div>

                {/* User Profile */}
                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                                {user?.email?.[0]?.toUpperCase() || 'A'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                                {user?.email?.split('@')[0] || 'Admin'}
                            </p>
                            <p className="text-xs text-gray-400">Super User</p>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default SuperAdminLayout;
