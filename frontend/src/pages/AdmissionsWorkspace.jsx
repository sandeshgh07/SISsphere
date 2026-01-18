import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, UserPlus } from 'lucide-react';

const AdmissionsWorkspace = () => {
    const { user } = useAuth();
    const [applications, setApplications] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedApp, setSelectedApp] = useState(null);
    const [modalAction, setModalAction] = useState(null);

    const fetchApplications = async () => {
        try {
            const res = await api.get(`/admissions?status=${statusFilter}`);
            setApplications(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchApplications();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const handleAction = async () => {
        if (!selectedApp || !modalAction) return;

        try {
            if (modalAction === 'ENROLL') {
                await api.post(`/admissions/${selectedApp.id}/enroll`);
            } else {
                const formData = new FormData();
                formData.append('status', modalAction);
                await api.post(`/admissions/${selectedApp.id}/eligibility`, formData);
            }
            fetchApplications();
            setSelectedApp(null);
            setModalAction(null);
        } catch (error) {
            alert("Action failed: " + (error.response?.data?.detail || error.message));
        }
    };

    if (!['principal', 'accountant'].includes(user?.role)) {
        return <div className="p-8">Access Denied</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-nepsis-primary">Admissions Workspace</h2>
                <div className="flex gap-2">
                    {['APPLIED', 'ELIGIBLE', 'INELIGIBLE', 'ENROLLED'].map(s => (
                        <Button key={s} variant={statusFilter === s ? "default" : "outline"}
                            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                            className={statusFilter === s ? "bg-nepsis-primary text-white" : ""}>
                            {s}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4">
                {applications.map(app => (
                    <Card key={app.id}>
                        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-semibold text-lg">{app.first_name} {app.last_name}</h3>
                                <p className="text-sm text-gray-500">Target Grade: {app.target_grade} | Age: {app.age}</p>
                                <p className="text-sm text-gray-500">Parent: {app.parent_name} ({app.parent_phone})</p>
                                <a href={app.transcript_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline">View Transcript</a>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold
                                    ${app.status === 'APPLIED' ? 'bg-yellow-100 text-yellow-800' :
                                      app.status === 'ELIGIBLE' ? 'bg-green-100 text-green-800' :
                                      app.status === 'INELIGIBLE' ? 'bg-red-100 text-red-800' :
                                      'bg-blue-100 text-blue-800'}`}>
                                    {app.status}
                                </span>

                                {app.status === 'APPLIED' && (
                                    <>
                                        <Button size="sm" className="bg-[#003333] hover:bg-[#004444] text-white"
                                            onClick={() => { setSelectedApp(app); setModalAction('ELIGIBLE'); }}>
                                            <Check size={16} className="mr-1" /> Eligible
                                        </Button>
                                        <Button size="sm" className="bg-[#5C2438] hover:bg-[#7a304a] text-white"
                                            onClick={() => { setSelectedApp(app); setModalAction('INELIGIBLE'); }}>
                                            <X size={16} className="mr-1" /> Ineligible
                                        </Button>
                                    </>
                                )}

                                {app.status === 'ELIGIBLE' && (
                                    <Button size="sm" className="bg-[#003333] text-white"
                                        onClick={() => { setSelectedApp(app); setModalAction('ENROLL'); }}>
                                        <UserPlus size={16} className="mr-1" /> Enroll
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {selectedApp && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg max-w-sm w-full">
                        <h3 className="text-lg font-bold mb-4">Confirm Action</h3>
                        <p>Are you sure you want to mark <b>{selectedApp.first_name}</b> as <b>{modalAction}</b>?</p>
                        {modalAction === 'ELIGIBLE' && <p className="text-sm text-gray-500 mt-2">This will send an email to the parent inviting them for enrollment.</p>}
                        {modalAction === 'ENROLL' && <p className="text-sm text-gray-500 mt-2">This will create a Student record, User account, and send credentials.</p>}

                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setSelectedApp(null)}>Cancel</Button>
                            <Button className={modalAction === 'INELIGIBLE' ? "bg-[#5C2438] hover:bg-[#7a304a] text-white" : "bg-[#003333] hover:bg-[#004444] text-white"} onClick={handleAction}>Confirm</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdmissionsWorkspace;
