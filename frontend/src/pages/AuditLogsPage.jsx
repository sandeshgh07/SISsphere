
import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Filter,
    FileText,
    Clock,
    User,
    Database,
    Activity,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Eye,
    RefreshCw,
    Calendar as CalendarIcon
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"; // Use Dialog if Sheet fails, but Sheet preferred for drawer

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

const GROUPS = {
    ALL: "All",
    FINANCE: "Finance",
    ACADEMICS: "Academics",
    GRADING: "Grading",
    USERS: "Users & Access",
    SYSTEM: "System"
};

// Simple keyword mapping for frontend grouping
const GROUP_KEYWORDS = {
    [GROUPS.FINANCE]: ["fee", "payment", "invoice", "discount", "transaction"],
    [GROUPS.ACADEMICS]: ["term", "exam", "subject", "grade", "section", "academic"],
    [GROUPS.GRADING]: ["mark", "result", "score", "submission", "report"],
    [GROUPS.USERS]: ["user", "login", "auth", "permission", "role", "profile"],
    [GROUPS.SYSTEM]: ["system", "config", "setting", "audit"]
};

export default function AuditLogsPage() {
    const { accessToken } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [activeGroup, setActiveGroup] = useState(GROUPS.ALL);
    const [searchQuery, setSearchQuery] = useState("");
    const [actionFilter, setActionFilter] = useState("__all__");
    const [dateRange, setDateRange] = useState("24h"); // 24h, 7d, 30d, all

    // Drawer State
    const [selectedLog, setSelectedLog] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Pagination State
    const [cursor, setCursor] = useState(null);
    const [history, setHistory] = useState([]); // Stack of previous cursors [null, cursor1, cursor2...]
    const [nextCursor, setNextCursor] = useState(null);

    const loadLogs = useCallback(async (currentCursor = null) => {
        if (!accessToken) return;
        setLoading(true);
        try {
            // Build Query Params
            const params = new URLSearchParams();
            params.append("limit", "50");
            if (currentCursor) params.append("cursor", currentCursor);
            if (searchQuery) params.append("search", searchQuery);

            const res = await axios.get(`${API_BASE}/api/audit/logs?${params.toString()}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            // Handle both legacy list response and new paginated response
            const data = res.data;
            if (Array.isArray(data)) {
                // Should not happen after backend update, but fallback
                setLogs(data);
                setNextCursor(null);
            } else {
                setLogs(data.items || []);
                setNextCursor(data.next_cursor);
            }
        } catch (e) {
            console.error("Failed to load audit logs:", e);
        } finally {
            setLoading(false);
        }
    }, [accessToken, searchQuery]);

    // Reset pagination when filters change
    useEffect(() => {
        setCursor(null);
        setHistory([]);
        setNextCursor(null);
        loadLogs(null);
    }, [loadLogs]); // loadLogs depends on searchQuery

    const goNext = () => {
        if (!nextCursor) return;
        const newHistory = [...history, cursor];
        setHistory(newHistory);
        setCursor(nextCursor);
        loadLogs(nextCursor);
    };

    const goPrev = () => {
        if (history.length === 0) return;
        const newHistory = [...history];
        const prev = newHistory.pop(); // Pop current
        // The one before that is the cursor for the previous page.
        // Wait, stack is connections. 
        // Page 1: cursor=null. Stack=[]
        // Next -> Page 2: cursor=abc. Stack=[null]
        // Next -> Page 3: cursor=def. Stack=[null, abc]
        // Prev -> Page 2: cursor=abc. Stack=[null]

        setHistory(newHistory);
        setCursor(prev);
        loadLogs(prev);
    };

    // Derived State: Unique Actions (Limit to current page to avoid confusion)
    const uniqueActions = useMemo(() => {
        const actions = [...new Set(logs.map(l => l.action_type).filter(Boolean))];
        return actions.sort();
    }, [logs]);

    // Filtering Logic (Client side filter on top of server side page - suboptimal but keeps logic consistent)
    // Ideally backend does filtering, but for now we keep this to refrain from breaking too much logic
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // 1. Group Filter
            let matchesGroup = true;
            if (activeGroup !== GROUPS.ALL) {
                const keywords = GROUP_KEYWORDS[activeGroup];
                const text = `${log.entity || ''} ${log.action_type || ''} ${log.table_name || ''}`.toLowerCase();
                matchesGroup = keywords.some(k => text.includes(k));
            }

            // 2. Action Filter
            const matchesAction = actionFilter === "__all__" || log.action_type === actionFilter;

            return matchesGroup && matchesAction;
        });
    }, [logs, activeGroup, actionFilter]);

    const getActionIcon = (action) => {
        const a = action?.toUpperCase();
        if (a?.includes("DELETE")) return <XCircle className="w-4 h-4 text-rose-500" />;
        if (a?.includes("CREATE") || a?.includes("INSERT")) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        if (a?.includes("UPDATE")) return <RefreshCw className="w-4 h-4 text-blue-500" />;
        return <Activity className="w-4 h-4 text-slate-400" />;
    };

    const formatAction = (action) => {
        if (!action) return "Unknown";
        if (action === "INSERT") return "Create";
        if (action === "UPDATE") return "Update";
        if (action === "DELETE") return "Delete";
        return action.charAt(0).toUpperCase() + action.slice(1).toLowerCase().replace(/_/g, " ");
    };

    const openDetails = (log) => {
        setSelectedLog(log);
        setIsDrawerOpen(true);
    };

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto p-6" data-testid="audit-log-page">
            {/* ... keeping header ... */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="h-7 w-7 text-nepsis-primary" />
                        Audit Logs
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Track comprehensive system activity and security events.</p>
                </div>
                <Button onClick={() => loadLogs(cursor)} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
            </div>

            {/* Group Chips */}
            <div className="flex flex-wrap gap-2 pb-2">
                {Object.values(GROUPS).map(group => (
                    <button
                        key={group}
                        onClick={() => setActiveGroup(group)}
                        className={`
              px-4 py-1.5 rounded-full text-sm font-medium transition-all
              ${activeGroup === group
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}
            `}
                    >
                        {group}
                    </button>
                ))}
            </div>

            {/* Filters Bar */}
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search logs (Server-side)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-emerald-500"
                        />
                    </div>

                    <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-[160px] bg-slate-50/50 border-slate-200">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Filter className="w-3.5 h-3.5" />
                                    <SelectValue placeholder="Action" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All Actions</SelectItem>
                                {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden min-h-[500px] flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="py-3 px-4 w-[200px]">Timestamp</th>
                                <th className="py-3 px-4 w-[200px]">User</th>
                                <th className="py-3 px-4 w-[200px]">Action</th>
                                <th className="py-3 px-4">Entity / Details</th>
                                <th className="py-3 px-4 w-[100px] text-right">View</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                                            <span>Loading activity...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-slate-900 font-medium">No activity found</p>
                                                <p className="text-slate-500 text-sm">Try adjusting your filters or search query.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <User className="w-3 h-3" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900 font-medium text-xs">
                                                        {log.actor_name || "System"}
                                                    </span>
                                                    {log.actor_role && (
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{log.actor_role}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {getActionIcon(log.action_type)}
                                                <span className={`text-xs font-medium ${log.action_type?.includes("DELETE") ? "text-rose-700" :
                                                    log.action_type?.includes("CREATE") ? "text-emerald-700" :
                                                        "text-slate-700"
                                                    }`}>
                                                    {log.action_type || log.action}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200">
                                                        {log.table_name || log.entity || "Unknown"}
                                                    </span>
                                                    {log.record_id && (
                                                        <span className="text-slate-400 text-[10px] font-mono">#{log.record_id.toString().slice(0, 8)}</span>
                                                    )}
                                                </div>
                                                {log.reason && <span className="text-slate-500 text-xs italic line-clamp-1">{log.reason}</span>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openDetails(log)}
                                                className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between sticky bottom-0 z-10">
                    <div className="text-xs text-slate-400">
                        Showing {filteredLogs.length} events (Page {history.length + 1})
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={history.length === 0 || loading}
                            onClick={goPrev}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!nextCursor || loading}
                            onClick={goNext}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Details Drawer */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                {/* ... (Drawer Content Same) ... */}
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="flex items-center gap-2 text-xl">
                            <FileText className="w-5 h-5 text-emerald-600" />
                            Log Details
                        </SheetTitle>
                        <SheetDescription>
                            Full event payload and metadata.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedLog && (
                        <div className="space-y-6">
                            {/* Summary Card */}
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Timestamp</span>
                                        <span className="text-slate-900 font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Actor</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-900 font-medium">{selectedLog.actor_name || "System"}</span>
                                            <Badge variant="outline" className="text-[10px] h-5">{selectedLog.actor_role}</Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Action</span>
                                        <div className="flex items-center gap-2">
                                            {getActionIcon(selectedLog.action_type)}
                                            <span className="text-slate-900">{formatAction(selectedLog.action_type)}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Entity</span>
                                        <span className="font-mono text-xs bg-white px-1.5 py-0.5 border rounded">
                                            {selectedLog.table_name || selectedLog.entity} #{selectedLog.record_id || selectedLog.entity_id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Reason / Context */}
                            {selectedLog.reason && (
                                <div>
                                    <h4 className="text-sm font-medium text-slate-900 mb-2">Context / Reason</h4>
                                    <div className="bg-amber-50 text-amber-900 p-3 rounded-lg text-sm border border-amber-100">
                                        {selectedLog.reason}
                                    </div>
                                </div>
                            )}

                            {/* JSON Payload */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-slate-400" />
                                    Payload / Changes
                                </h4>
                                <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto font-mono text-xs border border-slate-800 shadow-inner">
                                    <pre>
                                        {JSON.stringify(
                                            // Try to parse values if they are strings resembling JSON, otherwise show raw
                                            {
                                                before: typeof selectedLog.before_state === 'string' ? tryParse(selectedLog.before_state) : selectedLog.before_state,
                                                after: typeof selectedLog.after_state === 'string' ? tryParse(selectedLog.after_state) : selectedLog.after_state,
                                                meta: typeof selectedLog.meta === 'string' ? tryParse(selectedLog.meta) : selectedLog.meta
                                            },
                                            null,
                                            2
                                        )}
                                    </pre>
                                </div>
                            </div>

                            {/* Metadata Footer */}
                            <div className="text-xs text-slate-400 pt-4 border-t border-slate-100">
                                <p>Log ID: <span className="font-mono">{selectedLog.id}</span></p>
                                <p>School ID: <span className="font-mono">{selectedLog.school_id || "N/A"}</span></p>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

// Helper
function tryParse(str) {
    try { return JSON.parse(str); } catch (e) { return str; }
}
