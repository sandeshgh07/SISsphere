import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Mail, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const GodViewInquiries = () => {
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchInquiries = async () => {
        try {
            const res = await api.get('/communication/admin/contact-requests');
            setInquiries(res.data);
        } catch (error) {
            console.error("Failed to fetch inquiries", error);
            toast.error("Failed to load inquiries");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInquiries();
    }, []);

    const handleReplyClick = (inquiry) => {
        setSelectedInquiry(inquiry);
        setReplyMessage('');
        setIsDialogOpen(true);
    };

    const handleSendReply = async () => {
        if (!replyMessage.trim()) return;

        try {
            setIsReplying(true);
            await api.post(`/communication/admin/contact-requests/${selectedInquiry.id}/reply`, {
                message: replyMessage
            });
            toast.success("Reply sent successfully");
            setIsDialogOpen(false);

            // Optimistic update
            setInquiries(prev => prev.map(i =>
                i.id === selectedInquiry.id
                    ? { ...i, status: 'IN_PROGRESS' }
                    : i
            ));
        } catch (error) {
            console.error("Failed to send reply", error);
            toast.error("Failed to send reply");
        } finally {
            setIsReplying(false);
        }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await api.patch(`/communication/admin/contact-requests/${id}`, { status: newStatus });
            toast.success(`Status updated to ${newStatus}`);
            fetchInquiries(); // Refresh to be safe
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const filteredInquiries = inquiries.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status) => {
        switch (status) {
            case 'NEW': return 'bg-blue-100 text-blue-800';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
            case 'RESOLVED': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inquiries & Contact Requests</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage incoming messages from the public landing page.</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search inquiries..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Inquiries</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                            ) : filteredInquiries.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">No inquiries found.</TableCell></TableRow>
                            ) : (
                                filteredInquiries.map((inquiry) => (
                                    <TableRow key={inquiry.id}>
                                        <TableCell>
                                            <Badge variant="secondary" className={getStatusColor(inquiry.status)}>
                                                {inquiry.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {new Date(inquiry.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{inquiry.name}</div>
                                            <div className="text-xs text-muted-foreground">{inquiry.email}</div>
                                            {inquiry.school_name && <div className="text-xs text-blue-600 mt-0.5">{inquiry.school_name}</div>}
                                        </TableCell>
                                        <TableCell className="font-medium max-w-[150px] truncate" title={inquiry.subject}>
                                            {inquiry.subject}
                                        </TableCell>
                                        <TableCell className="max-w-[250px] truncate text-muted-foreground" title={inquiry.message}>
                                            {inquiry.message}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleReplyClick(inquiry)}>
                                                    <Mail className="w-4 h-4 mr-1" />
                                                    Reply
                                                </Button>
                                                {inquiry.status !== 'RESOLVED' && (
                                                    <Button size="sm" variant="ghost" onClick={() => handleStatusUpdate(inquiry.id, 'RESOLVED')} title="Mark Resolved">
                                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reply to {selectedInquiry?.name}</DialogTitle>
                        <DialogDescription>
                            Send an email reply to {selectedInquiry?.email}. This will mark the inquiry as IN PROGRESS.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                            <strong>Subject:</strong> {selectedInquiry?.subject}<br />
                            <strong>Message:</strong><br />
                            {selectedInquiry?.message}
                        </div>
                        <Textarea
                            placeholder="Type your reply here..."
                            rows={6}
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendReply} disabled={isReplying || !replyMessage.trim()}>
                            {isReplying ? 'Sending...' : 'Send Reply'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GodViewInquiries;
