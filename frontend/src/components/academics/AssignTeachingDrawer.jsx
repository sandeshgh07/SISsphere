import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Helper to fetch data
const fetchAssignments = async (teacherId, token) => {
    const res = await fetch(`/api/teaching-assignments/teacher/${teacherId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch assignments");
    return res.json();
};

const fetchSubjects = async (yearId, gradeId, token) => {
    const res = await fetch(`/api/teaching-assignments/options/subjects?academic_year_id=${yearId}&grade_id=${gradeId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch subjects");
    return res.json();
};

const AssignTeachingDrawer = ({ isOpen, onClose, teacher, config, token }) => {
    // const { toast } = useToast(); // Removed
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedGrade, setSelectedGrade] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    // Options
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [sectionOptions, setSectionOptions] = useState([]);

    // Initialize defaults when opening
    useEffect(() => {
        if (isOpen && teacher && config?.activeYear) {
            setSelectedYear(config.activeYear.id);
            loadAssignments();
        }
    }, [isOpen, teacher, config]);

    // Fetch Assignments
    const loadAssignments = async () => {
        if (!teacher) return;
        setLoading(true);
        try {
            const data = await fetchAssignments(teacher.id, token);
            setAssignments(data);
        } catch (error) {
            console.error(error);
            toast.error("Error", { description: "Failed to load assignments" });
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch sections/subjects when grade changes
    useEffect(() => {
        if (selectedYear && selectedGrade) {
            // Load Sections (Assuming we can filter from global or fetch)
            // For now, let's filter from config.sections if available? 
            // Or usually we fetch sections for a grade. 
            // In existing user management we might have access to sections list.
            // Let's assume config.sections (all sections) is passed, or we assume generic filtering.
            // But we actually need to show all sections? Sections are usually school-wide or per-grade?
            // Existing model: Section has school_id, no explicit link to Grade in Section model directly (GradeSection link exists).
            // Let's try to assume all sections are valid for now or filter if we had grade-section map.
            // We will just show all sections for simplicity as per "common" usage, or improved if we had map.
            if (config?.sections) {
                setSectionOptions(config.sections);
            }

            // Load Subjects
            fetchSubjects(selectedYear, selectedGrade, token)
                .then(setSubjectOptions)
                .catch(err => console.error(err));

        }
    }, [selectedYear, selectedGrade, config]);


    const handleAdd = async () => {
        if (!selectedYear || !selectedGrade || !selectedSection || !selectedSubject) return;

        try {
            const res = await fetch("/api/teaching-assignments/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    teacher_user_id: teacher.id,
                    academic_year_id: selectedYear,
                    grade_id: selectedGrade,
                    section_id: selectedSection,
                    subject_id: selectedSubject,
                    is_class_teacher: false
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to add assignment");
            }

            toast.success("Success", { description: "Assignment added" });
            loadAssignments(); // Refresh
            // Reset subject but keep grade/section for fast entry?
            setSelectedSubject("");

        } catch (error) {
            toast.error("Error", { description: error.message });
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure?")) return;
        try {
            const res = await fetch(`/api/teaching-assignments/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to delete");

            setAssignments(assignments.filter(a => a.id !== id));
            toast.success("Removed", { description: "Assignment removed" });
        } catch (error) {
            toast.error("Error", { description: "Failed to remove" });
        }
    };

    const handleToggleClassTeacher = async (id, currentStatus) => {
        // Optimistic UI? No, wait server confirmation for complex exclusion check
        try {
            const res = await fetch(`/api/teaching-assignments/${id}/class-teacher`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ is_class_teacher: !currentStatus })
            });

            if (!res.ok) throw new Error("Failed to update");

            // Reload to reflect side-effects (unsetting others)
            loadAssignments();

        } catch (error) {
            toast.error("Error", { description: "Failed to update status" });
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={onClose}>
            <DrawerContent className="h-[85vh]">
                <div className="mx-auto w-full max-w-4xl flex flex-col h-full bg-white dark:bg-zinc-950">
                    <DrawerHeader>
                        <DrawerTitle>Teaching Assignments — {teacher?.name || teacher?.first_name}</DrawerTitle>
                        <DrawerDescription>
                            Assign classes and subjects to this teacher.
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-4 overflow-y-auto flex-1 space-y-6">
                        {/* 1. Add New */}
                        <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-lg border border-slate-200 dark:border-zinc-800 space-y-4">
                            <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Plus className="h-4 w-4" /> Add New Assignment
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <Label>Academic Year</Label>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {config?.academicYears?.map(y => (
                                                <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Grade</Label>
                                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {config?.grades?.map(g => (
                                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Section</Label>
                                    <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedGrade}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Section" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sectionOptions.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Subject</Label>
                                    <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedGrade}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Subject" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subjectOptions.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleAdd} disabled={!selectedSubject || !selectedSection}>Add Assignment</Button>
                            </div>
                        </div>

                        {/* 2. List */}
                        <div>
                            <h3 className="font-medium text-sm mb-3">Existing Assignments</h3>
                            {loading ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                            ) : assignments.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No assignments yet.</p>
                            ) : (
                                <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 dark:bg-zinc-900 border-b">
                                            <tr>
                                                <th className="p-3 font-medium">Grade & Section</th>
                                                <th className="p-3 font-medium">Subject</th>
                                                <th className="p-3 font-medium text-center">Class Teacher?</th>
                                                <th className="p-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {assignments.map(a => (
                                                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50">
                                                    <td className="p-3">
                                                        <span className="font-medium">{a.grade_name}</span> <span className="text-slate-500">— {a.section_name}</span>
                                                    </td>
                                                    <td className="p-3">{a.subject_name}</td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex justify-center">
                                                            <Switch
                                                                checked={a.is_class_teacher}
                                                                onCheckedChange={() => handleToggleClassTeacher(a.id, a.is_class_teacher)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <DrawerFooter>
                        <DrawerClose asChild>
                            <Button variant="outline">Close</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

export default AssignTeachingDrawer;
