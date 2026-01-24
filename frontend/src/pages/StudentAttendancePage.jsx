
import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const StudentAttendancePage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/attendance/student/me?range=term')
            .then(res => setStats(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading attendance data...</div>;
    if (!stats) return <div className="p-8 text-center text-gray-500">Attendance records unavailable.</div>;

    const { summary, trend } = stats;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-green-50 border-green-100">
                    <CardContent className="p-6 flex flex-col items-center">
                        <span className="text-3xl font-bold text-green-700">{summary.percent}%</span>
                        <span className="text-xs text-green-600 uppercase font-medium mt-1">Attendance Rate</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex flex-col items-center">
                        <span className="text-3xl font-bold text-gray-800">{summary.present}</span>
                        <span className="text-xs text-gray-500 uppercase font-medium mt-1">Days Present</span>
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-100">
                    <CardContent className="p-6 flex flex-col items-center">
                        <span className="text-3xl font-bold text-red-700">{summary.absent}</span>
                        <span className="text-xs text-red-600 uppercase font-medium mt-1">Days Absent</span>
                    </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-100">
                    <CardContent className="p-6 flex flex-col items-center">
                        <span className="text-3xl font-bold text-yellow-700">{summary.late}</span>
                        <span className="text-xs text-yellow-600 uppercase font-medium mt-1">Late Arrivals</span>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp size={18} /> Attendance Trend (Last 30 Days)
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    {trend && trend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(val) => new Date(val).getDate()} />
                                <Tooltip
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                    formatter={(value, name, props) => [props.payload.status, "Status"]}
                                />
                                <Bar dataKey="status" fill="#8884d8" shape={(props) => {
                                    const { x, y, width, height, payload } = props;
                                    let fill = '#e5e7eb';
                                    if (payload.status === 'PRESENT') fill = '#22c55e';
                                    if (payload.status === 'ABSENT') fill = '#ef4444';
                                    if (payload.status === 'LATE') fill = '#eab308';
                                    return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />
                                }} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">No trend data available.</div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Detailed History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {trend.slice().reverse().map((rec, i) => (
                            <div key={i} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-100 p-2 rounded-lg text-gray-500">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">{new Date(rec.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                    </div>
                                </div>
                                <div>
                                    {rec.status === 'PRESENT' && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} /> Present</span>}
                                    {rec.status === 'ABSENT' && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle size={12} /> Absent</span>}
                                    {rec.status === 'LATE' && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock size={12} /> Late</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StudentAttendancePage;
