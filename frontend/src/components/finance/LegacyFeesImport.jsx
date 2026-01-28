import React, { useState, useRef } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, CheckCircle, FileText, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function LegacyFeesImport() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null); // { rows: [], summary: {} }
    const [analyzing, setAnalyzing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null); // { status: "success", invoices: N, payments: N }
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setPreview(null);
            setResult(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setAnalyzing(true);
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await api.post(`/fees/legacy/import/preview`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setPreview(res.data);
        } catch (error) {
            console.error("Preview failed", error);
            alert("Failed to analyze CSV. Check format or server logs.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCommit = async () => {
        if (!preview || !preview.rows) return;
        if (!window.confirm("Are you sure you want to commit these records? This action cannot be easily undone.")) return;

        setImporting(true);
        try {
            const res = await api.post(`/fees/legacy/import/commit`, { rows: preview.rows });
            setResult(res.data);
            setFile(null);
            setPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (error) {
            console.error("Import failed", error);
            alert("Import failed. See console.");
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const csvContent = "student_identifier,period,total_due,paid_amount,due_date,notes\nstudent@example.com,2025-01,5000,0,2025-01-15,Tuition Fee";
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "legacy_fees_template.csv";
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Import Legacy Fees</CardTitle>
                    <CardDescription>
                        Upload a CSV file containing past invoices and payments to migrate them into the system.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Upload Area */}
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            accept=".csv"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-violet-50 file:text-violet-700
                  hover:file:bg-violet-100"
                        />
                        <Button variant="outline" onClick={downloadTemplate} size="sm">
                            <FileText className="mr-2 h-4 w-4" /> Template
                        </Button>
                    </div>

                    {file && !preview && !result && (
                        <div className="flex justify-end">
                            <Button onClick={handleAnalyze} disabled={analyzing}>
                                {analyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Analyze CSV
                            </Button>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800">Import Successful</AlertTitle>
                            <AlertDescription className="text-green-700">
                                Created {result.invoices} invoices and {result.payments} payment records.
                                <Button variant="link" onClick={() => setResult(null)} className="pl-2 h-auto text-green-800 underline">
                                    Import Another
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Preview */}
                    {preview && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Valid: {preview.summary.valid}
                                </Badge>
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    Errors: {preview.summary.error}
                                </Badge>
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                    Duplicates: {preview.summary.duplicate}
                                </Badge>
                                <div className="flex-1 text-right text-sm text-muted-foreground">
                                    Total Value: NPR {preview.summary.total_value.toLocaleString()}
                                </div>
                            </div>

                            <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">Row</TableHead>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Period</TableHead>
                                            <TableHead className="text-right">Due</TableHead>
                                            <TableHead className="text-right">Paid</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Message</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {preview.rows.slice(0, 100).map((row) => (
                                            <TableRow key={row.row_index} className={row.status === 'ERROR' ? 'bg-red-50' : row.status === 'DUPLICATE' ? 'bg-yellow-50' : ''}>
                                                <TableCell>{row.row_index + 1}</TableCell>
                                                <TableCell>{row.student_identifier}</TableCell>
                                                <TableCell>{row.period}</TableCell>
                                                <TableCell className="text-right">{row.amount_due}</TableCell>
                                                <TableCell className="text-right">{row.paid_amount}</TableCell>
                                                <TableCell>
                                                    <Badge variant={row.status === 'VALID' ? 'success' : 'destructive'} className={row.status === 'VALID' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                                                        {row.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{row.message}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
                                <Button onClick={handleCommit} disabled={importing || preview.summary.valid === 0}>
                                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Commit Import
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
