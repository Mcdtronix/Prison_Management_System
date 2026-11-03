import { useEffect, useMemo, useState } from 'react';
import { Database, HardDrive, Info, Layers, RefreshCw, Share2 } from 'lucide-react';
import { consoleApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  EmptyState, LoadingRows, SectionCard, StatCard, formatBytes, formatNumber, timeAgo, unitTypeLabel,
} from '@/components/console/ConsoleUI';

/** One horizontal bar: brand green, rounded data end, value in text ink, tooltip on hover. */
function ShareBar({ label, sub, bytes, rows, max, total }: {
  label: string; sub?: string; bytes: number; rows: number; max: number; total: number;
}) {
  const width = max > 0 ? Math.max((bytes / max) * 100, bytes > 0 ? 1.5 : 0) : 0;
  const pct = total > 0 ? (bytes / total) * 100 : 0;
  return (
    <div className="group grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 py-1.5 sm:grid-cols-[minmax(0,14rem)_1fr_auto]"
      title={`${label}: ${formatBytes(bytes)} · ${formatNumber(rows)} records · ${pct.toFixed(1)}% of attributed data`}>
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{label}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="h-3 rounded-r bg-muted">
        <div className="h-3 rounded-r bg-[#0b4f2a] transition-all group-hover:bg-[#063f20] dark:bg-[#d7a928] dark:group-hover:bg-[#e8bf4a]" style={{ width: `${width}%` }} />
      </div>
      <span className="w-24 text-right text-sm tabular-nums text-foreground/80">{formatBytes(bytes)}</span>
    </div>
  );
}

const HqStorage = () => {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const r = await consoleApi.storage();
    if (r.error) setError(r.error); else setData(r.data);
  };
  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setBusy(true);
    const r = await consoleApi.refreshStorage();
    setBusy(false);
    if (r.error) { toast({ title: 'Could not measure', description: r.error, variant: 'destructive' }); return; }
    setData(r.data);
    toast({ title: 'Storage measured' });
  };

  const view = useMemo(() => {
    if (!data) return null;
    const units = data.units as any[];
    const national = units.find((u) => u.unit_type === 'NATIONAL_HQ');
    const provinces = units.filter((u) => u.unit_type === 'PROVINCIAL_HQ')
      .sort((a, b) => (b.total_bytes || 0) - (a.total_bytes || 0));
    const stations = units.filter((u) => u.unit_type === 'STATION').sort((a, b) => b.bytes - a.bytes);
    const attributed = units.reduce((n, u) => n + u.bytes, 0);
    const maxProvince = Math.max(national?.bytes || 0, ...provinces.map((p) => p.total_bytes || 0), 1);
    const maxStation = Math.max(...stations.map((s) => s.bytes), 1);
    const nameOf = Object.fromEntries(units.map((u) => [u.id, u.name]));
    return { national, provinces, stations, attributed, maxProvince, maxStation, nameOf };
  }, [data]);

  if (error) return <EmptyState>Could not load storage figures: {error}</EmptyState>;
  if (!data || !view) return <LoadingRows label="Loading storage figures…" />;

  const unassigned = data.unassigned || { bytes: 0, rows: 0 };
  const shared = data.shared || { bytes: 0, rows: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data.captured_at ? `Measured ${timeAgo(data.captured_at)}. Figures refresh nightly.` : 'Not measured yet.'}
        </p>
        <Button variant="outline" onClick={refresh} disabled={busy}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Measure now
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Whole database" value={formatBytes(data.database_bytes)} icon={<HardDrive className="h-4 w-4" />}
          hint={data.database_bytes ? 'Size on disk, including indexes' : 'Available on the production database'} />
        <StatCard title="Held by provinces & stations" value={formatBytes(view.attributed)} icon={<Database className="h-4 w-4" />}
          hint="Records with an owning unit" />
        <StatCard title="Not yet assigned to a unit" value={formatBytes(unassigned.bytes)} icon={<Layers className="h-4 w-4" />}
          tone={unassigned.bytes > view.attributed ? 'warn' : 'default'} hint={`${formatNumber(unassigned.rows)} records`} />
        <StatCard title="System-wide data" value={formatBytes(shared.bytes)} icon={<Share2 className="h-4 w-4" />}
          hint="Settings, lists and logs not owned by one unit" />
      </div>

      {unassigned.bytes > 0 && (
        <div className="flex gap-3 rounded-md border border-[#d7a928]/50 bg-[#d7a928]/10 p-4 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#b08a1a]" />
          <p>
            Some records were created before every record was tagged with its station, so they can't be attributed yet.
            They will move into the right station once record ownership is completed (next phase).
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="By provincial command centre" description="Each province including its stations. Hover a bar for the exact figures.">
          {view.provinces.length === 0 && !view.national ? <EmptyState>No units yet.</EmptyState> : (
            <div>
              {view.national && (
                <ShareBar label={view.national.name} sub="National HQ" bytes={view.national.bytes} rows={view.national.rows}
                  max={view.maxProvince} total={view.attributed} />
              )}
              {view.provinces.map((p) => (
                <ShareBar key={p.id} label={p.name} bytes={p.total_bytes || 0} rows={p.total_rows || 0}
                  max={view.maxProvince} total={view.attributed} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="By station" description="Largest first.">
          {view.stations.length === 0 ? <EmptyState>No stations yet.</EmptyState> : (
            <div>
              {view.stations.slice(0, 15).map((s) => (
                <ShareBar key={s.id} label={s.name} sub={view.nameOf[s.parent_id]} bytes={s.bytes} rows={s.rows}
                  max={view.maxStation} total={view.attributed} />
              ))}
              {view.stations.length > 15 && <p className="pt-2 text-xs text-muted-foreground">All stations are listed in the table below.</p>}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="All units" description={data.note}>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-left">Level</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3 text-right">Own data</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Share</th>
              </tr>
            </thead>
            <tbody>
              {(data.units as any[]).map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2.5 text-foreground">{u.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{unitTypeLabel(u.unit_type)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(u.rows)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatBytes(u.bytes)}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {view.attributed ? `${((u.bytes / view.attributed) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="By module" description="Which parts of the system hold the data.">
        {data.by_module.length === 0 ? <EmptyState>No data measured yet.</EmptyState> : (
          <div>
            {data.by_module.map((m: any) => (
              <ShareBar key={m.module} label={m.module} bytes={m.bytes} rows={m.rows}
                max={Math.max(...data.by_module.map((x: any) => x.bytes), 1)}
                total={data.by_module.reduce((n: number, x: any) => n + x.bytes, 0)} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default HqStorage;
