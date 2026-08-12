import React, { useEffect, useState } from 'react';
import MailLayout from './MailLayout';
import { messagingApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, MoreVertical, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Inbox = () => {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentMailbox = user?.mailboxAddress;

  const load = async () => {
    setLoading(true);
    const res = await messagingApi.listThreads('inbox');
    if (res.data) {
      if (Array.isArray(res.data)) {
        setThreads(res.data);
      } else if ((res.data as any).results && Array.isArray((res.data as any).results)) {
        setThreads((res.data as any).results);
      } else {
        setThreads([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <MailLayout title="Inbox">
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="h-14 border-b flex items-center px-4 gap-4 bg-white shrink-0">
          <Checkbox className="mr-2" />
          <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" title="More">
            <MoreVertical className="h-4 w-4 text-gray-600" />
          </Button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading your messages...</div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Your inbox is empty.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <tbody className="divide-y divide-gray-100">
                {threads.map((t) => {
                  const isUnread = t.is_unread;
                  
                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => navigate(`/messaging/threads/${t.id}`)}
                      className={`group cursor-pointer hover:shadow-md transition-shadow ${
                        isUnread ? 'bg-gray-50 font-bold text-gray-900' : 'bg-white text-gray-600'
                      }`}
                    >
                      <td className="w-12 px-4 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox />
                      </td>
                      <td className="w-10 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-yellow-400">
                          <Star className="h-4 w-4" />
                        </Button>
                      </td>
                      <td className="px-2 py-3 truncate max-w-[150px] font-medium text-gray-700">
                        {(() => {
                          const others = t.participants?.filter((p: any) => p.mailbox?.mailbox_address !== currentMailbox) || [];
                          if (others.length === 0) return t.participants?.[0]?.mailbox?.mailbox_address.split('@')[0] || 'Unknown';
                          return others.map((p: any) => p.mailbox?.mailbox_address.split('@')[0]).join(', ');
                        })()}
                      </td>
                      <td className="px-2 py-3 truncate w-full max-w-[400px]">
                        <span className="mr-2">{t.subject || '(No Subject)'}</span>
                        <span className="font-normal text-gray-400">
                          - {t.messages && t.messages.length > 0 ? (t.messages[t.messages.length - 1].body.split(' ').slice(0, 5).join(' ') + '...') : 'No messages'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-xs w-24">
                        {formatDate(t.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MailLayout>
  );
};

export default Inbox;
