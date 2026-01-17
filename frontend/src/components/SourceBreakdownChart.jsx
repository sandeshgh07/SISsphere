import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const SourceBreakdownChart = ({ data }) => {
    if (!data) return null;

    const chartData = [
        { name: 'Office Cash', value: data.OFFICE_CASH || 0 },
        { name: 'Remote / Digital', value: data.REMOTE || 0 },
    ];

    const COLORS = ['#003333', '#10b981']; // Dark Green (Brand) and Light Green

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-[#003333]">Payment Source</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default SourceBreakdownChart;
