import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, KeyRound, LogOut, Lock, Mail, Pencil, Plus, ShieldAlert, ShieldCheck, UserCheck, UserX,
} from 'lucide-react';
import { consoleApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  EmptyState, LoadingRows, OnlineDot, ReasonDialog, RolePill, SectionCard, StatusBadge, TempPasswordDialog,
  formatDateTime, formatNumber, primaryButton, timeAgo, unitTypeLabel,
} from '@/components/console/ConsoleUI';
import { loadUnitOptions, UnitOption } from './HqUsers';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

const browser = (ua?: string) => {
  if (!ua) return 'Unknown device';
  const name = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${name} on ${os}` : name;
};

function AddRoleDialog({
  open, onOpenChange, user, onDone,
}: { open: boolean; onOpenChange: (o: boolean) => void; user: any; onDone: () => void }) {
  const { toast } = useToast();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unit, setUnit] = useState('');
  const [roles, setRoles] = useState<any[]>([]);
  const [roleId, setRoleId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) loadUnitOptions().then(setUnits); else { setUnit(''); setRoleId(''); } }, [open]);
  useEffect(() => {
    setRoles([]); setRoleId('');
    if (unit) consoleApi.grantableRoles(Number(unit)).then((r) => setRoles(r.data || []));
  }, [unit]);

  const role = roles.find((r) => String(r.id) === roleId);
  const hasPrimary = user.assignments.some((a: any) => a.is_primary && a.is_active);

  const submit = async () => {
    if (!role) return;
    setBusy(true);
    const res = await consoleApi.assignRole({
      user: user.id, role: role.id, org_unit: Number(unit), department: role.department_id,
      is_primary: !hasPrimary, is_active: true,
    });
    setBusy(false);
    if (res.error) {
      toast({ title: 'Could not assign role', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Role assigned', description: `${role.name} at ${units.find((u) => String(u.id) === unit)?.label.replace(/^—+ /, '')}` });
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a role</DialogTitle>
          <DialogDescription>Only roles you are allowed to grant at the chosen unit are listed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ar-unit">Unit</Label>
            <select id="ar-unit" className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">Choose a unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ar-role">Role</Label>
            <select id="ar-role" className={selectClass} value={roleId} disabled={!unit} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">{unit ? 'Choose a role' : 'Choose a unit first'}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}{r.department_name ? ` — ${r.department_name}` : ''}</option>)}
            </select>
            {role && <p className="text-xs text-muted-foreground">Department: {role.department_name || 'Any'}{!hasPrimary && ' · becomes the primary role'}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className={primaryButton} disabled={!role || busy} onClick={submit}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProfileDialog({
  open, onOpenChange, user, onDone,
}: { open: boolean; onOpenChange: (o: boolean) => void; user: any; onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' });
  useEffect(() => { if (open) setForm({ first_name: user.first_name, last_name: user.last_name, email: user.email }); }, [open]);
  const save = async () => {
    const res = await consoleApi.updateProfile(user.id, form);
    if (res.error) { toast({ title: 'Could not save', description: res.error, variant: 'destructive' }); return; }
    toast({ title: 'Details updated' });
    onOpenChange(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit account details</DialogTitle>
          <DialogDescription>The service number (username) cannot be changed.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="ep-fn">First name</Label>
            <Input id="ep-fn" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="ep-ln">Surname</Label>
            <Input id="ep-ln" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="ep-em">Email</Label>
            <Input id="ep-em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className={primaryButton} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Pending = null | 'reset' | 'logout' | 'disable' | 'enable' | { session: string } | { assignment: any };

const HqUserDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [addingRole, setAddingRole] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = async () => {
    const res = await consoleApi.user(id!);
    if (res.error) setError(res.error);
    else setUser(res.data);
  };
  useEffect(() => { load(); }, [id]);

  if (error) return <EmptyState>{error}</EmptyState>;
  if (!user) return <LoadingRows label="Loading account…" />;

  const pw = user.password;
  const manage = user.can_manage;
  const fail = (title: string, res: any) => {
    if (res.error) { toast({ title, description: res.error, variant: 'destructive' }); return true; }
    return false;
  };

  const dialogs: Record<string, { title: string; description: string; confirm: string; destructive?: boolean; run: (r: string) => Promise<void> }> = {
    reset: {
      title: `Reset password for ${user.full_name || user.username}?`,
      description: 'A one-time password is created and every session of this user is ended. Confirm the officer\'s identity first.',
      confirm: 'Reset password',
      run: async (reason) => {
        const res = await consoleApi.resetPassword(user.id, reason);
        if (fail('Reset failed', res)) return;
        setPending(null); setTemp(res.data.temporary_password); load();
      },
    },
    logout: {
      title: 'Sign this user out everywhere?',
      description: 'Every device signed in as this user is signed out at its next action.',
      confirm: 'Sign out everywhere', destructive: true,
      run: async (reason) => {
        const res = await consoleApi.forceLogout(user.id, reason);
        if (fail('Sign-out failed', res)) return;
        toast({ title: `${res.data.ended_sessions} session(s) ended` }); setPending(null); load();
      },
    },
    disable: {
      title: 'Disable this account?',
      description: 'The user is signed out immediately and cannot sign in until the account is enabled again. Their records are kept.',
      confirm: 'Disable account', destructive: true,
      run: async (reason) => {
        const res = await consoleApi.setActive(user.id, false, reason);
        if (fail('Could not disable', res)) return;
        toast({ title: 'Account disabled' }); setPending(null); load();
      },
    },
    enable: {
      title: 'Enable this account?',
      description: 'The user will be able to sign in again with their current password.',
      confirm: 'Enable account',
      run: async (reason) => {
        const res = await consoleApi.setActive(user.id, true, reason);
        if (fail('Could not enable', res)) return;
        toast({ title: 'Account enabled' }); setPending(null); load();
      },
    },
  };

  let active: { title: string; description: string; confirm: string; destructive?: boolean; run: (r: string) => Promise<void> } | null = null;
  if (typeof pending === 'string') active = dialogs[pending];
  else if (pending && 'session' in pending) {
    active = {
      title: 'End this session?', description: 'That device is signed out at its next action.', confirm: 'End session', destructive: true,
      run: async (reason) => {
        const res = await consoleApi.endSession(pending.session, reason);
        if (fail('Could not end session', res)) return;
        setPending(null); load();
      },
    };
  } else if (pending && 'assignment' in pending) {
    const a = pending.assignment;
    active = {
      title: `Remove ${a.role_name} at ${a.org_unit_name}?`,
      description: 'The role is switched off (kept in history). The user loses its access at their next action.',
      confirm: 'Remove role', destructive: true,
      run: async () => {
        const res = await consoleApi.updateAssignment(a.id, { is_active: false });
        if (fail('Could not remove role', res)) return;
        setPending(null); load();
      },
    };
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-[#0b4f2a] dark:text-[#d7a928]">
        <Link to="/hq/users"><ArrowLeft className="mr-1 h-4 w-4" /> All accounts</Link>
      </Button>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#0b4f2a] to-[#d7a928]" />
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0b4f2a] text-xl font-bold text-[#d7a928]">
              {(user.first_name || user.username)[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{user.full_name || user.username}</h2>
              <p className="font-mono text-sm text-muted-foreground">{user.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge active={user.is_active} mustChange={pw.must_change} />
                <OnlineDot online={user.online} />
                {user.is_superuser && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                    <ShieldAlert className="h-3 w-3" /> Break-glass superuser
                  </span>
                )}
              </div>
            </div>
          </div>
          {manage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
              <Button className={primaryButton} onClick={() => setPending('reset')}><KeyRound className="mr-2 h-4 w-4" /> Reset password</Button>
              <Button variant="outline" onClick={() => setPending('logout')}><LogOut className="mr-2 h-4 w-4" /> Sign out everywhere</Button>
              {user.is_active ? (
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setPending('disable')}>
                  <UserX className="mr-2 h-4 w-4" /> Disable
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setPending('enable')}><UserCheck className="mr-2 h-4 w-4" /> Enable</Button>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> You can view this account but not change it.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Account">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Service number">{user.username}</Field>
            <Field label="Email">{user.email ? <a className="inline-flex items-center gap-1 text-[#0b4f2a] dark:text-[#d7a928] hover:underline" href={`mailto:${user.email}`}><Mail className="h-3 w-3" />{user.email}</a> : '—'}</Field>
            <Field label="Account created">{formatDateTime(user.date_joined)}</Field>
            <Field label="Last sign-in">{formatDateTime(user.last_login)}</Field>
          </dl>
        </SectionCard>

        <SectionCard title="Password" description="Passwords are stored only as a one-way hash. Nobody, including administrators, can read them.">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Stored as">
              {pw.usable ? (
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {pw.algorithm}{pw.iterations ? `, ${formatNumber(pw.iterations)} rounds` : ''}</span>
              ) : 'No password set'}
            </Field>
            <Field label="Last changed by the user">{pw.changed_at ? timeAgo(pw.changed_at) : 'Not recorded yet'}</Field>
            <Field label="Last admin reset">{pw.reset_at ? formatDateTime(pw.reset_at) : 'Never'}</Field>
            <Field label="Failed attempts since last sign-in">
              <span className={pw.failed_attempts >= 5 ? 'font-semibold text-red-700' : ''}>{pw.failed_attempts}</span>
              {pw.last_failed_at && <span className="text-xs text-muted-foreground"> · last {timeAgo(pw.last_failed_at)}</span>}
            </Field>
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Roles"
        description="Each role applies at its unit and every unit below it."
        action={manage && <Button variant="outline" size="sm" onClick={() => setAddingRole(true)}><Plus className="mr-1 h-4 w-4" /> Assign role</Button>}
      >
        {user.assignments.length === 0 ? (
          <EmptyState>No roles assigned.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="hidden px-4 py-3 text-left sm:table-cell">Department</th>
                  <th className="px-4 py-3 text-left">State</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {user.assignments.map((a: any) => (
                  <tr key={a.id} className={`border-t ${a.is_active ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3"><RolePill name={a.role_name} admin={a.role_code.endsWith('SYS_ADMIN')} /></td>
                    <td className="px-4 py-3">{a.org_unit_name}<span className="block text-xs text-muted-foreground">{unitTypeLabel(a.org_unit_type)}</span></td>
                    <td className="hidden px-4 py-3 sm:table-cell">{a.department_name}</td>
                    <td className="px-4 py-3 text-xs">{a.is_active ? (a.is_primary ? 'Primary' : 'Additional') : 'Removed'}</td>
                    <td className="px-4 py-3 text-right">
                      {manage && a.is_active && (
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setPending({ assignment: a })}>Remove</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Sessions" description="Devices this user has signed in on.">
          {user.sessions.length === 0 ? <EmptyState>No sessions recorded.</EmptyState> : (
            <ul className="divide-y">
              {user.sessions.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{browser(s.user_agent)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.ip_address || 'unknown IP'} · started {timeAgo(s.created_at)} · seen {timeAgo(s.last_seen_at)}
                      {s.revoked_at && ` · ended (${s.revoke_reason || 'signed out'})`}
                    </p>
                  </div>
                  {s.revoked_at ? <span className="text-xs text-muted-foreground">Ended</span> : (
                    <div className="flex items-center gap-2">
                      <OnlineDot online={s.online} label={false} />
                      {manage && <Button variant="ghost" size="sm" onClick={() => setPending({ session: s.id })}>End</Button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Sign-in history">
          {user.logins.length === 0 ? <EmptyState>No sign-ins recorded.</EmptyState> : (
            <ul className="divide-y">
              {user.logins.map((e: any, i: number) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className={e.success ? 'text-foreground' : 'font-medium text-red-700'}>
                      {e.success ? 'Signed in' : `Failed (${e.reason.replace('_', ' ')})`}
                    </p>
                    <p className="text-xs text-muted-foreground">{e.ip_address || 'unknown IP'} · {browser(e.user_agent)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent activity" description="The last 20 actions by this user."
        action={<Button variant="outline" size="sm" asChild><Link to={`/hq/activity?user=${user.id}`}>Full history</Link></Button>}>
        {user.activity.length === 0 ? <EmptyState>No activity recorded.</EmptyState> : (
          <ul className="divide-y">
            {user.activity.map((a: any) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{a.action}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.module}{a.remarks ? ` · ${a.remarks}` : ''}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {active && (
        <ReasonDialog open onOpenChange={(o) => !o && setPending(null)} title={active.title}
          description={active.description} confirmLabel={active.confirm} destructive={active.destructive}
          onConfirm={active.run} />
      )}
      <TempPasswordDialog password={temp} username={user.full_name || user.username} onClose={() => setTemp(null)} />
      <AddRoleDialog open={addingRole} onOpenChange={setAddingRole} user={user} onDone={load} />
      <EditProfileDialog open={editing} onOpenChange={setEditing} user={user} onDone={load} />
    </div>
  );
};

export default HqUserDetail;
