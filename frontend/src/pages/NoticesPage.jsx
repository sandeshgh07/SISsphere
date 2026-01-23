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
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Calendar, Clock, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useLocation } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

export default function NoticesPage() {
  const { accessToken, user, activeRole } = useAuth();
  const { toast } = useToast();

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateNotice, setShowCreateNotice] = useState(false);

  // Sheet for viewing notice details
  const [selectedNotice, setSelectedNotice] = useState(null);

  // URL Deep Linking
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const noticeIdParam = searchParams.get('noticeId');

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Form state
  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    priority: "NORMAL", // CRITICAL, IMPORTANT, NORMAL
    scheduled_at: "",
    expires_at: "",
    require_ack: false
  });

  // Targeting State
  const [targetRoles, setTargetRoles] = useState([]); // ['student', 'teacher', etc]
  const [targetingModes, setTargetingModes] = useState({}); // { student: 'ALL' | 'SPECIFIC' }
  const [selectedGrades, setSelectedGrades] = useState([]); // [gradeId1, gradeId2]
  const [selectedSections, setSelectedSections] = useState([]); // [sectionId1, sectionId2]
  const [gradeAllSections, setGradeAllSections] = useState({}); // { gradeId: true } (toggle for 'All sections')

  // Grades and sections for targeting
  const [structure, setStructure] = useState([]);

  const canCreateNotice = ["principal", "super_admin", "school_admin"].includes(activeRole);

  useEffect(() => {
    if (!accessToken) return;
    loadNotices();
    loadGradesAndSections();
  }, [accessToken]);

  useEffect(() => {
    if (noticeIdParam && notices.length > 0) {
      const found = notices.find(n => n.id === noticeIdParam);
      if (found) setSelectedNotice(found);
    }
  }, [noticeIdParam, notices]);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notices');
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
      const struct = Array.isArray(res.data) ? res.data : [];
      setStructure(struct);
    } catch (e) {
      console.error("Error loading structure:", e);
    }
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

    // Validation for Student/Parent Specific Mode
    let finalTargetGradeIds = [];
    let finalTargetSectionIds = [];

    const isStudentSpecific = targetRoles.includes("student") && targetingModes["student"] === "SPECIFIC";
    const isParentSpecific = targetRoles.includes("parent") && targetingModes["parent"] === "SPECIFIC";

    if (isStudentSpecific || isParentSpecific) {
      if (selectedGrades.length === 0) {
        toast({ title: "Error", description: "Please select at least one grade for specific targeting.", variant: "destructive" });
        return;
      }

      // Process logic: 
      // For each selected grade:
      // If All Sections -> Add Grade ID to target_grade_ids (Implies whole grade)
      // If Specific Sections -> Add Section IDs to target_section_ids (Do NOT add grade ID)

      const gradesWithAnySelection = [];

      for (const gradeId of selectedGrades) {
        if (gradeAllSections[gradeId]) {
          finalTargetGradeIds.push(gradeId);
          gradesWithAnySelection.push(gradeId);
        } else {
          // Must have at least one section selected for this grade
          // Filter selectedSections that belong to this grade
          const gradeInfo = structure.find(g => g.grade.id === gradeId);
          const gradeSectionIds = gradeInfo?.sections.map(s => s.id) || [];
          const pickedSections = selectedSections.filter(sid => gradeSectionIds.includes(sid));

          if (pickedSections.length === 0) {
            toast({ title: "Error", description: `Please select at least one section for Grade ${gradeInfo?.grade?.name}`, variant: "destructive" });
            return;
          }
          finalTargetSectionIds.push(...pickedSections);
          gradesWithAnySelection.push(gradeId);
        }
      }
    }

    // Prepare payload
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
      await api.post('/notices', payload);
      toast({ title: "Success", description: "Notice created successfully" });
      setShowCreateNotice(false);
      resetForm();
      loadNotices();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to create notice", variant: "destructive" });
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await api.post(`/notices/${id}/acknowledge`);
      toast({ title: "Acknowledged", description: "You have acknowledged this notice." });
    } catch (e) {
      if (e.response?.data?.status === "already_acknowledged") {
        toast({ title: "Info", description: "You have already acknowledged this notice." });
      } else {
        toast({ title: "Error", description: "Failed to acknowledge", variant: "destructive" });
      }
    }
  };

  const resetForm = () => {
    setNewNotice({
      title: "",
      content: "",
      priority: "NORMAL",
      scheduled_at: "",
      expires_at: "",
      require_ack: false
    });
    setTargetRoles([]);
    setTargetingModes({});
    setSelectedGrades([]);
    setSelectedSections([]);
    setGradeAllSections({});
  };

  const getSeverityBadge = (priority) => {
    switch (priority) {
      case "CRITICAL":
        return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
      case "IMPORTANT":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"><AlertCircle className="w-3 h-3 mr-1" />Important</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100"><Info className="w-3 h-3 mr-1" />Normal</Badge>;
    }
  };

  // Filter Logic
  const filteredNotices = notices.filter(n => {
    const matchesSearch = searchQuery === "" ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === "ALL" || n.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  // Sort CRITICAL first
  const sortedNotices = [...filteredNotices].sort((a, b) => {
    if (a.priority === "CRITICAL" && b.priority !== "CRITICAL") return -1;
    if (b.priority === "CRITICAL" && a.priority !== "CRITICAL") return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="space-y-6 col-span-full min-h-[calc(100vh-10rem)] p-6" data-testid="notices-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-b-2 border-emerald-600 w-max pb-1">
          Notices
        </h1>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notices..."
              className="pl-9 bg-white border-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canCreateNotice && (
            <Button
              onClick={() => { resetForm(); setShowCreateNotice(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              data-testid="create-notice-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Notice
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {["ALL", "CRITICAL", "IMPORTANT", "NORMAL"].map(p => (
            <Badge
              key={p}
              variant={priorityFilter === p ? "default" : "outline"}
              className={`cursor-pointer px-4 py-1.5 ${priorityFilter === p ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              onClick={() => setPriorityFilter(p)}
            >
              {p === "ALL" ? "All Notices" : p.charAt(0) + p.slice(1).toLowerCase()}
            </Badge>
          ))}
        </div>

        {/* List */}
        <div className="grid gap-4">
          {loading ? (
            <Card className="border-dashed shadow-none bg-slate-50/50">
              <CardContent className="py-12 text-center text-slate-400">
                Loading notices...
              </CardContent>
            </Card>
          ) : sortedNotices.length === 0 ? (
            <Card className="border-dashed shadow-none bg-slate-50/50">
              <CardContent className="py-16 text-center flex flex-col items-center">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                  <Info className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No notices found</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm">
                  There are no notices matching your criteria.
                  {canCreateNotice && " Create a new notice to get started."}
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedNotices.map((notice) => (
              <Card
                key={notice.id}
                className={`group transition-all hover:shadow-md border-l-4 ${notice.priority === "CRITICAL" ? "border-l-red-500" :
                    notice.priority === "IMPORTANT" ? "border-l-amber-500" : "border-l-slate-300"
                  }`}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 mb-1">
                      {getSeverityBadge(notice.priority)}
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(notice.created_at).toLocaleDateString()}
                      </span>
                      {notice.scheduled_at && new Date(notice.scheduled_at) > new Date() && (
                        <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                          <Clock className="w-3 h-3 mr-1" /> Scheduled
                        </Badge>
                      )}
                      {notice.require_ack && (
                        <Badge variant="outline" className="text-xs border-purple-200 text-purple-700 bg-purple-50">
                          Ack Required
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {notice.title}
                    </h3>
                    <p className="text-slate-500 line-clamp-2 text-sm">
                      {notice.content}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedNotice(notice)} className="shrink-0 text-slate-400 hover:text-emerald-600">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* View Detail Sheet */}
      <Sheet open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <SheetContent className="sm:max-w-xl w-[90vw] overflow-y-auto">
          {selectedNotice && (
            <div className="space-y-6 mt-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getSeverityBadge(selectedNotice.priority)}
                  <span className="text-sm text-slate-500">
                    {new Date(selectedNotice.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedNotice.title}</h2>
              </div>

              <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedNotice.content}
              </div>

              {selectedNotice.require_ack && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-purple-900">Acknowledgment Required</p>
                      <p className="text-xs text-purple-700 mt-0.5">Please confirm you have read this notice.</p>
                    </div>
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleAcknowledge(selectedNotice.id)}>
                      Acknowledge
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs text-slate-500">
                <div>
                  <span className="font-semibold block text-slate-700">Author ID</span>
                  {selectedNotice.author_id}
                </div>
                {selectedNotice.expires_at && (
                  <div>
                    <span className="font-semibold block text-slate-700">Expires</span>
                    {new Date(selectedNotice.expires_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Notice Modal */}
      <Dialog open={showCreateNotice} onOpenChange={setShowCreateNotice}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Create New Notice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="notice-title">Title *</Label>
              <Input
                id="notice-title"
                value={newNotice.title}
                onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                placeholder="e.g., School Holiday Announcement"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="notice-content">Content *</Label>
              <textarea
                id="notice-content"
                value={newNotice.content}
                onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                placeholder="Notice details..."
                rows={5}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* Targeting Section */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-4">
              <Label className="font-bold text-base">Target Audience</Label>

              <div className="space-y-4">
                {[
                  { key: "student", label: "Students" },
                  { key: "parent", label: "Parents" },
                  { key: "teacher", label: "Teachers" },
                  { key: "accountant", label: "Accountants" },
                  { key: "school_admin", label: "Admins" },
                  { key: "guard", label: "Guards" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`role-${key}`}
                          checked={targetRoles.includes(key)}
                          onCheckedChange={(c) => {
                            if (c) {
                              setTargetRoles([...targetRoles, key]);
                              setTargetingModes({ ...targetingModes, [key]: 'ALL' });
                            } else {
                              setTargetRoles(targetRoles.filter(r => r !== key));
                            }
                          }}
                        />
                        <Label htmlFor={`role-${key}`} className="font-medium cursor-pointer">{label}</Label>
                      </div>

                      {/* Targeting Mode Toggle (Only show if checked) */}
                      {targetRoles.includes(key) && (
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                          <button
                            type="button"
                            onClick={() => setTargetingModes({ ...targetingModes, [key]: 'ALL' })}
                            className={`px-3 py-1 text-xs rounded-sm font-medium transition-colors ${targetingModes[key] === 'ALL' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => setTargetingModes({ ...targetingModes, [key]: 'SPECIFIC' })}
                            className={`px-3 py-1 text-xs rounded-sm font-medium transition-colors ${targetingModes[key] === 'SPECIFIC' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                            Specific
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Specific Drilldown (Students/Parents only for MVP) */}
                    {targetRoles.includes(key) && targetingModes[key] === 'SPECIFIC' && ["student", "parent"].includes(key) && (
                      <div className="ml-6 pl-4 border-l-2 border-slate-100 py-2 space-y-4">
                        <p className="text-xs text-slate-500">Select specific grades or sections to target.</p>

                        {/* Grades List */}
                        <div className="max-h-60 overflow-y-auto space-y-4 pr-2">
                          {structure.map(({ grade, sections }) => (
                            <div key={grade.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`grade-${grade.id}`}
                                  checked={selectedGrades.includes(grade.id)}
                                  onCheckedChange={(c) => {
                                    if (c) {
                                      setSelectedGrades([...selectedGrades, grade.id]);
                                      setGradeAllSections({ ...gradeAllSections, [grade.id]: true }); // Default to All sections on select
                                    } else {
                                      setSelectedGrades(selectedGrades.filter(id => id !== grade.id));
                                    }
                                  }}
                                />
                                <Label htmlFor={`grade-${grade.id}`} className="font-semibold text-sm cursor-pointer">{grade.name}</Label>
                              </div>

                              {/* Sections Drilldown */}
                              {selectedGrades.includes(grade.id) && (
                                <div className="ml-6 space-y-2 bg-slate-50/50 p-2 rounded border border-slate-100">
                                  {/* All Sections Toggle */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <Switch
                                      id={`toggle-${grade.id}`}
                                      checked={!!gradeAllSections[grade.id]}
                                      onCheckedChange={(c) => setGradeAllSections({ ...gradeAllSections, [grade.id]: c })}
                                      className="scale-75 origin-left"
                                    />
                                    <Label htmlFor={`toggle-${grade.id}`} className="text-xs text-slate-600">
                                      Target All Sections in {grade.name}
                                    </Label>
                                  </div>

                                  {/* Individual Sections (Only if All Sections is FALSE) */}
                                  {!gradeAllSections[grade.id] && (
                                    <div className="grid grid-cols-2 gap-2 pl-2">
                                      <div className="col-span-2 flex justify-between">
                                        <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={() => {
                                          const ids = sections.map(s => s.id);
                                          setSelectedSections([...new Set([...selectedSections, ...ids])]);
                                        }}>Select All</Button>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-red-500" onClick={() => {
                                          const ids = sections.map(s => s.id);
                                          setSelectedSections(selectedSections.filter(sid => !ids.includes(sid)));
                                        }}>Clear</Button>
                                      </div>
                                      {sections.map(sec => (
                                        <div key={sec.id} className="flex items-center gap-2">
                                          <Checkbox
                                            id={`sec-${sec.id}`}
                                            checked={selectedSections.includes(sec.id)}
                                            onCheckedChange={(c) => {
                                              if (c) setSelectedSections([...selectedSections, sec.id]);
                                              else setSelectedSections(selectedSections.filter(sid => sid !== sec.id));
                                            }}
                                          />
                                          <Label htmlFor={`sec-${sec.id}`} className="text-xs cursor-pointer">{sec.name}</Label>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Helper for other roles */}
                    {targetRoles.includes(key) && targetingModes[key] === 'SPECIFIC' && !["student", "parent"].includes(key) && (
                      <div className="ml-6 pl-4 border-l-2 border-slate-100 py-2">
                        <p className="text-xs text-amber-600">Individual targeting not yet available for this role. Notice will be sent to ALL members with this role.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Priority Selection */}
              <div>
                <Label>Priority</Label>
                <Select value={newNotice.priority} onValueChange={(val) => setNewNotice({ ...newNotice, priority: val })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="IMPORTANT">Important</SelectItem>
                    <SelectItem value="CRITICAL">Critical (Triggers Email)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scheduling & Options */}
              <div>
                <Label>Options</Label>
                <div className="flex items-center gap-2 mt-3 border rounded-md p-2 bg-slate-50">
                  <Checkbox
                    id="req-ack"
                    checked={newNotice.require_ack}
                    onCheckedChange={(c) => setNewNotice({ ...newNotice, require_ack: c })}
                  />
                  <Label htmlFor="req-ack" className="font-normal cursor-pointer text-sm">Require Acknowledgment</Label>
                </div>
              </div>
            </div>

            {/* Timings */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div>
                <Label className="text-xs text-slate-500 uppercase font-semibold">Schedule Post (Optional)</Label>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={newNotice.scheduled_at}
                  onChange={e => setNewNotice({ ...newNotice, scheduled_at: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Leave empty to post immediately</p>
              </div>
              <div>
                <Label className="text-xs text-slate-500 uppercase font-semibold">Expiry Date (Optional)</Label>
                <Input
                  type="datetime-local"
                  className="mt-1"
                  value={newNotice.expires_at}
                  onChange={e => setNewNotice({ ...newNotice, expires_at: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Leave empty to never expire</p>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateNotice(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNotice} className="bg-emerald-600 hover:bg-emerald-800 text-white" data-testid="confirm-create-notice">
              Create Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
