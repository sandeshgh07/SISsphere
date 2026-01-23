import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

function ReportsPage() {
  const { accessToken } = useAuth();
  const [feeSummary, setFeeSummary] = useState([]);
  const [pendingDues, setPendingDues] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});

  useEffect(() => {
    if (!accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };

    const load = async () => {
      try {
        const [feeRes, pendingRes, countRes] = await Promise.all([
          axios.get(`${API_BASE}/api/reports/fee-summary`, { headers }),
          axios.get(`${API_BASE}/api/reports/pending-dues`, { headers }),
          axios.get(`${API_BASE}/api/reports/student-counts`, { headers }),
        ]);
        setFeeSummary(feeRes.data.rows || []);
        setPendingDues(pendingRes.data.rows || []);
        setStudentCounts(countRes.data.counts || {});
      } catch (e) {
        // ignore for MVP
      }
    };

    load();
  }, [accessToken]);

  const downloadCsv = async (endpoint, filename, testId) => {
    try {
      const res = await axios.get(`${API_BASE}${endpoint}?format=csv`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="space-y-6 col-span-full" data-testid="reports-page">
      {/* Page Title */}
      <h1 className="text-2xl font-semibold text-slate-100" data-testid="reports-page-title">
        Reports
      </h1>
      
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-slate-100">Fee collection summary</CardTitle>
          <Button
            size="sm"
            className="rounded-full bg-blue-600 hover:bg-blue-500 text-white"
            onClick={() =>
              downloadCsv("/api/reports/fee-summary", "fee_summary.csv", "download-fee-summary")
            }
            data-testid="download-fee-summary"
          >
            Download CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm" data-testid="fee-summary-rows">
            {feeSummary.map((row) => (
              <div
                key={row.fee_id}
                className="flex items-center justify-between border-b border-slate-800 py-1"
                data-testid={`fee-summary-row-${row.fee_id}`}
              >
                <div className="text-slate-200">{row.title}</div>
                <div className="text-xs text-slate-400">
                  Collected: NPR {row.total_collected} ({row.payments_count} payments)
                </div>
              </div>
            ))}
            {feeSummary.length === 0 && (
              <div className="text-xs text-slate-500" data-testid="fee-summary-empty">
                No fee data yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-slate-100">Pending dues</CardTitle>
          <Button
            size="sm"
            className="rounded-full bg-red-600 hover:bg-red-500 text-white"
            onClick={() =>
              downloadCsv("/api/reports/pending-dues", "pending_dues.csv", "download-pending-dues")
            }
            data-testid="download-pending-dues"
          >
            Download CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm" data-testid="pending-dues-rows">
            {pendingDues.map((row, idx) => (
              <div
                key={`${row.student_id}-${row.fee_id}-${idx}`}
                className="flex items-center justify-between border-b border-slate-800 py-1"
                data-testid={`pending-due-row-${row.student_id}-${row.fee_id}`}
              >
                <div className="text-slate-200">
                  {row.student_name} - {row.fee_title}
                </div>
                <div className="text-xs text-red-400">Total: NPR {row.total_amount} (Paid: {row.amount_paid})</div>
              </div>
            ))}
            {pendingDues.length === 0 && (
              <div className="text-xs text-slate-500" data-testid="pending-dues-empty">
                No pending dues.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-slate-100">Student counts</CardTitle>
          <Button
            size="sm"
            className="rounded-full bg-green-600 hover:bg-green-500 text-white"
            onClick={() =>
              downloadCsv("/api/reports/student-counts", "student_counts.csv", "download-student-counts")
            }
            data-testid="download-student-counts"
          >
            Download CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm" data-testid="student-counts-rows">
            {Object.entries(studentCounts).map(([groupId, count]) => (
              <div
                key={groupId}
                className="flex items-center justify-between border-b border-slate-800 py-1"
                data-testid={`student-count-row-${groupId}`}
              >
                <div className="text-slate-200">{groupId}</div>
                <div className="text-xs text-slate-400">{count} students</div>
              </div>
            ))}
            {Object.keys(studentCounts).length === 0 && (
              <div className="text-xs text-slate-500" data-testid="student-counts-empty">
                No students yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportsPage;

