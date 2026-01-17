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

const API_BASE = import.meta.env.VITE_BACKEND_URL;

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
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("fees");

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState({ snapshot: null, velocity: [] });

  // Modals
  const [showCreateFee, setShowCreateFee] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showVerifyPayment, setShowVerifyPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showImportFees, setShowImportFees] = useState(false);

  // Form state for new fee
  const [newFee, setNewFee] = useState({
    title: "",
    amount: "",
    grade_id: "",
    due_date: "",
    description: "",
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
  const canManageFees = effectiveRole && ["principal", "school_admin", "accountant"].includes(effectiveRole);
  const canVerifyPayments = effectiveRole && ["principal", "school_admin", "accountant"].includes(effectiveRole);
  const canApplyDiscount = effectiveRole && ["principal", "accountant"].includes(effectiveRole);
  const canRecordPayment = effectiveRole && ["parent", "school_admin", "accountant", "principal"].includes(effectiveRole);
  const isParent = effectiveRole === "parent";
  const canViewAnalytics = effectiveRole && ["principal", "school_admin", "accountant", "super_admin"].includes(effectiveRole);

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
      const [feesRes, paymentsRes, studentsRes, gradesRes] = await Promise.all([
        axios.get(`${API_BASE}/api/fees`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/payments`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/students`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/grades`, { headers }).catch(() => ({ data: [] })),
      ]);
      setFees(feesRes.data || []);
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

  const handleCreateFee = async () => {
    if (!newFee.title || !newFee.amount || !newFee.due_date) {
      toast({ title: "Error", description: "Title, amount, and due date are required", variant: "destructive" });
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/api/fees`,
        {
          title: newFee.title,
          amount: parseFloat(newFee.amount),
          grade_id: newFee.grade_id || null,
          due_date: new Date(newFee.due_date).toISOString(),
          description: newFee.description || null,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      toast({ title: "Success", description: "Fee created successfully" });
      setShowCreateFee(false);
      setNewFee({ title: "", amount: "", grade_id: "", due_date: "", description: "" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.detail || "Failed to create fee", variant: "destructive" });
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
      case "verified":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "rejected":
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getStudentName = (studentId) => {
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
          <div className="h-8 w-40 bg-slate-700 rounded animate-pulse" />
        </div>
        <Card className="bg-slate-900 border-slate-700 animate-pulse">
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
        <h1 className="text-2xl font-semibold text-slate-100">Fees & Payments</h1>
        <div className="flex gap-2 flex-wrap">
          {canManageFees && (
            <>
              <Button onClick={handleExportFees} variant="outline" className="border-slate-600 text-slate-300">
                <Download className="w-4 h-4 mr-2" />
                Export Fees
              </Button>
              <Button onClick={handleExportPayments} variant="outline" className="border-slate-600 text-slate-300">
                <Download className="w-4 h-4 mr-2" />
                Export Payments
              </Button>
              <Button onClick={() => setShowImportFees(true)} variant="outline" className="border-slate-600 text-slate-300">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button onClick={() => setShowCreateFee(true)} className="bg-nepsis-primary hover:bg-nepsis-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Create Fee
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

      <Tabs defaultValue="fees" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
         <TabsList className="bg-slate-900 border-slate-700">
             <TabsTrigger value="fees">Fees & Transactions</TabsTrigger>
             {canViewAnalytics && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
         </TabsList>

         <TabsContent value="fees" className="space-y-6">
            {/* Role-based info */}
            {isParent && (
                <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-3 flex items-center gap-3">
                    <Users className="h-5 w-5 text-blue-400" />
                    <p className="text-sm text-slate-300">Showing fees and payments for your children.</p>
                </CardContent>
                </Card>
            )}

            {/* Fees List */}
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    Fee Structure
                </CardTitle>
                </CardHeader>
                <CardContent>
                {fees.length === 0 ? (
                    <div className="text-center py-8">
                    <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">No fees configured yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2 text-left">Title</th>
                            <th className="py-2 text-left">Amount (NPR)</th>
                            <th className="py-2 text-left">Grade</th>
                            <th className="py-2 text-left">Due Date</th>
                        </tr>
                        </thead>
                        <tbody>
                        {fees.map((fee) => (
                            <tr key={fee.id} className="border-b border-slate-800 text-slate-100">
                            <td className="py-2">{fee.title}</td>
                            <td className="py-2">{fee.amount?.toLocaleString()}</td>
                            <td className="py-2">{getGradeName(fee.grade_id)}</td>
                            <td className="py-2">{fee.due_date ? new Date(fee.due_date).toLocaleDateString() : "-"}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                )}
                </CardContent>
            </Card>

            {/* Payments List */}
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-400" />
                    Payments
                </CardTitle>
                </CardHeader>
                <CardContent>
                {payments.length === 0 ? (
                    <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">No payments recorded yet.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2 text-left">Student</th>
                            <th className="py-2 text-left">Fee</th>
                            <th className="py-2 text-left">Amount</th>
                            <th className="py-2 text-left">Status</th>
                            <th className="py-2 text-left">Verified By</th>
                            <th className="py-2 text-left">Verified At</th>
                            <th className="py-2 text-left">Discount</th>
                            {canVerifyPayments && <th className="py-2 text-left">Actions</th>}
                        </tr>
                        </thead>
                        <tbody>
                        {payments.map((payment) => (
                            <tr key={payment.id} className="border-b border-slate-800 text-slate-100">
                            <td className="py-2">{getStudentName(payment.student_id)}</td>
                            <td className="py-2">{getFeeName(payment.fee_id)}</td>
                            <td className="py-2">
                                <div>
                                <span>NPR {payment.amount?.toLocaleString()}</span>
                                {payment.original_amount && payment.original_amount !== payment.amount && (
                                    <span className="text-xs text-slate-500 line-through ml-2">
                                    {payment.original_amount?.toLocaleString()}
                                    </span>
                                )}
                                </div>
                            </td>
                            <td className="py-2">{getStatusBadge(payment.status)}</td>
                            <td className="py-2">
                                {payment.verified_by ? (
                                <div className="text-xs">
                                    <span className="text-slate-300">{ROLE_LABELS[payment.verified_by_role] || payment.verified_by_role}</span>
                                </div>
                                ) : (
                                <span className="text-slate-500">-</span>
                                )}
                            </td>
                            <td className="py-2">
                                {payment.verified_at ? (
                                <span className="text-xs text-slate-400">
                                    {new Date(payment.verified_at).toLocaleString()}
                                </span>
                                ) : (
                                <span className="text-slate-500">-</span>
                                )}
                            </td>
                            <td className="py-2">
                                {payment.discount_amount ? (
                                <div className="text-xs">
                                    {payment.discount_title && (
                                    <p className="text-emerald-300 font-medium">{payment.discount_title}</p>
                                    )}
                                    <span className="text-emerald-400">-NPR {payment.discount_amount?.toLocaleString()}</span>
                                    {payment.discount_reason && (
                                    <p className="text-slate-500 truncate max-w-24" title={payment.discount_reason}>
                                        {payment.discount_reason}
                                    </p>
                                    )}
                                </div>
                                ) : (
                                <span className="text-slate-500">-</span>
                                )}
                            </td>
                            {canVerifyPayments && (
                                <td className="py-2">
                                <div className="flex gap-1">
                                    {payment.status === "pending" && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-slate-600 text-slate-300 text-xs"
                                        onClick={() => {
                                        setSelectedPayment(payment);
                                        setShowVerifyPayment(true);
                                        }}
                                    >
                                        Verify
                                    </Button>
                                    )}
                                    {canApplyDiscount && payment.status !== "rejected" && !payment.discount_amount && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-emerald-400 text-xs"
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
                 <Card className="bg-slate-900 border-slate-700">
                     <CardHeader><CardTitle>3-Day Revenue Snapshot</CardTitle></CardHeader>
                     <CardContent>
                         {analyticsData.snapshot ? (
                             <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={snapshotData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="name" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                        <Bar dataKey="value" name="Revenue (NPR)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                                <div className="mt-4 text-center">
                                     <p className="text-slate-400">Change (Today vs Yesterday):
                                        <span className={analyticsData.snapshot.percent_change >= 0 ? "text-green-400 ml-2" : "text-red-400 ml-2"}>
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

                 <Card className="bg-slate-900 border-slate-700">
                     <CardHeader><CardTitle>Revenue Velocity (Trend)</CardTitle></CardHeader>
                     <CardContent>
                         {analyticsData.velocity.length > 0 ? (
                             <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={analyticsData.velocity}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="period" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                        <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
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

      {/* Create Fee Modal */}
      <Dialog open={showCreateFee} onOpenChange={setShowCreateFee}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Create New Fee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={newFee.title}
                onChange={(e) => setNewFee({ ...newFee, title: e.target.value })}
                placeholder="e.g., Tuition Fee Q1"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <Label>Amount (NPR) *</Label>
              <Input
                type="number"
                value={newFee.amount}
                onChange={(e) => setNewFee({ ...newFee, amount: e.target.value })}
                placeholder="5000"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <Label>Due Date *</Label>
              <Input
                type="date"
                value={newFee.due_date}
                onChange={(e) => setNewFee({ ...newFee, due_date: e.target.value })}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <Label>Grade (optional - leave empty for all grades)</Label>
              <Select value={newFee.grade_id || "__all__"} onValueChange={(val) => setNewFee({ ...newFee, grade_id: val === "__all__" ? "" : val })}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="__all__">All Grades</SelectItem>
                  {grades.filter(g => g.is_active).map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={newFee.description}
                onChange={(e) => setNewFee({ ...newFee, description: e.target.value })}
                placeholder="Additional details"
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFee(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleCreateFee} className="bg-nepsis-primary hover:bg-nepsis-primary/90">
              Create Fee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showRecordPayment} onOpenChange={(open) => { 
        setShowRecordPayment(open); 
        if (!open) { setStudentSearch(""); setFeeSearch(""); }
      }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
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
                    className="pl-9 bg-slate-950 border-slate-700 text-slate-100"
                  />
                </div>
                <Select value={paymentData.student_id} onValueChange={(val) => setPaymentData({ ...paymentData, student_id: val })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
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
                    className="pl-9 bg-slate-950 border-slate-700 text-slate-100"
                  />
                </div>
                <Select value={paymentData.fee_id} onValueChange={(val) => setPaymentData({ ...paymentData, fee_id: val })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select fee" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
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
                className="bg-slate-800 border-slate-600"
              />
            </div>

            {/* Entry Source Selection */}
            <div>
                <Label>Entry Source *</Label>
                <Select value={paymentData.entry_source} onValueChange={(val) => setPaymentData({ ...paymentData, entry_source: val })}>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                        <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
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
                        className="bg-slate-800 border-slate-600 cursor-pointer"
                    />
                </div>
            )}

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Reference #, etc."
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordPayment(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} className="bg-nepsis-primary hover:bg-nepsis-primary/90">
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Payment Modal */}
      <Dialog open={showVerifyPayment} onOpenChange={setShowVerifyPayment}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-800 rounded-lg text-sm">
                <p><span className="text-slate-400">Student:</span> {getStudentName(selectedPayment.student_id)}</p>
                <p><span className="text-slate-400">Fee:</span> {getFeeName(selectedPayment.fee_id)}</p>
                <p><span className="text-slate-400">Amount:</span> NPR {selectedPayment.amount?.toLocaleString()}</p>
                {selectedPayment.receipt_file_name && (
                  <p><span className="text-slate-400">Receipt:</span> {selectedPayment.receipt_file_name}</p>
                )}
              </div>
              <div>
                <Label>Action</Label>
                <Select value={verifyAction} onValueChange={setVerifyAction}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="verified">Verify (Approve)</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Verification notes..."
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyPayment(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleVerifyPayment}
              className={verifyAction === "verified" ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"}
            >
              {verifyAction === "verified" ? "Verify Payment" : "Reject Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Modal */}
      <Dialog open={showDiscount} onOpenChange={setShowDiscount}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-800 rounded-lg text-sm">
                <p><span className="text-slate-400">Student:</span> {getStudentName(selectedPayment.student_id)}</p>
                <p><span className="text-slate-400">Original Amount:</span> NPR {(selectedPayment.original_amount || selectedPayment.amount)?.toLocaleString()}</p>
              </div>
              <div>
                <Label>Discount Amount (NPR) *</Label>
                <Input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="500"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <Input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="e.g., Sibling discount, Scholarship"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              {discountAmount && (
                <div className="p-3 bg-emerald-900/30 rounded-lg text-sm border border-emerald-700">
                  <p className="text-emerald-400">
                    New Amount: NPR {Math.max(0, (selectedPayment.original_amount || selectedPayment.amount) - parseFloat(discountAmount || 0)).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscount(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleApplyDiscount} className="bg-emerald-600 hover:bg-emerald-500">
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
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-400" />
              Import Fees from CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 text-sm space-y-2">
              <p className="text-slate-300 font-medium">Required columns:</p>
              <code className="text-xs text-green-400 bg-slate-900 px-2 py-1 rounded">
                title, amount
              </code>
              <p className="text-slate-400">Optional: grade (e.g., &quot;Grade 1&quot;), due_date (YYYY-MM-DD), description</p>
              <p className="text-slate-400">Example: <code className="text-xs bg-slate-900 px-1 rounded">Tuition Q1,5000,Grade 1,2025-02-15</code></p>
            </div>

            <div>
              <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-500 transition-colors">
                <Upload className="h-8 w-8 text-slate-400" />
                <span className="text-sm text-slate-300">
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
                <p className="text-sm text-slate-300 font-medium">Preview (first 5 rows):</p>
                <div className="bg-slate-800 rounded-lg overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="py-2 px-3 text-left text-slate-400">Row</th>
                        <th className="py-2 px-3 text-left text-slate-400">Title</th>
                        <th className="py-2 px-3 text-left text-slate-400">Amount</th>
                        <th className="py-2 px-3 text-left text-slate-400">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeCsvPreview.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-700">
                          <td className="py-2 px-3 text-slate-500">{row._rowIndex}</td>
                          <td className="py-2 px-3 text-slate-100">{row.title}</td>
                          <td className="py-2 px-3 text-slate-100">{row.amount}</td>
                          <td className="py-2 px-3 text-slate-100">{row.grade || 'All'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {feeCsvErrors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-red-400 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Validation Errors ({feeCsvErrors.length})
                </p>
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {feeCsvErrors.slice(0, 10).map((err, idx) => (
                    <p key={idx} className="text-xs text-red-300">
                      {err.message || err}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {feeCsvFile && feeCsvErrors.length === 0 && feeCsvPreview.length > 0 && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>CSV validated successfully. Ready to import.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowImportFees(false); setFeeCsvFile(null); setFeeCsvPreview([]); setFeeCsvErrors([]); }}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFeesCsvImport}
              disabled={importingFees || !feeCsvFile || feeCsvErrors.length > 0}
              className="bg-green-600 hover:bg-green-500"
            >
              {importingFees ? "Importing..." : "Import Fees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
