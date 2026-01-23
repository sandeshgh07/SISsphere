import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const FeesTab = () => {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null); // Fee ID currently uploading

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    try {
      // Reuse student-health to get fees if no dedicated list endpoint
      const response = await api.get('/analytics/student-health');
      if (response.data.fee_invoices) {
        setFees(response.data.fee_invoices);
      }
    } catch (error) {
      console.error("Failed to fetch fees", error);
      toast.error("Failed to load fees.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (feeId, file) => {
    if (!file) return;

    setUploading(feeId);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fee_id', feeId);

    try {
      await api.post('/finance/receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success("Receipt uploaded successfully!");
      fetchFees(); // Refresh to show updated status/url
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload receipt.");
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Financial Portal</h2>
      {fees.length === 0 && <p className="text-muted-foreground">No invoices found.</p>}

      {fees.map((fee) => (
        <Card key={fee.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{fee.description}</CardTitle>
                <p className="text-sm text-muted-foreground">Due: {new Date(fee.due_date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">${fee.amount.toFixed(2)}</div>
                <Badge variant={fee.status === 'paid' ? 'default' : 'secondary'}>
                  {fee.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {fee.status === 'paid' ? (
              <div className="flex items-center text-green-600 space-x-2">
                <CheckCircle size={16} />
                <span className="text-sm">Paid on {new Date(fee.paid_date).toLocaleDateString()}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {fee.receipt_url ? (
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={16} className="text-yellow-600" />
                    <span className="text-sm text-yellow-600">Receipt Uploaded (Pending Review)</span>
                    {/* Optional: View Receipt Link */}
                  </div>
                ) : (
                  <div className="mt-2">
                    <Label htmlFor={`upload-${fee.id}`} className="block text-sm font-medium mb-1">
                      Upload Evidence
                    </Label>
                    <div className="flex space-x-2">
                      <Input
                        id={`upload-${fee.id}`}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleUpload(fee.id, e.target.files[0])}
                        disabled={uploading === fee.id}
                      />
                      {uploading === fee.id && <Loader2 className="animate-spin" />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FeesTab;
