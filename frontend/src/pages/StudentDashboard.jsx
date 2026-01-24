
import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Clock, Calendar, AlertTriangle, CheckCircle, XCircle,
    BookOpen, DollarSign, MessageSquare, ChevronRight, AlertCircle, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';

const StudentDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get('/students/overview');
                setData(response.data);
            } catch (err) {
                console.error("Failed to fetch student dashboard", err);
                setError("Could not load dashboard data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return (
        <div className="flex justify-center items-center min-h-[50vh]">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
        </div>
    );

    if (error || !data) return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[50vh]">
            <div className="bg-red-50 p-4 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Unable to load dashboard</h2>
            <p className="text-gray-600">{error || "Please try again later."}</p>
        </div>
    );

    const { student, today, attendance, academics, fees, notices, complaints, timeline } = data;

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Good morning, {student.name.split(' ')[0]}</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {student.grade} • {student.section} • {timeline.term}
                    </p>
                </div>
                <div className="flex gap-2 text-sm">
                    {attendance.thisTermPercent > 0 && (
                        <div className="bg-white border rounded-full px-3 py-1 flex items-center gap-2 shadow-sm">
                            <CheckCircle size={14} className="text-green-600" />
                            <span className="font-medium">{attendance.thisTermPercent}% Attendance</span>
                        </div>
                    )}
                    {fees.dueAmount > 0 && (
                        <div className="bg-white border rounded-full px-3 py-1 flex items-center gap-2 shadow-sm text-red-600 border-red-100">
                            <DollarSign size={14} />
                            <span className="font-medium">Due: {fees.dueAmount}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. Action Center */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Clock size={18} /> Today's Focus
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                        {/* Next Class */}
                        <div className="col-span-3 sm:col-span-1 bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between h-32">
                            <div className="text-xs text-gray-500 font-medium uppercase">Next Class</div>
                            {today.next_class ? (
                                <div>
                                    <div className="text-lg font-bold text-blue-600">{today.next_class.time}</div>
                                    <div className="font-medium truncate" title={today.next_class.subject}>{today.next_class.subject}</div>
                                </div>
                            ) : (
                                <div className="text-gray-400 text-sm">No classes</div>
                            )}
                        </div>

                        {/* Missing Work */}
                        <Link to="/dashboard/academics" className="col-span-3 sm:col-span-1 bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between h-32 hover:border-blue-300 transition-colors cursor-pointer group">
                            <div className="text-xs text-gray-500 font-medium uppercase group-hover:text-blue-600">Pending tasks</div>
                            <div>
                                <div className="text-2xl font-bold text-orange-500">{academics.missingSubmissions}</div>
                                <div className="text-xs text-gray-500">Missing submissions</div>
                            </div>
                        </Link>

                        {/* Fees */}
                        <Link to="/dashboard/fees" className="col-span-3 sm:col-span-1 bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between h-32 hover:border-blue-300 transition-colors cursor-pointer group">
                            <div className="text-xs text-gray-500 font-medium uppercase group-hover:text-blue-600">Fees</div>
                            <div>
                                <div className={`text-xl font-bold ${fees.dueAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {fees.dueAmount > 0 ? fees.dueAmount : "Paid"}
                                </div>
                                <div className="text-xs text-gray-500">{fees.dueAmount > 0 ? "Due now" : "All clear"}</div>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* 2. Critical Notices */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-orange-500" /> Critical Updates
                        </h2>
                        <Link to="/dashboard/notices" className="text-xs text-blue-600 hover:underline">View all</Link>
                    </div>

                    <div className="space-y-3">
                        {notices.critical.length > 0 ? (
                            notices.critical.map(notice => (
                                <div key={notice.id} className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="font-semibold text-red-900 leading-tight">{notice.title}</h3>
                                        <p className="text-xs text-red-600 mt-1">
                                            Posted {new Date(notice.posted_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-white border p-4 rounded-xl text-center text-gray-500 text-sm py-8">
                                No critical notices at this time.
                            </div>
                        )}
                        {/* Fill with recent if space? User said "If none: show No critical notices". */}
                    </div>
                </div>

                {/* 3. My Progress */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">My Progress</h2>
                    <Card className="shadow-sm border-none bg-white">
                        <CardContent className="p-4 space-y-6">
                            {/* Attendance Mini */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-500">Attendance (Last 30 Days)</span>
                                    <span className="font-medium">{attendance.last30.percent}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                    <div className="bg-green-500 h-full" style={{ width: `${(attendance.last30.present / (attendance.last30.present + attendance.last30.absent + attendance.last30.late || 1)) * 100}%` }} />
                                    <div className="bg-red-400 h-full" style={{ width: `${(attendance.last30.absent / (attendance.last30.present + attendance.last30.absent + attendance.last30.late || 1)) * 100}%` }} />
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> {attendance.last30.present} Present</div>
                                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> {attendance.last30.absent} Absent</div>
                                </div>
                            </div>

                            {/* Subjects */}
                            <div>
                                <div className="flex justify-between text-sm mb-3">
                                    <span className="text-gray-500">Top Subjects</span>
                                </div>
                                <div className="space-y-3">
                                    {academics.subjects.map((sub, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-700">{sub.name}</span>
                                                    <span className="text-xs font-bold text-gray-900">{sub.grade || sub.progress + '%'}</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${sub.progress}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 4. Upcoming Timeline */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800">Upcoming</h2>
                    <Card className="shadow-sm border-none bg-white h-full max-h-[300px] overflow-y-auto">
                        <CardContent className="p-0">
                            {timeline.upcoming.length > 0 ? (
                                <div className="divide-y">
                                    {timeline.upcoming.map((event, i) => (
                                        <div key={i} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex flex-col items-center justify-center bg-blue-50 text-blue-700 rounded-lg w-12 h-12 shrink-0">
                                                <span className="text-xs font-bold uppercase">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                                <span className="text-lg font-bold leading-none">{new Date(event.date).getDate()}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{event.title}</h4>
                                                <Badge variant="outline" className="mt-1 text-xs font-normal text-gray-500 border-gray-200">
                                                    {event.type}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    No upcoming events scheduled.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* 5. My Complaints (Full Width) */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <MessageSquare size={18} /> My Requests / Complaints
                        </h2>
                        <Link to="/dashboard/complaints">
                            <Button size="sm" variant="outline">Create New</Button>
                        </Link>
                    </div>

                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                        {complaints.myRecent.length > 0 ? (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Topic</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Last Updated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {complaints.myRecent.map(comp => (
                                        <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900">{comp.title}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant="secondary" className={`
                                                    ${comp.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                                                        comp.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}
                                                `}>
                                                    {comp.status.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-500">
                                                {new Date(comp.updated_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                No recent requests. Have an issue? <Link to="/dashboard/complaints" className="text-blue-600 hover:underline">Raise a ticket</Link>.
                            </div>
                        )}
                        {complaints.openCount > 0 && (
                            <div className="bg-gray-50 px-4 py-2 text-xs text-center border-t text-gray-500">
                                You have {complaints.openCount} open ticket{complaints.openCount !== 1 && 's'}.
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StudentDashboard;
