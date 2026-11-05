/**
 * Spelling and grammar suggestions from the LanguageTool server that runs on
 * this system's own machine (proxied by POST /messaging/grammar/). The text
 * never goes to an outside service.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyError, mail, type GrammarMatch } from '@/lib/messaging';

/** The document as plain text, plus the editor position of every character. */
function textMap(doc: PMNode) {
  let text = '';
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock && text.length) {
      text += '\n';
      positions.push(-1);
    }
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i += 1) {
        text += node.text[i];
        positions.push(pos + i);
      }
    } else if (node.type.name === 'hardBreak') {
      text += '\n';
      positions.push(-1);
    }
    return true;
  });
  return { text, positions };
}

type Found = GrammarMatch & { original: string };

export function GrammarPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [state, setState] = useState<'checking' | 'done' | 'error'>('checking');
  const [error, setError] = useState('');
  const [found, setFound] = useState<Found[]>([]);

  const check = useCallback(async () => {
    setState('checking');
    const { text } = textMap(editor.state.doc);
    const res = await mail.grammar(text);
    if (res.error || !res.data) {
      setError(friendlyError(res.error, 'The grammar checker is not available.'));
      setState('error');
      return;
    }
    setFound(res.data.matches.map((m) => ({ ...m, original: text.slice(m.offset, m.offset + m.length) })));
    setState('done');
  }, [editor]);

  useEffect(() => { check(); }, [check]);

  const apply = (match: Found, replacement: string) => {
    const { text, positions } = textMap(editor.state.doc);
    // Only apply if the text has not changed since it was checked.
    if (text.slice(match.offset, match.offset + match.length) !== match.original) {
      check();
      return;
    }
    const from = positions[match.offset];
    const to = positions[match.offset + match.length - 1] + 1;
    if (from < 0 || to <= from) return;
    editor.chain().focus().insertContentAt({ from, to }, replacement).run();
    check(); // later offsets have moved; ask again
  };

  return (
    <div className="border-t bg-muted/20 px-3 py-2 text-sm" aria-live="polite">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium">Spelling and grammar</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={check} disabled={state === 'checking'}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Check again
          </Button>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {state === 'checking' && <p className="flex items-center gap-2 py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</p>}
      {state === 'error' && <p className="py-2 text-destructive">{error}</p>}
      {state === 'done' && found.length === 0 && (
        <p className="flex items-center gap-2 py-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" /> No issues found.</p>
      )}
      {state === 'done' && found.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-y-auto py-1">
          {found.map((m, i) => (
            <li key={`${m.offset}-${i}`} className="rounded-md border bg-background p-2">
              <p className="text-xs text-muted-foreground">{m.category || 'Suggestion'}</p>
              <p className="my-1"><span className="rounded bg-red-100 px-1 text-red-800 line-through decoration-red-500/60 dark:bg-red-900/40 dark:text-red-200">{m.original || '…'}</span> — {m.message}</p>
              {m.replacements.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.replacements.map((r) => (
                    <Button key={r} type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => apply(m, r)}>{r || '(remove)'}</Button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
