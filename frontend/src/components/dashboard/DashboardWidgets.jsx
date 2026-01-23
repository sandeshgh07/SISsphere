import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Wallet, GraduationCap, Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export const StatCard = ({ title, value, subtext, trend, icon: Icon, colorClass = "text-nepsis-primary" }) => {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                        <h3 className="text-2xl font-bold">{value}</h3>
                        <p className="text-xs text-gray-400 mt-1">{subtext}</p>
                    </div>
                    <div className={`p-3 rounded-full bg-gray-50 ${colorClass}`}>
                        {Icon && <Icon size={20} />}
                    </div>
                </div>
                {trend && (
                    <div className="mt-4 flex items-center gap-2">
                        {trend === 'UP' && <TrendingUp size={16} className="text-green-500" />}
                        {trend === 'DOWN' && <TrendingDown size={16} className="text-red-500" />}
                        {trend === 'STABLE' && <Minus size={16} className="text-gray-400" />}
                        <span className={`text-xs font-medium ${trend === 'UP' ? 'text-green-600' : trend === 'DOWN' ? 'text-red-500' : 'text-gray-500'}`}>
                            {trend === 'UP' ? 'Trending Up' : trend === 'DOWN' ? 'Needs Attention' : 'Stable'}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export const AcademicGraph = ({ data }) => {
    // Mock data if empty
    const graphData = data && data.length > 0 ? data : [
        { name: 'Aug', score: 65 },
        { name: 'Sep', score: 72 },
        { name: 'Oct', score: 85 },
        { name: 'Nov', score: 82 },
        { name: 'Dec', score: 88 },
        { name: 'Jan', score: 92 },
    ];

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-lg">Academic Progress</CardTitle>
                    <p className="text-sm text-gray-500">Performance across key subjects over last 6 months</p>
                </div>
                <SelectPeriod />
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={graphData}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                domain={[0, 100]}
                                ticks={[0, 20, 40, 60, 80, 100]}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#2563EB"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#colorScore)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

const SelectPeriod = () => (
    <select className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white outline-none focus:border-nepsis-primary">
        <option>Semester 1</option>
        <option>Semester 2</option>
    </select>
);

export const FeesCard = ({ amount, status, dueDate }) => {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Fees Status</p>
                        <h3 className="text-2xl font-bold mt-1">${amount || "0.00"}</h3>
                        <p className="text-xs text-gray-400 mt-1">Due {dueDate || "N/A"}</p>
                    </div>
                    <Badge variant={status === 'OVERDUE' ? 'destructive' : status === 'PENDING' ? 'secondary' : 'default'}
                        className={`${status === 'PENDING' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : ''} h-fit`}>
                        {status || 'PAID'}
                    </Badge>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">Pay Now</Button>
            </CardContent>
        </Card>
    );
};

export const AttendanceGauge = ({ percentage, presentDays, totalDays }) => {
    const radius = 30;
    const stroke = 8;
    const normalizedRadius = radius - stroke * 0.5;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
                <svg height={radius * 2} width={radius * 2} className="transform -rotate-90 scale-150">
                    <circle
                        stroke="#E5E7EB"
                        strokeWidth={stroke}
                        fill="transparent"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                    <circle
                        stroke="#2563EB"
                        strokeWidth={stroke}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset }}
                        strokeLinecap="round"
                        fill="transparent"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                </svg>
                <div className="absolute flex flex-col items-center text-center">
                    <span className="text-2xl font-bold">{percentage}%</span>
                    <span className="text-[10px] text-gray-500 uppercase">Present</span>
                </div>
            </div>
            <div className="mt-4 w-full space-y-2">
                <div className="flex items-center text-xs justify-between w-full px-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        <span>Present</span>
                    </div>
                    <span className="font-medium">({presentDays})</span>
                </div>
                <div className="flex items-center text-xs justify-between w-full px-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                        <span>Absent</span>
                    </div>
                    <span className="font-medium">({totalDays - presentDays})</span>
                </div>
            </div>
        </div>
    );
};
