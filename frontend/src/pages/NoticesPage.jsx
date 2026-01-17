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
import { Plus, AlertTriangle, AlertCircle, Info } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

export default function NoticesPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  
  // Form state
  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    severity: "normal",
    audience: {
      students: true,
      parents: true,
      teachers: true,
      accountants: true,
      admins: true,
    },
  });

  const canCreateNotice = user?.role && ["principal", "school_admin"].includes(user.role);

  // Determine what notices the user can see based on role
  const canSeeNotice = (notice) => {
    if (!notice.audience) return true; // Default: all can see
    
    const roleAudienceMap = {
      principal: true, // Principals can see all
      school_admin: notice.audience.admins,
      teacher: notice.audience.teachers,
      accountant: notice.audience.accountants,
      parent: notice.audience.parents,
      student: notice.audience.students,
    };
    
    return roleAudienceMap[user?.role] ?? true;
  };

  useEffect(() => {
    if (!accessToken) return;
    loadNotices();
  }, [accessToken]);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/notices`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setNotices(res.data || []);
    } catch (e) {
      console.error("Error loading notices:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotice = async () => {
    if (!newNotice.title || !newNotice.content) {
      toast({ title: "Error", description: "Title and content are required", variant: "destructive" });
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/api/notices`,
        {
          title: newNotice.title,
          content: newNotice.content,
          severity: newNotice.severity,
          audience: newNotice.audience,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Notice created successfully" });
      setShowCreateNotice(false);
      setNewNotice({
        title: "",
        content: "",
        severity: "normal",
        audience: { students: true, parents: true, teachers: true, accountants: true, admins: true },
      });
      loadNotices();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to create notice", variant: "destructive" });
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-600"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
      case "important":
        return <Badge className="bg-yellow-600"><AlertCircle className="w-3 h-3 mr-1" />Important</Badge>;
      default:
        return <Badge className="bg-blue-600"><Info className="w-3 h-3 mr-1" />Normal</Badge>;
    }
  };

  const getAudienceDisplay = (audience) => {
    if (!audience) return "All";
    const audiences = [];
    if (audience.students) audiences.push("Students");
    if (audience.parents) audiences.push("Parents");
    if (audience.teachers) audiences.push("Teachers");
    if (audience.accountants) audiences.push("Accountants");
    if (audience.admins) audiences.push("Admins");
    return audiences.length === 5 ? "All" : audiences.join(", ") || "None";
  };

  // Filter notices based on user role visibility
  const visibleNotices = notices.filter(canSeeNotice);

  return (
    <div className="space-y-6 col-span-full" data-testid="notices-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100" data-testid="notices-page-title">
          Notices
        </h1>
        {canCreateNotice && (
          <Button
            onClick={() => setShowCreateNotice(true)}
            className="bg-blue-600 hover:bg-blue-500"
            data-testid="create-notice-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Notice
          </Button>
        )}
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="py-8 text-center">
              <p className="text-slate-400 text-sm">Loading notices...</p>
            </CardContent>
          </Card>
        ) : visibleNotices.length === 0 ? (
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="py-8 text-center" data-testid="no-notices">
              <p className="text-slate-500 text-sm">No notices available.</p>
            </CardContent>
          </Card>
        ) : (
          visibleNotices.map((notice) => (
            <Card
              key={notice.id}
              className={`bg-slate-900 border-slate-700 ${
                notice.severity === "critical" ? "border-l-4 border-l-red-500" :
                notice.severity === "important" ? "border-l-4 border-l-yellow-500" : ""
              }`}
              data-testid={`notice-card-${notice.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-100 text-lg">{notice.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(notice.severity)}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                  <span>Audience: {getAudienceDisplay(notice.audience)}</span>
                  <span>
                    Posted: {notice.created_at ? new Date(notice.created_at).toLocaleDateString() : "-"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{notice.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Notice Modal */}
      <Dialog open={showCreateNotice} onOpenChange={setShowCreateNotice}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Notice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notice-title">Title *</Label>
              <Input
                id="notice-title"
                value={newNotice.title}
                onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                placeholder="e.g., School Holiday Announcement"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <Label htmlFor="notice-content">Content *</Label>
              <textarea
                id="notice-content"
                value={newNotice.content}
                onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                placeholder="Notice details..."
                rows={4}
                className="w-full rounded-md bg-slate-800 border-slate-600 border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={newNotice.severity} onValueChange={(val) => setNewNotice({ ...newNotice, severity: val })}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Important</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block mb-2">Audience</Label>
              <div className="space-y-2">
                {[
                  { key: "students", label: "Students" },
                  { key: "parents", label: "Parents" },
                  { key: "teachers", label: "Teachers" },
                  { key: "accountants", label: "Accountants" },
                  { key: "admins", label: "School Admins" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`audience-${key}`}
                      checked={newNotice.audience[key]}
                      onCheckedChange={(checked) =>
                        setNewNotice({
                          ...newNotice,
                          audience: { ...newNotice.audience, [key]: checked },
                        })
                      }
                    />
                    <Label htmlFor={`audience-${key}`} className="text-sm font-normal">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateNotice(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleCreateNotice} className="bg-blue-600 hover:bg-blue-500" data-testid="confirm-create-notice">
              Create Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

