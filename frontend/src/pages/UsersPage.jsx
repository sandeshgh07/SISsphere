import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, Trash2, UserCheck, UserX, Search, Plus, ShieldAlert, Edit, Users, BookOpen, Filter } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

// Phase 6.1: Remove Student from role options - Students created only from Students tab
const ROLE_OPTIONS = [
  { value: "school_admin", label: "School Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "accountant", label: "Accountant" },
  { value: "parent", label: "Parent" },
];

// All roles for display and multi-role editing (excluding superuser)
const ALL_ROLE_OPTIONS = [
  { value: "principal", label: "Principal" },
  { value: "school_admin", label: "School Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "accountant", label: "Accountant" },
  { value: "parent", label: "Parent" },
];

const ROLE_LABELS = {
  principal: "Principal",
  school_admin: "School Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  parent: "Parent",
  student: "Student",
};

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

// ============================================
// RBAC Configuration for Users Page
// ============================================
const ADMIN_ROLES = ["principal", "school_admin"];
const CAN_CREATE_ROLES = ["principal"];

export default function UsersPage() {
  const { accessToken, user, isHydrated, getEffectiveRole } = useAuth();
  const [list, setList] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Enhanced form state for Phase 6.1
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    gender: "",
    role: "school_admin",
    children_ids: [],
  });

  // Modal states
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [resetPasswordModal, setResetPasswordModal] = useState({ open: false, user: null });
  const [editRolesModal, setEditRolesModal] = useState({ open: false, user: null });
  const [editChildrenModal, setEditChildrenModal] = useState({ open: false, user: null });
  const [editGradesModal, setEditGradesModal] = useState({ open: false, user: null });
  const [newPassword, setNewPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    : {};

  const effectiveRole = getEffectiveRole();
  const isPrincipal = effectiveRole === "principal";
  const isSchoolAdmin = effectiveRole === "school_admin";
  const isAdminRole = ADMIN_ROLES.includes(effectiveRole);
  const canCreate = CAN_CREATE_ROLES.includes(effectiveRole);
  const canSeeActions = isAdminRole;
  const isRestrictedRole = !isAdminRole;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter !== 'all') params.role = roleFilter;
      if (debouncedSearch) params.q = debouncedSearch;

      const [usersRes, studentsRes, gradesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`, { headers, params }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/students`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/grades`, { headers }).catch(() => ({ data: [] })),
      ]);
      setList(usersRes.data || []);
      setStudents(studentsRes.data || []);
      setGrades(gradesRes.data || []);
    } catch (e) {
      console.error("[UsersPage] Error loading data:", e);
      if (!isRestrictedRole) {
        toast.error("Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isHydrated && accessToken) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, accessToken, statusFilter, roleFilter, debouncedSearch]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCreate) return;

    // Validation for parent role
    if (form.role === "parent" && !form.phone) {
      setError("Phone number is required for parent accounts");
      return;
    }

    setError("");
    setCreating(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
        school_id: user.school_id,
        phone: form.phone || null,
        children_ids: form.role === "parent" ? form.children_ids : [],
      };

      await axios.post(`${API_BASE}/api/users`, payload, { headers });
      toast.success("User created successfully");
      setForm({
        full_name: "",
        email: "",
        password: "",
        phone: "",
        gender: "",
        role: "school_admin",
        children_ids: [],
      });
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === "Email already in use") {
        setError("A user with this email already exists.");
      } else if (detail === "Not allowed") {
        setError("You don't have permission to create users.");
      } else {
        setError(detail || "Failed to create user. Please try again.");
      }
    } finally {
      setCreating(false);
    }
  };

  // ... (keep RBAC functions) ...
  const canToggleUser = (targetUser) => {
    if (!isAdminRole) return false;
    if (targetUser.id === user?.id) return false;
    return isPrincipal;
  };

  const canDeleteUser = (targetUser) => {
    if (!isAdminRole) return false;
    if (targetUser.id === user?.id) return false;
    return isPrincipal;
  };

  const canResetPassword = (targetUser) => {
    if (!isAdminRole) return false;
    if (targetUser.id === user?.id) return false;
    const targetRole = targetUser.role;
    if (targetRole === "student" || targetRole === "parent") {
      return isPrincipal || isSchoolAdmin;
    }
    if (targetRole === "teacher" || targetRole === "accountant" || targetRole === "school_admin") {
      return isPrincipal;
    }
    return false;
  };

  const canEditRoles = (targetUser) => {
    if (!isPrincipal) return false;
    if (targetUser.id === user?.id) return false;
    if (targetUser.role === "superuser") return false;
    return true;
  };

  const canEditChildren = (targetUser) => {
    if (!isAdminRole) return false;
    const targetRoles = targetUser.roles || [targetUser.role];
    return targetRoles.includes("parent");
  };

  const canEditGrades = (targetUser) => {
    if (!isPrincipal) return false;
    if (targetUser.id === user?.id) return false;
    const targetRoles = targetUser.roles || [targetUser.role];
    return targetRoles.includes("teacher");
  };

  // ... (keep Action Handlers) ...
  const handleToggleActive = async (targetUser) => {
    if (!canToggleUser(targetUser)) return;
    setActionLoading(true);
    const endpoint = targetUser.is_active
      ? `${API_BASE}/api/users/${targetUser.id}/disable`
      : `${API_BASE}/api/users/${targetUser.id}/enable`;
    try {
      await axios.post(endpoint, {}, { headers });
      toast.success(targetUser.is_active ? "User disabled" : "User enabled");
      await loadData();
    } catch (err) {
      toast.error("Failed to update user status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal.user || !canDeleteUser(deleteModal.user)) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE}/api/users/${deleteModal.user.id}`, { headers });
      toast.success("User deleted");
      setDeleteModal({ open: false, user: null });
      await loadData();
    } catch (err) {
      toast.error("Failed to delete user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal.user || !newPassword || !canResetPassword(resetPasswordModal.user)) return;
    setActionLoading(true);
    try {
      await axios.post(
        `${API_BASE}/api/users/${resetPasswordModal.user.id}/reset-password`,
        { new_password: newPassword },
        { headers }
      );
      toast.success("Password reset successfully");
      setResetPasswordModal({ open: false, user: null });
      setNewPassword("");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail || "Failed to reset password");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRoles = async () => {
    if (!editRolesModal.user || selectedRoles.length === 0) return;
    setActionLoading(true);
    try {
      await axios.patch(
        `${API_BASE}/api/users/${editRolesModal.user.id}/roles`,
        { roles: selectedRoles },
        { headers }
      );
      toast.success("User roles updated");
      setEditRolesModal({ open: false, user: null });
      setSelectedRoles([]);
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail || "Failed to update roles");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateChildren = async () => {
    if (!editChildrenModal.user) return;
    setActionLoading(true);
    try {
      await axios.patch(
        `${API_BASE}/api/users/${editChildrenModal.user.id}/children`,
        { children_ids: selectedChildren },
        { headers }
      );
      toast.success("Children assignment updated");
      setEditChildrenModal({ open: false, user: null });
      setSelectedChildren([]);
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail || "Failed to update children");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateGrades = async () => {
    if (!editGradesModal.user) return;
    setActionLoading(true);
    try {
      await axios.patch(
        `${API_BASE}/api/users/${editGradesModal.user.id}/grades`,
        { grade_ids: selectedGrades },
        { headers }
      );
      toast.success("Grade assignments updated");
      setEditGradesModal({ open: false, user: null });
      setSelectedGrades([]);
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg : "Failed to update grade assignments");
      toast.error(msg || "Failed to update grade assignments");
    } finally {
      setActionLoading(false);
    }
  };

  const openEditRolesModal = (targetUser) => {
    const currentRoles = targetUser.roles || [targetUser.role];
    setSelectedRoles(currentRoles.filter(r => r !== "superuser"));
    setEditRolesModal({ open: true, user: targetUser });
  };

  const openEditChildrenModal = (targetUser) => {
    setSelectedChildren(targetUser.children_ids || []);
    setEditChildrenModal({ open: true, user: targetUser });
  };

  const openEditGradesModal = (targetUser) => {
    setSelectedGrades(targetUser.grade_assignments || []);
    setEditGradesModal({ open: true, user: targetUser });
  };

  const toggleRole = (role) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const toggleChild = (studentId) => {
    setSelectedChildren(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleGrade = (gradeId) => {
    setSelectedGrades(prev =>
      prev.includes(gradeId)
        ? prev.filter(id => id !== gradeId)
        : [...prev, gradeId]
    );
  };

  // Helper to get student name by id
  const getStudentName = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return student ? `${student.first_name} ${student.last_name}` : studentId;
  };

  // Format Date Helper
  const formatDate = (dateString) => {
      if (!dateString) return "-";
      try {
          const date = new Date(dateString);
          return date.toLocaleDateString();
      } catch (e) {
          return dateString;
      }
  };

  // Show loading state while auth is hydrating
  if (!isHydrated) {
    return (
      <div className="col-span-full flex items-center justify-center py-12">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 col-span-full" data-testid="users-page">
        {/* Page Title & Add Button (only for Principal) */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-100" data-testid="users-page-title">
            Users
          </h1>
          {canCreate && (
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="rounded-full bg-green-600 hover:bg-green-500 text-white"
              data-testid="add-user-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          )}
        </div>

        {/* Read-only notice for restricted roles */}
        {isRestrictedRole && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-3 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-slate-400" />
              <p className="text-sm text-slate-400">
                You have view-only access to the user directory.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Create User Form (Only for Principal) */}
        {canCreate && showCreateForm && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-100">Create new user</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-user-form">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <Label htmlFor="full_name" className="text-xs text-slate-300">Full name *</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={handleChange("full_name")}
                      required
                      placeholder="John Doe"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                      data-testid="create-user-full-name-input"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <Label htmlFor="email" className="text-xs text-slate-300">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange("email")}
                      required
                      placeholder="user@example.com"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                      data-testid="create-user-email-input"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <Label htmlFor="password" className="text-xs text-slate-300">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={handleChange("password")}
                      required
                      placeholder="••••••••"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                      data-testid="create-user-password-input"
                    />
                  </div>

                  {/* Phone (Required for Parent) */}
                  <div className="space-y-1">
                    <Label htmlFor="phone" className="text-xs text-slate-300">
                      Phone {form.role === "parent" && <span className="text-red-400">*</span>}
                    </Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={handleChange("phone")}
                      required={form.role === "parent"}
                      placeholder="+977-"
                      className="bg-slate-950 border-slate-700 text-slate-100"
                    />
                  </div>

                  {/* Gender */}
                  <div className="space-y-1">
                    <Label htmlFor="gender" className="text-xs text-slate-300">Gender</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(val) => setForm(prev => ({ ...prev, gender: val }))}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {GENDER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Role */}
                  <div className="space-y-1">
                    <Label htmlFor="role" className="text-xs text-slate-300">Role *</Label>
                    <Select
                      value={form.role}
                      onValueChange={(val) => setForm(prev => ({ ...prev, role: val, children_ids: [] }))}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100" data-testid="create-user-role-select">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Children Assignment (Only for Parent role) */}
                {form.role === "parent" && (
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-300">Assign Children (Optional)</Label>
                    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 max-h-40 overflow-y-auto">
                      {students.length === 0 ? (
                        <p className="text-sm text-slate-500">No students available. Create students first.</p>
                      ) : (
                        <div className="space-y-2">
                          {students.map((student) => (
                            <label key={student.id} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={form.children_ids.includes(student.id)}
                                onCheckedChange={(checked) => {
                                  setForm(prev => ({
                                    ...prev,
                                    children_ids: checked
                                      ? [...prev.children_ids, student.id]
                                      : prev.children_ids.filter(id => id !== student.id)
                                  }));
                                }}
                              />
                              <span className="text-sm text-slate-300">
                                {student.first_name} {student.last_name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    className="border-slate-600 text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="rounded-full bg-green-600 hover:bg-green-500 text-white disabled:opacity-60"
                    data-testid="create-user-submit-button"
                  >
                    {creating ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>
              {error && (
                <div className="text-xs text-red-400 mt-2" data-testid="create-user-error-text">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Users List Card */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
             <div className="flex flex-col space-y-4">
                 <div className="flex items-center justify-between">
                     <CardTitle className="text-slate-100">
                      {isRestrictedRole ? "User Directory" : "Existing users"}
                    </CardTitle>
                    {/* Status Filters */}
                    <Tabs value={statusFilter} onValueChange={setStatusFilter} className="hidden md:block">
                        <TabsList className="bg-slate-950 border border-slate-700">
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="active" className="data-[state=active]:bg-green-900/30 data-[state=active]:text-green-400">Active</TabsTrigger>
                            <TabsTrigger value="inactive" className="data-[state=active]:bg-red-900/30 data-[state=active]:text-red-400">Inactive</TabsTrigger>
                        </TabsList>
                    </Tabs>
                 </div>

                 <div className="flex flex-col md:flex-row gap-3">
                     {/* Search */}
                     <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search by name, email, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                        data-testid="users-search-input"
                      />
                    </div>
                    {/* Role Filter */}
                    <div className="w-full md:w-48">
                         <Select value={roleFilter} onValueChange={setRoleFilter}>
                             <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                                 <div className="flex items-center gap-2">
                                     <Filter className="w-4 h-4 text-slate-400" />
                                     <SelectValue placeholder="All Roles" />
                                 </div>
                             </SelectTrigger>
                             <SelectContent className="bg-slate-900 border-slate-700">
                                 <SelectItem value="all">All Roles</SelectItem>
                                 {ALL_ROLE_OPTIONS.map(opt => (
                                     <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                 ))}
                             </SelectContent>
                         </Select>
                    </div>
                 </div>
             </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-slate-400 py-8 text-center" data-testid="users-loading">
                Loading users...
              </div>
            ) : list.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center" data-testid="users-empty-state">
                No users found matching your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto" data-testid="users-table">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 text-left pl-4">Name</th>
                      <th className="py-2 text-left">Primary Role</th>
                      <th className="py-2 text-left">Status</th>
                      <th className="py-2 text-left">Contact</th>
                      <th className="py-2 text-left">Joined</th>
                      {canSeeActions && <th className="py-2 text-left">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((u) => {
                      const userRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];
                      const extraRoles = userRoles.filter(r => r !== u.role); // Roles other than primary

                      return (
                        <tr
                          key={u.id}
                          className={`border-b border-slate-800 transition-colors ${u.is_active === false ? "bg-slate-900/30 opacity-60 grayscale-[0.5]" : "hover:bg-slate-800/30"}`}
                          data-testid={`users-table-row-${u.id}`}
                        >
                          <td className="py-3 pl-4">
                              <div className="flex flex-col">
                                  <span className="font-medium text-slate-100">{u.full_name}</span>
                              </div>
                          </td>
                          <td className="py-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-600">
                                    {ROLE_LABELS[u.role] || u.role}
                                </Badge>
                                {extraRoles.length > 0 && (
                                    <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-[10px] px-1.5 h-5">
                                        +{extraRoles.length}
                                    </Badge>
                                )}
                              </div>
                          </td>
                          <td className="py-3">
                            {u.is_active === false ? (
                              <Badge variant="destructive" className="bg-red-900/50 text-red-400 border-red-700">
                                Inactive
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700">
                                Active
                              </Badge>
                            )}
                          </td>
                          <td className="py-3">
                              <div className="flex flex-col text-xs text-slate-400">
                                  <span>{u.email}</span>
                                  {u.phone && <span>{u.phone}</span>}
                              </div>
                          </td>
                          <td className="py-3 text-slate-400 text-xs">
                              {formatDate(u.created_at)}
                          </td>
                          {canSeeActions && (
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                {/* Edit Roles Button (Principal only) */}
                                {canEditRoles(u) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-900/30"
                                        onClick={() => openEditRolesModal(u)}
                                        disabled={actionLoading}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Identity Profile</p></TooltipContent>
                                  </Tooltip>
                                )}

                                {/* Edit Grade Assignments Button (Teacher users only) */}
                                {canEditGrades(u) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-900/30"
                                        onClick={() => openEditGradesModal(u)}
                                        disabled={actionLoading}
                                        data-testid={`assign-grades-${u.id}`}
                                      >
                                        <BookOpen className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Assign grades</p></TooltipContent>
                                  </Tooltip>
                                )}

                                {/* Edit Children Button (Parent users only) */}
                                {canEditChildren(u) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/30"
                                        onClick={() => openEditChildrenModal(u)}
                                        disabled={actionLoading}
                                      >
                                        <Users className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Manage children</p></TooltipContent>
                                  </Tooltip>
                                )}

                                {/* Reset Password Button */}
                                {canResetPassword(u) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                                        onClick={() => setResetPasswordModal({ open: true, user: u })}
                                        disabled={actionLoading}
                                      >
                                        <KeyRound className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Reset password</p></TooltipContent>
                                  </Tooltip>
                                )}

                                {/* Disable/Enable Button */}
                                {canToggleUser(u) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-8 w-8 p-0 ${
                                          u.is_active === false
                                            ? "text-green-400 hover:text-green-300 hover:bg-green-900/30"
                                            : "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30"
                                        }`}
                                        onClick={() => handleToggleActive(u)}
                                        disabled={actionLoading}
                                      >
                                        {u.is_active === false ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{u.is_active === false ? "Enable user" : "Disable user"}</p></TooltipContent>
                                  </Tooltip>
                                )}

                                {/* Delete Button */}
                                {canDeleteUser(u) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                                        onClick={() => setDeleteModal({ open: true, user: u })}
                                        disabled={actionLoading}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Delete user</p></TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={deleteModal.open} onOpenChange={(open) => !open && setDeleteModal({ open: false, user: null })}>
          <AlertDialogContent className="bg-slate-900 border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-100">Delete User</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-200">{deleteModal.user?.full_name}</span>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} disabled={actionLoading} className="bg-red-600 hover:bg-red-500 text-white">
                {actionLoading ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reset Password Modal */}
        <Dialog open={resetPasswordModal.open} onOpenChange={(open) => { if (!open) { setResetPasswordModal({ open: false, user: null }); setNewPassword(""); } }}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Reset Password</DialogTitle>
              <DialogDescription className="text-slate-400">
                Set a new password for <span className="font-semibold text-slate-200">{resetPasswordModal.user?.full_name}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="text-xs text-slate-300">New password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResetPasswordModal({ open: false, user: null }); setNewPassword(""); }} className="border-slate-600 text-slate-300">Cancel</Button>
              <Button onClick={handleResetPassword} disabled={actionLoading || !newPassword} className="bg-blue-600 hover:bg-blue-500 text-white">
                {actionLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Roles Modal (Phase 6.1) */}
        <Dialog open={editRolesModal.open} onOpenChange={(open) => { if (!open) { setEditRolesModal({ open: false, user: null }); setSelectedRoles([]); } }}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Edit User Roles</DialogTitle>
              <DialogDescription className="text-slate-400">
                Modify roles for <span className="font-semibold text-slate-200">{editRolesModal.user?.full_name}</span>.
                Users can have multiple roles for dual-role scenarios.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Label className="text-xs text-slate-300">Select Roles</Label>
              <div className="bg-slate-950 border border-slate-700 rounded-md p-3 space-y-2">
                {ALL_ROLE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedRoles.includes(opt.value)}
                      onCheckedChange={() => toggleRole(opt.value)}
                    />
                    <span className="text-sm text-slate-300">{opt.label}</span>
                  </label>
                ))}
              </div>
              {selectedRoles.length === 0 && (
                <p className="text-xs text-red-400">At least one role is required</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditRolesModal({ open: false, user: null }); setSelectedRoles([]); }} className="border-slate-600 text-slate-300">Cancel</Button>
              <Button onClick={handleUpdateRoles} disabled={actionLoading || selectedRoles.length === 0} className="bg-purple-600 hover:bg-purple-500 text-white">
                {actionLoading ? "Saving..." : "Save Roles"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Children Modal (Phase 6.1) */}
        <Dialog open={editChildrenModal.open} onOpenChange={(open) => { if (!open) { setEditChildrenModal({ open: false, user: null }); setSelectedChildren([]); } }}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Manage Children</DialogTitle>
              <DialogDescription className="text-slate-400">
                Assign students to <span className="font-semibold text-slate-200">{editChildrenModal.user?.full_name}</span>.
                These students will appear in the parent&apos;s dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Label className="text-xs text-slate-300">Select Children</Label>
              <div className="bg-slate-950 border border-slate-700 rounded-md p-3 max-h-60 overflow-y-auto">
                {students.length === 0 ? (
                  <p className="text-sm text-slate-500">No students available.</p>
                ) : (
                  <div className="space-y-2">
                    {students.map((student) => (
                      <label key={student.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedChildren.includes(student.id)}
                          onCheckedChange={() => toggleChild(student.id)}
                        />
                        <span className="text-sm text-slate-300">
                          {student.first_name} {student.last_name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedChildren.length > 0 && (
                <p className="text-xs text-slate-400">
                  {selectedChildren.length} student(s) selected
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditChildrenModal({ open: false, user: null }); setSelectedChildren([]); }} className="border-slate-600 text-slate-300">Cancel</Button>
              <Button onClick={handleUpdateChildren} disabled={actionLoading} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                {actionLoading ? "Saving..." : "Save Children"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Grade Assignments Modal (Teachers) */}
        <Dialog open={editGradesModal.open} onOpenChange={(open) => { if (!open) { setEditGradesModal({ open: false, user: null }); setSelectedGrades([]); } }}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Assign Grades to Teacher</DialogTitle>
              <DialogDescription className="text-slate-400">
                Assign grades to <span className="font-semibold text-slate-200">{editGradesModal.user?.full_name}</span>.
                Teachers will only see students from their assigned grades.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Label className="text-xs text-slate-300">Select Grades</Label>
              <div className="bg-slate-950 border border-slate-700 rounded-md p-3 max-h-60 overflow-y-auto">
                {grades.length === 0 ? (
                  <p className="text-sm text-slate-500">No grades available.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {grades
                      .filter(g => g.is_active)
                      .sort((a, b) => (a.level || 0) - (b.level || 0))
                      .map((grade) => (
                      <label key={grade.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedGrades.includes(grade.id)}
                          onCheckedChange={() => toggleGrade(grade.id)}
                        />
                        <span className="text-sm text-slate-300">
                          {grade.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedGrades.length > 0 && (
                <p className="text-xs text-slate-400">
                  {selectedGrades.length} grade(s) selected
                </p>
              )}
              {selectedGrades.length === 0 && (
                <p className="text-xs text-amber-400">
                  Teachers without assigned grades will not see any students
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditGradesModal({ open: false, user: null }); setSelectedGrades([]); }} className="border-slate-600 text-slate-300">Cancel</Button>
              <Button onClick={handleUpdateGrades} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-500 text-white">
                {actionLoading ? "Saving..." : "Save Grades"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
