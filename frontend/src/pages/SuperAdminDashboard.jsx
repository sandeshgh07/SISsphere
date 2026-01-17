import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  Eye,
  Edit,
  UserCog,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Upload,
  Image as ImageIcon,
  Trash2,
  RotateCcw,
  Filter,
  MoreVertical,
  FileText,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

function SuperAdminDashboard() {
  const { accessToken, logout, user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state - Phase 8B
  const [statusFilter, setStatusFilter] = useState("active");

  // Create school form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("school");
  const [country, setCountry] = useState("Nepal");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showPrincipalForm, setShowPrincipalForm] = useState(true);
  const [principalName, setPrincipalName] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");
  const [principalPassword, setPrincipalPassword] = useState("");

  // View School Modal - Phase 8B
  const [viewModal, setViewModal] = useState({ open: false, school: null });

  // Edit School Modal - Phase 8B
  const [editModal, setEditModal] = useState({
    open: false,
    school: null,
    name: "",
    code: "",
    type: "school",
    logoUrl: "",
    logoFile: null,
    logoPreview: null,
    saving: false,
  });

  // Delete Modals - Phase 8B
  const [softDeleteModal, setSoftDeleteModal] = useState({ open: false, school: null });
  const [hardDeleteModal, setHardDeleteModal] = useState({ open: false, school: null, confirmSlug: "" });
  const [restoreModal, setRestoreModal] = useState({ open: false, school: null });

  // Edit Logo Modal State - Phase 7C
  const [editLogoModal, setEditLogoModal] = useState({
    open: false,
    school: null,
    logoUrl: "",
    logoFile: null,
    logoPreview: null,
    saving: false,
  });

  // Principal Handover Modal State
  const [handoverModal, setHandoverModal] = useState({
    open: false,
    school: null,
    step: 1,
    currentPrincipal: null,
    eligibleUsers: [],
    selectedUserId: "",
    createNewPrincipal: false,
    newPrincipalForm: {
      full_name: "",
      email: "",
      phone: "",
      password: "",
    },
    oldPrincipalFate: "demote_teacher",
    selectedGrades: [],
    grades: [],
    confirmText: "",
    processing: false,
  });

  // Superadmin Audit Logs - Phase 8B
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    : {};

  const loadSchools = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/schools?status_filter=${statusFilter}`, { headers });
      setSchools(res.data || []);
      setError("");
    } catch (e) {
      console.error("[SuperAdmin] Failed to load schools:", e);
      setError("Failed to load schools. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  // Load platform audit logs - Phase 8B
  const loadAuditLogs = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await axios.get(`${API_BASE}/api/audit-logs/platform?limit=100`, { headers });
      setAuditLogs(res.data || []);
    } catch (e) {
      console.error("[SuperAdmin] Failed to load audit logs:", e);
    }
  }, [accessToken]);

  useEffect(() => {
    if (showAuditLogs) {
      loadAuditLogs();
    }
  }, [showAuditLogs, loadAuditLogs]);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
      if (editModal.logoPreview && editModal.logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(editModal.logoPreview);
      }
      if (editLogoModal.logoPreview && editLogoModal.logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(editLogoModal.logoPreview);
      }
    };
  }, [logoPreview, editModal.logoPreview, editLogoModal.logoPreview]);

  // Phase 8B: Open View School Modal
  const openViewModal = (school) => {
    setViewModal({ open: true, school });
  };

  // Phase 8B: Open Edit School Modal
  const openEditModal = (school) => {
    setEditModal({
      open: true,
      school,
      name: school.name || "",
      code: school.slug || school.code || "",
      type: school.type || "school",
      logoUrl: school.logo_url || "",
      logoPreview: school.logo_url || null,
      saving: false,
    });
  };

  // Phase 8B: Handle Edit Modal Logo Upload
  const handleEditModalLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload PNG, JPG, JPEG, or SVG file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }
    setEditModal(prev => ({
      ...prev,
      logoFile: file,
      logoPreview: URL.createObjectURL(file)
    }));
  };

  // Phase 8B: Save Edit School
  const handleSaveEdit = async () => {
    if (!editModal.school) return;
    setEditModal(prev => ({ ...prev, saving: true }));
    try {
      const formData = new FormData();
      formData.append("name", editModal.name);
      formData.append("type", editModal.type);
      if (editModal.logoFile) {
        formData.append("logo", editModal.logoFile);
      }

      const uploadHeaders = { ...headers };
      delete uploadHeaders["Content-Type"];

      await axios.patch(
        `${API_BASE}/api/schools/${editModal.school.id}`,
        formData,
        { headers: uploadHeaders }
      );
      toast.success("School updated successfully");
      setEditModal({ open: false, school: null, name: "", code: "", type: "school", logoUrl: "", logoFile: null, logoPreview: null, saving: false });
      await loadSchools();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update school");
    } finally {
      setEditModal(prev => ({ ...prev, saving: false }));
    }
  };

  // Phase 8B: Soft Delete School
  const handleSoftDelete = async () => {
    if (!softDeleteModal.school) return;
    try {
      await axios.post(`${API_BASE}/api/schools/${softDeleteModal.school.id}/soft-delete`, {}, { headers });
      toast.success(`School "${softDeleteModal.school.name}" moved to deleted`);
      setSoftDeleteModal({ open: false, school: null });
      await loadSchools();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete school");
    }
  };

  // Phase 8B: Hard Delete School
  const handleHardDelete = async () => {
    if (!hardDeleteModal.school) return;
    if (hardDeleteModal.confirmSlug !== hardDeleteModal.school.slug) {
      toast.error("Slug confirmation does not match");
      return;
    }
    try {
      const res = await axios.post(
        `${API_BASE}/api/schools/${hardDeleteModal.school.id}/hard-delete`, 
        { confirm_slug: hardDeleteModal.confirmSlug },
        { headers }
      );
      toast.success(res.data.message || "School permanently deleted");
      setHardDeleteModal({ open: false, school: null, confirmSlug: "" });
      await loadSchools();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to permanently delete school");
    }
  };

  // Phase 8B: Restore School
  const handleRestore = async () => {
    if (!restoreModal.school) return;
    try {
      await axios.post(`${API_BASE}/api/schools/${restoreModal.school.id}/restore`, {}, { headers });
      toast.success(`School "${restoreModal.school.name}" restored successfully`);
      setRestoreModal({ open: false, school: null });
      await loadSchools();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to restore school");
    }
  };

  // Phase 8B: Get school status badge
  const getSchoolStatusBadge = (school) => {
    if (school.is_deleted) {
      return <Badge variant="outline" className="bg-red-900/30 text-red-400 border-red-700">Deleted</Badge>;
    }
    if (!school.is_active) {
      return <Badge variant="outline" className="bg-amber-900/30 text-amber-400 border-amber-700">Suspended</Badge>;
    }
    return <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700">Active</Badge>;
  };

  // Handle logo file upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload PNG, JPG, JPEG, or SVG file");
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }
    
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // Phase 7C: Edit Logo for existing school
  const handleEditLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload PNG, JPG, JPEG, or SVG file");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }
    
    setEditLogoModal(prev => ({
      ...prev,
      logoFile: file,
      logoPreview: URL.createObjectURL(file),
    }));
  };

  const openEditLogoModal = (school) => {
    setEditLogoModal({
      open: true,
      school,
      logoUrl: school.logo_url || "",
      logoFile: null,
      logoPreview: school.logo_url || null,
      saving: false,
    });
  };

  const handleSaveLogo = async () => {
    if (!editLogoModal.school) return;
    if (!editLogoModal.logoFile) {
       toast.error("Please select a file to upload");
       return;
    }
    
    setEditLogoModal(prev => ({ ...prev, saving: true }));
    try {
      const formData = new FormData();
      formData.append("file", editLogoModal.logoFile);

      const uploadHeaders = { ...headers };
      delete uploadHeaders["Content-Type"];

      await axios.patch(
        `${API_BASE}/api/schools/${editLogoModal.school.id}/logo`,
        formData,
        { headers: uploadHeaders }
      );
      toast.success("Logo updated successfully");
      setEditLogoModal({ open: false, school: null, logoUrl: "", logoFile: null, logoPreview: null, saving: false });
      await loadSchools();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update logo");
    } finally {
      setEditLogoModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const uploadHeaders = { ...headers };
      delete uploadHeaders["Content-Type"];

      if (showPrincipalForm) {
        const res = await axios.post(
          `${API_BASE}/api/schools/with-principal`,
          {
            school: { 
              name, 
              code: code || name.toLowerCase().replace(/\s+/g, '-'), 
              type,
              country,
              logo_url: null, // Ignored by backend
            },
            principal: {
              full_name: principalName,
              email: principalEmail,
              password: principalPassword,
              role: "principal",
              school_id: null,
            },
          },
          { headers }
        );

        if (logoFile) {
          const schoolId = res.data.id;
          const formData = new FormData();
          formData.append("file", logoFile);
          await axios.patch(`${API_BASE}/api/schools/${schoolId}/logo`, formData, {
            headers: uploadHeaders
          });
        }
        toast.success("School and Principal created successfully!");
      } else {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("code", code || name.toLowerCase().replace(/\s+/g, '-'));
        formData.append("type", type);
        formData.append("country", country);
        if (logoFile) {
          formData.append("logo", logoFile);
        }

        await axios.post(`${API_BASE}/api/schools`, formData, {
          headers: uploadHeaders
        });
        toast.success("School created successfully!");
      }
      setName("");
      setCode("");
      setType("school");
      setLogoUrl("");
      setLogoFile(null);
      setLogoPreview(null);
      setPrincipalName("");
      setPrincipalEmail("");
      setPrincipalPassword("");
      await loadSchools();
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to create school";
      setError(detail);
      toast.error(detail);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (schoolId, isActive) => {
    try {
      await axios.post(
        `${API_BASE}/api/schools/${schoolId}/status`,
        { is_active: !isActive },
        { headers }
      );
      toast.success(isActive ? "School suspended" : "School activated");
      await loadSchools();
    } catch (err) {
      toast.error("Failed to update school status");
    }
  };

  // ===============================================
  // PRINCIPAL HANDOVER FUNCTIONS
  // ===============================================

  const openHandoverModal = async (school) => {
    try {
      // Fetch school users and grades
      const [usersRes, gradesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users?school_id=${school.id}`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/grades?school_id=${school.id}`, { headers }).catch(() => ({ data: [] })),
      ]);

      const users = usersRes.data || [];
      const grades = gradesRes.data || [];

      // Find current principal
      const currentPrincipal = users.find(
        (u) => u.role === "principal" || (u.roles && u.roles.includes("principal"))
      );

      // Eligible users: Teachers and School Admins (not students, parents, accountants)
      const eligibleUsers = users.filter((u) => {
        const roles = u.roles || [u.role];
        return roles.some((r) => ["teacher", "school_admin"].includes(r)) && u.id !== currentPrincipal?.id;
      });

      setHandoverModal({
        open: true,
        school,
        step: 1,
        currentPrincipal,
        eligibleUsers,
        selectedUserId: "",
        createNewPrincipal: false,
        newPrincipalForm: {
          full_name: "",
          email: "",
          phone: "",
          password: "",
        },
        oldPrincipalFate: "demote_teacher",
        selectedGrades: [],
        grades,
        confirmText: "",
        processing: false,
      });
    } catch (err) {
      toast.error("Failed to load school data");
    }
  };

  const closeHandoverModal = () => {
    setHandoverModal((prev) => ({ ...prev, open: false }));
  };

  const nextStep = () => {
    setHandoverModal((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const prevStep = () => {
    setHandoverModal((prev) => ({ ...prev, step: prev.step - 1 }));
  };

  const updateHandoverForm = (field, value) => {
    setHandoverModal((prev) => ({ ...prev, [field]: value }));
  };

  const updateNewPrincipalForm = (field, value) => {
    setHandoverModal((prev) => ({
      ...prev,
      newPrincipalForm: { ...prev.newPrincipalForm, [field]: value },
    }));
  };

  const executeHandover = async () => {
    const {
      school,
      currentPrincipal,
      selectedUserId,
      createNewPrincipal,
      newPrincipalForm,
      oldPrincipalFate,
      selectedGrades,
    } = handoverModal;

    updateHandoverForm("processing", true);

    try {
      // Prepare payload
      const payload = {
        school_id: school.id,
        old_principal_id: currentPrincipal?.id || null,
        old_principal_fate: oldPrincipalFate,
        old_principal_grades: oldPrincipalFate === "demote_teacher" ? selectedGrades : [],
      };

      if (createNewPrincipal) {
        payload.create_new_principal = true;
        payload.new_principal_data = newPrincipalForm;
      } else {
        payload.new_principal_id = selectedUserId;
      }

      // Call backend handover API
      await axios.post(`${API_BASE}/api/schools/${school.id}/handover-principal`, payload, { headers });

      toast.success("Principal handover completed successfully!");
      closeHandoverModal();
      await loadSchools();
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to execute principal handover";
      toast.error(detail);
    } finally {
      updateHandoverForm("processing", false);
    }
  };

  // Get selected new principal name for summary
  const getSelectedNewPrincipalName = () => {
    if (handoverModal.createNewPrincipal) {
      return handoverModal.newPrincipalForm.full_name || "New Principal";
    }
    const user = handoverModal.eligibleUsers.find((u) => u.id === handoverModal.selectedUserId);
    return user?.full_name || "Selected User";
  };

  const getOldPrincipalFateLabel = () => {
    switch (handoverModal.oldPrincipalFate) {
      case "demote_teacher":
        return "Demote to Teacher";
      case "demote_admin":
        return "Demote to School Admin";
      case "remove_principal_only":
        return "Remove Principal Role Only";
      default:
        return "Unknown";
    }
  };

  // Check if can proceed to next step
  const canProceedFromStep = (step) => {
    switch (step) {
      case 1:
        return true; // Warning acknowledgment
      case 2:
        return true; // Just viewing current principal
      case 3:
        // Must select or create new principal
        if (handoverModal.createNewPrincipal) {
          const f = handoverModal.newPrincipalForm;
          return f.full_name && f.email && f.password;
        }
        return !!handoverModal.selectedUserId;
      case 4:
        // Must decide fate and optionally select grades
        if (handoverModal.oldPrincipalFate === "demote_teacher") {
          return handoverModal.selectedGrades.length > 0;
        }
        return true;
      case 5:
        return handoverModal.confirmText === "CONFIRM";
      default:
        return true;
    }
  };

  // Render Handover Modal Content
  const renderHandoverStep = () => {
    const { step, school, currentPrincipal, eligibleUsers, grades } = handoverModal;

    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-red-200 font-semibold">High Authority Action</p>
                <p className="text-sm text-red-300">
                  This action transfers full administrative authority over <strong>{school?.name}</strong>.
                </p>
                <p className="text-sm text-red-300">
                  The current principal will <strong>immediately lose</strong> all principal privileges including access to Users, Reports, and Audit Logs.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Please review carefully before proceeding. This action will be logged for audit purposes.
            </p>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-300">Current Principal</h4>
            {currentPrincipal ? (
              <div className="bg-slate-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Name:</span>
                  <span className="text-slate-100">{currentPrincipal.full_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Email:</span>
                  <span className="text-slate-100">{currentPrincipal.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Phone:</span>
                  <span className="text-slate-100">{currentPrincipal.phone || "Not set"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Roles:</span>
                  <div className="flex gap-1">
                    {(currentPrincipal.roles || [currentPrincipal.role]).map((r) => (
                      <Badge key={r} variant="outline" className="text-xs bg-slate-700">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-4 text-center">
                <p className="text-slate-400">No principal currently assigned to this school.</p>
                <p className="text-sm text-slate-500 mt-1">You can assign a new principal in the next step.</p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-300">Select New Principal</h4>

            {/* Option Toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!handoverModal.createNewPrincipal ? "default" : "outline"}
                size="sm"
                onClick={() => updateHandoverForm("createNewPrincipal", false)}
                className={!handoverModal.createNewPrincipal ? "bg-blue-600" : ""}
              >
                Promote Existing User
              </Button>
              <Button
                type="button"
                variant={handoverModal.createNewPrincipal ? "default" : "outline"}
                size="sm"
                onClick={() => updateHandoverForm("createNewPrincipal", true)}
                className={handoverModal.createNewPrincipal ? "bg-blue-600" : ""}
              >
                Create New Principal
              </Button>
            </div>

            {!handoverModal.createNewPrincipal ? (
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Select from eligible users (Teachers, School Admins)</Label>
                {eligibleUsers.length === 0 ? (
                  <div className="text-sm text-slate-500 bg-slate-800 rounded p-3">
                    No eligible users found. You must create a new principal.
                  </div>
                ) : (
                  <Select
                    value={handoverModal.selectedUserId}
                    onValueChange={(val) => updateHandoverForm("selectedUserId", val)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select a user to promote" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {eligibleUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name} — {(u.roles || [u.role]).join(", ")}
                          {u.grade_assignments?.length > 0 && ` (${u.grade_assignments.length} grades)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <div className="space-y-3 bg-slate-800 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Full Name *</Label>
                    <Input
                      value={handoverModal.newPrincipalForm.full_name}
                      onChange={(e) => updateNewPrincipalForm("full_name", e.target.value)}
                      placeholder="John Doe"
                      className="bg-slate-900 border-slate-600"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Email *</Label>
                    <Input
                      type="email"
                      value={handoverModal.newPrincipalForm.email}
                      onChange={(e) => updateNewPrincipalForm("email", e.target.value)}
                      placeholder="principal@school.edu.np"
                      className="bg-slate-900 border-slate-600"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Phone</Label>
                    <Input
                      value={handoverModal.newPrincipalForm.phone}
                      onChange={(e) => updateNewPrincipalForm("phone", e.target.value)}
                      placeholder="+977-"
                      className="bg-slate-900 border-slate-600"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Password *</Label>
                    <Input
                      type="password"
                      value={handoverModal.newPrincipalForm.password}
                      onChange={(e) => updateNewPrincipalForm("password", e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-900 border-slate-600"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-300">
              Fate of Old Principal: {currentPrincipal?.full_name || "N/A"}
            </h4>

            {!currentPrincipal ? (
              <div className="bg-slate-800 rounded-lg p-4 text-slate-400 text-sm">
                No current principal to reassign. This step will be skipped.
              </div>
            ) : (
              <>
                <RadioGroup
                  value={handoverModal.oldPrincipalFate}
                  onValueChange={(val) => updateHandoverForm("oldPrincipalFate", val)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 bg-slate-800 rounded-lg p-3">
                    <RadioGroupItem value="demote_teacher" id="fate-teacher" />
                    <div>
                      <Label htmlFor="fate-teacher" className="text-sm text-slate-200 cursor-pointer">
                        Demote to Teacher
                      </Label>
                      <p className="text-xs text-slate-400">Requires selecting grades to assign</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 bg-slate-800 rounded-lg p-3">
                    <RadioGroupItem value="demote_admin" id="fate-admin" />
                    <div>
                      <Label htmlFor="fate-admin" className="text-sm text-slate-200 cursor-pointer">
                        Demote to School Admin
                      </Label>
                      <p className="text-xs text-slate-400">Retains administrative access without principal authority</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 bg-slate-800 rounded-lg p-3">
                    <RadioGroupItem value="remove_principal_only" id="fate-remove" />
                    <div>
                      <Label htmlFor="fate-remove" className="text-sm text-slate-200 cursor-pointer">
                        Remove Principal Role Only
                      </Label>
                      <p className="text-xs text-slate-400">
                        If they have other roles (e.g., parent), those are retained
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {/* Grade selection for Teacher demotion */}
                {handoverModal.oldPrincipalFate === "demote_teacher" && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs text-slate-400">Select grades to assign *</Label>
                    <div className="bg-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {grades.length === 0 ? (
                        <p className="text-sm text-slate-500">No grades available</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {grades
                            .filter((g) => g.is_active)
                            .sort((a, b) => (a.level || 0) - (b.level || 0))
                            .map((grade) => (
                              <label key={grade.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={handoverModal.selectedGrades.includes(grade.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      updateHandoverForm("selectedGrades", [
                                        ...handoverModal.selectedGrades,
                                        grade.id,
                                      ]);
                                    } else {
                                      updateHandoverForm(
                                        "selectedGrades",
                                        handoverModal.selectedGrades.filter((id) => id !== grade.id)
                                      );
                                    }
                                  }}
                                  className="rounded"
                                />
                                <span className="text-sm text-slate-300">{grade.name}</span>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    {handoverModal.selectedGrades.length === 0 && (
                      <p className="text-xs text-amber-400">Please select at least one grade</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-slate-300">Final Confirmation</h4>

            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">School:</span>
                <span className="text-slate-100">{school?.name}</span>
              </div>
              {currentPrincipal && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Old Principal:</span>
                    <span className="text-slate-100">
                      {currentPrincipal.full_name} → {getOldPrincipalFateLabel()}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">New Principal:</span>
                <span className="text-green-400 font-medium">{getSelectedNewPrincipalName()}</span>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
              <p className="text-sm text-red-300 mb-3">
                Type <strong>CONFIRM</strong> to execute this principal handover:
              </p>
              <Input
                value={handoverModal.confirmText}
                onChange={(e) => updateHandoverForm("confirmText", e.target.value)}
                placeholder="Type CONFIRM"
                className="bg-slate-900 border-slate-600 text-center font-mono"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col" data-testid="superadmin-dashboard">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl font-semibold">Platform Superuser</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className={`border-slate-600 ${showAuditLogs ? 'bg-purple-900/30 text-purple-300' : 'text-slate-300'}`}
            onClick={() => setShowAuditLogs(!showAuditLogs)}
            data-testid="toggle-audit-logs"
          >
            <FileText className="h-4 w-4 mr-2" />
            Audit Logs
          </Button>
          <span className="text-sm text-slate-400">{user?.email}</span>
          <Button
            variant="outline"
            className="rounded-full border-slate-600 text-slate-100"
            onClick={logout}
            data-testid="superadmin-logout-button"
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-6 space-y-6">
        {/* Platform Audit Logs Section - Phase 8B */}
        {showAuditLogs && (
          <Card className="bg-slate-900 border-purple-700/50" data-testid="platform-audit-logs">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-400" />
                Platform Audit Logs
              </CardTitle>
              <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => setShowAuditLogs(false)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No platform-level actions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditLogs.map((log, idx) => (
                    <div key={log.id || idx} className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg">
                      <div className={`p-1.5 rounded-full ${
                        log.action?.includes('DELETED') ? 'bg-red-900/50 text-red-400' :
                        log.action?.includes('RESTORED') ? 'bg-green-900/50 text-green-400' :
                        'bg-purple-900/50 text-purple-400'
                      }`}>
                        {log.action?.includes('DELETED') ? <Trash2 className="h-3 w-3" /> :
                         log.action?.includes('RESTORED') ? <RotateCcw className="h-3 w-3" /> :
                         <FileText className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{log.action}</span>
                          <span className="text-xs text-slate-500">
                            {log.details?.school_name && `• ${log.details.school_name}`}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          By: {log.details?.deleted_by || log.details?.restored_by || log.details?.executed_by?.email || 'Unknown'}
                          {log.timestamp && ` • ${new Date(log.timestamp).toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create School Card */}
        <Card className="bg-slate-900 border-slate-700" data-testid="superadmin-create-school-card">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-400" />
              Create New School
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4" data-testid="create-school-form">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="ABC School"
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="create-school-name-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Slug (auto-generated)</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="abc-school"
                    className="bg-slate-950 border-slate-700 text-slate-100"
                    data-testid="create-school-code-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Institution Type *</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm text-slate-100"
                    data-testid="create-school-type-select"
                  >
                    <option value="school">School</option>
                    <option value="college">College</option>
                    <option value="university">University</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Country *</Label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm text-slate-100"
                    data-testid="create-school-country-select"
                  >
                    <option value="Nepal">Nepal</option>
                    <option value="India">India</option>
                    <option value="USA">USA</option>
                    <option value="UK">UK</option>
                    <option value="Australia">Australia</option>
                  </select>
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="rounded-full bg-green-600 hover:bg-green-500 text-white"
                  data-testid="create-school-submit-button"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : showPrincipalForm ? (
                    "Create with Principal"
                  ) : (
                    "Create Institution"
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Principal account (recommended)</span>
                <button
                  type="button"
                  onClick={() => setShowPrincipalForm((v) => !v)}
                  className="text-blue-400 hover:text-blue-300"
                  data-testid="toggle-principal-form-button"
                >
                  {showPrincipalForm ? "Skip principal" : "Add principal"}
                </button>
              </div>

              {/* Logo Upload Section */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <Label className="text-xs text-slate-300">School Logo (Optional)</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label 
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-md cursor-pointer transition-colors"
                        data-testid="logo-upload-button"
                      >
                        <Upload className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-300">Upload Logo</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                          data-testid="logo-file-input"
                        />
                      </label>
                      {logoPreview && (
                        <button
                          type="button"
                  onClick={() => { setLogoUrl(""); setLogoFile(null); setLogoPreview(null); }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, JPEG, or SVG. Max 2MB.</p>
                  </div>
                  {logoPreview && (
                    <div className="w-16 h-16 rounded-lg border border-slate-600 overflow-hidden bg-slate-800 flex items-center justify-center">
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="max-w-full max-h-full object-contain"
                        data-testid="logo-preview"
                      />
                    </div>
                  )}
                </div>
              </div>

              {showPrincipalForm && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Principal Name *</Label>
                    <Input
                      value={principalName}
                      onChange={(e) => setPrincipalName(e.target.value)}
                      required={showPrincipalForm}
                      placeholder="Principal Name"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                      data-testid="principal-name-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Principal Email *</Label>
                    <Input
                      type="email"
                      value={principalEmail}
                      onChange={(e) => setPrincipalEmail(e.target.value)}
                      required={showPrincipalForm}
                      placeholder="principal@school.edu.np"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                      data-testid="principal-email-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-300">Password *</Label>
                    <Input
                      type="password"
                      value={principalPassword}
                      onChange={(e) => setPrincipalPassword(e.target.value)}
                      required={showPrincipalForm}
                      placeholder="••••••••"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                      data-testid="principal-password-input"
                    />
                  </div>
                </div>
              )}
            </form>
            {error && (
              <div className="text-sm text-red-400 mt-3" data-testid="create-school-error-text">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schools List Card */}
        <Card className="bg-slate-900 border-slate-700" data-testid="superadmin-schools-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-slate-100">Schools & Colleges</CardTitle>
            {/* Status Filter - Phase 8B */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-slate-800 border-slate-600 text-slate-200">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all">All Schools</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="soft_deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-400">Loading schools...</span>
              </div>
            ) : schools.length === 0 ? (
              <div className="text-center py-8" data-testid="schools-empty-state">
                <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">
                  {statusFilter === "all" ? "No schools created yet." : `No ${statusFilter.replace('_', ' ')} schools.`}
                </p>
                {statusFilter === "all" && <p className="text-sm text-slate-500">Use the form above to create your first school.</p>}
              </div>
            ) : (
              <div className="space-y-3" data-testid="schools-list">
                {schools.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-slate-800/50 transition-colors ${
                      s.is_deleted ? 'border-red-900/50 bg-red-950/20' : 'border-slate-800'
                    }`}
                    data-testid={`school-row-${s.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* Logo Preview */}
                      <div className="w-10 h-10 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {s.logo_url ? (
                          <img
                            src={s.logo_url.startsWith('data:') ? s.logo_url : `${API_BASE}${s.logo_url}`}
                            alt={`${s.name} logo`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${s.is_deleted ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{s.name}</span>
                          {getSchoolStatusBadge(s)}
                          <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-600">
                            {s.type}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {s.slug && `Slug: ${s.slug} · `}
                          {s.principal_id ? "Has Principal" : "No Principal"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* View Button - Phase 8B */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-slate-200"
                        onClick={() => openViewModal(s)}
                        title="View Details"
                        data-testid={`view-school-${s.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Edit Button - Phase 8B */}
                      {!s.is_deleted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300"
                          onClick={() => openEditModal(s)}
                          title="Edit School"
                          data-testid={`edit-school-${s.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Edit Logo Button */}
                      {!s.is_deleted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/30"
                          onClick={() => openEditLogoModal(s)}
                          title="Edit Logo"
                          data-testid={`edit-logo-${s.id}`}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Change Principal Button */}
                      {!s.is_deleted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30"
                          onClick={() => openHandoverModal(s)}
                          title="Change Principal"
                          data-testid={`change-principal-${s.id}`}
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Actions Dropdown - Phase 8B */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          {!s.is_deleted && (
                            <>
                              {s.is_active ? (
                                <DropdownMenuItem 
                                  onClick={() => handleToggleStatus(s.id, true)}
                                  className="text-amber-400 hover:text-amber-300 cursor-pointer"
                                >
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Suspend School
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => handleToggleStatus(s.id, false)}
                                  className="text-green-400 hover:text-green-300 cursor-pointer"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Activate School
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => setSoftDeleteModal({ open: true, school: s })}
                                className="text-red-400 hover:text-red-300 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Soft Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {s.is_deleted && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => setRestoreModal({ open: true, school: s })}
                                className="text-green-400 hover:text-green-300 cursor-pointer"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore School
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setHardDeleteModal({ open: true, school: s, confirmSlug: "" })}
                                className="text-red-500 hover:text-red-400 cursor-pointer"
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Permanently Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Principal Handover Modal */}
      <Dialog open={handoverModal.open} onOpenChange={(open) => !open && closeHandoverModal()}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-purple-400" />
              Change Principal — {handoverModal.school?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Step {handoverModal.step} of 5 — High Authority Action
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">{renderHandoverStep()}</div>

          <DialogFooter className="flex justify-between">
            <div>
              {handoverModal.step > 1 && (
                <Button
                  variant="outline"
                  onClick={prevStep}
                  className="border-slate-600 text-slate-300"
                  disabled={handoverModal.processing}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={closeHandoverModal}
                className="border-slate-600 text-slate-300"
                disabled={handoverModal.processing}
              >
                Cancel
              </Button>
              {handoverModal.step < 5 ? (
                <Button
                  onClick={nextStep}
                  disabled={!canProceedFromStep(handoverModal.step)}
                  className="bg-purple-600 hover:bg-purple-500"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={executeHandover}
                  disabled={!canProceedFromStep(5) || handoverModal.processing}
                  className="bg-red-600 hover:bg-red-500"
                >
                  {handoverModal.processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Confirm & Execute"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Logo Modal - Phase 7C */}
      <Dialog open={editLogoModal.open} onOpenChange={(open) => !open && setEditLogoModal({ open: false, school: null, logoUrl: "", logoPreview: null, saving: false })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-amber-400" />
              Edit School Logo — {editLogoModal.school?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Upload a new logo or remove the existing one.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Current Logo Preview */}
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800 flex items-center justify-center overflow-hidden">
                {editLogoModal.logoPreview ? (
                  <img 
                    src={editLogoModal.logoPreview} 
                    alt="Logo preview" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <Building2 className="h-12 w-12 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-500 mt-2">No logo</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Upload Options */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg cursor-pointer transition-colors">
                <Upload className="h-5 w-5 text-amber-400" />
                <span className="text-slate-200">Upload New Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  onChange={handleEditLogoUpload}
                  className="hidden"
                />
              </label>
              
              {editLogoModal.logoPreview && (
                <Button
                  variant="outline"
                  onClick={() => setEditLogoModal(prev => ({ ...prev, logoUrl: "", logoPreview: null }))}
                  className="border-red-700 text-red-400 hover:bg-red-900/30"
                >
                  Remove Logo
                </Button>
              )}
            </div>
            
            <p className="text-xs text-slate-500 text-center">
              Supported formats: PNG, JPG, JPEG, SVG. Max size: 2MB.
            </p>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditLogoModal({ open: false, school: null, logoUrl: "", logoPreview: null, saving: false })}
              className="border-slate-600 text-slate-300"
              disabled={editLogoModal.saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLogo}
              disabled={editLogoModal.saving}
              className="bg-amber-600 hover:bg-amber-500"
            >
              {editLogoModal.saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Logo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View School Modal - Phase 8B */}
      <Dialog open={viewModal.open} onOpenChange={(open) => !open && setViewModal({ open: false, school: null })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-400" />
              School Details
            </DialogTitle>
          </DialogHeader>
          
          {viewModal.school && (
            <div className="space-y-4 py-4">
              {/* Logo */}
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-xl border-2 border-slate-600 bg-slate-800 flex items-center justify-center overflow-hidden">
                  {viewModal.school.logo_url ? (
                    <img
                      src={viewModal.school.logo_url.startsWith('data:') ? viewModal.school.logo_url : `${API_BASE}${viewModal.school.logo_url}`}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Building2 className="h-12 w-12 text-slate-500" />
                  )}
                </div>
              </div>
              
              {/* Info Grid */}
              <div className="space-y-3 bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Name:</span>
                  <span className="text-slate-100 font-medium">{viewModal.school.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Slug:</span>
                  <span className="text-slate-300 font-mono text-sm">{viewModal.school.slug || viewModal.school.code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Type:</span>
                  <Badge variant="outline" className="bg-slate-700">{viewModal.school.type}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Status:</span>
                  {getSchoolStatusBadge(viewModal.school)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Principal:</span>
                  <span className="text-slate-300">{viewModal.school.principal_id ? "Assigned" : "Not assigned"}</span>
                </div>
                {viewModal.school.created_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Created:</span>
                    <span className="text-slate-300 text-sm">{new Date(viewModal.school.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewModal({ open: false, school: null })}
              className="border-slate-600 text-slate-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit School Modal - Phase 8B */}
      <Dialog open={editModal.open} onOpenChange={(open) => !open && setEditModal({ open: false, school: null, name: "", code: "", type: "school", logoUrl: "", logoPreview: null, saving: false })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-400" />
              Edit School
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Update school information. Slug changes may affect existing URLs.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Logo Upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800 flex items-center justify-center overflow-hidden">
                {editModal.logoPreview ? (
                  <img src={editModal.logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="h-10 w-10 text-slate-500" />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-blue-400 cursor-pointer hover:text-blue-300">
                <Upload className="h-4 w-4" />
                Change Logo
                <input type="file" accept="image/*" onChange={handleEditModalLogoUpload} className="hidden" />
              </label>
            </div>
            
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-300">School Name *</Label>
              <Input
                value={editModal.name}
                onChange={(e) => setEditModal(prev => ({ ...prev, name: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            
            {/* Slug (read-only with warning) */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Slug</Label>
              <Input
                value={editModal.code}
                disabled
                className="bg-slate-800 border-slate-600 text-slate-400"
              />
              <p className="text-xs text-amber-400/70 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Slug cannot be changed after creation
              </p>
            </div>
            
            {/* Type */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-300">Institution Type</Label>
              <Select value={editModal.type} onValueChange={(v) => setEditModal(prev => ({ ...prev, type: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="college">College</SelectItem>
                  <SelectItem value="university">University</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModal({ open: false, school: null, name: "", code: "", type: "school", logoUrl: "", logoPreview: null, saving: false })}
              className="border-slate-600 text-slate-300"
              disabled={editModal.saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editModal.saving || !editModal.name}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {editModal.saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Confirmation Modal - Phase 8B */}
      <Dialog open={softDeleteModal.open} onOpenChange={(open) => !open && setSoftDeleteModal({ open: false, school: null })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Trash2 className="h-5 w-5" />
              Soft Delete School
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This action is reversible. The school can be restored later.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
              <p className="text-slate-200">
                Are you sure you want to soft delete <strong>{softDeleteModal.school?.name}</strong>?
              </p>
              <ul className="mt-3 text-sm text-slate-400 space-y-1">
                <li>• School will be marked as deleted</li>
                <li>• Users will not be able to access it</li>
                <li>• Data will be preserved</li>
                <li>• Can be restored later</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSoftDeleteModal({ open: false, school: null })}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSoftDelete}
              className="bg-amber-600 hover:bg-amber-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Soft Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete Confirmation Modal - Phase 8B */}
      <Dialog open={hardDeleteModal.open} onOpenChange={(open) => !open && setHardDeleteModal({ open: false, school: null, confirmSlug: "" })}>
        <DialogContent className="bg-slate-900 border-red-900/50 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              PERMANENTLY DELETE SCHOOL
            </DialogTitle>
            <DialogDescription className="text-red-400">
              This action is IRREVERSIBLE. All data will be permanently lost.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
              <p className="text-red-200 font-semibold mb-2">⚠️ Warning: This cannot be undone!</p>
              <p className="text-sm text-red-300">
                Permanently deleting <strong>{hardDeleteModal.school?.name}</strong> will remove:
              </p>
              <ul className="mt-2 text-sm text-red-300/80 space-y-0.5 ml-4">
                <li>• All users (principals, teachers, parents, accountants)</li>
                <li>• All students and their records</li>
                <li>• All fees, payments, and discounts</li>
                <li>• All notices and complaints</li>
                <li>• All audit logs (school-level)</li>
                <li>• All grades and sections</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-red-300">
                Type the school slug <span className="font-mono bg-slate-800 px-1 rounded">{hardDeleteModal.school?.slug}</span> to confirm:
              </Label>
              <Input
                value={hardDeleteModal.confirmSlug}
                onChange={(e) => setHardDeleteModal(prev => ({ ...prev, confirmSlug: e.target.value }))}
                placeholder="Type school slug here"
                className="bg-slate-800 border-red-700/50 text-center font-mono"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHardDeleteModal({ open: false, school: null, confirmSlug: "" })}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleHardDelete}
              disabled={hardDeleteModal.confirmSlug !== hardDeleteModal.school?.slug}
              className="bg-red-600 hover:bg-red-500 disabled:bg-red-900/50"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore School Modal - Phase 8B */}
      <Dialog open={restoreModal.open} onOpenChange={(open) => !open && setRestoreModal({ open: false, school: null })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-400">
              <RotateCcw className="h-5 w-5" />
              Restore School
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Restore this school and make it active again.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
              <p className="text-slate-200">
                Restore <strong>{restoreModal.school?.name}</strong>?
              </p>
              <ul className="mt-3 text-sm text-slate-400 space-y-1">
                <li>• School will be marked as active</li>
                <li>• All existing data will be accessible</li>
                <li>• Users will be able to log in again</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreModal({ open: false, school: null })}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              className="bg-green-600 hover:bg-green-500"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore School
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SuperAdminDashboard;

