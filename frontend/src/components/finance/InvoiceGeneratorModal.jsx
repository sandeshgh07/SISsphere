import { useState } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export function InvoiceGeneratorModal({ open, onOpenChange, grades, feeTemplates, onSuccess, accessToken }) {
    const { toast } = useToast();
    const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

    // State
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Config
    const [config, setConfig] = useState({
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
        grade_id: "all",
        template_ids: [], // Empty = all
        conflict_rule: "SKIP"
    });

    // Preview Data
    const [previewResult, setPreviewResult] = useState(null);

    const handlePreview = async () => {
        setLoading(true);
        try {
            const payload = {
                period: config.period,
                grade_id: config.grade_id,
                template_ids: config.template_ids.length > 0 ? config.template_ids : null,
                conflict_rule: config.conflict_rule
            };

            const res = await axios.post(`${API_BASE}/api/fees/invoices/generator/preview`, payload, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            setPreviewResult(res.data);
            setStep(2);
        } catch (error) {
            toast({
                title: "Preview Failed",
                description: error.response?.data?.detail || "Could not generate preview",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRun = async () => {
        setLoading(true);
        try {
            const payload = {
                period: config.period,
                grade_id: config.grade_id,
                template_ids: config.template_ids.length > 0 ? config.template_ids : null,
                conflict_rule: config.conflict_rule
            };

            const res = await axios.post(`${API_BASE}/api/fees/invoices/generator/run`, payload, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            const { created, updated, skipped } = res.data;
            toast({
                title: "Generation Complete",
                description: `Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
            });

            onSuccess(); // Close and refetch
            onOpenChange(false);
            setStep(1); // Reset
            setPreviewResult(null);
        } catch (error) {
            toast({
                title: "Generation Failed",
                description: error.response?.data?.detail || "Error running generator",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!loading) {
                onOpenChange(val);
                if (!val) { setTimeout(() => setStep(1), 300); }
            }
        }}>
            <DialogContent className="max-w-3xl bg-white">
                <DialogHeader>
                    <DialogTitle>{step === 1 ? "Run Invoice Generator" : "Preview Generation"}</DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Billing Period</Label>
                                    <Input
                                        type="month"
                                        value={config.period}
                                        onChange={(e) => setConfig({ ...config, period: e.target.value })}
                                        className="bg-white"
                                    />
                                    <p className="text-xs text-slate-500">Invoices will be dated to this month.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Grade Scope</Label>
                                    <Select value={config.grade_id} onValueChange={(v) => setConfig({ ...config, grade_id: v })}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select Scope" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="all">All Grades</SelectItem>
                                            {grades.map(g => (
                                                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>Select Fee Templates (Optional)</Label>
                                <div className="border rounded-md p-3 max-h-40 overflow-y-auto bg-slate-50 grid grid-cols-2 gap-2">
                                    {feeTemplates.map(t => (
                                        <div key={t.id} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`tpl-${t.id}`}
                                                className="rounded border-gray-300"
                                                checked={config.template_ids.includes(t.id)}
                                                onChange={(e) => {
                                                    const newIds = e.target.checked
                                                        ? [...config.template_ids, t.id]
                                                        : config.template_ids.filter(id => id !== t.id);
                                                    setConfig({ ...config, template_ids: newIds });
                                                }}
                                            />
                                            <label htmlFor={`tpl-${t.id}`} className="text-sm cursor-pointer">{t.title} ({t.amount})</label>
                                        </div>
                                    ))}
                                    {feeTemplates.length === 0 && <span className="text-sm text-slate-500 col-span-2">No active templates found</span>}
                                </div>
                                <p className="text-xs text-slate-500">Leave unselected to apply ALL valid templates automatically.</p>
                            </div>

                            <div className="space-y-3">
                                <Label>Conflict Resolution</Label>
                                <RadioGroup value={config.conflict_rule} onValueChange={(v) => setConfig({ ...config, conflict_rule: v })} className="flex flex-col space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="SKIP" id="r-skip" />
                                        <Label htmlFor="r-skip" className="font-normal cursor-pointer">Skip existing invoices (safest)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="UPDATE_DRAFT" id="r-update" />
                                        <Label htmlFor="r-update" className="font-normal cursor-pointer">Update DRAFT invoices (add missing lines)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="REGENERATE" id="r-regen" />
                                        <Label htmlFor="r-regen" className="font-normal cursor-pointer text-red-600">Regenerate DRAFT invoices (Overwrite all lines)</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    )}

                    {step === 2 && previewResult && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center">
                                    <div className="text-2xl font-bold text-emerald-700">{previewResult.created}</div>
                                    <div className="text-xs text-emerald-600 font-medium uppercase">Will Create</div>
                                </div>
                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-center">
                                    <div className="text-2xl font-bold text-amber-700">{previewResult.updated}</div>
                                    <div className="text-xs text-amber-600 font-medium uppercase">Will Update</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                                    <div className="text-2xl font-bold text-slate-700">{previewResult.skipped}</div>
                                    <div className="text-xs text-slate-600 font-medium uppercase">Will Skip</div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                                    <div className="text-2xl font-bold text-blue-700">NPR {previewResult.total_impact_value.toLocaleString()}</div>
                                    <div className="text-xs text-blue-600 font-medium uppercase">Est. Total</div>
                                </div>
                            </div>

                            {previewResult.errors?.length > 0 && (
                                <div className="bg-red-50 text-red-800 p-3 rounded-md text-sm border border-red-200">
                                    <div className="font-bold flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4" /> {previewResult.errors.length} Errors detected</div>
                                    <ul className="list-disc pl-5 max-h-20 overflow-y-auto">
                                        {previewResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Sample Impact (First 20)</Label>
                                <div className="border rounded-md overflow-hidden bg-white">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 border-b">
                                            <tr>
                                                <th className="p-2 pl-4">Student</th>
                                                <th className="p-2">Action</th>
                                                <th className="p-2 text-right pr-4">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {previewResult.samples.map((s, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="p-2 pl-4">{s.student_name}</td>
                                                    <td className="p-2">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                                            ${s.action === 'created' ? 'bg-emerald-100 text-emerald-800' :
                                                                s.action === 'updated' ? 'bg-amber-100 text-amber-800' :
                                                                    'bg-slate-100 text-slate-800'}`}>
                                                            {s.action}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-right pr-4">NPR {s.amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {previewResult.samples.length === 0 && (
                                                <tr><td colSpan="3" className="p-4 text-center text-slate-500">No changes predicted</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4">
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={handlePreview} disabled={loading} className="bg-slate-900 text-white hover:bg-slate-800">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Preview Impact
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>Back</Button>
                            <Button onClick={handleRun} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Run Generator
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
