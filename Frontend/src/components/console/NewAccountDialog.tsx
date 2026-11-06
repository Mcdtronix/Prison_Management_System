/**
 * New user account, for HQ, provincial and station system admins.
 *
 * Two ways to create one:
 * - Existing officer: pick an officer already in the HR database (in your
 *   area, without an account). Their names come from the HR record.
 * - New officer: type their details. They are registered in the HR database
 *   and posted to the chosen unit in the same step.
 */
import { useEffect, useState } from 'react';
import { Check, Search, UserPlus, Users } from 'lucide-react';

import { consoleApi, type ConsoleOfficer } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { primaryButton } from '@/components/console/ConsoleUI';
import { cn } from '@/lib/utils';

export type UnitOption = { id: number; label: string; type: string };
type Mode = 'existing' | 'new';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const SERVICE_NUMBER = /^[0-9]{7}[A-Z]$/;
const NATIONAL_ID = /^[0-9]{2}-[0-9]{6,7}\s?[A-Z]\s?[0-9]{2}$/;

const EMPTY_NEW = {
  username: '', first_name: '', other_names: '', last_name: '', national_id: '',
  gender: '', date_of_birth: '', date_of_attestation: '',
};

/** Search-as-you-type list of officers in the admin's area who have no account yet. */
function OfficerPicker({ selected, onSelect }: {
  selected: ConsoleOfficer | null; onSelect: (o: ConsoleOfficer | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ConsoleOfficer[] | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;
    const t = window.setTimeout(async () => {
      const res = await consoleApi.officers({ q, account: 'none', page_size: 20 });
      if (!live) return;
      setResults(res.data?.results || []);
      setCount(res.data?.count || 0);
    }, 250);
    return () => { live = false; window.clearTimeout(t); };
  }, [q]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, service number or national ID"
          value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-md border" role="listbox" aria-label="Officers without an account">
        {results === null ? (
          <p className="p-3 text-sm text-muted-foreground">Loading officers…</p>
        ) : results.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {q ? 'No officer without an account matches.' : 'Every officer in your area already has an account.'}
          </p>
        ) : (
          results.map((o) => {
            const active = selected?.service_number === o.service_number;
            const inactive = o.current_status !== 'ACTIVE';
            return (
              <button key={o.service_number} type="button" role="option" aria-selected={active}
                disabled={inactive}
                onClick={() => onSelect(active ? null : o)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0',
                  active ? 'bg-[#0b4f2a]/10' : 'hover:bg-muted/60',
                  inactive && 'cursor-not-allowed opacity-50',
                )}>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{o.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{o.service_number}</span>
                    {' · '}{o.station || 'Not posted'}
                    {inactive && ` · ${o.current_status.toLowerCase()}`}
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-[#0b4f2a]" />}
              </button>
            );
          })
        )}
      </div>
      {results && count > results.length && (
        <p className="text-xs text-muted-foreground">Showing {results.length} of {count}. Search to narrow the list.</p>
      )}
    </div>
  );
}

export function NewAccountDialog({
  open, onOpenChange, units, onCreated, initialOfficer = null,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  units: UnitOption[];
  onCreated: (pw: string, username: string) => void;
  /** Open straight on "Existing officer" with this officer chosen (from the Officers page). */
  initialOfficer?: ConsoleOfficer | null;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('existing');
  const [officer, setOfficer] = useState<ConsoleOfficer | null>(null);
  const [person, setPerson] = useState(EMPTY_NEW);
  const [access, setAccess] = useState({ email: '', org_unit: '', role: '' });
  const [roles, setRoles] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Reset on open; a station admin has one unit, so choose it for them.
  useEffect(() => {
    if (!open) return;
    setMode('existing');
    setOfficer(initialOfficer);
    setPerson(EMPTY_NEW);
    setErrors({});
    setAccess({ email: '', org_unit: units.length === 1 ? String(units[0].id) : '', role: '' });
  }, [open, initialOfficer, units]);

  useEffect(() => {
    setRoles([]);
    setAccess((a) => ({ ...a, role: '' }));
    if (access.org_unit) consoleApi.grantableRoles(Number(access.org_unit)).then((r) => setRoles(r.data || []));
  }, [access.org_unit]);

  const role = roles.find((r) => String(r.id) === access.role);
  const personValid =
    SERVICE_NUMBER.test(person.username) && person.first_name.trim() && person.last_name.trim()
    && NATIONAL_ID.test(person.national_id) && person.gender && person.date_of_birth && person.date_of_attestation;
  const valid = Boolean(access.role && access.org_unit && (mode === 'existing' ? officer : personValid));

  const submit = async () => {
    setBusy(true);
    setErrors({});
    const common = { email: access.email, role: Number(access.role), org_unit: Number(access.org_unit) };
    const body = mode === 'existing'
      ? { ...common, officer: officer!.service_number }
      : { ...common, ...person, national_id: person.national_id.toUpperCase() };
    const res = await consoleApi.createUser(body);
    setBusy(false);
    if (res.error) {
      if (res.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, v.join(' ')])));
      }
      toast({ title: 'Could not create account', description: res.error, variant: 'destructive' });
      return;
    }
    if (res.data.officer_registered) {
      toast({ title: 'Officer registered', description: `${res.data.username} was added to the officer database.` });
    }
    onOpenChange(false);
    onCreated(res.data.temporary_password, res.data.username);
  };

  const setP = (k: keyof typeof EMPTY_NEW) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = k === 'username' || k === 'national_id' ? e.target.value.toUpperCase() : e.target.value;
    setPerson({ ...person, [k]: v });
  };
  const setA = (k: keyof typeof access) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAccess({ ...access, [k]: e.target.value });
  const fieldError = (k: string) => errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>;

  const tab = (value: Mode, icon: JSX.Element, label: string) => (
    <button type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        mode === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}>
      {icon}{label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New user account</DialogTitle>
          <DialogDescription>
            A one-time password is generated. The officer must replace it at first sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Who is the account for">
            {tab('existing', <Users className="h-4 w-4" />, 'Existing officer')}
            {tab('new', <UserPlus className="h-4 w-4" />, 'New officer')}
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <Label>Officer</Label>
              <OfficerPicker selected={officer} onSelect={setOfficer} />
              {fieldError('officer')}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                For an officer who is not in the officer database yet. They are registered and posted to the unit below.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sn">Service number</Label>
                  <Input id="sn" value={person.username} onChange={setP('username')} placeholder="1234567A" maxLength={8} />
                  {fieldError('username')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nid">National ID</Label>
                  <Input id="nid" value={person.national_id} onChange={setP('national_id')} placeholder="63-1234567 A 12" />
                  {fieldError('national_id')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fn">First name</Label>
                  <Input id="fn" value={person.first_name} onChange={setP('first_name')} />
                  {fieldError('first_name')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ln">Surname</Label>
                  <Input id="ln" value={person.last_name} onChange={setP('last_name')} />
                  {fieldError('last_name')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="on">Other names (optional)</Label>
                  <Input id="on" value={person.other_names} onChange={setP('other_names')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gd">Gender</Label>
                  <select id="gd" className={selectClass} value={person.gender} onChange={setP('gender')}>
                    <option value="">Choose</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {fieldError('gender')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input id="dob" type="date" value={person.date_of_birth} onChange={setP('date_of_birth')} />
                  {fieldError('date_of_birth')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doa">Date of attestation</Label>
                  <Input id="doa" type="date" value={person.date_of_attestation} onChange={setP('date_of_attestation')} />
                  {fieldError('date_of_attestation')}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="ou">Unit</Label>
              <select id="ou" className={selectClass} value={access.org_unit} onChange={setA('org_unit')}>
                <option value="">Choose where they work</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rl">Role</Label>
              <select id="rl" className={selectClass} value={access.role} onChange={setA('role')} disabled={!access.org_unit}>
                <option value="">{access.org_unit ? 'Choose a role' : 'Choose a unit first'}</option>
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
              {access.org_unit && roles.length === 0 && (
                <p className="text-xs text-muted-foreground">You cannot grant any role at this unit.</p>
              )}
              {fieldError('role')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="em">Email (optional)</Label>
              <Input id="em" type="email" value={access.email} onChange={setA('email')} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className={primaryButton} disabled={!valid || busy} onClick={submit}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
