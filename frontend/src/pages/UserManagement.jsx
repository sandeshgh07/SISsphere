import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
    Users,
    Search,
    Plus,
    MoreVertical,
    Shield,
    UserCheck,
    UserX,
    KeyRound,
    Trash2,
    Loader2,
    Mail,
    Phone,
    AlertTriangle,
    ShieldAlert,
    Download,
    Upload,
    ChevronRight // Optional icon for interaction hint
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { UserProfileDrawer } from "@/components/UserProfileDrawer";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function UserManagement() {
    const { user, accessToken } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const navigate = useNavigate();

    // Drawer State
    const [selectedProfileUser, setSelectedProfileUser] = useState(null);

    // Create User Modal
    const [createModal, setCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newUser, setNewUser] = useState({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        roles: [], // Multi-select roles
        phone: "",
    });

    const [gradesWithSections, setGradesWithSections] = useState([]);

    // Valid roles for creation based on RBAC
    // Principal: Can create Student, Parent, Accountant, Teacher, Guard, School Admin (NOT Super Admin or Principal)
    // Super Admin: Can create all roles including Principal
    const allowedRoles = user?.role === "principal"
        ? ["student", "parent", "accountant", "teacher", "guard", "school_admin"]
        : ["principal", "super_admin", "school_admin", "accountant", "teacher", "guard", "student", "parent"];

    // Principal Handover State
    const [handoverModal, setHandoverModal] = useState({
        open: false,
        step: 1,
        targetUser: null, // The user being promoted/demoted
        action: "promote", // promote or demote
        newPrincipalData: { full_name: "", email: "", password: "" },
        oldPrincipalFate: "demote_teacher",
        confirmText: "",
        processing: false
    });

    // Edit/Action State
    const [processing, setProcessing] = useState(null); // ID of user being processed

    // Role Change Modal State (Multi-Step)
    const [roleChangeModal, setRoleChangeModal] = useState({
        open: false,
        step: 1, // 1: Warning, 2: Selection, 3: Confirmation
        selectedUserId: "",
        actionType: "change_role", // "change_role" or "terminate"
        newRole: "",
        reason: "",
        confirmText: "",
        processing: false
    });

    // Manage Roles Modal State (Quick action from 3-dot menu)
    const [addRoleModal, setAddRoleModal] = useState({
        open: false,
        userId: "",
        userName: "",
        currentRoles: [],
        selectedRoles: [], // Multi-select
        processing: false
    });

    // Validation helpers
    const isReasonValid = (roleChangeModal.reason || "").length >= 20;
    const isConfirmValid = (roleChangeModal.confirmText || "") === "CONFIRM";

    // Get selected user object
    const getSelectedUser = () => users.find(u => String(u.id) === roleChangeModal.selectedUserId);

    // Available roles for the role change modal, filtered by current user's permissions
    // Principal: Can promote/demote to Student, Parent, Accountant, Teacher, Guard, School Admin (NOT Super Admin or Principal)
    // Super Admin: Can promote/demote to any role
    const getAvailableTargetRoles = () => {
        if (user?.role === "principal") {
            return ["student", "parent", "accountant", "teacher", "guard", "school_admin"];
        }
        // SuperAdmins can assign any role
        return ["principal", "super_admin", "school_admin", "accountant", "teacher", "guard", "student", "parent"];
    };

    // Reset modal to initial state
    const resetRoleChangeModal = () => {
        setRoleChangeModal({
            open: false,
            step: 1,
            selectedUserId: "",
            actionType: "change_role",
            newRole: "",
            reason: "",
            confirmText: "",
            processing: false
        });
    };

    const headers = accessToken
        ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
        : {};

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append("q", search);
            if (roleFilter !== "all") params.append("role", roleFilter);
            if (statusFilter !== "all") params.append("status", statusFilter);

            const res = await axios.get(`${API_BASE}/api/users?${params.toString()}`, { headers });
            setUsers(res.data);
        } catch (err) {
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    }, [accessToken, search, roleFilter, statusFilter]);

    useEffect(() => {
        loadUsers();
        // Load grades for assignment
        axios.get(`${API_BASE}/api/academics/grades-with-sections`, { headers })
            .then(res => setGradesWithSections(res.data))
            .catch(err => console.error("Failed to load grades", err));
    }, [loadUsers]);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            // Check student requirements
            if ((newUser.roles || []).includes("student")) {
                if (!newUser.grade_id || !newUser.section_id) {
                    toast.error("Grade and Section are required for students");
                    setCreating(false);
                    return;
                }
            }

            const payload = { ...newUser };

            // Construct student_assignment if student
            if ((payload.roles || []).includes("student")) {
                payload.student_assignment = {
                    grade_id: newUser.grade_id,
                    section_id: newUser.section_id,
                    roll_number: newUser.roll_number
                };
                // Clean up root fields if API doesn't want them (though schema ignores extra)
                delete payload.grade_id;
                delete payload.section_id;
                delete payload.roll_number;
            }

            await axios.post(`${API_BASE}/api/users`, payload, { headers });
            toast.success("User created successfully");
            setCreateModal(false);
            setNewUser({ first_name: "", last_name: "", email: "", password: "", roles: [], phone: "" });
            loadUsers();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to create user");
        } finally {
            setCreating(false);
        }
    };

    const handleToggleStatus = async (userId, currentStatus) => {
        setProcessing(userId);
        try {
            const action = currentStatus ? "disable" : "enable";
            await axios.post(`${API_BASE}/api/users/${userId}/${action}`, {}, { headers });
            toast.success(`User ${action}d successfully`);
            loadUsers();
        } catch (err) {
            toast.error("Failed to update status");
        } finally {
            setProcessing(null);
        }
    };

    const handleDelete = async (userId) => {
        if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
        setProcessing(userId);
        try {
            await axios.delete(`${API_BASE}/api/users/${userId}`, { headers });
            toast.success("User deleted successfully");
            loadUsers();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to delete user");
        } finally {
            setProcessing(null);
        }
    };

    const getRoleBadge = (role) => {
        const styles = {
            super_admin: "bg-purple-600 text-white",
            principal: "bg-nepsis-primary text-white",
            teacher: "bg-green-600 text-white",
            student: "bg-yellow-600 text-white",
            parent: "bg-orange-600 text-white",
            accountant: "bg-slate-600 text-white",
            school_admin: "bg-blue-600 text-white",
            guard: "bg-teal-600 text-white",
        };
        // Handle terminated roles
        if (role?.startsWith("terminated_")) {
            return <Badge className="bg-red-800 text-white">{role.replace('_', ' ').toUpperCase()}</Badge>;
        }
        return <Badge className={styles[role] || "bg-slate-600 text-white"}>{(role || "unknown").replace('_', ' ').toUpperCase()}</Badge>;
    };

    const openHandoverModal = (targetUser, action) => {
        setHandoverModal({
            open: true,
            step: 1,
            targetUser,
            action,
            newPrincipalData: { full_name: "", email: "", password: "" },
            oldPrincipalFate: "demote_teacher",
            confirmText: "",
            processing: false
        });
    };

    const handleHandoverSubmit = async () => {
        if (!user?.school_id) {
            toast.error("School ID missing");
            return;
        }

        setHandoverModal(prev => ({ ...prev, processing: true }));
        try {
            const payload = {
                create_new_principal: false,
                old_principal_fate: handoverModal.oldPrincipalFate,
                old_principal_grades: []
            };

            if (handoverModal.action === 'promote') {
                payload.new_principal_id = handoverModal.targetUser?.id;
            } else {
                payload.old_principal_id = handoverModal.targetUser?.id;
            }

            await axios.post(`${API_BASE}/api/schools/${user.school_id}/handover-principal`, payload, { headers });

            toast.success("Principal change processed successfully.");
            setHandoverModal(prev => ({ ...prev, open: false }));
            loadUsers();

            if (user.id === handoverModal.targetUser?.id) {
                window.location.reload();
            }

        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Handover failed");
        } finally {
            setHandoverModal(prev => ({ ...prev, processing: false }));
        }
    };

    // Handle Role Change / Termination from the modal
    const handleRoleChangeSubmit = async () => {
        if (!roleChangeModal.selectedUserId) {
            toast.error("Please select a user.");
            return;
        }

        if (!isReasonValid) {
            toast.error("Reason must be at least 20 characters.");
            return;
        }

        if (!isConfirmValid) {
            toast.error("Please type CONFIRM to proceed.");
            return;
        }

        setRoleChangeModal(prev => ({ ...prev, processing: true }));
        try {
            if (roleChangeModal.actionType === "terminate") {
                await axios.post(
                    `${API_BASE}/api/users/${roleChangeModal.selectedUserId}/terminate`,
                    { reason: roleChangeModal.reason },
                    { headers }
                );
                toast.success("User terminated successfully.");
            } else {
                if (!roleChangeModal.newRole) {
                    toast.error("Please select a new role.");
                    setRoleChangeModal(prev => ({ ...prev, processing: false }));
                    return;
                }
                await axios.patch(
                    `${API_BASE}/api/users/${roleChangeModal.selectedUserId}/roles`,
                    { roles: [roleChangeModal.newRole], reason: roleChangeModal.reason },
                    { headers }
                );
                toast.success("User role updated successfully.");
            }
            resetRoleChangeModal();
            loadUsers();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Action failed.");
        } finally {
            setRoleChangeModal(prev => ({ ...prev, processing: false }));
        }
    };

    // Handle Quick Add Role (from 3-dot menu)
    const handleUpdateRoles = async () => {
        const selectedRoles = addRoleModal.selectedRoles || [];
        if (selectedRoles.length === 0) {
            toast.error("Please select at least one role.");
            return;
        }

        setAddRoleModal(prev => ({ ...prev, processing: true }));
        try {
            await axios.patch(
                `${API_BASE}/api/users/${addRoleModal.userId}/roles`,
                { roles: selectedRoles, reason: `Updated roles to: ${selectedRoles.join(", ")}` },
                { headers }
            );
            toast.success("Roles updated successfully.");
            setAddRoleModal({ open: false, userId: "", userName: "", currentRoles: [], selectedRoles: [], processing: false });
            loadUsers();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Failed to update roles.");
        } finally {
            setAddRoleModal(prev => ({ ...prev, processing: false }));
        }
    };

    // Toggle role in selectedRoles
    const toggleRoleSelection = (role) => {
        const current = addRoleModal.selectedRoles || [];
        if (current.includes(role)) {
            setAddRoleModal(prev => ({ ...prev, selectedRoles: current.filter(r => r !== role) }));
        } else {
            setAddRoleModal(prev => ({ ...prev, selectedRoles: [...current, role] }));
        }
    };

    // Manage Enrollment Modal State
    const [enrollmentModal, setEnrollmentModal] = useState({
        open: false,
        userId: "",
        userName: "",
        grade_id: "",
        section_id: "",
        roll_number: "",
        processing: false
    });

    const handleManageEnrollment = (user) => {
        // We need to fetch current enrollment first or pass it if available.
        // The user list API doesn't fully return specific grade/section ID, it might return names if we joined.
        // But `list_users` in `schools/router.py` returns `UserOut` which doesn't have student details.
        // We need to fetch the student profile for this user.
        // OR rely on empty defaults and let user set new ones.
        // Better: Fetch student profile.

        setEnrollmentModal({
            open: true,
            userId: user.id,
            userName: user.full_name,
            grade_id: "",
            section_id: "",
            roll_number: "",
            processing: true // Loading initial data
        });

        // Search for student profile by user_id. 
        // We don't have a direct "get student by user id" endpoint easily accessible publicly?
        // `GET /api/students` filters by user.id if student? No, `GET /api/students` lists all.
        // We can use `GET /api/students` and filter client side or implement a specific get.
        // Given existing endpoints, we probably have to iterate `students` list or add a specific endpoint. 
        // Or just let them set new values (blank start).
        // Let's try to fetch all students once and match? No, too heavy.

        // I'll leave it blank for now or fetch if we had the data. 
        // Wait, I can try to find if this user is in `students` list if I loaded it? I didn't load students list.
        // I'll just set processing false and let them choose new assignment.
        // Ideally we pre-fill. 

        setEnrollmentModal(prev => ({ ...prev, processing: false }));
    };

    const handleEnrollmentSubmit = async () => {
        if (!enrollmentModal.grade_id || !enrollmentModal.section_id) {
            toast.error("Grade and Section are required");
            return;
        }

        setEnrollmentModal(prev => ({ ...prev, processing: true }));
        try {
            await axios.patch(`${API_BASE}/api/students/${enrollmentModal.userId}/assignment`, {
                grade_id: enrollmentModal.grade_id,
                section_id: enrollmentModal.section_id,
                roll_number: enrollmentModal.roll_number,
                reason: "Admin updated enrollment via User Management"
            }, { headers });

            toast.success("Enrollment updated successfully");
            setEnrollmentModal(prev => ({ ...prev, open: false }));
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Failed to update enrollment");
        } finally {
            setEnrollmentModal(prev => ({ ...prev, processing: false }));
        }
    };


    const handleUserClick = (targetUser) => {
        // Prevent click if clicking on actions column
        // (Handled by onClick on tr vs button propagation stopping)

        if (targetUser.related_student_id) {
            navigate(`/dashboard/students/${targetUser.related_student_id}`);
            return;
        }

        // Show drawer for others
        setSelectedProfileUser(targetUser);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="h-6 w-6 text-nepsis-primary" />
                        User Management
                    </h1>
                    <p className="text-slate-500">Manage accounts, roles, and access for your school.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => {
                            // Simple CSV Export of current view
                            if (!users.length) {
                                toast.error("No users to export");
                                return;
                            }
                            const headers = ["ID", "Name", "Email", "Role", "Status", "Phone"];
                            const rows = users.map(u => [
                                u.id,
                                `"${u.full_name}"`,
                                u.email,
                                (u.roles || [u.role]).join("|"),
                                u.is_active ? "Active" : "Inactive",
                                u.phone || ""
                            ]);
                            const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
                            const link = document.createElement("a");
                            link.setAttribute("href", encodeURI(csvContent));
                            link.setAttribute("download", "users_export.csv");
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        variant="outline"
                        className="border-slate-300 text-slate-700"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button
                        onClick={() => {
                            // Trigger file input
                            document.getElementById('user-import-input').click();
                        }}
                        variant="outline"
                        className="border-slate-300 text-slate-700"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                    </Button>
                    <input
                        type="file"
                        id="user-import-input"
                        hidden
                        accept=".csv"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = async (event) => {
                                const text = event.target.result;
                                const lines = text.split('\n');
                                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

                                // Basic validation
                                if (!headers.includes('email') || !headers.includes('first_name')) {
                                    toast.error("CSV must contain email and first_name columns");
                                    return;
                                }

                                toast.info("Importing users... (Check console for details)");
                                // Mock import loop for now as we lack bulk endpoint
                                let success = 0;
                                for (let i = 1; i < lines.length; i++) {
                                    if (!lines[i].trim()) continue;
                                    const vals = lines[i].split(',');
                                    const userObj = {};
                                    headers.forEach((h, idx) => userObj[h] = vals[idx]?.trim());

                                    // Try create
                                    try {
                                        await axios.post(`${API_BASE}/api/users`, {
                                            ...userObj,
                                            password: "changeme123", // Default password for bulk import
                                            roles: userObj.role ? [userObj.role] : ['student']
                                        }, { headers: { Authorization: `Bearer ${accessToken}` } });
                                        success++;
                                    } catch (err) {
                                        console.error("Failed to import row", i, err);
                                    }
                                }
                                toast.success(`Import processing complete. Created ${success} users.`);
                                loadUsers();
                            };
                            reader.readAsText(file);
                            e.target.value = null; // Reset
                        }}
                    />
                    <Button
                        onClick={() => setRoleChangeModal({
                            open: true,
                            step: 1,
                            selectedUserId: "",
                            actionType: "change_role",
                            newRole: "",
                            reason: "",
                            confirmText: "",
                            processing: false
                        })}
                        variant="outline"
                        className="border-nepsis-primary text-nepsis-primary hover:bg-nepsis-primary/10"
                    >
                        <Shield className="h-4 w-4 mr-2" />
                        Manage Roles
                    </Button>
                    <Button onClick={() => setCreateModal(true)} className="bg-nepsis-primary hover:bg-nepsis-primary/90 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                    </Button>
                </div>
            </div>

            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search users..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-white border-slate-300 focus:border-nepsis-primary text-slate-900 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="w-[150px] bg-white border-slate-300 text-slate-900">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-900">
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="super_admin">School SuperAdmin</SelectItem>
                                    <SelectItem value="principal">Principal</SelectItem>
                                    <SelectItem value="teacher">Teacher</SelectItem>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="parent">Parent</SelectItem>
                                    <SelectItem value="accountant">Accountant</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[150px] bg-white border-slate-300 text-slate-900">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-900">
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            Loading users...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            No users found matching your filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map((u) => (
                                        <tr
                                            key={u.id}
                                            className="hover:bg-slate-50 transition-colors group"
                                        >
                                            <td className="px-6 py-4 cursor-pointer" onClick={() => handleUserClick(u)}>
                                                <div className="font-medium text-slate-900">{u.full_name}</div>
                                                <div className="text-xs text-slate-500">{u.email}</div>
                                            </td>
                                            <td className="px-6 py-4 cursor-pointer" onClick={() => handleUserClick(u)}>
                                                <div className="flex gap-1 flex-wrap">
                                                    {(u.roles || [u.role]).map(r => (
                                                        <div key={r}>{getRoleBadge(r)}</div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 cursor-pointer" onClick={() => handleUserClick(u)}>
                                                <div className="flex flex-col gap-1 text-xs">
                                                    <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</div>
                                                    {u.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {u.phone}</div>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 cursor-pointer" onClick={() => handleUserClick(u)}>
                                                {u.is_active ? (
                                                    <Badge variant="outline" className="text-green-400 border-green-900 bg-green-900/10">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-red-400 border-red-900 bg-red-900/10">Inactive</Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-white border-slate-200 shadow-md">
                                                        {(u.roles || [u.role]).includes("student") && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleManageEnrollment(u)}
                                                                className="text-slate-700 focus:bg-slate-100"
                                                            >
                                                                <Users className="mr-2 h-4 w-4" /> Manage Enrollment
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            onClick={() => handleToggleStatus(u.id, u.is_active)}
                                                            disabled={processing === u.id || user.id === u.id}
                                                            className="text-slate-700 focus:bg-slate-100"
                                                        >
                                                            {u.is_active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                                            {u.is_active ? "Disable Account" : "Enable Account"}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem disabled={processing === u.id} className="text-slate-700 focus:bg-slate-100">
                                                            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => setAddRoleModal({
                                                                open: true,
                                                                userId: String(u.id),
                                                                userName: u.full_name,
                                                                currentRoles: u.roles || [u.role],
                                                                selectedRoles: u.roles || [u.role],
                                                                processing: false
                                                            })}
                                                            disabled={processing === u.id || user.id === u.id}
                                                            className="text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                                                        >
                                                            <Shield className="mr-2 h-4 w-4" /> Manage Roles
                                                        </DropdownMenuItem>

                                                        <DropdownMenuSeparator className="bg-slate-100" />

                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(u.id)}
                                                            disabled={processing === u.id || user.id === u.id}
                                                            className="text-red-600 hover:text-red-700 focus:text-red-700 focus:bg-red-50"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete User
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Profile Drawer */}
            <UserProfileDrawer
                userId={selectedProfileUser?.id}
                open={!!selectedProfileUser}
                onOpenChange={(open) => !open && setSelectedProfileUser(null)}
            />

            {/* Create User Modal */}
            <Dialog open={createModal} onOpenChange={setCreateModal}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>First Name</Label>
                                <Input
                                    required
                                    value={newUser.first_name}
                                    onChange={e => setNewUser({ ...newUser, first_name: e.target.value })}
                                    className="bg-slate-950 border-slate-800"
                                    placeholder="Enter first name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Last Name</Label>
                                <Input
                                    required
                                    value={newUser.last_name}
                                    onChange={e => setNewUser({ ...newUser, last_name: e.target.value })}
                                    className="bg-slate-950 border-slate-800"
                                    placeholder="Enter last name"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                required
                                type="email"
                                value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                className="bg-slate-950 border-slate-800"
                                placeholder="Email address"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Phone (Optional)</Label>
                            <Input
                                value={newUser.phone}
                                onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                                className="bg-slate-950 border-slate-800"
                                placeholder="Phone number"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Roles (select one or more)</Label>
                            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700 max-h-40 overflow-y-auto">
                                {allowedRoles.map(role => (
                                    <label key={role} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-slate-700 p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={(newUser.roles || []).includes(role)}
                                            onChange={(e) => {
                                                const currentRoles = newUser.roles || [];
                                                if (e.target.checked) {
                                                    setNewUser({ ...newUser, roles: [...currentRoles, role] });
                                                } else {
                                                    setNewUser({ ...newUser, roles: currentRoles.filter(r => r !== role) });
                                                }
                                            }}
                                            className="w-4 h-4 accent-nepsis-primary"
                                        />
                                        <span className="capitalize">{role.replace('_', ' ')}</span>
                                    </label>
                                ))}
                            </div>
                            {(newUser.roles || []).length === 0 && (
                                <p className="text-xs text-amber-400">Please select at least one role</p>
                            )}
                        </div>

                        {/* Student Details */}
                        {(newUser.roles || []).includes("student") && (
                            <div className="bg-slate-800 p-4 rounded-lg space-y-4 border border-slate-700">
                                <h3 className="text-sm font-medium text-slate-300">Student Enrollment</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Grade</Label>
                                        <Select
                                            value={newUser.grade_id}
                                            onValueChange={(val) => setNewUser(prev => ({ ...prev, grade_id: val, section_id: "" }))}
                                        >
                                            <SelectTrigger className="bg-slate-950 border-slate-800">
                                                <SelectValue placeholder="Select Grade" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                                {gradesWithSections.map(g => (
                                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Section</Label>
                                        <Select
                                            value={newUser.section_id}
                                            onValueChange={(val) => setNewUser(prev => ({ ...prev, section_id: val }))}
                                            disabled={!newUser.grade_id}
                                        >
                                            <SelectTrigger className="bg-slate-950 border-slate-800">
                                                <SelectValue placeholder="Select Section" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                                {newUser.grade_id && gradesWithSections
                                                    .find(g => g.id === newUser.grade_id)?.sections
                                                    .map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))
                                                }
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label>Roll Number (Optional - Auto-generated if empty)</Label>
                                        <Input
                                            value={newUser.roll_number || ""}
                                            onChange={e => setNewUser({ ...newUser, roll_number: e.target.value })}
                                            className="bg-slate-950 border-slate-800"
                                            placeholder="e.g. 101"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                                required
                                type="password"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                className="bg-slate-950 border-slate-800"
                                placeholder="Min 8 characters"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setCreateModal(false)}>Cancel</Button>
                            <Button type="submit" disabled={creating} className="bg-nepsis-primary hover:bg-nepsis-primary/90">
                                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create User
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Manage Enrollment Modal */}
            <Dialog open={enrollmentModal.open} onOpenChange={(o) => setEnrollmentModal(prev => ({ ...prev, open: o }))}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Manage Enrollment: {enrollmentModal.userName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="bg-blue-900/20 border border-blue-700/50 p-4 rounded-lg text-blue-200 text-sm">
                            Update the academic placement for this student. Use this to transfer students between sections or promote/demote manually.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Grade</Label>
                                <Select
                                    value={enrollmentModal.grade_id}
                                    onValueChange={(val) => setEnrollmentModal(prev => ({ ...prev, grade_id: val, section_id: "" }))}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-800">
                                        <SelectValue placeholder="Select Grade" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                        {gradesWithSections.map(g => (
                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Section</Label>
                                <Select
                                    value={enrollmentModal.section_id}
                                    onValueChange={(val) => setEnrollmentModal(prev => ({ ...prev, section_id: val }))}
                                    disabled={!enrollmentModal.grade_id}
                                >
                                    <SelectTrigger className="bg-slate-950 border-slate-800">
                                        <SelectValue placeholder="Select Section" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                        {enrollmentModal.grade_id && gradesWithSections
                                            .find(g => g.id === enrollmentModal.grade_id)?.sections
                                            .map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Roll Number</Label>
                            <Input
                                value={enrollmentModal.roll_number}
                                onChange={e => setEnrollmentModal(prev => ({ ...prev, roll_number: e.target.value }))}
                                className="bg-slate-950 border-slate-800"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setEnrollmentModal(prev => ({ ...prev, open: false }))}>Cancel</Button>
                        <Button onClick={handleEnrollmentSubmit} disabled={enrollmentModal.processing} className="bg-nepsis-primary hover:bg-nepsis-primary/90">
                            {enrollmentModal.processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Enrollment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Principal Handover Modal */}
            <Dialog open={handoverModal.open} onOpenChange={(open) => setHandoverModal(prev => ({ ...prev, open }))}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl text-nepsis-primary">
                            <AlertTriangle className="text-yellow-500" />
                            {handoverModal.action === "promote" ? "Promote to Principal" : "Replace Principal"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg text-yellow-200 text-sm">
                            <p className="font-semibold mb-2">Warning: Critical Role Change</p>
                            {handoverModal.action === "promote" ? (
                                <p>
                                    You are about to promote <strong>{handoverModal.targetUser?.full_name}</strong> to Principal.
                                    This will specific rights and access controls.
                                    The <strong>Current Principal</strong> will be affected.
                                </p>
                            ) : (
                                <p>
                                    You are initiating a replacement for the current Principal.
                                    Please ensure you have a successor ready or select one.
                                    (Currently, this flow supports promoting a new user to replace this one).
                                </p>
                            )}
                        </div>

                        {handoverModal.action === "promote" && (
                            <div className="space-y-3">
                                <Label>What should happen to the OLD Principal?</Label>
                                <RadioGroup
                                    value={handoverModal.oldPrincipalFate}
                                    onValueChange={(v) => setHandoverModal(prev => ({ ...prev, oldPrincipalFate: v }))}
                                    className="space-y-2"
                                >
                                    <div className="flex items-center space-x-2 border border-slate-700 p-3 rounded hover:bg-slate-800 cursor-pointer">
                                        <RadioGroupItem value="demote_teacher" id="r1" />
                                        <Label htmlFor="r1" className="cursor-pointer">Demote to Teacher</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 border border-slate-700 p-3 rounded hover:bg-slate-800 cursor-pointer">
                                        <RadioGroupItem value="demote_admin" id="r2" />
                                        <Label htmlFor="r2" className="cursor-pointer">Demote to School Admin</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 border border-slate-700 p-3 rounded hover:bg-slate-800 cursor-pointer">
                                        <RadioGroupItem value="remove_role" id="r3" />
                                        <Label htmlFor="r3" className="cursor-pointer">Remove Principal Role (Keep other roles)</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Type "CONFIRM" to proceed</Label>
                            <Input
                                value={handoverModal.confirmText}
                                onChange={(e) => setHandoverModal(prev => ({ ...prev, confirmText: e.target.value }))}
                                className="bg-slate-950 border-slate-800"
                                placeholder="CONFIRM"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setHandoverModal(prev => ({ ...prev, open: false }))}>Cancel</Button>
                        <Button
                            onClick={handleHandoverSubmit}
                            disabled={handoverModal.confirmText !== "CONFIRM" || handoverModal.processing}
                            className="bg-nepsis-primary hover:bg-nepsis-primary/90"
                        >
                            {handoverModal.processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Change
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Role Change Modal - Multi-Step */}
            <Dialog open={roleChangeModal.open} onOpenChange={(o) => !roleChangeModal.processing && (o ? setRoleChangeModal(prev => ({ ...prev, open: true })) : resetRoleChangeModal())}>
                <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Shield className="text-nepsis-primary" />
                            {roleChangeModal.step === 1 && "Role Management"}
                            {roleChangeModal.step === 2 && "Select Action"}
                            {roleChangeModal.step === 3 && "Confirm Action"}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Step 1: Warning */}
                    {roleChangeModal.step === 1 && (
                        <div className="space-y-4 py-4">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-amber-800">
                                <p className="font-semibold flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    High-Authority Action
                                </p>
                                <p className="text-sm">
                                    This action can cause significant changes to the running system.
                                    Role changes and terminations are permanent and will be logged for audit purposes.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={resetRoleChangeModal}>Cancel</Button>
                                <Button
                                    onClick={() => setRoleChangeModal(prev => ({ ...prev, step: 2 }))}
                                    className="bg-nepsis-primary hover:bg-nepsis-primary/90 text-white"
                                >
                                    Yes, Proceed
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {/* Step 2: Selection */}
                    {roleChangeModal.step === 2 && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Select User</Label>
                                <Select
                                    value={roleChangeModal.selectedUserId}
                                    onValueChange={(v) => setRoleChangeModal(prev => ({ ...prev, selectedUserId: v }))}
                                >
                                    <SelectTrigger className="bg-white border-slate-300">
                                        <SelectValue placeholder="Choose a user..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200">
                                        {users
                                            .filter(u => {
                                                if (user?.role === "principal" && u.role === "principal") return false;
                                                if (u.id === user?.id) return false;
                                                return true;
                                            })
                                            .map(u => (
                                                <SelectItem key={u.id} value={String(u.id)}>
                                                    {u.full_name} ({u.role})
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Action Type</Label>
                                <Select
                                    value={roleChangeModal.actionType}
                                    onValueChange={(v) => setRoleChangeModal(prev => ({ ...prev, actionType: v, newRole: "" }))}
                                >
                                    <SelectTrigger className="bg-white border-slate-300">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200">
                                        <SelectItem value="change_role">Change Role</SelectItem>
                                        <SelectItem value="terminate" className="text-red-600">Terminate User</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {roleChangeModal.actionType === "change_role" && (
                                <div className="space-y-2">
                                    <Label>New Role</Label>
                                    <Select
                                        value={roleChangeModal.newRole}
                                        onValueChange={(v) => setRoleChangeModal(prev => ({ ...prev, newRole: v }))}
                                    >
                                        <SelectTrigger className="bg-white border-slate-300">
                                            <SelectValue placeholder="Select new role..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white border-slate-200">
                                            {getAvailableTargetRoles().map(role => (
                                                <SelectItem key={role} value={role}>
                                                    {role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setRoleChangeModal(prev => ({ ...prev, step: 1 }))}>Back</Button>
                                <Button
                                    onClick={() => setRoleChangeModal(prev => ({ ...prev, step: 3 }))}
                                    disabled={!roleChangeModal.selectedUserId || (roleChangeModal.actionType === "change_role" && !roleChangeModal.newRole)}
                                    className="bg-nepsis-primary hover:bg-nepsis-primary/90 text-white"
                                >
                                    Next
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {/* Step 3: Confirmation */}
                    {roleChangeModal.step === 3 && (
                        <div className="space-y-4 py-4">
                            <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-800">
                                <p className="font-semibold mb-2">
                                    {roleChangeModal.actionType === "terminate"
                                        ? `You are about to TERMINATE ${getSelectedUser()?.full_name}.`
                                        : `You are about to change ${getSelectedUser()?.full_name}'s role from "${getSelectedUser()?.role}" to "${roleChangeModal.newRole}".`
                                    }
                                </p>
                                <p className="text-sm">This action is irreversible and will be logged.</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Reason (minimum 20 characters) *</Label>
                                <Input
                                    value={roleChangeModal.reason}
                                    onChange={(e) => setRoleChangeModal(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Enter the reason for this change..."
                                    className={`bg-white border-slate-300 ${roleChangeModal.reason.length > 0 && !isReasonValid ? 'border-red-500' : ''}`}
                                />
                                {roleChangeModal.reason.length > 0 && !isReasonValid && (
                                    <p className="text-red-500 text-xs">{20 - roleChangeModal.reason.length} more characters required</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Type "CONFIRM" to proceed *</Label>
                                <Input
                                    value={roleChangeModal.confirmText}
                                    onChange={(e) => setRoleChangeModal(prev => ({ ...prev, confirmText: e.target.value }))}
                                    placeholder="CONFIRM"
                                    className="bg-white border-slate-300"
                                />
                            </div>

                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setRoleChangeModal(prev => ({ ...prev, step: 2 }))}>Back</Button>
                                <Button
                                    onClick={handleRoleChangeSubmit}
                                    disabled={!isReasonValid || !isConfirmValid || roleChangeModal.processing}
                                    className={roleChangeModal.actionType === "terminate" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-nepsis-primary hover:bg-nepsis-primary/90 text-white"}
                                >
                                    {roleChangeModal.processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {roleChangeModal.actionType === "terminate" ? "Terminate User" : "Apply Role Change"}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Manage Roles Modal - Multi-Select */}
            <Dialog open={addRoleModal.open} onOpenChange={(o) => !addRoleModal.processing && setAddRoleModal(prev => ({ ...prev, open: o }))}>
                <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Shield className="text-blue-600" />
                            Manage Roles for {addRoleModal.userName}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="text-sm text-slate-500">
                            Select the roles this user should have. You can add or remove roles.
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-60 overflow-y-auto">
                            {allowedRoles.map(role => (
                                <label key={role} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-slate-100 p-2 rounded">
                                    <input
                                        type="checkbox"
                                        checked={(addRoleModal.selectedRoles || []).includes(role)}
                                        onChange={() => toggleRoleSelection(role)}
                                        className="w-4 h-4 accent-blue-600"
                                    />
                                    <span className="capitalize">{role.replace(/_/g, ' ')}</span>
                                </label>
                            ))}
                        </div>

                        {(addRoleModal.selectedRoles || []).length === 0 && (
                            <p className="text-xs text-red-500">Please select at least one role</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAddRoleModal({ open: false, userId: "", userName: "", currentRoles: [], selectedRoles: [], processing: false })}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateRoles}
                            disabled={(addRoleModal.selectedRoles || []).length === 0 || addRoleModal.processing}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {addRoleModal.processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Roles
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
