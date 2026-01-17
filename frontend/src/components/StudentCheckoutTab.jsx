import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, ShieldAlert, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

const StudentCheckoutTab = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  // Initial load or search
  const fetchStudents = async (query = '') => {
    setLoading(true);
    try {
        const res = await axios.get('/api/students', { params: { search: query } });
        setStudents(res.data);
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
      fetchStudents();
  }, []);

  const handleSearch = () => {
      fetchStudents(search);
  }

  const handleBlockClick = (student) => {
      setSelectedStudent(student);
      setBlockReason('');
      setIsBlockModalOpen(true);
  }

  const handleUnblockClick = async (student) => {
      try {
          await axios.post('/api/attendance/gate/unblock', { student_id: student.id });
          toast.success("Student unblocked");
          fetchStudents(search);
      } catch (err) {
          toast.error("Failed to unblock");
      }
  }

  const confirmBlock = async () => {
      if (!blockReason) {
          toast.error("Reason is required");
          return;
      }
      try {
          await axios.post('/api/attendance/gate/block', {
              student_id: selectedStudent.id,
              reason: blockReason
          });
          toast.success("Student blocked");
          setIsBlockModalOpen(false);
          fetchStudents(search);
      } catch (err) {
          toast.error("Failed to block");
      }
  }

  return (
    <div className="space-y-4">
        <div className="flex gap-2">
            <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} className="bg-[#003333]">
                <Search className="w-4 h-4 mr-2" /> Search
            </Button>
        </div>

        <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-0">
                <div className="divide-y divide-slate-700">
                    {students.map(student => (
                        <div key={student.id} className="p-4 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-slate-200">{student.first_name} {student.last_name}</p>
                                <p className="text-sm text-slate-400">Class: {student.grade_name || 'N/A'} {student.section_name || ''}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {student.pickup_blocked ? (
                                    <Badge variant="destructive" className="bg-[#5C2438] hover:bg-[#5C2438]/90 gap-1">
                                        <ShieldAlert className="w-3 h-3" /> BLOCKED
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-green-500 border-green-500 gap-1">
                                        <Unlock className="w-3 h-3" /> CLEAR
                                    </Badge>
                                )}

                                {student.pickup_blocked ? (
                                    <Button size="sm" onClick={() => handleUnblockClick(student)} variant="secondary">
                                        Unblock
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={() => handleBlockClick(student)} className="bg-[#003333]">
                                        Block
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                    {students.length === 0 && !loading && (
                        <div className="p-8 text-center text-slate-500">No students found.</div>
                    )}
                </div>
            </CardContent>
        </Card>

        <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white">
                <DialogHeader>
                    <DialogTitle>Block Student Pickup</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <p>Blocking <strong>{selectedStudent?.first_name} {selectedStudent?.last_name}</strong> will prevent Guard scanning.</p>
                    <div>
                        <Label>Reason for Block (Required)</Label>
                        <Input
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            placeholder="e.g. Unpaid Fees, Custody Issue"
                            className="bg-slate-800 border-slate-600 mt-2"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsBlockModalOpen(false)}>Cancel</Button>
                    <Button onClick={confirmBlock} className="bg-[#5C2438] hover:bg-[#5C2438]/90 text-white">
                        Confirm Block
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
};

export default StudentCheckoutTab;
