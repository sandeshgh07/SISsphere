import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { accessToken, user, logout, updateTokens } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Validations
    if (!currentPassword) {
      toast({ title: "Error", description: "Current password is required", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (currentPassword === newPassword) {
      toast({ title: "Error", description: "New password must be different from current password", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/change-password`,
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      // Update tokens in context (new tokens without force_password_change)
      if (response.data.access_token) {
        updateTokens(response.data.access_token, response.data.refresh_token);
      }

      toast({ title: "Success", description: "Password changed successfully!" });

      // Redirect to appropriate dashboard
      const role = user?.active_role || user?.role;
      if (role === "superuser") {
        navigate("/platform-admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Failed to change password";
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/50 border-slate-700">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <CardTitle className="text-xl text-slate-100">Password Change Required</CardTitle>
          <CardDescription className="text-slate-400">
            For security reasons, you must change your password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword" className="text-slate-200">Current Password</Label>
              <div className="relative mt-1">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="bg-slate-800 border-slate-600 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword" className="text-slate-200">New Password</Label>
              <div className="relative mt-1">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="bg-slate-800 border-slate-600 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-red-400 mt-1">Password must be at least 8 characters</p>
              )}
              {newPassword && newPassword.length >= 8 && (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Password length is good
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-slate-200">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="bg-slate-800 border-slate-600 mt-1"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
              {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              {loading ? "Changing Password..." : "Change Password & Continue"}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={logout}
                className="text-sm text-slate-400 hover:text-slate-200 underline"
              >
                Logout instead
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

