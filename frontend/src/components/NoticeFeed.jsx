import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const NoticeFeed = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, CRITICAL, IMPORTANT, NORMAL

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      console.log("Fetching notices...");
      const response = await api.get('/notices/feed');
      console.log("Notices fetched:", response.data);
      setNotices(response.data);
    } catch (error) {
      console.error("Failed to fetch notices", error);
      // toast.error("Could not load notices"); // Assuming toast is available via props or context, or import sonner
    } finally {
      setLoading(false);
    }
  };

  const filteredNotices = notices.filter(n => {
    if (filter === 'ALL') return true;
    return n.priority === filter;
  });

  const getBadgeVariant = (priority) => {
    switch (priority) {
      case 'CRITICAL': return 'destructive';
      case 'IMPORTANT': return 'default'; // or something distinct
      case 'NORMAL': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex space-x-2 overflow-x-auto pb-2">
        <Button variant={filter === 'ALL' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('ALL')}>All</Button>
        <Button variant={filter === 'CRITICAL' ? 'destructive' : 'outline'} size="sm" onClick={() => setFilter('CRITICAL')}>Critical</Button>
        <Button variant={filter === 'IMPORTANT' ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter('IMPORTANT')}>Important</Button>
        <Button variant={filter === 'NORMAL' ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter('NORMAL')}>Normal</Button>
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
                <Badge variant={getBadgeVariant(notice.priority)}>{notice.priority}</Badge>
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
