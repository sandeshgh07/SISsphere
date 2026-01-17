import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';

const GatePass = ({ studentId, studentName }) => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [expiry, setExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const fetchToken = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/attendance/gate/qr-code', {
        params: { student_id: studentId }
      });
      setToken(res.data.token);
      setExpiry(new Date(res.data.expires_at));

      const exp = new Date(res.data.expires_at).getTime();
      const now = new Date().getTime();
      setTimeLeft(Math.floor((exp - now) / 1000));

    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Gate Pass");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer;
    if (isOpen && !token) {
        fetchToken();
    }
    if (isOpen && expiry) {
        timer = setInterval(() => {
            const exp = new Date(expiry).getTime();
            const now = new Date().getTime();
            const left = Math.floor((exp - now) / 1000);
            if (left <= 0) {
                // Expired, fetch new
                fetchToken();
            } else {
                setTimeLeft(left);
            }
        }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, expiry, token]);

  const handleRefresh = () => {
      fetchToken();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/10">
            <QrCode className="w-4 h-4" />
            Gate Pass
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Student Gate Pass</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <div className="text-center">
                <h3 className="text-lg font-bold">{studentName}</h3>
                <p className="text-sm text-gray-500">Show this QR code to the Security Guard</p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-inner border">
                {loading ? (
                    <div className="w-[200px] h-[200px] flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : token ? (
                    <QRCodeSVG value={token} size={200} level="H" />
                ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center text-red-500">
                        Error
                    </div>
                )}
            </div>

            <div className="text-center space-y-2">
                 <p className={`text-sm font-mono ${timeLeft < 60 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                    Expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                 </p>
                 <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
                    Refresh Code
                 </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GatePass;
