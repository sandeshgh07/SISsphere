import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Search,
    Filter,
    Phone,
    Mail,
    User,
    AlertTriangle
} from 'lucide-react';
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function MyStudentsPage() {
    const { accessToken } = useAuth();
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState("ALL");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    // Load Filters (Grades)
    useEffect(() => {
        if (!accessToken) return;
        const fetchGrades = async () => {
            try {
                // Reuse attendance shortcuts as it lists my assigned grades
                const res = await axios.get(`${API_BASE}/api/dashboard/teacher/attendance-shortcuts`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                // Deduplicate grades
                const unique = {};
                res.data.forEach(item => {
                    if (item.grade_id && !unique[item.grade_id]) {
                        // Extract grade name from label "Grade 10 - A" -> "Grade 10" approx?
                        // Or better if backend returned name.
                        // Shortcuts returns label.
                        // Let's rely on label for now or better, unique IDs.
                        unique[item.grade_id] = item.label.split(" - ")[0];
                    }
                });
                setGrades(Object.entries(unique).map(([id, name]) => ({ id, name })));
            } catch (e) { console.error(e); }
        };
        fetchGrades();
    }, [accessToken]);

    // Load Students
    useEffect(() => {
        if (!accessToken) return;
        const fetchStudents = async () => {
            setLoading(true);
            try {
                const params = {};
                if (selectedGrade !== "ALL") params.grade_id = selectedGrade;
                if (search.length > 2) params.search = search;

                const res = await axios.get(`${API_BASE}/api/dashboard/teacher/my-students`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params
                });
                setStudents(res.data);
            } catch (e) {
                console.error("Failed to fetch students", e);
            } finally {
                setLoading(false);
            }
        };

        // Debounce search?
        const timer = setTimeout(fetchStudents, 300);
        return () => clearTimeout(timer);
    }, [accessToken, selectedGrade, search]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-100">My Students</h1>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            placeholder="Search by name..."
                            className="pl-9 bg-slate-900 border-slate-700 text-slate-200"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Grade Filters */}
            <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-thin scrollbar-thumb-slate-700">
                <Button
                    variant={selectedGrade === "ALL" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedGrade("ALL")}
                    className={`rounded-full ${selectedGrade === "ALL" ? "bg-blue-600 hover:bg-blue-700 border-transparent text-white" : "bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800"}`}
                >
                    All My Grades
                </Button>
                {grades.map(g => (
                    <Button
                        key={g.id}
                        variant={selectedGrade === g.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedGrade(g.id)}
                        className={`rounded-full whitespace-nowrap ${selectedGrade === g.id ? "bg-blue-600 hover:bg-blue-700 border-transparent text-white" : "bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800"}`}
                    >
                        {g.name}
                    </Button>
                ))}
            </div>

            {/* Student List */}
            {loading ? (
                <div className="grid grid-cols-1 gap-4 animate-pulse">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-slate-900 rounded-xl" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {students.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                            <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No students found.</p>
                        </div>
                    ) : (
                        students.map(student => (
                            <Card key={student.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all group">
                                <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                    {/* Avatar */}
                                    <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-700">
                                        {student.photo_url ? (
                                            <img src={student.photo_url} alt={student.first_name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-bold text-slate-500">{student.first_name[0]}</span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 text-center md:text-left">
                                        <NavLink to={`/school/students/${student.id}`} className="hover:underline decoration-blue-400">
                                            <h3 className="text-lg font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
                                                {student.first_name} {student.last_name}
                                            </h3>
                                        </NavLink>
                                        <p className="text-sm text-slate-400">{student.grade_name || "No Grade"}</p>

                                        <div className="mt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                                            {/* Attendance Badge */}
                                            <div className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${student.attendance_rate < 75
                                                    ? "bg-red-900/30 text-red-300 border border-red-900/50"
                                                    : "bg-green-900/30 text-green-300 border border-green-900/50"
                                                }`}>
                                                {student.attendance_rate < 75 && <AlertTriangle className="w-3 h-3" />}
                                                {student.attendance_rate}% Attendance
                                            </div>

                                            {student.risk_badge && (
                                                <Badge variant="destructive" className="bg-red-600/80 text-white text-[10px]">High Risk</Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Parents */}
                                    <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-4">
                                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">Parents / Guardians</h4>
                                        <div className="space-y-2">
                                            {student.parents && student.parents.length > 0 ? (
                                                student.parents.map((p, idx) => (
                                                    <div key={idx} className="text-sm">
                                                        <div className="text-slate-300 font-medium">{p.name}</div>
                                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                            {p.phone && (
                                                                <span className="flex items-center gap-1 hover:text-blue-400 cursor-pointer">
                                                                    <Phone className="w-3 h-3" /> {p.phone}
                                                                </span>
                                                            )}
                                                            {p.email && (
                                                                <span className="flex items-center gap-1 hover:text-blue-400 cursor-pointer" title={p.email}>
                                                                    <Mail className="w-3 h-3" /> Email
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs text-slate-600 italic">No parent info recorded</div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
