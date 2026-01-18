import React, { useState, useEffect } from 'react';
import { QrReader } from 'react-qr-reader';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const GuardScanner = () => {
  const [data, setData] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const { user } = useAuth();

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
        if (data === result?.text) return; // Debounce
        setData(result?.text);

        try {
            const token = result?.text;
            const res = await axios.post('/api/attendance/gate/scan', { token });
            setScanResult(res.data);
            setError(null);
            fetchHistory();
            toast.success(`Scanned: ${res.data.student_name}`);

            setTimeout(() => {
                setData(null);
                setScanResult(null);
            }, 3000);

        } catch (err) {
            console.error(err);
            if (err.response?.status === 403 && err.response?.data?.detail?.includes("BLOCKED")) {
                setError({ type: 'BLOCKED', message: err.response.data.detail });
            } else {
                setError({ type: 'ERROR', message: err.response?.data?.detail || "Scan Failed" });
            }
            setTimeout(() => {
                setData(null);
                setError(null);
            }, 3000);
        }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col">
       {/* Camera View */}
       <div className="flex-1 w-full relative overflow-hidden bg-gray-900">
            <QrReader
                onResult={handleScan}
                constraints={{ facingMode: 'environment' }}
                className="w-full h-full object-cover"
                scanDelay={500}
                videoContainerStyle={{ height: '100%', paddingTop: 0 }}
                videoStyle={{ objectFit: 'cover' }}
            />
       </div>

       {/* Overlay for Feedback */}
       {(scanResult || error) && (
           <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300
                ${scanResult ? 'bg-green-600/90' : error?.type === 'BLOCKED' ? 'bg-[#5C2438]' : 'bg-red-600/90'}
           `}>
                {scanResult && (
                    <>
                        <div className="text-6xl mb-4">✅</div>

                        <div className="flex items-center justify-center gap-8 mb-6">
                            <div className="flex flex-col items-center">
                                {scanResult.student_photo_url || scanResult.photo_url ? (
                                    <img src={scanResult.student_photo_url || scanResult.photo_url} alt="Student" className="w-32 h-32 aspect-square rounded-full object-cover border-4 border-white shadow-xl" />
                                ) : (
                                    <div className="w-32 h-32 aspect-square rounded-full bg-white/20 border-4 border-white flex items-center justify-center text-4xl">🎓</div>
                                )}
                                <span className="mt-2 font-semibold text-sm uppercase tracking-wide opacity-80">Student</span>
                            </div>

                            {scanResult.parent_photo_url && (
                                <div className="flex flex-col items-center animate-in zoom-in slide-in-from-right duration-500">
                                    <img src={scanResult.parent_photo_url} alt="Guardian" className="w-32 h-32 aspect-square rounded-full object-cover border-4 border-white shadow-xl" />
                                    <span className="mt-2 font-semibold text-sm uppercase tracking-wide opacity-80">Guardian</span>
                                </div>
                            )}
                        </div>

                        <h1 className="text-4xl font-bold mb-2">{scanResult.student_name}</h1>
                        {scanResult.parent_name && (
                            <p className="text-lg opacity-90 mb-2">Picked up by: <span className="font-bold">{scanResult.parent_name}</span></p>
                        )}
                        <p className="text-2xl uppercase tracking-widest">{scanResult.action}</p>
                        <p className="mt-4 text-xl opacity-80">{new Date(scanResult.timestamp).toLocaleTimeString()}</p>
                    </>
                )}

                {error && error.type === 'BLOCKED' && (
                    <>
                        <div className="text-6xl mb-4">🛑</div>
                        <h1 className="text-4xl font-bold mb-2">STOP</h1>
                        <h2 className="text-2xl font-bold mb-6">REDIRECT TO OFFICE</h2>
                        <div className="bg-white/20 p-4 rounded-lg">
                            <p className="text-xl font-mono">{error.message}</p>
                        </div>
                    </>
                )}

                {error && error.type !== 'BLOCKED' && (
                    <>
                        <div className="text-6xl mb-4">⚠️</div>
                        <h1 className="text-2xl font-bold">{error.message}</h1>
                    </>
                )}
           </div>
       )}

       {/* Controls */}
       <div className="absolute bottom-10 left-0 right-0 px-6 flex justify-between items-center z-40 pointer-events-none">
            <div className="bg-black/50 p-2 rounded-lg backdrop-blur pointer-events-auto">
                <p className="text-xs text-gray-300">Guard: {user?.first_name}</p>
            </div>
            <button
                onClick={() => setShowHistory(true)}
                className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform pointer-events-auto"
            >
                Recent Scans
            </button>
       </div>

       {/* History Drawer */}
       {showHistory && (
           <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col animate-in slide-in-from-bottom duration-200">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800">
                   <h2 className="text-xl font-bold">Recent Exits</h2>
                   <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white px-4 py-2">Close</button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                   {history.map((item, idx) => (
                       <div key={idx} className="bg-gray-800 p-3 rounded flex justify-between items-center border border-gray-700">
                           <div>
                               <p className="font-bold text-lg">{item.student_name}</p>
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
