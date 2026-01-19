import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // No school_id passed -> Admin Context
      const userData = await login(email, password);

      // Check if user is actually a superuser or similar
      if (userData.role !== 'superuser' && userData.role !== 'SUPER_ADMIN') {
         // Should be caught by backend 403, but just in case
         toast.error("Access restricted to Administrators.");
         return;
      }

      if (userData.require_password_change) {
        toast.warning("Please update your password.");
        navigate('/reset-password');
      } else {
        toast.success("Welcome, Administrator.");
        navigate('/dashboard'); // or /superadmin if that exists
      }
    } catch (error) {
        const detail = error.response?.data?.detail;
        if (detail) {
             toast.error(detail);
        } else {
             toast.error("Invalid credentials or restricted access.");
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md shadow-2xl bg-slate-900 border-slate-800">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-100">Admin Portal</CardTitle>
            <CardDescription className="text-slate-400">Restricted Access</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Email</label>
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-slate-100"
                    placeholder="admin@classa.com"
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Password</label>
                <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-slate-800 border-slate-700 text-slate-100"
                />
            </div>
            <Button type="submit" className="w-full bg-red-700 hover:bg-red-800 text-white" disabled={loading}>
                {loading ? 'Authenticating...' : 'Enter Console'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button
                onClick={() => navigate('/find-school')}
                className="text-sm text-slate-500 hover:text-slate-400"
            >
                Back to School Discovery
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
