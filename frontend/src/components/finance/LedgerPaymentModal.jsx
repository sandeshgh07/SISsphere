import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, Loader2, Upload, AlertCircle } from "lucide-react";
import axios from "axios";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export function LedgerPaymentModal({
    open,
    onOpenChange,
    accessToken,
    mode = "CASH", // CASH | REMOTE
    students = [],
    onSuccess
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    // Form State
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [ledger, setLedger] = useState(null);
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [file, setFile] = useState(null);

    // Student Search State
    const [studentOpen, setStudentOpen] = useState(false);

    // Discount State
    const [discountOpen, setDiscountOpen] = useState(false);
    const [availableDiscounts, setAvailableDiscounts] = useState([]);
    const [selectedDiscountIds, setSelectedDiscountIds] = useState([]);

    useEffect(() => {
        if (open) {
            fetchDiscounts();
        }
    }, [open]);

    const fetchDiscounts = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/financials/discount-rules/?status=active`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (Array.isArray(res.data)) {
                // Filter out student-specific rules to avoid clutter, unless we want to allow picking them?
                // User requirement: "don't want to bloat... show discount rules" -> implies Master Rules.
                const masterRules = res.data.filter(r => r.scope_type !== "STUDENT_SPECIFIC");
                setAvailableDiscounts(masterRules);
            } else {
                setAvailableDiscounts([]);
            }
        } catch (error) {
            console.error("Failed to load discount rules", error);
            setAvailableDiscounts([]);
        }
    };

    const handleApplyDiscount = async () => {
        if (!selectedStudent) return;
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/api/fees/ledger/apply-discount`, {
                student_id: selectedStudent.id,
                period: period,
                rule_ids: selectedDiscountIds
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            toast({ title: "Success", description: "Discounts applied successfully" });
            setDiscountOpen(false);
            setSelectedDiscountIds([]);
            fetchLedger(); // Refresh breakdown
        } catch (error) {
            console.error("Apply discount error", error);
            toast({ title: "Error", description: "Failed to apply discounts", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Fetch Ledger when student/period changes
    useEffect(() => {
        if (selectedStudent && period && open) {
            fetchLedger();
        } else {
            setLedger(null);
            setAmount("");
        }
    }, [selectedStudent, period, open]);

    const fetchLedger = async () => {
        setLedgerLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/fees/ledger/`, {
                params: { student_id: selectedStudent.id, period },
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setLedger(res.data);

            // Sync checkbox state with assigned associations from backend
            if (res.data.assigned_discount_ids) {
                setSelectedDiscountIds(res.data.assigned_discount_ids);
            } else {
                setSelectedDiscountIds([]);
            }

            // Default amount to balance
            if (res.data.totals.balance > 0) {
                setAmount(res.data.totals.balance.toString());
            } else {
                setAmount("");
            }
        } catch (error) {
            console.error("Failed to load ledger", error);
            const msg = error.response?.data?.detail || "Failed to load fee details";
            toast({ title: "Ledger Error", description: msg, variant: "destructive" });
        } finally {
            setLedgerLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedStudent || !amount) {
            toast({ title: "Error", description: "Student and Amount are required", variant: "destructive" });
            return;
        }

        if (mode === "REMOTE" && !file) {
            toast({ title: "Error", description: "Receipt file is required for remote verification", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            // If invoice exists, link to it. Else, we might be paying a Fee directly? 
            // Ideally we link to Invoice. If invoice doesn't exist, we should probably generate it first?
            // The prompt says "When searching student inside either modal: load ledger... allow selecting invoice/lines...".
            // Backend record_payment requires invoice_id or fee_id.
            // If ledger says invoice_id is null, it means no invoice generated yet.
            // Requirement B says: "Ensure idempotency... Update draft...".
            // If we record payment, we probably want to attach it to an invoice.
            // But if invoice doesn't exist, we can't attach.
            // Simplest E2E: If no invoice, maybe we can't pay? Or we allow paying 'Fee' items directly?
            // Let's rely on invoice_id from ledger. If null, maybe warn user "Invoice not generated"?
            // Or just pass fee_id if we supported individual fee payment.
            // For this task, let's assume we link to invoice_id.

            if (ledger?.invoice_id) {
                formData.append("invoice_id", ledger.invoice_id);
            } else {
                // If no invoice, we might be blocked. Or we can auto-generate?
                // Auto-generation is implicit in some flows but record_payment is explicit on ID.
                // Let's warn for now if no invoice.
                toast({ title: "Error", description: "No invoice found for this period. Please generate invoice first.", variant: "destructive" });
                setLoading(false);
                return;
            }

            formData.append("amount", amount);
            formData.append("entry_source", mode === "CASH" ? "OFFICE_CASH" : "REMOTE");
            if (notes) formData.append("notes", notes);
            if (file) formData.append("file", file);

            await axios.post(`${API_BASE}/api/payments/record`, formData, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "multipart/form-data"
                }
            });

            toast({ title: "Success", description: mode === "CASH" ? "Payment Recorded" : "Payment Submitted for Verification" });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast({ title: "Error", description: error.response?.data?.detail || "Failed to record payment", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl bg-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{mode === "CASH" ? "Record Cash Payment" : "Verify Remote Payment"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* 1. Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Billing Period</Label>
                            <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Student</Label>
                            <Popover open={studentOpen} onOpenChange={setStudentOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={studentOpen} className="w-full justify-between">
                                        {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : "Select Student..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-0 bg-white">
                                    <Command>
                                        <CommandInput placeholder="Search student..." />
                                        <CommandList>
                                            <CommandEmpty>No student found.</CommandEmpty>
                                            <CommandGroup>
                                                {students.map((student) => (
                                                    <CommandItem
                                                        key={student.id}
                                                        value={`${student.first_name} ${student.last_name}`}
                                                        onSelect={() => {
                                                            setSelectedStudent(student);
                                                            setStudentOpen(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", selectedStudent?.id === student.id ? "opacity-100" : "opacity-0")} />
                                                        {student.first_name} {student.last_name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* 2. Ledger View */}
                    {ledgerLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-slate-400" /></div>
                    ) : ledger ? (
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            {!ledger.invoice_id && (
                                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 text-xs rounded mb-3 border border-amber-100">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>No invoice generated yet (Preview Mode)</span>
                                </div>
                            )}

                            <div className="space-y-1">
                                {ledger.breakdown_lines.map((line, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{line.description}</span>
                                        <div className="flex gap-4">
                                            {line.discount_amount > 0 && <span className="text-emerald-600 text-xs">- {line.discount_amount.toLocaleString()}</span>}
                                            <span className="font-medium">{line.amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="my-3 border-t border-slate-200" />
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span>{ledger.totals.base_total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-emerald-600">
                                    <span>Discount</span>
                                    <span>-{ledger.totals.discount_total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-slate-900 mt-2">
                                    <span>Net Due</span>
                                    <span>{ledger.totals.net_total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-emerald-700">
                                    <span>Paid</span>
                                    <span>{ledger.totals.paid_total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-red-600 mt-1 text-lg">
                                    <span>Balance</span>
                                    <span>{ledger.totals.balance.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Discount Application */}
                            <div className="mt-4 flex justify-end pt-3 border-t border-slate-200">
                                <Popover open={discountOpen} onOpenChange={setDiscountOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">
                                            + Apply Discount
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="end">
                                        <div className="p-3 border-b">
                                            <h4 className="font-semibold text-sm">Apply Discounts</h4>
                                            <p className="text-xs text-slate-500">Select rules to apply to this student</p>
                                        </div>
                                        <Command>
                                            <CommandInput placeholder="Search discount rules..." />
                                            <CommandList>
                                                <CommandEmpty>No rules found.</CommandEmpty>
                                                <CommandGroup className="max-h-[200px] overflow-y-auto">
                                                    {availableDiscounts.map((rule) => {
                                                        const isSelected = selectedDiscountIds.includes(rule.id);
                                                        return (
                                                            <CommandItem
                                                                key={rule.id}
                                                                value={rule.title}
                                                                onSelect={() => {
                                                                    setSelectedDiscountIds(prev =>
                                                                        isSelected ? prev.filter(id => id !== rule.id) : [...prev, rule.id]
                                                                    );
                                                                }}
                                                            >
                                                                <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"}`}>
                                                                    <Check className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span>{rule.title}</span>
                                                                    <span className="text-xs text-slate-500">
                                                                        {rule.discount_type === "PERCENT" ? `${rule.value}%` : `-${rule.value}`}
                                                                    </span>
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                        <div className="p-2 border-t flex justify-end">
                                            <Button
                                                size="sm"
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={handleApplyDiscount}
                                                disabled={loading}
                                            >
                                                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                                                Apply Selected
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-sm">Select a student to view fees</div>
                    )}

                    {/* 3. Payment Input */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Payment Amount (NPR)</Label>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="font-bold text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Notes / Reference</Label>
                                <Input
                                    placeholder="Check #, Transaction ID"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {mode === "REMOTE" && (
                            <div className="space-y-2">
                                <Label>Upload Receipt</Label>
                                <div className="border border-dashed border-slate-300 rounded-md p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
                                    <Input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={e => setFile(e.target.files?.[0])}
                                        accept="image/*,.pdf"
                                    />
                                    <div className="flex flex-col items-center gap-1">
                                        <Upload className="h-6 w-6 text-slate-400" />
                                        <span className="text-sm text-slate-600 font-medium">
                                            {file ? file.name : "Click to upload receipt"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !ledger}
                        className={mode === "CASH" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}
                    >
                        {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                        {mode === "CASH" ? "Record Payment" : "Submit Verification"}
                    </Button>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    );
}
