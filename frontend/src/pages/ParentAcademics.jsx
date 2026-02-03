import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, GraduationCap, ClipboardList } from 'lucide-react';
import { AttendanceGauge, AcademicGraph } from '@/components/dashboard/DashboardWidgets';

const ParentAcademics = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [searchParams] = useSearchParams();
    const childId = searchParams.get('child_id');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get('/parents/me/academics/summary');
                setData(res.data);
            } catch (error) {
                console.error("Failed to fetch academics:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    const filteredData = childId ? data.filter(s => s.student_id === childId) : data;

    if (filteredData.length === 0) {
        return <div className="p-8 text-center text-gray-500">No academic records found.</div>;
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <GraduationCap className="text-sissphere-primary" />
                Academic Overview
            </h2>

            {filteredData.map(student => (
                <div key={student.student_id} className="space-y-6">
                    <div className="flex items-center gap-4 border-b pb-2">
                        {/* Optional: Student Avatar if available in future, for now Name */}
                        <h3 className="text-xl font-semibold text-gray-800">{student.student_name}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Attendance Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base text-gray-600">Attendance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AttendanceGauge
                                    percentage={student.attendance.percentage}
                                    presentDays={student.attendance.present}
                                    totalDays={(student.attendance.present + student.attendance.absent + student.attendance.late)}
                                />
                            </CardContent>
                        </Card>

                        {/* Recent Grades List */}
                        <Card className="col-span-1 md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-base text-gray-600">Recent Grades</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {student.recent_grades && student.recent_grades.length > 0 ? (
                                    <div className="space-y-3">
                                        {/* Placeholder loop until backend returns real recent grades structure */}
                                        {student.recent_grades.map((grade, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                                <span className="font-medium">{grade.subject_name || "Subject"}</span>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm text-gray-500">{new Date(grade.date).toLocaleDateString()}</span>
                                                    <span className="font-bold text-sissphere-primary">{grade.marks_obtained}/{grade.max_marks}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                        <ClipboardList size={32} className="mb-2 opacity-20" />
                                        <p>No recent grades published.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ParentAcademics;
