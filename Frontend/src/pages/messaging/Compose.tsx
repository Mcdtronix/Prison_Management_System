/** New message, with automatic draft saving. ?draft=<id> reopens a draft. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, mail, type Importance } from '@/lib/messaging';
import { RecipientInput, type Recipient } from '@/components/messaging/RecipientInput';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/messaging/RichTextEditor';
import { AttachButton, PendingFiles } from '@/components/messaging/Attachments';
import { ImportancePicker } from '@/components/messaging/ImportancePicker';
import { withSignature } from '@/components/messaging/SignatureDialog';
import MailLayout, { useMail } from './MailLayout';

const AUTOSAVE_MS = 2500;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function ComposeForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config, signature } = useMail();
  const [params] = useSearchParams();
  const draftParam = params.get('draft');

  const editor = useRef<RichTextEditorHandle>(null);
  const [ready, setReady] = useState(!draftParam);
  const [initialHtml, setInitialHtml] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState('');
  const [importance, setImportance] = useState<Importance>('NORMAL');
  const [bodyHtml, setBodyHtml] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const draftId = useRef<number | null>(draftParam ? Number(draftParam) : null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirty = useRef(false);
  const finished = useRef(false); // sent or discarded: stop saving

  // Reopen a draft.
  useEffect(() => {
    if (!draftParam) return;
    mail.draft(draftParam).then((res) => {
      if (res.error || !res.data) {
        toast({ title: 'Draft not found', description: 'Starting a new message instead.', variant: 'destructive' });
        draftId.current = null;
      } else {
        setRecipients(res.data.recipients.map((address) => ({ address })));
        setSubject(res.data.subject);
        setImportance(res.data.importance);
        setInitialHtml(res.data.body_html);
        setBodyHtml(res.data.body_html);
        setSavedAt(new Date(res.data.updated_at));
        setSaveState('saved');
      }
      setReady(true);
    });
  }, [draftParam, toast]);

  // New message: start with the signature once it has loaded.
  const signatureApplied = useRef(false);
  useEffect(() => {
    if (draftParam || signatureApplied.current || !signature) return;
    signatureApplied.current = true;
    const html = withSignature(signature);
    if (html && editor.current?.isEmpty()) editor.current.setHTML(html);
  }, [signature, draftParam]);

  const hasSomething = recipients.length > 0 || subject.trim() !== '' || bodyHtml.replace(/<[^>]*>/g, '').trim() !== '';

  const saveDraft = useCallback(async () => {
    if (finished.current || !dirty.current) return;
    dirty.current = false;
    setSaveState('saving');
    const res = await mail.saveDraft(draftId.current, {
      recipients: recipients.map((r) => r.address), subject, importance, body_html: editor.current?.getHTML() || '',
    });
    if (finished.current) return;
    if (res.error || !res.data) { setSaveState('error'); dirty.current = true; return; }
    draftId.current = res.data.id;
    setSavedAt(new Date());
    setSaveState('saved');
  }, [recipients, subject, importance]);

  // Save a moment after the last change.
  useEffect(() => {
    if (!ready || !hasSomething) return;
    dirty.current = true;
    const t = window.setTimeout(saveDraft, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [recipients, subject, importance, bodyHtml, ready, hasSomething, saveDraft]);

  // Leaving the page: save whatever is pending.
  const saveRef = useRef(saveDraft);
  saveRef.current = saveDraft;
  useEffect(() => () => { saveRef.current(); }, []);

  const send = async () => {
    if (sending) return;
    if (!recipients.length) { toast({ title: 'Add a recipient', description: 'Search for a station, province or department in the To field.' }); return; }
    if (!subject.trim()) { toast({ title: 'Add a subject' }); return; }
    if ((editor.current?.isEmpty() ?? true) && !files.length) { toast({ title: 'Write a message', description: 'Type a message or attach a file.' }); return; }
    setSending(true);
    finished.current = true;
    const res = await mail.start({
      subject: subject.trim(), recipients: recipients.map((r) => r.address), bodyHtml: editor.current?.getHTML() || '',
      importance, files, draftId: draftId.current,
    });
    setSending(false);
    if (res.error || !res.data) {
      finished.current = false;
      dirty.current = true;
      toast({ title: 'Message not sent', description: friendlyError(res.error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Message sent' });
    navigate(`/messaging/threads/${res.data.id}`, { replace: true });
  };

  const discard = async () => {
    if (hasSomething && !window.confirm('Discard this message? The saved draft will be deleted.')) return;
    finished.current = true;
    if (draftId.current) await mail.deleteDraft(draftId.current);
    navigate('/messaging/inbox');
  };

  if (!ready) {
    return <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening draft…</div>;
  }

  const status = saveState === 'saving' ? 'Saving draft…'
    : saveState === 'error' ? 'Draft not saved'
      : savedAt ? `Draft saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <form className="flex h-full flex-col" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-6">
        <div className="flex items-start gap-3 border-b pb-1">
          <label htmlFor="compose-to" className="w-16 shrink-0 pt-2 text-sm text-muted-foreground">To</label>
          <RecipientInput id="compose-to" value={recipients} onChange={setRecipients} ownAddress={config?.mailbox?.address} autoFocus={!draftParam} />
        </div>
        <div className="flex items-center gap-3 border-b pb-1">
          <label htmlFor="compose-subject" className="w-16 shrink-0 text-sm text-muted-foreground">Subject</label>
          <input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={255}
            className="flex-1 bg-transparent py-2 text-sm font-medium outline-none placeholder:text-muted-foreground" placeholder="What is this about?" />
          <ImportancePicker value={importance} onChange={setImportance} />
        </div>

        <RichTextEditor ref={editor} initialHtml={initialHtml} minHeight={280} grammarEnabled={!!config?.grammar_enabled}
          onChange={setBodyHtml} onSubmitShortcut={send}
          toolbarEnd={<AttachButton files={files} onChange={setFiles} config={config} />} />
        <PendingFiles files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
        {files.length > 0 && <p className="text-xs text-muted-foreground">Attachments are sent with the message; they are not kept in drafts.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 sm:px-6">
        <Button type="submit" disabled={sending} className="bg-[#0b4f2a] text-white hover:bg-[#063f20]">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send
        </Button>
        <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl+Enter to send</span>
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">{status}</span>
        <Button type="button" variant="ghost" size="icon" onClick={discard} title="Discard" aria-label="Discard"
          className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </form>
  );
}

export default function Compose() {
  return (
    <MailLayout title="New message">
      <ComposeForm />
    </MailLayout>
  );
}
