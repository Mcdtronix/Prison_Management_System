/** Saved drafts: open one to carry on, or delete it. */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePen, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, mail, shortDate, type DraftItem } from '@/lib/messaging';
import MailLayout from './MailLayout';

const preview = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function DraftList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<DraftItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await mail.drafts();
    if (res.error || !res.data) { setError(friendlyError(res.error, 'Could not load drafts.')); return; }
    setError('');
    setDrafts(res.data.results);
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (d: DraftItem) => {
    if (!window.confirm(`Delete the draft "${d.subject || '(no subject)'}"?`)) return;
    const res = await mail.deleteDraft(d.id);
    if (res.error) { toast({ title: 'Could not delete draft', description: friendlyError(res.error), variant: 'destructive' }); return; }
    toast({ title: 'Draft deleted' });
    load();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load} aria-label="Refresh" title="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        <span className="text-xs text-muted-foreground">Drafts save automatically while you write.</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <p className="p-8 text-center text-sm text-destructive">{error}</p>
        ) : !drafts ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            <FilePen className="h-8 w-8 opacity-40" /> No drafts. Unsent messages are saved here automatically.
          </div>
        ) : (
          <ul className="divide-y">
            {drafts.map((d) => (
              <li key={d.id} className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                onClick={() => navigate(`/messaging/compose?draft=${d.id}`)}>
                <span className="shrink-0 text-xs font-semibold text-red-600">Draft</span>
                <div className="min-w-0 flex-1 xl:flex xl:items-center xl:gap-3">
                  <p className="truncate text-sm text-muted-foreground xl:w-56 xl:shrink-0">{d.recipients.length ? `To: ${d.recipients.join(', ')}` : 'No recipients yet'}</p>
                  <p className="min-w-0 truncate text-sm">
                    <span className="text-foreground">{d.subject || '(no subject)'}</span>
                    {preview(d.body_html) && <span className="text-muted-foreground"> — {preview(d.body_html)}</span>}
                  </p>
                </div>
                <time className="w-16 shrink-0 text-right text-xs text-muted-foreground" dateTime={d.updated_at}>{shortDate(d.updated_at)}</time>
                <button type="button" onClick={(e) => { e.stopPropagation(); remove(d); }} aria-label="Delete draft" title="Delete draft"
                  className="rounded p-1 text-muted-foreground opacity-60 hover:bg-muted hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Drafts() {
  return (
    <MailLayout title="Drafts">
      <DraftList />
    </MailLayout>
  );
}
