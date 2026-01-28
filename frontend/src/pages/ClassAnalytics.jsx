import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Users, GraduationCap, Calendar, ListChecks, Download, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { toast } from 'sonner';

const ClassAnalytics = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    // Filters
    const [grades, setGrades] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState("all");
    const [sections, setSections] = useState([]);
    const [selectedSection, setSelectedSection] = useState("all");
    const [selectedPeriod, setSelectedPeriod] = useState("30d");

    const periodOptions = [
        { value: "7d", label: "Last Week" },
        { value: "30d", label: "Last 30 Days" },
        { value: "6m", label: "Last 6 Months" },
        { value: "1y", label: "This Year" }
    ];

    useEffect(() => {
        fetchMetadata();
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedGrade, selectedSection, selectedPeriod]);

    const fetchMetadata = async () => {
        try {
            // Fetch real grades and sections from academics structure API
            const res = await api.get('/academics/structure');
            if (Array.isArray(res.data)) {
                const gradeList = res.data.map(item => ({
                    id: item.grade.id,
                    name: item.grade.name,
                    sections: item.sections || []
                }));
                setGrades(gradeList);

                // Build a flat list of all unique sections
                const allSections = [];
                const seenIds = new Set();
                res.data.forEach(item => {
                    (item.sections || []).forEach(s => {
                        if (!seenIds.has(s.id)) {
                            seenIds.add(s.id);
                            allSections.push(s);
                        }
                    });
                });
                setSections(allSections);
            }
        } catch (e) {
            console.log("Metadata fetch failed", e);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { period: selectedPeriod };
            if (selectedGrade && selectedGrade !== 'all') params.grade_id = selectedGrade;
            if (selectedSection && selectedSection !== 'all') params.section_id = selectedSection;

            const res = await api.get('/principal/class-performance', { params });
            setData(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    const KPICard = ({ title, value, subtext, icon: Icon, trend }) => (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <h3 className="text-3xl font-bold mt-2">{value}</h3>
                        {trend && (
                            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend.trend === 'up' ? 'text-green-600' : trend.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                {trend.trend === 'up' ? <TrendingUp size={12} /> : trend.trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
                                <span>{trend.change_percent}%</span>
                            </div>
                        )}
                        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <Icon size={20} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loading && !data) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#003333]">Class Analytics</h1>
                    <p className="text-gray-500">Real-time performance metrics</p>
                </div>
                <div className="flex gap-3">
                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                        <SelectTrigger className="w-[150px] bg-white border-slate-300 text-slate-900">
                            <SelectValue placeholder="Select Grade" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="all">All Grades</SelectItem>
                            {grades.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                        <SelectTrigger className="w-[150px] bg-white border-slate-300 text-slate-900">
                            <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="all">All Sections</SelectItem>
                            {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[160px] bg-white border-slate-300 text-slate-900">
                            <Calendar size={16} className="mr-2" />
                            <SelectValue placeholder="Select Period" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            {periodOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Download size={16} /> Export
                    </Button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KPICard
                    title="Total Students"
                    value={data?.total_students.value}
                    trend={data?.total_students.trend}
                    icon={Users}
                />
                <KPICard
                    title="Avg Grade"
                    value={data?.avg_grade.value}
                    trend={data?.avg_grade.trend}
                    icon={GraduationCap}
                />
                <KPICard
                    title="Avg Attendance"
                    value={data?.avg_attendance.value}
                    trend={data?.avg_attendance.trend}
                    icon={ListChecks}
                />
                <KPICard
                    title="Pending Grading"
                    value={data?.pending_grading_count.value}
                    subtext={data?.pending_grading_count.sub_label}
                    icon={AlertTriangle}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Attendance Trends */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Attendance Trends</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.attendance_trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(val) => val.split('-')[2]} />
                                <YAxis hide />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorAtt)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Grade Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Grade Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] flex flex-col justify-center gap-4">
                        {data?.grade_distribution.map((item) => (
                            <div key={item.label} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-700">{item.label}</span>
                                    <span className="text-gray-500">{item.percentage}% ({item.value})</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${item.label === 'A' ? 'bg-blue-600' :
                                            item.label === 'B' ? 'bg-blue-400' :
                                                item.label === 'C' ? 'bg-indigo-400' :
                                                    item.label === 'D' ? 'bg-yellow-400' : 'bg-red-400'
                                            }`}
                                        style={{ width: `${item.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* At-Risk Students */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>At-Risk Students</CardTitle>
                        <Button variant="ghost" size="sm">View All</Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data?.at_risk_students.map(student => (
                                <div key={student.id} className="flex items-center justify-between p-3 bg-red-50/50 rounded-lg border border-red-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                                            {student.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{student.name}</p>
                                            <p className="text-xs text-red-600">{student.reason}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs border-red-200 text-red-700 hover:bg-red-100"
                                        onClick={() => navigate(`/dashboard/students/${student.id}`)}
                                    >
                                        Contact
                                    </Button>
                                </div>
                            ))}
                            {(!data?.at_risk_students || data.at_risk_students.length === 0) && (
                                <p className="text-gray-500 text-sm text-center py-4">No at-risk students identified.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Grading */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Grading</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data?.pending_grading_tasks.map(task => (
                                <div key={task.id} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{task.name}</span>
                                        <span className="text-gray-500">{task.submitted}/{task.total} Submitted</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 rounded-full"
                                            style={{ width: `${(task.submitted / task.total) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs">Grade Now</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ClassAnalytics;
