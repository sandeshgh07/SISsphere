import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Edit, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function AcademicYearsPage() {
  const { toast } = useToast();
  const { accessToken, user, isHydrated, getEffectiveRole } = useAuth();
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_active: true,
  });

  const effectiveRole = getEffectiveRole();
  const canManage = effectiveRole === "principal";

  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    : {};

  const loadYears = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/academic-years`, { headers });
      setYears(res.data || []);
    } catch (e) {
      console.error("Failed to load academic years:", e);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isHydrated && accessToken) {
      loadYears();
    }
  }, [isHydrated, accessToken, loadYears]);

  const handleCreate = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        is_active: formData.is_active,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };
      await axios.post(`${API_BASE}/api/academic-years`, payload, { headers });
      toast({ title: "Success", description: "Academic year created successfully" });
      setShowCreateModal(false);
      setFormData({ name: "", start_date: "", end_date: "", is_active: true });
      loadYears();
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg : "Failed to create academic year");
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedYear) return;
    setSaving(true);
    try {
      const payload = {
        name: formData.name || undefined,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };
      await axios.patch(`${API_BASE}/api/academic-years/${selectedYear.id}`, payload, { headers });
      toast({ title: "Success", description: "Academic year updated successfully" });
      setShowEditModal(false);
      setSelectedYear(null);
      setFormData({ name: "", start_date: "", end_date: "", is_active: true });
      loadYears();
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg : "Failed to update academic year");
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (yearId, isActive) => {
    try {
      await axios.patch(`${API_BASE}/api/academic-years/${yearId}`, { is_active: isActive }, { headers });
      toast({ 
        title: "Success", 
        description: isActive ? "Academic year activated" : "Academic year deactivated" 
      });
      loadYears();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.detail || "Failed to update",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (yearId) => {
    if (!window.confirm("Are you sure you want to delete this academic year?")) return;
    try {
      await axios.delete(`${API_BASE}/api/academic-years/${yearId}`, { headers });
      toast({ title: "Success", description: "Academic year deleted" });
      loadYears();
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.detail || "Failed to delete academic year",
        variant: "destructive",
      });
    }
  };

  const openEditModal = (year) => {
    setSelectedYear(year);
    setFormData({
      name: year.name || "",
      start_date: year.start_date ? year.start_date.split("T")[0] : "",
      end_date: year.end_date ? year.end_date.split("T")[0] : "",
      is_active: year.is_active,
    });
    setShowEditModal(true);
  };

  const activeYear = years.find(y => y.is_active);

  if (loading) {
    return (
      <div className="col-span-full flex items-center justify-center h-64">
        <div className="text-slate-400">Loading academic years...</div>
      </div>
    );
  }

  return (
    <div className="col-span-full space-y-6" data-testid="academic-years-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">Academic Years</h1>
        {canManage && (
          <Button
            onClick={() => {
              setFormData({ name: "", start_date: "", end_date: "", is_active: years.length === 0 });
              setShowCreateModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-500"
            data-testid="create-academic-year-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Academic Year
          </Button>
        )}
      </div>

      {/* No Active Year Warning */}
      {!activeYear && years.length > 0 && (
        <Card className="bg-amber-900/20 border-amber-700">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-amber-200 font-medium">No Active Academic Year</p>
                <p className="text-amber-400/80 text-sm">
                  Please activate an academic year. Students and fees will be linked to the active year.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Year Indicator */}
      {activeYear && (
        <Card className="bg-green-900/20 border-green-700">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-green-200 font-medium">Active Academic Year: {activeYear.name}</p>
                <p className="text-green-400/80 text-sm">
                  All new students and fees will be linked to this year.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Years List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-slate-100 text-lg">All Academic Years</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {years.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No academic years configured yet.</p>
              {canManage && (
                <Button
                  onClick={() => {
                    setFormData({ name: "", start_date: "", end_date: "", is_active: true });
                    setShowCreateModal(true);
                  }}
                  className="mt-4 bg-blue-600 hover:bg-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Academic Year
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {years.map((year) => (
                <div
                  key={year.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-slate-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-100">{year.name}</span>
                        {year.is_active && (
                          <Badge className="bg-green-900/30 text-green-400 border-green-700">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {year.start_date && `Start: ${new Date(year.start_date).toLocaleDateString()}`}
                        {year.start_date && year.end_date && " · "}
                        {year.end_date && `End: ${new Date(year.end_date).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Active</span>
                        <Switch
                          checked={year.is_active}
                          onCheckedChange={(checked) => handleSetActive(year.id, checked)}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-slate-200"
                        onClick={() => openEditModal(year)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(year.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Create Academic Year</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new academic year. Only one can be active at a time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 2080-2081 or 2024-2025"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Set as active year</Label>
            </div>
            {formData.is_active && years.some(y => y.is_active) && (
              <p className="text-xs text-amber-400">
                Note: The currently active year will be deactivated.
              </p>
            )}
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
              onClick={handleCreate}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit Academic Year</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

