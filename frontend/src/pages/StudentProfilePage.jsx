import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, GraduationCap, Users, AlertTriangle, DollarSign, ShieldAlert } from "lucide-react";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

// Role display labels
const ROLE_LABELS = {
  principal: "Principal",
  school_admin: "School Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  parent: "Parent",
  student: "Student",
};

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { accessToken, user, getEffectiveRole, isHydrated } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const effectiveRole = getEffectiveRole();

  // Role-based section visibility
  const canSeeParents = ["principal", "school_admin", "teacher"].includes(effectiveRole);
  const canSeeComplaints = ["principal", "school_admin", "teacher", "parent"].includes(effectiveRole);
  const canSeeFees = ["principal", "school_admin", "accountant", "parent"].includes(effectiveRole);

  useEffect(() => {
    if (!isHydrated || !accessToken || !studentId) return;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE}/api/students/${studentId}/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setProfile(res.data);
      } catch (e) {
        console.error("[StudentProfile] Error loading profile:", e);
        if (e.response?.status === 403) {
          setError("access_denied");
        } else if (e.response?.status === 404) {
          setError("not_found");
        } else {
          setError("unknown");
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isHydrated, accessToken, studentId]);

  // Loading state
  if (!isHydrated || loading) {
    return (
      <div className="col-span-full space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-slate-700 rounded animate-pulse" />
          <div className="h-6 w-48 bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-900 border-slate-700 animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 bg-slate-700 rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-slate-700 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Access Denied
  if (error === "access_denied") {
    return (
      <div className="col-span-full space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-12 text-center">
            <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Access Denied</h2>
            <p className="text-slate-400 mb-4">You do not have permission to view this student's profile.</p>
            <Button
              variant="outline"
              onClick={() => navigate("/school/students")}
              className="border-slate-600 text-slate-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not Found
  if (error === "not_found" || !profile?.student) {
    return (
      <div className="col-span-full space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Student Not Found</h2>
            <p className="text-slate-400 mb-4">The requested student could not be found.</p>
            <Button
              variant="outline"
              onClick={() => navigate("/school/students")}
              className="border-slate-600 text-slate-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { student, grade, parents, complaints, fees, payments } = profile;

  return (
    <div className="col-span-full space-y-6" data-testid="student-profile-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/school/students")}
          className="text-slate-400 hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold text-slate-100">
          {student.first_name} {student.last_name}
        </h1>
        <Badge
          variant="outline"
          className={student.status === "active" ? "bg-green-900/30 text-green-400 border-green-700" : "bg-slate-800 text-slate-400 border-slate-600"}
        >
          {student.status || "Active"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info Card */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="flex flex-row items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-slate-100">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Full Name</span>
                <p className="text-slate-100 font-medium">{student.first_name} {student.last_name}</p>
              </div>
              <div>
                <span className="text-slate-400">Roll No</span>
                <p className="text-slate-100 font-medium">{student.roll_no || "-"}</p>
              </div>
              <div>
                <span className="text-slate-400">Email</span>
                <p className="text-slate-100">{student.email || "-"}</p>
              </div>
              <div>
                <span className="text-slate-400">Phone</span>
                <p className="text-slate-100">{student.phone || "-"}</p>
              </div>
              <div>
                <span className="text-slate-400">Gender</span>
                <p className="text-slate-100">{student.gender || "-"}</p>
              </div>
              <div>
                <span className="text-slate-400">Date of Birth</span>
                <p className="text-slate-100">
                  {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "-"}
                </p>
              </div>
            </div>
            {student.address && (
              <div>
                <span className="text-slate-400 text-sm">Address</span>
                <p className="text-slate-100 text-sm">{student.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grade Card */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="flex flex-row items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-slate-100">Academic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Grade</span>
                <p className="text-slate-100 font-medium">{grade?.name || "Not assigned"}</p>
              </div>
              <div>
                <span className="text-slate-400">Level</span>
                <p className="text-slate-100">{grade?.level || "-"}</p>
              </div>
              {student.section_id && (
                <div>
                  <span className="text-slate-400">Section</span>
                  <p className="text-slate-100">{student.section_id}</p>
                </div>
              )}
              {student.program_id && (
                <div>
                  <span className="text-slate-400">Program</span>
                  <p className="text-slate-100">{student.program_id}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parents Card - Role restricted */}
        {canSeeParents && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              <CardTitle className="text-slate-100">Parents / Guardians</CardTitle>
            </CardHeader>
            <CardContent>
              {parents && parents.length > 0 ? (
                <div className="space-y-3">
                  {parents.map((parent, idx) => (
                    <div key={parent.id || idx} className="p-3 bg-slate-800 rounded-lg">
                      <p className="text-slate-100 font-medium">{parent.full_name}</p>
                      <div className="text-sm text-slate-400 mt-1 space-y-1">
                        {parent.email && <p>Email: {parent.email}</p>}
                        {parent.phone && <p>Phone: {parent.phone}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No parents linked to this student.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Complaints Card - Role restricted */}
        {canSeeComplaints && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <CardTitle className="text-slate-100">Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              {complaints && complaints.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {complaints.map((complaint) => (
                    <div key={complaint.id} className="p-3 bg-slate-800 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-slate-100 font-medium text-sm">{complaint.title}</p>
                        <Badge
                          className={
                            complaint.severity === "high" ? "bg-red-900/50 text-red-400" :
                            complaint.severity === "medium" ? "bg-yellow-900/50 text-yellow-400" :
                            "bg-blue-900/50 text-blue-400"
                          }
                        >
                          {complaint.severity || "Low"}
                        </Badge>
                      </div>
                      <p className="text-slate-400 text-xs line-clamp-2">{complaint.description}</p>
                      {complaint.created_at && (
                        <p className="text-slate-500 text-xs mt-1">
                          {new Date(complaint.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No complaints recorded.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fees & Payments Card - Role restricted */}
        {canSeeFees && (
          <Card className="bg-slate-900 border-slate-700 lg:col-span-2">
            <CardHeader className="flex flex-row items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-slate-100">Fees & Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {fees && fees.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="py-2 text-left">Fee</th>
                        <th className="py-2 text-left">Amount</th>
                        <th className="py-2 text-left">Due Date</th>
                        <th className="py-2 text-left">Status</th>
                        <th className="py-2 text-left">Verified By</th>
                        <th className="py-2 text-left">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees.map((fee) => {
                        // Find payment for this fee
                        const payment = payments?.find(p => p.fee_id === fee.id);
                        
                        return (
                          <tr key={fee.id} className="border-b border-slate-800 text-slate-100">
                            <td className="py-2">{fee.title}</td>
                            <td className="py-2">NPR {fee.amount?.toLocaleString()}</td>
                            <td className="py-2">
                              {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : "-"}
                            </td>
                            <td className="py-2">
                              {payment ? (
                                <Badge
                                  className={
                                    payment.status === "verified" ? "bg-green-900/50 text-green-400" :
                                    payment.status === "rejected" ? "bg-red-900/50 text-red-400" :
                                    "bg-yellow-900/50 text-yellow-400"
                                  }
                                >
                                  {payment.status || "Pending"}
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-700 text-slate-400">Unpaid</Badge>
                              )}
                            </td>
                            <td className="py-2">
                              {payment?.verified_by ? (
                                <div className="text-xs">
                                  <p className="text-slate-300">
                                    {ROLE_LABELS[payment.verified_by_role] || payment.verified_by_role}
                                  </p>
                                  {payment.verified_at && (
                                    <p className="text-slate-500">
                                      {new Date(payment.verified_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="py-2">
                              {payment?.discount_amount ? (
                                <div className="text-xs">
                                  <p className="text-emerald-400">-NPR {payment.discount_amount?.toLocaleString()}</p>
                                  {payment.discount_reason && (
                                    <p className="text-slate-500">{payment.discount_reason}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No fees applicable to this student.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

