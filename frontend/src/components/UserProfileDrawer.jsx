import { useState, useEffect } from "react";
import axios from "axios";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Phone, Calendar, Briefcase, Award, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";

export function UserProfileDrawer({ userId, open, onOpenChange }) {
    const { accessToken } = useAuth();
    const API_BASE = import.meta.env.VITE_BACKEND_URL || "";
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && userId) {
            const fetchProfile = async () => {
                setLoading(true);
                try {
                    const res = await axios.get(`${API_BASE}/api/users/${userId}/profile`, {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    setProfile(res.data);
                } catch (error) {
                    console.error("Failed to load profile", error);
                    setProfile(null);
                } finally {
                    setLoading(false);
                }
            };
            fetchProfile();
        } else {
            setProfile(null);
        }
    }, [open, userId, accessToken]);

    if (!open) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:w-[500px] overflow-y-auto bg-slate-950 p-0 shadow-2xl border-l border-slate-800 text-slate-100">
                {/* Header */}
                <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-slate-100">User Profile</h2>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500 h-8 w-8" /></div>
                ) : profile ? (
                    <div className="pb-10">
                        {/* Identify Section */}
                        <div className="p-6 pb-0 flex flex-col items-center text-center">
                            <Avatar className="h-24 w-24 border-4 border-slate-800 shadow-xl mb-4">
                                <AvatarImage src={profile.photo_url} />
                                <AvatarFallback className="bg-blue-900 text-blue-300 font-bold text-3xl">
                                    {profile.first_name?.[0].toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <h1 className="text-2xl font-bold text-white">{profile.first_name} {profile.last_name}</h1>
                            <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs uppercase tracking-wider bg-slate-800 text-slate-400 border-slate-700">
                                    {profile.role}
                                </Badge>
                                {profile.is_active ? (
                                    <Badge className="bg-green-900/30 text-green-400 border-green-900 text-[10px]">Active</Badge>
                                ) : (
                                    <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="px-6 mt-8">
                            <Tabs defaultValue="details" className="w-full">
                                <TabsList className="w-full justify-start bg-slate-900 border-b border-slate-800 rounded-none h-auto p-0 mb-6">
                                    <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-transparent pb-3 px-4 transition-all">
                                        Overview
                                    </TabsTrigger>
                                    {profile.extended?.assignments && (
                                        <TabsTrigger value="assignments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-transparent pb-3 px-4 transition-all">
                                            Assignments
                                        </TabsTrigger>
                                    )}
                                    {profile.recent_activity && (
                                        <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-transparent pb-3 px-4 transition-all">
                                            Audit Log
                                        </TabsTrigger>
                                    )}
                                </TabsList>

                                <TabsContent value="details" className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                                            <div className="p-2 rounded bg-slate-800 text-slate-400"><Mail className="w-4 h-4" /></div>
                                            <div>
                                                <div className="text-xs text-slate-500 uppercase font-medium">Email</div>
                                                <div className="text-sm font-medium text-slate-200">{profile.email}</div>
                                            </div>
                                        </div>
                                        {profile.phone && (
                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                                                <div className="p-2 rounded bg-slate-800 text-slate-400"><Phone className="w-4 h-4" /></div>
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase font-medium">Phone</div>
                                                    <div className="text-sm font-medium text-slate-200">{profile.phone}</div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                                            <div className="p-2 rounded bg-slate-800 text-slate-400"><Calendar className="w-4 h-4" /></div>
                                            <div>
                                                <div className="text-xs text-slate-500 uppercase font-medium">Joined</div>
                                                <div className="text-sm font-medium text-slate-200">{new Date(profile.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {profile.extended?.stats && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center">
                                                <div className="text-2xl font-bold text-white">{profile.extended.stats.students_count || 0}</div>
                                                <div className="text-xs text-slate-500 uppercase mt-1">Students</div>
                                            </div>
                                            {/* Add more stats here if available */}
                                        </div>
                                    )}
                                </TabsContent>

                                {profile.extended?.assignments && (
                                    <TabsContent value="assignments" className="space-y-6">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Grades Taught</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.extended.assignments.grades.length > 0 ? (
                                                    profile.extended.assignments.grades.map(g => (
                                                        <Badge key={g.id} variant="secondary" className="bg-slate-800 text-slate-300 hover:bg-slate-700">
                                                            {g.name}
                                                        </Badge>
                                                    ))
                                                ) : <span className="text-slate-500 text-sm italic">None assigned</span>}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Subjects</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.extended.assignments.subjects.length > 0 ? (
                                                    profile.extended.assignments.subjects.map(s => (
                                                        <Badge key={s.id} variant="outline" className="border-slate-700 text-slate-400">
                                                            {s.name}
                                                        </Badge>
                                                    ))
                                                ) : <span className="text-slate-500 text-sm italic">None assigned</span>}
                                            </div>
                                        </div>
                                    </TabsContent>
                                )}

                                {profile.recent_activity && (
                                    <TabsContent value="activity">
                                        <div className="space-y-4 relative pl-4 border-l border-slate-800 ml-2">
                                            {profile.recent_activity.map(log => (
                                                <div key={log.id} className="relative">
                                                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-800 border-2 border-slate-950" />
                                                    <div className="text-sm text-slate-300 font-medium">{log.action} <span className="text-slate-500 font-normal">on {log.entity}</span></div>
                                                    <div className="text-xs text-slate-600 mt-0.5">{new Date(log.timestamp).toLocaleString()}</div>
                                                    <div className="text-xs text-slate-500 mt-1 italic">{log.summary}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </TabsContent>
                                )}
                            </Tabs>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 text-center text-slate-500">Profile not found.</div>
                )}
            </SheetContent>
        </Sheet>
    );
}
