import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Layers, AlertTriangle, Trash2, GraduationCap, LayoutGrid } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

export default function GradesManagementPage() {
  const { accessToken, getEffectiveRole } = useAuth();
  const { toast } = useToast();

  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateGradeModal, setShowCreateGradeModal] = useState(false);
  const [showEditGradeModal, setShowEditGradeModal] = useState(false);
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false);
  const [showEditSectionModal, setShowEditSectionModal] = useState(false);

  const [newGrade, setNewGrade] = useState({ name: "", description: "" });
  const [editingGrade, setEditingGrade] = useState(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [editingSection, setEditingSection] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const effectiveRole = getEffectiveRole();
  const isPrincipal = effectiveRole === "principal";

  useEffect(() => {
    loadData();
  }, [accessToken]);

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [gradesRes, sectionsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/grades?active_only=false`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        axios.get(`${API_BASE}/api/sections?active_only=false`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      setGrades(gradesRes.data || []);
      setSections(sectionsRes.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load grades/sections", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Sort grades by order_index
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999));
  }, [grades]);

  // Grade CRUD
  const handleCreateGrade = async () => {
    if (!newGrade.name.trim()) {
      toast({ title: "Error", description: "Grade name is required", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      await axios.post(
        `${API_BASE}/api/grades`,
        { name: newGrade.name, description: newGrade.description || null },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Grade created successfully" });
      setShowCreateGradeModal(false);
      setNewGrade({ name: "", description: "" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || "Failed to create grade", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateGrade = async () => {
    if (!editingGrade?.name?.trim()) {
      toast({ title: "Error", description: "Grade name is required", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      await axios.patch(
        `${API_BASE}/api/grades/${editingGrade.id}`,
        { name: editingGrade.name, description: editingGrade.description },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Grade updated successfully" });
      setShowEditGradeModal(false);
      setEditingGrade(null);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || "Failed to update grade", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleGradeActive = async (grade) => {
    try {
      const endpoint = grade.is_active
        ? `${API_BASE}/api/grades/${grade.id}/disable`
        : `${API_BASE}/api/grades/${grade.id}/enable`;
      await axios.post(endpoint, {}, { headers: { Authorization: `Bearer ${accessToken}` } });
      toast({ title: "Success", description: `Grade ${grade.is_active ? "disabled" : "enabled"}` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || "Failed to toggle grade", variant: "destructive" });
    }
  };

  // Section CRUD (School-wide)
  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      toast({ title: "Error", description: "Section name is required", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      await axios.post(
        `${API_BASE}/api/sections`,
        { name: newSectionName.trim() },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Section created successfully" });
      setShowCreateSectionModal(false);
      setNewSectionName("");
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || "Failed to create section", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSection = async () => {
    if (!editingSection?.name?.trim()) {
      toast({ title: "Error", description: "Section name is required", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      await axios.patch(
        `${API_BASE}/api/sections/${editingSection.id}`,
        { name: editingSection.name.trim() },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Section updated successfully" });
      setShowEditSectionModal(false);
      setEditingSection(null);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || "Failed to update section", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSection = async (section) => {
    if (!window.confirm(`Are you sure you want to delete section "${section.name}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/api/sections/${section.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      toast({ title: "Success", description: "Section deleted" });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || "Failed to delete section", variant: "destructive" });
    }
  };

  if (!isPrincipal) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-100">Access Denied</h2>
        <p className="text-slate-400 mt-2">Only the Principal can manage grades and sections.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
        <p className="text-slate-400 mt-4">Loading grades and sections...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Layers className="h-8 w-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Grades & Sections</h1>
          <p className="text-sm text-slate-400">Manage academic structure for your school</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRADES PANEL */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-lg text-slate-100">Grades</CardTitle>
            </div>
            <Button
              onClick={() => setShowCreateGradeModal(true)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Grade
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-4">
              Default grades (Nursery-12) are auto-created. You can add custom grades if needed.
            </p>
            {sortedGrades.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No grades found.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
                {sortedGrades.map((grade) => (
                  <div
                    key={grade.id}
                    className={`flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 ${!grade.is_active ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-medium">{grade.name}</span>
                      {!grade.is_active && (
                        <Badge variant="outline" className="text-xs text-amber-400 border-amber-600">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditingGrade({ ...grade });
                          setShowEditGradeModal(true);
                        }}
                        title="Edit grade"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                      <Switch
                        checked={grade.is_active}
                        onCheckedChange={() => handleToggleGradeActive(grade)}
                        className="data-[state=checked]:bg-emerald-600 scale-75"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SECTIONS PANEL (School-wide) */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-lg text-slate-100">Sections</CardTitle>
            </div>
            <Button
              onClick={() => setShowCreateSectionModal(true)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Section
            </Button>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-300">
                <strong>Sections are school-wide.</strong> All grades share the same section set.
                Use any naming style: A, B, C or Red, Green, Blue or Morning, Day, etc.
              </p>
            </div>
            {sections.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No sections defined yet.</p>
                <p className="text-xs text-slate-500 mt-1">Add sections to organize students within grades.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={`flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700 ${!section.is_active ? "opacity-50" : ""}`}
                  >
                    <span className="text-slate-100 font-medium">{section.name}</span>
                    <div className="flex items-center gap-0.5 ml-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setEditingSection({ ...section });
                          setShowEditSectionModal(true);
                        }}
                        title="Edit section"
                      >
                        <Edit2 className="h-3 w-3 text-slate-400" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                        onClick={() => handleDeleteSection(section)}
                        title="Delete section"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="py-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2">How it works:</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• <strong>Grades</strong> are auto-seeded (Nursery, L.K.G, U.K.G, 1-12) when your school is created.</li>
            <li>• <strong>Sections</strong> are school-wide and shared across all grades (e.g., Section A exists for Grade 1, Grade 2, etc.).</li>
            <li>• When creating a student, select both a <strong>Grade</strong> and a <strong>Section</strong>.</li>
            <li>• Teachers are assigned to <strong>Grades only</strong> (not sections) and can see all students in their assigned grades.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Create Grade Modal */}
      <Dialog open={showCreateGradeModal} onOpenChange={setShowCreateGradeModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Create New Grade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Grade Name *</Label>
              <Input
                value={newGrade.name}
                onChange={(e) => setNewGrade({ ...newGrade, name: e.target.value })}
                placeholder="e.g., 11 Science, Pre-Primary"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Input
                value={newGrade.description}
                onChange={(e) => setNewGrade({ ...newGrade, description: e.target.value })}
                placeholder="Optional description"
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateGradeModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGrade} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
              {actionLoading ? "Creating..." : "Create Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Grade Modal */}
      <Dialog open={showEditGradeModal} onOpenChange={setShowEditGradeModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Grade</DialogTitle>
          </DialogHeader>
          {editingGrade && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                <p className="text-sm text-amber-400">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Renaming a grade will affect all students currently assigned to it.
                </p>
              </div>
              <div>
                <Label>Grade Name *</Label>
                <Input
                  value={editingGrade.name}
                  onChange={(e) => setEditingGrade({ ...editingGrade, name: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={editingGrade.description || ""}
                  onChange={(e) => setEditingGrade({ ...editingGrade, description: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditGradeModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGrade} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Section Modal (School-wide) */}
      <Dialog open={showCreateSectionModal} onOpenChange={setShowCreateSectionModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Create New Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              This section will be available for <strong>all grades</strong> in your school.
            </p>
            <div>
              <Label>Section Name *</Label>
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., A, B, Red, Blue, Morning"
                className="bg-slate-800 border-slate-600"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use any naming style: A/B/C, 1/2/3, Red/Blue, Morning/Day, etc.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateSectionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSection} disabled={actionLoading || !newSectionName.trim()} className="bg-blue-600 hover:bg-blue-700">
              {actionLoading ? "Creating..." : "Create Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Modal */}
      <Dialog open={showEditSectionModal} onOpenChange={setShowEditSectionModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Section</DialogTitle>
          </DialogHeader>
          {editingSection && (
            <div className="space-y-4">
              <div>
                <Label>Section Name *</Label>
                <Input
                  value={editingSection.name}
                  onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditSectionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSection} disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700">
              {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

