import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, ShieldAlert } from 'lucide-react';
import { consoleApi, rbacApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  EmptyState, LoadingRows, OnlineDot, Pager, RolePill, SectionCard, StatusBadge, TempPasswordDialog,
  asList, primaryButton, timeAgo,
} from '@/components/console/ConsoleUI';

const PAGE_SIZE = 25;
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export type UnitOption = { id: number; label: string; type: string };

/** National HQ, provinces and stations as an indented list for <select>. */
export async function loadUnitOptions(): Promise<UnitOption[]> {
  const res = await consoleApi.orgTree();
  if (!res.data) return [];
  const out: UnitOption[] = [];
  const t = res.data;
  if (t.national) out.push({ id: t.national.id, label: t.national.name, type: 'NATIONAL_HQ' });
  for (const p of t.provinces) {
    out.push({ id: p.id, label: `— ${p.name}`, type: 'PROVINCIAL_HQ' });
    for (const s of p.stations) out.push({ id: s.id, label: `—— ${s.name}`, type: 'STATION' });
  }
  // A station admin's own station (its province is outside their area).
  for (const s of t.stations || []) out.push({ id: s.id, label: s.name, type: 'STATION' });
  return out;
}

function NewAccountDialog({
  open, onOpenChange, units, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; units: UnitOption[]; onCreated: (pw: string, username: string) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ username: '', first_name: '', last_name: '', email: '', org_unit: '', role: '' });
  const [roles, setRoles] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setForm({ username: '', first_name: '', last_name: '', email: '', org_unit: '', role: '' }); }, [open]);
  useEffect(() => {
    setRoles([]);
    setForm((f) => ({ ...f, role: '' }));
    if (form.org_unit) consoleApi.grantableRoles(Number(form.org_unit)).then((r) => setRoles(r.data || []));
  }, [form.org_unit]);

  const role = roles.find((r) => String(r.id) === form.role);
  const valid = /^[0-9]{7}[A-Z]$/.test(form.username) && form.first_name.trim() && form.last_name.trim() && form.role;

  const submit = async () => {
    setBusy(true);
    const res = await consoleApi.createUser({ ...form, role: Number(form.role), org_unit: Number(form.org_unit) });
    setBusy(false);
    if (res.error) {
      toast({ title: 'Could not create account', description: res.error, variant: 'destructive' });
      return;
    }
    onOpenChange(false);
    onCreated(res.data.temporary_password, res.data.username);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: k === 'username' ? e.target.value.toUpperCase() : e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New user account</DialogTitle>
          <DialogDescription>
            A one-time password is generated. The officer must replace it at first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sn">Service number</Label>
              <Input id="sn" value={form.username} onChange={set('username')} placeholder="1234567A" maxLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="em">Email (optional)</Label>
              <Input id="em" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn">First name</Label>
              <Input id="fn" value={form.first_name} onChange={set('first_name')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln">Surname</Label>
              <Input id="ln" value={form.last_name} onChange={set('last_name')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ou">Unit</Label>
            <select id="ou" className={selectClass} value={form.org_unit} onChange={set('org_unit')}>
              <option value="">Choose where they work</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rl">Role</Label>
            <select id="rl" className={selectClass} value={form.role} onChange={set('role')} disabled={!form.org_unit}>
              <option value="">{form.org_unit ? 'Choose a role' : 'Choose a unit first'}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.department_name ? ` — ${r.department_name}` : ''}</option>
              ))}
            </select>
            {role && (
              <p className="text-xs text-muted-foreground">
                Department: <span className="font-medium text-foreground">{role.department_name || 'Any'}</span>
                {role.is_admin_role && ' · System administrator'}
              </p>
            )}
            {form.org_unit && roles.length === 0 && (
              <p className="text-xs text-muted-foreground">You cannot grant any role at this unit.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className={primaryButton} disabled={!valid || busy} onClick={submit}>Create account</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const HqUsers = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [data, setData] = useState<{ count: number; results: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(params.get('q') || '');
  const [creating, setCreating] = useState(false);
  const [temp, setTemp] = useState<{ pw: string; user: string } | null>(null);

  const filters = {
    org_unit: params.get('org_unit') || '',
    role: params.get('role') || '',
    status: params.get('status') || '',
    page: Number(params.get('page') || 1),
  };

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    loadUnitOptions().then(setUnits);
    rbacApi.getRoles().then((r) => setRoles(asList<any>(r.data).filter((x) => x.is_active)));
  }, []);

  const load = async () => {
    setData(null);
    const res = await consoleApi.users({ ...filters, q: params.get('q') || '', page_size: PAGE_SIZE });
    if (res.error) setError(res.error);
    else { setError(null); setData(res.data); }
  };
  useEffect(() => { load(); }, [params]);

  // Search as you type, after a short pause.
  useEffect(() => {
    const t = window.setTimeout(() => { if (q !== (params.get('q') || '')) update({ q }); }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="User accounts"
        description="Every account in the system. Passwords are stored as one-way hashes and are never shown; reset them from the user's page."
        action={<Button className={primaryButton} onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New account</Button>}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name, service no. or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={selectClass} value={filters.org_unit} onChange={(e) => update({ org_unit: e.target.value })}>
            <option value="">All units</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <select className={selectClass} value={filters.role} onChange={(e) => update({ role: e.target.value })}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className={selectClass} value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Any status</option>
            <option value="online">Online now</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="must_change">Password reset pending</option>
          </select>
        </div>

        {error ? (
          <EmptyState>Could not load users: {error}</EmptyState>
        ) : !data ? (
          <LoadingRows label="Loading accounts…" />
        ) : data.results.length === 0 ? (
          <EmptyState>No accounts match these filters.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Officer</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="hidden px-4 py-3 text-left lg:table-cell">Unit · Department</th>
                    <th className="hidden px-4 py-3 text-left xl:table-cell">Email</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="hidden px-4 py-3 text-left md:table-cell">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((u) => {
                    const adminRole = u.assignments.some((a: any) => a.role_code.endsWith('SYS_ADMIN'));
                    return (
                      <tr key={u.id} className="cursor-pointer border-t hover:bg-[#0b4f2a]/5" onClick={() => navigate(`/hq/users/${u.id}`)}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{u.full_name || '—'}</p>
                          <p className="font-mono text-xs text-muted-foreground">{u.username}</p>
                        </td>
                        <td className="px-4 py-3">
                          {u.primary_role ? <RolePill name={u.primary_role} admin={adminRole} /> : (
                            u.is_superuser
                              ? <span className="inline-flex items-center gap-1 text-xs text-amber-700"><ShieldAlert className="h-3 w-3" /> Break-glass superuser</span>
                              : <span className="text-xs text-muted-foreground">No role</span>
                          )}
                          {u.assignments.length > 1 && <span className="ml-1 text-xs text-muted-foreground">+{u.assignments.length - 1}</span>}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <p className="text-foreground">{u.primary_unit || '—'}</p>
                          <p className="text-xs text-muted-foreground">{u.department || ''}</p>
                        </td>
                        <td className="hidden px-4 py-3 text-foreground/80 xl:table-cell">{u.email || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge active={u.is_active} mustChange={u.password.must_change} />
                            <OnlineDot online={u.online} />
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{timeAgo(u.last_seen || u.last_login)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={filters.page} count={data.count} pageSize={PAGE_SIZE} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </SectionCard>

      <NewAccountDialog open={creating} onOpenChange={setCreating} units={units}
        onCreated={(pw, user) => { setTemp({ pw, user }); load(); }} />
      <TempPasswordDialog password={temp?.pw || null} username={temp?.user} onClose={() => setTemp(null)} />
    </div>
  );
};

export default HqUsers;
