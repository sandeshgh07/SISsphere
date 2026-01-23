import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
    FileText,
    Search,
    Filter,
    Download,
    Shield,
    AlertOctagon,
    CheckCircle,
    User,
    Calendar,
    Building2,
    RefreshCw
} from 'lucide-react';

const GodViewAuditLogs = () => {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('all');

    // Simulated fetch
    const fetchData = async () => {
        setLoading(true);
        // Simulate API call
        setTimeout(() => {
            const mockLogs = Array.from({ length: 50 }).map((_, i) => ({
                id: i + 1,
                action: ['Login', 'Update Settings', 'Delete User', 'Create School', 'Export Data'][Math.floor(Math.random() * 5)],
                actor: ['Super Admin', 'System', 'Jane Doe', 'John Smith'][Math.floor(Math.random() * 4)],
                role: ['SUPER_ADMIN', 'SYSTEM', 'SCHOOL_ADMIN'][Math.floor(Math.random() * 3)],
                target: ['School A', 'User B', 'System Config', 'Database'][Math.floor(Math.random() * 4)],
                school: Math.random() > 0.3 ? `School ${Math.floor(Math.random() * 10)}` : 'Global',
                status: Math.random() > 0.1 ? 'success' : 'failure',
                ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
                timestamp: new Date(Date.now() - Math.random() * 1000000000).toISOString()
            })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            setLogs(mockLogs);
            setLoading(false);
        }, 800);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getStatusBadge = (status) => {
        return status === 'success' ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" /> Success
            </span>
        ) : (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <AlertOctagon className="w-3 h-3" /> Failure
            </span>
        );
    };

    const getActionIcon = (action) => {
        if (action.includes('Login')) return <User className="w-4 h-4 text-blue-500" />;
        if (action.includes('Delete')) return <Shield className="w-4 h-4 text-red-500" />;
        if (action.includes('Create')) return <FileText className="w-4 h-4 text-green-500" />;
        return <FileText className="w-4 h-4 text-gray-500" />;
    };

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">System Audit Logs</h1>
                    <p className="text-sm text-gray-500">Track all critical actions across the platform</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 bg-white">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 w-full md:w-auto bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="bg-transparent border-none text-sm focus:outline-none w-full md:w-64"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
                    <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
                        <Filter className="w-4 h-4" />
                        Filter Action
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
                        <Calendar className="w-4 h-4" />
                        Date Range
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Timestamp</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Action</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Actor</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Target</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">School</th>
                                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getActionIcon(log.action)}
                                            <span className="font-medium text-gray-800">{log.action}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                                                {log.actor.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-800">{log.actor}</p>
                                                <p className="text-xs text-gray-400">{log.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={log.target}>
                                        {log.target}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-gray-400" />
                                            <span className="text-gray-600 max-w-[150px] truncate" title={log.school}>{log.school}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(log.status)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                        <p className="text-sm text-gray-500">Showing 1-50 of 2,450 logs</p>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white disabled:opacity-50" disabled>Previous</button>
                            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50">Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GodViewAuditLogs;
