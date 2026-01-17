import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Eye, Users, ShieldAlert, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Key, Trash2, Edit, UserX, UserCheck } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

// Phase 6.1: Updated gender options
const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export default function StudentsPage() {
  const navigate = useNavigate();
  const { accessToken, user, getEffectiveRole, isHydrated } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  // Phase 6.1: Enhanced student form with date_of_birth and notes
  // Phase 7D: Added login creation fields
  const [newStudent, setNewStudent] = useState({
    first_name: "",
    last_name: "",
    grade_id: "",
    section_id: "",
    roll_no: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    notes: "",
    create_login: true,
    login_password: "",
    force_password_change: true,  // Default ON for students
  });

  // For showing created login credentials
  const [createdCredentials, setCreatedCredentials] = useState(null);

  // Action modals state
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [originalStudent, setOriginalStudent] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showAssignParentModal, setShowAssignParentModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  const [parents, setParents] = useState([]);
  const [sections, setSections] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [justification, setJustification] = useState("");

  const effectiveRole = getEffectiveRole();
  const isPrincipal = effectiveRole === "principal";
  const isSchoolAdmin = effectiveRole === "school_admin";
  const isTeacher = effectiveRole === "teacher";
  const isParent = effectiveRole === "parent";
  const isAccountant = effectiveRole === "accountant";

  // Principal and School Admin can manage students
  const canCreate = isPrincipal;
  const canManage = isPrincipal || isSchoolAdmin;

  useEffect(() => {
    if (!isHydrated || !accessToken) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, accessToken]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [studentsRes, gradesRes, usersRes, sectionsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/students`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/grades`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/users`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/sections`, { headers }).catch(() => ({ data: [] })),
      ]);
      setStudents(studentsRes.data || []);
      setGrades(gradesRes.data || []);
      // Filter only parent users
      const parentUsers = (usersRes.data || []).filter(u => (u.roles || [u.role]).includes('parent'));
      setParents(parentUsers);
      setSections(sectionsRes.data || []);
    } catch (e) {
      console.error("[StudentsPage] Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async () => {
    if (!newStudent.first_name || !newStudent.last_name || !newStudent.grade_id) {
      toast({
        title: "Error",
        description: "First name, last name, and grade are required",
        variant: "destructive",
      });
      return;
    }

    // Validate section is selected (sections are required)
    if (!newStudent.section_id) {
      toast({
        title: "Error",
        description: "Section is required. Please select a section or create one in Grades & Sections.",
        variant: "destructive",
      });
      return;
    }

    // Validate login fields if creating login
    if (newStudent.create_login) {
      if (!newStudent.email) {
        toast({
          title: "Error",
          description: "Email is required when creating a login account",
          variant: "destructive",
        });
        return;
      }
      if (!newStudent.login_password || newStudent.login_password.length < 8) {
        toast({
          title: "Error",
          description: "Password must be at least 8 characters",
          variant: "destructive",
        });
        return;
      }
    }

    setCreating(true);
    try {
      await axios.post(
        `${API_BASE}/api/students`,
        {
          first_name: newStudent.first_name,
          last_name: newStudent.last_name,
          grade_id: newStudent.grade_id,
          section_id: newStudent.section_id || null,
          roll_no: newStudent.roll_no || null,
          email: newStudent.email || null,
          login_email: newStudent.email || null,  // Use email as login email
          phone: newStudent.phone || null,
          gender: newStudent.gender || null,
          date_of_birth: newStudent.date_of_birth || null,
          notes: newStudent.notes || null,
          create_login: newStudent.create_login,
          login_password: newStudent.login_password,
          force_password_change: newStudent.force_password_change,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      // Show credentials if login was created
      if (newStudent.create_login) {
        setCreatedCredentials({
          email: newStudent.email,
          password: newStudent.login_password,
          name: `${newStudent.first_name} ${newStudent.last_name}`,
          force_password_change: newStudent.force_password_change,
        });
      }

      toast({ title: "Success", description: "Student created successfully" });
      setShowCreateModal(false);
      setNewStudent({
        first_name: "",
        last_name: "",
        grade_id: "",
        section_id: "",
        roll_no: "",
        email: "",
        phone: "",
        gender: "",
        date_of_birth: "",
        notes: "",
        create_login: true,
        login_password: "",
        force_password_change: true,
      });
      loadData();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.detail || "Failed to create student",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // CSV Import functions
  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const rows = lines.slice(1).map((line, idx) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      row._rowIndex = idx + 2; // 1-indexed, +1 for header
      return row;
    });
    
    return { headers, rows };
  };

  const validateCSVRows = (rows) => {
    const errors = [];
    const gradeNameMap = {};
    grades.forEach(g => { 
      gradeNameMap[g.name.toLowerCase()] = g.id;
      gradeNameMap[String(g.level || g.name).toLowerCase()] = g.id;
    });

    rows.forEach((row, idx) => {
      const rowNum = row._rowIndex || idx + 2;
      
      if (!row.first_name) {
        errors.push({ row: rowNum, field: 'first_name', message: 'First name is required' });
      }
      if (!row.last_name) {
        errors.push({ row: rowNum, field: 'last_name', message: 'Last name is required' });
      }
      if (!row.grade) {
        errors.push({ row: rowNum, field: 'grade', message: 'Grade is required' });
      } else if (!gradeNameMap[row.grade.toLowerCase()]) {
        errors.push({ row: rowNum, field: 'grade', message: `Grade "${row.grade}" not found. Use grade name like "Grade 1" or level number` });
      }
      if (row.gender && !['male', 'female', 'prefer_not_to_say', 'm', 'f'].includes(row.gender.toLowerCase())) {
        errors.push({ row: rowNum, field: 'gender', message: 'Gender must be male, female, or prefer_not_to_say' });
      }
    });

    return errors;
  };

  const handleCSVFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast({ title: "Error", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const { headers, rows } = parseCSV(text);
      
      // Check required columns
      const requiredCols = ['first_name', 'last_name', 'grade'];
      const missingCols = requiredCols.filter(c => !headers.includes(c));
      if (missingCols.length > 0) {
        toast({ 
          title: "Error", 
          description: `Missing required columns: ${missingCols.join(', ')}`,
          variant: "destructive" 
        });
        return;
      }
      
      setCsvFile(file);
      setCsvPreview(rows.slice(0, 5)); // Preview first 5 rows
      setCsvErrors(validateCSVRows(rows));
    };
    reader.readAsText(file);
  };

  const handleCSVImport = async () => {
    if (!csvFile) return;
    
    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result;
        const { rows } = parseCSV(text);
        
        // Map grade names to IDs
        const gradeNameMap = {};
        grades.forEach(g => { 
          gradeNameMap[g.name.toLowerCase()] = g.id;
          gradeNameMap[String(g.level || g.name).toLowerCase()] = g.id;
        });
        
        const genderMap = { 'm': 'male', 'f': 'female', 'male': 'male', 'female': 'female', 'prefer_not_to_say': 'prefer_not_to_say' };
        
        let successCount = 0;
        let errorCount = 0;
        const importErrors = [];
        
        for (const row of rows) {
          try {
            const gradeId = gradeNameMap[row.grade.toLowerCase()];
            if (!gradeId) {
              importErrors.push(`Row ${row._rowIndex}: Grade "${row.grade}" not found`);
              errorCount++;
              continue;
            }
            
            await axios.post(
              `${API_BASE}/api/students`,
              {
                first_name: row.first_name,
                last_name: row.last_name,
                grade_id: gradeId,
                gender: genderMap[row.gender?.toLowerCase()] || null,
                date_of_birth: row.dob || row.date_of_birth || null,
                roll_no: row.roll_no || null,
                email: row.email || null,
                phone: row.phone || null,
              },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            successCount++;
          } catch (e) {
            importErrors.push(`Row ${row._rowIndex}: ${e.response?.data?.detail || 'Failed to import'}`);
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          toast({ 
            title: "Import Complete", 
            description: `${successCount} students imported${errorCount > 0 ? `, ${errorCount} failed` : ''}` 
          });
          loadData();
        }
        
        if (importErrors.length > 0) {
          setCsvErrors(importErrors.map((msg, i) => ({ row: i, message: msg })));
        } else {
          setShowImportModal(false);
          setCsvFile(null);
          setCsvPreview([]);
          setCsvErrors([]);
        }
        
        setImporting(false);
      };
      reader.readAsText(csvFile);
    } catch (e) {
      toast({ title: "Error", description: "Failed to import CSV", variant: "destructive" });
      setImporting(false);
    }
  };

  // Phase 7C: CSV Export function
  const handleExportCSV = () => {
    if (students.length === 0) {
      toast({ title: "No Data", description: "No students to export", variant: "destructive" });
      return;
    }
    
    // Build CSV content
    const headers = ["first_name", "last_name", "grade", "section", "roll_no", "gender", "date_of_birth", "email", "phone", "status"];
    const rows = students.map(s => [
      s.first_name || "",
      s.last_name || "",
      getGradeName(s.grade_id),
      s.section_id || "",
      s.roll_no || "",
      s.gender || "",
      s.date_of_birth ? new Date(s.date_of_birth).toISOString().split("T")[0] : "",
      s.email || "",
      s.phone || "",
      s.status || "active",
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    
    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `students_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: `Exported ${students.length} students` });
  };

  const getGradeName = (gradeId) => {
    const grade = grades.find((g) => g.id === gradeId);
    return grade?.name || "Not assigned";
  };

  const getSectionName = (sectionId) => {
    if (!sectionId) return "";
    const section = sections.find((s) => s.id === sectionId);
    return section?.name || "";
  };

  const getGradeWithSection = (student) => {
    const gradeName = getGradeName(student.grade_id);
    const sectionName = getSectionName(student.section_id);
    return sectionName ? `${gradeName} (${sectionName})` : gradeName;
  };

  // Action handlers
  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE}/api/students/${selectedStudent.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      toast({ title: "Success", description: "Student deleted" });
      setShowDeleteModal(false);
      setSelectedStudent(null);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to delete", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedStudent || !newPassword) return;
    setActionLoading(true);
    try {
      // Find user by student_id
      const userRes = await axios.get(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const studentUser = (userRes.data || []).find(u => u.student_id === selectedStudent.id);
      if (!studentUser) {
        toast({ title: "Error", description: "No login account found for this student", variant: "destructive" });
        setActionLoading(false);
        return;
      }
      await axios.post(`${API_BASE}/api/users/${studentUser.id}/reset-password`, 
        { new_password: newPassword },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Password reset successfully" });
      setShowResetPasswordModal(false);
      setNewPassword("");
      setSelectedStudent(null);
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to reset password", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (student, reason = null) => {
    setActionLoading(true);
    try {
      const newStatus = student.status === "active" ? "inactive" : "active";
      const payload = { status: newStatus };
      if (reason) payload.reason = reason;

      await axios.patch(`${API_BASE}/api/students/${student.id}`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: `Student ${newStatus === "active" ? "enabled" : "disabled"}` });
      setShowDeactivateModal(false);
      setJustification("");
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);
    try {
      await axios.patch(`${API_BASE}/api/students/${selectedStudent.id}`,
        {
            grade_id: selectedStudent.grade_id,
            section_id: selectedStudent.section_id || null,
            reason: justification
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Student updated" });
      setShowEditModal(false);
      setSelectedStudent(null);
      setJustification("");
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to update", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignParents = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);
    try {
      await axios.patch(`${API_BASE}/api/students/${selectedStudent.id}`,
        { parent_ids: selectedParentIds },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Parents assigned" });
      setShowAssignParentModal(false);
      setSelectedStudent(null);
      setSelectedParentIds([]);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to assign parents", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter students by search
  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const gradeName = getGradeName(s.grade_id).toLowerCase();
    return (
      fullName.includes(query) ||
      gradeName.includes(query) ||
      (s.roll_no && s.roll_no.toLowerCase().includes(query))
    );
  });

  // Loading state
  if (!isHydrated || loading) {
    return (
      <div className="col-span-full space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-32 bg-slate-700 rounded animate-pulse" />
          <div className="h-10 w-32 bg-slate-700 rounded animate-pulse" />
        </div>
        <Card className="bg-slate-900 border-slate-700 animate-pulse">
          <CardContent className="py-20" />
        </Card>
      </div>
    );
  }

  // Role-based info message
  const getRoleMessage = () => {
    if (isTeacher) {
      const assignedGrades = user?.grade_assignments || [];
      if (assignedGrades.length === 0) {
        return "You are not assigned to any grades. Contact your principal for grade assignments.";
      }
      const gradeNames = assignedGrades
        .map((id) => grades.find((g) => g.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      return `Showing students from your assigned grades: ${gradeNames || "Loading..."}`;
    }
    if (isParent) {
      return "Showing your children's profiles.";
    }
    if (isAccountant) {
      return "Showing all students for fee management.";
    }
    return null;
  };

  const roleMessage = getRoleMessage();

  return (
    <div className="col-span-full space-y-6" data-testid="students-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100" data-testid="students-page-title">
          Students
        </h1>
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                className="border-slate-600 text-slate-300"
                data-testid="export-students-button"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => setShowImportModal(true)}
                variant="outline"
                className="border-slate-600 text-slate-300"
                data-testid="import-students-button"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-500"
                data-testid="create-student-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Student
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Role-based info banner */}
      {roleMessage && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-400" />
            <p className="text-sm text-slate-300">{roleMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Students List */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-slate-100">
            {isPrincipal ? "All Students" : isTeacher ? "My Students" : isParent ? "My Children" : "Students"}
          </CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, grade, roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
              data-testid="students-search-input"
            />
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-12" data-testid="students-empty-state">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">
                {isTeacher && (user?.grade_assignments?.length === 0)
                  ? "No students to display. You are not assigned to any grades."
                  : isParent
                  ? "No children linked to your account."
                  : "No students found."}
              </p>
              {canCreate && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 bg-blue-600 hover:bg-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Student
                </Button>
              )}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No students match your search &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" data-testid="students-table">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 text-left">Name</th>
                    <th className="py-2 text-left">Roll No</th>
                    <th className="py-2 text-left">Grade (Section)</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-slate-800 text-slate-100 hover:bg-slate-800/50"
                      data-testid={`student-row-${student.id}`}
                    >
                      <td className="py-3 font-medium">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="py-3 text-slate-300">{student.roll_no || "-"}</td>
                      <td className="py-3 text-slate-300">{getGradeWithSection(student)}</td>
                      <td className="py-3">
                        <Badge
                          variant="outline"
                          className={
                            student.status === "active"
                              ? "bg-green-900/30 text-green-400 border-green-700"
                              : "bg-slate-800 text-slate-400 border-slate-600"
                          }
                        >
                          {student.status || "Active"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/school/students/${student.id}`)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 h-8 w-8 p-0"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canManage && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setOriginalStudent(student); setSelectedStudent(student); setShowEditModal(true); }}
                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 h-8 w-8 p-0"
                                title="Edit Grade/Section"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedStudent(student); setSelectedParentIds(student.parent_ids || []); setShowAssignParentModal(true); }}
                                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30 h-8 w-8 p-0"
                                title="Assign Parents"
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedStudent(student); setShowResetPasswordModal(true); }}
                                className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 h-8 w-8 p-0"
                                title="Reset Password"
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (student.status === "active") {
                                    setSelectedStudent(student);
                                    setShowDeactivateModal(true);
                                  } else {
                                    handleToggleStatus(student);
                                  }
                                }}
                                disabled={actionLoading}
                                className={student.status === "active" ? "text-orange-400 hover:text-orange-300 hover:bg-orange-900/30 h-8 w-8 p-0" : "text-green-400 hover:text-green-300 hover:bg-green-900/30 h-8 w-8 p-0"}
                                title={student.status === "active" ? "Disable" : "Enable"}
                              >
                                {student.status === "active" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedStudent(student); setShowDeleteModal(true); }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/30 h-8 w-8 p-0"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Student Modal - Principal Only */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={newStudent.first_name}
                  onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })}
                  placeholder="John"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={newStudent.last_name}
                  onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })}
                  placeholder="Doe"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>

            {/* Date of Birth and Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={newStudent.date_of_birth}
                  onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={newStudent.gender}
                  onValueChange={(val) => setNewStudent({ ...newStudent, gender: val })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grade Selection */}
            <div>
              <Label htmlFor="grade_id">Grade *</Label>
              <Select
                value={newStudent.grade_id}
                onValueChange={(val) => setNewStudent({ ...newStudent, grade_id: val, section_id: "" })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {grades
                    .filter((g) => g.is_active)
                    .sort((a, b) => (a.order_index ?? a.level ?? 0) - (b.order_index ?? b.level ?? 0))
                    .map((grade) => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Selection - School-wide sections (shown after grade selected) */}
            {newStudent.grade_id && (
              <div>
                <Label htmlFor="section_id">Section *</Label>
                {sections.filter((s) => s.is_active !== false).length === 0 ? (
                  <div className="mt-1 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                    <p className="text-sm text-amber-400">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      No sections defined. Please create sections in <strong>Grades & Sections</strong> before adding students.
                    </p>
                  </div>
                ) : (
                  <>
                    <Select
                      value={newStudent.section_id || ""}
                      onValueChange={(val) => setNewStudent({ ...newStudent, section_id: val })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-600">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {sections
                          .filter((s) => s.is_active !== false)
                          .map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">Sections are school-wide and shared across all grades.</p>
                  </>
                )}
              </div>
            )}

            {/* Roll No */}
            <div>
              <Label htmlFor="roll_no">Roll No</Label>
              <Input
                id="roll_no"
                value={newStudent.roll_no}
                onChange={(e) => setNewStudent({ ...newStudent, roll_no: e.target.value })}
                placeholder="001"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            {/* Contact Info - Optional */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  placeholder="student@example.com"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  placeholder="+977-"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>

            {/* Notes - Optional */}
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={newStudent.notes}
                onChange={(e) => setNewStudent({ ...newStudent, notes: e.target.value })}
                placeholder="Any additional information..."
                className="bg-slate-800 border-slate-600 min-h-[80px]"
              />
            </div>

            {/* Phase 7D: Login Creation */}
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-slate-200">Create Login Account</Label>
                  <p className="text-xs text-slate-400">Allow student to login to the system</p>
                </div>
                <Switch
                  checked={newStudent.create_login}
                  onCheckedChange={(checked) => setNewStudent({ ...newStudent, create_login: checked })}
                />
              </div>
              {newStudent.create_login && (
                <div className="bg-slate-800 rounded-lg p-3 space-y-3">
                  <div>
                    <Label className="text-xs text-slate-400">Login Email *</Label>
                    <Input
                      type="email"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                      placeholder="student@example.com"
                      className="bg-slate-900 border-slate-600 mt-1"
                      required
                    />
                    <p className="text-xs text-amber-400 mt-1">This email will be used to log in. Must be unique.</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Password * (min 8 characters)</Label>
                    <Input
                      type="text"
                      value={newStudent.login_password}
                      onChange={(e) => setNewStudent({ ...newStudent, login_password: e.target.value })}
                      placeholder="Minimum 8 characters"
                      className="bg-slate-900 border-slate-600 mt-1"
                      required
                    />
                    {newStudent.login_password && newStudent.login_password.length < 8 && (
                      <p className="text-xs text-red-400 mt-1">Password must be at least 8 characters</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      id="force_password_change"
                      checked={newStudent.force_password_change !== false}
                      onCheckedChange={(checked) => setNewStudent({ ...newStudent, force_password_change: checked })}
                    />
                    <Label htmlFor="force_password_change" className="text-xs text-slate-400 cursor-pointer">
                      Force password change on first login
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStudent}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-500"
              data-testid="confirm-create-student"
            >
              {creating ? "Creating..." : "Create Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Modal - Phase 7D */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Student Created with Login
            </DialogTitle>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4 py-4">
              <p className="text-slate-300">Student <strong>{createdCredentials.name}</strong> has been created with login credentials:</p>
              <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-400 text-sm">Login Email:</span>
                  <code className="text-green-400 bg-slate-900 px-2 py-1 rounded">{createdCredentials.email}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-400 text-sm">Password:</span>
                  <code className="text-green-400 bg-slate-900 px-2 py-1 rounded">{createdCredentials.password}</code>
                </div>
              </div>
              <p className="text-xs text-amber-400">Please save these credentials. The password cannot be retrieved later.</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedCredentials(null)} className="bg-green-600 hover:bg-green-500">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={showImportModal} onOpenChange={(open) => { 
        setShowImportModal(open);
        if (!open) { setCsvFile(null); setCsvPreview([]); setCsvErrors([]); }
      }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-400" />
              Import Students from CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Instructions */}
            <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
              <p className="text-slate-300 font-medium">Required columns:</p>
              <code className="text-xs text-green-400 bg-slate-900 px-2 py-1 rounded">
                first_name, last_name, grade
              </code>
              <p className="text-slate-400">Optional: gender, dob (YYYY-MM-DD), roll_no, email, phone</p>
              <p className="text-slate-400">Example: <code className="text-xs bg-slate-900 px-1 rounded">John,Doe,Grade 1,male,2015-05-15</code></p>
            </div>

            {/* File Upload */}
            <div>
              <label 
                className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-500 transition-colors"
              >
                <Upload className="h-8 w-8 text-slate-400" />
                <span className="text-sm text-slate-300">
                  {csvFile ? csvFile.name : "Click to upload CSV file"}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVFileSelect}
                  className="hidden"
                  data-testid="csv-file-input"
                />
              </label>
            </div>

            {/* Preview */}
            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-300 font-medium">Preview (first 5 rows):</p>
                <div className="bg-slate-800 rounded-lg overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="py-2 px-3 text-left text-slate-400">Row</th>
                        <th className="py-2 px-3 text-left text-slate-400">First Name</th>
                        <th className="py-2 px-3 text-left text-slate-400">Last Name</th>
                        <th className="py-2 px-3 text-left text-slate-400">Grade</th>
                        <th className="py-2 px-3 text-left text-slate-400">Gender</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-700">
                          <td className="py-2 px-3 text-slate-500">{row._rowIndex}</td>
                          <td className="py-2 px-3 text-slate-100">{row.first_name}</td>
                          <td className="py-2 px-3 text-slate-100">{row.last_name}</td>
                          <td className="py-2 px-3 text-slate-100">{row.grade}</td>
                          <td className="py-2 px-3 text-slate-100">{row.gender || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {csvErrors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-red-400 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Validation Errors ({csvErrors.length})
                </p>
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {csvErrors.slice(0, 10).map((err, idx) => (
                    <p key={idx} className="text-xs text-red-300">
                      Row {err.row}: {err.message || err}
                    </p>
                  ))}
                  {csvErrors.length > 10 && (
                    <p className="text-xs text-red-400 mt-1">...and {csvErrors.length - 10} more errors</p>
                  )}
                </div>
              </div>
            )}

            {/* Success state */}
            {csvFile && csvErrors.length === 0 && csvPreview.length > 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>CSV validated successfully. Ready to import.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowImportModal(false); setCsvFile(null); setCsvPreview([]); setCsvErrors([]); }}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCSVImport}
              disabled={importing || !csvFile || csvErrors.length > 0}
              className="bg-green-600 hover:bg-green-500"
              data-testid="confirm-csv-import"
            >
              {importing ? "Importing..." : "Import Students"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Student Modal */}
      <Dialog open={showDeactivateModal} onOpenChange={setShowDeactivateModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-orange-400">Deactivate Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300">
              Are you sure you want to deactivate <strong>{selectedStudent?.first_name} {selectedStudent?.last_name}</strong>?
            </p>
            <div>
              <Label>Justification * (Min 10 chars)</Label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Reason for deactivation..."
                className="flex w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">{justification.length}/10</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeactivateModal(false)} className="border-slate-600">Cancel</Button>
            <Button
              onClick={() => handleToggleStatus(selectedStudent, justification)}
              disabled={actionLoading || justification.length < 10}
              className="bg-orange-600 hover:bg-orange-500"
            >
              {actionLoading ? "Processing..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Student</DialogTitle>
          </DialogHeader>
          <p className="text-slate-300">Are you sure you want to delete <strong>{selectedStudent?.first_name} {selectedStudent?.last_name}</strong>? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="border-slate-600">Cancel</Button>
            <Button onClick={handleDeleteStudent} disabled={actionLoading} className="bg-red-600 hover:bg-red-500">
              {actionLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Grade/Section Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit Grade/Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Grade *</Label>
              <Select value={selectedStudent?.grade_id || ""} onValueChange={(val) => setSelectedStudent(s => ({ ...s, grade_id: val }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {grades.filter(g => g.is_active).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Section *</Label>
              <Select value={selectedStudent?.section_id || ""} onValueChange={(val) => setSelectedStudent(s => ({ ...s, section_id: val }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {sections.filter(s => s.is_active !== false).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Sections are school-wide and shared across all grades.</p>
            </div>
            {originalStudent?.section_id && (
              <div>
                <Label>Justification * (Min 10 chars)</Label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain why you are changing the grade/section..."
                  className="flex w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">{justification.length}/10</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} className="border-slate-600">Cancel</Button>
            <Button
                onClick={handleUpdateStudent}
                disabled={actionLoading || (originalStudent?.section_id && justification.length < 10)}
                className="bg-blue-600 hover:bg-blue-500"
            >
              {actionLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={showResetPasswordModal} onOpenChange={setShowResetPasswordModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>New Password</Label>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="bg-slate-800 border-slate-600 mt-2" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetPasswordModal(false); setNewPassword(""); }} className="border-slate-600">Cancel</Button>
            <Button onClick={handleResetPassword} disabled={actionLoading || !newPassword} className="bg-purple-600 hover:bg-purple-500">
              {actionLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Parents Modal */}
      <Dialog open={showAssignParentModal} onOpenChange={setShowAssignParentModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Assign Parents</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-60 overflow-y-auto space-y-2">
            {parents.length === 0 ? (
              <p className="text-slate-500 text-sm">No parent users available.</p>
            ) : (
              parents.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedParentIds.includes(p.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedParentIds([...selectedParentIds, p.id]);
                      else setSelectedParentIds(selectedParentIds.filter(id => id !== p.id));
                    }}
                  />
                  <span className="text-slate-300">{p.full_name} ({p.email})</span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignParentModal(false)} className="border-slate-600">Cancel</Button>
            <Button onClick={handleAssignParents} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-500">
              {actionLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

