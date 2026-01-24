
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, AlertTriangle, FileText, Activity, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';

const Student360Profile = () => {
    const { studentId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch360Data();
    }, [studentId]);

    const fetch360Data = async () => {
        try {
            const res = await api.get(`/students/${studentId}/overview_360`);
            setData(res.data);
        } catch (err) {
            toast.error("Failed to load Student 360 Profile");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadReport = async () => {
        try {
            const res = await api.get(`/students/${studentId}/report.pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `student_report_${data.student.roll_no}.pdf`);
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            toast.error("Failed to download report");
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!data) return <div className="p-8">Student not found or access denied.</div>;

    const { student, guardians, attendance, risk, incidents_summary, fees_summary, documents } = data;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold">
                        {student.photo_url ? <img src={student.photo_url} className="w-full h-full rounded-full" /> : student.name[0]}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
                        <p className="text-gray-500">
                            Grade: {student.grade} • Section: {student.section} • Roll: {student.roll_no}
                        </p>
                    </div>
                </div>
                <Button onClick={handleDownloadReport} className="gap-2">
                    <Download size={16} /> Export PDF
                </Button>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-white border rounded-lg p-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="behavior">Behavior & Incidents</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                    {fees_summary && <TabsTrigger value="fees">Financials</TabsTrigger>}
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Risk Card */}
                        <Card className={`border-l-4 ${risk.level === 'HIGH' ? 'border-red-500' : 'border-green-500'}`}>
                            <CardHeader><CardTitle className="text-sm uppercase text-gray-500">Risk Assessment</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{risk.level}</div>
                                {risk.reasons.length > 0 && <ul className="mt-2 text-sm text-gray-600 list-disc pl-4">
                                    {risk.reasons.map(r => <li key={r}>{r}</li>)}
                                </ul>}
                            </CardContent>
                        </Card>

                        {/* Attendance Snapshot */}
                        <Card>
                            <CardHeader><CardTitle className="text-sm uppercase text-gray-500">Attendance</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{attendance.term_rate}%</div>
                                <p className="text-xs text-gray-500">Term Attendance Rate</p>
                            </CardContent>
                        </Card>

                        {/* Incidents Snapshot */}
                        <Card>
                            <CardHeader><CardTitle className="text-sm uppercase text-gray-500">Incidents</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex gap-4">
                                    <div>
                                        <div className="text-2xl font-bold text-red-600">{incidents_summary.open_count}</div>
                                        <p className="text-xs text-gray-500">Open</p>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-600">{incidents_summary.resolved_count}</div>
                                        <p className="text-xs text-gray-500">Resolved</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Guardians */}
                    <Card>
                        <CardHeader><CardTitle>Guardians</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {guardians.map((g, i) => (
                                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                                        <div className="font-medium">{g.name}</div>
                                        <div className="text-sm text-gray-500">{g.phone} • {g.email}</div>
                                        {g.is_primary && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Primary</span>}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="attendance">
                    <div className="p-8 text-center text-gray-500 bg-white rounded-xl border">
                        Detailed Attendance Chart Component Placeholders
                    </div>
                </TabsContent>

                <TabsContent value="behavior">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <CardTitle>Behavior Incidents</CardTitle>
                            <Button size="sm" variant="outline">Report Incident</Button>
                        </CardHeader>
                        <CardContent>
                            {incidents_summary.recent.length === 0 ? (
                                <p className="text-gray-500">No recent incidents.</p>
                            ) : (
                                <div>List of incidents...</div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents">
                    <Card>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <CardTitle>Document Vault</CardTitle>
                            <Button size="sm">Upload Document</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {documents.map(doc => (
                                    <div key={doc.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded border">
                                        <div className="flex items-center gap-2">
                                            <FileText className="text-gray-400" />
                                            <div>
                                                <div className="font-medium">{doc.title}</div>
                                                <div className="text-xs text-gray-500 uppercase">{doc.doc_type} • {new Date(doc.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm">Download</Button>
                                    </div>
                                ))}
                                {documents.length === 0 && <p className="text-gray-500">No documents found.</p>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {fees_summary && (
                    <TabsContent value="fees">
                        <Card className="bg-slate-50 border-slate-200">
                            <CardContent className="p-6">
                                <h3 className="font-bold text-lg mb-4">Financial Snapshot</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Outstanding Balance</p>
                                        <p className={`text-2xl font-bold ${fees_summary.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {fees_summary.outstanding_balance}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Status</p>
                                        <p className="font-medium">{fees_summary.status}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default Student360Profile;
