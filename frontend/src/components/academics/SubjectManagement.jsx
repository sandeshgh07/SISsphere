
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, BookOpen, History, Loader2, AlertTriangle, Search } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function SubjectManagement({ activeYear }) {
    const { accessToken } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Data
    const [subjects, setSubjects] = useState([]);
    const [grades, setGrades] = useState([]);

    // Filters
    const [selectedGradeId, setSelectedGradeId] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBookModal, setShowBookModal] = useState(false);

    // Forms
    const [newSubject, setNewSubject] = useState({
        name: "",
        code: "",
        is_elective: false,
        grade_id: "",
        book_title: "",
        book_publisher: "",
        book_authors: ""
    });

    const [selectedSubject, setSelectedSubject] = useState(null); // For book history
    const [bookVersionForm, setBookVersionForm] = useState({
        title: "",
        publisher: "",
        authors: "",
        edition: "",
        publication_year: new Date().getFullYear(),
        isbn: ""
    });
    const [bookHistory, setBookHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Initial Load
    useEffect(() => {
        if (accessToken) {
            fetchGrades();
        }
    }, [accessToken]);

    useEffect(() => {
        if (accessToken && activeYear) {
            fetchSubjects();
        }
    }, [accessToken, activeYear, selectedGradeId]);

    const fetchGrades = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/academics/grades`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setGrades(res.data);
        } catch (error) {
            console.error("Failed to fetch grades", error);
        }
    };

    const fetchSubjects = async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}/api/academics/grade-subjects?academic_year_id=${activeYear.id}`;
            if (selectedGradeId && selectedGradeId !== "all") {
                url += `&grade_id=${selectedGradeId}`;
            }
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setSubjects(res.data);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to load subjects", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubject = async () => {
        if (!newSubject.name || !newSubject.grade_id) {
            toast({ title: "Validation Error", description: "Name and Grade are required", variant: "destructive" });
            return;
        }

        try {
            const payload = {
                academic_year_id: activeYear.id,
                grade_id: newSubject.grade_id,
                name: newSubject.name,
                code: newSubject.code,
                type: newSubject.is_elective ? "ELECTIVE" : "CORE",
                book_title: newSubject.book_title || null,
                book_publisher: newSubject.book_publisher || null
                // Authors not supported by endpoint
            };

            await axios.post(`${API_BASE}/api/academics/grade-subjects`, payload, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            toast({ title: "Success", description: "Subject created successfully" });
            setShowAddModal(false);
            setNewSubject({
                name: "", code: "", is_elective: false, grade_id: "",
                book_title: "", book_publisher: "", book_authors: ""
            });
            fetchSubjects();
        } catch (error) {
            console.error(error);
            let msg = "Failed to create subject";
            if (error.response?.data?.detail) {
                const d = error.response.data.detail;
                msg = Array.isArray(d) ? d.map(e => e.msg).join(", ") : String(d);
            }
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    const openBookManager = async (subject) => {
        setSelectedSubject(subject);
        setShowBookModal(true);
        setLoadingHistory(true);
        try {
            const res = await axios.get(`${API_BASE}/api/academics/grade-subjects/${subject.id}/book-versions`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setBookHistory(res.data);
            // Pre-fill form with current active generic info if useful? No, blank for new version.
            setBookVersionForm({
                title: "",
                publisher: "",
                authors: "",
                edition: "",
                publication_year: new Date().getFullYear(),
                isbn: ""
            });
        } catch (e) {
            toast({ title: "Error", description: "Failed to load book history", variant: "destructive" });
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleAddBookVersion = async () => {
        if (!bookVersionForm.title) {
            toast({ title: "Validation", description: "Book Title is required", variant: "destructive" });
            return;
        }

        try {
            const payload = {
                ...bookVersionForm,
                authors: bookVersionForm.authors ? bookVersionForm.authors.split(",").map(a => a.trim()) : [],
                effective_from: new Date().toISOString().split('T')[0] // Today
            };

            await axios.post(`${API_BASE}/api/academics/grade-subjects/${selectedSubject.id}/book-versions`, payload, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            toast({ title: "Success", description: "New book version added" });

            // Refresh history
            const res = await axios.get(`${API_BASE}/api/academics/grade-subjects/${selectedSubject.id}/book-versions`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setBookHistory(res.data);
            setBookVersionForm({
                title: "", publisher: "", authors: "", edition: "", publication_year: new Date().getFullYear(), isbn: ""
            });
            fetchSubjects(); // Refresh main list to show new title

        } catch (e) {
            toast({ title: "Error", description: e.response?.data?.detail || "Failed", variant: "destructive" });
        }
    };

    // Filtered display
    const filteredSubjects = subjects.filter(s =>
        s.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.subject_code && s.subject_code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (!activeYear) {
        return (
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Please select or create an active Academic Year first.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex gap-4 items-center w-full md:w-auto">
                    <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
                        <SelectTrigger className="w-[180px] bg-white">
                            <SelectValue placeholder="Filter by Grade" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Grades</SelectItem>
                            {grades.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="relative w-full md:w-[250px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search subjects..."
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <Button onClick={() => setShowAddModal(true)} className="bg-[#800000] hover:bg-[#600000]">
                    <Plus className="w-4 h-4 mr-2" /> Add Subject
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Subject Name</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Current Book</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    <div className="flex justify-center items-center gap-2 text-slate-500">
                                        <Loader2 className="w-5 h-5 animate-spin" /> Loading subjects...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredSubjects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                    No subjects found for this selection.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSubjects.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium">{s.subject_name}</TableCell>
                                    <TableCell>{s.subject_code || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {grades.find(g => g.id === s.grade_id)?.name || "Unknown"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {s.is_elective ? <Badge variant="outline">Elective</Badge> : <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 shadow-none">Core</Badge>}
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                        {s.current_book_title ? (
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-blue-500" />
                                                <span className="truncate max-w-[200px]" title={s.current_book_title}>{s.current_book_title}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">No book assigned</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => openBookManager(s)} className="text-slate-600 hover:text-[#800000]">
                                            <History className="w-4 h-4 mr-2" /> Books
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Create Subject Modal */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="bg-white sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Add New Subject to Grade</DialogTitle>
                        <DialogDescription>
                            Create a subject for {activeYear.name}. You can assign a book immediately.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {/* Section 1: Subject Info */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider">Subject Details</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Subject Name *</Label>
                                    <Input
                                        placeholder="e.g. Science"
                                        value={newSubject.name}
                                        onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Grade Level *</Label>
                                    <Select
                                        value={newSubject.grade_id}
                                        onValueChange={v => setNewSubject({ ...newSubject, grade_id: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {grades.map(g => (
                                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Code (Optional)</Label>
                                    <Input
                                        placeholder="e.g. SCI-05"
                                        value={newSubject.code}
                                        onChange={e => setNewSubject({ ...newSubject, code: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center pt-8">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="elective"
                                            className="accent-[#800000] w-4 h-4"
                                            checked={newSubject.is_elective}
                                            onChange={e => setNewSubject({ ...newSubject, is_elective: e.target.checked })}
                                        />
                                        <Label htmlFor="elective" className="cursor-pointer">Check if Elective/Optional</Label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Book Info */}
                        <div className="space-y-4 border-t pt-4">
                            <h4 className="font-medium text-sm text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <BookOpen className="w-4 h-4" /> Initial Book (Optional)
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Book Title</Label>
                                    <Input
                                        placeholder="Starting Book Title"
                                        value={newSubject.book_title}
                                        onChange={e => setNewSubject({ ...newSubject, book_title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Publisher</Label>
                                    <Input
                                        placeholder="Publisher Name"
                                        value={newSubject.book_publisher}
                                        onChange={e => setNewSubject({ ...newSubject, book_publisher: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                        <Button onClick={handleCreateSubject} className="bg-[#800000] hover:bg-[#600000]">Create Subject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage Books Modal */}
            <Dialog open={showBookModal} onOpenChange={setShowBookModal}>
                <DialogContent className="bg-white sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Manage Books for {selectedSubject?.subject_name}</DialogTitle>
                        <DialogDescription>
                            Current Grade: {grades.find(g => g.id === selectedSubject?.grade_id)?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* New Version Form */}
                        <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-4">
                            <h4 className="font-semibold text-sm">Add New Book Version</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    placeholder="Title *"
                                    value={bookVersionForm.title}
                                    onChange={e => setBookVersionForm({ ...bookVersionForm, title: e.target.value })}
                                    className="bg-white"
                                />
                                <Input
                                    placeholder="Authors (comma separated)"
                                    value={bookVersionForm.authors}
                                    onChange={e => setBookVersionForm({ ...bookVersionForm, authors: e.target.value })}
                                    className="bg-white"
                                />
                                <Input
                                    placeholder="Publisher"
                                    value={bookVersionForm.publisher}
                                    onChange={e => setBookVersionForm({ ...bookVersionForm, publisher: e.target.value })}
                                    className="bg-white"
                                />
                                <Input
                                    placeholder="Edition (e.g. 2nd)"
                                    value={bookVersionForm.edition}
                                    onChange={e => setBookVersionForm({ ...bookVersionForm, edition: e.target.value })}
                                    className="bg-white"
                                />
                            </div>
                            <Button size="sm" onClick={handleAddBookVersion} className="w-full bg-slate-900">
                                <Plus className="w-4 h-4 mr-2" /> Add & Set Active
                            </Button>
                        </div>

                        {/* History List */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                <History className="w-4 h-4" /> Version History
                            </h4>
                            <div className="border border-slate-200 rounded max-h-[200px] overflow-y-auto">
                                {loadingHistory ? (
                                    <div className="p-4 text-center"><Loader2 className="animate-spin w-5 h-5 mx-auto" /></div>
                                ) : bookHistory.length === 0 ? (
                                    <div className="p-4 text-center text-slate-500 italic">No book history found.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-600 text-left sticky top-0">
                                            <tr>
                                                <th className="p-2 font-medium">Title</th>
                                                <th className="p-2 font-medium">Publisher</th>
                                                <th className="p-2 font-medium">Effective From</th>
                                                <th className="p-2 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bookHistory.map(b => (
                                                <tr key={b.id} className="border-t border-slate-100">
                                                    <td className="p-2 font-medium text-slate-900">{b.title}</td>
                                                    <td className="p-2 text-slate-500">{b.publisher || "-"}</td>
                                                    <td className="p-2 text-slate-500">{b.effective_from}</td>
                                                    <td className="p-2">
                                                        {b.is_active ?
                                                            <Badge className="bg-green-100 text-green-700 shadow-none hover:bg-green-100">Active</Badge> :
                                                            <span className="text-slate-400 text-xs">Archived</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
