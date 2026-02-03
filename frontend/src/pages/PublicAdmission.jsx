import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react';

const PublicAdmission = () => {
    const { school_uuid } = useParams();
    const [searchParams] = useSearchParams();
    const source = searchParams.get('source') || 'direct';

    const [formData, setFormData] = useState({
        first_name: '', last_name: '', parent_phone: '', age: '',
        target_grade: '', completed_grade: '', previous_school: '',
        parent_name: '', email: '',
        terms: false
    });
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.terms) return setError("Please accept terms.");
        setStatus('submitting');

        const data = new FormData();
        Object.keys(formData).forEach(k => {
            if (k !== 'terms') data.append(k, formData[k]);
        });
        data.append('source', source);
        if (file) data.append('transcript', file);

        try {
            const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
            const res = await fetch(`${baseUrl}/api/public/admissions/${school_uuid}`, {
                method: 'POST',
                body: data
            });
            if (!res.ok) {
                if (res.status === 429) throw new Error("Too many requests. Please try again later.");
                const json = await res.json();
                throw new Error(json.detail || "Submission failed");
            }
            setStatus('success');
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md w-full">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-sissphere-primary mb-2">Application Received</h2>
                    <p className="text-gray-600">We have received your application. We will contact you shortly.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
                <h1 className="text-3xl font-bold text-sissphere-primary mb-6">Admission Application</h1>
                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded mb-6 flex items-center gap-2">
                        <AlertTriangle size={20} /> {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First Name</label>
                            <input id="first_name" required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, first_name: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">Last Name</label>
                            <input id="last_name" required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, last_name: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
                            <input id="age" required type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, age: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="target_grade" className="block text-sm font-medium text-gray-700">Target Grade</label>
                            <input id="target_grade" required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, target_grade: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="previous_school" className="block text-sm font-medium text-gray-700">Previous School</label>
                            <input id="previous_school" type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, previous_school: e.target.value})} />
                        </div>
                         <div>
                            <label htmlFor="completed_grade" className="block text-sm font-medium text-gray-700">Completed Grade</label>
                            <input id="completed_grade" type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, completed_grade: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="parent_name" className="block text-sm font-medium text-gray-700">Parent Name</label>
                            <input id="parent_name" required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, parent_name: e.target.value})} />
                        </div>
                        <div>
                            <label htmlFor="parent_phone" className="block text-sm font-medium text-gray-700">Parent Contact</label>
                            <input id="parent_phone" required type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, parent_phone: e.target.value})} />
                        </div>
                         <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Optional)</label>
                            <input id="email" type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sissphere-primary focus:ring-sissphere-primary"
                                onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <label className="cursor-pointer">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <span className="mt-2 block text-sm font-medium text-gray-900">Upload Transcript (PDF, JPG, PNG)</span>
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} required />
                        </label>
                        {file && <p className="mt-2 text-sm text-gray-600">{file.name}</p>}
                    </div>

                    <div className="flex items-start">
                        <div className="flex h-5 items-center">
                            <input id="terms" type="checkbox" className="h-4 w-4 rounded border-gray-300 text-sissphere-primary focus:ring-sissphere-primary"
                                checked={formData.terms} onChange={e => setFormData({...formData, terms: e.target.checked})} required />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="terms" className="font-medium text-gray-700">I agree to the Terms and Privacy Policy</label>
                        </div>
                    </div>

                    <button type="submit" disabled={status === 'submitting'}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sissphere-primary hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sissphere-primary disabled:opacity-50">
                        {status === 'submitting' ? 'Submitting...' : 'Submit Application'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PublicAdmission;
