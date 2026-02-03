import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ResizableSplitPane from "@/components/layout/ResizableSplitPane";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Filter, MessageSquare, Clock, CheckCircle,
  AlertTriangle, User, Shield, Lock, X, ChevronLeft, Send, MoreHorizontal
} from "lucide-react";

// Custom Debounce Hook
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

  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Mobile View State
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);

  // Filters
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
    target_user_ids: [],
    student_id: "",
    visible_to_principal: true,
    visible_to_school_admin: false,
    visible_to_board: false,
    visible_to_parents: false,
    visible_to_student: false
  });

  // User/Student Selection State (Search)
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const debouncedUserSearch = useDebounce(userSearchTerm, 300);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  const isStaffOrAdmin = ["principal", "super_admin", "school_admin", "teacher", "accountant"].includes(activeRole);
  const canManageCases = ["principal", "super_admin", "school_admin"].includes(activeRole);

  // --- Effects ---
  useEffect(() => {
    if (accessToken) {
      loadComplaints();
      if (showCreateModal) loadStudents();
    }
  }, [accessToken, showCreateModal]);

  useEffect(() => {
    if (selectedComplaint) {
      loadMessages(selectedComplaint.id);
      setIsMobileDetailsOpen(true);
    } else {
      setMessages([]);
      setIsMobileDetailsOpen(false);
    }
  }, [selectedComplaint]);

  // --- API Calls ---
  const loadMessages = async (id) => {
    try {
      const res = await api.get(`/communication/complaints/${id}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await api.post(`/communication/complaints/${selectedComplaint.id}/messages`, {
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
      await api.patch(`/communication/complaints/${selectedComplaint.id}/status`, { status: newStatus });
      toast({ title: "Success", description: `Status updated to ${newStatus}` });
      setSelectedComplaint(prev => ({ ...prev, status: newStatus }));
      setComplaints(prev => prev.map(c => c.id === selectedComplaint.id ? { ...c, status: newStatus } : c));
    } catch (e) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.get('/communication/complaints');
      setComplaints(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to load complaints", e);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await api.get('/students');
      setStudentsList(Array.isArray(res.data) ? res.data : []);
    } catch (e) { /* ignore */ }
  };

  // Staff Search Effect
  useEffect(() => {
    if (!showCreateModal || newComplaint.category !== "staff" || !debouncedUserSearch) {
      setUserSearchResults([]);
      return;
    }
    const searchUsers = async () => {
      setIsSearchingUsers(true);
      try {
        const res = await api.get(`/users?q=${debouncedUserSearch}`);
        const allUsers = Array.isArray(res.data) ? res.data : [];
        const staffOnly = allUsers.filter(u =>
          ["principal", "school_admin", "teacher", "accountant", "guard", "super_admin"].includes(u.role)
          && u.id !== user.id
        );
        setUserSearchResults(staffOnly.slice(0, 10));
      } catch (e) { console.error(e); } finally { setIsSearchingUsers(false); }
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
      await api.post('/communication/complaints', payload);
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

  // --- Helpers for Styling ---
  const getStatusBadge = (status) => {
    // Premium Status Pills
    // Open: Green Light
    // In Progress: Orange Light
    // Resolved/Closed: Neutral Gray

    switch (status) {
      case "OPEN":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100">Open</Badge>;
      case "NEW":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100">New</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100">Under Review</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100">In Progress</Badge>;
      case "RESOLVED":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200">Resolved</Badge>;
      case "CLOSED":
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formattedDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // --- Render Helpers to avoid duplication between SplitPane props and Mobile view ---
  const renderListPanel = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header Section */}
      <div className="p-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Complaints</h1>
            <p className="text-sm text-slate-500">Manage and track issues</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 px-4">
            <Plus className="w-4 h-4 mr-2" /> New
          </Button>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search complaints..."
              className="pl-9 bg-slate-50 border-slate-200 h-10 focus-visible:ring-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mask-fade-right">
            {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`
                    flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border
                    ${statusFilter === s
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                  `}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-full bg-slate-50 border-slate-200">
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
              <SelectTrigger className="h-8 text-xs w-full bg-slate-50 border-slate-200">
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
        </div>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full mb-2"></div>
            Loading complaints...
          </div>
        ) : getFilteredComplaints().length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No complaints found.</p>
          </div>
        ) : (
          getFilteredComplaints().map(c => {
            const isActive = selectedComplaint?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedComplaint(c)}
                className={`
                    group p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden
                    ${isActive
                    ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-500/10'
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'}
                  `}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(c.status)}
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{c.category}</span>
                  </div>
                  {c.severity === "critical" && (
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                </div>

                <h3 className={`font-semibold text-sm mb-1 ${isActive ? 'text-emerald-900' : 'text-slate-900'}`}>{c.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{c.description}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formattedDate(c.created_at)}</span>
                  {isActive && <span className="text-emerald-600 font-medium">Viewing</span>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );

  const renderDetailsPanel = () => (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {!selectedComplaint ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-600">Select a complaint</h3>
          <p className="text-sm">Choose an item from the list to view details and respond.</p>
        </div>
      ) : (
        <>
          {/* Mobile Back Button Header (Only visible on mobile when this panel is active) */}
          <div className="md:hidden flex items-center gap-2 p-4 border-b bg-white sticky top-0 z-10">
            <Button variant="ghost" size="icon" onClick={() => setSelectedComplaint(null)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-slate-900">Details</span>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Meta Header */}
            <div className="bg-white p-6 border-b border-slate-200 shadow-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(selectedComplaint.status)}
                    <span className="text-xs text-slate-400">ID: #{selectedComplaint.id.toString().slice(0, 8)}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">{selectedComplaint.title}</h1>
                  <p className="text-slate-600 text-sm leading-relaxed">{selectedComplaint.description}</p>
                </div>

                <div className="flex flex-wrap gap-4 mt-2">
                  <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold mb-1">Category</span>
                    <span className="text-sm font-medium text-slate-700 capitalize">{selectedComplaint.category}</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold mb-1">Severity</span>
                    <span className={`text-sm font-medium capitalize ${selectedComplaint.severity === 'critical' ? 'text-red-600' : 'text-slate-700'}`}>
                      {selectedComplaint.severity}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold mb-1">Reported</span>
                    <span className="text-sm font-medium text-slate-700">{formattedDate(selectedComplaint.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-px flex-1 bg-slate-200"></span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Activity Log</span>
                <span className="h-px flex-1 bg-slate-200"></span>
              </div>

              <div className="space-y-4 pb-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400 text-sm">No activity yet.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                        <div
                          className={`
                                    max-w-[85%] rounded-2xl p-4 text-sm shadow-sm relative group
                                    ${msg.is_internal
                              ? 'bg-orange-50 border border-orange-100 text-slate-800 rounded-tr-none'
                              : isMe
                                ? 'bg-emerald-600 text-white rounded-tr-none'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                            }
                                  `}
                        >
                          {msg.is_internal && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-orange-600 uppercase mb-1 tracking-wider opacity-80">
                              <Lock className="w-3 h-3" /> Internal Note
                            </div>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {msg.sender?.first_name} • {new Date(msg.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer / Composer */}
          <div className="bg-white border-t border-slate-200 p-4 md:p-6 shrink-0 z-20">
            <div className="max-w-3xl mx-auto w-full space-y-4">

              {/* Status Management Bar */}
              {canManageCases && (
                <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                  {/* Status Logic from orig file */}
                  {(selectedComplaint.status === 'NEW' || selectedComplaint.status === 'OPEN') && (
                    <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('UNDER_REVIEW')} className="h-7 text-xs border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-800">
                      Start Review
                    </Button>
                  )}
                  {selectedComplaint.status === 'UNDER_REVIEW' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('IN_PROGRESS')} className="h-7 text-xs border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100">
                        In Progress
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('RESOLVED')} className="h-7 text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                        Resolve
                      </Button>
                    </>
                  )}
                  {selectedComplaint.status === 'IN_PROGRESS' && (
                    <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('RESOLVED')} className="h-7 text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                      Mark Resolved
                    </Button>
                  )}
                  {selectedComplaint.status === 'RESOLVED' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('CLOSED')} className="h-7 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200">
                        Close
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleUpdateStatus('IN_PROGRESS')} className="h-7 text-xs border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100">
                        Reopen
                      </Button>
                    </>
                  )}
                </div>
              )}

              <div className="relative rounded-xl border border-slate-200 shadow-sm bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-400 transition-all">
                <Textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Write a reply..."
                  className="border-0 focus-visible:ring-0 resize-none min-h-[80px] p-3 text-sm"
                />
                <div className="flex items-center justify-between p-2 bg-slate-50/50 rounded-b-xl border-t border-slate-100">
                  <div className="flex items-center">
                    <label className={`
                              flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-xs font-medium select-none
                              ${isInternalNote ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-100'}
                           `}>
                      <Checkbox
                        checked={isInternalNote}
                        onCheckedChange={setIsInternalNote}
                        className="sr-only" // Hidden checkbox, custom styled
                      />
                      {isInternalNote ? <Lock className="w-3 h-3" /> : <Lock className="w-3 h-3 opacity-50" />}
                      {isInternalNote ? "Internal Note" : "Internal Note"}
                    </label>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8 px-4 rounded-lg transition-all"
                  >
                    Send <Send className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // --- RENDER ---
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 w-full" data-testid="complaints-page">

      {/* MOBILE: Conditional Rendering */}
      <div className="md:hidden flex h-full w-full">
        {isMobileDetailsOpen ? renderDetailsPanel() : renderListPanel()}
      </div>

      {/* DESKTOP: Draggable Split Pane */}
      <div className="hidden md:flex h-full w-full">
        <ResizableSplitPane
          storageKey="split:complaints"
          left={renderListPanel()}
          right={renderDetailsPanel()}
          defaultLeft={440}
          minLeft={360}
          minRight={400}
        />
      </div>

      {/* Create Modal Dialog (Kept mostly same but cleaner) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto bg-white p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Report an Issue</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            {!newComplaint.category ? (
              <div className="grid grid-cols-2 gap-4">
                <Card
                  className="cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all shadow-sm hover:shadow-md"
                  onClick={() => setNewComplaint({ ...newComplaint, category: "student" })}
                >
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="mx-auto w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
                      <User className="w-7 h-7" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Student Issue</h3>
                    <p className="text-xs text-slate-500 leading-normal">Behavior, academic concerns, or bullying incidents.</p>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all shadow-sm hover:shadow-md"
                  onClick={() => setNewComplaint({ ...newComplaint, category: "staff" })}
                >
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="mx-auto w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 mb-2">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Staff / System</h3>
                    <p className="text-xs text-slate-500 leading-normal">Facility, management, or system-wide issues.</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-900">
                    {newComplaint.category === 'student' ? "Student Issue" : "Staff/System Issue"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setNewComplaint({ ...newComplaint, category: "" })} className="text-xs h-7 text-slate-500 hover:text-slate-800">
                    Change Category
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Title</Label>
                    <Input
                      value={newComplaint.title} onChange={e => setNewComplaint({ ...newComplaint, title: e.target.value })}
                      placeholder="Short summary of the issue"
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>

                  {newComplaint.category === 'student' ? (
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Student</Label>
                      <Select value={newComplaint.student_id} onValueChange={v => setNewComplaint({ ...newComplaint, student_id: v })}>
                        <SelectTrigger className="bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Select student..." />
                        </SelectTrigger>
                        <SelectContent>
                          {studentsList.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.grade?.name})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Involved Staff (Confidential)</Label>
                      <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {selectedStaff.map(u => (
                            <Badge key={u.id} variant="secondary" className="pl-2 pr-1 h-6 bg-white border border-slate-200 text-slate-700">
                              {u.first_name} {u.last_name}
                              <button onClick={() => setSelectedStaff(selectedStaff.filter(s => s.id !== u.id))} className="ml-1 hover:text-red-600">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            className="pl-8 h-9 text-sm bg-white"
                            placeholder="Search staff name..."
                            value={userSearchTerm}
                            onChange={e => setUserSearchTerm(e.target.value)}
                          />
                          {userSearchResults.length > 0 && (
                            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border shadow-lg rounded-md max-h-48 overflow-y-auto">
                              {userSearchResults.map(u => {
                                if (selectedStaff.find(s => s.id === u.id)) return null;
                                return (
                                  <div
                                    key={u.id}
                                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-sm"
                                    onClick={() => { setSelectedStaff([...selectedStaff, u]); setUserSearchTerm(""); }}
                                  >
                                    <div>
                                      <div className="font-medium text-slate-900">{u.first_name} {u.last_name}</div>
                                      <div className="text-[10px] text-slate-500 capitalize">{u.role?.replace('_', ' ')}</div>
                                    </div>
                                    <Plus className="w-3 h-3 text-emerald-500" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Severity</Label>
                      <Select value={newComplaint.severity} onValueChange={v => setNewComplaint({ ...newComplaint, severity: v })}>
                        <SelectTrigger className="bg-slate-50 border-slate-200">
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

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Description</Label>
                    <Textarea
                      rows={4}
                      value={newComplaint.description} onChange={e => setNewComplaint({ ...newComplaint, description: e.target.value })}
                      placeholder="Detailed explanation..."
                      className="bg-slate-50 border-slate-200 resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">Visibility Permissions</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "v-princ", label: "Principal", checked: newComplaint.visible_to_principal, key: 'visible_to_principal' },
                        { id: "v-sch", label: "School Admin", checked: newComplaint.visible_to_school_admin, key: 'visible_to_school_admin' },
                        { id: "v-bd", label: "Board", checked: newComplaint.visible_to_board, key: 'visible_to_board' },
                        { id: "v-pt", label: "Parents", checked: newComplaint.visible_to_parents, key: 'visible_to_parents' },
                      ].map(vis => (
                        <div key={vis.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={vis.id}
                            checked={vis.checked}
                            onCheckedChange={c => setNewComplaint({ ...newComplaint, [vis.key]: c })}
                          />
                          <Label htmlFor={vis.id} className="font-normal text-sm text-slate-600">{vis.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 pt-2 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-slate-200 text-slate-700">Cancel</Button>
            {newComplaint.category && (
              <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">Submit Report</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
