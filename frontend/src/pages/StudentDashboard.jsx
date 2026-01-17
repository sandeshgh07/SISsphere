import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, AlertCircle, CalendarOff, TrendingUp } from 'lucide-react';
import GatePass from '../components/GatePass';

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/analytics/student-health');
      setData(response.data);
    } catch (err) {
      console.error("Failed to fetch student health", err);
      setError("Could not load student data.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;

  // Handle case where API returns error message in state or if data is missing
  if (error || !data || !data.student_info) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="bg-red-100 p-4 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Unable to load dashboard</h2>
            <p className="text-gray-600 max-w-sm">{error || "No student profile linked to your account."}</p>
        </div>
      );
  }

  const { student_info, academic_trend, attendance_heatmap, progress_level } = data;

  const renderHeatmap = () => {
      if (!attendance_heatmap || attendance_heatmap.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
                <CalendarOff className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No attendance records yet.</p>
            </div>
          );
      }

      return (
          <div className="flex flex-wrap gap-1 content-start">
              {attendance_heatmap.map((day, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-sm transition-colors duration-200 ${
                        day.value === 1 ? 'bg-green-500 hover:bg-green-600' :
                        day.value === 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                    title={`${day.date}: ${day.status}`}
                  />
              ))}
          </div>
      );
  };

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{student_info.name}</h1>
            <GatePass studentId={student_info.id} studentName={student_info.name} />
        </div>
        {progress_level && (
            <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border">
                <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Progress</p>
                    <div className={`text-lg font-bold ${progress_level.label === 'Critical' ? 'text-red-600' : 'text-green-600'}`}>
                        {progress_level.label}
                    </div>
                </div>
                {/* Visual Indicator Ring or Icon could go here */}
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Academic Progress */}
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-600" />
                    Academic Progress
                </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
                {academic_trend && academic_trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={academic_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="term" tick={{fontSize: 12}} />
                            <YAxis domain={[0, 100]} tick={{fontSize: 12}} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line type="monotone" dataKey="average" stroke="#003333" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-gray-50 rounded-lg border border-dashed">
                        <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">No exam data recorded yet.</p>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* Attendance Heatmap */}
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                    Attendance (Last 30 Days)
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="min-h-[100px]">
                    {renderHeatmap()}
                 </div>
                 <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
                     <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                        <span>Present</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                        <span>Absent</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-gray-200 rounded-sm"></div>
                        <span>No Class</span>
                     </div>
                 </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
