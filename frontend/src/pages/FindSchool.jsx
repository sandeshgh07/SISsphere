import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, School as SchoolIcon } from 'lucide-react';

const FindSchool = () => {
  const [schools, setSchools] = useState([]);
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const res = await api.get('/public/schools');
        setSchools(res.data);
        setFilteredSchools(res.data);
      } catch (err) {
        console.error("Failed to fetch schools", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchools();
  }, []);

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    const filtered = schools.filter(s =>
      s.name.toLowerCase().includes(lower) ||
      (s.slug && s.slug.toLowerCase().includes(lower))
    );
    setFilteredSchools(filtered);
  }, [searchTerm, schools]);

  const handleSelectSchool = (slug) => {
    navigate(`/school/${slug}/login`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-slate-900">Find Your School</h1>
          <p className="text-lg text-slate-600">Enter your school name or code to login</p>
        </div>

        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
          <Input
            className="pl-10 h-12 text-lg bg-white shadow-sm"
            placeholder="Search by school name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
            <div className="text-center py-12 text-slate-500">Loading schools...</div>
        ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSchools.map((school) => (
                <Card
                    key={school.id}
                    className="cursor-pointer hover:shadow-lg transition-all border-slate-200 hover:border-blue-300 group"
                    onClick={() => handleSelectSchool(school.slug)}
                >
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        {school.logo_url ? (
                            <img src={school.logo_url} alt={school.name} className="w-10 h-10 object-contain" />
                        ) : (
                            <SchoolIcon className="w-8 h-8 text-blue-600" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-slate-900">{school.name}</h3>
                        <p className="text-sm text-slate-500 uppercase tracking-wider font-medium">{school.slug}</p>
                    </div>
                </CardContent>
                </Card>
            ))}

            {filteredSchools.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500">
                    No schools found matching "{searchTerm}"
                </div>
            )}
            </div>
        )}

        <div className="text-center pt-8 border-t border-slate-200 mt-12">
            <p className="text-slate-500 mb-4">Are you a Super Admin?</p>
            <Button variant="outline" onClick={() => navigate('/admin/login')}>
                Admin Login
            </Button>
        </div>
      </div>
    </div>
  );
};

export default FindSchool;
