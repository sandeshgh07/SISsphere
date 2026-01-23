import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle, XCircle, Clock, Upload, DollarSign, Percent, Users, Search, FileSpreadsheet, AlertCircle, CheckCircle2, Download, TrendingUp, BarChart as BarChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

const ROLE_LABELS = {
  principal: "Principal",
  school_admin: "School Admin",
  accountant: "Accountant",
  parent: "Parent",
};

export default function FeesPage() {
  const { accessToken, user, getEffectiveRole, isHydrated } = useAuth();
  const { toast } = useToast();

  const [fees, setFees] = useState([]);
  const [feeTemplates, setFeeTemplates] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("templates"); // Default to templates for new system

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState({ snapshot: null, velocity: [] });

  // Modals
  const [showCreateFee, setShowCreateFee] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showVerifyPayment, setShowVerifyPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showImportFees, setShowImportFees] = useState(false);

  // Form state for new fee template
  const [newFee, setNewFee] = useState({
    title: "",
    amount: "",
    grade_id: "",
    billing_type: "RECURRING",
    recurrence: "MONTHLY",
    start_period: "",
    end_period: "",
    is_optional_addon: false,
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    student_id: "",
    fee_id: "",
    amount: "",
    entry_source: "REMOTE",
    notes: "",
    file: null
  });

  // Verify payment state
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [verifyAction, setVerifyAction] = useState("verified");
  const [verifyNotes, setVerifyNotes] = useState("");

  // Discount state
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // CSV Import state for fees
  const [feeCsvFile, setFeeCsvFile] = useState(null);
  const [feeCsvPreview, setFeeCsvPreview] = useState([]);
  const [feeCsvErrors, setFeeCsvErrors] = useState([]);
  const [importingFees, setImportingFees] = useState(false);

  // Search state for dropdowns
  const [studentSearch, setStudentSearch] = useState("");
  const [feeSearch, setFeeSearch] = useState("");

  const effectiveRole = getEffectiveRole();
  const canManageFees = effectiveRole && ["principal", "super_admin", "accountant"].includes(effectiveRole);
  const canVerifyPayments = effectiveRole && ["principal", "super_admin", "accountant"].includes(effectiveRole);
  const canApplyDiscount = effectiveRole && ["principal", "accountant"].includes(effectiveRole);
  const canRecordPayment = effectiveRole && ["parent", "super_admin", "accountant", "principal"].includes(effectiveRole);
  const isParent = effectiveRole === "parent";
  const isBoard = effectiveRole && ["superuser"].includes(effectiveRole); // Only SuperAdmin (Board) masked, Principal sees details
  const canViewAnalytics = effectiveRole && ["principal", "super_admin", "accountant", "superuser"].includes(effectiveRole);

  // Filtered students and fees based on search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const query = studentSearch.toLowerCase();
    return students.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(query) ||
      s.roll_no?.toLowerCase().includes(query)
    );
  }, [students, studentSearch]);

  const filteredFees = useMemo(() => {
    if (!feeSearch.trim()) return fees;
    const query = feeSearch.toLowerCase();
    return fees.filter(f => f.title?.toLowerCase().includes(query));
  }, [fees, feeSearch]);

  useEffect(() => {
    if (!isHydrated || !accessToken) return;
    loadData();
    if (canViewAnalytics) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, accessToken, canViewAnalytics]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [feesRes, templatesRes, discountsRes, invoicesRes, paymentsRes, studentsRes, gradesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/fees`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/fees/templates`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/fees/discounts`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/fees/invoices?status=ISSUED`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/payments`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/students`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/academics/grades`, { headers }).catch(() => ({ data: [] })),
      ]);
      setFees(feesRes.data || []);
      setFeeTemplates(templatesRes.data || []);
      setDiscounts(discountsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setPayments(paymentsRes.data || []);
      setStudents(studentsRes.data || []);
      setGrades(gradesRes.data || []);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [snapRes, velRes] = await Promise.all([
        axios.get(`${API_BASE}/api/analytics/finance/snapshot`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API_BASE}/api/analytics/finance/revenue-velocity`, { headers }).catch(() => ({ data: [] }))
      ]);
      setAnalyticsData({ snapshot: snapRes.data, velocity: velRes.data || [] });
    } catch (e) {
      console.error("Analytics error", e);
    }
  }

  // Fee CSV Import functions
  const parseFeeCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const rows = lines.slice(1).map((line, idx) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      row._rowIndex = idx + 2;
      return row;
    });

    return { headers, rows };
  };

  const validateFeeCsvRows = (rows) => {
    const errors = [];
    const gradeNameMap = {};
    grades.forEach(g => {
      gradeNameMap[g.name.toLowerCase()] = g.id;
      gradeNameMap[String(g.level || g.name).toLowerCase()] = g.id;
    });

    rows.forEach((row, idx) => {
      const rowNum = row._rowIndex || idx + 2;

      if (!row.title) {
        errors.push({ row: rowNum, message: 'Title is required' });
      }
      if (!row.amount || isNaN(parseFloat(row.amount))) {
        errors.push({ row: rowNum, message: 'Amount is required and must be a number' });
      }
      if (row.grade && !gradeNameMap[row.grade.toLowerCase()]) {
        errors.push({ row: rowNum, message: `Grade "${row.grade}" not found` });
      }
    });

    return errors;
  };

  const handleFeeCsvSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({ title: "Error", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      const { headers, rows } = parseFeeCSV(text);

      const requiredCols = ['title', 'amount'];
      const missingCols = requiredCols.filter(c => !headers.includes(c));
      if (missingCols.length > 0) {
        toast({
          title: "Error",
          description: `Missing required columns: ${missingCols.join(', ')}`,
          variant: "destructive"
        });
        return;
      }

      setFeeCsvFile(file);
      setFeeCsvPreview(rows.slice(0, 5));
      setFeeCsvErrors(validateFeeCsvRows(rows));
    };
    reader.readAsText(file);
  };

  const handleFeesCsvImport = async () => {
    if (!feeCsvFile) return;

    setImportingFees(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result;
        const { rows } = parseFeeCSV(text);

        const gradeNameMap = {};
        grades.forEach(g => {
          gradeNameMap[g.name.toLowerCase()] = g.id;
          gradeNameMap[String(g.level || g.name).toLowerCase()] = g.id;
        });

        let successCount = 0;
        let errorCount = 0;
        const importErrors = [];

        for (const row of rows) {
          try {
            const gradeId = row.grade ? gradeNameMap[row.grade.toLowerCase()] : null;
            if (row.grade && !gradeId) {
              importErrors.push(`Row ${row._rowIndex}: Grade "${row.grade}" not found`);
              errorCount++;
              continue;
            }

            await axios.post(
              `${API_BASE}/api/fees`,
              {
                title: row.title,
                amount: parseFloat(row.amount),
                grade_id: gradeId || null,
                due_date: row.due_date ? new Date(row.due_date).toISOString() : new Date().toISOString(),
                description: row.description || null,
              },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            successCount++;
          } catch (e) {
            importErrors.push(`Row ${row._rowIndex}: ${e.response?.data?.detail || 'Failed to import'}`);
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast({
            title: "Import Complete",
            description: `${successCount} fees imported${errorCount > 0 ? `, ${errorCount} failed` : ''}`
          });
          loadData();
        }

        if (importErrors.length > 0) {
          setFeeCsvErrors(importErrors.map((msg, i) => ({ row: i, message: msg })));
        } else {
          setShowImportFees(false);
          setFeeCsvFile(null);
          setFeeCsvPreview([]);
          setFeeCsvErrors([]);
        }

        setImportingFees(false);
      };
      reader.readAsText(feeCsvFile);
    } catch (e) {
      toast({ title: "Error", description: "Failed to import CSV", variant: "destructive" });
      setImportingFees(false);
    }
  };



  const handleGenerateInvoices = async () => {
    const period = window.prompt("Enter billing period (YYYY-MM):", new Date().toISOString().slice(0, 7));
    if (!period) return;

    // Simple validation
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast({ title: "Invalid Format", description: "Use YYYY-MM format", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/fees/invoices/generate`,
        { period },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({
        title: "Generation Complete",
        description: `Created: ${res.data.invoices_created}, Updated: ${res.data.invoices_updated}`
      });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Generation failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFee = async () => {
    if (!newFee.title || !newFee.amount) {
      toast({ title: "Error", description: "Title and amount are required", variant: "destructive" });
      return;
    }
    if (newFee.billing_type === "RECURRING" && !newFee.recurrence) {
      toast({ title: "Error", description: "Recurrence is required for recurring fees", variant: "destructive" });
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/api/fees/templates`,
        {
          title: newFee.title,
          amount: parseFloat(newFee.amount),
          grade_id: newFee.grade_id || null,
          billing_type: newFee.billing_type,
          recurrence: newFee.billing_type === "RECURRING" ? newFee.recurrence : null,
          start_period: newFee.start_period || null,
          end_period: newFee.end_period || null,
          is_optional_addon: newFee.is_optional_addon,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Fee template created successfully" });
      setShowCreateFee(false);
      setNewFee({ title: "", amount: "", grade_id: "", billing_type: "RECURRING", recurrence: "MONTHLY", start_period: "", end_period: "", is_optional_addon: false });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to create fee template", variant: "destructive" });
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentData.student_id || !paymentData.fee_id || !paymentData.amount) {
      toast({ title: "Error", description: "Student, fee, and amount are required", variant: "destructive" });
      return;
    }
    try {
      const formData = new FormData();
      formData.append("fee_id", paymentData.fee_id);
      formData.append("amount", paymentData.amount);
      formData.append("entry_source", paymentData.entry_source);
      if (paymentData.notes) formData.append("notes", paymentData.notes);

      if (paymentData.entry_source === "REMOTE" && !paymentData.file) {
        toast({ title: "Error", description: "Receipt file is required for Remote payments", variant: "destructive" });
        return;
      }

      if (paymentData.file) {
        formData.append("file", paymentData.file);
      }

      await axios.post(
        `${API_BASE}/api/payments/record`,
        formData,
        { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "multipart/form-data" } }
      );
      toast({ title: "Success", description: "Payment recorded successfully" });
      setShowRecordPayment(false);
      setPaymentData({ student_id: "", fee_id: "", amount: "", entry_source: "REMOTE", notes: "", file: null });
      loadData();
      if (canViewAnalytics) loadAnalytics();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to record payment", variant: "destructive" });
    }
  };

  const handleVerifyPayment = async () => {
    if (!selectedPayment) return;
    try {
      // Corrected endpoint
      await axios.post(
        `${API_BASE}/api/payments/${selectedPayment.id}/verify`,
        { status: verifyAction, notes: verifyNotes },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: `Payment ${verifyAction === "verified" ? "verified" : "rejected"}` });
      setShowVerifyPayment(false);
      setSelectedPayment(null);
      setVerifyNotes("");
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to verify payment", variant: "destructive" });
    }
  };

  const handleApplyDiscount = async () => {
    if (!selectedPayment || !discountAmount || !discountReason) {
      toast({ title: "Error", description: "Discount amount and reason are required", variant: "destructive" });
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/api/payments/${selectedPayment.id}/discount`,
        {
          discount_amount: parseFloat(discountAmount),
          reason: discountReason,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Discount applied successfully" });
      setShowDiscount(false);
      setSelectedPayment(null);
      setDiscountAmount("");
      setDiscountReason("");
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to apply discount", variant: "destructive" });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "SUCCEEDED":
      case "verified": // Fallback
      case "succeeded":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "REJECTED":
      case "rejected":
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "PENDING":
      case "pending":
      default:
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getStudentName = (studentId) => {
    // Privacy: Board members should not see specific student/parent names in financial lists
    if (isBoard) return "Student (Masked)";
    const student = students.find(s => s.id === studentId);
    return student ? `${student.first_name} ${student.last_name}` : studentId?.slice(0, 8) + "...";
  };

  const getFeeName = (feeId) => {
    const fee = fees.find(f => f.id === feeId);
    return fee ? fee.title : feeId?.slice(0, 8) + "...";
  };

  const getGradeName = (gradeId) => {
    if (!gradeId) return "All Grades";
    const grade = grades.find(g => g.id === gradeId);
    return grade?.name || "Unknown";
  };

  const handleExportFees = () => {
    if (fees.length === 0) {
      toast({ title: "No Data", description: "No fees to export", variant: "destructive" });
      return;
    }

    const headers = ["title", "amount", "grade", "due_date", "description"];
    const rows = fees.map(f => [
      f.title || "",
      f.amount || 0,
      getGradeName(f.grade_id),
      f.due_date ? new Date(f.due_date).toISOString().split("T")[0] : "",
      f.description || "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fees_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Success", description: `Exported ${fees.length} fees` });
  };

  const handleExportPayments = () => {
    if (payments.length === 0) {
      toast({ title: "No Data", description: "No payments to export", variant: "destructive" });
      return;
    }

    const headers = ["student", "fee", "amount", "status", "reference", "created_at"];
    const rows = payments.map(p => [
      getStudentName(p.student_id),
      getFeeName(p.fee_id),
      p.amount || 0,
      p.status || "pending",
      p.reference || "",
      p.created_at ? new Date(p.created_at).toISOString().split("T")[0] : "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payments_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Success", description: `Exported ${payments.length} payments` });
  };

  if (!isHydrated || loading) {
    return (
      <div className="col-span-full space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
        </div>
        <Card className="bg-white border-slate-200 shadow-sm animate-pulse">
          <CardContent className="py-20" />
        </Card>
      </div>
    );
  }

  // Snapshot Data Prep
  const snapshotData = analyticsData.snapshot ? [
    { name: 'Day-2', value: analyticsData.snapshot.day_minus_2, fill: '#0f766e' },
    { name: 'Yesterday', value: analyticsData.snapshot.yesterday, fill: '#0f766e' },
    { name: 'Today', value: analyticsData.snapshot.today, fill: '#003333' },
  ] : [];

  return (
    <div className="space-y-6 col-span-full" data-testid="fees-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Fees & Payments</h1>
        <div className="flex gap-2 flex-wrap">
          {canManageFees && (
            <>
              <Button onClick={handleExportFees} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                <Download className="w-4 h-4 mr-2" />
                Export Fees
              </Button>
              <Button onClick={handleExportPayments} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                <Download className="w-4 h-4 mr-2" />
                Export Payments
              </Button>
              <Button onClick={() => setShowImportFees(true)} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button onClick={() => setShowCreateFee(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </>
          )}
          {canRecordPayment && (
            <Button onClick={() => setShowRecordPayment(true)} variant="outline" className="border-slate-600 text-slate-300">
              <Upload className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="templates" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="templates" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Fee Templates</TabsTrigger>
          <TabsTrigger value="discounts" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Discounts</TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Invoices</TabsTrigger>
          <TabsTrigger value="fees" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Legacy Fees</TabsTrigger>
          {canViewAnalytics && <TabsTrigger value="analytics" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Analytics</TabsTrigger>}
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-slate-900">Fee Structure</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-10">Loading...</div> : (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-semibold">Title</th>
                        <th className="p-3 font-semibold">Amount</th>
                        <th className="p-3 font-semibold">Grade</th>
                        <th className="p-3 font-semibold">Billing</th>
                        <th className="p-3 font-semibold">Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {feeTemplates.length === 0 ? (
                        <tr><td colSpan="5" className="p-4 text-center text-slate-500">No fee templates found</td></tr>
                      ) : feeTemplates.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-900">{t.title}</td>
                          <td className="p-3 text-slate-700">NPR {t.amount}</td>
                          <td className="p-3 text-slate-700">{t.grade_id ? (grades.find(g => g.id === t.grade_id)?.name || "Unknown") : "All Grades"}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="border-slate-300 text-slate-700">
                              {t.billing_type === "RECURRING" ? t.recurrence : "One-time"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {t.is_active === "true" ? <Badge className="bg-green-600">Active</Badge> : <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-300">Inactive</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => toast({ description: "Coming soon!" })} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">Create Discount Rule</Button>
          </div>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-slate-900">Discount Rules</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-10">Loading...</div> : (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-semibold">Title</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold">Value</th>
                        <th className="p-3 font-semibold">Scope</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {discounts.length === 0 ? (
                        <tr><td colSpan="5" className="p-4 text-center text-slate-500">No discount rules found</td></tr>
                      ) : discounts.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-900">{d.title}</td>
                          <td className="p-3 text-slate-700">{d.discount_type}</td>
                          <td className="p-3 text-slate-700">{d.value ? `${d.value}` : "Full Waiver"}</td>
                          <td className="p-3 text-slate-700">{d.scope_type}</td>
                          <td className="p-3">
                            {d.is_active === "true" ? <Badge className="bg-green-600">Active</Badge> : <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-300">Inactive</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={handleGenerateInvoices} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">Run Generator</Button>
          </div>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-slate-900">Student Invoices</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-10">Loading...</div> : (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-semibold">Period</th>
                        <th className="p-3 font-semibold">Student</th>
                        <th className="p-3 font-semibold">Due</th>
                        <th className="p-3 font-semibold">Paid</th>
                        <th className="p-3 font-semibold">Balance</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.length === 0 ? (
                        <tr><td colSpan="6" className="p-4 text-center text-slate-500">No invoices found</td></tr>
                      ) : invoices.map(inv => {
                        const student = students.find(s => s.id === inv.student_id);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-900">{inv.period}</td>
                            <td className="p-3 text-slate-700">{student ? `${student.first_name} ${student.last_name}` : "Unknown"}</td>
                            <td className="p-3 text-slate-700">NPR {inv.total_due}</td>
                            <td className="p-3 text-slate-700">NPR {inv.paid_total}</td>
                            <td className="p-3 font-bold text-slate-900">NPR {inv.balance}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="border-slate-300 text-slate-700">{inv.status}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          {/* Role-based info */}
          {isParent && (
            <Card className="bg-sky-50 border-sky-100">
              <CardContent className="py-3 flex items-center gap-3">
                <Users className="h-5 w-5 text-sky-600" />
                <p className="text-sm text-sky-700">Showing fees and payments for your children.</p>
              </CardContent>
            </Card>
          )}

          {/* Fees List */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Fee Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fees.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No fees configured yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-semibold">Title</th>
                        <th className="p-3 font-semibold">Amount (NPR)</th>
                        <th className="p-3 font-semibold">Grade</th>
                        <th className="p-3 font-semibold">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fees.map((fee) => (
                        <tr key={fee.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-900">{fee.title}</td>
                          <td className="p-3 text-slate-700">{fee.amount?.toLocaleString()}</td>
                          <td className="p-3 text-slate-700">{getGradeName(fee.grade_id)}</td>
                          <td className="p-3 text-slate-700">{fee.due_date ? new Date(fee.due_date).toLocaleDateString() : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments List */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No payments recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-semibold">Student</th>
                        <th className="p-3 font-semibold">Fee</th>
                        <th className="p-3 font-semibold">Amount</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Verified By</th>
                        <th className="p-3 font-semibold">Verified At</th>
                        <th className="p-3 font-semibold">Discount</th>
                        {canVerifyPayments && <th className="p-3 font-semibold">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-900">{getStudentName(payment.student_id)}</td>
                          <td className="p-3 text-slate-700">{getFeeName(payment.fee_id)}</td>
                          <td className="p-3 text-slate-700">
                            <div>
                              <span>NPR {payment.amount?.toLocaleString()}</span>
                              {payment.original_amount && payment.original_amount !== payment.amount && (
                                <span className="text-xs text-slate-400 line-through ml-2">
                                  {payment.original_amount?.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">{getStatusBadge(payment.status)}</td>
                          <td className="p-3 text-slate-700">
                            {payment.verified_by ? (
                              <div className="text-xs">
                                <span className="text-slate-600">{ROLE_LABELS[payment.verified_by_role] || payment.verified_by_role}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-700">
                            {payment.verified_at ? (
                              <span className="text-xs text-slate-500">
                                {new Date(payment.verified_at).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {payment.discount_amount ? (
                              <div className="text-xs">
                                {payment.discount_title && (
                                  <p className="text-emerald-600 font-medium">{payment.discount_title}</p>
                                )}
                                <span className="text-emerald-600">-NPR {payment.discount_amount?.toLocaleString()}</span>
                                {payment.discount_reason && (
                                  <p className="text-slate-500 truncate max-w-24" title={payment.discount_reason}>
                                    {payment.discount_reason}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          {canVerifyPayments && (
                            <td className="p-3">
                              <div className="flex gap-1">
                                {(payment.status === "PENDING" || payment.status === "pending") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-300 text-slate-600 text-xs hover:bg-slate-50"
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                      setShowVerifyPayment(true);
                                    }}
                                  >
                                    Verify
                                  </Button>
                                )}
                                {canApplyDiscount && (payment.status !== "REJECTED" && payment.status !== "rejected") && !payment.discount_amount && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-600 text-xs hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                      setShowDiscount(true);
                                    }}
                                  >
                                    <Percent className="w-3 h-3 mr-1" />
                                    Discount
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="text-slate-900">3-Day Revenue Snapshot</CardTitle></CardHeader>
              <CardContent>
                {analyticsData.snapshot ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshotData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a' }} />
                        <Bar dataKey="value" name="Revenue (NPR)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 text-center">
                      <p className="text-slate-600">Change (Today vs Yesterday):
                        <span className={analyticsData.snapshot.percent_change >= 0 ? "text-emerald-600 ml-2" : "text-rose-600 ml-2"}>
                          {analyticsData.snapshot.percent_change}%
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="text-slate-900">Revenue Velocity (Trend)</CardTitle></CardHeader>
              <CardContent>
                {analyticsData.velocity.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.velocity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a' }} />
                        <Line type="monotone" dataKey="amount" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Fee Template Modal */}
      <Dialog open={showCreateFee} onOpenChange={setShowCreateFee}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-lg shadow-lg sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Create Fee Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fee Name *</Label>
              <Input
                value={newFee.title}
                onChange={(e) => setNewFee({ ...newFee, title: e.target.value })}
                placeholder="e.g., Monthly Tuition, Exam Fee, Bus Fee"
                className="bg-white border-slate-300 focus-visible:ring-slate-400"
              />
            </div>
            <div>
              <Label>Amount (NPR) *</Label>
              <Input
                type="number"
                value={newFee.amount}
                onChange={(e) => setNewFee({ ...newFee, amount: e.target.value })}
                placeholder="5000"
                className="bg-white border-slate-300 focus-visible:ring-slate-400"
              />
            </div>
            <div>
              <Label>Applies to Grade</Label>
              <Select value={newFee.grade_id || "__all__"} onValueChange={(val) => setNewFee({ ...newFee, grade_id: val === "__all__" ? "" : val })}>
                <SelectTrigger className="bg-white border-slate-300 focus:ring-slate-400">
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="__all__">All Grades</SelectItem>
                  {grades.filter(g => g.is_active).map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Leave as "All Grades" to apply to every student</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Billing Type *</Label>
                <Select value={newFee.billing_type} onValueChange={(val) => setNewFee({ ...newFee, billing_type: val })}>
                  <SelectTrigger className="bg-white border-slate-300 focus:ring-slate-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="RECURRING">Recurring</SelectItem>
                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newFee.billing_type === "RECURRING" && (
                <div>
                  <Label>Frequency *</Label>
                  <Select value={newFee.recurrence} onValueChange={(val) => setNewFee({ ...newFee, recurrence: val })}>
                    <SelectTrigger className="bg-white border-slate-300 focus:ring-slate-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Period (optional)</Label>
                <Input
                  type="month"
                  value={newFee.start_period}
                  onChange={(e) => setNewFee({ ...newFee, start_period: e.target.value })}
                  className="bg-white border-slate-300 focus-visible:ring-slate-400"
                />
              </div>
              <div>
                <Label>End Period (optional)</Label>
                <Input
                  type="month"
                  value={newFee.end_period}
                  onChange={(e) => setNewFee({ ...newFee, end_period: e.target.value })}
                  className="bg-white border-slate-300 focus-visible:ring-slate-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                id="is_optional_addon"
                checked={newFee.is_optional_addon}
                onChange={(e) => setNewFee({ ...newFee, is_optional_addon: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <Label htmlFor="is_optional_addon" className="cursor-pointer font-medium text-slate-700">Optional Add-on</Label>
                <p className="text-xs text-slate-500">Check for optional services like Bus, Hostel (students must be enrolled)</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFee(false)} className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={handleCreateFee} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showRecordPayment} onOpenChange={(open) => {
        setShowRecordPayment(open);
        if (!open) { setStudentSearch(""); setFeeSearch(""); }
      }}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 shadow-lg sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Student *</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-9 bg-white border-slate-300 text-slate-900 focus-visible:ring-slate-400"
                  />
                </div>
                <Select value={paymentData.student_id} onValueChange={(val) => setPaymentData({ ...paymentData, student_id: val })}>
                  <SelectTrigger className="bg-white border-slate-300 focus:ring-slate-400">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 max-h-60">
                    {filteredStudents.length === 0 ? (
                      <div className="py-2 px-3 text-sm text-slate-500">No students found</div>
                    ) : (
                      filteredStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.first_name} {student.last_name} ({getGradeName(student.grade_id)}{student.section_id ? ` - ${student.section_id}` : ''})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Fee *</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search fees..."
                    value={feeSearch}
                    onChange={(e) => setFeeSearch(e.target.value)}
                    className="pl-9 bg-white border-slate-300 text-slate-900 focus-visible:ring-slate-400"
                  />
                </div>
                <Select value={paymentData.fee_id} onValueChange={(val) => setPaymentData({ ...paymentData, fee_id: val })}>
                  <SelectTrigger className="bg-white border-slate-300 focus:ring-slate-400">
                    <SelectValue placeholder="Select fee" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 max-h-60">
                    {filteredFees.length === 0 ? (
                      <div className="py-2 px-3 text-sm text-slate-500">No fees found</div>
                    ) : (
                      filteredFees.map((fee) => (
                        <SelectItem key={fee.id} value={fee.id}>
                          {fee.title} - NPR {fee.amount?.toLocaleString()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Amount (NPR) *</Label>
              <Input
                type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                placeholder="5000"
                className="bg-white border-slate-300 focus-visible:ring-slate-400"
              />
            </div>

            {/* Entry Source Selection */}
            <div>
              <Label>Entry Source *</Label>
              <Select value={paymentData.entry_source} onValueChange={(val) => setPaymentData({ ...paymentData, entry_source: val })}>
                <SelectTrigger className="bg-white border-slate-300 focus:ring-slate-400">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="REMOTE">Remote (Bank Transfer/Receipt)</SelectItem>
                  <SelectItem value="OFFICE_CASH">Office Cash (In-Person)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload (Conditional) */}
            {(paymentData.entry_source === "REMOTE" || paymentData.entry_source === "OFFICE_CASH") && (
              <div>
                <Label>Receipt Attachment {paymentData.entry_source === "REMOTE" ? "*" : "(Optional)"}</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setPaymentData({ ...paymentData, file: e.target.files?.[0] || null })}
                  className="bg-white border-slate-300 cursor-pointer text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                />
              </div>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Reference #, etc."
                className="bg-white border-slate-300 focus-visible:ring-slate-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordPayment(false)} className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Payment Modal */}
      <Dialog open={showVerifyPayment} onOpenChange={setShowVerifyPayment}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 shadow-lg sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                <p><span className="text-slate-500 font-medium">Student:</span> <span className="text-slate-900">{getStudentName(selectedPayment.student_id)}</span></p>
                <p><span className="text-slate-500 font-medium">Fee:</span> <span className="text-slate-900">{getFeeName(selectedPayment.fee_id)}</span></p>
                <p><span className="text-slate-500 font-medium">Amount:</span> <span className="text-slate-900">NPR {selectedPayment.amount?.toLocaleString()}</span></p>
                {selectedPayment.receipt_file_name && (
                  <p><span className="text-slate-500 font-medium">Receipt:</span> <span className="text-blue-600 underline cursor-pointer">{selectedPayment.receipt_file_name}</span></p>
                )}
              </div>
              <div>
                <Label>Action</Label>
                <Select value={verifyAction} onValueChange={setVerifyAction}>
                  <SelectTrigger className="bg-white border-slate-300 focus:ring-slate-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200">
                    <SelectItem value="verified">Verify (Approve)</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Justification / Notes * (Min 10 chars)</Label>
                <textarea
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Explain your decision..."
                  className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                />
                <p className="text-xs text-slate-500 mt-1">{verifyNotes.length}/10</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyPayment(false)} className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </Button>
            <Button
              onClick={handleVerifyPayment}
              disabled={verifyNotes.length < 10}
              className={verifyAction === "verified" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" : "bg-red-600 hover:bg-red-700 text-white shadow-sm"}
            >
              {verifyAction === "verified" ? "Verify Payment" : "Reject Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Modal */}
      <Dialog open={showDiscount} onOpenChange={setShowDiscount}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 shadow-lg sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                <p><span className="text-slate-500 font-medium">Student:</span> <span className="text-slate-900">{getStudentName(selectedPayment.student_id)}</span></p>
                <p><span className="text-slate-500 font-medium">Original Amount:</span> <span className="text-slate-900">NPR {(selectedPayment.original_amount || selectedPayment.amount)?.toLocaleString()}</span></p>
              </div>
              <div>
                <Label>Discount Amount (NPR) *</Label>
                <Input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="500"
                  className="bg-white border-slate-300 focus-visible:ring-slate-400"
                />
              </div>
              <div>
                <Label>Reason * (Min 10 chars)</Label>
                <textarea
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Explain this discount..."
                  className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                />
                <p className="text-xs text-slate-500 mt-1">{discountReason.length}/10</p>
              </div>
              {discountAmount && (
                <div className="p-3 bg-emerald-50 rounded-lg text-sm border border-emerald-200">
                  <p className="text-emerald-700 font-medium">
                    New Amount: NPR {Math.max(0, (selectedPayment.original_amount || selectedPayment.amount) - parseFloat(discountAmount || 0)).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscount(false)} className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </Button>
            <Button
              onClick={handleApplyDiscount}
              disabled={discountReason.length < 10}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              Apply Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Fees CSV Modal */}
      <Dialog open={showImportFees} onOpenChange={(open) => {
        setShowImportFees(open);
        if (!open) { setFeeCsvFile(null); setFeeCsvPreview([]); setFeeCsvErrors([]); }
      }}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-2xl shadow-lg sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Import Fees from CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-2">
              <p className="text-slate-900 font-medium">Required columns:</p>
              <code className="text-xs text-emerald-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                title, amount
              </code>
              <p className="text-slate-600">Optional: grade (e.g., &quot;Grade 1&quot;), due_date (YYYY-MM-DD), description</p>
              <p className="text-slate-600">Example: <code className="text-xs bg-slate-100 px-1 rounded border border-slate-200">Tuition Q1,5000,Grade 1,2025-02-15</code></p>
            </div>

            <div>
              <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-500 hover:bg-slate-50 transition-colors">
                <Upload className="h-8 w-8 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {feeCsvFile ? feeCsvFile.name : "Click to upload CSV file"}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFeeCsvSelect}
                  className="hidden"
                />
              </label>
            </div>

            {feeCsvPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-slate-900 font-medium">Preview (first 5 rows):</p>
                <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="py-2 px-3 text-slate-700">Row</th>
                        <th className="py-2 px-3 text-slate-700">Title</th>
                        <th className="py-2 px-3 text-slate-700">Amount</th>
                        <th className="py-2 px-3 text-slate-700">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeCsvPreview.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-2 px-3 text-slate-500">{row._rowIndex}</td>
                          <td className="py-2 px-3 text-slate-900">{row.title}</td>
                          <td className="py-2 px-3 text-slate-900">{row.amount}</td>
                          <td className="py-2 px-3 text-slate-900">{row.grade || 'All'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {feeCsvErrors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-rose-600 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Validation Errors ({feeCsvErrors.length})
                </p>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {feeCsvErrors.slice(0, 10).map((err, idx) => (
                    <p key={idx} className="text-xs text-rose-700">
                      {err.message || err}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {feeCsvFile && feeCsvErrors.length === 0 && feeCsvPreview.length > 0 && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>CSV validated successfully. Ready to import.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowImportFees(false); setFeeCsvFile(null); setFeeCsvPreview([]); setFeeCsvErrors([]); }}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFeesCsvImport}
              disabled={importingFees || !feeCsvFile || feeCsvErrors.length > 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {importingFees ? "Importing..." : "Import Fees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
