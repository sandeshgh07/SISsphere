
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
    Calendar,
    BookOpen,
    School,
    Settings,
    ArrowUpCircle,
    Clock,
    Lock,
    CheckCircle,
    AlertTriangle,
    Plus,
    Trash2,
    Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea"; // Assuming you have this or use Input
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function AcademicSetupHub() {
    const { accessToken, user } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("years");
    const [loading, setLoading] = useState(false);

    // Data States
    const [academicYears, setAcademicYears] = useState([]);
    const [terms, setTerms] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [gradingPolicy, setGradingPolicy] = useState(null);
    const [promotionRules, setPromotionRules] = useState(null);
    const [periodStructure, setPeriodStructure] = useState(null);

    // Active Context
    const activeYear = academicYears.find(y => y.is_active);

    // Form States
    const [showYearModal, setShowYearModal] = useState(false);
    const [newYear, setNewYear] = useState({ name: "", start_date: "", end_date: "" });

    const [showTermModal, setShowTermModal] = useState(false);
    const [newTerm, setNewTerm] = useState({ name: "", start_date: "", end_date: "", weightage: 0, academic_year_id: "" });

    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [newSubject, setNewSubject] = useState({ name: "", code: "", is_elective: false, grade_id: "" });

    // Grading Form State
    const [gradingForm, setGradingForm] = useState({
        gpa_scale: "4.0",
        pass_mark: 40,
        full_mark: 100,
        grading_structure: []
    });

    // JSON Editors State
    const [rulesJson, setRulesJson] = useState("{}");
    const [periodJson, setPeriodJson] = useState("{}");


    // Initial Load
    useEffect(() => {
        if (accessToken) {
            fetchAllData();
        }
    }, [accessToken, activeTab]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const headers = { Authorization: `Bearer ${accessToken}` };

            // Always fetch years to know active year
            const yearsRes = await axios.get(`${API_BASE}/api/academics/academic-years`, { headers });
            setAcademicYears(yearsRes.data);
            const activeAy = yearsRes.data.find(y => y.is_active);

            if (activeTab === "terms" && activeAy) {
                const termsRes = await axios.get(`${API_BASE}/api/academics/terms?academic_year_id=${activeAy.id}`, { headers });
                setTerms(termsRes.data);
            } else if (activeTab === "subjects") {
                const res = await axios.get(`${API_BASE}/api/academics/subjects`, { headers });
                setSubjects(res.data);
            } else if (activeTab === "grading" && activeAy) {
                const res = await axios.get(`${API_BASE}/api/academics/grading-policies?academic_year_id=${activeAy.id}`, { headers });
                if (res.data && res.data.length > 0) {
                    setGradingPolicy(res.data[0]);
                    setGradingForm(res.data[0]);
                } else {
                    setGradingPolicy(null);
                    // Reset form defaults if needed
                }
            } else if (activeTab === "promotion" && activeAy) {
                const res = await axios.get(`${API_BASE}/api/academics/promotion-rules?academic_year_id=${activeAy.id}`, { headers });
                if (res.data && res.data.length > 0) {
                    setPromotionRules(res.data[0]);
                    setRulesJson(JSON.stringify(res.data[0].rules, null, 2));
                } else {
                    setPromotionRules(null);
                    setRulesJson("{\n  \"min_attendance_percent\": 75,\n  \"fail_tolerance_subjects\": 1\n}");
                }
            } else if (activeTab === "periods" && activeAy) {
                const res = await axios.get(`${API_BASE}/api/academics/period-structures?academic_year_id=${activeAy.id}`, { headers });
                if (res.data && res.data.length > 0) {
                    setPeriodStructure(res.data[0]);
                    setPeriodJson(JSON.stringify(res.data[0].structure, null, 2));
                } else {
                    setPeriodStructure(null);
                    setPeriodJson("{\n  \"periods_per_day\": 8,\n  \"break_duration_mins\": 15\n}");
                }
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleCreateYear = async () => {
        try {
            await axios.post(`${API_BASE}/api/academics/academic-years`, newYear, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Success", description: "Academic Year Created" });
            setShowYearModal(false);
            fetchAllData();
        } catch (e) {
            toast({ title: "Error", description: e.response?.data?.detail || "Failed", variant: "destructive" });
        }
    };

    const handleSetActiveYear = async (id) => {
        try {
            await axios.patch(`${API_BASE}/api/academics/academic-years/${id}/set-active`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Updated", description: "Active academic year changed" });
            fetchAllData();
        } catch (e) {
            toast({ title: "Error", description: "Failed to update", variant: "destructive" });
        }
    };

    const handleCreateTerm = async () => {
        try {
            await axios.post(`${API_BASE}/api/academics/terms`, newTerm, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Success", description: "Term Created" });
            setShowTermModal(false);
            fetchAllData();
        } catch (e) {
            toast({ title: "Error", description: e.response?.data?.detail || "Failed", variant: "destructive" });
        }
    };

    const handleCreateSubject = async () => {
        try {
            await axios.post(`${API_BASE}/api/academics/subjects`, newSubject, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Success", description: "Subject Created" });
            setShowSubjectModal(false);
            fetchAllData();
        } catch (e) {
            toast({ title: "Error", description: e.response?.data?.detail || "Failed", variant: "destructive" });
        }
    };

    const handleSaveGrading = async () => {
        if (!activeYear) return toast({ title: "Error", description: "No active year", variant: "destructive" });
        try {
            const payload = {
                ...gradingForm,
                academic_year_id: activeYear.id,
                weight_rules: {} // Placeholder or UI pending
            };
            await axios.post(`${API_BASE}/api/academics/grading-policies`, payload, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Success", description: "Grading Policy Saved" });
            fetchAllData();
        } catch (e) {
            toast({ title: "Error", description: "Failed to save policy", variant: "destructive" });
        }
    };

    const handleSavePromotion = async () => {
        if (!activeYear) return toast({ title: "Error", description: "No active year", variant: "destructive" });
        try {
            let parsedRules;
            try { parsedRules = JSON.parse(rulesJson); } catch (e) { return toast({ title: "Invalid JSON", variant: "destructive" }); }

            await axios.post(`${API_BASE}/api/academics/promotion-rules`, {
                academic_year_id: activeYear.id,
                rules: parsedRules
            }, { headers: { Authorization: `Bearer ${accessToken}` } });
            toast({ title: "Success", description: "Promotion Rules Saved" });
            fetchAllData();
        } catch (e) {
            toast({ title: "Error", description: "Failed to save rules", variant: "destructive" });
        }
    };

    const handleSavePeriod = async () => {
        if (!activeYear) return toast({ title: "Error", description: "No active year", variant: "destructive" });
        try {
            let parsedStruct;
            try { parsedStruct = JSON.parse(periodJson); } catch (e) { return toast({ title: "Invalid JSON", variant: "destructive" }); }

            await axios.post(`${API_BASE}/api/academics/period-structures`, {
                academic_year_id: activeYear.id,
                structure: parsedStruct
            }, { headers: { Authorization: `Bearer ${accessToken}` } });
            toast({ title: "Success", description: "Period Structure Saved" });
            fetchAllData();
        } catch (e) {
            toast({ title: "Error", description: "Failed to save structure", variant: "destructive" });
        }
    }


    // --- RENDERING ---

    const SidebarItem = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg 
            ${activeTab === id
                    ? "bg-[#003333] text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100"}`}
        >
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 gap-6 p-6">

            {/* Left Sidebar */}
            <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
                <div className="mb-6 px-2">
                    <h1 className="text-2xl font-bold text-slate-900">Academic Setup</h1>
                    <p className="text-slate-500 text-sm">Configure your school's academic backbone.</p>
                </div>

                <nav className="space-y-1">
                    <SidebarItem id="years" label="Academic Years" icon={Calendar} />
                    <SidebarItem id="terms" label="Terms & Exams" icon={Clock} />
                    <SidebarItem id="subjects" label="Subjects" icon={BookOpen} />
                    <SidebarItem id="grading" label="Grading Policy" icon={Settings} />
                    <SidebarItem id="promotion" label="Promotion Rules" icon={ArrowUpCircle} />
                    <SidebarItem id="periods" label="Period Structure" icon={School} />
                </nav>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 max-w-5xl">
                <Card className="bg-white border-slate-200 shadow-sm min-h-[500px]">
                    <CardHeader className="border-b border-slate-100 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold text-slate-800 capitalize">
                                    {activeTab.replace("-", " ")} Management
                                </CardTitle>
                                <CardDescription>Manage your {activeTab.replace("-", " ")} settings</CardDescription>
                            </div>
                            <div>
                                {/* Dynamic Action Button */}
                                {activeTab === "years" && (
                                    <Button onClick={() => setShowYearModal(true)} className="bg-[#800000] hover:bg-[#600000]">
                                        <Plus className="w-4 h-4 mr-2" /> New Year
                                    </Button>
                                )}
                                {activeTab === "terms" && (
                                    <Button onClick={() => setShowTermModal(true)} className="bg-[#800000] hover:bg-[#600000]">
                                        <Plus className="w-4 h-4 mr-2" /> New Term
                                    </Button>
                                )}
                                {activeTab === "subjects" && (
                                    <Button onClick={() => setShowSubjectModal(true)} className="bg-[#800000] hover:bg-[#600000]">
                                        <Plus className="w-4 h-4 mr-2" /> New Subject
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">

                        {/* ACADEMIC YEARS TAB */}
                        {activeTab === "years" && (
                            <div className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Start Date</TableHead>
                                            <TableHead>End Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {academicYears.map(ay => (
                                            <TableRow key={ay.id}>
                                                <TableCell className="font-medium">{ay.name}</TableCell>
                                                <TableCell>{ay.start_date}</TableCell>
                                                <TableCell>{ay.end_date}</TableCell>
                                                <TableCell>
                                                    {ay.is_active ? (
                                                        <Badge className="bg-green-100 text-green-700 border-green-200 shadow-none hover:bg-green-100">Active</Badge>
                                                    ) : ay.is_closed ? (
                                                        <Badge variant="secondary">Closed</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Inactive</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {!ay.is_active && !ay.is_closed && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleSetActiveYear(ay.id)} className="text-blue-600 hover:text-blue-800">
                                                            Set Active
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* TERMS TAB */}
                        {activeTab === "terms" && (
                            <div className="space-y-4">
                                {activeYear ? (
                                    <div className="bg-blue-50 text-blue-800 p-3 rounded mb-4 text-sm flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        Managing terms for active year: <strong>{activeYear.name}</strong>
                                    </div>
                                ) : (
                                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" /> No active academic year found.
                                    </div>
                                )}

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Term Name</TableHead>
                                            <TableHead>Timeline</TableHead>
                                            <TableHead>Weight</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {terms.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell className="font-medium">{t.name}</TableCell>
                                                <TableCell className="text-sm text-slate-500">{t.start_date} → {t.end_date}</TableCell>
                                                <TableCell>{t.weightage}%</TableCell>
                                                <TableCell>
                                                    {t.is_locked ? <Badge variant="secondary"><Lock className="w-3 h-3 mr-1" /> Locked</Badge> : <Badge variant="outline" className="text-green-600 border-green-200">Open</Badge>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {!t.is_locked && (
                                                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-600">
                                                            <Lock className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* SUBJECTS TAB */}
                        {activeTab === "subjects" && (
                            <div className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Subject Name</TableHead>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Grade Level</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {subjects.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-medium">{s.name}</TableCell>
                                                <TableCell>{s.code || "-"}</TableCell>
                                                <TableCell>
                                                    {s.is_elective ? <Badge variant="outline">Elective</Badge> : <Badge className="bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200">Core</Badge>}
                                                </TableCell>
                                                <TableCell>{s.grade_id ? "Grade Specific" : "Global"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* GRADING TAB */}
                        {activeTab === "grading" && (
                            <div className="space-y-6">
                                {activeYear ? (
                                    <div className="bg-green-50 text-green-800 p-3 rounded mb-4 text-sm flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        Configuring policy for: <strong>{activeYear.name}</strong>
                                    </div>
                                ) : (
                                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" /> No active academic year found.
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>GPA Scale</Label>
                                        <Input
                                            value={gradingForm.gpa_scale}
                                            onChange={e => setGradingForm({ ...gradingForm, gpa_scale: e.target.value })}
                                            className="bg-white"
                                            placeholder="e.g. 4.0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pass Mark (%)</Label>
                                        <Input
                                            type="number"
                                            value={gradingForm.pass_mark}
                                            onChange={e => setGradingForm({ ...gradingForm, pass_mark: e.target.value })}
                                            className="bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleSaveGrading} className="bg-[#800000] hover:bg-[#600000] text-white">
                                        <Save className="w-4 h-4 mr-2" /> Save Policy
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* PROMOTION TAB */}
                        {activeTab === "promotion" && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 text-blue-800 p-3 rounded mb-4 text-sm">
                                    Define rules in JSON format (e.g. min attendance, subjects failed tolerance).
                                </div>
                                <textarea
                                    className="w-full h-64 p-4 font-mono text-sm bg-slate-50 border border-slate-300 rounded"
                                    value={rulesJson}
                                    onChange={e => setRulesJson(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <Button onClick={handleSavePromotion} className="bg-[#800000] hover:bg-[#600000] text-white">
                                        <Save className="w-4 h-4 mr-2" /> Save Rules
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* PERIOD TAB */}
                        {activeTab === "periods" && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 text-blue-800 p-3 rounded mb-4 text-sm">
                                    Define Daily Period Structure in JSON.
                                </div>
                                <textarea
                                    className="w-full h-64 p-4 font-mono text-sm bg-slate-50 border border-slate-300 rounded"
                                    value={periodJson}
                                    onChange={e => setPeriodJson(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <Button onClick={handleSavePeriod} className="bg-[#800000] hover:bg-[#600000] text-white">
                                        <Save className="w-4 h-4 mr-2" /> Save Structure
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>

            {/* --- MODALS --- */}

            {/* Create Year Modal */}
            <Dialog open={showYearModal} onOpenChange={setShowYearModal}>
                <DialogContent className="bg-white text-slate-900 border-slate-200 sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>New Academic Year</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input placeholder="e.g. 2025-2026" value={newYear.name} onChange={e => setNewYear({ ...newYear, name: e.target.value })} className="bg-white border-slate-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input type="date" value={newYear.start_date} onChange={e => setNewYear({ ...newYear, start_date: e.target.value })} className="bg-white border-slate-300" />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={newYear.end_date} onChange={e => setNewYear({ ...newYear, end_date: e.target.value })} className="bg-white border-slate-300" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateYear}>Create Year</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Term Modal */}
            <Dialog open={showTermModal} onOpenChange={setShowTermModal}>
                <DialogContent className="bg-white text-slate-900 border-slate-200 sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>New Term</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input placeholder="e.g. First Term" value={newTerm.name} onChange={e => setNewTerm({ ...newTerm, name: e.target.value })} className="bg-white border-slate-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input type="date" value={newTerm.start_date} onChange={e => setNewTerm({ ...newTerm, start_date: e.target.value })} className="bg-white border-slate-300" />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={newTerm.end_date} onChange={e => setNewTerm({ ...newTerm, end_date: e.target.value })} className="bg-white border-slate-300" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Weightage (%)</Label>
                            <Input type="number" value={newTerm.weightage} onChange={e => setNewTerm({ ...newTerm, weightage: e.target.value })} className="bg-white border-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <Label>Academic Year</Label>
                            <select
                                className="w-full border border-slate-300 rounded p-2 text-sm bg-white"
                                value={newTerm.academic_year_id}
                                onChange={e => setNewTerm({ ...newTerm, academic_year_id: e.target.value })}
                            >
                                <option value="">Select Year...</option>
                                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateTerm}>Create Term</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Subject Modal */}
            <Dialog open={showSubjectModal} onOpenChange={setShowSubjectModal}>
                <DialogContent className="bg-white text-slate-900 border-slate-200 sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>New Subject</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input placeholder="e.g. Mathematics" value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })} className="bg-white border-slate-300" />
                        </div>
                        <div className="space-y-2">
                            <Label>Code (Optional)</Label>
                            <Input placeholder="e.g. MTH101" value={newSubject.code} onChange={e => setNewSubject({ ...newSubject, code: e.target.value })} className="bg-white border-slate-300" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isElective"
                                checked={newSubject.is_elective}
                                onChange={e => setNewSubject({ ...newSubject, is_elective: e.target.checked })}
                                className="accent-blue-600"
                            />
                            <Label htmlFor="isElective">Is Elective?</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateSubject}>Create Subject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
