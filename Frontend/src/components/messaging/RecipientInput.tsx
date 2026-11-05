/**
 * "To" field: search any department at any station, province or HQ by name,
 * pick with the mouse or keyboard, shown as removable chips.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Building2, Landmark, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mail, type DirectoryEntry } from '@/lib/messaging';

export interface Recipient {
  address: string;
  label?: string; // "Health · Chivhu Prison"
}

interface Props {
  value: Recipient[];
  onChange: (next: Recipient[]) => void;
  ownAddress?: string | null;
  autoFocus?: boolean;
  id?: string;
}

const looksLikeAddress = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function RecipientInput({ value, onChange, ownAddress, autoFocus, id }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const chosen = new Set(value.map((r) => r.address.toLowerCase()));

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const res = await mail.directory(q);
      const own = (ownAddress || '').toLowerCase();
      setResults((res.data?.results || []).filter((m) => {
        const a = m.mailbox_address.toLowerCase();
        return a !== own && !chosen.has(a);
      }));
      setActive(0);
      setLoading(false);
    }, 200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ownAddress, value.length]);

  const add = (r: Recipient) => {
    if (!chosen.has(r.address.toLowerCase())) onChange([...value, r]);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };
  const remove = (address: string) => onChange(value.filter((r) => r.address !== address));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % results.length); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      if (results[active] && query.trim()) {
        e.preventDefault();
        const m = results[active];
        add({ address: m.mailbox_address, label: `${m.department_name} · ${m.org_unit_name}` });
      } else if (looksLikeAddress(query)) {
        e.preventDefault();
        add({ address: query.trim() });
      } else if (e.key !== 'Enter') e.preventDefault();
    } else if (e.key === 'Backspace' && !query && value.length) remove(value[value.length - 1].address);
    else if (e.key === 'Escape') setOpen(false);
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative flex-1">
      <div className="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 py-1" onClick={() => inputRef.current?.focus()}>
        {value.map((r) => (
          <span key={r.address} title={r.address}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#0b4f2a]/30 bg-[#0b4f2a]/5 py-0.5 pl-2.5 pr-1 text-xs text-foreground dark:border-[#d7a928]/40 dark:bg-[#d7a928]/10">
            <span className="truncate">{r.label || r.address}</span>
            <button type="button" onClick={() => remove(r.address)} aria-label={`Remove ${r.label || r.address}`}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input ref={inputRef} id={id} value={query} autoFocus={autoFocus} autoComplete="off"
          role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          placeholder={value.length ? '' : 'Search a station, province or department'}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="min-w-[12rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      {showList && (
        <ul id={listId} role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
          {loading && <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</li>}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No matching department.{looksLikeAddress(query) && ' Press Enter to use this address.'}
            </li>
          )}
          {!loading && results.map((m, i) => {
            const Icon = m.unit_type === 'STATION' ? Building2 : Landmark;
            return (
              <li key={m.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)}
                onClick={() => add({ address: m.mailbox_address, label: `${m.department_name} · ${m.org_unit_name}` })}
                className={cn('flex cursor-pointer items-center gap-3 rounded px-3 py-2', i === active && 'bg-muted')}>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.department_name} <span className="font-normal text-muted-foreground">· {m.org_unit_name}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{m.mailbox_address}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
