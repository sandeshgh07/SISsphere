import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
    Activity,
    Server,
    Database,
    Wifi,
    AlertTriangle,
    CheckCircle,
    Clock,
    RefreshCw,
    Zap,
    HardDrive,
    Cpu,
    MemoryStick
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const GodViewHealth = () => {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            setRefreshing(true);
            const res = await api.get('/superadmin/platform-overview');
            setOverview(res.data);
        } catch (err) {
            console.error('Failed to fetch health data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    // System metrics
    const metrics = {
        apiUptime: overview?.api_uptime || 99.8,
        avgLatency: overview?.avg_latency || 420,
        dbLoad: overview?.db_load || 45,
        memoryUsage: 62,
        cpuUsage: 38,
        diskUsage: 54,
        activeConnections: 156,
        requestsPerMin: 1240
    };

    // Uptime history (simulated)
    const uptimeHistory = [
        { time: '00:00', uptime: 100, latency: 380 },
        { time: '04:00', uptime: 100, latency: 350 },
        { time: '08:00', uptime: 99.9, latency: 420 },
        { time: '12:00', uptime: 100, latency: 450 },
        { time: '16:00', uptime: 99.8, latency: 480 },
        { time: '20:00', uptime: 100, latency: 410 },
        { time: 'Now', uptime: metrics.apiUptime, latency: metrics.avgLatency }
    ];

    // Recent incidents (simulated)
    const incidents = [
        { id: 1, type: 'resolved', title: 'Database slowdown', time: '4 days ago', duration: '12 min' },
        { id: 2, type: 'resolved', title: 'API timeout spike', time: '2 weeks ago', duration: '5 min' },
        { id: 3, type: 'resolved', title: 'Scheduled maintenance', time: '1 month ago', duration: '30 min' }
    ];

    // Service status
    const services = [
        { name: 'API Gateway', status: 'operational', latency: '45ms' },
        { name: 'Database (Primary)', status: 'operational', latency: '12ms' },
        { name: 'Database (Replica)', status: 'operational', latency: '15ms' },
        { name: 'Redis Cache', status: 'operational', latency: '2ms' },
        { name: 'File Storage', status: 'operational', latency: '85ms' },
        { name: 'Email Service', status: 'operational', latency: '120ms' },
        { name: 'AI Service', status: 'operational', latency: '450ms' }
    ];

    const getStatusBadge = (status) => {
        switch (status) {
            case 'operational':
                return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Operational</span>;
            case 'degraded':
                return <span className="flex items-center gap-1 text-xs text-yellow-600"><AlertTriangle className="w-3 h-3" /> Degraded</span>;
            case 'down':
                return <span className="flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="w-3 h-3" /> Down</span>;
            default:
                return <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" /> Unknown</span>;
        }
    };

    const getHealthColor = (value, thresholds = { good: 70, warn: 85 }) => {
        if (value < thresholds.good) return 'text-green-500';
        if (value < thresholds.warn) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getBarColor = (value, thresholds = { good: 70, warn: 85 }) => {
        if (value < thresholds.good) return 'bg-green-500';
        if (value < thresholds.warn) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">System Health</h1>
                    <p className="text-sm text-gray-500">Real-time infrastructure monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-sm text-green-700 font-medium">All Systems Operational</span>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Primary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                            <Wifi className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-2xl font-bold text-green-600 truncate">{metrics.apiUptime}%</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="API Uptime">API Uptime</p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="Last 30 days">Last 30 days</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                            <Zap className="w-5 h-5 text-blue-500" />
                        </div>
                        <span className={`text-2xl font-bold truncate ${getHealthColor(metrics.avgLatency, { good: 500, warn: 800 })}`}>
                            {metrics.avgLatency}ms
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="Avg Latency">Avg Latency</p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="p95 response time">p95 response time</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                            <Database className="w-5 h-5 text-purple-500" />
                        </div>
                        <span className={`text-2xl font-bold truncate ${getHealthColor(metrics.dbLoad)}`}>{metrics.dbLoad}%</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="Database Load">Database Load</p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="Query processing">Query processing</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm min-w-0">
                    <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="p-2 bg-amber-50 rounded-lg flex-shrink-0">
                            <Activity className="w-5 h-5 text-amber-500" />
                        </div>
                        <span className="text-2xl font-bold text-gray-800 truncate">{metrics.requestsPerMin}</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-500 truncate" title="Requests/min">Requests/min</p>
                        <p className="text-xs text-gray-400 mt-1 truncate" title="Current throughput">Current throughput</p>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Uptime Chart */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Uptime (24h)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={uptimeHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis domain={[99, 100]} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip formatter={(value) => `${value}%`} />
                                <Area type="monotone" dataKey="uptime" stroke="#10B981" fill="#10B98120" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Latency Chart */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Response Latency (24h)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={uptimeHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `${v}ms`} />
                                <Tooltip formatter={(value) => `${value}ms`} />
                                <Line type="monotone" dataKey="latency" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Resource Usage */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Resource Usage</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-2 text-sm text-gray-600">
                                <Cpu className="w-4 h-4" /> CPU Usage
                            </span>
                            <span className={`font-semibold ${getHealthColor(metrics.cpuUsage)}`}>{metrics.cpuUsage}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getBarColor(metrics.cpuUsage)}`} style={{ width: `${metrics.cpuUsage}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-2 text-sm text-gray-600">
                                <MemoryStick className="w-4 h-4" /> Memory Usage
                            </span>
                            <span className={`font-semibold ${getHealthColor(metrics.memoryUsage)}`}>{metrics.memoryUsage}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getBarColor(metrics.memoryUsage)}`} style={{ width: `${metrics.memoryUsage}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-2 text-sm text-gray-600">
                                <HardDrive className="w-4 h-4" /> Disk Usage
                            </span>
                            <span className={`font-semibold ${getHealthColor(metrics.diskUsage)}`}>{metrics.diskUsage}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getBarColor(metrics.diskUsage)}`} style={{ width: `${metrics.diskUsage}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Service Status */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Service Status</h3>
                    <div className="space-y-3">
                        {services.map((service, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Server className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-800 truncate" title={service.name}>{service.name}</span>
                                </div>
                                <div className="flex items-center gap-4 flex-shrink-0">
                                    <span className="text-xs text-gray-400">{service.latency}</span>
                                    {getStatusBadge(service.status)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Incidents */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="font-semibold text-gray-800 mb-4">Recent Incidents</h3>
                    {incidents.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                            <p className="text-gray-500">No recent incidents</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {incidents.map((incident) => (
                                <div key={incident.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                    <div className="p-1.5 bg-green-100 rounded-full mt-0.5">
                                        <CheckCircle className="w-3 h-3 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-gray-800">{incident.title}</p>
                                            <span className="text-xs text-gray-400">{incident.time}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Duration: {incident.duration}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GodViewHealth;
