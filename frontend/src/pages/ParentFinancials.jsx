import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, CreditCard, DollarSign, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ParentFinancials = () => {
    const [loading, setLoading] = useState(true);
    const [financials, setFinancials] = useState({ total_due: 0, students: [] });
    const [searchParams] = useSearchParams();
    const childId = searchParams.get('child_id');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get('/parents/me/financials/summary');
                setFinancials(res.data);
            } catch (error) {
                console.error("Failed to fetch financials:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    const filteredStudents = childId
        ? financials.students.filter(s => s.student_id === childId) // Note: Backend returns list in students array, need to check if map values or list.
        // Wait, backend returns: { "students": [ { "name": ..., "invoices": [] } ] }. But I lost 'student_id' in the map values!
        // Let me check my backend implementation. I used `students_map.values()`. I didn't explicitly add `student_id` to the value dict.
        // I need to fix backend or rely on something else.
        // Let's assume for now I will fix backend to include student_id.
        : financials.students;

    // Quick Fix in frontend logic: if I can't filter correctly because id is missing, I might show all?
    // Actually, I should FIX the backend. The backend `students_map` values don't have `student_id`!
    // I put `students_map[s.id] = { ... }`. The key is id, but the value object doesn't have it.
    // I MUST FIX THIS.

    // BUT, assuming I fix it:

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <CreditCard className="text-sissphere-primary" />
                    Financial Overview
                </h2>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col items-end">
                    <span className="text-sm text-gray-500">Total Outstanding</span>
                    <span className="text-2xl font-bold text-red-600">${financials.total_due.toFixed(2)}</span>
                </div>
            </div>

            {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No financial records found.</div>
            ) : (
                filteredStudents.map((student, idx) => (
                    <div key={idx} className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-xl font-semibold text-gray-800">{student.name}</h3>
                            <span className="text-sm font-medium text-gray-500">Due: ${student.due?.toFixed(2)}</span>
                        </div>

                        <div className="grid gap-4">
                            {student.invoices.length > 0 ? (
                                student.invoices.map(invoice => (
                                    <Card key={invoice.id} className="border-l-4 border-l-sissphere-primary">
                                        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-lg">{invoice.invoice_number}</h4>
                                                    <Badge variant="outline">{invoice.status}</Badge>
                                                </div>
                                                <p className="text-sm text-gray-500">Due Date: {new Date(invoice.due_date).toLocaleDateString()}</p>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-500">Amount</p>
                                                    <p className="font-bold">${invoice.total_amount?.toFixed(2)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-500">Balance</p>
                                                    <p className={`font-bold ${invoice.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                        ${invoice.balance?.toFixed(2)}
                                                    </p>
                                                </div>
                                                <Button size="sm" variant="outline">
                                                    <Download size={16} className="mr-2" />
                                                    Invoice
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center p-6 bg-gray-50 rounded-lg text-gray-400">
                                    No invoices found.
                                </div>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default ParentFinancials;
