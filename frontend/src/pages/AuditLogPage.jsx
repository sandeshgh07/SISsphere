import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function AuditLogPage() {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("__all__");

  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/api/audit-logs`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setLogs(res.data || []);
      } catch (e) {
        console.error("Failed to load audit logs:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accessToken]);

  // Get unique actions for filter dropdown
  const uniqueActions = useMemo(() => {
    const actions = [...new Set(logs.map(l => l.action).filter(Boolean))];
    return actions.sort();
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = !searchQuery.trim() || 
        log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.actor_role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entity_id?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesAction = actionFilter === "__all__" || log.action === actionFilter;
      
      return matchesSearch && matchesAction;
    });
  }, [logs, searchQuery, actionFilter]);

  return (
    <div className="space-y-6 col-span-full" data-testid="audit-log-page">
      <h1 className="text-2xl font-semibold text-slate-100">Audit Logs</h1>
      
      {/* Search & Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-600 text-slate-100"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px] bg-slate-800 border-slate-600">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            <SelectItem value="__all__">All Actions</SelectItem>
            {uniqueActions.map(action => (
              <SelectItem key={action} value={action}>{action}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">
            Audit Logs {filteredLogs.length !== logs.length && `(${filteredLogs.length} of ${logs.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-xs text-slate-400">Loading audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-xs text-slate-500">
              {logs.length === 0 ? "No audit entries yet." : "No logs match your search."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 text-left">Timestamp</th>
                    <th className="py-2 text-left">Action</th>
                    <th className="py-2 text-left">Entity</th>
                    <th className="py-2 text-left">Performed by</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-800 text-slate-100">
                      <td className="py-2">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}</td>
                      <td className="py-2">{log.action}</td>
                      <td className="py-2">{log.entity}{log.entity_id ? ` (${log.entity_id.slice(0,8)}...)` : ""}</td>
                      <td className="py-2">{log.actor_role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

