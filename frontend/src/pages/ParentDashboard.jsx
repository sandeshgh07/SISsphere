import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ParentDashboard = () => {
    const { token } = useAuth();
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/parent/dashboard/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSummaries(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [token]);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

    const renderTrend = (trend) => {
        if (trend === "UP") return <TrendingUp className="text-green-500" />;
        if (trend === "DOWN") return <TrendingDown className="text-red-500" />;
        return <Minus className="text-gray-500" />;
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-[#003333]">Parent Trust Dashboard</h2>

            {summaries.map(student => (
                <Card key={student.student_id} className="border-t-4 border-t-[#003333]">
                    <CardHeader>
                        <CardTitle>{student.student_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 rounded text-center">
                                <div className="text-sm text-gray-500">Attendance</div>
                                <div className={`text-xl font-bold ${student.attendance_percentage < 75 ? 'text-[#5C2438]' : 'text-green-600'}`}>
                                    {student.attendance_percentage}%
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded text-center">
                                <div className="text-sm text-gray-500">Academic Trend</div>
                                <div className="flex justify-center mt-1">{renderTrend(student.academic_trend)}</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded text-center">
                                <div className="text-sm text-gray-500">Fee Status</div>
                                <div className="mt-1 flex justify-center">
                                    {student.fee_status === "OVERDUE" ?
                                        <Badge variant="destructive" className="bg-[#5C2438]">Overdue</Badge> :
                                        student.fee_status === "PENDING" ? <Badge variant="secondary">Pending</Badge> : <Badge className="bg-green-600">Paid</Badge>
                                    }
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded text-center">
                                <div className="text-sm text-gray-500">Active Notices</div>
                                <div className="text-xl font-bold">{student.active_notices}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {summaries.length === 0 && <div className="text-gray-500">No students linked.</div>}
        </div>
    );
};

export default ParentDashboard;
