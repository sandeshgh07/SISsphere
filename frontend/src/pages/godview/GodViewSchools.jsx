import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
    Building2,
    Users,
    TrendingUp,
    Search,
    Filter,
    ChevronDown,
    Eye,
    MoreVertical,
    Plus,
    RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const TIER_COLORS = {
    PRO: '#8B5CF6',
    PLUS: '#3B82F6',
    BASIC: '#10B981',
    FREE_TRIAL: '#F59E0B'
};

const GodViewSchools = () => {
    const [loading, setLoading] = useState(true);
    const [schools, setSchools] = useState([]);
    const [stats, setStats] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [tierFilter, setTierFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [schoolsRes, statsRes] = await Promise.all([
                api.get('/superadmin/schools'),
                api.get('/superadmin/stats')
            ]);
            setSchools(schoolsRes.data);
            setStats(statsRes.data);
        } catch (err) {
            console.error('Failed to fetch schools data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredSchools = schools.filter(school => {
        const matchesSearch = school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            school.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTier = tierFilter === 'all' || school.subscription_tier === tierFilter;
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && school.is_active) ||
            (statusFilter === 'inactive' && !school.is_active);
        return matchesSearch && matchesTier && matchesStatus;
    });

    const tierDistribution = stats?.tier_distribution ?
        Object.entries(stats.tier_distribution).map(([tier, count]) => ({
            name: tier,
            value: count,
            color: TIER_COLORS[tier] || '#9CA3AF'
        })) : [];

    const growthData = [
        { month: 'Jul', schools: 8 },
        { month: 'Aug', schools: 12 },
        { month: 'Sep', schools: 15 },
        { month: 'Oct', schools: 18 },
        { month: 'Nov', schools: 22 },
        { month: 'Dec', schools: schools.length }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Schools Management</h1>
                    <p className="text-sm text-gray-500">Manage and monitor all {schools.length} tenant schools</p>
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
                        <Plus className="w-4 h-4" />
                        Add School
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                            <Building2 className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate">Total Schools</p>
                            <p className="text-xl font-bold text-gray-800 truncate">{stats?.total_schools || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate">Active Schools</p>
                            <p className="text-xl font-bold text-gray-800 truncate">{stats?.active_schools || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                            <Users className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate">Total Users</p>
                            <p className="text-xl font-bold text-gray-800 truncate">{stats?.total_users || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0">
                            <Users className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500 truncate">Total Students</p>
                            <p className="text-xl font-bold text-gray-800 truncate">{stats?.total_students || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tier Distribution */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Subscription Tier Distribution</h3>
                    <div className="h-64 flex items-center">
                        <ResponsiveContainer width="50%" height="100%">
                            <PieChart>
                                <Pie
                                    data={tierDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    dataKey="value"
                                    paddingAngle={2}
                                >
                                    {tierDistribution.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-3">
                            {tierDistribution.map((tier, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm">
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }}></span>
                                        {tier.name}
                                    </span>
                                    <span className="font-medium text-gray-700">{tier.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Growth Trend */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">School Growth Trend</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={growthData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <Tooltip />
                                <Bar dataKey="schools" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Schools Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                {/* Filters */}
                <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search schools..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <select
                        value={tierFilter}
                        onChange={(e) => setTierFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                        <option value="all">All Tiers</option>
                        <option value="PRO">PRO</option>
                        <option value="PLUS">PLUS</option>
                        <option value="BASIC">BASIC</option>
                        <option value="FREE_TRIAL">FREE TRIAL</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">School</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Code</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Tier</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Country</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredSchools.map((school) => (
                                <tr key={school.id} className="hover:bg-gray-50">
                                    <td className="py-4 px-4 max-w-xs">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Building2 className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-800 truncate" title={school.name}>{school.name}</p>
                                                <p className="text-xs text-gray-400 truncate">{school.type || 'School'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-600">{school.code || school.slug}</td>
                                    <td className="py-4 px-4">
                                        <span
                                            className="px-2 py-1 rounded text-xs font-medium"
                                            style={{
                                                backgroundColor: `${TIER_COLORS[school.subscription_tier] || '#9CA3AF'}20`,
                                                color: TIER_COLORS[school.subscription_tier] || '#6B7280'
                                            }}
                                        >
                                            {school.subscription_tier || 'FREE_TRIAL'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${school.is_active
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {school.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-sm text-gray-600">{school.country || 'Nepal'}</td>
                                    <td className="py-4 px-4 text-right">
                                        <button className="p-2 hover:bg-gray-100 rounded-lg">
                                            <Eye className="w-4 h-4 text-gray-500" />
                                        </button>
                                        <button className="p-2 hover:bg-gray-100 rounded-lg">
                                            <MoreVertical className="w-4 h-4 text-gray-500" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredSchools.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No schools found matching your criteria</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GodViewSchools;
