import { useState, useEffect } from "react";
import axios from "axios";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, CreditCard, Ban, Send, FileText, CheckCircle2, Link as LinkIcon, Printer, History } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function InvoiceDrawer({ invoiceId, open, onOpenChange, accessToken, onInvoiceUpdated }) {
    const { toast } = useToast();
    const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(false);

    // Action States
    const [actionLoading, setActionLoading] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showVoidModal, setShowVoidModal] = useState(false);

    // Payment Form
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        method: "CASH",
        reference: "",
        notes: ""
    });

    // Void Form
    const [voidReason, setVoidReason] = useState("");

    // Timeline State
    const [timeline, setTimeline] = useState([]);

    const fetchTimeline = async () => {
        if (!invoiceId) return;
        try {
            const res = await axios.get(`${API_BASE}/api/fees/invoices/${invoiceId}/timeline`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setTimeline(res.data);
        } catch (error) {
            console.error("Failed to load timeline", error);
        }
    };

    const fetchInvoice = async () => {
        if (!invoiceId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/fees/invoices/${invoiceId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setInvoice(res.data);
            // Default payment amount to balance
            setPaymentForm(prev => ({ ...prev, amount: res.data.balance }));
            fetchTimeline(); // Load timeline
        } catch (error) {
            console.error("Failed to load invoice", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && invoiceId) {
            fetchInvoice();
        }
    }, [open, invoiceId]);

    const handleIssue = async () => {
        setActionLoading(true);
        try {
            await axios.post(`${API_BASE}/api/fees/invoices/${invoiceId}/issue`, {}, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Invoice Issued", description: "Status updated to ISSUED" });
            fetchInvoice();
            onInvoiceUpdated();
        } catch (error) {
            toast({ title: "Error", description: error.response?.data?.detail, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoid = async () => {
        if (!voidReason) return;
        setActionLoading(true);
        try {
            await axios.post(`${API_BASE}/api/fees/invoices/${invoiceId}/void`, { reason: voidReason }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Invoice Voided", description: "Status updated to VOID" });
            fetchInvoice();
            onInvoiceUpdated();
            setShowVoidModal(false);
        } catch (error) {
            toast({ title: "Error", description: error.response?.data?.detail, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const handlePayment = async () => {
        if (!paymentForm.amount) return;
        setActionLoading(true);
        try {
            await axios.post(`${API_BASE}/api/fees/invoices/${invoiceId}/payments`, {
                amount: parseFloat(paymentForm.amount),
                method: paymentForm.method,
                reference: paymentForm.reference,
                notes: paymentForm.notes
            }, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            toast({ title: "Payment Recorded", description: "Balance updated" });
            fetchInvoice();
            onInvoiceUpdated();
            setShowPaymentModal(false);
        } catch (error) {
            toast({ title: "Error", description: error.response?.data?.detail, variant: "destructive" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/fees/invoices/${invoiceId}/pdf`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice-${invoiceId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast({ title: "Download Failed", variant: "destructive" });
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
            ISSUED: "bg-blue-50 text-blue-700 border-blue-200",
            PARTIAL: "bg-amber-50 text-amber-700 border-amber-200",
            PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
            VOID: "bg-red-50 text-red-700 border-red-200",
        };
        return <Badge variant="outline" className={`${styles[status] || styles.DRAFT} font-semibold`}>{status}</Badge>;
    };

    if (!invoice && !loading) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:w-[600px] lg:w-[700px] overflow-y-auto bg-slate-50 p-0 shadow-2xl">
                {/* Fixed Header */}
                <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-bold text-lg">
                            In
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Invoice Details</h2>
                            <p className="text-xs text-slate-500">#{invoiceId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {invoice && <StatusBadge status={invoice.status} />}
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                            <span className="sr-only">Close</span>
                            <span className="text-slate-400 text-xl">×</span>
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-400 h-8 w-8" /></div>
                ) : invoice && (
                    <div className="pb-24">
                        {/* A) Header Section inside Scroll */}
                        <div className="bg-white px-6 pt-6 pb-6 mb-2 border-b">
                            <div className="flex justify-between items-start mb-6">
                                {/* School Info */}
                                <div className="flex gap-4">
                                    <Avatar className="h-16 w-16 rounded-lg border">
                                        <AvatarImage src={invoice.billing_entity?.logo_url} />
                                        <AvatarFallback className="rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xl">
                                            {invoice.billing_entity?.name?.substring(0, 2).toUpperCase() || "SC"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h1 className="font-bold text-xl text-slate-900">{invoice.billing_entity?.name || "School Name"}</h1>
                                        <div className="text-sm text-slate-500 mt-1 max-w-[250px]">
                                            {invoice.billing_entity?.address || "Address unavailable"}
                                            {invoice.billing_entity?.phone && <div>{invoice.billing_entity.phone}</div>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-slate-200 tracking-tighter">INVOICE</div>
                                    <div className="text-slate-500 text-sm font-medium mt-1">NO. {invoice.id.split('-')[0].toUpperCase()}</div>
                                </div>
                            </div>

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
                                <div>
                                    <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wide">Billing Period</div>
                                    <div className="text-sm font-semibold text-slate-700">{invoice.period}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wide">Issue Date</div>
                                    <div className="text-sm font-semibold text-slate-700">{invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : "-"}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wide">Due Date</div>
                                    <div className="text-sm font-semibold text-slate-700">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wide">Created By</div>
                                    <div className="text-sm font-semibold text-slate-700">System</div>
                                </div>
                            </div>
                        </div>

                        {/* B) Bill To / Student Info */}
                        <div className="grid grid-cols-2 gap-4 px-6 mb-6">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center"><LinkIcon className="w-3 h-3 mr-1" /> Bill To</div>
                                <div className="font-semibold text-slate-800">{invoice.bill_to?.name || "Parent/Guardian"}</div>
                                <div className="text-sm text-slate-500">{invoice.bill_to?.email}</div>
                                <div className="text-sm text-slate-500">{invoice.bill_to?.phone}</div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Student</div>
                                <div className="font-semibold text-slate-800">{invoice.student_name}</div>
                                <div className="text-sm text-slate-500">{invoice.grade_name}</div>
                                <div className="text-xs bg-slate-100 text-slate-600 inline-block px-1.5 py-0.5 rounded mt-2">ID: {invoice.student_id?.split('-')[0]}</div>
                            </div>
                        </div>

                        {/* C) Amount Summary */}
                        <div className="px-6 mb-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 rounded-xl overflow-hidden border border-slate-200 bg-white divide-x divide-slate-100 shadow-sm">
                                <div className="p-4">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Due</div>
                                    <div className="text-xl font-bold text-slate-900">{invoice.total_due.toLocaleString()}</div>
                                    <div className="text-[10px] text-slate-400">NPR</div>
                                </div>
                                <div className="p-4 bg-emerald-50/30">
                                    <div className="text-xs text-emerald-600 uppercase font-bold mb-1">Paid</div>
                                    <div className="text-xl font-bold text-emerald-700">{invoice.paid_total.toLocaleString()}</div>
                                    <div className="text-[10px] text-emerald-400">NPR</div>
                                </div>
                                <div className="p-4 bg-red-50/10">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Balance</div>
                                    <div className="text-xl font-bold text-red-600">{invoice.balance.toLocaleString()}</div>
                                    <div className="text-[10px] text-red-400">Due Now</div>
                                </div>
                                <div className="p-4 bg-slate-50">
                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Due In</div>
                                    <div className="text-sm font-semibold text-slate-700 mt-1">
                                        {invoice.status === 'PAID' ? "Paid" :
                                            invoice.due_date ?
                                                Math.ceil((new Date(invoice.due_date) - new Date()) / (1000 * 60 * 60 * 24)) + " Days" : "N/A"
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* D) Line Items Table */}
                        <div className="px-6 mb-6">
                            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 border-b">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Description</th>
                                            <th className="px-4 py-3 font-medium text-right w-20">Qty</th>
                                            <th className="px-4 py-3 font-medium text-right w-24">Price</th>
                                            <th className="px-4 py-3 font-medium text-right w-24">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {invoice.lines?.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                                    No line items added.
                                                </td>
                                            </tr>
                                        )}
                                        {invoice.lines?.map(line => (
                                            <tr key={line.id}>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-900">{line.description}</div>
                                                    {line.discount_amount > 0 && (
                                                        <div className="text-xs text-emerald-600 mt-0.5">
                                                            Discount applied: -{line.discount_amount.toLocaleString()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">{line.qty || 1}</td>
                                                <td className="px-4 py-3 text-right text-slate-600">{line.unit_price?.toLocaleString() || line.base_amount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-900">{line.base_amount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50/50 border-t">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right text-slate-500 text-xs uppercase font-semibold">Subtotal</td>
                                            <td className="px-4 py-2 text-right font-medium text-slate-700">{invoice.subtotal.toLocaleString()}</td>
                                        </tr>
                                        {invoice.discount_total > 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-1 text-right text-emerald-600 text-xs uppercase font-semibold">Discount</td>
                                                <td className="px-4 py-1 text-right font-medium text-emerald-600">-{invoice.discount_total.toLocaleString()}</td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right text-slate-900 text-sm font-bold">TOTAL</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 border-t border-slate-200">{invoice.total_due.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* E) Payments & Audit Tabs */}
                        <div className="px-6 mb-6">
                            <Tabs defaultValue="payments" className="w-full">
                                <TabsList className="w-full justify-start bg-transparent border-b h-auto p-0 rounded-none mb-4">
                                    <TabsTrigger value="payments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent pb-2 px-1 mr-4">
                                        Payments ({invoice.payments?.length || 0})
                                    </TabsTrigger>
                                    <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:bg-transparent pb-2 px-1">
                                        Activity Timeline
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="payments" className="space-y-4">
                                    {invoice.payments?.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-lg border border-dashed">No payments recorded yet.</div>
                                    ) : (
                                        <div className="border rounded-md divide-y bg-white">
                                            {invoice.payments?.map(p => (
                                                <div key={p.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900">NPR {p.amount.toLocaleString()}</div>
                                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                                {new Date(p.created_at || p.paid_at).toLocaleDateString()} • {p.entry_source}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] bg-white border-slate-200">
                                                        {p.reference || "No Ref"}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>
                                <TabsContent value="audit">
                                    <div className="space-y-4">
                                        {timeline.length === 0 ? (
                                            <div className="text-center py-6 text-slate-400 text-sm">
                                                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                No activity recorded yet.
                                            </div>
                                        ) : (
                                            <div className="relative pl-4 border-l-2 border-slate-200 ml-2 space-y-6 py-2">
                                                {timeline.map((event, i) => (
                                                    <div key={event.id} className="relative">
                                                        <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white 
                                                             ${["INVOICE_ISSUED", "PAYMENT_RECORDED"].includes(event.action) ? "bg-emerald-500" :
                                                                ["INVOICE_VOIDED"].includes(event.action) ? "bg-red-500" : "bg-slate-300"}`}
                                                        />
                                                        <div className="text-sm font-semibold text-slate-800">{event.action.replace(/_/g, " ")}</div>
                                                        <div className="text-xs text-slate-500 flex gap-2">
                                                            <span>{new Date(event.timestamp).toLocaleString()}</span>
                                                            <span>•</span>
                                                            <span className="font-medium text-slate-700">{event.actor_name}</span>
                                                        </div>
                                                        {event.details && <div className="text-xs text-slate-600 mt-1 bg-slate-50 p-1.5 rounded inline-block">{event.details}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* F) Notes / Terms */}
                        <div className="px-6 pb-6">
                            <div className="bg-amber-50 rounded-md p-4 border border-amber-100">
                                <h4 className="text-xs font-bold text-amber-800 uppercase mb-1">Terms & Conditions</h4>
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    Please pay line items by the due date to avoid late fees.
                                    Contact the school office (admin@school.edu) for any billing queries.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* G) Action Bar (Sticky Footer) */}
                {invoice && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handlePrint}>
                                <Printer className="w-4 h-4 mr-2" /> Print
                            </Button>
                            <Button variant="outline" onClick={handleDownloadPDF}>
                                <Download className="w-4 h-4 mr-2" /> PDF
                            </Button>
                        </div>

                        <div className="flex-1 flex justify-end gap-2">
                            {['DRAFT'].includes(invoice.status) && (
                                <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleIssue} disabled={actionLoading}>
                                    <Send className="w-4 h-4 mr-2" /> Issue Invoice
                                </Button>
                            )}

                            {['ISSUED', 'PARTIAL'].includes(invoice.status) && (
                                <>
                                    <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setShowVoidModal(true)}>
                                        <Ban className="w-4 h-4 mr-2" /> Void
                                    </Button>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px] shadow-sm shadow-emerald-200" onClick={() => setShowPaymentModal(true)}>
                                        <CreditCard className="w-4 h-4 mr-2" /> Record Payment
                                    </Button>
                                </>
                            )}

                            {['PAID'].includes(invoice.status) && (
                                <Button variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-100" disabled>
                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Fully Paid
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>

            {/* Record Payment Modal */}
            <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
                <DialogContent className="max-w-sm bg-white">
                    <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Amount (NPR)</Label>
                            <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Method</Label>
                            <Select value={paymentForm.method} onValueChange={v => setPaymentForm({ ...paymentForm, method: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="CASH">Cash</SelectItem>
                                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                    <SelectItem value="ONLINE">Online</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Reference / Notes</Label>
                            <Input placeholder="Receipt #" value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                        <Button onClick={handlePayment} disabled={actionLoading} className="bg-emerald-600 text-white">Record</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Void Modal */}
            <Dialog open={showVoidModal} onOpenChange={setShowVoidModal}>
                <DialogContent className="max-w-sm bg-white">
                    <DialogHeader><DialogTitle>Void Invoice</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Reason for voiding</Label>
                            <Input placeholder="e.g. Duplicate entry" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowVoidModal(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleVoid} disabled={!voidReason || actionLoading}>Confirm Void</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </Sheet>
    );
}
