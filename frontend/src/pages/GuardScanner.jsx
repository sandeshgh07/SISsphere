import React, { useState, useEffect } from 'react';
import { QrReader } from 'react-qr-reader';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { QrCode, ShieldCheck, ShieldAlert, BadgeCheck, XCircle } from 'lucide-react';

const GuardScanner = () => {
    const [data, setData] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [processing, setProcessing] = useState(false); // Processing confirmation
    const { user } = useAuth();

    // Auto-fetch history
    const fetchHistory = async () => {
        try {
            const res = await axios.get('/api/attendance/gate/history');
            setHistory(res.data);
        } catch (err) {
            console.error("Failed to fetch history");
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleScan = async (result, error) => {
        if (result) {
            if (data === result?.text) return; // Debounce same text
            setData(result?.text);

            try {
                const token = result?.text;
                // Step 1: Verify
                const res = await axios.post('/api/attendance/gate/verify', { token });
                setScanResult(res.data);
                setError(null);

                // If it's normal and valid, we show "Confirm" UI rather than auto-confirm?
                // Plan said: "Guard must confirm 'Allow exit'".
                // So now we just show the result, and wait for Guard interaction.

            } catch (err) {
                console.error(err);
                if (err.response?.status === 403 && err.response?.data?.detail?.includes("BLOCKED")) {
                    setError({ type: 'BLOCKED', message: err.response.data.detail });
                } else if (err.response?.data?.detail?.includes("Expired")) {
                    setError({ type: 'EXPIRED', message: "PASS EXPIRED" });
                } else {
                    setError({ type: 'ERROR', message: err.response?.data?.detail || "Invalid Pass" });
                }

                // Clear error after delay to allow re-scan
                setTimeout(() => {
                    setData(null);
                    setError(null);
                }, 3000);
            }
        }
    };

    const confirmExit = async () => {
        if (!scanResult) return;
        setProcessing(true);
        try {
            await axios.post('/api/attendance/gate/confirm-scan', { pass_id: scanResult.pass_id });
            toast.success("Exit Confirmed");
            fetchHistory();
            setScanResult(null);
            setData(null);
        } catch (err) {
            toast.error("Failed to confirm exit");
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    const cancelScan = () => {
        setScanResult(null);
        setData(null);
    };

    return (
        <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
            {/* Top Half: Camera */}
            <div className={`${scanResult ? 'h-1/3' : 'h-1/2'} w-full relative bg-gray-900 border-b-4 border-sissphere-primary transition-all duration-300`}>
                <QrReader
                    onResult={handleScan}
                    constraints={{ facingMode: 'environment' }}
                    className="w-full h-full object-cover"
                    scanDelay={500}
                    videoContainerStyle={{ height: '100%', paddingTop: 0 }}
                    videoStyle={{ objectFit: 'cover' }}
                />
                {!scanResult && (
                    <div className="absolute top-4 left-0 right-0 text-center pointer-events-none">
                        <span className="bg-black/60 text-white px-4 py-1 rounded-full text-sm font-medium backdrop-blur">
                            Align QR Code with Camera
                        </span>
                    </div>
                )}
            </div>

            {/* Bottom Half: Info & Status */}
            <div className={`${scanResult ? 'h-2/3' : 'h-1/2'} w-full bg-gray-900 flex flex-col relative transition-all duration-300`}>

                {/* Waiting State */}
                {!scanResult && !error && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center animate-pulse">
                            <QrCode size={32} />
                        </div>
                        <p className="font-medium animate-pulse">Waiting for scan...</p>
                        <button
                            onClick={() => setShowHistory(true)}
                            className="bg-gray-800 text-white px-6 py-2 rounded-full font-bold shadow active:scale-95 transition-transform"
                        >
                            Recent Scans
                        </button>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300 ${error.type === 'BLOCKED' ? 'bg-[#5C2438] text-white' : 'bg-red-600/20 text-red-500'}`}>
                        {error.type === 'BLOCKED' ? (
                            <>
                                <div className="text-5xl mb-2">🛑</div>
                                <h2 className="text-3xl font-bold uppercase mb-2">Access Denied</h2>
                                <p className="text-xl font-mono bg-black/30 px-4 py-2 rounded">{error.message}</p>
                            </>
                        ) : (
                            <>
                                <div className="text-5xl mb-2">⚠️</div>
                                <h2 className="text-2xl font-bold">{error.message}</h2>
                            </>
                        )}
                    </div>
                )}

                {/* Success / Verification State */}
                {scanResult && (
                    <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-bottom duration-500 bg-gray-800 text-white overflow-y-auto">

                        {/* Status Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    {scanResult.pass_type === 'SUPER' ? (
                                        <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-bold tracking-widest flex items-center gap-1">
                                            <ShieldAlert className="w-3 h-3" /> SUPER PASS
                                        </span>
                                    ) : (
                                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest flex items-center gap-1">
                                            <BadgeCheck className="w-3 h-3" /> VERIFIED
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-3xl font-bold text-white leading-tight">{scanResult.student_name}</h2>
                                {scanResult.student_grade && (
                                    <p className="text-gray-400 font-medium">{scanResult.student_grade}</p>
                                )}
                            </div>
                        </div>

                        {/* Details Card */}
                        <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50 mb-6 space-y-4">
                            {/* SuperPass Reason */}
                            {scanResult.pass_type === 'SUPER' && (
                                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                                    <p className="text-amber-500 text-xs font-bold uppercase mb-1">Override Reason</p>
                                    <p className="text-amber-100 font-medium text-sm">"{scanResult.reason}"</p>
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                {scanResult.student_photo ? (
                                    <img src={scanResult.student_photo} className="w-16 h-16 rounded-full bg-black object-cover" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-2xl">🎓</div>
                                )}
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Issued By</p>
                                    <p className="font-medium text-sm">{scanResult.issuer_name}</p>
                                    <p className="text-xs text-gray-400">{scanResult.issuer_role.replace('_', ' ')}</p>
                                </div>
                            </div>

                            {scanResult.sent_with && (
                                <div className="pt-2 border-t border-gray-600/50">
                                    <p className="text-xs text-gray-500 uppercase mb-1">Sent With</p>
                                    <p className="font-medium text-lg">{scanResult.sent_with}</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-auto grid grid-cols-2 gap-4">
                            <button
                                onClick={cancelScan}
                                className="w-full py-4 rounded-xl font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <XCircle className="w-5 h-5" /> Cancel
                            </button>
                            <button
                                onClick={confirmExit}
                                disabled={processing}
                                className={`w-full py-4 rounded-xl font-bold text-black transition-colors flex items-center justify-center gap-2 shadow-lg ${scanResult.pass_type === 'SUPER' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-green-500 hover:bg-green-400'
                                    }`}
                            >
                                {processing ? 'Confirming...' : (
                                    <>
                                        <ShieldCheck className="w-5 h-5" /> Allow Exit
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Guard Info Footer */}
                <div className="p-2 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500 bg-gray-950">
                    <span>Guard: {user?.first_name}</span>
                    <span>{new Date().toLocaleDateString()}</span>
                </div>
            </div>

            {/* History Drawer Overlay */}
            {showHistory && (
                <div className="absolute inset-x-0 bottom-0 h-3/4 z-50 bg-gray-900 flex flex-col animate-in slide-in-from-bottom duration-200 rounded-t-2xl shadow-2xl border-t border-gray-700">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800 rounded-t-2xl">
                        <h2 className="text-xl font-bold text-white">Recent Exits</h2>
                        <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white px-4 py-2">Close</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {history.map((item, idx) => (
                            <div key={idx} className="bg-gray-800 p-3 rounded flex justify-between items-center border border-gray-700">
                                <div>
                                    <p className="font-bold text-lg text-white">{item.student_name}</p>
                                    <p className="text-xs text-gray-400">Scanned by {item.scanned_by}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-bold ${item.action === 'CHECKIN' ? 'text-blue-400' : 'text-orange-400'}`}>{item.action}</p>
                                    <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuardScanner;
