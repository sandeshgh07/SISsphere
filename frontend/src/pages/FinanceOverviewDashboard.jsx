import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import TriplePulse from '../components/TriplePulse';
import RevenueVelocityChart from '../components/RevenueVelocityChart';
import SourceBreakdownChart from '../components/SourceBreakdownChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BoardManagementTab from '../components/BoardManagementTab';
import api from '../lib/api';

const FinanceOverviewDashboard = () => {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [analyticsRes, financeRes] = await Promise.all([
                    api.get('/board/analytics'),
                    api.get('/board/financial-velocity')
                ]);

                if (analyticsRes.data) setAnalytics(analyticsRes.data);
                if (financeRes.data) setFinancials(financeRes.data);

            } catch (err) {
                console.error("Failed to load board analytics:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    // Note: analytics might fail if endpoint not ready, but we focus on UI structure
    // if (!analytics) return <div className="p-4 text-red-600">Failed to load analytics</div>;

    return (
        <div className="space-y-8 p-4 md:p-8 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-[#003333]">Finance Overview</h2>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-slate-200">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    {user?.role === 'superuser' && (
                        <TabsTrigger value="governance">Board Management</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="overview" className="space-y-8 mt-6">
                    {/* 1. Triple Pulse Header */}
                    {financials && <TriplePulse data={financials.triple_pulse} />}

                    {/* 2. Key Metrics Cards */}
                    {analytics && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card className="bg-[#003333] text-white shadow-lg">
                                <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Total Enrollment</CardTitle></CardHeader>
                                <CardContent><div className="text-4xl font-bold">{analytics.total_enrollment}</div></CardContent>
                            </Card>
                            <Card className="bg-[#003333] text-white shadow-lg">
                                <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Revenue Velocity</CardTitle></CardHeader>
                                <CardContent><div className="text-4xl font-bold">{analytics.revenue_velocity}%</div></CardContent>
                            </Card>
                            <Card className="bg-[#003333] text-white shadow-lg">
                                <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Avg Complaint Time</CardTitle></CardHeader>
                                <CardContent><div className="text-4xl font-bold">{analytics.avg_complaint_resolution_hours}h</div></CardContent>
                            </Card>
                            <Card className="bg-[#003333] text-white shadow-lg">
                                <CardHeader><CardTitle className="text-sm font-medium text-gray-200">Reputation Index</CardTitle></CardHeader>
                                <CardContent><div className="text-4xl font-bold">{analytics.reputation_index}</div></CardContent>
                            </Card>
                        </div>
                    )}

                    {/* 3. Charts Section */}
                    {financials && (
                        <div className="grid gap-6 md:grid-cols-3 h-[400px]">
                            <div className="md:col-span-2">
                                <RevenueVelocityChart data={financials.revenue_trend} />
                            </div>
                            <div className="md:col-span-1">
                                <SourceBreakdownChart data={financials.source_breakdown} />
                            </div>
                        </div>
                    )}
                    {!analytics && !financials && <div className="text-center p-10 text-gray-500">Analytics unavailable (Simulated mode)</div>}
                </TabsContent>

                {user?.role === 'superuser' && (
                    <TabsContent value="governance" className="mt-6">
                        <BoardManagementTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default FinanceOverviewDashboard;
