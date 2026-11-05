/**
 * Shell for every messaging screen: folders, Compose, "sending as", signature.
 * Shares limits, the signature and the unread count through MailContext.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Archive, FilePen, Inbox, PenSquare, Send, Signature, Star, Trash2 } from 'lucide-react';
import { PrisonLayout } from '@/components/PrisonLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { mail, type MessagingConfig, type SignatureInfo } from '@/lib/messaging';
import { SignatureDialog } from '@/components/messaging/SignatureDialog';

interface MailContextValue {
  config: MessagingConfig | null;
  signature: SignatureInfo | null;
  unread: number;
  refreshUnread: () => void;
}

const MailContext = createContext<MailContextValue>({ config: null, signature: null, unread: 0, refreshUnread: () => {} });
export const useMail = () => useContext(MailContext);

// Fetched once per sign-in; they rarely change. Keyed to the signed-in
// account so another officer on the same browser never sees these.
let cacheOwner: string | null = null;
let configCache: MessagingConfig | null = null;
let signatureCache: SignatureInfo | null = null;
const currentUser = () => {
  try { return JSON.parse(localStorage.getItem('user_info') || 'null')?.username ?? null; } catch { return null; }
};
const ensureCacheOwner = () => {
  const owner = currentUser();
  if (owner !== cacheOwner) { cacheOwner = owner; configCache = null; signatureCache = null; }
};

const NAV = [
  { to: '/messaging/inbox', label: 'Inbox', icon: Inbox, unread: true },
  { to: '/messaging/starred', label: 'Starred', icon: Star },
  { to: '/messaging/sent', label: 'Sent', icon: Send },
  { to: '/messaging/drafts', label: 'Drafts', icon: FilePen },
  { to: '/messaging/archived', label: 'Archive', icon: Archive },
  { to: '/messaging/trash', label: 'Trash', icon: Trash2 },
];

const POLL_MS = 30_000;

export default function MailLayout({ title, children }: { title: string; children: ReactNode }) {
  ensureCacheOwner();
  const [config, setConfig] = useState<MessagingConfig | null>(configCache);
  const [signature, setSignature] = useState<SignatureInfo | null>(signatureCache);
  const [unread, setUnread] = useState(0);
  const [signatureOpen, setSignatureOpen] = useState(false);

  const refreshUnread = useCallback(async () => {
    const res = await mail.unreadCount();
    if (typeof res.data === 'number') setUnread(res.data);
  }, []);

  useEffect(() => {
    if (!configCache) mail.config().then((r) => { if (r.data) { configCache = r.data; setConfig(r.data); } });
    if (!signatureCache) mail.signature().then((r) => { if (r.data) { signatureCache = r.data; setSignature(r.data); } });
  }, []);

  // Unread count: on load, every 30 s while the tab is visible, and when it regains focus.
  useEffect(() => {
    refreshUnread();
    const tick = () => { if (!document.hidden) refreshUnread(); };
    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshUnread]);

  const mailbox = config?.mailbox;
  const linkClass = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
    isActive ? 'bg-[#0b4f2a]/10 font-medium text-[#0b4f2a] dark:bg-[#d7a928]/15 dark:text-[#d7a928]'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

  return (
    <PrisonLayout title={title} description="Organisational messaging">
      <MailContext.Provider value={{ config, signature, unread, refreshUnread }}>
        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm md:h-[calc(100vh-140px)] md:flex-row">
          {/* Folders: sidebar on desktop */}
          <aside className="hidden w-60 shrink-0 flex-col border-r md:flex" aria-label="Mail folders">
            <div className="p-3">
              <Button asChild className="w-full justify-start bg-[#0b4f2a] text-white hover:bg-[#063f20]">
                <NavLink to="/messaging/compose"><PenSquare className="mr-2 h-4 w-4" /> New message</NavLink>
              </Button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
              {NAV.map(({ to, label, icon: Icon, unread: showUnread }) => (
                <NavLink key={to} to={to} className={linkClass}>
                  <span className="flex items-center gap-3"><Icon className="h-4 w-4" /> {label}</span>
                  {showUnread && unread > 0 && (
                    <span className="rounded-full bg-[#0b4f2a] px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-[#d7a928] dark:text-[#0b4f2a]"
                      aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="space-y-2 border-t p-3 text-xs">
              {mailbox && (
                <div className="text-muted-foreground">
                  <p>Sending as</p>
                  <p className="truncate font-medium text-foreground" title={mailbox.address}>{mailbox.department} · {mailbox.unit}</p>
                </div>
              )}
              <button type="button" onClick={() => setSignatureOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Signature className="h-4 w-4" /> Signature
              </button>
            </div>
          </aside>

          {/* Folders: scrollable strip on phones */}
          <div className="flex items-center gap-2 border-b p-2 md:hidden">
            <Button asChild size="sm" className="shrink-0 bg-[#0b4f2a] text-white hover:bg-[#063f20]">
              <NavLink to="/messaging/compose" aria-label="New message"><PenSquare className="h-4 w-4" /></NavLink>
            </Button>
            <nav className="flex gap-1 overflow-x-auto" aria-label="Mail folders">
              {NAV.map(({ to, label, unread: showUnread }) => (
                <NavLink key={to} to={to} className={({ isActive }) => cn('whitespace-nowrap rounded-full px-3 py-1 text-xs',
                  isActive ? 'bg-[#0b4f2a] text-white' : 'bg-muted text-muted-foreground')}>
                  {label}{showUnread && unread > 0 ? ` (${unread})` : ''}
                </NavLink>
              ))}
            </nav>
            <button type="button" onClick={() => setSignatureOpen(true)} aria-label="Signature"
              className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Signature className="h-4 w-4" /></button>
          </div>

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
        </div>
        <SignatureDialog open={signatureOpen} onOpenChange={setSignatureOpen}
          onSaved={(s) => { signatureCache = s; setSignature(s); }} />
      </MailContext.Provider>
    </PrisonLayout>
  );
}
