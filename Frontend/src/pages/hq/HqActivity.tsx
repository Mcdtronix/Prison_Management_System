import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { consoleApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EmptyState, LoadingRows, OnlineDot, Pager, ReasonDialog, SectionCard, formatDateTime, timeAgo,
} from '@/components/console/ConsoleUI';
import { loadUnitOptions, UnitOption } from './HqUsers';

const PAGE_SIZE = 50;
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const MODULES = ['AUTH', 'RBAC', 'API', 'INMATES', 'HEALTH', 'STORES', 'FARMS', 'HR'];

function useFilters() {
  const [params, setParams] = useSearchParams();
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  return { params, update };
}

function ActivityLog({ units }: { units: UnitOption[] }) {
  const { params, update } = useFilters();
  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState(params.get('q') || '');
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    setData(null);
    consoleApi.activity({
      page, page_size: PAGE_SIZE, q: params.get('q'), org_unit: params.get('org_unit'),
      since: params.get('since'), module: params.get('module'), user: params.get('user'),
    }).then((r) => setData(r.data || { count: 0, results: [], error: r.error }));
  }, [params]);

  useEffect(() => {
    const t = window.setTimeout(() => { if (q !== (params.get('q') || '')) update({ q }); }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Action, user or page" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={selectClass} value={params.get('org_unit') || ''} onChange={(e) => update({ org_unit: e.target.value })}>
          <option value="">All units</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
        <select className={selectClass} value={params.get('since') || ''} onChange={(e) => update({ since: e.target.value })}>
          <option value="">Any time</option>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <select className={selectClass} value={params.get('module') || ''} onChange={(e) => update({ module: e.target.value })}>
          <option value="">All modules</option>
          {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {params.get('user') && (
        <p className="mb-3 text-sm text-muted-foreground">
          Showing one user's actions. <button className="text-[#0b4f2a] dark:text-[#d7a928] underline" onClick={() => update({ user: '' })}>Show everyone</button>
        </p>
      )}
      {!data ? <LoadingRows /> : data.error ? <EmptyState>{data.error}</EmptyState> : data.results.length === 0 ? (
        <EmptyState>No activity matches these filters.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Who</th>
                  <th className="px-4 py-3 text-left">What</th>
                  <th className="hidden px-4 py-3 text-left lg:table-cell">Details</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">IP address</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((a: any) => (
                  <tr key={a.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground" title={formatDateTime(a.timestamp)}>{formatDateTime(a.timestamp)}</td>
                    <td className="px-4 py-3">
                      {a.user_id ? (
                        <Link to={`/hq/users/${a.user_id}`} className="font-medium text-[#0b4f2a] dark:text-[#d7a928] hover:underline">{a.full_name || a.username}</Link>
                      ) : '—'}
                      <p className="text-xs text-muted-foreground">{a.role}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{a.action}</p>
                      <p className="text-xs text-muted-foreground">{a.module}</p>
                    </td>
                    <td className="hidden max-w-xs px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      <p className="truncate" title={a.remarks}>{a.remarks || ''}</p>
                      {a.path && <p className="truncate font-mono" title={a.path}>{a.method} {a.path}</p>}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">{a.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </>
  );
}

function OnlineNow({ units }: { units: UnitOption[] }) {
  const { toast } = useToast();
  const [unit, setUnit] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [ending, setEnding] = useState<any>(null);

  const load = () => consoleApi.online({ org_unit: unit }).then((r) => setRows(r.data || []));
  useEffect(() => {
    setRows(null);
    load();
    const t = window.setInterval(load, 30_000);
    return () => window.clearInterval(t);
  }, [unit]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={`${selectClass} max-w-xs`} value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">All units</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        <span className="text-xs text-muted-foreground">Active in the last 5 minutes · updates every 30 s</span>
      </div>
      {!rows ? <LoadingRows /> : rows.length === 0 ? <EmptyState>Nobody is online right now.</EmptyState> : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Signed in</th>
                <th className="px-4 py-3 text-left">Last active</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">IP address</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <OnlineDot online label={false} />
                      <Link to={`/hq/users/${s.user_id}`} className="font-medium text-[#0b4f2a] dark:text-[#d7a928] hover:underline">{s.full_name || s.username}</Link>
                    </span>
                    <span className="ml-4 font-mono text-xs text-muted-foreground">{s.username}</span>
                  </td>
                  <td className="px-4 py-3">{s.org_unit || '—'}</td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{timeAgo(s.created_at)}</td>
                  <td className="px-4 py-3 text-xs">{timeAgo(s.last_seen_at)}</td>
                  <td className="hidden px-4 py-3 font-mono text-xs lg:table-cell">{s.ip_address || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setEnding(s)}>End session</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ending && (
        <ReasonDialog open onOpenChange={(o) => !o && setEnding(null)} title={`End ${ending.full_name || ending.username}'s session?`}
          description="That device is signed out at its next action." confirmLabel="End session" destructive
          onConfirm={async (reason) => {
            const r = await consoleApi.endSession(ending.id, reason);
            if (r.error) { toast({ title: 'Could not end session', description: r.error, variant: 'destructive' }); return; }
            setEnding(null); load();
          }} />
      )}
    </>
  );
}

function SignIns() {
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    setData(null);
    consoleApi.logins({ page, page_size: PAGE_SIZE, failed: failedOnly ? 1 : undefined }).then((r) => setData(r.data));
  }, [page, failedOnly]);
  return (
    <>
      <label className="mb-4 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-[#0b4f2a]" checked={failedOnly} onChange={(e) => { setPage(1); setFailedOnly(e.target.checked); }} />
        Failed attempts only
      </label>
      {!data ? <LoadingRows /> : data.results.length === 0 ? <EmptyState>No sign-ins recorded.</EmptyState> : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Service number</th>
                  <th className="px-4 py-3 text-left">Result</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">IP address</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((e: any) => (
                  <tr key={e.id} className="border-t">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(e.at)}</td>
                    <td className="px-4 py-3 font-mono">
                      {e.user_id ? <Link className="text-[#0b4f2a] dark:text-[#d7a928] hover:underline" to={`/hq/users/${e.user_id}`}>{e.username}</Link> : e.username || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {e.success ? <span className="text-emerald-700">Signed in</span>
                        : <span className="font-medium text-red-700">Failed · {e.reason.replace('_', ' ')}</span>}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">{e.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}
    </>
  );
}

const HqActivity = () => {
  const [params, setParams] = useSearchParams();
  const [units, setUnits] = useState<UnitOption[]>([]);
  useEffect(() => { loadUnitOptions().then(setUnits); }, []);
  const tab = params.get('tab') || 'log';

  return (
    <SectionCard title="Activity and sign-ins" description="Every change made in the system, who is online, and every sign-in attempt.">
      <Tabs value={tab} onValueChange={(t) => setParams(t === 'log' ? {} : { tab: t }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="log">Activity log</TabsTrigger>
          <TabsTrigger value="online">Online now</TabsTrigger>
          <TabsTrigger value="logins">Sign-ins</TabsTrigger>
        </TabsList>
        <TabsContent value="log"><ActivityLog units={units} /></TabsContent>
        <TabsContent value="online"><OnlineNow units={units} /></TabsContent>
        <TabsContent value="logins"><SignIns /></TabsContent>
      </Tabs>
    </SectionCard>
  );
};

export default HqActivity;
