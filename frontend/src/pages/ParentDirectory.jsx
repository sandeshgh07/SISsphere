import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Users, User, GraduationCap, Briefcase } from 'lucide-react';

const ParentDirectory = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ students: [], parents: [], staff: [], allowed_grades: [] });
    const [selectedGrade, setSelectedGrade] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("students");

    const fetchData = async (gradeId = null) => {
        setLoading(true);
        try {
            const params = {};
            if (gradeId && gradeId !== "all") params.grade_id = gradeId;

            const res = await api.get('/parents/me/directory', { params });
            setData(res.data);
        } catch (error) {
            console.error("Failed to fetch directory:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedGrade === "all" ? null : selectedGrade);
    }, [selectedGrade]);

    // Filter logic
    const filterList = (list) => {
        if (!searchQuery) return list;
        const lower = searchQuery.toLowerCase();
        return list.filter(item =>
            item.name.toLowerCase().includes(lower) ||
            (item.role && item.role.toLowerCase().includes(lower)) ||
            (item.title && item.title.toLowerCase().includes(lower)) ||
            (item.grade_name && item.grade_name.toLowerCase().includes(lower))
        );
    };

    const students = filterList(data.students || []);
    const parents = filterList(data.parents || []);
    const staff = filterList(data.staff || []);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="text-sissphere-primary" />
                        School Directory
                    </h2>
                    <p className="text-sm text-gray-500">
                        View students and parents from your child's grade(s) and all school staff.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Grade Filter */}
                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Grade" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All My Grades</SelectItem>
                            {data.allowed_grades?.map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search name..."
                            className="pl-9 w-[200px] md:w-[250px]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <Tabs defaultValue="students" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
                    <TabsTrigger value="students" className="flex items-center gap-2">
                        <GraduationCap size={16} /> Students ({students.length})
                    </TabsTrigger>
                    <TabsTrigger value="parents" className="flex items-center gap-2">
                        <User size={16} /> Parents ({parents.length})
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="flex items-center gap-2">
                        <Briefcase size={16} /> Staff ({staff.length})
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    {loading ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="animate-spin text-sissphere-primary" size={32} />
                        </div>
                    ) : (
                        <>
                            {/* STUDENTS TAB */}
                            <TabsContent value="students" className="space-y-4">
                                {students.length === 0 ? (
                                    <EmptyState message="No students found." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {students.map(student => (
                                            <Card key={student.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <Avatar className="h-12 w-12 border">
                                                        <AvatarImage src={student.photo_url} />
                                                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h3 className="font-semibold">{student.name}</h3>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                                            <Badge variant="secondary" className="text-xs font-normal">
                                                                {student.grade_name}
                                                            </Badge>
                                                            {student.section && (
                                                                <span className="text-xs border px-1.5 rounded bg-gray-50">
                                                                    Sec {student.section}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* PARENTS TAB */}
                            <TabsContent value="parents" className="space-y-4">
                                {parents.length === 0 ? (
                                    <EmptyState message="No parents found." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {parents.map(parent => (
                                            <Card key={parent.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-4 mb-3">
                                                        <Avatar className="h-12 w-12 border">
                                                            <AvatarImage src={parent.photo_url} />
                                                            <AvatarFallback>{parent.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <h3 className="font-semibold">{parent.name}</h3>
                                                            <span className="text-xs text-gray-400 uppercase font-medium">Parent</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-50 p-2 rounded text-sm text-gray-600">
                                                        <p className="text-xs text-gray-400 mb-1">Parent of:</p>
                                                        <ul className="list-disc list-inside">
                                                            {parent.linked_students.map(child => (
                                                                <li key={child.id} className="truncate">
                                                                    {child.name} <span className="text-gray-400">({child.grade_name})</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* STAFF TAB */}
                            <TabsContent value="staff" className="space-y-4">
                                {staff.length === 0 ? (
                                    <EmptyState message="No staff members found." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {staff.map(member => (
                                            <Card key={member.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <Avatar className="h-12 w-12 border">
                                                        <AvatarImage src={member.photo_url} />
                                                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h3 className="font-semibold">{member.name}</h3>
                                                        <Badge className="bg-sissphere-primary/10 text-sissphere-primary hover:bg-sissphere-primary/20 border-none">
                                                            {member.title || member.role}
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </>
                    )}
                </div>
            </Tabs>
        </div>
    );
};

const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 bg-gray-50/50 rounded-lg border border-dashed">
        <Users className="w-12 h-12 mb-3 text-gray-300" />
        <p>{message}</p>
    </div>
);

export default ParentDirectory;
