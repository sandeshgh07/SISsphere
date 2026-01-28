import { useState, useEffect } from "react";
import axios from "axios";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Loader2, ChevronLeft, ChevronRight, Filter, Eye, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const STATUS_COLORS = {
    DRAFT: "bg-slate-100 text-slate-700",
    ISSUED: "bg-blue-100 text-blue-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    PAID: "bg-emerald-100 text-emerald-700",
    VOID: "bg-red-100 text-red-700 border-red-200 line-through text-slate-500 opacity-70"
};

export function InvoicesTable({ accessToken, grades, onSelectInvoice, refreshTrigger }) {
    const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

    // State
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState({
        q: "",
        period: "", // Empty = all, or default to current?
        status: "ALL",
        grade_id: "all",
        balance_gt0: false
    });

    const [page, setPage] = useState(0);
    const [limit] = useState(50);

    // Debounce search
    const [debouncedQ, setDebouncedQ] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQ(filters.q), 500);
        return () => clearTimeout(timer);
    }, [filters.q]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const params = {
                limit,
                offset: page * limit,
                period: filters.period || undefined,
                status: filters.status === "ALL" ? undefined : filters.status,
                grade_id: filters.grade_id === "all" ? undefined : filters.grade_id,
                balance_gt0: filters.balance_gt0 ? true : undefined,
                q: debouncedQ || undefined
            };

            const res = await axios.get(`${API_BASE}/api/fees/invoices`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                params
            });
            setInvoices(res.data);
        } catch (error) {
            console.error("Failed to fetch invoices", error);
        } finally {
            setLoading(false);
        }
    };

    // Effects
    useEffect(() => {
        fetchInvoices();
    }, [page, filters.status, filters.grade_id, filters.balance_gt0, filters.period, debouncedQ, refreshTrigger]);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 p-1">
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search student or invoice..."
                        className="pl-9 bg-white"
                        value={filters.q}
                        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                    />
                </div>

                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                    <SelectTrigger className="w-[140px] bg-white text-xs">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ISSUED">Issued</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                        <SelectItem value="PAID">Paid</SelectItem>
                        <SelectItem value="VOID">Void</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filters.grade_id} onValueChange={(v) => setFilters({ ...filters, grade_id: v })}>
                    <SelectTrigger className="w-[140px] bg-white text-xs">
                        <SelectValue placeholder="Grade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Grades</SelectItem>
                        {grades.map(g => (
                            <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md border text-xs">
                    <Checkbox
                        id="bal-gt0"
                        checked={filters.balance_gt0}
                        onCheckedChange={(c) => setFilters({ ...filters, balance_gt0: c })}
                    />
                    <Label htmlFor="bal-gt0" className="cursor-pointer font-normal">Pending Balance</Label>
                </div>

                <Input
                    type="month"
                    value={filters.period}
                    onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                    className="bg-white w-40"
                />

                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[100px]">Invoice #</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                                    No invoices found. Use the generator to create pending invoices.
                                </TableCell>
                            </TableRow>
                        )}
                        {invoices.map((inv) => (
                            <TableRow key={inv.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelectInvoice(inv.id)}>
                                <TableCell className="font-mono text-xs text-slate-500">
                                    {inv.id.split('-')[0].toUpperCase()}
                                </TableCell>
                                <TableCell className="font-medium text-xs">{inv.period}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-slate-900">{inv.student_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs text-slate-500">{inv.grade_name}</TableCell>
                                <TableCell className="text-right font-medium">
                                    {(inv.total_due).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-slate-500">
                                    {(inv.paid_total).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-bold text-slate-900">
                                    {(inv.balance).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                    <Badge className={`rounded-sm font-normal ${STATUS_COLORS[inv.status] || STATUS_COLORS.DRAFT} hover:${STATUS_COLORS[inv.status]}`}>
                                        {inv.status}
                                    </Badge>
                                </TableCell>
                                <TableCell onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSelectInvoice(inv.id)}>
                                        <Eye className="h-4 w-4 text-slate-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-xs text-slate-500">Page {page + 1}</div>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={invoices.length < limit}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
