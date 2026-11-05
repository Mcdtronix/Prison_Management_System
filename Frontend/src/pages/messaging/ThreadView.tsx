/** One conversation: read it, act on it, reply to it. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive, ArchiveRestore, ArrowLeft, ChevronsUpDown, Loader2, Mail, Printer, Reply, Send, Star, Trash2, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  describeMailbox, friendlyError, longDate, mail, shortDate, type Importance, type MessageItem, type ThreadDetail,
  type ThreadStateChange,
} from '@/lib/messaging';
import { MessageContent } from '@/components/messaging/MessageContent';
import { SentFiles, AttachButton, PendingFiles } from '@/components/messaging/Attachments';
import { ImportanceBadge, ImportancePicker } from '@/components/messaging/ImportancePicker';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/messaging/RichTextEditor';
import { withSignature } from '@/components/messaging/SignatureDialog';
import MailLayout, { useMail } from './MailLayout';

/** Back to where the user came from, or the inbox if they arrived by a link. */
const useGoBack = () => {
  const navigate = useNavigate();
  return () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/messaging/inbox'));
};

const initials = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

function MessageCard({ message, others, expanded, onToggle }: {
  message: MessageItem; others: string; expanded: boolean; onToggle: () => void;
}) {
  const sender = message.sender;
  const name = sender ? describeMailbox(sender) : 'Unknown sender';
  return (
    <article className={cn('rounded-lg border bg-background', !expanded && 'cursor-pointer hover:bg-muted/40')}
      onClick={!expanded ? onToggle : undefined} aria-label={`Message from ${name}`}>
      <header className={cn('flex items-start gap-3 px-4 py-3', expanded && 'cursor-pointer')} onClick={expanded ? onToggle : undefined}>
        <div aria-hidden className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          message.is_mine ? 'bg-[#d7a928]/20 text-[#7a5d08] dark:text-[#d7a928]' : 'bg-[#0b4f2a]/10 text-[#0b4f2a] dark:bg-[#0b4f2a]/40 dark:text-emerald-200')}>
          {initials(sender?.department || '?')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-foreground">{message.is_mine ? 'You' : name}</span>
            {message.sent_by_name && <span className="text-xs text-muted-foreground">({message.sent_by_name})</span>}
            {expanded && <ImportanceBadge value={message.importance} />}
          </div>
          {expanded ? (
            <p className="truncate text-xs text-muted-foreground" title={sender?.address}>
              {message.is_mine ? describeMailbox(sender) : sender?.address} · To: {others || 'only you'}
            </p>
          ) : (
            <p className="truncate text-sm text-muted-foreground">{message.body || (message.attachments.length ? 'Attachment' : '')}</p>
          )}
        </div>
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={message.created_at} title={longDate(message.created_at)}>
          {expanded ? longDate(message.created_at) : shortDate(message.created_at)}
        </time>
      </header>
      {expanded && (
        <div className="space-y-3 px-4 pb-4 sm:pl-16">
          <MessageContent html={message.body_html} />
          <SentFiles files={message.attachments} />
        </div>
      )}
    </article>
  );
}

function ReplyBox({ thread, onSent }: { thread: ThreadDetail; onSent: () => Promise<void> }) {
  const { config, signature } = useMail();
  const { toast } = useToast();
  const editor = useRef<RichTextEditorHandle>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [importance, setImportance] = useState<Importance>('NORMAL');
  const [sending, setSending] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const send = async () => {
    if (sending) return;
    if ((editor.current?.isEmpty() ?? true) && !files.length) {
      toast({ title: 'Write a reply first', description: 'Type a message or attach a file.' });
      return;
    }
    setSending(true);
    const res = await mail.reply(thread.id, { bodyHtml: editor.current?.getHTML() || '', importance, files });
    setSending(false);
    if (res.error) {
      toast({ title: 'Reply not sent', description: friendlyError(res.error), variant: 'destructive' });
      return; // keep what was written
    }
    toast({ title: 'Reply sent' });
    setOpen(false);
    setFiles([]);
    setImportance('NORMAL');
    setHasContent(false);
    await onSent();
  };

  if (!open) {
    return (
      <div className="pms-no-print flex gap-2">
        <Button onClick={() => setOpen(true)} className="bg-[#0b4f2a] text-white hover:bg-[#063f20]"><Reply className="mr-2 h-4 w-4" /> Reply</Button>
      </div>
    );
  }

  return (
    <section className="pms-no-print space-y-2" aria-label="Reply">
      <RichTextEditor ref={editor} autoFocus minHeight={160} initialHtml={withSignature(signature)}
        placeholder="Write your reply…" grammarEnabled={!!config?.grammar_enabled}
        onChange={(html) => setHasContent(!!html)} onSubmitShortcut={send}
        toolbarEnd={<AttachButton files={files} onChange={setFiles} config={config} />} />
      <PendingFiles files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={send} disabled={sending || (!hasContent && !files.length)} className="bg-[#0b4f2a] text-white hover:bg-[#063f20]">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send
        </Button>
        <ImportancePicker value={importance} onChange={setImportance} />
        <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl+Enter to send</span>
        <Button variant="ghost" className="ml-auto" onClick={() => { setOpen(false); setFiles([]); }}>Discard</Button>
      </div>
    </section>
  );
}

function ThreadBody() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const goBack = useGoBack();
  const { config, refreshUnread } = useMail();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const own = config?.mailbox?.address;

  const load = useCallback(async (keepExpanded = false) => {
    if (!id) return;
    const res = await mail.thread(id);
    if (res.error || !res.data) {
      setError(res.status === 404
        ? "This conversation doesn't exist, or your department is not part of it."
        : friendlyError(res.error, 'Could not open this conversation.'));
      return;
    }
    setThread(res.data);
    const msgs = res.data.messages;
    // Long conversations: show the latest two in full, the rest as one-line summaries.
    setExpanded((prev) => {
      const latest = msgs.slice(-2).map((m) => m.id);
      return new Set(keepExpanded ? [...prev, ...latest] : (msgs.length <= 3 ? msgs.map((m) => m.id) : latest));
    });
    refreshUnread();
  }, [id, refreshUnread]);

  useEffect(() => { setThread(null); setError(''); load(); }, [load]);

  const others = useMemo(() => (thread?.participants || []), [thread]);
  const othersFor = (m: MessageItem) => others
    .filter((p) => p.address !== m.sender?.address)
    .map((p) => (p.address === own ? 'you' : describeMailbox(p))).join(', ');

  const act = async (change: ThreadStateChange, done: string, leave = false) => {
    if (!thread) return;
    const res = await mail.setState(thread.id, change);
    if (res.error) {
      toast({ title: 'Could not update', description: friendlyError(res.error), variant: 'destructive' });
      return;
    }
    if (done) toast({ title: done });
    refreshUnread();
    if (leave) goBack();
    else setThread({ ...thread, ...('starred' in change ? { starred: !!change.starred } : {}),
      ...('archived' in change ? { archived: !!change.archived } : {}), ...('trashed' in change ? { trashed: !!change.trashed } : {}) });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-12 text-center text-sm text-muted-foreground">
        <p>{error}</p>
        <Button variant="outline" onClick={() => navigate('/messaging/inbox')}>Back to inbox</Button>
      </div>
    );
  }
  if (!thread) {
    return <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening…</div>;
  }

  const allOpen = expanded.size === thread.messages.length;

  return (
    <div className="flex h-full flex-col">
      <div className="pms-no-print flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack} aria-label="Back" title="Back"><ArrowLeft className="h-4 w-4" /></Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {thread.trashed ? (
          <Button variant="ghost" size="sm" onClick={() => act({ trashed: false }, 'Restored to your inbox')}><Undo2 className="mr-1 h-4 w-4" /> Restore</Button>
        ) : (<>
          {thread.archived ? (
            <Button variant="ghost" size="sm" onClick={() => act({ archived: false }, 'Moved to inbox')}><ArchiveRestore className="mr-1 h-4 w-4" /> Move to inbox</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => act({ archived: true }, 'Archived', true)}><Archive className="mr-1 h-4 w-4" /> Archive</Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => act({ trashed: true }, 'Moved to trash', true)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
        </>)}
        <Button variant="ghost" size="sm" onClick={() => act({ read: false }, '', true)}><Mail className="mr-1 h-4 w-4" /> Mark unread</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => act({ starred: !thread.starred }, '')}
          aria-label={thread.starred ? 'Unstar' : 'Star'} aria-pressed={thread.starred} title={thread.starred ? 'Unstar' : 'Star'}>
          <Star className={cn('h-4 w-4', thread.starred && 'text-[#d7a928]')} fill={thread.starred ? 'currentColor' : 'none'} />
        </Button>
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={() => window.print()} aria-label="Print" title="Print"><Printer className="h-4 w-4" /></Button>
      </div>

      <div className="pms-print flex-1 space-y-3 overflow-y-auto p-3 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">{thread.subject}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {thread.participants.map((p) => (p.address === own ? 'You' : describeMailbox(p))).join(' · ')}
            </p>
          </div>
          {thread.messages.length > 3 && (
            <Button variant="ghost" size="sm" className="pms-no-print"
              onClick={() => setExpanded(allOpen ? new Set(thread.messages.slice(-1).map((m) => m.id)) : new Set(thread.messages.map((m) => m.id)))}>
              <ChevronsUpDown className="mr-1 h-4 w-4" /> {allOpen ? 'Collapse' : 'Expand all'}
            </Button>
          )}
        </div>

        {thread.messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        {thread.messages.map((m) => (
          <MessageCard key={m.id} message={m} others={othersFor(m)} expanded={expanded.has(m.id)}
            onToggle={() => setExpanded((s) => { const next = new Set(s); if (next.has(m.id)) next.delete(m.id); else next.add(m.id); return next; })} />
        ))}

        <ReplyBox thread={thread} onSent={() => load(true)} />
      </div>
    </div>
  );
}

export default function ThreadView() {
  return (
    <MailLayout title="Conversation">
      <ThreadBody />
    </MailLayout>
  );
}
