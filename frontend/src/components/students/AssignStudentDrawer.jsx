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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2, Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import axios from 'axios';

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

const AssignStudentDrawer = ({ isOpen, onClose, parent, token }) => {
    const [assignedStudents, setAssignedStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Load initial assignments when drawer opens
    useEffect(() => {
        if (isOpen && parent) {
            loadAssignedStudents();
            setSearchQuery("");
            setSearchResults([]);
        }
    }, [isOpen, parent]);

    const loadAssignedStudents = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/students/parents/${parent.id}/students`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAssignedStudents(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load assigned students");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const res = await axios.get(`${API_BASE}/api/students?q=${searchQuery}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Filter out already assigned students from search results visually? 
            // Better to show them as "Assigned" or filter them out of results list.
            setSearchResults(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Search failed");
        } finally {
            setSearching(false);
        }
    };

    const handleAssign = (student) => {
        // Add to local state (assignedStudents)
        // Check duplicate
        if (assignedStudents.some(s => s.id === student.id)) return;
        setAssignedStudents([...assignedStudents, student]);
    };

    const handleRemove = (studentId) => {
        setAssignedStudents(assignedStudents.filter(s => s.id !== studentId));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const studentIds = assignedStudents.map(s => s.id);
            await axios.put(`${API_BASE}/api/students/parents/${parent.id}/students`, {
                student_ids: studentIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Assignments updated successfully");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save assignments");
        } finally {
            setLoading(false);
        }
    };

    const isAssigned = (studentId) => assignedStudents.some(s => s.id === studentId);

    return (
        <Drawer open={isOpen} onOpenChange={onClose}>
            <DrawerContent className="h-[85vh]">
                <div className="mx-auto w-full max-w-4xl flex flex-col h-full bg-white">
                    <DrawerHeader>
                        <DrawerTitle className="text-red-900">Assign Students — {parent?.full_name}</DrawerTitle>
                        <DrawerDescription>
                            Manage students linked to this parent account.
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-4 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
                        {/* LEFT: Current Assignments */}
                        <div className="flex-1 space-y-4">
                            <h3 className="font-medium text-sm text-red-900 border-b border-red-100 pb-2">Assigned Students ({assignedStudents.length})</h3>

                            {loading && assignedStudents.length === 0 ? (
                                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-red-900" /></div>
                            ) : assignedStudents.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No students assigned yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {assignedStudents.map(student => (
                                        <div key={student.id} className="flex items-center justify-between p-3 border border-red-50 rounded-md bg-white hover:bg-red-50/30 group transition-colors">
                                            <div>
                                                <div className="font-medium text-sm text-slate-900">{student.first_name} {student.last_name}</div>
                                                <div className="text-xs text-slate-500">{student.grade_name} - {student.section_name} ({student.roll_number})</div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => handleRemove(student.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Search & Add */}
                        <div className="flex-1 space-y-4 border-l border-slate-100 pl-0 md:pl-6">
                            <h3 className="font-medium text-sm text-red-900 border-b border-red-100 pb-2">Search Students</h3>

                            <form onSubmit={handleSearch} className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by name, email..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-9 border-slate-200 focus:border-red-900 focus:ring-red-900"
                                    />
                                </div>
                                <Button type="submit" disabled={searching} className="bg-red-900 hover:bg-red-800 text-white">
                                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                                </Button>
                            </form>

                            <div className="space-y-2 h-[300px] overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    searchResults.map(student => (
                                        <div key={student.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                                            <div>
                                                <div className="font-medium text-sm text-slate-900">{student.first_name} {student.last_name}</div>
                                                <div className="text-xs text-slate-500">{student.grade_name} - {student.section_name}</div>
                                            </div>
                                            {isAssigned(student.id) ? (
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Assigned</Badge>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => handleAssign(student)} className="h-7 text-xs border-red-200 text-red-900 hover:bg-red-50 hover:text-red-900">
                                                    <Plus className="h-3 w-3 mr-1" /> Add
                                                </Button>
                                            )}
                                        </div>
                                    ))
                                ) : searchQuery && !searching ? (
                                    <p className="text-sm text-slate-500 text-center py-4">No results found.</p>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <DrawerFooter className="border-t border-slate-100 pt-4">
                        <div className="flex justify-end gap-2">
                            <DrawerClose asChild>
                                <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</Button>
                            </DrawerClose>
                            <Button onClick={handleSave} disabled={loading} className="bg-red-900 hover:bg-red-800 text-white">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
};

export default AssignStudentDrawer;
