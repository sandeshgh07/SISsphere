import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    User, CheckCircle, Clock, AlertCircle, FileText, QrCode, Settings,
    Calendar, Activity, Shield
} from 'lucide-react';
import GatePass from '../components/GatePass';
import { useNavigate } from 'react-router-dom';

const AccountOverviewPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOverview();
    }, []);

    const fetchOverview = async () => {
        try {
            const res = await api.get('/dashboard/me/overview');
            setData(res.data);
        } catch (err) {
            console.error("Failed to fetch overview", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded-lg w-full"></div>
            <div className="grid grid-cols-3 gap-4">
                <div className="h-24 bg-gray-200 rounded-lg"></div>
                <div className="h-24 bg-gray-200 rounded-lg"></div>
                <div className="h-24 bg-gray-200 rounded-lg"></div>
            </div>
        </div>;
    }

    if (!data) return <div className="p-8">Failed to load account overview.</div>;

    const { user: userInfo, school, academics, counts, recent_activity, gate_pass } = data;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* 1. Header Row */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-nepsis-primary/10 text-nepsis-primary flex items-center justify-center text-xl font-bold border-2 border-white shadow-sm">
                        {userInfo.name ? userInfo.name[0].toUpperCase() : 'U'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{userInfo.name}</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200 uppercase text-xs font-semibold tracking-wide">
                                {userInfo.role?.replace('_', ' ')}
                            </Badge>
                            <span className="text-gray-300">|</span>
                            <span>{school?.name}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Enhanced Gate Pass Logic */}
                    <GatePass studentId={userInfo.id} studentName={userInfo.name} />

                    <Button variant="outline" className="gap-2" onClick={() => navigate('/reset-password')}>
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Settings</span>
                    </Button>
                </div>
            </div>

            {/* 2. KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Academic Period</p>
                            <h3 className="text-lg font-bold text-gray-900 mt-1">
                                {academics.active_year || "—"}
                            </h3>
                            <p className="text-sm text-emerald-600 font-medium">{academics.active_term || "No Active Term"}</p>
                        </div>
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Actions</p>
                            <h3 className="text-lg font-bold text-gray-900 mt-1">
                                {counts.assigned_complaints + counts.pending_approvals + counts.acknowledgements_required}
                            </h3>
                            <p className="text-sm text-gray-400">Items requiring attention</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Clock className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Activity</p>
                            <h3 className="text-lg font-bold text-gray-900 mt-1">
                                {/* Placeholder for 'Today' count or just 'Active' */}
                                Active
                            </h3>
                            <p className="text-sm text-purple-600 font-medium">System Online</p>
                        </div>
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <Activity className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 3. Main Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT: Recent Activity (2/3 width) -> User asked for 2 column, let's do 2-col 50/50 or 60/40 */}
                {/* Plan said: Left "My Recent Activity", Right "My Work Queue" */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-gray-500" />
                                My Recent Activity
                            </h3>
                            <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 h-8">
                                View All Logs
                            </Button>
                        </div>

                        <div className="p-0">
                            {recent_activity && recent_activity.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Time</th>
                                                <th className="px-6 py-3 font-medium">Action</th>
                                                <th className="px-6 py-3 font-medium">Entity</th>
                                                <th className="px-6 py-3 font-medium">Summary</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {recent_activity.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                                                        {new Date(log.timestamp).toLocaleDateString()} <span className="text-xs opacity-70">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </td>
                                                    <td className="px-6 py-3 font-medium text-gray-800">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-600">
                                                        {log.entity_type}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 max-w-[200px] truncate" title={log.summary}>
                                                        {log.summary || "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                                    <FileText className="w-10 h-10 mb-2 opacity-20" />
                                    <p className="text-sm">No recent activity recorded.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Gate Pass Quick View (Below Activity) */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <QrCode className="w-4 h-4 text-gray-500" />
                                Gate Pass History
                            </h3>
                        </div>
                        <div className="p-6">
                            {gate_pass && gate_pass.recent_events && gate_pass.recent_events.length > 0 ? (
                                <div className="space-y-3">
                                    {gate_pass.recent_events.map((evt) => (
                                        <div key={evt.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-white transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${evt.status === 'valid' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{evt.reason || "Gate Pass Generated"}</p>
                                                    <p className="text-xs text-gray-500">{new Date(evt.created_at).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-gray-600 bg-white">
                                                {evt.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 py-4">
                                    <p className="text-sm">No recent gate pass activity.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Work Queue (1/3 width) */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900">My Work Queue</h3>
                        </div>

                        <Tabs defaultValue="complaints" className="w-full">
                            <div className="px-6 pt-4">
                                <TabsList className="w-full grid grid-cols-2">
                                    <TabsTrigger value="complaints">Complaints</TabsTrigger>
                                    <TabsTrigger value="notices">Notices</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="p-6">
                                <TabsContent value="complaints" className="mt-0 space-y-4">
                                    {counts.assigned_complaints > 0 ? (
                                        <div className="text-center py-8">
                                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-3">
                                                <AlertCircle className="w-6 h-6" />
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-900">{counts.assigned_complaints}</h4>
                                            <p className="text-sm text-gray-500">Pending Complaints</p>
                                            <Button size="sm" className="mt-4 w-full" onClick={() => navigate('/dashboard/complaints')}>
                                                Review Complaints
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <CheckCircle className="w-12 h-12 text-emerald-100 mb-3" />
                                            <p className="text-sm text-gray-500">All caught up!</p>
                                            <p className="text-xs text-gray-400">No pending complaints assigned to you.</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="notices" className="mt-0">
                                    {counts.unread_notices > 0 ? (
                                        <div className="text-center py-8">
                                            <h4 className="text-lg font-bold text-gray-900">{counts.unread_notices}</h4>
                                            <p className="text-sm text-gray-500">Unread Notices</p>
                                            <Button size="sm" className="mt-4 w-full" variant="outline" onClick={() => navigate('/dashboard/notices')}>
                                                View Notices
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <CheckCircle className="w-12 h-12 text-emerald-100 mb-3" />
                                            <p className="text-sm text-gray-500">No new notices.</p>
                                        </div>
                                    )}
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AccountOverviewPage;
