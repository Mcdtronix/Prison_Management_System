/**
 * Officers: the HR officer database for the admin's area.
 *
 * HQ sees every officer, a provincial admin their province, a station admin
 * their station (the server decides; see Auth/scoping.py). Each row shows
 * whether the officer has a system account, with a shortcut to create one.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Search } from 'lucide-react';

import { consoleApi, type ConsoleOfficer } from '@/lib/api';
import { NewAccountDialog } from '@/components/console/NewAccountDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EmptyState, LoadingRows, Pager, SectionCard, TempPasswordDialog, formatNumber, primaryButton,
} from '@/components/console/ConsoleUI';
import { loadUnitOptions, type UnitOption } from './HqUsers';

const PAGE_SIZE = 25;
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  SUSPENDED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

function OfficerStatus({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status] || 'bg-muted text-muted-foreground ring-border'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

const HqOfficers = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [data, setData] = useState<{ count: number; results: ConsoleOfficer[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(params.get('q') || '');
  const [creatingFor, setCreatingFor] = useState<ConsoleOfficer | null>(null);
  const [temp, setTemp] = useState<{ pw: string; user: string; expiresAt?: string | null } | null>(null);

  const filters = {
    org_unit: params.get('org_unit') || '',
    account: params.get('account') || '',
    page: Number(params.get('page') || 1),
  };

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => { loadUnitOptions().then(setUnits); }, []);

  const load = async () => {
    setData(null);
    const res = await consoleApi.officers({ ...filters, q: params.get('q') || '', page_size: PAGE_SIZE });
    if (res.error) setError(res.error);
    else { setError(null); setData(res.data!); }
  };
  useEffect(() => { load(); }, [params]);

  useEffect(() => {
    const t = window.setTimeout(() => { if (q !== (params.get('q') || '')) update({ q }); }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Officers"
        description={data ? `${formatNumber(data.count)} officers in the officer database for your area.` : 'The officer database for your area.'}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name, service no. or national ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {units.length > 1 && (
            <select className={selectClass} value={filters.org_unit} onChange={(e) => update({ org_unit: e.target.value })}>
              <option value="">All units</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          )}
          <select className={selectClass} value={filters.account} onChange={(e) => update({ account: e.target.value })}>
            <option value="">With or without an account</option>
            <option value="has">Has an account</option>
            <option value="none">No account yet</option>
          </select>
        </div>

        {error ? (
          <EmptyState>Could not load officers: {error}</EmptyState>
        ) : !data ? (
          <LoadingRows label="Loading officers…" />
        ) : data.results.length === 0 ? (
          <EmptyState>No officers match these filters.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Officer</th>
                    <th className="hidden px-4 py-3 text-left md:table-cell">National ID</th>
                    <th className="hidden px-4 py-3 text-left lg:table-cell">Posted at</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">System account</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((o) => (
                    <tr key={o.service_number} className="cursor-pointer border-t hover:bg-[#0b4f2a]/5"
                      onClick={() => navigate(`/hq/officers/${o.service_number}`)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{o.full_name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{o.service_number}</p>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-foreground/80 md:table-cell">{o.national_id}</td>
                      <td className="hidden px-4 py-3 text-foreground/80 lg:table-cell">{o.station || <span className="text-muted-foreground">Not posted</span>}</td>
                      <td className="px-4 py-3"><OfficerStatus status={o.current_status} /></td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {o.account ? (
                          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/hq/users/${o.account!.id}`)}>
                            {o.account.is_active ? 'View account' : 'View (disabled)'}
                          </Button>
                        ) : o.current_status === 'ACTIVE' ? (
                          <Button size="sm" className={primaryButton} onClick={() => setCreatingFor(o)}>
                            <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Create account
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={filters.page} count={data.count} pageSize={PAGE_SIZE} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </SectionCard>

      <NewAccountDialog open={creatingFor !== null} onOpenChange={(o) => { if (!o) setCreatingFor(null); }}
        units={units} initialOfficer={creatingFor}
        onCreated={(pw, user, expiresAt) => { setTemp({ pw, user, expiresAt }); load(); }} />
      <TempPasswordDialog password={temp?.pw || null} username={temp?.user} expiresAt={temp?.expiresAt} onClose={() => setTemp(null)} />
    </div>
  );
};

export default HqOfficers;
