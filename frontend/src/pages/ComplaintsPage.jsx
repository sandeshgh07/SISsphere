import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, AlertTriangle, AlertCircle, MessageSquare } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

export default function ComplaintsPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  
  const [complaints, setComplaints] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateComplaint, setShowCreateComplaint] = useState(false);
  
  // Form state
  const [newComplaint, setNewComplaint] = useState({
    student_id: "",
    title: "",
    description: "",
    severity: "low",
    visible_to_principal: true,
    visible_to_admin: false,
    visible_to_parents: false,
    visible_to_student: false,
    class_or_course_context: "",
  });

  const canCreateComplaint = user?.role === "teacher";
  const canViewAllComplaints = user?.role && ["principal", "school_admin"].includes(user.role);

  // Determine if user can see a specific complaint
  const canSeeComplaint = (complaint) => {
    // Principals see all
    if (user?.role === "principal") return true;
    
    // School admin sees if visible_to_admin
    if (user?.role === "school_admin" && complaint.visible_to_admin) return true;
    
    // Teacher sees their own complaints
    if (user?.role === "teacher" && complaint.teacher_id === user?.id) return true;
    
    // Parent sees if visible_to_parents
    if (user?.role === "parent" && complaint.visible_to_parents) return true;
    
    // Student sees if visible_to_student
    if (user?.role === "student" && complaint.visible_to_student) return true;
    
    return false;
  };

  useEffect(() => {
    if (!accessToken) return;
    loadData();
  }, [accessToken]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [complaintsRes, studentsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/complaints`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/students`, { headers }).catch(() => ({ data: [] })),
      ]);
      setComplaints(complaintsRes.data || []);
      setStudents(studentsRes.data || []);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateComplaint = async () => {
    if (!newComplaint.student_id || !newComplaint.title || !newComplaint.description) {
      toast({ title: "Error", description: "Student, title, and description are required", variant: "destructive" });
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/api/complaints`,
        {
          student_id: newComplaint.student_id,
          title: newComplaint.title,
          description: newComplaint.description,
          severity: newComplaint.severity,
          visible_to_principal: newComplaint.visible_to_principal,
          visible_to_admin: newComplaint.visible_to_admin,
          visible_to_parents: newComplaint.visible_to_parents,
          visible_to_student: newComplaint.visible_to_student,
          class_or_course_context: newComplaint.class_or_course_context || null,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Complaint created successfully" });
      setShowCreateComplaint(false);
      setNewComplaint({
        student_id: "",
        title: "",
        description: "",
        severity: "low",
        visible_to_principal: true,
        visible_to_admin: false,
        visible_to_parents: false,
        visible_to_student: false,
        class_or_course_context: "",
      });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to create complaint", variant: "destructive" });
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "high":
        return <Badge className="bg-red-600"><AlertTriangle className="w-3 h-3 mr-1" />High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-600"><AlertCircle className="w-3 h-3 mr-1" />Medium</Badge>;
      default:
        return <Badge className="bg-blue-600"><MessageSquare className="w-3 h-3 mr-1" />Low</Badge>;
    }
  };

  const getStudentName = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student ? `${student.first_name} ${student.last_name}` : studentId;
  };

  const getVisibilityDisplay = (complaint) => {
    const visible = [];
    if (complaint.visible_to_principal) visible.push("Principal");
    if (complaint.visible_to_admin) visible.push("Admin");
    if (complaint.visible_to_parents) visible.push("Parents");
    if (complaint.visible_to_student) visible.push("Student");
    return visible.join(", ") || "Private";
  };

  // Filter complaints based on user role visibility
  const visibleComplaints = complaints.filter(canSeeComplaint);

  return (
    <div className="space-y-6 col-span-full" data-testid="complaints-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100" data-testid="complaints-page-title">
          Complaints
        </h1>
        {canCreateComplaint && (
          <Button
            onClick={() => setShowCreateComplaint(true)}
            className="bg-blue-600 hover:bg-blue-500"
            data-testid="create-complaint-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Complaint
          </Button>
        )}
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="py-8 text-center">
              <p className="text-slate-400 text-sm">Loading complaints...</p>
            </CardContent>
          </Card>
        ) : visibleComplaints.length === 0 ? (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="py-8 text-center" data-testid="no-complaints">
              <p className="text-slate-500 text-sm">
                {canCreateComplaint 
                  ? "No complaints filed yet. Click 'Create Complaint' to add one." 
                  : "No complaints available to view."}
              </p>
            </CardContent>
          </Card>
        ) : (
          visibleComplaints.map((complaint) => (
            <Card
              key={complaint.id}
              className={`bg-slate-900 border-slate-700 ${
                complaint.severity === "high" ? "border-l-4 border-l-red-500" :
                complaint.severity === "medium" ? "border-l-4 border-l-yellow-500" : ""
              }`}
              data-testid={`complaint-card-${complaint.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-100 text-lg">{complaint.title}</CardTitle>
                  {getSeverityBadge(complaint.severity)}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                  <span>Student: {getStudentName(complaint.student_id)}</span>
                  <span>Visibility: {getVisibilityDisplay(complaint)}</span>
                  {complaint.class_or_course_context && (
                    <span>Context: {complaint.class_or_course_context}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{complaint.description}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Created: {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : "-"}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Complaint Modal */}
      <Dialog open={showCreateComplaint} onOpenChange={setShowCreateComplaint}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="complaint-student">Student *</Label>
              <Select value={newComplaint.student_id} onValueChange={(val) => setNewComplaint({ ...newComplaint, student_id: val })}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="complaint-title">Title *</Label>
              <Input
                id="complaint-title"
                value={newComplaint.title}
                onChange={(e) => setNewComplaint({ ...newComplaint, title: e.target.value })}
                placeholder="e.g., Disruptive behavior in class"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <Label htmlFor="complaint-description">Description *</Label>
              <textarea
                id="complaint-description"
                value={newComplaint.description}
                onChange={(e) => setNewComplaint({ ...newComplaint, description: e.target.value })}
                placeholder="Detailed description of the incident..."
                rows={4}
                className="w-full rounded-md bg-slate-800 border-slate-600 border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={newComplaint.severity} onValueChange={(val) => setNewComplaint({ ...newComplaint, severity: val })}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="complaint-context">Class/Course Context (optional)</Label>
              <Input
                id="complaint-context"
                value={newComplaint.class_or_course_context}
                onChange={(e) => setNewComplaint({ ...newComplaint, class_or_course_context: e.target.value })}
                placeholder="e.g., Mathematics Class - Grade 10"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <Label className="block mb-2">Visibility</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vis-principal"
                    checked={newComplaint.visible_to_principal}
                    onCheckedChange={(checked) =>
                      setNewComplaint({ ...newComplaint, visible_to_principal: checked })
                    }
                  />
                  <Label htmlFor="vis-principal" className="text-sm font-normal">Principal (always recommended)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vis-admin"
                    checked={newComplaint.visible_to_admin}
                    onCheckedChange={(checked) =>
                      setNewComplaint({ ...newComplaint, visible_to_admin: checked })
                    }
                  />
                  <Label htmlFor="vis-admin" className="text-sm font-normal">School Admin</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vis-parents"
                    checked={newComplaint.visible_to_parents}
                    onCheckedChange={(checked) =>
                      setNewComplaint({ ...newComplaint, visible_to_parents: checked })
                    }
                  />
                  <Label htmlFor="vis-parents" className="text-sm font-normal">Parents</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vis-student"
                    checked={newComplaint.visible_to_student}
                    onCheckedChange={(checked) =>
                      setNewComplaint({ ...newComplaint, visible_to_student: checked })
                    }
                  />
                  <Label htmlFor="vis-student" className="text-sm font-normal">Student</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateComplaint(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleCreateComplaint} className="bg-blue-600 hover:bg-blue-500" data-testid="confirm-create-complaint">
              Create Complaint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

