import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Clock,
    Building2,
    RefreshCw,
    Mail,
    Phone,
    Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const GodViewRetention = () => {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [schools, setSchools] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [overviewRes, schoolsRes] = await Promise.all([
                api.get('/superadmin/platform-overview'),
                api.get('/superadmin/schools')
            ]);
            setOverview(overviewRes.data);
            setSchools(schoolsRes.data);
        } catch (err) {
            console.error('Failed to fetch retention data:', err);
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

    // Calculate churn risk schools from real data
    const now = new Date();
    const churnRiskSchools = schools
        .filter(s => {
            if (!s.subscription_expiry) return false;
            const expiry = new Date(s.subscription_expiry);
            const daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            return daysToExpiry < 30;
        })
        .map(s => {
            const expiry = new Date(s.subscription_expiry);
            const daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            return {
                ...s,
                daysToExpiry,
                isExpired: daysToExpiry < 0,
                riskLevel: daysToExpiry < 0 ? 'critical' : daysToExpiry < 7 ? 'high' : 'medium'
            };
        })
        .sort((a, b) => a.daysToExpiry - b.daysToExpiry);

    const criticalCount = churnRiskSchools.filter(s => s.riskLevel === 'critical').length;
    const highRiskCount = churnRiskSchools.filter(s => s.riskLevel === 'high').length;
    const mediumRiskCount = churnRiskSchools.filter(s => s.riskLevel === 'medium').length;

    // Simulated retention data
    const retentionTrend = [
        { month: 'Jul', retention: 95.2, churn: 4.8 },
        { month: 'Aug', retention: 96.1, churn: 3.9 },
        { month: 'Sep', retention: 94.8, churn: 5.2 },
        { month: 'Oct', retention: 97.2, churn: 2.8 },
        { month: 'Nov', retention: 96.5, churn: 3.5 },
        { month: 'Dec', retention: 98.0, churn: 2.0 }
    ];

    const cohortData = [
        { cohort: 'Jan 2024', m1: 100, m3: 92, m6: 85, m12: 78 },
        { cohort: 'Apr 2024', m1: 100, m3: 94, m6: 88, m12: null },
        { cohort: 'Jul 2024', m1: 100, m3: 95, m6: null, m12: null },
        { cohort: 'Oct 2024', m1: 100, m3: null, m6: null, m12: null }
    ];

    const getRiskBadge = (level) => {
        switch (level) {
            case 'critical':
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Critical</span>;
            case 'high':
                return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">High</span>;
            case 'medium':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Medium</span>;
            default:
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Low</span>;
        }
    };

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Retention & Churn</h1>
                    <p className="text-sm text-gray-500">Monitor subscription health and identify at-risk schools</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Risk Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="Net Retention Rate">Net Retention Rate</p>
                            <p className="text-xl font-bold text-gray-800 truncate" title="104%">104%</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="Critical Risk">Critical Risk</p>
                            <p className="text-xl font-bold text-red-600 truncate" title={criticalCount}>{criticalCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-lg flex-shrink-0">
                            <Clock className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="High Risk">High Risk</p>
                            <p className="text-xl font-bold text-orange-600 truncate" title={highRiskCount}>{highRiskCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-50 rounded-lg flex-shrink-0">
                            <TrendingDown className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="Medium Risk">Medium Risk</p>
                            <p className="text-xl font-bold text-yellow-600 truncate" title={mediumRiskCount}>{mediumRiskCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Retention Trend */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Retention Rate Trend</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={retentionTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis domain={[90, 100]} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip formatter={(value) => `${value}%`} />
                                <Area type="monotone" dataKey="retention" stroke="#10B981" fill="#10B98120" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Churn Rate */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Monthly Churn Rate</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={retentionTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip formatter={(value) => `${value}%`} />
                                <Line type="monotone" dataKey="churn" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Cohort Analysis */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Cohort Retention Analysis</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left border-b">
                                <th className="py-3 px-4 font-medium text-gray-500">Cohort</th>
                                <th className="py-3 px-4 font-medium text-gray-500 text-center">Month 1</th>
                                <th className="py-3 px-4 font-medium text-gray-500 text-center">Month 3</th>
                                <th className="py-3 px-4 font-medium text-gray-500 text-center">Month 6</th>
                                <th className="py-3 px-4 font-medium text-gray-500 text-center">Month 12</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cohortData.map((row, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="py-3 px-4 font-medium text-gray-800">{row.cohort}</td>
                                    {['m1', 'm3', 'm6', 'm12'].map((col) => (
                                        <td key={col} className="py-3 px-4 text-center">
                                            {row[col] !== null ? (
                                                <span className={`px-3 py-1 rounded ${row[col] >= 90 ? 'bg-green-100 text-green-700' :
                                                    row[col] >= 80 ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {row[col]}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* At-Risk Schools Table */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-semibold text-gray-800">At-Risk Schools</h3>
                        <p className="text-xs text-gray-400">Schools with subscriptions expiring within 30 days</p>
                    </div>
                    <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-medium">
                        {churnRiskSchools.length} Total
                    </span>
                </div>

                {churnRiskSchools.length === 0 ? (
                    <div className="text-center py-12">
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <h4 className="font-medium text-gray-800">All Schools Healthy!</h4>
                        <p className="text-gray-500 text-sm">No schools at risk of churning</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b bg-gray-50">
                                    <th className="py-3 px-4 font-medium text-gray-500">School</th>
                                    <th className="py-3 px-4 font-medium text-gray-500">Tier</th>
                                    <th className="py-3 px-4 font-medium text-gray-500">Risk Level</th>
                                    <th className="py-3 px-4 font-medium text-gray-500">Expiry</th>
                                    <th className="py-3 px-4 font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {churnRiskSchools.map((school) => (
                                    <tr key={school.id} className="hover:bg-gray-50">
                                        <td className="py-4 px-4 max-w-xs">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0">
                                                    <Building2 className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-800 truncate" title={school.name}>{school.name}</p>
                                                    <p className="text-xs text-gray-400 truncate">{school.country || 'Nepal'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                                {school.subscription_tier || 'BASIC'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">{getRiskBadge(school.riskLevel)}</td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                <span className={school.isExpired ? 'text-red-600 font-medium' : ''}>
                                                    {school.isExpired ? 'Expired' : `${school.daysToExpiry} days left`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                <button className="p-2 hover:bg-blue-50 rounded-lg text-blue-500" title="Send Email">
                                                    <Mail className="w-4 h-4" />
                                                </button>
                                                <button className="p-2 hover:bg-green-50 rounded-lg text-green-500" title="Call">
                                                    <Phone className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GodViewRetention;
