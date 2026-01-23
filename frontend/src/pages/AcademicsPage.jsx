
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom"; // Import Link
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
    GraduationCap,
    Calendar,
    BookOpen,
    ShieldAlert,
    ArrowRight,
    LayoutGrid,
    Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function AcademicsPage() {
    const { accessToken, user } = useAuth();
    const { toast } = useToast();
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (accessToken) {
            loadOverview();
        }
    }, [accessToken]);

    const loadOverview = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/academics/overview`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setOverview(res.data);
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to load academic overview", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading academic data...</div>;

    // derived
    const activeYear = overview?.active_year;
    const currentTerm = overview?.current_term;

    return (
        <div className="space-y-6">

            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <GraduationCap className="h-6 w-6 text-[#003333]" />
                        Academics Daily Control Center
                    </h1>
                    <p className="text-slate-500">Overview of your school's academic pulse.</p>
                </div>
                <div className="flex items-center gap-2">
                    {activeYear ? (
                        <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 px-3 py-1">
                            <Calendar className="w-3 h-3 mr-2" />
                            Year: {activeYear.name}
                        </Badge>
                    ) : (
                        <Badge variant="destructive">No Active Year</Badge>
                    )}

                    {currentTerm ? (
                        <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 px-3 py-1">
                            <BookOpen className="w-3 h-3 mr-2" />
                            Term: {currentTerm.name}
                        </Badge>
                    ) : (
                        <Badge variant="secondary">No Active Term</Badge>
                    )}
                </div>
            </div>

            {/* --- MAIN GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Grade Structure Snapshot */}
                <Card className="md:col-span-1 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold flex items-center justify-between">
                            <span>Structure</span>
                            <Badge variant="secondary">{overview?.grades_count} Grades</Badge>
                        </CardTitle>
                        <CardDescription>Grades & Sections Overview</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Total Sections</span>
                                <span className="font-bold">{overview?.sections_count}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Total Subjects</span>
                                <span className="font-bold">{overview?.subjects_count}</span>
                            </div>

                            <div className="pt-4">
                                <Link to="/dashboard/academic-setup">
                                    <Button variant="outline" className="w-full text-slate-600 hover:text-[#003333]">
                                        <Settings className="w-4 h-4 mr-2" /> Open Setup Hub
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Timeline / Term Status */}
                <Card className="md:col-span-1 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold">Timeline</CardTitle>
                        <CardDescription>Current Academic Progress</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activeYear ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                    <div className="text-xs text-slate-500 uppercase font-semibold">Active Year</div>
                                    <div className="font-medium text-slate-800">{activeYear.name}</div>
                                    <div className="text-xs text-slate-400">{activeYear.start_date} - {activeYear.end_date}</div>
                                </div>
                                <div className="p-3 bg-blue-50 rounded border border-blue-100">
                                    <div className="text-xs text-blue-500 uppercase font-semibold">Current Term</div>
                                    {currentTerm ? (
                                        <>
                                            <div className="font-medium text-blue-900">{currentTerm.name}</div>
                                            <div className="text-xs text-blue-400">{currentTerm.start_date} - {currentTerm.end_date}</div>
                                        </>
                                    ) : (
                                        <span className="text-sm italic text-blue-400">No active term</span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 italic">No Active Year Configured</div>
                        )}
                    </CardContent>
                </Card>

                {/* 3. Grading Policy Summary */}
                <Card className="md:col-span-1 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold">Grading Policy</CardTitle>
                        <CardDescription>Active Ruleset</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4 h-full justify-between">
                            <div className="text-sm text-slate-600">
                                {overview?.policy_summary ? (
                                    <div className="p-3 bg-green-50 text-green-800 rounded border border-green-100 font-mono text-center">
                                        {overview.policy_summary}
                                    </div>
                                ) : (
                                    <span className="italic text-slate-400">Policy not configured for this year.</span>
                                )}
                            </div>
                            <Link to="/dashboard/academic-setup">
                                <Button size="sm" variant="ghost" className="w-full text-slate-500">
                                    Edit Policy <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Academic Alerts (Full Width) */}
                <Card className="md:col-span-3 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-yellow-600" />
                            Academic Alerts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {overview?.alerts && overview.alerts.length > 0 ? (
                            <div className="space-y-2">
                                {/* ALERT LISTING */}
                                {overview.alerts.map((alert, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded text-yellow-800 text-sm">
                                        <span>{alert.message}</span>
                                        <Badge variant="outline" className="border-yellow-200 bg-white">Action Required</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                <CheckCircle className="w-8 h-8 mb-2 text-green-100" /> {/* Changed Icon or keep Check */}
                                <p>No critical alerts. All systems nominal.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}

// Helper
function CheckCircle({ className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
    )
}
