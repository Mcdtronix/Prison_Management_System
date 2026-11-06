import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Building2, Database, KeyRound, Landmark, ShieldCheck, Users, Wifi,
} from 'lucide-react';
import { consoleApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  EmptyState, LoadingRows, SectionCard, StatCard, formatBytes, formatNumber, timeAgo,
} from '@/components/console/ConsoleUI';

const HqOverview = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await consoleApi.overview();
      if (!alive) return;
      if (res.error) setError(res.error);
      else setData(res.data);
    };
    load();
    const timer = window.setInterval(load, 60_000); // keep "online now" current
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  if (error) return <EmptyState>Could not load the overview: {error}</EmptyState>;
  if (!data) return <LoadingRows label="Loading system overview…" />;

  const c = data.counts;
  const level: 'NATIONAL' | 'PROVINCIAL' | 'STATION' = data.scope_level || 'NATIONAL';
  const unit = data.scope_unit;
  const where = level === 'NATIONAL' ? 'across the system' : level === 'PROVINCIAL' ? 'in your province' : 'at your station';
  return (
    <div className="space-y-6">
      {level !== 'NATIONAL' && unit && (
        <div className="flex items-center gap-2 rounded-md border border-[#0b4f2a]/20 bg-[#0b4f2a]/5 px-4 py-3 text-sm dark:border-[#d7a928]/30 dark:bg-[#d7a928]/10">
          {level === 'STATION'
            ? <Building2 className="h-4 w-4 text-[#0b4f2a] dark:text-[#d7a928]" />
            : <Landmark className="h-4 w-4 text-[#0b4f2a] dark:text-[#d7a928]" />}
          <span className="text-foreground">
            Showing <span className="font-medium">{unit.name}</span>
            {unit.parent_name && level === 'STATION' ? <span className="text-muted-foreground"> · {unit.parent_name}</span> : null}
            {' '}only.
          </span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {level === 'NATIONAL' && (
          <StatCard title="Provincial command centres" value={c.provinces} icon={<Landmark className="h-4 w-4" />}
            hint={`${c.stations} stations under them`} onClick={() => navigate('/hq/organisation')} />
        )}
        {level === 'PROVINCIAL' && (
          <StatCard title="Stations" value={c.stations} icon={<Building2 className="h-4 w-4" />}
            hint="In your province" onClick={() => navigate('/hq/organisation')} />
        )}
        {level === 'STATION' && (
          <StatCard title="My station" value={unit?.name || '—'} icon={<Building2 className="h-4 w-4" />}
            hint="Officers and system admins" onClick={() => navigate('/hq/organisation')} />
        )}
        <StatCard title="User accounts" value={formatNumber(c.users)} icon={<Users className="h-4 w-4" />}
          hint={`${formatNumber(c.active_users)} active · ${formatNumber(c.disabled_users)} disabled`}
          onClick={() => navigate('/hq/users')} />
        <StatCard title="Online now" value={c.online_now} icon={<Wifi className="h-4 w-4" />} tone="good"
          hint="Active in the last 5 minutes" onClick={() => navigate('/hq/activity?tab=online')} />
        <StatCard title="Records stored" value={formatBytes(data.storage.records_bytes)}
          icon={<Database className="h-4 w-4" />}
          hint={data.storage.captured_at ? `Measured ${timeAgo(data.storage.captured_at)}` : 'Not measured yet'}
          onClick={() => navigate('/hq/storage')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Sign-ins (24 h)" value={c.logins_24h} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard title="Failed sign-ins (24 h)" value={c.failed_logins_24h} icon={<AlertTriangle className="h-4 w-4" />}
          tone={c.failed_logins_24h > 10 ? 'bad' : c.failed_logins_24h > 0 ? 'warn' : 'default'}
          onClick={() => navigate('/hq/activity?tab=logins')} />
        <StatCard title="Pending password changes" value={c.pending_password_changes} icon={<KeyRound className="h-4 w-4" />}
          tone={c.pending_password_changes ? 'warn' : 'default'} hint="Reset, not yet replaced by the user"
          onClick={() => navigate('/hq/users?status=must_change')} />
        <StatCard title="Departments · Roles" value={`${c.departments} · ${c.roles}`}
          icon={<Building2 className="h-4 w-4" />}
          onClick={level === 'NATIONAL' ? () => navigate('/hq/roles') : undefined}
          hint={level === 'NATIONAL' ? undefined : 'Managed by National HQ'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title={`Latest activity ${where}`}
          description="Who did what, and when."
          action={<Button variant="outline" size="sm" asChild><Link to="/hq/activity">View all</Link></Button>}
        >
          {data.recent_activity.length === 0 ? (
            <EmptyState>No activity recorded yet.</EmptyState>
          ) : (
            <ul className="divide-y">
              {data.recent_activity.map((a: any) => (
                <li key={a.id} className="flex items-start gap-3 py-3">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4f2a] dark:text-[#d7a928]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.action}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.full_name || a.username} · {a.role} {a.remarks ? `· ${a.remarks}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Recent failed sign-ins" description="Repeated failures may mean a guessed password.">
          {data.recent_failed_logins.length === 0 ? (
            <EmptyState>No failed sign-ins in the last 24 hours.</EmptyState>
          ) : (
            <ul className="divide-y">
              {data.recent_failed_logins.map((e: any, i: number) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-mono font-medium text-foreground">{e.username || '—'}</p>
                    <p className="text-xs text-muted-foreground">{e.ip_address || 'unknown IP'} · {e.reason.replace('_', ' ')}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default HqOverview;
