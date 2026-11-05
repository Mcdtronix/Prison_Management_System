/** One mail folder: Inbox, Starred, Sent, Archive or Trash. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Archive, ArchiveRestore, ChevronLeft, ChevronRight, Flag, Inbox, Loader2, Mail, MailOpen, Paperclip,
  RefreshCw, Search, Star, Trash2, Undo2, X,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  FOLDERS, friendlyError, mail, shortDate, type Folder, type MailboxBrief, type Page, type ThreadStateChange,
  type ThreadSummary,
} from '@/lib/messaging';
import MailLayout, { useMail } from './MailLayout';

const PAGE_SIZE = 25;

const EMPTY: Record<Folder, string> = {
  inbox: 'No messages. New messages from other departments appear here.',
  starred: 'Star a conversation to keep it here.',
  sent: 'Messages you send appear here.',
  archived: 'Archived conversations are kept here, out of your inbox.',
  trash: 'Trash is empty. Conversations you delete stay here and come back if someone replies.',
};

const short = (m: MailboxBrief) => `${m.department} · ${m.unit}`;

function correspondents(t: ThreadSummary, own: string | undefined, folder: Folder) {
  const others = t.participants.filter((p) => p.address !== own);
  if (folder === 'sent') return `To: ${others.map(short).join(', ') || 'yourself'}`;
  if (t.last_sender && t.last_sender.address !== own) return short(t.last_sender);
  return others.map(short).join(', ') || 'Only you';
}

function FolderView({ folder }: { folder: Folder }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config, refreshUnread } = useMail();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(q);
  const [data, setData] = useState<Page<ThreadSummary> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const own = config?.mailbox?.address;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await mail.folder(folder, { q, page });
    setLoading(false);
    if (res.error || !res.data) {
      // Asking for a page past the end (e.g. after archiving) goes back to page 1.
      if (res.status === 404 && page > 1) { setParams((p) => { p.delete('page'); return p; }); return; }
      setError(friendlyError(res.error, 'Could not load messages.'));
      return;
    }
    setError('');
    setData(res.data);
    setSelected(new Set());
  }, [folder, q, page, setParams]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSearch(q); }, [q]);

  // Search as you type, a moment after typing stops.
  useEffect(() => {
    if (search === q) return;
    const t = window.setTimeout(() => setParams(search.trim() ? { q: search.trim() } : {}), 350);
    return () => window.clearTimeout(t);
  }, [search, q, setParams]);

  const rows = data?.results || [];
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const anyUnread = selectedRows.some((r) => r.unread_count > 0);

  const change = async (ids: number[], what: ThreadStateChange, done: string) => {
    const res = ids.length === 1 ? await mail.setState(ids[0], what) : await mail.setStateMany(ids, what);
    if (res.error) {
      toast({ title: 'Could not update', description: friendlyError(res.error), variant: 'destructive' });
      return;
    }
    if (done) toast({ title: done });
    await load();
    refreshUnread();
  };

  const toggleStar = async (t: ThreadSummary) => {
    setData((d) => d && { ...d, results: d.results.map((r) => (r.id === t.id ? { ...r, starred: !r.starred } : r)) });
    const res = await mail.setState(t.id, { starred: !t.starred });
    if (res.error) load();
    else if (folder === 'starred') load();
  };

  const ids = [...selected];
  const n = ids.length;
  const plural = n === 1 ? 'conversation' : 'conversations';
  const label = FOLDERS.find((f) => f.key === folder)?.label || 'Inbox';
  const from = data && data.count ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = data ? Math.min(page * PAGE_SIZE, data.count) : 0;
  const goPage = (p: number) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('page', String(p)); return next; });

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Checkbox aria-label="Select all" checked={allSelected} disabled={!rows.length}
          onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())} />
        {n === 0 ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Actions for selected">
            <span className="mr-1 text-xs text-muted-foreground">{n} selected</span>
            {folder === 'trash' ? (
              <Button variant="ghost" size="sm" onClick={() => change(ids, { trashed: false }, `Restored ${n} ${plural}`)}><Undo2 className="mr-1 h-4 w-4" /> Restore</Button>
            ) : (<>
              {folder === 'archived' ? (
                <Button variant="ghost" size="sm" onClick={() => change(ids, { archived: false }, `Moved ${n} ${plural} to the inbox`)}><ArchiveRestore className="mr-1 h-4 w-4" /> Move to inbox</Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => change(ids, { archived: true }, `Archived ${n} ${plural}`)}><Archive className="mr-1 h-4 w-4" /> Archive</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => change(ids, { trashed: true }, `Moved ${n} ${plural} to trash`)}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
            </>)}
            <Button variant="ghost" size="sm" onClick={() => change(ids, { read: anyUnread }, '')}>
              {anyUnread ? <><MailOpen className="mr-1 h-4 w-4" /> Mark read</> : <><Mail className="mr-1 h-4 w-4" /> Mark unread</>}
            </Button>
          </div>
        )}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${label.toLowerCase()}`}
            className="h-8 pl-8 pr-8 text-sm" aria-label={`Search ${label}`} />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-8 text-center text-sm text-destructive">{error} <button className="underline" onClick={load}>Try again</button></div>
        ) : !data ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" />
            {q ? <>No conversations match “{q}”.</> : EMPTY[folder]}
          </div>
        ) : (
          <ul className="divide-y" aria-label={`${label} conversations`}>
            {rows.map((t) => {
              const unread = t.unread_count > 0;
              const isSelected = selected.has(t.id);
              return (
                <li key={t.id}
                  className={cn('group flex cursor-pointer items-start gap-2 px-3 py-2.5 transition-colors hover:bg-muted/50 xl:items-center',
                    isSelected && 'bg-[#0b4f2a]/5 dark:bg-[#d7a928]/10', unread && 'bg-background')}
                  onClick={() => navigate(`/messaging/threads/${t.id}`)}>
                  <div className="flex items-center gap-1 pt-0.5 xl:pt-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={`Select ${t.subject}`} checked={isSelected}
                      onCheckedChange={(c) => setSelected((s) => { const next = new Set(s); if (c) next.add(t.id); else next.delete(t.id); return next; })} />
                    <button type="button" onClick={() => toggleStar(t)} aria-label={t.starred ? 'Unstar' : 'Star'} aria-pressed={t.starred}
                      className={cn('rounded p-1', t.starred ? 'text-[#d7a928]' : 'text-muted-foreground/50 hover:text-[#d7a928]')}>
                      <Star className="h-4 w-4" fill={t.starred ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1 xl:flex xl:items-center xl:gap-3">
                    <p className={cn('truncate text-sm xl:w-56 xl:shrink-0', unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      {correspondents(t, own, folder)}
                      {t.message_count > 1 && <span className="ml-1 text-xs font-normal text-muted-foreground">({t.message_count})</span>}
                    </p>
                    <p className="min-w-0 truncate text-sm">
                      {t.important && <Flag className="mr-1 inline h-3.5 w-3.5 text-red-600" aria-label="High importance" />}
                      <span className={cn(unread ? 'font-semibold text-foreground' : 'text-foreground/90')}>{t.subject || '(no subject)'}</span>
                      {t.snippet && <span className="text-muted-foreground"> — {t.snippet}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 xl:flex-row xl:items-center xl:gap-2">
                    {t.has_attachments && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Has attachments" />}
                    {unread && (
                      <span className="rounded-full bg-[#0b4f2a] px-1.5 text-[11px] font-semibold text-white dark:bg-[#d7a928] dark:text-[#0b4f2a]" aria-label={`${t.unread_count} unread`}>
                        {t.unread_count}
                      </span>
                    )}
                    <time className={cn('w-16 text-right text-xs', unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                      dateTime={t.last_message_at || undefined}>{shortDate(t.last_message_at)}</time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paging */}
      {data && data.count > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>{from}–{to} of {data.count}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!data.previous} onClick={() => goPage(page - 1)} aria-label="Newer"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!data.next} onClick={() => goPage(page + 1)} aria-label="Older"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

const VALID = new Set<string>(FOLDERS.map((f) => f.key));

export default function MailFolder() {
  const { folder = 'inbox' } = useParams();
  if (folder === 'outbox') return <Navigate to="/messaging/sent" replace />;
  if (!VALID.has(folder)) return <Navigate to="/messaging/inbox" replace />;
  const label = FOLDERS.find((f) => f.key === folder)!.label;
  return (
    <MailLayout title={label}>
      <FolderView key={folder} folder={folder as Folder} />
    </MailLayout>
  );
}
