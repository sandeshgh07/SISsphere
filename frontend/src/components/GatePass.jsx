import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, QrCode, Search, User, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Textarea } from '@/components/ui/textarea';

const GatePass = ({ studentId: defaultStudentId, studentName: defaultStudentName }) => {
  const { user, availableRoles, isDualRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("normal");

  // Pass State
  const [token, setToken] = useState(null);
  const [passData, setPassData] = useState(null); // { pass_id, expires_at, student_name }
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // SuperPass Form State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(
    defaultStudentId ? { id: defaultStudentId, name: defaultStudentName } : null
  );

  const [formData, setFormData] = useState({
    reason: "",
    sent_with_name: "",
    sent_with_relation: "",
    sent_with_phone: ""
  });

  // Determine initial mode
  useEffect(() => {
    // If user is primarily staff/admin and NOT parent, default to super
    // If user is Parent, default to normal
    if (user?.role === 'parent' || user?.role === 'student') {
      setActiveTab("normal");
    } else {
      setActiveTab("super");
      // If defaulting to super and the passed student is myself (Staff), clear it to show search
      if (defaultStudentId === user?.id) {
        setSelectedStudent(null);
      }
    }
  }, [user, defaultStudentId]);

  // Timer for Expiry
  useEffect(() => {
    let timer;
    if (passData?.expires_at) {
      timer = setInterval(() => {
        const exp = new Date(passData.expires_at).getTime();
        const now = new Date().getTime();
        const left = Math.floor((exp - now) / 1000);
        if (left <= 0) {
          setPassData(null); // Expired
          setToken(null);
        } else {
          setTimeLeft(left);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [passData]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setSearching(true);
    try {
      // Identify if query is a name or roll number?
      // For MVP, assume we have a search endpoint or just list students?
      // Using /students endpoint with filters or a new search endpoint.
      // Let's use the list endpoint and filter client side for MVP or minimal search query if supported.
      // Actually, let's just use exact match or similar if API supports.
      // Fallback: Just fetch list and filter (not scalable but working for now)
      const res = await api.get('/students'); // Lists all active students for principal
      const filtered = res.data.filter(s =>
        s.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5);
      setSearchResults(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const generatePass = async () => {
    if (!selectedStudent && activeTab === 'super') {
      toast.error("Please select a student");
      return;
    }

    // For Normal pass, use props or implicit context
    const targetStudentId = activeTab === 'super' ? selectedStudent.id : defaultStudentId;
    if (!targetStudentId) {
      toast.error("No student identified");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        student_id: targetStudentId,
        pass_type: activeTab === 'normal' ? 'NORMAL' : 'SUPER',
        expires_in_hours: activeTab === 'super' ? 2 : 1, // Default durations
        ...formData
      };

      const res = await api.post('/attendance/gate/create', payload);
      setToken(res.data.token);
      setPassData(res.data);

      // Reset form ?
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to generate pass");
    } finally {
      setLoading(false);
    }
  };

  const resetSelection = () => {
    setSelectedStudent(null);
    setToken(null);
    setPassData(null);
    setSearchResults([]);
    setSearchQuery("");
    setFormData({ reason: "", sent_with_name: "", sent_with_relation: "", sent_with_phone: "" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetSelection(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10">
          <QrCode className="w-4 h-4" />
          Gate Pass
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>Gate Pass</DialogTitle>
        </DialogHeader>

        {/* Pass Display (If Generated) */}
        {token ? (
          <div className="flex flex-col items-center justify-center p-4 space-y-4 animate-in fade-in zoom-in">
            <div className="text-center">
              <h3 className="text-lg font-bold">{passData?.student_name}</h3>
              <p className="text-sm text-gray-500">
                {activeTab === 'super' ? 'SUPER PASS AUTHORIZATION' : 'Standard Pickup Pass'}
              </p>
              {passData?.expires_at && (
                <p className={`text-xs font-mono font-bold mt-1 ${timeLeft < 300 ? 'text-red-500' : 'text-green-600'}`}>
                  Expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </p>
              )}
            </div>

            <div className={`p-4 rounded-xl shadow-inner border-4 ${activeTab === 'super' ? 'border-amber-400 bg-amber-50' : 'border-white bg-white'}`}>
              <QRCodeSVG value={token} size={200} level="H" />
            </div>

            <div className="text-center w-full">
              <p className="text-xs text-gray-400 mb-4">Show this to the Security Guard</p>
              <Button variant="ghost" size="sm" onClick={() => setToken(null)} className="text-gray-500">
                Generate Another
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v);
            // When switching to Super/Override mode, if the selected student is MYSELF (the staff/principal),
            // we should clear it so the Search Bar appears immediately.
            if (v === 'super' && selectedStudent?.id === user?.id) {
              setSelectedStudent(null);
            } else if (v === 'normal' && !selectedStudent) {
              // Restore default if going back to normal? 
              // Actually, normal mode usually relies on context/props, but let's reset to default
              if (defaultStudentId) setSelectedStudent({ id: defaultStudentId, name: defaultStudentName });
            }
          }} className="w-full">
            {/* Only show Tabs if user has clearance for SuperPass OR is Dual Role */}
            {/* Actually, if user is JUST parent, they shouldn't see Super tab. */}
            {/* If user is JUST teacher, they shouldn't see Normal tab (strictly speaking, unless they have kids) */}
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="normal" disabled={user?.role !== 'parent' && user?.role !== 'student' && !availableRoles?.includes('parent')}>
                Normal Pass
              </TabsTrigger>
              <TabsTrigger value="super" disabled={['parent', 'student'].includes(user?.role) && !availableRoles?.some(r => ['principal', 'teacher', 'school_admin', 'super_admin'].includes(r))}>
                Staff Override
              </TabsTrigger>
            </TabsList>

            <TabsContent value="normal" className="space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Generate standard pickup pass for</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{defaultStudentName || "Linked Student"}</p>
              </div>
            </TabsContent>

            <TabsContent value="super" className="space-y-4">
              {/* Student Search */}
              {!selectedStudent ? (
                <div className="space-y-2">
                  <Label>Search Student</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Name or Roll No..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Button size="icon" onClick={handleSearch} disabled={searching}>
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
                    {searchResults.map(s => (
                      <div key={s.id}
                        className="p-2 hover:bg-gray-100 rounded cursor-pointer border flex justify-between items-center"
                        onClick={() => { setSelectedStudent({ id: s.id, name: `${s.first_name} ${s.last_name}` }); setSearchResults([]); }}
                      >
                        <span className="font-medium text-sm">{s.first_name} {s.last_name}</span>
                        <span className="text-xs text-gray-500">{s.roll_number}</span>
                      </div>
                    ))}
                    {searchResults.length === 0 && searchQuery && !searching && (
                      <p className="text-xs text-center text-gray-400 py-2">No students found</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span className="font-bold text-sm">{selectedStudent.name}</span>
                  </div>
                  <Button variant="ghost" size="xs" onClick={() => setSelectedStudent(null)} className="h-6 text-xs hover:text-red-600">
                    Change
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Sent With (Name)</Label>
                    <Input
                      className="h-8"
                      value={formData.sent_with_name}
                      onChange={e => setFormData({ ...formData, sent_with_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Relation</Label>
                    <Input
                      className="h-8"
                      value={formData.sent_with_relation}
                      onChange={e => setFormData({ ...formData, sent_with_relation: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Reason <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder="Required for audit..."
                    className="h-20"
                    value={formData.reason}
                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2 p-2 bg-amber-50 text-amber-700 rounded text-xs">
                  <ShieldAlert className="w-4 h-4" />
                  This action will be audited.
                </div>
              </div>
            </TabsContent>

            <Button className="w-full mt-4" disabled={loading} onClick={generatePass}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Generate Pass"}
            </Button>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GatePass;
