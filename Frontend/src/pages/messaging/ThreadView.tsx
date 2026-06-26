import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MailLayout from './MailLayout';
import { messagingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MoreVertical, Reply, CornerUpLeft } from 'lucide-react';
import { format } from 'date-fns';

const ThreadView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = useState<any | null>(null);
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const res = await messagingApi.getThread(Number(id));
      if (res.data) setThread(res.data);
      // Mark as read when opened
      await messagingApi.markThreadRead(Number(id));
    };
    load();
  }, [id]);

  useEffect(() => {
    // Scroll to the bottom when thread loads
    if (thread && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [thread]);

  const send = async () => {
    if (!thread || !body.trim()) return;
    setIsSending(true);
    await messagingApi.createMessage({ thread: thread.id, body });
    setBody('');
    const res = await messagingApi.getThread(thread.id);
    if (res.data) setThread(res.data);
    setIsSending(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy, h:mm a');
  };

  return (
    <MailLayout title={thread ? thread.subject : 'Reading Mail'}>
      <div className="flex flex-col h-full bg-white">
        {/* Toolbar */}
        <div className="h-14 border-b flex items-center px-4 justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="Back to Inbox">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Button>
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <Button variant="ghost" size="icon" title="Reply">
              <CornerUpLeft className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4 text-gray-600" />
          </Button>
        </div>

        {/* Thread Content */}
        <div className="flex-1 overflow-y-auto p-6 md:px-12 lg:px-24">
          {thread ? (
            <div className="max-w-4xl mx-auto pb-8">
              <h1 className="text-2xl font-normal text-gray-900 mb-8">{thread.subject}</h1>
              
              <div className="space-y-6">
                {thread.messages.map((m: any, index: number) => {
                  const isLast = index === thread.messages.length - 1;
                  return (
                    <div key={m.id} className={`bg-white rounded-lg border shadow-sm overflow-hidden ${isLast ? 'ring-1 ring-blue-100' : ''}`}>
                      {/* Message Header */}
                      <div className="bg-gray-50/50 px-4 py-3 flex justify-between items-start border-b">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                            {(m.sender?.mailbox_address || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-gray-900">
                              {m.sender?.mailbox_address || 'System'}
                            </div>
                            <div className="text-xs text-gray-500">to everyone</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap pt-1">
                          {formatDate(m.created_at)}
                        </div>
                      </div>
                      
                      {/* Message Body */}
                      <div className="px-5 py-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {m.body}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Inline Reply Box */}
              <div className="mt-8 bg-white border rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2 text-sm text-gray-600">
                  <Reply className="h-4 w-4" /> Reply
                </div>
                <div className="p-4">
                  <Textarea 
                    value={body} 
                    onChange={(e) => setBody(e.target.value)} 
                    placeholder="Write your reply here..." 
                    className="min-h-[120px] resize-y border-none shadow-none focus-visible:ring-0 p-0 text-sm"
                  />
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-xs text-gray-400">Attachments are not supported in quick reply.</div>
                    <Button onClick={send} disabled={isSending || !body.trim()} className="bg-blue-600 hover:bg-blue-700">
                      {isSending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex justify-center items-center h-full text-gray-500">Loading thread...</div>
          )}
        </div>
      </div>
    </MailLayout>
  );
};

export default ThreadView;
