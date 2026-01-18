import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const RevenueVelocityChart = ({ data }) => {
    if (!data || data.length === 0) return null;

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-[#003333]">Revenue Velocity (30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(val) => new Date(val).getDate()}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                            formatter={(value, name) => [value.toLocaleString(), name === 'amount' ? 'Daily Collection' : 'Target Trend']}
                        />
                        <Legend />
                        <Bar dataKey="amount" fill="#003333" barSize={20} radius={[4, 4, 0, 0]} name="Daily Collection" />
                        <Line type="monotone" dataKey="cumulative_target" stroke="#10b981" strokeWidth={3} dot={false} name="Target Line" />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default RevenueVelocityChart;
