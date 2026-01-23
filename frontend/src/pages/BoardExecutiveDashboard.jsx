import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../context/AuthContext';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle, ArrowRight, UserCheck, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '../lib/api';

const BoardExecutiveDashboard = () => {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await api.get('/board/overview');
                setData(res.data);
            } catch (err) {
                console.error("Failed to load executive overview", err);
                // Fallback mock data for dev
                setData({
                    kpis: {
                        academic_index: 8.4,
                        risk_index: 12, // % high risk
                        enrollment: 1240,
                        enrollment_growth: 4.5,
                        fee_collection_rate: 92,
                        staff_stability: 98,
                        compliance_status: "Green"
                    },
                    trends: {
                        gpa: [8.1, 8.2, 8.2, 8.3, 8.4],
                        attendance: [94, 95, 93, 94, 96]
                    },
                    risks: [
                        { id: 1, title: "Declining Science enrollment in Grade 11", severity: "Medium" },
                        { id: 2, title: "Teacher housing allowance policy pending review", severity: "High" }
                    ],
                    governance_queue: [
                        { id: 101, action: "Approve AY 2025-26 Calendar", requested_by: "Principal", date: "2025-01-20" },
                        { id: 102, action: "Review Q4 Grading Policy Adjustment", requested_by: "Academic Director", date: "2025-01-21" }
                    ],
                    snapshot: {
                        last_audit: "2024-12-15 (Clean)",
                        policy_updates: "2 pending approval"
                    }
                });
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-nepsis-primary" /></div>;

    const kpiCard = (title, value, subtitle, icon, status = "neutral") => (
        <Card className="shadow-sm border-l-4 border-l-nepsis-primary">
            <CardContent className="p-4 flex justify-between items-start">
                <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
                    <h3 className="text-2xl font-bold mt-1 text-[#003333]">{value}</h3>
                    {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
                </div>
                {icon && <div className={`p-2 rounded-full ${status === 'green' ? 'bg-green-100 text-green-700' : status === 'red' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{icon}</div>}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-8 p-4 md:p-8 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#003333]">Executive Dashboard</h1>
                    <p className="text-gray-500">School Health & Governance Overview</p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="px-3 py-1 bg-white">AY 2024-25</Badge>
                    <Badge variant="outline" className="px-3 py-1 bg-white">Term 3</Badge>
                    <Badge className="px-3 py-1 bg-[#003333]">Board View</Badge>
                </div>
            </div>

            {/* Section 1: Executive KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {kpiCard("Academic Performance", data?.kpis?.academic_index, "Avg GPA (+0.1 vs last term)", <TrendingUp size={16} />, "green")}
                {kpiCard("Student Risk Index", `${data?.kpis?.risk_index}%`, "High Risk Students", <ShieldAlert size={16} />, "red")}
                {kpiCard("Total Enrollment", data?.kpis?.enrollment, `+${data?.kpis?.enrollment_growth}% YoY`, <UserCheck size={16} />, "neutral")}
                {kpiCard("Fee Health", `${data?.kpis?.fee_collection_rate}%`, "Collection Rate", <TrendingUp size={16} />, "green")}
                {kpiCard("Staff Stability", `${data?.kpis?.staff_stability}%`, "Retention Rate", <CheckCircle size={16} />, "green")}
                {kpiCard("Compliance", data?.kpis?.compliance_status, "Audit Status", <CheckCircle size={16} />, "green")}
            </div>

            {/* Section 2: Trends & Comparisons */}
            <div className="grid gap-6 md:grid-cols-12 h-auto">
                <div className="md:col-span-8 space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Key Performance Trends</CardTitle></CardHeader>
                        <CardContent className="h-[300px] flex items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg m-4">
                            <p className="text-gray-400 text-sm">GPA & Attendance Trend Visualization Component</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-4 space-y-4">
                    <Card className="h-full bg-[#003333] text-white">
                        <CardHeader><CardTitle className="text-lg text-white">Executive Insights</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 bg-white/10 rounded-lg text-sm">
                                <p className="font-semibold text-yellow-300 mb-1">Fee Collection Warning</p>
                                <p className="text-gray-200">Grade 10 collections are lagging by 15% compared to this time last year.</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-lg text-sm">
                                <p className="font-semibold text-green-300 mb-1">Academic Excellence</p>
                                <p className="text-gray-200">Science department GPA has hit a 5-year high of 8.6.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Section 3: Strategic Risks & Governance Queue */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Strategic Risks */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Strategic Risks Watchlist</CardTitle>
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">{data?.risks?.length} Active</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {data?.risks?.map(risk => (
                            <div key={risk.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50">
                                <AlertCircle className={`mt-0.5 ${risk.severity === 'High' ? 'text-red-500' : 'text-yellow-500'}`} size={18} />
                                <div>
                                    <p className="font-medium text-sm">{risk.title}</p>
                                    <span className="text-xs text-gray-500">Severity: {risk.severity}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Decisions Needed */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Governance Decisions Needed</CardTitle>
                        <Badge variant="secondary">{data?.governance_queue?.length} Pending</Badge>
                    </CardHeader>
                    <CardContent className="space-y-0 divide-y">
                        {data?.governance_queue?.map(item => (
                            <div key={item.id} className="py-3 flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-sm">{item.action}</p>
                                    <p className="text-xs text-gray-500">Req by: {item.requested_by} • {item.date}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline">Review</Button>
                                    <Button size="sm" className="bg-[#003333] hover:bg-[#004444]">Approve</Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Section 4: Governance Snapshot */}
            <Card className="bg-slate-100 border-none">
                <CardContent className="p-6 flex flex-wrap justify-between items-center gap-4">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Last Audit</p>
                            <p className="font-medium">{data?.snapshot?.last_audit}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase">Policy Updates</p>
                            <p className="font-medium">{data?.snapshot?.policy_updates}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase">System Status</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="font-medium">Operational</span>
                            </div>
                        </div>
                    </div>
                    <Button variant="link" className="text-[#003333]">View Full Audit Log <ArrowRight size={16} className="ml-1" /></Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default BoardExecutiveDashboard;
