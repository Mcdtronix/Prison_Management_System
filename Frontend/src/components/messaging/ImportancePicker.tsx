/** Outlook-style "Tags": High / Low importance for a message. */
import { ArrowDown, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Importance } from '@/lib/messaging';

export function ImportancePicker({ value, onChange }: { value: Importance; onChange: (v: Importance) => void }) {
  const toggle = (v: Importance) => onChange(value === v ? 'NORMAL' : v);
  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label="Importance">
      <button type="button" onClick={() => toggle('HIGH')} aria-pressed={value === 'HIGH'} title="High importance"
        className={cn('inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-muted',
          value === 'HIGH' ? 'bg-red-50 font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'text-muted-foreground')}>
        <Flag className="h-3.5 w-3.5" /> <span className="hidden md:inline">High</span>
      </button>
      <button type="button" onClick={() => toggle('LOW')} aria-pressed={value === 'LOW'} title="Low importance"
        className={cn('inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-muted',
          value === 'LOW' ? 'bg-sky-50 font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : 'text-muted-foreground')}>
        <ArrowDown className="h-3.5 w-3.5" /> <span className="hidden md:inline">Low</span>
      </button>
    </div>
  );
}

export function ImportanceBadge({ value }: { value: Importance }) {
  if (value === 'HIGH') {
    return <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300"><Flag className="h-3 w-3" /> High importance</span>;
  }
  if (value === 'LOW') {
    return <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"><ArrowDown className="h-3 w-3" /> Low importance</span>;
  }
  return null;
}
