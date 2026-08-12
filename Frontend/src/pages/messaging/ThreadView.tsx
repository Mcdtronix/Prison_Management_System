import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MailLayout from './MailLayout';
import { messagingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, MoreVertical, Archive, Trash2, Mail } from 'lucide-react';
import { format } from 'date-fns';

const ThreadView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = useState<any | null>(null);
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuth();
  const currentMailbox = user?.mailboxAddress;

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
    return format(date, 'EEE, d MMM, HH:mm');
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
            <Button variant="ghost" size="icon" title="Archive">
              <Archive className="h-4 w-4 text-gray-600" />
            </Button>
            <Button variant="ghost" size="icon" title="Delete">
              <Trash2 className="h-4 w-4 text-gray-600" />
            </Button>
            <Button variant="ghost" size="icon" title="Mark Unread">
              <Mail className="h-4 w-4 text-gray-600" />
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
              
              <div className="space-y-0">
                {thread.messages.map((m: any, index: number) => {
                  const isLast = index === thread.messages.length - 1;
                  const senderName = m.sender?.mailbox_address?.split('@')[0] || 'System';
                  const recipients = thread.participants
                    ?.filter((p: any) => p.mailbox?.mailbox_address !== m.sender?.mailbox_address)
                    .map((p: any) => p.mailbox?.mailbox_address?.split('@')[0])
                    .join(', ') || 'everyone';

                  return (
                    <div key={m.id} className={`py-6 ${!isLast ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                            {(senderName)[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[15px] text-gray-900">
                              {senderName}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              To: me, {recipients} {'>'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {formatDate(m.created_at)}
                          <MoreVertical className="h-4 w-4 cursor-pointer hover:text-gray-900" />
                        </div>
                      </div>
                      
                      <div className="text-[14px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {m.body}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Inline Reply Box */}
              <div className="mt-6 border rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-3 text-sm text-gray-800">
                  <div className="w-8 h-8 rounded-full bg-[#d7a928]/20 flex items-center justify-center text-blue-700 font-bold text-sm">
                    {currentMailbox?.[0].toUpperCase() || 'U'}
                  </div>
                  <span className="font-semibold">{currentMailbox?.split('@')[0] || 'You'}</span>
                </div>
                <div className="p-0">
                  <Textarea 
                    value={body} 
                    onChange={(e) => setBody(e.target.value)} 
                    placeholder="Reply..." 
                    className="min-h-[150px] resize-y border-none shadow-none focus-visible:ring-0 px-4 py-2 text-[14px] text-gray-800"
                  />
                  <div className="flex justify-between items-center px-4 py-3 bg-white">
                    <div className="flex items-center gap-4 text-gray-400 select-none">
                       <Button variant="outline" size="sm" className="text-gray-600 font-normal h-8 rounded-md flex gap-2 items-center border-gray-200">
                         <span className="text-purple-600">✨</span> Use AI <span className="text-gray-300 ml-1">v</span>
                       </Button>
                       <span className="text-xs">Text</span>
                       <span className="text-xs">10pt</span>
                       <span className="font-bold cursor-pointer hover:text-gray-800">B</span>
                       <span className="italic cursor-pointer hover:text-gray-800">I</span>
                       <span className="underline cursor-pointer hover:text-gray-800">U</span>
                       <span className="line-through cursor-pointer hover:text-gray-800">S</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" onClick={() => setBody('')} className="text-gray-500 hover:text-gray-700 font-medium">Cancel</Button>
                      <Button onClick={send} disabled={isSending || !body.trim()} className="bg-gray-900 hover:bg-gray-800 text-white rounded-[10px] px-6 font-medium">
                        {isSending ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
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
