import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { Loader2, Bell, AlertTriangle, User, GraduationCap, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard, AcademicGraph, FeesCard, AttendanceGauge } from '@/components/dashboard/DashboardWidgets';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const ParentDashboard = () => {
    const { user } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyticsData, setAnalyticsData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Linked Students (Source of Truth)
                const studentRes = await api.get('/parents/me/students');
                setStudents(studentRes.data);

                // 2. Fetch Analytics Summary (if needed for widgets)
                if (studentRes.data.length > 0) {
                    try {
                        const summaryRes = await api.get('/parent/dashboard/summary');
                        setAnalyticsData(summaryRes.data);
                    } catch (err) {
                        console.error("Failed to fetch analytics summary", err);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch linked students", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    if (students.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <div className="bg-gray-100 p-6 rounded-full">
                    <User size={48} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-700">No Students Linked</h2>
                <p className="text-gray-500 max-w-md text-center">
                    We couldn't find any students linked to your account. Please contact the school administrator to verify your email address and student linkage.
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    // Helper to get analytics for a specific student
    const getStudentAnalytics = (studentId) => {
        return analyticsData.find(d => d.student_id === studentId) || {};
    };

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-[#003333]">My Children</h1>
                    <p className="text-gray-500">Overview of your children's performance and activities.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Bell size={16} /> Notifications
                    </Button>
                </div>
            </div>

            {/* Student Cards (Part B1 requirement) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {students.map((student) => {
                    const stats = getStudentAnalytics(student.id);
                    return (
                        <Link to={`/dashboard/student/${student.id}`} key={student.id} className="block group">
                            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/80">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-4 items-center">
                                            <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
                                                <AvatarImage src={student.photo_url} />
                                                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                                    {student.first_name[0]}{student.last_name[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                                                    {student.first_name} {student.last_name}
                                                </h3>
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                                        {student.grade_name || "Grade N/A"}
                                                    </span>
                                                    <span>{student.section_name}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">{student.roll_number}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Stats Badges */}
                                    <div className="flex gap-2 flex-wrap mt-4">
                                        {stats.attendance_percentage !== undefined && (
                                            <Badge variant={stats.attendance_percentage < 75 ? "destructive" : "secondary"} className="gap-1">
                                                {stats.attendance_percentage}% Attendance
                                            </Badge>
                                        )}
                                        {stats.fee_status === 'OVERDUE' && (
                                            <Badge variant="destructive" className="gap-1">
                                                Fees Overdue
                                            </Badge>
                                        )}
                                        {stats.fee_status === 'PENDING' && (
                                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 gap-1">
                                                Fees Pending
                                            </Badge>
                                        )}
                                        {/* Fallback if no stats loaded yet */}
                                        {!stats.student_id && (
                                            <span className="text-xs text-gray-400 italic">Play to view details</span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </div>

            {/* Analytics Overview (Part B2 - Minimal Widgets) */}
            <div>
                <h2 className="text-xl font-bold text-[#003333] mb-4">Quick Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Attendance Trend Widget */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <User size={16} /> Attendance Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold mb-1">
                                {students.length > 0 ? "Good" : "N/A"}
                            </div>
                            <p className="text-xs text-gray-500">Last 30 Days</p>
                            {/* Sparkline placeholder - in real app would need charting lib or svg */}
                            <div className="h-8 w-full mt-2 bg-green-50 rounded flex items-end gap-1 px-1 pb-1">
                                {[40, 60, 55, 70, 85, 90, 95].map((h, i) => (
                                    <div key={i} className="flex-1 bg-green-400 rounded-sm" style={{ height: `${h}%` }}></div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Upcoming Assessments Widget */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <GraduationCap size={16} /> Upcoming Exams
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {students.map(s => (
                                    <div key={s.id} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                                        <div>
                                            <p className="text-sm font-medium">{s.first_name}</p>
                                            <p className="text-xs text-gray-500">Math - Finals</p>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            In 2 days
                                        </Badge>
                                    </div>
                                ))}
                                {students.length === 0 && <span className="text-sm text-gray-400">No upcoming exams</span>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notices Widget */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <Bell size={16} /> Recent Notices
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex gap-2 items-start">
                                    <div className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium leading-none">School Annual Day</p>
                                        <p className="text-xs text-gray-500 mt-1">Dec 15, 2023</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium leading-none">Winter Break</p>
                                        <p className="text-xs text-gray-500 mt-1">Starts Dec 20</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Fees Snapshot Widget */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <DollarSign size={16} /> Fees Snapshot
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold mb-1">
                                {analyticsData.some(a => a.fee_status === 'OVERDUE') ? (
                                    <span className="text-red-600">Action Required</span>
                                ) : (
                                    <span className="text-green-600">All Clear</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                                {analyticsData.filter(a => a.fee_status !== 'ALL_PAID').length} invoices pending
                            </p>
                            <Button size="sm" variant="outline" className="w-full text-xs h-7" asChild>
                                <Link to="/dashboard/fees">View Details</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ParentDashboard;
