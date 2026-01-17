import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const BoardDashboard = () => {
    const { token } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/board/analytics`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setAnalytics(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [token]);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    if (!analytics) return <div className="p-4 text-red-600">Failed to load analytics</div>;

    const chartData = [
        { name: 'Enrollment', value: analytics.total_enrollment },
        { name: 'Rev Velocity (%)', value: analytics.revenue_velocity },
        { name: 'Reputation', value: analytics.reputation_index },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-[#003333]">Board Executive View</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-[#003333] text-white">
                    <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Total Enrollment</CardTitle></CardHeader>
                    <CardContent><div className="text-4xl font-bold">{analytics.total_enrollment}</div></CardContent>
                </Card>
                <Card className="bg-[#003333] text-white">
                    <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Revenue Velocity</CardTitle></CardHeader>
                    <CardContent><div className="text-4xl font-bold">{analytics.revenue_velocity}%</div></CardContent>
                </Card>
                <Card className="bg-[#003333] text-white">
                    <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Avg Complaint Time</CardTitle></CardHeader>
                    <CardContent><div className="text-4xl font-bold">{analytics.avg_complaint_resolution_hours}h</div></CardContent>
                </Card>
                <Card className="bg-[#003333] text-white">
                    <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Reputation Index</CardTitle></CardHeader>
                    <CardContent><div className="text-4xl font-bold">{analytics.reputation_index}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Key Metrics Overview</CardTitle></CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#003333" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
};

export default BoardDashboard;
