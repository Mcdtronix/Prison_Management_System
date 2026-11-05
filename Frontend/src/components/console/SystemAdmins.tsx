/**
 * Provincial and station system admins.
 *
 * - UnitOfficersSheet: the "Provincial Command officers" or "Station officers"
 *   table for one unit, with its system-admin slots (at most 2).
 * - CreateSystemAdminDialog: province or station, service number, password.
 *   The service number is the username; the new admin changes the password
 *   at first sign-in. The server enforces the limits and the scope.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';
import { consoleApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  EmptyState, LoadingRows, OnlineDot, RolePill, StatusBadge, primaryButton, timeAgo,
} from './ConsoleUI';

export const SERVICE_NUMBER_RE = /^[0-9]{7}[A-Z]$/;
const MIN_PASSWORD = 10;

export type AdminKind = 'province' | 'station';
export type UnitOption = { id: number; name: string; group?: string; admins?: number; limit?: number | null };

/** "org_unit: Midlands already has…" -> "Midlands already has…" */
const cleanError = (e: string) => e.replace(/^(org_unit|service_number|password|Password|role|is_active):\s*/, '');

type SlotInfo = {
  role_code: string; role_name: string; used: number; limit: number | null;
  can_create: boolean; reason: string | null;
};

type OfficerRow = {
  id: number; username: string; full_name: string; is_active: boolean; online: boolean;
  last_seen: string | null; is_system_admin: boolean;
  password: { must_change: boolean };
  roles_here: { role_code: string; role_name: string; department_name: string }[];
};

// ---------------------------------------------------------------- create dialog

export function CreateSystemAdminDialog({
  open, onOpenChange, kind, units, defaultUnitId, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: AdminKind;
  units: UnitOption[];
  defaultUnitId?: number | null;
  onCreated: (unitId: number, username: string) => void;
}) {
  const { toast } = useToast();
  const [unit, setUnit] = useState('');
  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUnit(defaultUnitId ? String(defaultUnitId) : '');
    } else {
      setServiceNumber(''); setPassword(''); setConfirm(''); setShow(false); setError(null);
    }
  }, [open, defaultUnitId]);

  const label = kind === 'province' ? 'Province' : 'Station';
  const roleLabel = kind === 'province' ? 'provincial system admin' : 'station system admin';
  const chosen = units.find((u) => String(u.id) === unit);
  const full = !!chosen && chosen.limit != null && (chosen.admins ?? 0) >= chosen.limit;

  // Group stations under their province in the picker.
  const groups = useMemo(() => {
    const map = new Map<string, UnitOption[]>();
    units.forEach((u) => {
      const key = u.group || '';
      map.set(key, [...(map.get(key) || []), u]);
    });
    return [...map.entries()];
  }, [units]);

  const snValid = SERVICE_NUMBER_RE.test(serviceNumber);
  const pwShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = !!unit && !full && snValid && password.length >= MIN_PASSWORD && confirm === password;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await consoleApi.createSystemAdmin({ org_unit: Number(unit), service_number: serviceNumber, password });
    setBusy(false);
    if (res.error) {
      setError(cleanError(res.error));
      return;
    }
    toast({
      title: `${res.data.username} created`,
      description: `They can sign in now and must change the password at first sign-in.`,
    });
    onOpenChange(false);
    onCreated(Number(unit), res.data.username);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {roleLabel}</DialogTitle>
          <DialogDescription>
            The service number is the username. At most two {roleLabel}s per {label.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !busy) submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="sa-unit">{label}</Label>
            <select id="sa-unit" value={unit} onChange={(e) => setUnit(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Choose a {label.toLowerCase()}</option>
              {groups.map(([group, list]) => {
                const options = list.map((u) => {
                  const isFull = u.limit != null && (u.admins ?? 0) >= u.limit;
                  return (
                    <option key={u.id} value={u.id} disabled={isFull}>
                      {u.name}{u.limit != null ? ` (${u.admins ?? 0}/${u.limit}${isFull ? ', full' : ''})` : ''}
                    </option>
                  );
                });
                return group ? <optgroup key={group} label={group}>{options}</optgroup> : options;
              })}
            </select>
            {full && <p className="text-xs text-red-600">{chosen?.name} already has two admins.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sa-sn">Service number</Label>
            <Input id="sa-sn" value={serviceNumber} placeholder="1234567A" maxLength={8} autoComplete="off"
              className="font-mono uppercase"
              onChange={(e) => setServiceNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))} />
            <p className={`text-xs ${serviceNumber && !snValid ? 'text-red-600' : 'text-muted-foreground'}`}>
              7 digits followed by a letter. This is the username they sign in with.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sa-pw">Password</Label>
            <div className="relative">
              <Input id="sa-pw" type={show ? 'text' : 'password'} value={password} autoComplete="new-password"
                className="pr-10" onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className={`text-xs ${pwShort ? 'text-red-600' : 'text-muted-foreground'}`}>
              At least {MIN_PASSWORD} characters, not all digits. They must change it at first sign-in.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sa-pw2">Confirm password</Label>
            <Input id="sa-pw2" type={show ? 'text' : 'password'} value={confirm} autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} />
            {mismatch && <p className="text-xs text-red-600">Passwords do not match.</p>}
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className={primaryButton} disabled={!valid || busy}>
              {busy ? 'Creating…' : 'Create admin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- officers panel

export function UnitOfficersSheet({
  unitId, onOpenChange, onAddAdmin, refreshKey,
}: {
  unitId: number | null;
  onOpenChange: (o: boolean) => void;
  onAddAdmin: (unitId: number, kind: AdminKind) => void;
  /** Bump to reload, e.g. after an admin was created. */
  refreshKey: number;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) return;
    let live = true;
    setError(null);
    consoleApi.unitOfficers(unitId).then((res) => {
      if (!live) return;
      if (res.error) setError(res.error);
      else setData(res.data);
    });
    return () => { live = false; };
  }, [unitId, refreshKey]);

  const current = data && data.unit?.id === unitId ? data : null;
  const isProvince = current?.unit.unit_type === 'PROVINCIAL_HQ';
  const title = isProvince ? 'Provincial Command officers' : 'Station officers';
  const slots: SlotInfo | null = current?.system_admins || null;
  const officers: OfficerRow[] = current?.officers || [];

  return (
    <Sheet open={!!unitId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pr-6 text-left">
          <SheetTitle>{current ? `${title}: ${current.unit.name}` : 'Officers'}</SheetTitle>
          <SheetDescription>
            {current
              ? isProvince
                ? 'Accounts assigned at the provincial command centre. Station staff are listed under each station.'
                : `Accounts assigned at this station${current.unit.parent_name ? `, ${current.unit.parent_name}` : ''}.`
              : 'Loading…'}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <div className="mt-6"><EmptyState>Could not load officers: {error}</EmptyState></div>
        ) : !current ? (
          <div className="mt-6"><LoadingRows label="Loading officers…" /></div>
        ) : (
          <div className="mt-6 space-y-4">
            {slots && (
              <div className="flex flex-col gap-3 rounded-md border border-[#0b4f2a]/20 bg-[#0b4f2a]/5 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#d7a928]/30 dark:bg-[#d7a928]/10">
                <div className="flex items-start gap-2 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4f2a] dark:text-[#d7a928]" />
                  <div>
                    <p className="font-medium text-foreground">
                      {slots.role_name}s: {slots.used} of {slots.limit}
                    </p>
                    {!slots.can_create && slots.reason && (
                      <p className="text-xs text-muted-foreground">{slots.reason}</p>
                    )}
                  </div>
                </div>
                <Button size="sm" className={primaryButton} disabled={!slots.can_create}
                  onClick={() => onAddAdmin(current.unit.id, isProvince ? 'province' : 'station')}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add system admin
                </Button>
              </div>
            )}

            {officers.length === 0 ? (
              <EmptyState>No accounts are assigned here yet.</EmptyState>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left">Service no.</th>
                      <th className="px-3 py-2.5 text-left">Name</th>
                      <th className="px-3 py-2.5 text-left">Role</th>
                      <th className="hidden px-3 py-2.5 text-left sm:table-cell">Status</th>
                      <th className="hidden px-3 py-2.5 text-left md:table-cell">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officers.map((o) => (
                      <tr key={o.id} className="cursor-pointer border-t hover:bg-muted/40"
                        onClick={() => navigate(`/hq/users/${o.id}`)}>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          <span className="flex items-center gap-2"><OnlineDot online={o.online} label={false} />{o.username}</span>
                        </td>
                        <td className="px-3 py-2.5 text-foreground">{o.full_name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {o.roles_here.map((r) => (
                              <RolePill key={r.role_code} name={r.role_name}
                                admin={r.role_code === slots?.role_code} />
                            ))}
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <StatusBadge active={o.is_active} mustChange={o.password?.must_change} />
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">{timeAgo(o.last_seen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
