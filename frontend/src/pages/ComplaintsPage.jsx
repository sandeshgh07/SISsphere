import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
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
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Filter, MessageSquare, Clock, CheckCircle, AlertTriangle, User, Shield, Lock, X } from "lucide-react";
// debounce is handled by custom hook below

// Custom Debounce Hook if lodash not available/wanted
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function ComplaintsPage() {
  const { accessToken, user, activeRole } = useAuth();
  const { toast } = useToast();

  // Data
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create / Detail Logic
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Filters (Client side for now, can be server side if needed)
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  // Create Form State
  const [newComplaint, setNewComplaint] = useState({
    title: "",
    description: "",
    category: "", // 'student' or 'staff'
    severity: "low",
    target_user_ids: [], // for staff
    student_id: "", // for student
    visible_to_principal: true,
    visible_to_school_admin: false,
    visible_to_board: false,
    visible_to_parents: false,
    visible_to_student: false
  });

  // User Picker State (Staff Multi-Select)
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const debouncedUserSearch = useDebounce(userSearchTerm, 300);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState([]); // Array of user objects {id, name, role}

  // Student Picker State
  const [studentsList, setStudentsList] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);

  const isStaffOrAdmin = ["principal", "super_admin", "school_admin", "teacher", "accountant"].includes(activeRole);
  const canManageCases = ["principal", "super_admin", "school_admin"].includes(activeRole);

  useEffect(() => {
    if (accessToken) {
      loadComplaints();
      if (showCreateModal) {
        loadStudents();
        // Don't load all staff, we use search now
      }
    }
  }, [accessToken, showCreateModal]);

  useEffect(() => {
    if (selectedComplaint) {
      loadMessages(selectedComplaint.id);
    } else {
      setMessages([]);
    }
  }, [selectedComplaint]);

  const loadMessages = async (id) => {
    try {
      const res = await api.get(`/complaints/${id}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await api.post(`/complaints/${selectedComplaint.id}/messages`, {
        content: newMessage,
        is_internal: isInternalNote
      });
      setNewMessage("");
      loadMessages(selectedComplaint.id);
    } catch (e) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      await api.patch(`/complaints/${selectedComplaint.id}/status`, { status: newStatus });
      toast({ title: "Success", description: `Status updated to ${newStatus}` });

      // Update local state
      setSelectedComplaint(prev => ({ ...prev, status: newStatus }));
      setComplaints(prev => prev.map(c => c.id === selectedComplaint.id ? { ...c, status: newStatus } : c));
    } catch (e) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.get('/complaints');
      setComplaints(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to load complaints", e);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await api.get('/students'); // Assuming endpoint exists
      setStudentsList(Array.isArray(res.data) ? res.data : []);
    } catch (e) { /* ignore */ }
  };

  // User Search Effect
  useEffect(() => {
    if (!showCreateModal || newComplaint.category !== "staff" || !debouncedUserSearch) {
      setUserSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearchingUsers(true);
      try {
        // Using the generic /users endpoint with ?q=
        const res = await api.get(`/users?q=${debouncedUserSearch}`);
        const allUsers = Array.isArray(res.data) ? res.data : [];
        // Filter out current user and maybe students/parents if strictly staff complaint?
        // "Staff" complaint usually means complaining ABOUT a staff member.
        // So we should filter roles probably.
        // Ideally backend supports role filter, but we can do it here if list is small, 
        // BUT for 500+ users we rely on backend.
        // Let's filter client side for now as the query reduces result set.
        const staffOnly = allUsers.filter(u =>
          ["principal", "school_admin", "teacher", "accountant", "guard", "super_admin"].includes(u.role)
          && u.id !== user.id
        );
        setUserSearchResults(staffOnly.slice(0, 10)); // Limit display
      } catch (e) {
        console.error("User search failed", e);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    searchUsers();
  }, [debouncedUserSearch, showCreateModal, newComplaint.category]);

  const handleCreate = async () => {
    if (!newComplaint.title || !newComplaint.description || !newComplaint.category) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const payload = { ...newComplaint };
    if (payload.category === "staff") {
      payload.target_user_ids = selectedStaff.map(u => u.id);
      if (payload.target_user_ids.length === 0) {
        toast({ title: "Error", description: "Please select at least one staff member", variant: "destructive" });
        return;
      }
    } else {
      if (!payload.student_id) {
        toast({ title: "Error", description: "Please select a student", variant: "destructive" });
        return;
      }
    }

    try {
      await api.post('/complaints', payload);
      toast({ title: "Success", description: "Complaint reported successfully" });
      setShowCreateModal(false);
      setNewComplaint({
        title: "", description: "", category: "", severity: "low",
        target_user_ids: [], student_id: "",
        visible_to_principal: true, visible_to_school_admin: false, visible_to_board: false, visible_to_parents: false, visible_to_student: false
      });
      setSelectedStaff([]);
      loadComplaints();
    } catch (e) {
      toast({ title: "Error", description: "Failed to create complaint", variant: "destructive" });
    }
  };

  // Filter Logic
  const getFilteredComplaints = () => {
    return complaints.filter(c => {
      const matchSearch = debouncedSearch === "" ||
        c.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(debouncedSearch.toLowerCase());

      const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
      const matchCat = categoryFilter === "ALL" || c.category === categoryFilter;
      const matchSev = severityFilter === "ALL" || c.severity === severityFilter;

      return matchSearch && matchStatus && matchCat && matchSev;
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      OPEN: "bg-blue-100 text-blue-800 border-blue-200",
      UNDER_REVIEW: "bg-purple-100 text-purple-800 border-purple-200",
      IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
      RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      CLOSED: "bg-slate-100 text-slate-800 border-slate-200",
    };
    return <Badge className={styles[status] || styles.OPEN}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-6 col-span-full min-h-[calc(100vh-10rem)] p-6" data-testid="complaints-page">
      {/* Header & Controls */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-b-2 border-emerald-600 w-max pb-1">
            Complaints & Issues
          </h1>
          <Button onClick={() => setShowCreateModal(true)} className="bg-red-600 hover:bg-red-700 text-white shadow-sm">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="p-4 space-y-4">
            {/* Top Row: Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search complaints by title, description, or context..."
                className="pl-9 bg-slate-50 border-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Bottom Row: Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                {["ALL", "OPEN", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(s => (
                  <Badge
                    key={s}
                    variant={statusFilter === s ? "default" : "outline"}
                    className={`cursor-pointer px-3 ${statusFilter === s ? 'bg-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
              <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="facility">Facility</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading issues...</div>
        ) : getFilteredComplaints().length === 0 ? (
          <Card className="border-dashed bg-slate-50/50">
            <CardContent className="py-12 text-center text-slate-500">
              No complaints found matching your filters.
            </CardContent>
          </Card>
        ) : (
          getFilteredComplaints().map(c => (
            <Card
              key={c.id}
              className="group hover:border-emerald-500 transition-colors cursor-pointer"
              onClick={() => setSelectedComplaint(c)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(c.status)}
                    <Badge variant="outline" className="text-xs">{c.category}</Badge>
                    {c.severity === "critical" && <Badge variant="destructive" className="text-xs">CRITICAL</Badge>}
                    <span className="text-xs text-slate-400 flex items-center gap-1 ml-2">
                      <Clock className="w-3 h-3" />
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700">{c.title}</h3>
                  <p className="text-sm text-slate-500 line-clamp-1">{c.description}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-300 group-hover:text-emerald-600">
                  <div className="sr-only">View</div>
                  <MessageSquare className="w-5 h-5" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Category Selection Step */}
            {!newComplaint.category ? (
              <div className="grid grid-cols-2 gap-4">
                <Card
                  className="cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all border-2 border-transparent"
                  onClick={() => setNewComplaint({ ...newComplaint, category: "student" })}
                >
                  <CardContent className="p-6 text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold">Student Issue</h3>
                    <p className="text-xs text-slate-500">Behavior, Academic, Bullying</p>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all border-2 border-transparent"
                  onClick={() => setNewComplaint({ ...newComplaint, category: "staff" })}
                >
                  <CardContent className="p-6 text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold">Staff / System</h3>
                    <p className="text-xs text-slate-500">Facilities, Management, Conduct</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h3 className="font-medium text-slate-900">
                    {newComplaint.category === 'student' ? "Student Issue Details" : "Staff/System Issue Details"}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setNewComplaint({ ...newComplaint, category: "" })} className="text-slate-400">
                    Change Category
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Title *</Label>
                    <Input
                      value={newComplaint.title} onChange={e => setNewComplaint({ ...newComplaint, title: e.target.value })}
                      placeholder="Brief summary used as headline"
                    />
                  </div>

                  {/* Context Selection */}
                  {newComplaint.category === 'student' ? (
                    <div className="col-span-2">
                      <Label>Select Student *</Label>
                      <Select value={newComplaint.student_id} onValueChange={v => setNewComplaint({ ...newComplaint, student_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Search student..." />
                        </SelectTrigger>
                        <SelectContent>
                          {/* In real app, this should also be searchable server-side if list is huge */}
                          {studentsList.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.grade?.name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="col-span-2 space-y-2">
                      <Label>Select Staff Members *</Label>
                      <div className="border rounded-md p-2 bg-slate-50 relative">
                        {/* Selected Pills */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {selectedStaff.map(u => (
                            <Badge key={u.id} variant="secondary" className="pl-2 pr-1 h-7">
                              {u.first_name} {u.last_name}
                              <button onClick={() => setSelectedStaff(selectedStaff.filter(s => s.id !== u.id))} className="ml-1 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-400" />
                          <Input
                            className="pl-7 h-8 text-sm"
                            placeholder="Type name to search staff..."
                            value={userSearchTerm}
                            onChange={e => setUserSearchTerm(e.target.value)}
                          />
                        </div>

                        {/* Dropdown Results */}
                        {userSearchResults.length > 0 && (
                          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border shadow-lg rounded-md max-h-48 overflow-y-auto">
                            {userSearchResults.map(u => {
                              const isSelected = selectedStaff.find(s => s.id === u.id);
                              if (isSelected) return null;
                              return (
                                <div
                                  key={u.id}
                                  className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-sm"
                                  onClick={() => {
                                    setSelectedStaff([...selectedStaff, u]);
                                    setUserSearchTerm("");
                                  }}
                                >
                                  <div>
                                    <div className="font-medium text-slate-900">{u.first_name} {u.last_name}</div>
                                    <div className="text-xs text-slate-500 capitalize">{u.role?.replace('_', ' ')}</div>
                                  </div>
                                  <Plus className="w-3 h-3 text-slate-400" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {isSearchingUsers && <div className="absolute right-3 top-3"><div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full"></div></div>}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        <Shield className="w-3 h-3 inline mr-1" />
                        Confidential: Selected staff will NOT see this complaint if they are the subject.
                      </p>
                    </div>
                  )}

                  <div className="col-span-2">
                    <Label>Description *</Label>
                    <Textarea
                      rows={5}
                      value={newComplaint.description} onChange={e => setNewComplaint({ ...newComplaint, description: e.target.value })}
                      placeholder="Detailed description of the issue..."
                    />
                  </div>

                  <div>
                    <Label>Severity</Label>
                    <Select value={newComplaint.severity} onValueChange={v => setNewComplaint({ ...newComplaint, severity: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="mb-2 block">Visibility Settings</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="v-princ"
                        checked={newComplaint.visible_to_principal}
                        onCheckedChange={c => setNewComplaint({ ...newComplaint, visible_to_principal: c })}
                      />
                      <Label htmlFor="v-princ" className="font-normal text-sm">Visible to Principal</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="v-school-admin"
                        checked={newComplaint.visible_to_school_admin}
                        onCheckedChange={c => setNewComplaint({ ...newComplaint, visible_to_school_admin: c })}
                      />
                      <Label htmlFor="v-school-admin" className="font-normal text-sm">Visible to School Admin</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="v-board"
                        checked={newComplaint.visible_to_board}
                        onCheckedChange={c => setNewComplaint({ ...newComplaint, visible_to_board: c })}
                      />
                      <Label htmlFor="v-board" className="font-normal text-sm">Visible to Board Members</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="v-parent"
                        checked={newComplaint.visible_to_parents}
                        onCheckedChange={c => setNewComplaint({ ...newComplaint, visible_to_parents: c })}
                      />
                      <Label htmlFor="v-parent" className="font-normal text-sm">Visible to Parents</Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            {newComplaint.category && (
              <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">Submit Report</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Sheet - Placeholder for brevity, assuming established patterns */}
      <Sheet open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        <SheetContent className="sm:max-w-xl w-[90vw] overflow-y-auto">
          {selectedComplaint && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedComplaint.title}</h2>
                {getStatusBadge(selectedComplaint.status)}
              </div>
              <p className="text-slate-600 whitespace-pre-wrap">{selectedComplaint.description}</p>

              <div className="bg-slate-50 p-4 rounded text-sm text-slate-600 grid grid-cols-2 gap-2">
                <div><span className="font-semibold">Category:</span> {selectedComplaint.category}</div>
                <div><span className="font-semibold">Severity:</span> {selectedComplaint.severity}</div>
                <div><span className="font-semibold">Reported:</span> {new Date(selectedComplaint.created_at).toLocaleDateString()}</div>
              </div>

              {/* Message Thread */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Activity Log
                </h3>

                <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
                  {messages.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 italic bg-slate-50 rounded">
                      No messages yet. Start the conversation.
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div k={msg.id} className={`flex flex-col gap-1 ${msg.sender_id === user.id ? 'items-end' : 'items-start'}`}>
                        <div className={`p-3 rounded-lg max-w-[85%] text-sm ${msg.is_internal
                          ? 'bg-amber-50 border border-amber-200 text-amber-900'
                          : msg.sender_id === user.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-800'
                          }`}>
                          {msg.is_internal && <div className="text-[10px] font-bold uppercase mb-1 opacity-70 flex items-center gap-1"><Lock className="w-3 h-3" /> Internal Note</div>}
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Controls */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                  <Textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message or internal note..."
                    rows={3}
                    className="bg-white"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="internal"
                        checked={isInternalNote}
                        onCheckedChange={setIsInternalNote}
                      />
                      <Label htmlFor="internal" className="text-xs text-slate-600 cursor-pointer flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Internal Note
                      </Label>
                    </div>
                    <Button size="sm" onClick={handleSendMessage} disabled={!newMessage.trim()} className="bg-slate-900 text-white">
                      Send Message
                    </Button>
                  </div>
                </div>

                {/* Status Actions */}
                {canManageCases && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="text-sm font-medium mb-3 text-slate-900">Manage Status</h4>
                    <div className="flex flex-wrap gap-2">
                      {/* State Machine UI Logic */}
                      {/* NEW -> UNDER_REVIEW */}
                      {(selectedComplaint.status === 'NEW' || selectedComplaint.status === 'OPEN') && (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('UNDER_REVIEW')} className="border-purple-200 text-purple-700 hover:bg-purple-50">
                          Mark Under Review
                        </Button>
                      )}

                      {/* UNDER_REVIEW -> IN_PROGRESS | RESOLVED */}
                      {selectedComplaint.status === 'UNDER_REVIEW' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('IN_PROGRESS')} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                            Mark In Progress
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('RESOLVED')} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            Mark Resolved
                          </Button>
                        </>
                      )}

                      {/* IN_PROGRESS -> RESOLVED */}
                      {selectedComplaint.status === 'IN_PROGRESS' && (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('RESOLVED')} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                          Mark Resolved
                        </Button>
                      )}

                      {/* RESOLVED -> CLOSED | IN_PROGRESS (Reopen) */}
                      {selectedComplaint.status === 'RESOLVED' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('CLOSED')} className="border-slate-200 text-slate-700 hover:bg-slate-50">
                            Close Case
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('IN_PROGRESS')} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                            Reopen (In Progress)
                          </Button>
                        </>
                      )}

                      {/* CLOSED -> IN_PROGRESS (SuperAdmin/Board only - heavily restricted) */}
                      {selectedComplaint.status === 'CLOSED' && (activeRole === 'super_admin' || activeRole === 'board') && (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('IN_PROGRESS')} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                          Reopen Case
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline Metadata */}
                <div className="mt-6 border-t pt-4 text-xs text-slate-400 space-y-1">
                  {selectedComplaint.status_changed_at && <div>Last Status Change: {new Date(selectedComplaint.status_changed_at).toLocaleString()}</div>}
                  {selectedComplaint.resolved_at && <div>Resolved At: {new Date(selectedComplaint.resolved_at).toLocaleString()}</div>}
                  {selectedComplaint.closed_at && <div>Closed At: {new Date(selectedComplaint.closed_at).toLocaleString()}</div>}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
