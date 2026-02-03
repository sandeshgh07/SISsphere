import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Calendar, Clock, AlertTriangle, AlertCircle, Info, CheckCircle,
  ChevronLeft, Shield, User, X, Check, Bell
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ResizableSplitPane from "@/components/layout/ResizableSplitPane";

export default function NoticesPage() {
  const { accessToken, user, activeRole } = useAuth();
  const { toast } = useToast();

  // Data
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI State
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Form state
  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    priority: "NORMAL",
    scheduled_at: "",
    expires_at: "",
    require_ack: false
  });

  // Targeting State
  const [targetRoles, setTargetRoles] = useState([]);
  const [targetingModes, setTargetingModes] = useState({});
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [gradeAllSections, setGradeAllSections] = useState({});
  const [structure, setStructure] = useState([]);

  const canCreateNotice = ["principal", "super_admin", "school_admin"].includes(activeRole);

  // --- Effects ---
  useEffect(() => {
    if (accessToken) {
      loadNotices();
      loadGradesAndSections();
    }
  }, [accessToken]);

  // Deep linking logic (simplified for single page app with state)
  useEffect(() => {
    if (selectedNotice) {
      setIsMobileDetailsOpen(true);
    } else {
      setIsMobileDetailsOpen(false);
    }
  }, [selectedNotice]);

  // --- API ---
  const loadNotices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/communication/notices');
      setNotices(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Error loading notices:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadGradesAndSections = async () => {
    try {
      const res = await api.get('/academics/structure');
      setStructure(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
  };

  const handleCreateNotice = async () => {
    if (!newNotice.title || !newNotice.content) {
      toast({ title: "Error", description: "Title and content are required", variant: "destructive" });
      return;
    }
    if (targetRoles.length === 0) {
      toast({ title: "Error", description: "Select at least one audience group", variant: "destructive" });
      return;
    }

    // Validation for student/parent specific
    let finalTargetGradeIds = [];
    let finalTargetSectionIds = [];
    const isStudentSpecific = targetRoles.includes("student") && targetingModes["student"] === "SPECIFIC";
    const isParentSpecific = targetRoles.includes("parent") && targetingModes["parent"] === "SPECIFIC";

    if (isStudentSpecific || isParentSpecific) {
      if (selectedGrades.length === 0) {
        toast({ title: "Error", description: "Please select at least one grade for specific targeting.", variant: "destructive" });
        return;
      }
      for (const gradeId of selectedGrades) {
        if (gradeAllSections[gradeId]) {
          finalTargetGradeIds.push(gradeId);
        } else {
          const gradeInfo = structure.find(g => g.grade.id === gradeId);
          const gradeSectionIds = gradeInfo?.sections.map(s => s.id) || [];
          const pickedSections = selectedSections.filter(sid => gradeSectionIds.includes(sid));
          if (pickedSections.length === 0) {
            toast({ title: "Error", description: `Please select at least one section for Grade ${gradeInfo?.grade?.name}`, variant: "destructive" });
            return;
          }
          finalTargetSectionIds.push(...pickedSections);
        }
      }
    }

    const payload = {
      title: newNotice.title,
      content: newNotice.content,
      priority: newNotice.priority,
      target_roles: targetRoles,
      target_grade_ids: finalTargetGradeIds,
      target_section_ids: finalTargetSectionIds,
      require_ack: newNotice.require_ack,
      scheduled_at: newNotice.scheduled_at || null,
      expires_at: newNotice.expires_at || null
    };

    try {
      await api.post('/communication/notices', payload);
      toast({ title: "Success", description: "Notice created successfully" });
      setShowCreateNotice(false);
      resetForm();
      loadNotices();
    } catch (e) {
      toast({ title: "Error", description: "Failed to create notice", variant: "destructive" });
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await api.post(`/communication/notices/${id}/acknowledge`);
      toast({ title: "Acknowledged", description: "You have acknowledged this notice." });
      const updateState = (n) => n.id === id ? { ...n, is_acknowledged: true } : n;
      setNotices(prev => prev.map(updateState));
      if (selectedNotice && selectedNotice.id === id) {
        setSelectedNotice(prev => ({ ...prev, is_acknowledged: true }));
      }
      window.dispatchEvent(new Event('sis-refresh-counts'));
    } catch (e) {
      // if already acked, treating as success UI wise
      if (e.response?.data?.status === "already_acknowledged") {
        toast({ title: "Info", description: "Already acknowledged." });
        const updateState = (n) => n.id === id ? { ...n, is_acknowledged: true } : n;
        setNotices(prev => prev.map(updateState));
        if (selectedNotice?.id === id) setSelectedNotice(prev => ({ ...prev, is_acknowledged: true }));
        window.dispatchEvent(new Event('sis-refresh-counts'));
      } else {
        toast({ title: "Error", description: "Failed to acknowledge", variant: "destructive" });
      }
    }
  };

  const resetForm = () => {
    setNewNotice({ title: "", content: "", priority: "NORMAL", scheduled_at: "", expires_at: "", require_ack: false });
    setTargetRoles([]);
    setTargetingModes({});
    setSelectedGrades([]);
    setSelectedSections([]);
    setGradeAllSections({});
  };

  // --- Helpers ---
  const getSeverityBadge = (priority, isSmall = false) => {
    const sizeClasses = isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";
    switch (priority) {
      case "CRITICAL":
        return <Badge className={`bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 ${sizeClasses}`}>Critial</Badge>;
      case "IMPORTANT":
        return <Badge className={`bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 ${sizeClasses}`}>Important</Badge>;
      default:
        return <Badge className={`bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 ${sizeClasses}`}>Normal</Badge>;
    }
  };

  const filteredNotices = notices.filter(n => {
    const matchesSearch = searchQuery === "" || n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === "ALL" || n.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const sortedNotices = [...filteredNotices].sort((a, b) => {
    // Critical first, then date
    if (a.priority === "CRITICAL" && b.priority !== "CRITICAL") return -1;
    if (b.priority === "CRITICAL" && a.priority !== "CRITICAL") return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const handleNoticeClick = async (notice) => {
    setSelectedNotice(notice);

    // If already read, do nothing further
    if (notice.is_read) return;

    try {
      // Optimistic update locally
      setNotices(prev => prev.map(n =>
        n.id === notice.id ? { ...n, is_read: true } : n
      ));

      // API Call
      await api.post(`/communication/notices/${notice.id}/read`);

      // Trigger sidebar refresh
      window.dispatchEvent(new Event('sis-refresh-counts'));
    } catch (err) {
      console.error("Failed to mark notice as read", err);
    }
  };

  // --- Render Helpers ---
  const renderListPanel = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* HEADER */}
      <div className="p-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Notices</h1>
            <p className="text-sm text-slate-500">School announcements & alerts</p>
          </div>
          {canCreateNotice && (
            <Button size="sm" onClick={() => { resetForm(); setShowCreateNotice(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 px-3">
              <Plus className="w-4 h-4 mr-2" /> New
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search..."
              className="pl-9 bg-slate-50 border-slate-200 h-10 focus-visible:ring-emerald-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mask-fade-right">
            {["ALL", "CRITICAL", "IMPORTANT", "NORMAL"].map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`
                           flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border
                           ${priorityFilter === p
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                        `}
              >
                {p === "ALL" ? "All" : p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LIST CONTENT */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full mb-2"></div>
            Loading...
          </div>
        ) : sortedNotices.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm">No notices found.</p>
          </div>
        ) : (
          sortedNotices.map(notice => {
            const isActive = selectedNotice?.id === notice.id;
            const isUnread = !notice.is_read;

            return (
              <div
                key={notice.id}
                onClick={() => handleNoticeClick(notice)}
                className={`
                           group p-4 rounded-xl border cursor-pointer transition-all duration-200 relative overflow-hidden bg-white
                           ${isActive
                    ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/10'
                    : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'}
                           ${notice.priority === 'CRITICAL' && !isActive ? 'border-l-4 border-l-orange-500' : ''}
                        `}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

                {/* Unread Indicator */}
                {isUnread && !isActive && (
                  <div className="absolute right-2 top-2 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white" title="Unread"></div>
                )}

                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(notice.priority, true)}
                    {notice.require_ack && !notice.is_acknowledged && (
                      <Badge className="px-1.5 py-0.5 text-[10px] bg-orange-50 text-orange-700 border-orange-200">Ack Required</Badge>
                    )}
                    {notice.is_acknowledged && (
                      <Badge className="px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Done</Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(notice.created_at).toLocaleDateString()}</span>
                </div>

                <h3 className={`font-semibold text-sm mb-1 ${isActive ? 'text-emerald-900' : 'text-slate-900'} ${isUnread ? 'font-bold text-slate-900' : ''}`}>
                  {notice.title}
                </h3>
                <p className={`text-xs ${isUnread ? 'text-slate-600' : 'text-slate-500'} line-clamp-2 leading-relaxed`}>
                  {notice.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderDetailsPanel = () => (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {!selectedNotice ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Info className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-600">Select a notice</h3>
          <p className="text-sm">View full details and acknowledgments.</p>
        </div>
      ) : (
        <>
          {/* Mobile Header */}
          <div className="md:hidden flex items-center gap-2 p-4 border-b bg-white sticky top-0 z-10">
            <Button variant="ghost" size="icon" onClick={() => setSelectedNotice(null)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-slate-900">Details</span>
          </div>

          {/* Scroll Content */}
          <div className="flex-1 overflow-y-auto">

            {/* Action Callout - if Ack Required */}
            {selectedNotice.require_ack && (
              <div className={`p-4 md:p-6 pb-0`}>
                <Card className={`${selectedNotice.is_acknowledged ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'} shadow-sm`}>
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${selectedNotice.is_acknowledged ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                        {selectedNotice.is_acknowledged ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className={`font-semibold text-sm ${selectedNotice.is_acknowledged ? 'text-emerald-900' : 'text-orange-900'}`}>
                          {selectedNotice.is_acknowledged ? "Acknowledged" : "Acknowledgment Required"}
                        </h4>
                        <p className={`text-xs mt-0.5 ${selectedNotice.is_acknowledged ? 'text-emerald-700' : 'text-orange-700'}`}>
                          {selectedNotice.is_acknowledged
                            ? "You have confirmed receipt of this notice."
                            : "Please confirm that you have read and understood this notice."}
                        </p>
                      </div>
                    </div>
                    {!selectedNotice.is_acknowledged && (
                      <Button
                        size="sm"
                        onClick={() => handleAcknowledge(selectedNotice.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap w-full sm:w-auto"
                      >
                        Acknowledge
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="p-4 md:p-6 max-w-4xl mx-auto">
              {/* Meta Header */}
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {getSeverityBadge(selectedNotice.priority)}
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    ID: #{selectedNotice.id.toString().slice(0, 6)}
                  </span>
                  {selectedNotice.expires_at && (
                    <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" /> Expires: {new Date(selectedNotice.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">{selectedNotice.title}</h1>
                <div className="flex items-center gap-4 text-xs text-slate-500 border-b border-slate-100 pb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(selectedNotice.created_at).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> Author ID: {selectedNotice.author_id}
                  </span>
                  {selectedNotice.scheduled_at && new Date(selectedNotice.scheduled_at) > new Date() && (
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">Scheduled</span>
                  )}
                </div>
              </div>

              {/* Content Body */}
              <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedNotice.content}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // --- RENDER ---
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 w-full" data-testid="notices-page">

      {/* MOBILE: Conditional Rendering */}
      <div className="md:hidden flex h-full w-full">
        {isMobileDetailsOpen ? renderDetailsPanel() : renderListPanel()}
      </div>

      {/* DESKTOP: Draggable Split Pane */}
      <div className="hidden md:flex h-full w-full">
        <ResizableSplitPane
          storageKey="split:notices"
          left={renderListPanel()}
          right={renderDetailsPanel()}
          defaultLeft={440}
          minLeft={360}
          minRight={400}
        />
      </div>

      {/* Create Modal - Cleaned up */}
      <Dialog open={showCreateNotice} onOpenChange={setShowCreateNotice}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Create New Notice</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Title *</Label>
                <Input
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                  placeholder="e.g., School Holiday Announcement"
                  className="bg-slate-50 border-slate-200"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Content *</Label>
                <textarea
                  value={newNotice.content}
                  onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                  placeholder="Detailed message..."
                  rows={6}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
              <Label className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" /> Target Audience
              </Label>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                {[
                  { key: "student", label: "Students" },
                  { key: "parent", label: "Parents" },
                  { key: "teacher", label: "Teachers" },
                  { key: "accountant", label: "Accountants" },
                  { key: "school_admin", label: "Admins" },
                  { key: "guard", label: "Guards" },
                ].map(({ key, label }) => (
                  <div key={key} className="col-span-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`r-${key}`}
                          checked={targetRoles.includes(key)}
                          onCheckedChange={c => {
                            if (c) { setTargetRoles([...targetRoles, key]); setTargetingModes({ ...targetingModes, [key]: 'ALL' }); }
                            else { setTargetRoles(targetRoles.filter(r => r !== key)); }
                          }}
                        />
                        <Label htmlFor={`r-${key}`} className="text-sm font-medium cursor-pointer">{label}</Label>
                      </div>
                      {targetRoles.includes(key) && ["student", "parent"].includes(key) && (
                        <select
                          className="text-[10px] border rounded bg-white px-1 py-0.5"
                          value={targetingModes[key] || 'ALL'}
                          onChange={e => setTargetingModes({ ...targetingModes, [key]: e.target.value })}
                        >
                          <option value="ALL">All</option>
                          <option value="SPECIFIC">Specific</option>
                        </select>
                      )}
                    </div>

                    {/* Specific Logic UI (Simplified for visual cleaness) */}
                    {targetRoles.includes(key) && targetingModes[key] === 'SPECIFIC' && ["student", "parent"].includes(key) && (
                      <div className="ml-6 mt-2 p-2 bg-white border rounded text-xs text-slate-500 space-y-2">
                        <p>Select grades/sections below.</p>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                          {structure.map(g => (
                            <div key={g.grade.id}>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`g-${g.grade.id}`}
                                  checked={selectedGrades.includes(g.grade.id)}
                                  onCheckedChange={c => {
                                    if (c) { setSelectedGrades([...selectedGrades, g.grade.id]); setGradeAllSections({ ...gradeAllSections, [g.grade.id]: true }); }
                                    else setSelectedGrades(selectedGrades.filter(x => x !== g.grade.id));
                                  }}
                                  className="w-3 h-3"
                                />
                                <label htmlFor={`g-${g.grade.id}`} className="font-medium cursor-pointer">{g.grade.name}</label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Priority Level</Label>
                <Select value={newNotice.priority} onValueChange={(val) => setNewNotice({ ...newNotice, priority: val })}>
                  <SelectTrigger className="bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="IMPORTANT">Important</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Acknowledgment</Label>
                <div className="flex items-center gap-2 mt-2 p-2 border border-slate-200 rounded-md bg-white">
                  <Checkbox
                    id="req-ack"
                    checked={newNotice.require_ack}
                    onCheckedChange={(c) => setNewNotice({ ...newNotice, require_ack: c })}
                  />
                  <Label htmlFor="req-ack" className="font-normal cursor-pointer text-sm">Require Receipt Confirmation</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t bg-slate-50">
            <Button variant="outline" onClick={() => setShowCreateNotice(false)}>Cancel</Button>
            <Button onClick={handleCreateNotice} className="bg-emerald-600 hover:bg-emerald-700 text-white">Publish Notice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
