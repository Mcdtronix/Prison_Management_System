import React, { useEffect, useState } from 'react';
import MailLayout from './MailLayout';
import { messagingApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, MoreVertical, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Outbox = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const res = await messagingApi.listMessages(); // Note: Outbox might need to list sent messages/threads
    if (res.data) {
      if (Array.isArray(res.data)) {
        setMessages(res.data);
      } else if ((res.data as any).results && Array.isArray((res.data as any).results)) {
        setMessages((res.data as any).results);
      } else {
        setMessages([]);
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
    <MailLayout title="Sent Mail">
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
            <div className="p-8 text-center text-gray-500">Loading your sent messages...</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Your outbox is empty.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <tbody className="divide-y divide-gray-100">
                {messages.map((m) => {
                  return (
                    <tr 
                      key={m.id} 
                      onClick={() => navigate(`/messaging/threads/${m.thread}`)}
                      className="group cursor-pointer hover:shadow-md transition-shadow bg-white text-gray-600"
                    >
                      <td className="w-12 px-4 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox />
                      </td>
                      <td className="w-10 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-yellow-400">
                          <Star className="h-4 w-4" />
                        </Button>
                      </td>
                      <td className="px-2 py-3 truncate max-w-[150px]">
                        To: Recipient
                      </td>
                      <td className="px-2 py-3 truncate w-full max-w-[400px]">
                        <span className="mr-2 font-medium">{m.subject || 'Re: Thread'}</span>
                        <span className="font-normal text-gray-400">- {m.body?.slice(0, 80) || 'Message content...'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs w-24">
                        {formatDate(m.created_at)}
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

export default Outbox;
