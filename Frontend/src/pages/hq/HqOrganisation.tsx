import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, Landmark, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { consoleApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  EmptyState, LoadingRows, SectionCard, formatBytes, primaryButton,
} from '@/components/console/ConsoleUI';
import {
  AdminKind, CreateSystemAdminDialog, UnitOfficersSheet, UnitOfficersTable, UnitOption, useUnitOfficers,
} from '@/components/console/SystemAdmins';

type Unit = {
  id: number; code: string; name: string; location?: string; active: boolean;
  users: number; online: number; storage_bytes: number; records: number;
  system_admins: number; system_admin_limit: number | null;
};
type Province = Unit & {
  stations: Unit[]; total_users: number; total_online: number; total_storage_bytes: number;
};

const toCode = (name: string) =>
  name.toUpperCase().replace(/\b(PROVINCE|PRISON|METROPOLITAN)\b/g, '').trim().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

/** "1/2" system admins: amber when there are none, muted when full. */
function AdminCount({ unit }: { unit: Unit }) {
  if (unit.system_admin_limit == null) return null;
  const n = unit.system_admins || 0;
  const tone = n === 0 ? 'text-amber-700 dark:text-amber-400' : n >= unit.system_admin_limit
    ? 'text-muted-foreground' : 'text-foreground';
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${tone}`} title="System admins (limit)">
      <ShieldCheck className="h-3.5 w-3.5" />{n}/{unit.system_admin_limit}
    </span>
  );
}

/** Opens the unit's officers table. */
function OfficersButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-normal text-[#0b4f2a] hover:bg-[#0b4f2a]/10 dark:text-[#d7a928] dark:hover:bg-[#d7a928]/10">
      <Users className="h-3.5 w-3.5" /> Officers
    </button>
  );
}

/** A station system admin's own station: its figures and its officers. Nothing outside it. */
function StationHome({ station, provinceName }: { station: Unit; provinceName?: string | null }) {
  const navigate = useNavigate();
  const { current, error } = useUnitOfficers(station.id);
  const facts: [string, string | number][] = [
    ['Accounts', station.users],
    ['Online now', station.online],
    ['Stored', formatBytes(station.storage_bytes)],
  ];
  return (
    <div className="space-y-6">
      <SectionCard
        title={station.name}
        description={[provinceName, station.code].filter(Boolean).join(' · ')}
        action={
          <Button variant="outline" onClick={() => navigate(`/hq/users?org_unit=${station.id}`)}>
            <Users className="mr-2 h-4 w-4" /> Manage accounts
          </Button>
        }
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-md border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">{value}</dd>
            </div>
          ))}
          <div className="rounded-md border p-3">
            <dt className="text-xs text-muted-foreground">System admins</dt>
            <dd className="mt-1 text-lg font-semibold"><AdminCount unit={station} /></dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard title="Station officers" description="Every account assigned at this station.">
        <UnitOfficersTable current={current} error={error} />
      </SectionCard>
    </div>
  );
}

function CreateUnitDialog({
  kind, provinces, open, onOpenChange, onCreated,
}: {
  kind: 'province' | 'station';
  provinces: Province[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [short, setShort] = useState('');
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setName(''); setCode(''); setShort(''); setParent(''); } }, [open]);

  const valid = name.trim().length >= 3 && /^[A-Z0-9_]{2,50}$/.test(code) && short.trim().length >= 2
    && (kind === 'province' || !!parent);

  const submit = async () => {
    setBusy(true);
    const body = { name: name.trim(), code, code_short: short.trim() };
    const res = kind === 'province'
      ? await consoleApi.createProvince(body)
      : await consoleApi.createStation({ ...body, parent: Number(parent) });
    setBusy(false);
    if (res.error) {
      toast({ title: `Could not create ${kind}`, description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: `${kind === 'province' ? 'Provincial command centre' : 'Station'} created`, description: name });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'province' ? 'New provincial command centre' : 'New station'}</DialogTitle>
          <DialogDescription>
            {kind === 'province'
              ? 'Provinces sit directly under National HQ.'
              : 'Stations sit under a provincial command centre.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {kind === 'station' && (
            <div className="space-y-2">
              <Label htmlFor="parent">Province</Label>
              <select id="parent" value={parent} onChange={(e) => setParent(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Choose a province</option>
                {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="uname">Name</Label>
            <Input id="uname" value={name} placeholder={kind === 'province' ? 'e.g. Midlands Province' : 'e.g. Gweru Prison'}
              onChange={(e) => {
                setName(e.target.value);
                const auto = toCode(e.target.value);
                setCode(auto.slice(0, 50));
                setShort(auto.slice(0, 20));
              }} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ucode">Code</Label>
              <Input id="ucode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <p className="text-xs text-muted-foreground">Capitals, digits and _ only. Cannot be reused.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ushort">Short code</Label>
              <Input id="ushort" value={short} maxLength={20} onChange={(e) => setShort(e.target.value)} />
              <p className="text-xs text-muted-foreground">Used in mailbox addresses.</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className={primaryButton} disabled={!valid || busy} onClick={submit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const HqOrganisation = () => {
  const navigate = useNavigate();
  const [tree, setTree] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState<'province' | 'station' | null>(null);
  const [view, setView] = useState<'provinces' | 'stations'>('provinces');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [panelUnit, setPanelUnit] = useState<number | null>(null);
  const [panelKey, setPanelKey] = useState(0);
  const [adminDialog, setAdminDialog] = useState<{ kind: AdminKind; unitId?: number } | null>(null);

  const load = async () => {
    const res = await consoleApi.orgTree();
    if (res.error) setError(res.error);
    else setTree(res.data);
  };
  useEffect(() => { load(); }, []);

  const provinces: Province[] = tree?.provinces || [];
  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return provinces;
    return provinces
      .map((p) => {
        const stations = p.stations.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(f));
        const hit = `${p.name} ${p.code}`.toLowerCase().includes(f);
        return hit || stations.length ? { ...p, stations: hit ? p.stations : stations } : null;
      })
      .filter(Boolean) as Province[];
  }, [provinces, filter]);

  // Flat list of every station with its province, for the "All stations" view.
  const stationRows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return provinces
      .filter((p) => !provinceFilter || String(p.id) === provinceFilter)
      .flatMap((p) => p.stations.map((s) => ({ ...s, province: p })))
      .filter((s) => !f || `${s.name} ${s.code} ${s.province.name}`.toLowerCase().includes(f))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [provinces, filter, provinceFilter]);

  const provinceOptions: UnitOption[] = provinces.map((p) => ({
    id: p.id, name: p.name, admins: p.system_admins, limit: p.system_admin_limit,
  }));
  const stationOptions: UnitOption[] = provinces.flatMap((p) => p.stations.map((s) => ({
    id: s.id, name: s.name, group: p.name, admins: s.system_admins, limit: s.system_admin_limit,
  })));

  const adminCreated = (unitId: number) => {
    // Show the new admin straight away in that unit's officers table.
    setPanelUnit(unitId);
    setPanelKey((k) => k + 1);
    load();
  };

  if (error) return <EmptyState>Could not load the organisation: {error}</EmptyState>;
  if (!tree) return <LoadingRows label="Loading provinces and stations…" />;

  const stationCount = provinces.reduce((n, p) => n + p.stations.length, 0);
  const goUsers = (id: number) => navigate(`/hq/users?org_unit=${id}`);
  const national = tree.scope !== 'LIMITED';

  if (tree.scope_level === 'STATION') {
    const own: Unit | undefined = tree.stations?.[0] || provinces[0]?.stations[0];
    return own
      ? <StationHome station={own} provinceName={tree.scope_unit?.parent_name} />
      : <EmptyState>Your station could not be found.</EmptyState>;
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={national ? (tree.national ? tree.national.name : 'National HQ') : (provinces[0]?.name || 'Your province')}
        description={national
          ? `${provinces.length} provincial command centres · ${stationCount} stations`
          : `${stationCount} station${stationCount === 1 ? '' : 's'}`}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setDialog('station')} disabled={!provinces.length}>
              <Plus className="mr-2 h-4 w-4" /> Station
            </Button>
            {national && (
              <Button variant="outline" onClick={() => setDialog('province')}>
                <Plus className="mr-2 h-4 w-4" /> Provincial command centre
              </Button>
            )}
            {national ? (
              <Button className={primaryButton} onClick={() => setAdminDialog({ kind: 'province' })}
                disabled={!provinces.length}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Provincial admin
              </Button>
            ) : (
              <Button className={primaryButton} onClick={() => setAdminDialog({ kind: 'station' })}
                disabled={!stationCount}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Station admin
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="View" className="inline-flex rounded-md border p-0.5 text-sm">
            {([['provinces', 'By command centre'], ['stations', 'All stations']] as const).map(([key, label]) => (
              <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}
                className={`rounded px-3 py-1.5 ${view === key
                  ? 'bg-[#0b4f2a] text-white'
                  : 'text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={view === 'stations' ? 'Find a station' : 'Find a province or station'}
              value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {view === 'stations' && (
            <select aria-label="Filter by command centre" value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All command centres</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {view === 'stations' ? (
          stationRows.length === 0 ? (
            <EmptyState>No stations match.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Station</th>
                    <th className="px-4 py-3 text-left">Command centre</th>
                    <th className="hidden px-4 py-3 text-left md:table-cell">Code</th>
                    <th className="px-4 py-3 text-right">Admins</th>
                    <th className="px-4 py-3 text-right">Users</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">Online</th>
                  </tr>
                </thead>
                <tbody>
                  {stationRows.map((s) => (
                    <tr key={s.id} className="border-t hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-foreground">
                          <Building2 className="h-4 w-4 text-muted-foreground" /> {s.name}
                          {!s.active && <span className="text-xs text-red-600">(inactive)</span>}
                          <OfficersButton onClick={() => setPanelUnit(s.id)} />
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button className="text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => setProvinceFilter(String(s.province.id))}>{s.province.name}</button>
                      </td>
                      <td className="hidden px-4 py-2.5 font-mono text-xs md:table-cell">{s.code}</td>
                      <td className="px-4 py-2.5 text-right"><AdminCount unit={s} /></td>
                      <td className="px-4 py-2.5 text-right">
                        <button className="text-[#0b4f2a] dark:text-[#d7a928] underline-offset-2 hover:underline"
                          onClick={() => goUsers(s.id)}>{s.users}</button>
                      </td>
                      <td className="hidden px-4 py-2.5 text-right sm:table-cell">{s.online}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                {stationRows.length} station{stationRows.length === 1 ? '' : 's'}
              </p>
            </div>
          )
        ) : (<>
        {national && tree.national && (
          <button onClick={() => goUsers(tree.national.id)}
            className="mb-3 flex w-full items-center justify-between rounded-md bg-[#0b4f2a] px-4 py-3 text-left text-white">
            <span className="flex items-center gap-2 font-medium"><Landmark className="h-4 w-4 text-[#d7a928]" /> {tree.national.name}</span>
            <span className="text-sm text-gray-200">{tree.national.users} users at HQ · {tree.national.online} online</span>
          </button>
        )}

        {visible.length === 0 ? (
          <EmptyState>No provinces match.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">Code</th>
                  <th className="px-4 py-3 text-right">Admins</th>
                  <th className="px-4 py-3 text-right">Users</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">Online</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">Storage</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const expanded = open[p.id] ?? !!filter;
                  return [
                    <tr key={p.id} className="cursor-pointer border-t bg-[#0b4f2a]/5 hover:bg-[#0b4f2a]/10"
                      onClick={() => setOpen({ ...open, [p.id]: !expanded })}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <Landmark className="h-4 w-4 text-[#0b4f2a] dark:text-[#d7a928]" />
                          {p.name}
                          <span className="text-xs font-normal text-muted-foreground">({p.stations.length} stations)</span>
                          <OfficersButton onClick={() => setPanelUnit(p.id)} />
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">{p.code}</td>
                      <td className="px-4 py-3 text-right"><AdminCount unit={p} /></td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-[#0b4f2a] dark:text-[#d7a928] underline-offset-2 hover:underline"
                          onClick={(e) => { e.stopPropagation(); goUsers(p.id); }}>{p.total_users}</button>
                      </td>
                      <td className="hidden px-4 py-3 text-right sm:table-cell">{p.total_online}</td>
                      <td className="hidden px-4 py-3 text-right sm:table-cell">{formatBytes(p.total_storage_bytes)}</td>
                    </tr>,
                    ...(expanded
                      ? p.stations.length
                        ? p.stations.map((s) => (
                          <tr key={`s${s.id}`} className="border-t hover:bg-muted/40">
                            <td className="py-2.5 pl-14 pr-4">
                              <span className="flex items-center gap-2 text-foreground">
                                <Building2 className="h-4 w-4 text-muted-foreground" /> {s.name}
                                {!s.active && <span className="text-xs text-red-600">(inactive)</span>}
                                <OfficersButton onClick={() => setPanelUnit(s.id)} />
                              </span>
                            </td>
                            <td className="hidden px-4 py-2.5 font-mono text-xs md:table-cell">{s.code}</td>
                            <td className="px-4 py-2.5 text-right"><AdminCount unit={s} /></td>
                            <td className="px-4 py-2.5 text-right">
                              <button className="text-[#0b4f2a] dark:text-[#d7a928] underline-offset-2 hover:underline"
                                onClick={() => goUsers(s.id)}>{s.users}</button>
                            </td>
                            <td className="hidden px-4 py-2.5 text-right sm:table-cell">{s.online}</td>
                            <td className="hidden px-4 py-2.5 text-right sm:table-cell">{formatBytes(s.storage_bytes)}</td>
                          </tr>
                        ))
                        : [<tr key={`e${p.id}`} className="border-t"><td colSpan={6} className="py-3 pl-14 text-xs text-muted-foreground">No stations yet.</td></tr>]
                      : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
        </>)}
      </SectionCard>

      <CreateUnitDialog kind={dialog || 'province'} provinces={provinces} open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)} onCreated={load} />

      <UnitOfficersSheet unitId={panelUnit} refreshKey={panelKey}
        onOpenChange={(o) => !o && setPanelUnit(null)}
        onAddAdmin={(unitId, kind) => setAdminDialog({ kind, unitId })} />

      <CreateSystemAdminDialog open={!!adminDialog} kind={adminDialog?.kind || 'province'}
        units={adminDialog?.kind === 'station' ? stationOptions : provinceOptions}
        defaultUnitId={adminDialog?.unitId} onOpenChange={(o) => !o && setAdminDialog(null)}
        onCreated={adminCreated} />
    </div>
  );
};

export default HqOrganisation;
