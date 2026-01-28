
import React, { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Calendar, Shield, User, MapPin } from 'lucide-react';
import axios from 'axios';
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

export default function StaffUserProfile({ userId, initialData, onClose }) {
    const { accessToken } = useAuth();
    const [user, setUser] = useState(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState(null);

    useEffect(() => {
        // If we have an ID but no data (or want to refresh), fetch it
        // If userId is missing, we can't fetch.
        if ((userId && !initialData) || (userId && initialData && initialData.id !== userId)) {
            setLoading(true);
            setError(null);
            axios.get(`${API_BASE}/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
                .then(res => {
                    setUser(res.data);
                })
                .catch(err => {
                    console.error("Failed to load user profile", err);
                    setError("Failed to load profile data.");
                })
                .finally(() => setLoading(false));
        } else if (initialData) {
            setUser(initialData);
            setLoading(false);
        }
    }, [userId, initialData, accessToken]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="text-slate-400 animate-pulse">Loading profile...</div>
            </div>
        );
    }

    if (error || !user) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-red-400 gap-2">
                <Shield className="h-8 w-8 opacity-50" />
                <p>{error || "User not found"}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 py-6 text-slate-900">
            {/* Header Section */}
            <div className="flex flex-col items-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center shadow-sm">
                    <User className="h-10 w-10 text-slate-500" />
                </div>
                <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold text-slate-900">{user.full_name}</h2>
                    <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline" className={`
              ${user.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}
            `}>
                            {user.is_active ? 'Active Account' : 'Inactive'}
                        </Badge>
                    </div>
                </div>
            </div>

            <Separator className="bg-slate-200" />

            {/* Contact Details */}
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest pl-1">Contact Information</h3>

                <div className="bg-slate-50 rounded-lg p-4 space-y-4 border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                            <Mail className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500">Email Address</p>
                            <p className="text-sm font-medium text-slate-900">{user.email}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                            <Phone className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500">Phone Number</p>
                            <p className="text-sm font-medium text-slate-900">{user.phone || "Not provided"}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500">Joined On</p>
                            <p className="text-sm font-medium text-slate-900">
                                {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, {
                                    year: 'numeric', month: 'long', day: 'numeric'
                                }) : "-"}
                            </p>
                        </div>
                    </div>

                    {user.school_country && (
                        <div className="flex items-center gap-4">
                            <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                                <MapPin className="h-4 w-4 text-red-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-slate-500">Location</p>
                                <p className="text-sm font-medium text-slate-900">{user.school_country}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Separator className="bg-slate-200" />

            {/* Permissions / Roles */}
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-widest pl-1">System Access</h3>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex flex-wrap gap-2">
                        {user.roles && user.roles.length > 0 ? (
                            user.roles.map(role => (
                                <Badge key={role} variant="secondary" className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100">
                                    {role.replace('_', ' ').toUpperCase()}
                                </Badge>
                            ))
                        ) : (
                            <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-700">
                                {user.role?.replace('_', ' ').toUpperCase()}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
