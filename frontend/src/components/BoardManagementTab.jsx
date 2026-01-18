import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Plus, Shield, UserCog, UserX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import WarRoomModal from './WarRoomModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BoardManagementTab = () => {
    const { token, user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [warRoomOpen, setWarRoomOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [processing, setProcessing] = useState(false);

    // Add User Modal State
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', password: '' });

    const fetchBoardUsers = async () => {
        try {
            // Fetch users via axios api instance
            const res = await api.get('/api/users');
            const data = res.data;
            const boardLevel = data.filter(u => u.role === 'super_admin' || u.role === 'principal');
            setUsers(boardLevel);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load board members");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchBoardUsers();
    }, [token]);

    const handleRoleChange = async (userId, newRole, justification) => {
        setProcessing(true);
        try {
            await api.patch(`/api/governance/users/${userId}/role`, { new_role: newRole, justification });
            toast.success("Executive role updated successfully");
            setWarRoomOpen(false);
            fetchBoardUsers();
        } catch (err) {
            toast.error(err.response?.data?.detail || err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleCreateUser = async () => {
        setProcessing(true);
        try {
            await api.post('/api/governance/users', { ...newUser, role: 'super_admin' });
            toast.success("Board member added");
            setAddModalOpen(false);
            setNewUser({ first_name: '', last_name: '', email: '', password: '' });
            fetchBoardUsers();
        } catch (err) {
            toast.error(err.response?.data?.detail || err.message);
        } finally {
            setProcessing(false);
        }
    };

    const openWarRoom = (u) => {
        setSelectedUser(u);
        setWarRoomOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-[#003333]">Board & Executive Leadership</h3>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchBoardUsers}>Refresh List</Button>
                    <Button onClick={() => setAddModalOpen(true)} className="bg-[#003333] hover:bg-[#004d4d]">
                        <Plus className="mr-2 h-4 w-4" /> Add Board Member
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(u => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.full_name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                                            {u.role.replace('_', ' ').toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={u.is_active ? 'default' : 'destructive'} className={u.is_active ? 'bg-green-600' : ''}>
                                            {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openWarRoom(u)}
                                            disabled={u.id === user?.id}
                                            className="text-[#5C2438] hover:text-[#5C2438] hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <UserCog className="h-4 w-4 mr-1" /> Governance
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <WarRoomModal
                open={warRoomOpen}
                onClose={() => setWarRoomOpen(false)}
                user={selectedUser}
                onConfirm={handleRoleChange}
                loading={processing}
            />

            {/* Add User Modal */}
            <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Board Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>First Name</Label>
                                <Input value={newUser.first_name} onChange={e => setNewUser({...newUser, first_name: e.target.value})} />
                            </div>
                            <div>
                                <Label>Last Name</Label>
                                <Input value={newUser.last_name} onChange={e => setNewUser({...newUser, last_name: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        </div>
                        <div>
                            <Label>Password</Label>
                            <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateUser} disabled={processing}>
                            {processing ? "Creating..." : "Create SuperAdmin"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BoardManagementTab;
