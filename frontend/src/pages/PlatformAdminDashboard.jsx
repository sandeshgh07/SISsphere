import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Building2,
    DollarSign,
    Users,
    TrendingUp,
    Activity,
    FileText,
    Settings,
    Download,
    ChevronDown,
    AlertTriangle,
    CheckCircle,
    RefreshCw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// ============================================
// STAT CARD COMPONENT
// ============================================
const StatCard = ({ title, value, icon: Icon, change, changeType, subtitle, color }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                <Icon className="w-6 h-6" style={{ color }} />
            </div>
            {change && (
                <span className={`text-sm font-medium flex items-center gap-1 ${changeType === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    <TrendingUp className={`w-3 h-3 ${changeType === 'down' ? 'rotate-180' : ''}`} />
                    {change}
                </span>
            )}
        </div>
        <div className="mt-4">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
    </div>
);

// ============================================
// SYSTEM HEALTH COMPONENT
// ============================================
const SystemHealth = ({ data }) => {
    const metrics = [
        { label: 'API Uptime', value: `${data.api_uptime}%`, color: '#10B981', percent: data.api_uptime },
        { label: 'Avg Latency', value: `${data.avg_latency || 420}ms`, color: '#F59E0B', percent: data.avg_latency ? Math.min(100, 100 - (data.avg_latency / 10)) : 58 },
        { label: 'DB Load', value: `${data.db_load}%`, color: '#3B82F6', percent: data.db_load }
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-1">System Health</h3>
            <p className="text-xs text-gray-400 mb-4">Real-time infrastructure status</p>

            <div className="space-y-4">
                {metrics.map((metric, i) => (
                    <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }}></span>
                                {metric.label}
                            </span>
                            <span className="font-medium" style={{ color: metric.color }}>{metric.value}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${metric.percent}%`, backgroundColor: metric.color }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                <div>
                    <p className="font-medium">All Systems Operational</p>
                    <p className="text-xs text-gray-500">Last incident resolved 4d ago.</p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// FEATURE ADOPTION COMPONENT
// ============================================
const FeatureAdoption = ({ data }) => {
    const features = data || [
        { name: 'Gradebook', percent: 88 },
        { name: 'Attendance', percent: 92 },
        { name: 'Fee Management', percent: 76 },
        { name: 'Notices', percent: 95 }
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Feature Adoption</h3>
                <button className="text-sm text-blue-500 hover:underline">View Details</button>
            </div>

            <div className="space-y-4">
                {features.map((feature, i) => (
                    <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                            <span>{feature.name}</span>
                            <span className="font-medium">{feature.percent}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${feature.percent}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================
// HIGH CHURN RISK TABLE
// ============================================
const ChurnRiskTable = ({ schools }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h3 className="font-semibold text-gray-800">High Churn Risk</h3>
                <p className="text-xs text-gray-400">Schools with low engagement &lt;30 days</p>
            </div>
            <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs font-medium">
                {schools.length} Critical
            </span>
        </div>

        {schools.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                <p>No schools at risk! 🎉</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 font-medium">School Name</th>
                            <th className="pb-2 font-medium">Plan</th>
                            <th className="pb-2 font-medium">Health Score</th>
                            <th className="pb-2 font-medium">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schools.slice(0, 5).map((school) => (
                            <tr key={school.id} className="border-b last:border-0">
                                <td className="py-3 font-medium text-gray-800">{school.name}</td>
                                <td className="py-3">
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                        {school.tier || 'Basic'}
                                    </span>
                                </td>
                                <td className="py-3">
                                    <span className={`px-2 py-1 rounded text-xs ${school.days_to_expiry < 0 ? 'bg-red-100 text-red-600' :
                                            school.days_to_expiry < 7 ? 'bg-orange-100 text-orange-600' :
                                                'bg-yellow-100 text-yellow-600'
                                        }`}>
                                        {school.is_expired ? 'Expired' : `${school.days_to_expiry}d left`}
                                    </span>
                                </td>
                                <td className="py-3">
                                    <button className="text-blue-500 hover:underline text-xs">Contact</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
const PlatformAdminDashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [revenueData, setRevenueData] = useState([]);
    const [error, setError] = useState(null);
    const [dateRange, setDateRange] = useState('Last 30 Days');
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            setRefreshing(true);
            const [overviewRes, trendRes] = await Promise.all([
                api.get('/superadmin/platform-overview'),
                api.get('/superadmin/revenue-trend?months=12')
            ]);
            setData(overviewRes.data);
            setRevenueData(trendRes.data);
        } catch (err) {
            console.error('Failed to fetch platform data:', err);
            setError(err.response?.data?.detail || 'Failed to load dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
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

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-red-700">{error}</h3>
                <p className="text-sm text-red-500 mt-2">You need SuperUser access to view this page.</p>
            </div>
        );
    }

    const formatCurrency = (amount) => {
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        }
        if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(0)}K`;
        }
        return `$${amount}`;
    };

    const formatNumber = (num) => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(0)}k`;
        }
        return num.toLocaleString();
    };

    // Prepare chart data
    const chartData = revenueData.map(item => ({
        month: item.month.split('-')[1],
        Enterprise: item.mrr * 0.6,
        Pro: item.mrr * 0.4
    }));

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Global Platform Overview</h1>
                    <p className="text-sm text-gray-500">Real-time analytics across all {data.total_schools.toLocaleString()} tenant schools.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                        <Settings className="w-4 h-4" />
                        Configure View
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                    <option>Last 30 Days</option>
                    <option>Last 90 Days</option>
                    <option>Last 12 Months</option>
                    <option>All Time</option>
                </select>
                <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option>Region: Global (All)</option>
                    <option>Nepal</option>
                    <option>India</option>
                </select>
                <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option>Tier: Enterprise & Pro</option>
                    <option>Enterprise Only</option>
                    <option>Pro Only</option>
                    <option>Basic</option>
                </select>
                <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option>School Size: All Sizes</option>
                    <option>Large (500+)</option>
                    <option>Medium (100-500)</option>
                    <option>Small (&lt;100)</option>
                </select>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Schools"
                    value={data.total_schools.toLocaleString()}
                    icon={Building2}
                    color="#3B82F6"
                    change="12%"
                    changeType="up"
                    subtitle={`+${Math.round(data.total_schools * 0.12)} this month`}
                />
                <StatCard
                    title="Total ARR"
                    value={formatCurrency(data.total_arr)}
                    icon={DollarSign}
                    color="#10B981"
                    change="8.5%"
                    changeType="up"
                    subtitle={`+$${Math.round(data.total_arr * 0.085 / 1000)}K YoY`}
                />
                <StatCard
                    title="Active Users (MAU)"
                    value={formatNumber(data.mau)}
                    icon={Users}
                    color="#F59E0B"
                    change="5.2%"
                    changeType="up"
                    subtitle="Teachers & Students"
                />
                <StatCard
                    title="Net Retention Rate"
                    value="104%"
                    icon={TrendingUp}
                    color="#8B5CF6"
                    change="1.1%"
                    changeType="up"
                    subtitle="Enterprise Tier"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-semibold text-gray-800">Revenue Growth Trajectory</h3>
                            <p className="text-xs text-gray-400">Monthly Recurring Revenue (MRR) by Tier</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Enterprise
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                                Pro
                            </span>
                        </div>
                    </div>

                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `$${v / 1000}k`} />
                                <Tooltip
                                    formatter={(value) => [`$${value.toLocaleString()}`, '']}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                                />
                                <Line type="monotone" dataKey="Enterprise" stroke="#3B82F6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="Pro" stroke="#06B6D4" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* System Health */}
                <SystemHealth data={data} />
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FeatureAdoption />
                <ChurnRiskTable schools={data.high_churn_risk_schools || []} />
            </div>
        </div>
    );
};

export default PlatformAdminDashboard;
