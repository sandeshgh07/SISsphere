
import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Save, CheckCircle, AlertCircle, Calendar as CalendarIcon, Users } from 'lucide-react';

const RecordAttendancePage = () => {
    const [contexts, setContexts] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(false);
    const [loadingRoster, setLoadingRoster] = useState(false);

    useEffect(() => {
        // Fetch context (sections)
        api.get('/attendance/teacher/context')
            .then(res => setContexts(res.data))
            .catch(err => toast.error("Failed to load sections"));
    }, []);

    const loadRoster = async () => {
        if (!selectedSection) return;
        setLoadingRoster(true);
        try {
            // 1. Get Students
            const rosterRes = await api.get(`/attendance/teacher/roster?section_id=${selectedSection}`);
            const studentsList = rosterRes.data;
            setStudents(studentsList);

            // 2. Initialize attendance Map (Default to PRESENT or fetched existing?)
            // Ideally we should fetch EXISTING attendance for this date first?
            // User requirement: "Upsert". But if I load roster, I should show existing status if any.
            // But strict requirement was just "Roster".
            // Let's TRY to fetch existing relevant to this day/section implicitly if we had an endpoint.
            // Actually, querying "stats" endpoint or similar might return it? 
            // Current backend: `/api/attendance/stats` gives aggregate.
            // We don't have a "get bulk records" endpoint.
            // So we default to PRESENT for everyone. 
            // IMPROVEMENT: Add GET /api/attendance/records?section_id=...&date=... 
            // For now, default to PRESENT. 

            const initialMap = {};
            studentsList.forEach(s => {
                initialMap[s.id] = { status: "PRESENT", note: "" };
            });
            setAttendanceData(initialMap);

        } catch (err) {
            toast.error("Failed to load roster");
            console.error(err);
        } finally {
            setLoadingRoster(false);
        }
    };

    const handleStatusChange = (studentId, status) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], status }
        }));
    };

    const handleNoteChange = (studentId, note) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], note }
        }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const records = Object.entries(attendanceData).map(([sid, data]) => ({
                student_id: sid,
                status: data.status,
                note: data.note || null
            }));

            const payload = {
                date: selectedDate,
                section_id: selectedSection,
                records: records
            };

            const res = await api.post('/attendance/record', payload);
            toast.success(`Attendance saved! Created: ${res.data.created}, Updated: ${res.data.updated}`);
        } catch (err) {
            toast.error("Failed to save attendance");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const countStats = () => {
        const counts = { PRESENT: 0, ABSENT: 0, LATE: 0 };
        Object.values(attendanceData).forEach(d => {
            if (counts[d.status] !== undefined) counts[d.status]++;
        });
        return counts;
    };

    const stats = countStats();

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <CheckCircle className="text-blue-600" /> Record Attendance
                </h1>
            </div>

            {/* Controls */}
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="space-y-1 w-full md:w-64">
                        <label className="text-sm font-medium text-gray-700">Date</label>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white"
                        />
                    </div>

                    <div className="space-y-1 w-full md:w-48">
                        <label className="text-sm font-medium text-gray-700">Grade</label>
                        <Select onValueChange={(val) => { setSelectedGrade(val); setSelectedSection(""); }} value={selectedGrade}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Grade" />
                            </SelectTrigger>
                            <SelectContent>
                                {[...new Set(contexts.map(c => c.grade_name))].sort().map(g => (
                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1 w-full md:w-48">
                        <label className="text-sm font-medium text-gray-700">Section</label>
                        <Select onValueChange={setSelectedSection} value={selectedSection} disabled={!selectedGrade}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Section" />
                            </SelectTrigger>
                            <SelectContent>
                                {contexts.filter(c => c.grade_name === selectedGrade).map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button onClick={loadRoster} disabled={!selectedSection || loadingRoster} className="mb-0.5">
                        {loadingRoster ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Users className="w-4 h-4 mr-2" />}
                        Load Roster
                    </Button>
                </CardContent>
            </Card>

            {/* Roster & Actions */}
            {students.length > 0 && (
                <div className="space-y-6">
                    {/* Summary Bar */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
                            <div className="text-2xl font-bold text-green-700">{stats.PRESENT}</div>
                            <div className="text-xs text-green-600 font-medium">Present</div>
                        </div>
                        <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-center">
                            <div className="text-2xl font-bold text-red-700">{stats.ABSENT}</div>
                            <div className="text-xs text-red-600 font-medium">Absent</div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-center">
                            <div className="text-2xl font-bold text-yellow-700">{stats.LATE}</div>
                            <div className="text-xs text-yellow-600 font-medium">Late</div>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-sm uppercas">
                                    <tr>
                                        <th className="p-4 font-medium">Student</th>
                                        <th className="p-4 font-medium text-center">Status</th>
                                        <th className="p-4 font-medium">Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {students.map(student => (
                                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                    {student.photo_url ? <img src={student.photo_url} className="w-full h-full rounded-full" /> : student.name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{student.name}</div>
                                                    <div className="text-xs text-gray-400">Roll: {student.roll_number || 'N/A'}</div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="inline-flex bg-gray-100 p-1 rounded-lg">
                                                    {['PRESENT', 'ABSENT', 'LATE'].map(status => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusChange(student.id, status)}
                                                            className={`
                                                                px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                                                ${attendanceData[student.id]?.status === status
                                                                    ? (status === 'PRESENT' ? 'bg-green-500 text-white shadow-sm' :
                                                                        status === 'ABSENT' ? 'bg-red-500 text-white shadow-sm' :
                                                                            'bg-yellow-500 text-white shadow-sm')
                                                                    : 'text-gray-500 hover:bg-white'
                                                                }
                                                            `}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Input
                                                    placeholder="Optional note..."
                                                    className="h-8 text-xs max-w-[200px]"
                                                    value={attendanceData[student.id]?.note || ""}
                                                    onChange={(e) => handleNoteChange(student.id, e.target.value)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-3 sticky bottom-4 z-40">
                        <Button variant="outline" className="bg-white shadow">Cancel</Button>
                        <Button onClick={handleSubmit} disabled={loading} className="gap-2 shadow-lg">
                            {loading ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                            Save Attendance
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecordAttendancePage;
