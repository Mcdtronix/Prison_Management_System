import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagingApi } from '@/lib/api';
import MailLayout from './MailLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Paperclip, Send, ArrowLeft, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Compose() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!query.trim()) return setSuggestions([]);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const res = await messagingApi.listMailboxes();
      if (res.data) {
        const q = query.toLowerCase();
        setSuggestions((res.data as any[]).filter(m => m.mailbox_address.toLowerCase().includes(q) && !recipients.includes(m.mailbox_address)));
      }
    }, 250);
  }, [query, recipients]);

  const addRecipient = (addr: string) => {
    if (!recipients.includes(addr)) setRecipients([...recipients, addr]);
    setQuery('');
    setSuggestions([]);
  };

  const removeRecipient = (addr: string) => {
    setRecipients(recipients.filter(r => r !== addr));
  };

  const onFiles = (fList: FileList | null) => {
    if (!fList) return;
    setFiles([...files, ...Array.from(fList)]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      toast({ title: "Recipient required", description: "Please add at least one recipient.", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Subject required", description: "Please enter a subject.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    const form = new FormData();
    form.append('subject', subject);
    form.append('initial_body', body);
    form.append('participants', recipients.join(','));
    files.forEach(f => form.append('attachments', f));

    const res = await messagingApi.createThread(form);
    setIsSending(false);

    if (res.data && (res.data as any).id) {
      toast({ title: "Message Sent", description: "Your message has been sent successfully." });
      navigate(`/messaging/threads/${(res.data as any).id}`);
    } else {
      toast({ title: "Send Failed", description: res.error || 'Failed to send message', variant: "destructive" });
    }
  };

  return (
    <MailLayout title="Compose Message">
      <div className="flex flex-col h-full bg-white">
        {/* Toolbar */}
        <div className="h-14 border-b flex items-center px-4 justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="Discard and go back">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Button>
            <h2 className="text-lg font-medium text-gray-700 ml-2">New Message</h2>
          </div>
        </div>

        {/* Compose Form */}
        <div className="flex-1 overflow-y-auto p-6 md:px-12 lg:px-24">
          <form onSubmit={onSubmit} className="max-w-4xl mx-auto flex flex-col h-full">
            
            {/* To Field */}
            <div className="flex items-start border-b py-3">
              <label className="w-16 text-gray-500 text-sm pt-2">To</label>
              <div className="flex-1 relative">
                <div 
                  className="flex flex-wrap gap-2 items-center w-full min-h-[36px]"
                  onDrop={onDrop} 
                  onDragOver={(e) => e.preventDefault()}
                >
                  {recipients.map(r => (
                    <div key={r} className="bg-[#d7a928]/10 border border-[#d7a928] text-blue-700 px-2 py-1 rounded-full flex items-center gap-1 text-sm">
                      <span>{r}</span>
                      <button type="button" onClick={() => removeRecipient(r)} className="text-[#0b4f2a] hover:text-[#063f20] focus:outline-none">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    className="flex-1 outline-none min-w-[200px] text-sm py-1 bg-transparent"
                    placeholder={recipients.length === 0 ? "Type mailbox address..." : ""}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
                
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map(s => (
                      <li 
                        key={s.id} 
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center" 
                        onClick={() => addRecipient(s.mailbox_address)}
                      >
                        <div className="font-medium text-sm text-gray-900">{s.mailbox_address}</div>
                        <div className="text-xs text-gray-500">{s.org_unit_department?.org_unit?.name || ''}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Subject Field */}
            <div className="flex items-center border-b py-3">
              <label className="w-16 text-gray-500 text-sm">Subject</label>
              <input 
                className="flex-1 outline-none text-sm font-medium py-1 bg-transparent" 
                placeholder="Enter subject" 
                value={subject} 
                onChange={e => setSubject(e.target.value)} 
              />
            </div>

            {/* Message Body */}
            <div className="flex-1 flex flex-col py-4 min-h-[300px]">
              <textarea 
                className="flex-1 w-full outline-none resize-none text-sm leading-relaxed" 
                placeholder="Write your message here..." 
                value={body} 
                onChange={e => setBody(e.target.value)} 
              />
            </div>

            {/* Attachments */}
            {files.length > 0 && (
              <div className="py-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 border rounded-md px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4 text-gray-400" />
                      <span className="truncate max-w-[200px] text-gray-700">{f.name}</span>
                      <span className="text-gray-400 text-xs">({(f.size/1024).toFixed(0)} KB)</span>
                      <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 ml-2">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 pb-8 flex items-center justify-between border-t mt-auto shrink-0">
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isSending || recipients.length === 0} className="bg-[#0b4f2a] hover:bg-[#063f20] px-6 rounded-full">
                  {isSending ? 'Sending...' : (
                    <>
                      Send <Send className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                
                <div className="relative">
                  <input 
                    type="file" 
                    multiple 
                    onChange={e => onFiles(e.target.files)} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Attach files"
                  />
                  <Button type="button" variant="ghost" size="icon" className="text-gray-500 hover:bg-gray-100 rounded-full">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                title="Discard draft"
                onClick={() => {
                  if (window.confirm("Discard this message?")) navigate(-1);
                }}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>

          </form>
        </div>
      </div>
    </MailLayout>
  );
}
