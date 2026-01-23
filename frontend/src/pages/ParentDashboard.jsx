import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { Loader2, Bell, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard, AcademicGraph, FeesCard, AttendanceGauge } from '@/components/dashboard/DashboardWidgets';

const ParentDashboard = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const selectedChildId = searchParams.get('child_id');
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await api.get('/parent/dashboard/summary');
                setSummaries(res.data);
            } catch (err) {
                console.error("Failed to fetch dashboard summary", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, []);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    // Filter Logic
    const activeData = selectedChildId
        ? [summaries.find(s => s.student_id === selectedChildId)].filter(Boolean)
        : summaries;

    if (summaries.length === 0) return <div className="text-gray-500 p-6">No students linked to your account.</div>;

    // Aggregation for Overview (if more than 1 child and no specific selection)
    const isOverview = !selectedChildId && summaries.length > 1;

    // Calculate display values
    const displayAttendance = isOverview
        ? Math.round(activeData.reduce((acc, curr) => acc + curr.attendance_percentage, 0) / activeData.length)
        : activeData[0]?.attendance_percentage || 0;

    const displayFeesStatus = activeData.some(s => s.fee_status === 'OVERDUE') ? 'OVERDUE'
        : activeData.some(s => s.fee_status === 'PENDING') ? 'PENDING' : 'ALL PAID';

    // For academic trend, in overview we might just show "Mixed" or N/A, or average marks if we had raw numbers.
    // The API sends "UP/DOWN", so aggregating is hard. We'll show the trend of the first child or "See Reports".
    const displayTrend = isOverview ? 'N/A' : activeData[0]?.academic_trend;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-[#003333]">
                        Welcome back, {user?.first_name}!
                    </h2>
                    <p className="text-gray-500">
                        {isOverview
                            ? "Here's what's happening with your children this week."
                            : `Here's what's happening with ${activeData[0]?.student_name}'s performance.`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2">
                        <Bell size={16} /> Notifications
                    </Button>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link to="/dashboard/academics">
                    <StatCard
                        title="Overall Grade Average"
                        value="92% (A)" // Placeholder until API sends precise grade avg
                        subtext="Top 5% of class"
                        trend={displayTrend === 'N/A' ? null : displayTrend}
                        colorClass="text-green-600"
                    />
                </Link>

                <Link to="/dashboard/attendance">
                    <Card className="h-full hover:bg-gray-50 transition-colors cursor-pointer">
                        <CardContent className="p-0 flex items-center justify-between">
                            <div className="p-6">
                                <p className="text-sm font-medium text-gray-500 mb-1">Days Present</p>
                                <h3 className="text-2xl font-bold">{displayAttendance}%</h3>
                                <p className="text-xs text-gray-400 mt-1">{isOverview ? "Average across children" : "This Semester"}</p>
                            </div>
                            <div className="pr-4">
                                <AttendanceGauge percentage={displayAttendance} presentDays={45} totalDays={48} />
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link to="/dashboard/fees">
                    <FeesCard
                        amount={displayFeesStatus === 'ALL PAID' ? '0.00' : '1,200'} // Mock amount
                        status={displayFeesStatus}
                        dueDate="Nov 15, 2023"
                    />
                </Link>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Academics Graph */}
                <div className="lg:col-span-2">
                    <AcademicGraph data={[]} /> {/* Passes empty to use mock data in component */}
                </div>

                {/* Right Column: Alerts & Teacher */}
                <div className="space-y-6">
                    {/* Requires Attention */}
                    <Card className="border-l-4 border-l-red-500 bg-red-50/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-red-700 flex items-center gap-2 text-lg">
                                <AlertTriangle size={20} /> Requires Attention
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-3 items-start">
                                <div className="w-2 h-2 mt-2 rounded-full bg-red-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">History Assignment Missing</p>
                                    <p className="text-xs text-gray-500">Due Yesterday • Mr. Thompson</p>
                                    <Button variant="link" className="text-blue-600 h-auto p-0 text-xs mt-1">Contact Teacher</Button>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <div className="w-2 h-2 mt-2 rounded-full bg-orange-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">Fee Payment Pending</p>
                                    <p className="text-xs text-gray-500">Tuition for October is due soon.</p>
                                    <Link to="/dashboard/fees" className="text-blue-600 text-xs hover:underline mt-1 block">View Invoice</Link>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Class Teacher */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Class Teacher</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl">
                                    MA
                                </div>
                                <div>
                                    <p className="font-bold">Mrs. Anderson</p>
                                    <p className="text-xs text-gray-500">Grade 10 - Homeroom</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm">Message</Button>
                                <Button variant="outline" size="sm">Schedule</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Additional Sections below (Upcoming Exams, etc) could go here matching the image */}
        </div>
    );
};

export default ParentDashboard;
