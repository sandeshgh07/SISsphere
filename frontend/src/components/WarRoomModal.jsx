import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert } from 'lucide-react';

const ROLES = [
  { value: "super_admin", label: "School Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent" },
  { value: "INACTIVE", label: "INACTIVE (Termination)" },
];

const WarRoomModal = ({ open, onClose, user, onConfirm, loading }) => {
  const [newRole, setNewRole] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!newRole) {
      setError("Please select a new role.");
      return;
    }
    if (justification.length < 20) {
      setError("Justification must be at least 20 characters.");
      return;
    }
    setError("");
    onConfirm(user.id, newRole, justification);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#5C2438] text-white border-none max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
             <ShieldAlert className="h-8 w-8 text-yellow-400" />
             <DialogTitle className="text-2xl font-bold tracking-tight text-white">CRITICAL SECURITY ACTION</DialogTitle>
          </div>
          <DialogDescription className="text-gray-200 text-base">
            You are modifying executive-level permissions for <span className="font-bold text-white">{user?.full_name}</span>.
            <br />
            <span className="font-bold text-yellow-300">Warning:</span> All session tokens for this user will be invalidated immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <Label className="text-gray-200">New Status / Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger className="bg-[#4a1d2d] border-gray-500 text-white">
                        <SelectValue placeholder="Select new role" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#4a1d2d] border-gray-500 text-white">
                        {ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value} className="focus:bg-[#6d2b42] focus:text-white">
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="text-gray-200">Justification (Mandatory)</Label>
                <Textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Explain why this role change is necessary (min 20 chars)..."
                    className="bg-[#4a1d2d] border-gray-500 text-white h-32"
                />
                <div className="text-xs text-gray-300 flex justify-end">
                    {justification.length} / 20 characters
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-300 bg-red-900/30 p-2 rounded">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                </div>
            )}
        </div>

        <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} className="border-gray-400 text-gray-200 hover:bg-[#6d2b42] hover:text-white bg-transparent">
                Cancel
            </Button>
            <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white border-none font-semibold"
            >
                {loading ? "Processing..." : "CONFIRM EXECUTIVE CHANGE"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WarRoomModal;
