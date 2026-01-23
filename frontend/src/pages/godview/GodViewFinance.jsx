import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Download,
    Building2
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

const TIER_COLORS = {
    PRO: '#8B5CF6',
    PLUS: '#3B82F6',
    BASIC: '#10B981',
    FREE_TRIAL: '#F59E0B'
};

const GodViewFinance = () => {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [revenueData, setRevenueData] = useState([]);
    const [schools, setSchools] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [overviewRes, trendRes, schoolsRes] = await Promise.all([
                api.get('/superadmin/platform-overview'),
                api.get('/superadmin/revenue-trend?months=12'),
                api.get('/superadmin/schools')
            ]);
            setOverview(overviewRes.data);
            setRevenueData(trendRes.data);
            setSchools(schoolsRes.data);
        } catch (err) {
            console.error('Failed to fetch finance data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    const formatCurrency = (amount) => {
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
        return `$${amount?.toFixed(2) || 0}`;
    };

    // Calculate tier revenue breakdown
    const tierBreakdown = schools.reduce((acc, school) => {
        const tier = school.subscription_tier || 'FREE_TRIAL';
        const tierPricing = { PRO: 25000, PLUS: 10000, BASIC: 5000, FREE_TRIAL: 0 };
        acc[tier] = (acc[tier] || 0) + (tierPricing[tier] || 0);
        return acc;
    }, {});

    const tierRevenueData = Object.entries(tierBreakdown).map(([tier, revenue]) => ({
        name: tier,
        value: revenue,
        color: TIER_COLORS[tier] || '#9CA3AF'
    }));

    const chartData = revenueData.map(item => ({
        month: item.month.split('-')[1],
        MRR: item.mrr,
        ARR: item.mrr * 12
    }));

    // Simulated monthly breakdown
    const monthlyBreakdown = [
        { month: 'Jul', newMRR: 15000, churned: 2000, expansion: 5000, net: 18000 },
        { month: 'Aug', newMRR: 20000, churned: 3000, expansion: 8000, net: 25000 },
        { month: 'Sep', newMRR: 18000, churned: 2500, expansion: 6000, net: 21500 },
        { month: 'Oct', newMRR: 25000, churned: 4000, expansion: 10000, net: 31000 },
        { month: 'Nov', newMRR: 22000, churned: 3500, expansion: 7000, net: 25500 },
        { month: 'Dec', newMRR: overview?.total_mrr * 0.3 || 0, churned: 0, expansion: 0, net: overview?.total_mrr || 0 }
    ];

    // Top revenue schools
    const topSchools = schools
        .filter(s => s.is_active && s.subscription_tier)
        .map(s => ({
            ...s,
            mrr: { PRO: 25000, PLUS: 10000, BASIC: 5000, FREE_TRIAL: 0 }[s.subscription_tier] || 0
        }))
        .sort((a, b) => b.mrr - a.mrr)
        .slice(0, 5);

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Finance Analytics</h1>
                    <p className="text-sm text-gray-500">Revenue metrics and financial insights</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Revenue Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="flex items-center gap-1 text-green-500 text-sm flex-shrink-0">
                            <ArrowUpRight className="w-4 h-4" />
                            +8.5%
                        </span>
                    </div>
                    <div className="mt-4 min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="Total ARR">Total ARR</p>
                        <p className="text-2xl font-bold text-gray-800 truncate" title={formatCurrency(overview?.total_arr)}>{formatCurrency(overview?.total_arr)}</p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="Annual Recurring Revenue">Annual Recurring Revenue</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="flex items-center gap-1 text-green-500 text-sm flex-shrink-0">
                            <ArrowUpRight className="w-4 h-4" />
                            +12%
                        </span>
                    </div>
                    <div className="mt-4 min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="Total MRR">Total MRR</p>
                        <p className="text-2xl font-bold text-gray-800 truncate" title={formatCurrency(overview?.total_mrr)}>{formatCurrency(overview?.total_mrr)}</p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="Monthly Recurring Revenue">Monthly Recurring Revenue</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                            <DollarSign className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="flex items-center gap-1 text-green-500 text-sm flex-shrink-0">
                            <ArrowUpRight className="w-4 h-4" />
                            +5%
                        </span>
                    </div>
                    <div className="mt-4 min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="Avg Revenue/School">Avg Revenue/School</p>
                        <p className="text-2xl font-bold text-gray-800 truncate" title={formatCurrency(overview?.total_mrr / (overview?.total_schools || 1))}>
                            {formatCurrency(overview?.total_mrr / (overview?.total_schools || 1))}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="Per month">Per month</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0">
                            <TrendingUp className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="flex items-center gap-1 text-green-500 text-sm flex-shrink-0">
                            <ArrowUpRight className="w-4 h-4" />
                            +1.1%
                        </span>
                    </div>
                    <div className="mt-4 min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="Net Revenue Retention">Net Revenue Retention</p>
                        <p className="text-2xl font-bold text-gray-800 truncate" title="104%">104%</p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="Expansion minus churn">Expansion minus churn</p>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* MRR Trend */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="font-semibold text-gray-800">Revenue Growth</h3>
                            <p className="text-xs text-gray-400">MRR and ARR over time</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                MRR
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                ARR
                            </span>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `$${v / 1000}k`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Line type="monotone" dataKey="MRR" stroke="#3B82F6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="ARR" stroke="#10B981" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tier Breakdown */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Revenue by Tier</h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={tierRevenueData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    dataKey="value"
                                    paddingAngle={2}
                                >
                                    {tierRevenueData.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                        {tierRevenueData.map((tier, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }}></span>
                                    {tier.name}
                                </span>
                                <span className="font-medium">{formatCurrency(tier.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* MRR Movement */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">MRR Movement</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyBreakdown}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `$${v / 1000}k`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="newMRR" name="New" fill="#10B981" stackId="a" />
                                <Bar dataKey="expansion" name="Expansion" fill="#3B82F6" stackId="a" />
                                <Bar dataKey="churned" name="Churned" fill="#EF4444" stackId="b" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Revenue Schools */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Top Revenue Schools</h3>
                    <div className="space-y-4">
                        {topSchools.map((school, i) => (
                            <div key={school.id} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                                        {i + 1}
                                    </span>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <span className="font-medium text-gray-800 truncate" title={school.name}>{school.name}</span>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="font-semibold text-gray-800">{formatCurrency(school.mrr)}/mo</p>
                                    <p className="text-xs text-gray-400">{school.subscription_tier}</p>
                                </div>
                            </div>
                        ))}
                        {topSchools.length === 0 && (
                            <p className="text-gray-400 text-center py-4">No paying schools yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GodViewFinance;
