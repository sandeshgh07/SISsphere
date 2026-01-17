import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const NoticeFeed = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, ACADEMIC, FINANCE, URGENT

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const response = await api.get('/notices/feed');
      setNotices(response.data);
    } catch (error) {
      console.error("Failed to fetch notices", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotices = notices.filter(n => {
    if (filter === 'ALL') return true;
    return n.type === filter;
  });

  const getBadgeVariant = (type) => {
    switch (type) {
      case 'URGENT': return 'destructive';
      case 'FINANCE': return 'default';
      case 'ACADEMIC': return 'secondary';
      default: return 'outline';
    }
  };

  // Custom class for 'New' badge or if we want to override colors dynamically
  const getBadgeClass = (type) => {
     if (type === 'URGENT' || type === 'NEW') return "bg-nepsis-alert hover:bg-nepsis-alert/90 text-white border-0";
     return "";
  }

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex space-x-2 overflow-x-auto pb-2">
        <Button variant={filter === 'ALL' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('ALL')}>All</Button>
        <Button variant={filter === 'ACADEMIC' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('ACADEMIC')}>Academic</Button>
        <Button variant={filter === 'FINANCE' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('FINANCE')}>Finance</Button>
        <Button variant={filter === 'URGENT' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('URGENT')}>Urgent</Button>
      </div>

      <div className="space-y-3">
        {filteredNotices.length === 0 && <p className="text-center text-muted-foreground">No notices found.</p>}
        {filteredNotices.map((notice) => (
          <Card key={notice.id} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                   {notice.title}
                   {/* Mock logic for 'New' - ideally based on read status or date */}
                   {new Date(notice.created_at) > new Date(Date.now() - 86400000) && (
                      <Badge className="bg-nepsis-alert hover:bg-nepsis-alert/90 text-white border-0 text-[10px] px-1.5 py-0 h-5">NEW</Badge>
                   )}
                </CardTitle>
                <Badge variant={getBadgeVariant(notice.type)}>{notice.type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(notice.created_at).toLocaleDateString()}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{notice.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default NoticeFeed;
