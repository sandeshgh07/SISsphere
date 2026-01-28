import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ClipboardList,
    UserCheck,
    AlertTriangle,
    MessageSquare,
    ChevronRight,
    Clock,
    ShieldAlert,
    CheckCircle2
} from 'lucide-react';
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function TeacherDashboard() {
    const { accessToken } = useAuth();
    const navigate = useNavigate();

    const [kpi, setKpi] = useState({
        assessments_to_grade: 0,
        attendance_pending: 0,
        critical_notices: 0,
        open_complaints: 0
    });
    const [queue, setQueue] = useState([]);
    const [attendanceShortcuts, setAttendanceShortcuts] = useState([]);
    const [highRiskStudents, setHighRiskStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!accessToken) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const headers = { Authorization: `Bearer ${accessToken}` };

                const [kpiRes, queueRes, attRes, riskRes] = await Promise.all([
                    axios.get(`${API_BASE}/api/dashboard/teacher/kpi`, { headers }),
                    axios.get(`${API_BASE}/api/dashboard/teacher/queue`, { headers }),
                    axios.get(`${API_BASE}/api/dashboard/teacher/attendance-shortcuts`, { headers }),
                    axios.get(`${API_BASE}/api/dashboard/teacher/high-risk-students`, { headers })
                ]);

                setKpi(kpiRes.data);
                setQueue(queueRes.data);
                setAttendanceShortcuts(attRes.data);
                setHighRiskStudents(riskRes.data);

            } catch (err) {
                console.error("Failed to load teacher dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [accessToken]);

    if (loading) {
        return (
            <div className="w-full space-y-6 animate-pulse p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-96 bg-slate-100 rounded-2xl" />
                    <div className="h-96 bg-slate-100 rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-none space-y-6 p-4 md:p-6 overflow-x-hidden">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <KPICard
                    icon={ClipboardList}
                    label="Assessments to Grade"
                    value={kpi.assessments_to_grade}
                    color="text-emerald-600"
                    bgIcon="text-emerald-50"
                    onClick={() => navigate('/dashboard/grading')}
                    cta="Open Queue"
                />
                <KPICard
                    icon={UserCheck}
                    label="Attendance Pending"
                    value={kpi.attendance_pending}
                    color="text-amber-600"
                    bgIcon="text-amber-50"
                    onClick={() => navigate('/dashboard/attendance/record')}
                    cta="Record Now"
                />
                <KPICard
                    icon={ShieldAlert}
                    label="Critical Notices"
                    value={kpi.critical_notices}
                    color="text-rose-600"
                    bgIcon="text-rose-50"
                    onClick={() => navigate('/dashboard/notices?filter=critical')}
                    cta="View Notices"
                />
                <KPICard
                    icon={MessageSquare}
                    label="Open Complaints"
                    value={kpi.open_complaints}
                    color="text-purple-600"
                    bgIcon="text-purple-50"
                    onClick={() => navigate('/dashboard/complaints')}
                    cta="View Issues"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Grading Queue */}
                    <Card
                        className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl cursor-pointer group"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/dashboard/grading')}
                    >
                        <CardHeader className="pb-4 border-b border-slate-100">
                            <CardTitle className="text-lg font-semibold text-slate-900 flex justify-between items-center">
                                <span>My Grading Queue</span>
                                <span className="text-xs font-medium text-slate-500 group-hover:text-emerald-600 flex items-center gap-1 transition-colors">
                                    View All <ChevronRight className="w-4 h-4" />
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            {queue.length === 0 ? (
                                <div className="py-8 text-center flex flex-col items-center justify-center text-slate-400">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-300">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <p className="font-medium text-slate-900">All caught up!</p>
                                    <p className="text-sm">No pending assessments to grade</p>
                                </div>
                            ) : (
                                queue.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex justify-between items-center p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors group/item"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/dashboard/grading`);
                                        }}
                                    >
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900">{item.assessment_name}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="bg-white border-slate-200 text-slate-600 font-normal hover:bg-white">{item.subject}</Badge>
                                                {item.due_date && (
                                                    <span className="flex items-center text-slate-400">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {new Date(item.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 group-hover/item:border-emerald-200 group-hover/item:text-emerald-700">
                                            {item.pending_count} Pending
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Attendance Shortcuts */}
                    <Card
                        className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl cursor-pointer group"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/dashboard/attendance/record')}
                    >
                        <CardHeader className="pb-4 border-b border-slate-100">
                            <CardTitle className="text-lg font-semibold text-slate-900 flex justify-between items-center">
                                <span>Attendance Shortcuts</span>
                                <span className="text-xs font-medium text-slate-500 group-hover:text-emerald-600 flex items-center gap-1 transition-colors">
                                    Record Now <ChevronRight className="w-4 h-4" />
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {attendanceShortcuts.map((sc, idx) => (
                                <div
                                    key={idx}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/dashboard/attendance/record?grade=${sc.grade_id}&section=${sc.section_id || ''}`);
                                    }}
                                    className={`
                                        flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer
                                        ${sc.status === 'DONE'
                                            ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                                            : 'bg-slate-50 border-slate-100 hover:bg-slate-100 hover:border-slate-200'}
                                    `}
                                >
                                    <span className={`text-sm font-medium ${sc.status === 'DONE' ? 'text-emerald-900' : 'text-slate-700'}`}>
                                        {sc.label}
                                    </span>
                                    {sc.status === 'DONE' ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">DONE</Badge>
                                    ) : (
                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">PENDING</Badge>
                                    )}
                                </div>
                            ))}
                            {attendanceShortcuts.length === 0 && (
                                <div className="col-span-full py-6 text-center text-slate-500 text-sm">
                                    No classes assigned today
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column (1/3) */}
                <div className="space-y-6">
                    {/* High Risk Students */}
                    <Card
                        className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-fit group"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/dashboard/my-students')}
                    >
                        <CardHeader className="pb-4 border-b border-slate-100">
                            <CardTitle className="text-lg font-semibold text-slate-900 flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                                    High-Risk Students
                                </span>
                            </CardTitle>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">My Grades Only</p>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            {highRiskStudents.length === 0 ? (
                                <div className="py-8 text-center flex flex-col items-center justify-center text-slate-400">
                                    <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mb-2 text-emerald-500">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm">All students look good!</p>
                                </div>
                            ) : (
                                highRiskStudents.map(({ student, risk_score, badges }) => (
                                    <div
                                        key={student.id}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100 group/item hover:bg-rose-100 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/dashboard/students/${student.id}`);
                                        }}
                                    >
                                        <div className="h-10 w-10 rounded-full bg-white border border-rose-100 flex items-center justify-center overflow-hidden shrink-0 text-rose-300 font-bold">
                                            {student.photo_url ? (
                                                <img src={student.photo_url} alt={student.name} className="h-full w-full object-cover" />
                                            ) : (
                                                student.name.charAt(0)
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className="text-sm font-semibold text-slate-900 truncate">{student.name}</h4>
                                                <span className="text-xs font-bold text-rose-600 bg-white px-1.5 py-0.5 rounded shadow-sm">
                                                    {risk_score}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {badges.map(b => (
                                                    <span key={b} className="text-[10px] bg-white/50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100/50">
                                                        {b}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Critical Notices */}
                    {kpi.critical_notices > 0 && (
                        <Card
                            className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-2xl cursor-pointer group"
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate('/dashboard/notices?filter=critical')}
                        >
                            <CardHeader className="pb-4 border-b border-slate-100">
                                <CardTitle className="text-lg font-semibold text-slate-900">Critical Updates</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 text-center">
                                <div className="p-6 bg-rose-50 border border-rose-100 rounded-xl">
                                    <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                                    <p className="text-rose-900 font-medium">{kpi.critical_notices} Critical Notices</p>
                                    <p className="text-xs text-rose-700 mt-1">Require your immediate attention</p>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <span className="text-xs font-medium text-slate-400 group-hover:text-rose-600 flex items-center gap-1 transition-colors">
                                        View & Acknowledge <ChevronRight className="w-3 h-3" />
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

function KPICard({ icon: Icon, label, value, color, bgIcon, onClick, cta }) {
    return (
        <Card
            className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl cursor-pointer group relative overflow-hidden"
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <div className={`absolute -right-4 -top-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${bgIcon} pointer-events-none`}>
                <Icon className="w-32 h-32 opacity-10 rotate-12" />
            </div>

            <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`p-2 rounded-lg ${bgIcon} ${color} bg-opacity-50`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-600 transition-colors flex items-center gap-1">
                        {cta} <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
