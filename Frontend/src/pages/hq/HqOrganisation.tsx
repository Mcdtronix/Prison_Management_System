import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, ChevronRight, Landmark, Plus, Search } from 'lucide-react';
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

type Unit = {
  id: number; code: string; name: string; location?: string; active: boolean;
  users: number; online: number; storage_bytes: number; records: number;
};
type Province = Unit & {
  stations: Unit[]; total_users: number; total_online: number; total_storage_bytes: number;
};

const toCode = (name: string) =>
  name.toUpperCase().replace(/\b(PROVINCE|PRISON|METROPOLITAN)\b/g, '').trim().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

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

  if (error) return <EmptyState>Could not load the organisation: {error}</EmptyState>;
  if (!tree) return <LoadingRows label="Loading provinces and stations…" />;

  const stationCount = provinces.reduce((n, p) => n + p.stations.length, 0);
  const goUsers = (id: number) => navigate(`/hq/users?org_unit=${id}`);

  return (
    <div className="space-y-6">
      <SectionCard
        title={tree.national ? tree.national.name : 'National HQ'}
        description={`${provinces.length} provincial command centres · ${stationCount} stations`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialog('station')} disabled={!provinces.length}>
              <Plus className="mr-2 h-4 w-4" /> Station
            </Button>
            <Button className={primaryButton} onClick={() => setDialog('province')}>
              <Plus className="mr-2 h-4 w-4" /> Provincial command centre
            </Button>
          </div>
        }
      >
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Find a province or station" value={filter}
            onChange={(e) => setFilter(e.target.value)} />
        </div>

        {tree.national && (
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
                  <th className="px-4 py-3 text-right">Users</th>
                  <th className="px-4 py-3 text-right">Online</th>
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
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">{p.code}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-[#0b4f2a] dark:text-[#d7a928] underline-offset-2 hover:underline"
                          onClick={(e) => { e.stopPropagation(); goUsers(p.id); }}>{p.total_users}</button>
                      </td>
                      <td className="px-4 py-3 text-right">{p.total_online}</td>
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
                              </span>
                            </td>
                            <td className="hidden px-4 py-2.5 font-mono text-xs md:table-cell">{s.code}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button className="text-[#0b4f2a] dark:text-[#d7a928] underline-offset-2 hover:underline"
                                onClick={() => goUsers(s.id)}>{s.users}</button>
                            </td>
                            <td className="px-4 py-2.5 text-right">{s.online}</td>
                            <td className="hidden px-4 py-2.5 text-right sm:table-cell">{formatBytes(s.storage_bytes)}</td>
                          </tr>
                        ))
                        : [<tr key={`e${p.id}`} className="border-t"><td colSpan={5} className="py-3 pl-14 text-xs text-muted-foreground">No stations yet.</td></tr>]
                      : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <CreateUnitDialog kind={dialog || 'province'} provinces={provinces} open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)} onCreated={load} />
    </div>
  );
};

export default HqOrganisation;
