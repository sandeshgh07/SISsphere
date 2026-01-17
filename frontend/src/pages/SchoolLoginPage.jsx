import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { Building2, Loader2, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

/**
 * Phase 7A: School-Specific Login Page
 * Route: /:schoolSlug/login
 * 
 * Features:
 * - Displays school branding (logo + name)
 * - Validates login against the specific school
 * - Shows clear error messages
 */
function SchoolLoginPage() {
  const { schoolSlug } = useParams();
  const navigate = useNavigate();
  const { login, accessToken, user, isHydrated, getEffectiveRole } = useAuth();

  const [schoolInfo, setSchoolInfo] = useState(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [schoolError, setSchoolError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch school info by slug
  useEffect(() => {
    const fetchSchool = async () => {
      if (!schoolSlug) {
        setSchoolError("No school specified");
        setLoadingSchool(false);
        return;
      }

      try {
        const res = await axios.get(`${API_BASE}/api/public/schools/by-slug/${schoolSlug}`);
        setSchoolInfo(res.data);
        setSchoolError("");
      } catch (err) {
        console.error("[SchoolLogin] Failed to fetch school:", err);
        if (err.response?.status === 404) {
          setSchoolError("School not found. Please check the URL or search for your school.");
        } else {
          setSchoolError("Failed to load school information. Please try again.");
        }
      } finally {
        setLoadingSchool(false);
      }
    };

    fetchSchool();
  }, [schoolSlug]);

  // Redirect if already logged in
  useEffect(() => {
    if (isHydrated && accessToken && user) {
      const effectiveRole = getEffectiveRole();
      if (effectiveRole === "superuser") {
        navigate("/superadmin", { replace: true });
      } else {
        navigate("/school/overview", { replace: true });
      }
    }
  }, [isHydrated, accessToken, user, navigate, getEffectiveRole]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!schoolInfo) return;

    setError("");
    setSubmitting(true);
    
    try {
      // Use school-specific login
      await login(email, password, schoolInfo.id);
      // Navigation will happen via the useEffect above
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.includes("not associated with this school")) {
        setError("Your account is not registered with this school. Please check if you're on the correct school's login page.");
      } else if (detail === "Invalid email or password") {
        setError("Invalid email or password. Please try again.");
      } else if (detail?.includes("inactive")) {
        setError("This school is currently inactive. Please contact administration.");
      } else {
        setError(detail || "Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loadingSchool) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading school information...</span>
        </div>
      </div>
    );
  }

  // School not found error
  if (schoolError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-700">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-100 mb-2">School Not Found</h2>
            <p className="text-slate-400 mb-6">{schoolError}</p>
            <Button
              onClick={() => navigate("/login")}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Find Your School
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-700">
        <CardHeader className="text-center space-y-4">
          {/* School Branding */}
          <div className="flex flex-col items-center gap-3">
            {schoolInfo?.logo_url ? (
              <img
                src={schoolInfo.logo_url}
                alt={schoolInfo.name}
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-blue-400" />
              </div>
            )}
            <div>
              <CardTitle className="text-2xl text-slate-100">
                {schoolInfo?.name}
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                Login to access your account
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your.email@example.com"
                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                disabled={submitting}
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Not from this school?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-blue-400 hover:text-blue-300"
              >
                Find your school
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SchoolLoginPage;

