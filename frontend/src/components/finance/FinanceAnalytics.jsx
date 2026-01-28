import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { Loader2, TrendingUp, AlertCircle, Users, CreditCard, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinanceAnalytics() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [revenueTrend, setRevenueTrend] = useState([]);
    const [outstandingByGrade, setOutstandingByGrade] = useState([]);
    const [aging, setAging] = useState([]);
    const [topUnpaid, setTopUnpaid] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sumRes, revRes, outRes, ageRes, topRes] = await Promise.all([
                api.get(`/fees/analytics/summary`),
                api.get(`/fees/analytics/revenue-trend`),
                api.get(`/fees/analytics/outstanding-by-grade`),
                api.get(`/fees/analytics/aging`),
                api.get(`/fees/analytics/top-unpaid`)
            ]);

            setSummary(sumRes.data);
            setRevenueTrend(revRes.data);
            setOutstandingByGrade(outRes.data);
            setAging(ageRes.data);
            setTopUnpaid(topRes.data);
        } catch (error) {
            console.error("Failed to load analytics", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div>;
    }

    if (!summary) return null;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Billed Total" value={`NPR ${summary.billed_total.toLocaleString()}`} icon={CreditCard} />
                <KpiCard title="Collected Total" value={`NPR ${summary.collected_total.toLocaleString()}`} icon={DollarSign} className="text-green-600" />
                <KpiCard title="Outstanding" value={`NPR ${summary.outstanding_total.toLocaleString()}`} icon={AlertCircle} className="text-red-600" />
                <KpiCard title="Collection Rate" value={`${summary.collection_rate}%`} icon={TrendingUp} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

                {/* Revenue Trend */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Revenue Trend (Last 12 Months)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={revenueTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
                                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `NPR ${value}`} />
                                <ReTooltip formatter={(value) => `NPR ${value.toLocaleString()}`} />
                                <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Outstanding by Grade */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Outstanding by Grade</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={outstandingByGrade} layout="vertical" margin={{ left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="grade" type="category" width={80} tickLine={false} axisLine={false} />
                                <ReTooltip cursor={{ fill: 'transparent' }} formatter={(value) => `NPR ${value.toLocaleString()}`} />
                                <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Aging Report */}
                <Card>
                    <CardHeader>
                        <CardTitle>Invoice Aging</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {aging.map((bucket) => (
                                <div key={bucket.bucket} className="flex items-center">
                                    <div className="w-16 font-medium text-sm text-gray-500">{bucket.bucket} Days</div>
                                    <div className="flex-1 ml-4">
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-orange-500 rounded-full"
                                                style={{ width: `${(bucket.amount / (originalTotal(aging) || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="ml-4 font-mono text-sm">NPR {bucket.amount.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Unpaid */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Outstanding Balances</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {topUnpaid.map((student) => (
                                <div key={student.student_id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <div className="font-medium">{student.student_name}</div>
                                        <div className="text-xs text-gray-500">{student.identifier} • {student.grade}</div>
                                    </div>
                                    <div className="font-mono text-red-600 font-medium">
                                        NPR {student.amount.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                            {topUnpaid.length === 0 && <div className="text-center text-gray-500 py-4">No outstanding dues</div>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function KpiCard({ title, value, icon: Icon, className = "" }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${className}`}>{value}</div>
            </CardContent>
        </Card>
    );
}

function originalTotal(aging) {
    return aging.reduce((acc, curr) => acc + curr.amount, 0);
}
