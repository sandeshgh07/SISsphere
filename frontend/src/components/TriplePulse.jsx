import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';

const TriplePulse = ({ data }) => {
    if (!data) return null;

    const formatCurrency = (val) => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR' }).format(val);

    const change = data.percent_change;
    const isUp = change >= 0;

    return (
        <Card className="bg-white border-none shadow-sm">
            <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-4 divide-x divide-gray-200">
                    <div className="text-center px-4">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Today</p>
                        <p className="text-3xl font-bold text-[#003333]">{formatCurrency(data.today)}</p>
                        <div className={`flex items-center justify-center mt-2 text-sm font-bold ${isUp ? 'text-green-600' : 'text-[#5C2438]'}`}>
                            {isUp ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                            <span className="ml-1">{Math.abs(change)}%</span>
                        </div>
                    </div>
                    <div className="text-center px-4">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Yesterday</p>
                        <p className="text-2xl font-bold text-gray-700">{formatCurrency(data.yesterday)}</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Day Before</p>
                        <p className="text-2xl font-bold text-gray-400">{formatCurrency(data.day_minus_2)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TriplePulse;
