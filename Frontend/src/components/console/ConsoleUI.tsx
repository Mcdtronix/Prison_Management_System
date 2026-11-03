/**
 * Shared building blocks for the admin console. Colours follow the app shell:
 * deep green #0b4f2a (primary), #063f20 (dark), gold #d7a928 (accent).
 */
import { ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BRAND = { green: '#0b4f2a', dark: '#063f20', gold: '#d7a928' };

// ---------------------------------------------------------------- formatting

export const formatBytes = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
};

export const formatNumber = (n?: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString());

export const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const timeAgo = (iso?: string | null) => {
  if (!iso) return 'never';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDateTime(iso);
};

export const unitTypeLabel = (t?: string) =>
  t === 'NATIONAL_HQ' ? 'National HQ' : t === 'PROVINCIAL_HQ' ? 'Province' : t === 'STATION' ? 'Station' : t || '';

export const asList = <T,>(data: any): T[] => (Array.isArray(data) ? data : data?.results || []);

// ---------------------------------------------------------------- display

export function StatCard({
  title, value, hint, icon, tone = 'default', onClick,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  onClick?: () => void;
}) {
  const accent = {
    default: 'border-l-[#0b4f2a]',
    good: 'border-l-emerald-500',
    warn: 'border-l-[#d7a928]',
    bad: 'border-l-red-500',
  }[tone];
  return (
    <Card
      className={cn('border-l-4', accent, onClick && 'cursor-pointer transition-shadow hover:shadow-md')}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <span className="text-[#0b4f2a] dark:text-[#d7a928]">{icon}</span>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title, description, action, children, className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base text-foreground">{title}</CardTitle>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function OnlineDot({ online, label = true }: { online: boolean; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]' : 'bg-gray-300')} />
      {label && <span className={online ? 'text-emerald-700' : 'text-muted-foreground'}>{online ? 'Online' : 'Offline'}</span>}
    </span>
  );
}

export function StatusBadge({ active, mustChange }: { active: boolean; mustChange?: boolean }) {
  if (!active) return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Disabled</Badge>;
  if (mustChange)
    return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Password reset pending</Badge>;
  return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>;
}

export function RolePill({ name, admin }: { name: string; admin?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        admin ? 'bg-[#0b4f2a] text-white dark:bg-[#d7a928] dark:text-[#063f20]' : 'bg-[#0b4f2a]/10 text-[#0b4f2a] dark:bg-[#d7a928]/15 dark:text-[#d7a928]',
      )}
    >
      {name}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function LoadingRows({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-[#d7a928]" /> {label}
    </div>
  );
}

export function Pager({
  page, count, pageSize, onPage,
}: { page: number; count: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
      <span>
        Page {page} of {pages} · {formatNumber(count)} total
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export const primaryButton = 'bg-[#0b4f2a] text-white hover:bg-[#063f20]';

// ---------------------------------------------------------------- dialogs

/** Confirms a sensitive action and collects the reason that goes into the audit log. */
export function ReasonDialog({
  open, onOpenChange, title, description, confirmLabel, destructive, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= 5;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) setReason(''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (kept in the audit log)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Officer forgot password; identity confirmed in person"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button
            className={destructive ? 'bg-red-600 text-white hover:bg-red-700' : primaryButton}
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                setReason('');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shows a one-time password exactly once. */
export function TempPasswordDialog({
  password, username, onClose,
}: { password: string | null; username?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={!!password} onOpenChange={(o) => { if (!o) { setCopied(false); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#d7a928]" /> One-time password
          </DialogTitle>
          <DialogDescription>
            Give this to {username || 'the officer'} in person. It is shown only once and they must replace it at
            their next sign-in. It is not stored anywhere readable.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-md border-2 border-dashed border-[#d7a928] bg-[#d7a928]/10 px-4 py-3">
          <code className="select-all font-mono text-xl tracking-wider text-[#063f20] dark:text-[#d7a928]">{password}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (password) await navigator.clipboard?.writeText(password);
              setCopied(true);
            }}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button className={primaryButton} onClick={() => { setCopied(false); onClose(); }}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
