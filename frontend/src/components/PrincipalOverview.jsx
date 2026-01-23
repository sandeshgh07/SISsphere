/**
 * PrincipalOverview Component
 * 
 * Comprehensive dashboard for Principal's portal featuring:
 * - KPI cards with trends (Students, Attendance, Fee Collection)
 * - Academic Performance chart by grade
 * - Teacher Workload Distribution
 * - Risk & Alerts panel
 * 
 * Color Scheme:
 * - Maroon (#800000): Risk/HIGH/Negative
 * - Lux Green (#32CD32): Positive/Upward
 * - Orange (#FFA500): Warning/MEDIUM
 * - Gray (#6B7280): LOW/Neutral
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Users,
    TrendingUp,
    TrendingDown,
    Minus,
    DollarSign,
    AlertTriangle,
    ChevronDown,
    Download,
    Calendar,
    GraduationCap,
    ClipboardCheck,
    BarChart3,
    AlertCircle,
    ChevronRight,
    Clock,
    Shield,
    Flame,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

// ==================================
// Color Scheme Constants
// ==================================
const COLORS = {
    risk: "#800000",      // Maroon - HIGH severity, negative trends
    warning: "#FFA500",   // Orange - MEDIUM severity, warnings
    success: "#32CD32",   // Lux Green - positive trends
    low: "#6B7280",       // Gray - LOW severity
    optimal: "#22C55E",   // Green for optimal workload
    high: "#EAB308",      // Yellow for high workload
    critical: "#EF4444",  // Red for critical workload
};

const SEVERITY_CONFIG = {
    HIGH: {
        color: COLORS.risk,
        bgColor: "bg-[#800000]/10",
        borderColor: "border-l-[#800000]",
        textColor: "text-[#800000]",
        label: "HIGH",
    },
    MEDIUM: {
        color: COLORS.warning,
        bgColor: "bg-orange-500/10",
        borderColor: "border-l-orange-500",
        textColor: "text-orange-600",
        label: "MEDIUM",
    },
    WARNING: {
        color: COLORS.warning,
        bgColor: "bg-yellow-500/10",
        borderColor: "border-l-yellow-500",
        textColor: "text-yellow-600",
        label: "WARNING",
    },
    LOW: {
        color: COLORS.low,
        bgColor: "bg-gray-500/10",
        borderColor: "border-l-gray-400",
        textColor: "text-gray-500",
        label: "LOW",
    },
};

// ==================================
// Sub-Components
// ==================================

function TrendIndicator({ trend, changePercent }) {
    if (!trend) return null;

    const isUp = trend === "up";
    const isDown = trend === "down";
    const color = isUp ? COLORS.success : isDown ? COLORS.risk : COLORS.low;
    const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

    return (
        <div className="flex items-center gap-1 text-sm" style={{ color }}>
            <Icon className="w-4 h-4" />
            <span>{Math.abs(changePercent)}%</span>
        </div>
    );
}

function KPICard({ icon: Icon, iconBg, label, value, subLabel, trend, progress, target, onClick }) {
    return (
        <Card
            className={`bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-sm text-slate-500 font-medium">{label}</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                        {subLabel && trend && (
                            <div className="flex items-center gap-2 mt-2">
                                <TrendIndicator trend={trend.trend} changePercent={trend.change_percent} />
                                <span className="text-xs text-slate-400">{subLabel}</span>
                            </div>
                        )}
                        {progress !== undefined && target && (
                            <div className="mt-3">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>NPR {(value * target / 100).toLocaleString()} Collected</span>
                                    <span>Target: NPR {target.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div
                                        className="h-2 rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(100, progress)}%`,
                                            backgroundColor: progress >= 75 ? COLORS.success : progress >= 50 ? COLORS.warning : COLORS.risk,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={`p-3 rounded-xl ${iconBg}`}>
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AcademicPerformanceChart({ data }) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                No academic data available
            </div>
        );
    }

    const maxGPA = 4.0;

    return (
        <div className="space-y-4">
            {data.map((grade) => (
                <div key={grade.grade_id} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium text-slate-600 text-right">
                        {grade.grade_name}
                    </div>
                    <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                        <div
                            className="h-full rounded-lg transition-all duration-500"
                            style={{
                                width: `${(grade.avg_gpa / maxGPA) * 100}%`,
                                background: `linear-gradient(90deg, #4F46E5 0%, #818CF8 100%)`,
                            }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-600">
                            {grade.avg_gpa.toFixed(2)} GPA
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ==================================
// Student Risk Panel Component (LEFT)
// ==================================
function StudentRiskPanel({ riskData, onStudentClick }) {
    const [filter, setFilter] = useState(null); // null = all, "HIGH", "MEDIUM", "ON_TRACK"

    if (!riskData) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Shield className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">Not enough data available</p>
                <p className="text-xs">Student risk analysis requires attendance and grades data</p>
            </div>
        );
    }

    const { risk_distribution, students_at_risk } = riskData;
    const total = (risk_distribution?.high || 0) + (risk_distribution?.medium || 0) + (risk_distribution?.on_track || 0);

    const donutData = [
        { name: "High Risk", value: risk_distribution?.high || 0, color: COLORS.risk },
        { name: "Medium Risk", value: risk_distribution?.medium || 0, color: COLORS.warning },
        { name: "On Track", value: risk_distribution?.on_track || 0, color: COLORS.success },
    ];

    const filteredStudents = filter
        ? students_at_risk.filter(s => s.risk_level === filter)
        : students_at_risk;

    const reasonIcons = {
        low_attendance: ClipboardCheck,
        gpa_drop: GraduationCap,
        fee_overdue: DollarSign,
        behavioral_incidents: AlertTriangle,
        inactivity: Clock,
    };

    return (
        <div className="space-y-4">
            {/* Donut Chart */}
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <div className="relative w-48 h-48 mx-auto">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            {donutData.reduce((acc, slice, idx) => {
                                const prevTotal = donutData.slice(0, idx).reduce((s, d) => s + d.value, 0);
                                const percentage = total > 0 ? (slice.value / total) * 100 : 0;
                                const circumference = 2 * Math.PI * 35;
                                const offset = (prevTotal / total) * circumference;
                                const length = (slice.value / total) * circumference;

                                if (slice.value === 0) return acc;

                                acc.push(
                                    <circle
                                        key={slice.name}
                                        cx="50"
                                        cy="50"
                                        r="35"
                                        fill="transparent"
                                        stroke={slice.color}
                                        strokeWidth="12"
                                        strokeDasharray={`${length} ${circumference - length}`}
                                        strokeDashoffset={-offset}
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setFilter(filter === slice.name.split(" ")[0].toUpperCase() ? null : slice.name.split(" ")[0].toUpperCase())}
                                    />
                                );
                                return acc;
                            }, [])}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-slate-800">{total}</span>
                            <span className="text-xs text-slate-500">Students</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    {donutData.map(d => (
                        <button
                            key={d.name}
                            onClick={() => setFilter(filter === d.name.split(" ")[0].toUpperCase() ? null : d.name.split(" ")[0].toUpperCase())}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${filter === d.name.split(" ")[0].toUpperCase()
                                ? "bg-slate-100 ring-2 ring-slate-300"
                                : "hover:bg-slate-50"
                                }`}
                        >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-slate-600">{d.name}</span>
                            <span className="font-semibold text-slate-800">{d.value}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Student List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                        <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No at-risk students detected.</p>
                        <p className="text-xs">All students are currently on track.</p>
                    </div>
                ) : (
                    filteredStudents.slice(0, 5).map(student => {
                        const ReasonIcon = reasonIcons[student.primary_reason] || AlertCircle;
                        return (
                            <div
                                key={student.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-all bg-white"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                        style={{ backgroundColor: student.risk_level === "HIGH" ? COLORS.risk : COLORS.warning }}
                                    >
                                        {student.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm">{student.name}</p>
                                        <p className="text-xs text-slate-500">{student.grade_name} {student.section_name && `- ${student.section_name}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-xs text-slate-500" title={student.reason_detail}>
                                        <ReasonIcon className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{student.reason_detail?.split(" ").slice(0, 2).join(" ")}</span>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="text-xs"
                                        style={{
                                            color: student.risk_level === "HIGH" ? COLORS.risk : COLORS.warning,
                                            borderColor: student.risk_level === "HIGH" ? COLORS.risk : COLORS.warning,
                                        }}
                                    >
                                        {student.risk_level}
                                    </Badge>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {filteredStudents.length > 5 && (
                <Button variant="link" className="w-full text-indigo-600 text-sm">
                    View All {filteredStudents.length} Students →
                </Button>
            )}
        </div>
    );
}

// ==================================
// Cross-Term Comparison Component (RIGHT)
// ==================================
function CrossTermComparison({ comparisonData }) {
    if (!comparisonData) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <BarChart3 className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">Not enough data for comparison</p>
                <p className="text-xs">Term comparison requires data from multiple terms</p>
            </div>
        );
    }

    const { current_term, previous_term, metrics, insights } = comparisonData;

    const barColors = {
        current: "#4F46E5", // Indigo
        previous: "#94A3B8", // Slate
    };

    // Find max value for scaling
    const maxVal = Math.max(...metrics.flatMap(m => [m.current, m.previous]), 1);

    return (
        <div className="space-y-4">
            {/* Term Labels */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: barColors.current }} />
                        <span className="text-slate-600">{current_term}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: barColors.previous }} />
                        <span className="text-slate-500">{previous_term}</span>
                    </div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="space-y-3">
                {metrics.map(metric => {
                    const currentWidth = maxVal > 0 ? (metric.current / maxVal) * 100 : 0;
                    const previousWidth = maxVal > 0 ? (metric.previous / maxVal) * 100 : 0;
                    const TrendIcon = metric.trend === "up" ? TrendingUp : metric.trend === "down" ? TrendingDown : Minus;
                    const trendColor = metric.trend === "up" ? COLORS.success : metric.trend === "down" ? COLORS.risk : COLORS.low;

                    return (
                        <div key={metric.name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-700">{metric.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-600">{metric.current}{metric.unit}</span>
                                    <TrendIcon className="w-4 h-4" style={{ color: trendColor }} />
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                                    <div
                                        className="h-full rounded transition-all duration-500"
                                        style={{ width: `${currentWidth}%`, backgroundColor: barColors.current }}
                                    />
                                </div>
                                <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                                    <div
                                        className="h-full rounded transition-all duration-500"
                                        style={{ width: `${previousWidth}%`, backgroundColor: barColors.previous }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Insights */}
            <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Key Insights</h4>
                <div className="space-y-1">
                    {insights.map((insight, idx) => (
                        <p key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                            <span className="text-indigo-500 mt-0.5">•</span>
                            {insight}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RiskAlertCard({ alert }) {
    const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.LOW;

    const categoryIcons = {
        ATTENDANCE: ClipboardCheck,
        BUDGET: DollarSign,
        STAFF: Users,
        COMPLIANCE: Shield,
        ACADEMIC: GraduationCap,
    };

    const CategoryIcon = categoryIcons[alert.category] || AlertCircle;

    return (
        <div
            className={`p-4 rounded-lg border-l-4 ${config.bgColor} ${config.borderColor} transition-all hover:shadow-sm`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-800 text-sm">{alert.title}</h4>
                        <Badge
                            variant="outline"
                            className={`text-xs px-2 py-0 ${config.textColor} border-current`}
                        >
                            {config.label}
                        </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{alert.description}</p>
                    <button
                        className="text-xs font-medium flex items-center gap-1 hover:gap-2 transition-all"
                        style={{ color: config.color }}
                    >
                        {alert.action_label}
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
                <CategoryIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </div>
        </div>
    );
}

// ==================================
// Main Component
// ==================================
export default function PrincipalOverview() {
    const { accessToken, isHydrated } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [riskData, setRiskData] = useState(null);
    const [comparisonData, setComparisonData] = useState(null);
    const [period, setPeriod] = useState("30d");
    const [error, setError] = useState(null);

    const fetchDashboard = useCallback(async () => {
        if (!accessToken) return;

        setLoading(true);
        setError(null);

        try {
            // Fetch all dashboard data in parallel
            const [dashboardRes, riskRes, comparisonRes] = await Promise.all([
                axios.get(`${API_BASE}/api/principal/dashboard?period=${period}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }),
                axios.get(`${API_BASE}/api/principal/student-risk-summary`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }).catch(e => ({ data: null })),
                axios.get(`${API_BASE}/api/principal/term-comparison`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }).catch(e => ({ data: null })),
            ]);

            setData(dashboardRes.data);
            setRiskData(riskRes.data);
            setComparisonData(comparisonRes.data);
        } catch (err) {
            console.error("[PrincipalOverview] Error:", err);
            setError("Failed to load dashboard data");

            // Fallback to basic summary if principal endpoint fails
            try {
                const fallbackRes = await axios.get(`${API_BASE}/api/dashboard/summary`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                setData({
                    school_name: fallbackRes.data.school_name,
                    school_logo_url: fallbackRes.data.school_logo_url,
                    term_info: fallbackRes.data.current_term || "Current Term",
                    total_students: {
                        label: "Total Students",
                        value: fallbackRes.data.student_count || 0,
                    },
                    avg_attendance: {
                        label: "Avg Attendance",
                        value: `${fallbackRes.data.avg_attendance_rate || 0}%`,
                    },
                    fee_collection: {
                        label: "Fee Collection",
                        value: `${fallbackRes.data.collection_percent || 0}%`,
                        target: fallbackRes.data.total_invoiced || 0,
                        progress_percent: fallbackRes.data.collection_percent || 0,
                    },
                    academic_performance: [],
                    teacher_workload: [],
                    risk_alerts: [],
                    urgent_count: 0,
                });
                setError(null);
            } catch (fallbackErr) {
                console.error("[PrincipalOverview] Fallback error:", fallbackErr);
            }
        } finally {
            setLoading(false);
        }
    }, [accessToken, period]);

    useEffect(() => {
        if (isHydrated && accessToken) {
            fetchDashboard();
        }
    }, [isHydrated, accessToken, fetchDashboard]);

    // Loading state
    if (!isHydrated || loading) {
        return (
            <div className="col-span-full space-y-6 animate-pulse">
                <div className="h-10 w-64 bg-slate-200 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-32 bg-slate-200 rounded-xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-64 bg-slate-200 rounded-xl" />
                    <div className="h-64 bg-slate-200 rounded-xl" />
                </div>
            </div>
        );
    }

    // Error state
    if (error && !data) {
        return (
            <div className="col-span-full">
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="py-8 text-center">
                        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-red-800 mb-2">Dashboard Error</h2>
                        <p className="text-red-600 mb-4">{error}</p>
                        <Button onClick={fetchDashboard} variant="outline" className="text-red-600 border-red-300">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const periodLabels = {
        "7d": "Last 7 Days",
        "30d": "Last 30 Days",
        "90d": "Last 90 Days",
        "1y": "Last Year",
    };

    return (
        <div className="col-span-full space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">School Overview</h1>
                    <p className="text-sm text-slate-500">
                        {data?.term_info}, Academic Year 2025-2026
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="border-slate-300">
                                <Calendar className="w-4 h-4 mr-2" />
                                {periodLabels[period]}
                                <ChevronDown className="w-4 h-4 ml-2" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {Object.entries(periodLabels).map(([key, label]) => (
                                <DropdownMenuItem
                                    key={key}
                                    onClick={() => setPeriod(key)}
                                    className={period === key ? "bg-slate-100" : ""}
                                >
                                    {label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                            // Generate CSV from current dashboard data
                            if (!data) return;

                            const headers = ["Metric", "Value", "Sub Label", "Trend"];
                            const rows = [
                                ["Total Students", data.total_students?.value, data.total_students?.sub_label, data.total_students?.trend?.trend],
                                ["Avg Attendance", data.avg_attendance?.value, data.avg_attendance?.sub_label, data.avg_attendance?.trend?.trend],
                                ["Fee Collection", data.fee_collection?.value, `Target: ${data.fee_collection?.target}`, `${data.fee_collection?.progress_percent}%`]
                            ];

                            // Add Risk Alerts
                            if (data.risk_alerts?.length) {
                                rows.push([]);
                                rows.push(["Risk Alerts"]);
                                rows.push(["Severity", "Category", "Title", "Description"]);
                                data.risk_alerts.forEach(a => {
                                    rows.push([a.severity, a.category, a.title, a.description]);
                                });
                            }

                            // Add Teacher Workload
                            if (data.teacher_workload?.length) {
                                rows.push([]);
                                rows.push(["Teacher Workload"]);
                                rows.push(["Department", "Optimal %", "High %", "Critical %"]);
                                data.teacher_workload.forEach(d => {
                                    rows.push([d.department, d.optimal_percent, d.high_percent, d.critical_percent]);
                                });
                            }

                            const csvContent = "data:text/csv;charset=utf-8,"
                                + rows.map(e => e.join(",")).join("\n");

                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `school_report_${new Date().toISOString().split('T')[0]}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download Report
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard
                    icon={Users}
                    iconBg="bg-indigo-500"
                    label="Total Students"
                    value={data?.total_students?.value ?? 0}
                    subLabel={data?.total_students?.sub_label}
                    trend={data?.total_students?.trend}
                    onClick={() => navigate('/dashboard/users')}
                />
                <KPICard
                    icon={ClipboardCheck}
                    iconBg="bg-emerald-500"
                    label="Avg Attendance"
                    value={typeof data?.avg_attendance?.value === 'string'
                        ? data.avg_attendance.value
                        : `${data?.avg_attendance?.value ?? 0}%`}
                    subLabel={data?.avg_attendance?.sub_label}
                    trend={data?.avg_attendance?.trend}
                    onClick={() => navigate('/dashboard/academics')}
                />
                <KPICard
                    icon={DollarSign}
                    iconBg="bg-violet-500"
                    label="Fee Collection"
                    value={typeof data?.fee_collection?.value === 'string'
                        ? data.fee_collection.value
                        : `${data?.fee_collection?.value ?? 0}%`}
                    progress={data?.fee_collection?.progress_percent}
                    target={data?.fee_collection?.target}
                    onClick={() => navigate('/dashboard/fees')}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Academic Performance */}
                <Card className="bg-white border border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg font-semibold text-slate-800">
                                Academic Performance
                            </CardTitle>
                            <p className="text-sm text-slate-500">Average GPA by Grade Level</p>
                        </div>
                        <Button variant="link" className="text-indigo-600 p-0 h-auto">
                            View Details
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <AcademicPerformanceChart data={data?.academic_performance} />
                    </CardContent>
                </Card>

                {/* Risks & Alerts */}
                <Card className="bg-white border border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <CardTitle className="text-lg font-semibold text-slate-800">
                                Risks & Alerts
                            </CardTitle>
                        </div>
                        {data?.urgent_count > 0 && (
                            <Badge
                                className="text-white"
                                style={{ backgroundColor: COLORS.risk }}
                            >
                                {data.urgent_count} Urgent
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-80 overflow-y-auto">
                        {data?.risk_alerts && data.risk_alerts.length > 0 ? (
                            data.risk_alerts.map((alert, idx) => (
                                <RiskAlertCard key={alert.id || idx} alert={alert} />
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No active alerts</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Student Risk & Cross-Term Comparison Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Student Risk Panel */}
                <Card className="bg-white border border-slate-200">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-semibold text-slate-800">
                                    Student Risk & Intervention
                                </CardTitle>
                                <p className="text-sm text-slate-500">At-risk students requiring attention</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <StudentRiskPanel riskData={riskData} />
                    </CardContent>
                </Card>

                {/* RIGHT: Cross-Term Comparison */}
                <Card className="bg-white border border-slate-200">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-semibold text-slate-800">
                                    Term-over-Term Comparison
                                </CardTitle>
                                <p className="text-sm text-slate-500">Performance trends across academic terms</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CrossTermComparison comparisonData={comparisonData} />
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
