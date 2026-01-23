import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Users } from 'lucide-react';

const ChildSwitcher = ({ children, selectedChildId, onSelect }) => {
    if (!children || children.length === 0) return null;

    return (
        <div className="px-4 py-2">
            <label className="text-xs text-gray-400 mb-1 block uppercase font-bold tracking-wider">
                My Children
            </label>
            <Select value={selectedChildId || "overview"} onValueChange={onSelect}>
                <SelectTrigger className="w-full bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="overview">
                        <div className="flex items-center gap-2">
                            <Users size={16} />
                            <span>All Children (Overview)</span>
                        </div>
                    </SelectItem>
                    {children.map(child => (
                        <SelectItem key={child.student_id} value={child.student_id}>
                            <div className="flex items-center gap-2">
                                <User size={16} />
                                <span>{child.student_name}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

export default ChildSwitcher;
