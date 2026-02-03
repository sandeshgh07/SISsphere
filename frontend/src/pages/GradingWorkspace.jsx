
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
    Plus,
    Save,
    AlertTriangle,
    FileText,
    Settings,
    Loader2,
    CheckCircle2,
    ChevronRight,
    School,
    BookOpen,
    Calendar,
    Users,
    AlertCircle
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function GradingWorkspace() {
    const { accessToken } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Context Data
    const [grades, setGrades] = useState([]);
    const [sections, setSections] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [terms, setTerms] = useState([]);

    // Selection State
    const [selectedTermId, setSelectedTermId] = useState("");
    const [selectedGradeId, setSelectedGradeId] = useState("");
    const [selectedSectionId, setSelectedSectionId] = useState("");
    const [selectedSubjectId, setSelectedSubjectId] = useState("");

    // Workspace Data
    const [students, setStudents] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [assessmentTypes, setAssessmentTypes] = useState([]);
    const [scores, setScores] = useState({}); // { student_id-assessment_id: score }

    // UI State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [newAssessment, setNewAssessment] = useState({ name: "", max_marks: 20, assessment_type_id: "" });
    const [savingScores, setSavingScores] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    // Initial Load
    useEffect(() => {
        if (!accessToken) return;
        const loadContext = async () => {
            try {
                const [gRes, sRes, tRes, secRes, typeRes] = await Promise.all([
                    axios.get(`${API_BASE}/api/academics/grades`, { headers: { Authorization: `Bearer ${accessToken}` } }),
                    axios.get(`${API_BASE}/api/academics/subjects`, { headers: { Authorization: `Bearer ${accessToken}` } }),
                    axios.get(`${API_BASE}/api/academics/exams/terms`, { headers: { Authorization: `Bearer ${accessToken}` } }),
                    axios.get(`${API_BASE}/api/academics/sections`, { headers: { Authorization: `Bearer ${accessToken}` } }),
                    axios.get(`${API_BASE}/api/academics/assessment-types`, { headers: { Authorization: `Bearer ${accessToken}` } })
                ]);
                setGrades(Array.isArray(gRes.data) ? gRes.data : []);
                setSubjects(Array.isArray(sRes.data) ? sRes.data : []);
                setTerms(Array.isArray(tRes.data) ? tRes.data : []);
                setSections(Array.isArray(secRes.data) ? secRes.data : []);
                setAssessmentTypes(Array.isArray(typeRes.data) ? typeRes.data : []);
            } catch (e) {
                console.error("Failed to load context", e);
            }
        };
        loadContext();
    }, [accessToken]);

    // Step Management
    useEffect(() => {
        if (selectedTermId && !selectedGradeId) setCurrentStep(2);
        else if (selectedTermId && selectedGradeId && !selectedSectionId) setCurrentStep(3);
        else if (selectedTermId && selectedGradeId && selectedSectionId && !selectedSubjectId) setCurrentStep(4);
        else if (selectedTermId && selectedGradeId && selectedSectionId && selectedSubjectId) setCurrentStep(5);
    }, [selectedTermId, selectedGradeId, selectedSectionId, selectedSubjectId]);

    // Load Workspace Data
    useEffect(() => {
        if (selectedGradeId && selectedSectionId && selectedSubjectId && selectedTermId) {
            loadWorkspaceData();
        }
    }, [selectedGradeId, selectedSectionId, selectedSubjectId, selectedTermId]);

    const loadWorkspaceData = async () => {
        setLoading(true);
        try {
            // Fetch Assessments
            const assRes = await axios.get(`${API_BASE}/api/academics/assessments`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { subject_id: selectedSubjectId, exam_term_id: selectedTermId }
            });
            setAssessments(assRes.data || []);

            // Fetch Students
            const stuRes = await axios.get(`${API_BASE}/api/students`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const filteredStudents = (stuRes.data || []).filter(s =>
                s.grade_id === selectedGradeId && (s.section_id === selectedSectionId || !s.section_id)
            );
            setStudents(filteredStudents);

            // Optimization: In real app, fetch existing scores here.
            // For now, we start fresh or rely on user re-entry for MVP as discussed.

        } catch (e) {
            toast({ title: "Error", description: "Failed to load workspace data", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAssessment = async () => {
        if (!newAssessment.name || !newAssessment.max_marks) return;
        try {
            await axios.post(`${API_BASE}/api/academics/assessments`, {
                ...newAssessment,
                subject_id: selectedSubjectId,
                exam_term_id: selectedTermId
            }, { headers: { Authorization: `Bearer ${accessToken}` } });

            toast({ title: "Success", description: "Assessment created" });
            setShowConfigModal(false);
            loadWorkspaceData();
        } catch (e) {
            toast({ title: "Error", description: "Failed to create assessment", variant: "destructive" });
        }
    };

    const handleSaveScores = async (assessment) => {
        setSavingScores(true);
        try {
            const payload = students.map(s => {
                const val = scores[`${s.id}-${assessment.id}`];
                if (val !== undefined && val !== "") return { student_id: s.id, score: parseFloat(val) };
                return null;
            }).filter(Boolean);

            if (payload.length === 0) {
                toast({ title: "Info", description: "No scores entered to save" });
                setSavingScores(false);
                return;
            }

            await axios.post(`${API_BASE}/api/academics/assessments/scores`, {
                assessment_id: assessment.id,
                scores: payload
            }, { headers: { Authorization: `Bearer ${accessToken}` } });

            toast({ title: "Saved", description: `Scores saved for ${assessment.name}` });
        } catch (e) {
            toast({ title: "Error", description: "Failed to save scores", variant: "destructive" });
        } finally {
            setSavingScores(false);
        }
    };

    const isContextReady = selectedGradeId && selectedSectionId && selectedSubjectId && selectedTermId;

    // Derived Stats
    const totalMaxMarks = assessments.reduce((acc, a) => acc + (a.max_marks || 0), 0);
    const filledCount = students.reduce((acc, s) => {
        const hasScore = assessments.some(a => scores[`${s.id}-${a.id}`] !== undefined);
        return acc + (hasScore ? 1 : 0);
    }, 0);

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8" data-testid="grading-workspace">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-7 w-7 text-sissphere-primary" />
                    Grading & Assessment
                </h1>
                <p className="text-slate-500 mt-1">Manage examinations, marks entry, and student performance.</p>
            </div>

            {/* Stepper Selection Card */}
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-visible">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Step 1: Term */}
                        <div className={`space-y-3 relative ${currentStep >= 1 ? 'opacity-100' : 'opacity-50'}`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedTermId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {selectedTermId ? <CheckCircle2 className="w-4 h-4" /> : "1"}
                                </div>
                                <Label className={selectedTermId ? "text-emerald-700 font-medium" : "text-slate-700"}>Academic Term</Label>
                            </div>
                            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                                <SelectTrigger className="bg-white border-slate-200 focus:ring-emerald-500">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Calendar className="w-4 h-4" />
                                        <SelectValue placeholder="Select Term" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Step 2: Grade */}
                        <div className={`space-y-3 relative ${currentStep >= 2 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedGradeId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {selectedGradeId ? <CheckCircle2 className="w-4 h-4" /> : "2"}
                                </div>
                                <Label className={selectedGradeId ? "text-emerald-700 font-medium" : "text-slate-700"}>Grade / Class</Label>
                            </div>
                            <Select value={selectedGradeId} onValueChange={setSelectedGradeId} disabled={!selectedTermId}>
                                <SelectTrigger className="bg-white border-slate-200 focus:ring-emerald-500">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <School className="w-4 h-4" />
                                        <SelectValue placeholder="Select Grade" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {grades.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Step 3: Section */}
                        <div className={`space-y-3 relative ${currentStep >= 3 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedSectionId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {selectedSectionId ? <CheckCircle2 className="w-4 h-4" /> : "3"}
                                </div>
                                <Label className={selectedSectionId ? "text-emerald-700 font-medium" : "text-slate-700"}>Section</Label>
                            </div>
                            <Select value={selectedSectionId} onValueChange={setSelectedSectionId} disabled={!selectedGradeId}>
                                <SelectTrigger className="bg-white border-slate-200 focus:ring-emerald-500">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Users className="w-4 h-4" />
                                        <SelectValue placeholder="Select Section" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Step 4: Subject */}
                        <div className={`space-y-3 relative ${currentStep >= 4 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selectedSubjectId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {selectedSubjectId ? <CheckCircle2 className="w-4 h-4" /> : "4"}
                                </div>
                                <Label className={selectedSubjectId ? "text-emerald-700 font-medium" : "text-slate-700"}>Subject</Label>
                            </div>
                            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={!selectedSectionId}>
                                <SelectTrigger className="bg-white border-slate-200 focus:ring-emerald-500">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <BookOpen className="w-4 h-4" />
                                        <SelectValue placeholder="Select Subject" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Content Area with Side Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Grading Area */}
                <div className="lg:col-span-3 space-y-6">
                    {!isContextReady ? (
                        <Card className="bg-slate-50 border-slate-200 border-dashed min-h-[400px] flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <School className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-600">Select all fields above to start grading</p>
                            <p className="text-sm mt-1">Choose Term, Grade, Section, and Subject</p>
                        </Card>
                    ) : (
                        <Tabs defaultValue="entry" className="w-full">
                            <div className="flex items-center justify-between mb-4">
                                <TabsList className="bg-slate-100 border border-slate-200">
                                    <TabsTrigger value="entry" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Marks Entry</TabsTrigger>
                                    <TabsTrigger value="config" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Configuration</TabsTrigger>
                                </TabsList>
                                <Button onClick={() => setShowConfigModal(true)} variant="outline" size="sm" className="hidden sm:flex gap-2">
                                    <Settings className="w-4 h-4" /> Configure Assessments
                                </Button>
                            </div>

                            <TabsContent value="entry" className="mt-0">
                                <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                                    <CardContent className="p-0">
                                        {loading ? (
                                            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
                                        ) : assessments.length === 0 ? (
                                            <div className="py-20 flex flex-col items-center text-slate-500">
                                                <AlertCircle className="w-8 h-8 mb-2 text-amber-500" />
                                                <p>No assessments configured yet.</p>
                                                <Button variant="link" onClick={() => setShowConfigModal(true)}>Create your first assessment</Button>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-center">
                                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                                                        <tr>
                                                            <th className="py-3 px-4 text-left min-w-[200px] sticky left-0 bg-slate-50 z-20 shadow-[1px_0_0_0_rgba(226,232,240,1)]">Student</th>
                                                            {assessments.map(a => (
                                                                <th key={a.id} className="py-3 px-2 min-w-[120px]">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-slate-900">{a.name}</span>
                                                                        <Badge variant="secondary" className="text-[10px] h-4 mt-0.5 bg-slate-200 text-slate-600">Max: {a.max_marks}</Badge>
                                                                    </div>
                                                                </th>
                                                            ))}
                                                            <th className="py-3 px-4 min-w-[100px] text-slate-400">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {students.length === 0 ? (
                                                            <tr><td colSpan={assessments.length + 2} className="py-10 text-slate-500">No students found in this section.</td></tr>
                                                        ) : (
                                                            students.map((student, idx) => (
                                                                <tr key={student.id} className={`hover:bg-slate-50 group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                                    <td className="py-3 px-4 text-left sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                                                                        <div className="font-medium text-slate-900">{student.first_name} {student.last_name}</div>
                                                                        <div className="text-xs text-slate-500">Roll: {student.roll_no || "-"}</div>
                                                                    </td>
                                                                    {assessments.map(a => (
                                                                        <td key={a.id} className="py-3 px-2">
                                                                            <Input
                                                                                type="number"
                                                                                className="w-20 mx-auto text-center h-9 border-slate-200 focus-visible:ring-emerald-500"
                                                                                placeholder="-"
                                                                                max={a.max_marks}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    if (val === "" || (parseFloat(val) >= 0 && parseFloat(val) <= a.max_marks)) {
                                                                                        setScores(prev => ({ ...prev, [`${student.id}-${a.id}`]: val }));
                                                                                    }
                                                                                }}
                                                                                value={scores[`${student.id}-${a.id}`] || ""}
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                    <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                                                                        - / {totalMaxMarks}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                                        <tr>
                                                            <td className="p-3 sticky left-0 bg-slate-50 z-10 text-right pr-4 font-medium text-slate-600 shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                                                                Actions
                                                            </td>
                                                            {assessments.map(a => (
                                                                <td key={a.id} className="p-3">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleSaveScores(a)}
                                                                        disabled={savingScores || students.length === 0}
                                                                        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                                                    >
                                                                        {savingScores ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                                                        Save
                                                                    </Button>
                                                                </td>
                                                            ))}
                                                            <td></td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="config">
                                <Card className="bg-white border-slate-200 shadow-sm">
                                    <CardHeader><CardTitle className="text-lg">Assessment Configuration</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        {assessments.map(a => (
                                            <div key={a.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-900">
                                                <div>
                                                    <div className="font-semibold">{a.name}</div>
                                                    <div className="text-sm text-slate-500">Max Marks: {a.max_marks}</div>
                                                </div>
                                                <Badge variant="outline" className="bg-white">{a.assessment_type_id ? "Typed" : "General"}</Badge>
                                            </div>
                                        ))}
                                        {assessments.length === 0 && <p className="text-slate-500 italic">No assessments yet.</p>}
                                    </CardContent>
                                    <CardFooter>
                                        <Button onClick={() => setShowConfigModal(true)} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> CREATE NEW ASSESSMENT</Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>

                {/* Right Summary Panel */}
                <div className="lg:col-span-1 space-y-4">
                    {isContextReady && (
                        <div className="sticky top-6 space-y-4">
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
                                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 text-sm">Students</span>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-900">{students.length}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 text-sm">Assessments</span>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-900">{assessments.length}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 text-sm">Total Weight</span>
                                        <span className="font-mono font-medium text-slate-900">{totalMaxMarks} pts</span>
                                    </div>
                                    <div className="pt-2 border-t border-slate-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-slate-500">Progress (Est.)</span>
                                            <span className="text-xs font-medium text-emerald-600">
                                                {students.length > 0 ? Math.round((filledCount / students.length) * 100) : 0}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-500"
                                                style={{ width: `${students.length > 0 ? (filledCount / students.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-blue-50 border-blue-100 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-medium text-blue-900">Grading Policy</h4>
                                            <p className="text-xs text-blue-700 leading-relaxed">
                                                Ensure all assessment columns match the term curriculum. Updates are auto-saved locally but must be committed via "Save".
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* Assessment Modal */}
            <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
                <DialogContent className="bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle>Add Assessment Column</DialogTitle>
                        <DialogDescription>Create a new column in the gradebook.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Assessment Name</Label>
                            <Input
                                value={newAssessment.name}
                                onChange={e => setNewAssessment({ ...newAssessment, name: e.target.value })}
                                placeholder="e.g. Unit Test 1"
                                className="bg-white border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Marks</Label>
                            <Input
                                type="number"
                                value={newAssessment.max_marks}
                                onChange={e => setNewAssessment({ ...newAssessment, max_marks: parseInt(e.target.value) })}
                                className="bg-white border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Type (Optional)</Label>
                            <Select onValueChange={v => setNewAssessment({ ...newAssessment, assessment_type_id: v })}>
                                <SelectTrigger className="bg-white border-slate-200">
                                    <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.isArray(assessmentTypes) && assessmentTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfigModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateAssessment} className="bg-sissphere-primary hover:bg-sissphere-primary/90">Create Assessment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
