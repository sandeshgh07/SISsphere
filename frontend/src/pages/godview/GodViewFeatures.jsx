import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
    BarChart3,
    TrendingUp,
    Users,
    CheckCircle,
    AlertCircle,
    RefreshCw,
    BookOpen,
    Calendar,
    DollarSign,
    Bell,
    MessageSquare,
    Cpu
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend } from 'recharts';

const GodViewFeatures = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [schools, setSchools] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, schoolsRes] = await Promise.all([
                api.get('/superadmin/stats'),
                api.get('/superadmin/schools')
            ]);
            setStats(statsRes.data);
            setSchools(schoolsRes.data);
        } catch (err) {
            console.error('Failed to fetch feature data:', err);
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

    // Core features with adoption rates (simulated based on tier access)
    const features = [
        {
            name: 'Gradebook',
            icon: BookOpen,
            adoption: 88,
            trend: '+5%',
            trendUp: true,
            description: 'Grade management & report cards',
            tier: 'All Tiers'
        },
        {
            name: 'Attendance',
            icon: Calendar,
            adoption: 92,
            trend: '+3%',
            trendUp: true,
            description: 'Daily attendance tracking',
            tier: 'All Tiers'
        },
        {
            name: 'Fee Management',
            icon: DollarSign,
            adoption: 76,
            trend: '+8%',
            trendUp: true,
            description: 'Invoice & payment tracking',
            tier: 'BASIC+'
        },
        {
            name: 'Notices',
            icon: Bell,
            adoption: 95,
            trend: '+2%',
            trendUp: true,
            description: 'School announcements',
            tier: 'All Tiers'
        },
        {
            name: 'AI Chatbot',
            icon: Cpu,
            adoption: 45,
            trend: '+12%',
            trendUp: true,
            description: 'AI-powered assistance',
            tier: 'PLUS+'
        },
        {
            name: 'Complaints',
            icon: MessageSquare,
            adoption: 68,
            trend: '+4%',
            trendUp: true,
            description: 'Issue tracking system',
            tier: 'BASIC+'
        }
    ];

    // Feature adoption by tier
    const tierAdoption = [
        { tier: 'PRO', gradebook: 95, attendance: 98, fees: 90, notices: 100, ai: 85, overall: 94 },
        { tier: 'PLUS', gradebook: 88, attendance: 92, fees: 78, notices: 95, ai: 55, overall: 82 },
        { tier: 'BASIC', gradebook: 82, attendance: 88, fees: 65, notices: 90, ai: 0, overall: 65 },
        { tier: 'FREE_TRIAL', gradebook: 60, attendance: 70, fees: 40, notices: 75, ai: 0, overall: 49 }
    ];

    // Usage trends (simulated)
    const usageTrends = [
        { month: 'Jul', gradebook: 75, attendance: 80, fees: 60 },
        { month: 'Aug', gradebook: 78, attendance: 82, fees: 65 },
        { month: 'Sep', gradebook: 82, attendance: 85, fees: 70 },
        { month: 'Oct', gradebook: 85, attendance: 88, fees: 72 },
        { month: 'Nov', gradebook: 86, attendance: 90, fees: 74 },
        { month: 'Dec', gradebook: 88, attendance: 92, fees: 76 }
    ];

    // Radial chart data
    const radialData = features.map((f, i) => ({
        name: f.name,
        value: f.adoption,
        fill: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'][i]
    }));

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Feature Adoption</h1>
                    <p className="text-sm text-gray-500">Track feature usage across all tenant schools</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                            <BarChart3 className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="Avg Adoption Rate">Avg Adoption Rate</p>
                            <p className="text-xl font-bold text-gray-800 truncate" title="78%">78%</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="Top Feature">Top Feature</p>
                            <p className="text-xl font-bold text-gray-800 truncate" title="Notices (95%)">Notices (95%)</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="Needs Attention">Needs Attention</p>
                            <p className="text-xl font-bold text-gray-800 truncate" title="AI Chatbot (45%)">AI Chatbot (45%)</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                            <TrendingUp className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate" title="Fastest Growing">Fastest Growing</p>
                            <p className="text-xl font-bold text-gray-800 truncate" title="AI (+12%)">AI (+12%)</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map((feature, i) => (
                    <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${feature.adoption >= 80 ? 'bg-green-50' :
                                    feature.adoption >= 60 ? 'bg-blue-50' :
                                        'bg-amber-50'
                                    }`}>
                                    <feature.icon className={`w-5 h-5 ${feature.adoption >= 80 ? 'text-green-500' :
                                        feature.adoption >= 60 ? 'text-blue-500' :
                                            'text-amber-500'
                                        }`} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-800">{feature.name}</h4>
                                    <p className="text-xs text-gray-400">{feature.description}</p>
                                </div>
                            </div>
                            <span className={`text-xs font-medium ${feature.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                                {feature.trend}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Adoption Rate</span>
                                <span className="font-semibold">{feature.adoption}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${feature.adoption >= 80 ? 'bg-green-500' :
                                        feature.adoption >= 60 ? 'bg-blue-500' :
                                            'bg-amber-500'
                                        }`}
                                    style={{ width: `${feature.adoption}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400">Available: {feature.tier}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usage Trends */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Adoption Trends Over Time</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usageTrends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip formatter={(value) => `${value}%`} />
                                <Legend />
                                <Bar dataKey="gradebook" name="Gradebook" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="attendance" name="Attendance" fill="#10B981" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="fees" name="Fees" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Radial Chart */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Feature Adoption Overview</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%"
                                cy="50%"
                                innerRadius="20%"
                                outerRadius="90%"
                                data={radialData}
                                startAngle={180}
                                endAngle={0}
                            >
                                <RadialBar dataKey="value" cornerRadius={5} />
                                <Legend
                                    iconSize={10}
                                    layout="horizontal"
                                    verticalAlign="bottom"
                                    formatter={(value) => <span className="text-xs">{value}</span>}
                                />
                                <Tooltip formatter={(value) => `${value}%`} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tier Comparison */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Adoption by Subscription Tier</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-gray-50">
                                <th className="py-3 px-4 text-left font-medium text-gray-500">Tier</th>
                                <th className="py-3 px-4 text-center font-medium text-gray-500">Gradebook</th>
                                <th className="py-3 px-4 text-center font-medium text-gray-500">Attendance</th>
                                <th className="py-3 px-4 text-center font-medium text-gray-500">Fees</th>
                                <th className="py-3 px-4 text-center font-medium text-gray-500">Notices</th>
                                <th className="py-3 px-4 text-center font-medium text-gray-500">AI</th>
                                <th className="py-3 px-4 text-center font-medium text-gray-500">Overall</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {tierAdoption.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 font-medium text-gray-800">{row.tier}</td>
                                    {['gradebook', 'attendance', 'fees', 'notices', 'ai', 'overall'].map((col) => (
                                        <td key={col} className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${row[col] >= 80 ? 'bg-green-100 text-green-700' :
                                                row[col] >= 50 ? 'bg-blue-100 text-blue-700' :
                                                    row[col] > 0 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-gray-100 text-gray-400'
                                                }`}>
                                                {row[col] > 0 ? `${row[col]}%` : 'N/A'}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GodViewFeatures;
