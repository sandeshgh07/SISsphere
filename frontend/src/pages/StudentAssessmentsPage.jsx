
import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, BookOpen, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StudentAssessmentsPage = () => {
    const [upcoming, setUpcoming] = useState([]);
    const [past, setPast] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAssessments = async () => {
            try {
                const [upRes, pastRes] = await Promise.all([
                    api.get('/academics/assessments/student/me?range=upcoming'),
                    api.get('/academics/assessments/student/me?range=past')
                ]);
                setUpcoming(upRes.data);
                setPast(pastRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAssessments();
    }, []);

    const AssessmentCard = ({ item }) => (
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
            <CardContent className="p-5">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                {item.subject_name}
                            </Badge>
                            {item.max_marks && <span className="text-xs text-gray-500 font-medium">{item.max_marks} Marks</span>}
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">{item.title}</h3>
                        {item.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>}
                    </div>
                    <div className="text-right">
                        <div className="flex flex-col items-end gap-1 text-sm">
                            <span className="flex items-center gap-1.5 text-gray-600 font-medium">
                                <Calendar size={14} />
                                {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No Date'}
                            </span>
                            {item.due_date && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <Clock size={12} />
                                    {new Date(item.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Loading assessments...</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="text-blue-600" /> Assessments
            </h1>

            <Tabs defaultValue="upcoming" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
                    <TabsTrigger value="past">Past</TabsTrigger>
                </TabsList>

                <TabsContent value="upcoming" className="mt-6 space-y-4">
                    {upcoming.length > 0 ? (
                        upcoming.map(item => <AssessmentCard key={item.id} item={item} />)
                    ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
                            <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No upcoming assessments</p>
                            <p className="text-sm text-gray-400">You're all caught up!</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="past" className="mt-6 space-y-4">
                    {past.length > 0 ? (
                        past.map(item => <AssessmentCard key={item.id} item={item} />)
                    ) : (
                        <p className="text-center text-gray-500 py-8">No past assessments found.</p>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

// Helper icon
const CheckCircle = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
)

export default StudentAssessmentsPage;
