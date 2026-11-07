import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Loader2, RotateCcw, Search } from "lucide-react";

import { PrisonLayout } from "@/components/PrisonLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { receptionApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DiaryEntry {
  id: number;
  prison_number: string;
  name: string;
  gender: string;
  admission_date: string;
  discharge_date: string;
  days_in_custody: number | null;
  official_release_date: string | null;
  reason: string | null;
  discharged_by: string | null;
  station: string | null;
  offences: string[];
}

interface DiaryResponse {
  window: { start: string; end: string; years: number };
  range: { start: string; end: string };
  summary: { total: number; this_year: number; this_month: number; by_year: { year: number; count: number }[] };
  results: DiaryEntry[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 50;
const fmt = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "—");

const Stat = ({ label, value, hint }: { label: string; value: number | string; hint?: string }) => (
  <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/** Inmates discharged from custody over the last five years. Older records are archived. */
export default function DischargeDiary() {
  const navigate = useNavigate();
  const [data, setData] = useState<DiaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res: any = await receptionApi.getDischargeDiary({
      search: search.trim(),
      from: year ? `${year}-01-01` : from,
      to: year ? `${year}-12-31` : to,
      page,
      page_size: PAGE_SIZE,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setData(res.data);
  }, [search, from, to, year, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const reset = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setYear(null);
    setPage(1);
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const filtered = Boolean(search || from || to || year);

  return (
    <PrisonLayout title="Discharge Diary" description="Inmates discharged from custody in the last five years">
      <div className="mx-auto max-w-7xl space-y-5">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="This month" value={data?.summary.this_month ?? "–"} />
              <Stat label="This year" value={data?.summary.this_year ?? "–"} />
              <Stat
                label={`Last ${data?.window.years ?? 5} years`}
                value={data?.summary.total ?? "–"}
                hint={data ? `Since ${fmt(data.window.start)}` : undefined}
              />
            </div>

            <section className="rounded-lg border border-border bg-card shadow-sm">
              <header className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="diary-search" className="text-xs">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="diary-search" placeholder="Prison number or name" className="w-64 pl-8"
                        value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="diary-from" className="text-xs">Discharged from</Label>
                    <Input id="diary-from" type="date" className="w-40" value={from}
                      min={data?.window.start} max={data?.window.end} disabled={year !== null}
                      onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="diary-to" className="text-xs">to</Label>
                    <Input id="diary-to" type="date" className="w-40" value={to}
                      min={data?.window.start} max={data?.window.end} disabled={year !== null}
                      onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                  </div>
                  {filtered && (
                    <Button variant="ghost" size="sm" onClick={reset}>
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by year">
                  {data?.summary.by_year.map(({ year: y, count }) => (
                    <button
                      key={y}
                      type="button"
                      aria-pressed={year === y}
                      onClick={() => { setYear(year === y ? null : y); setPage(1); }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        year === y
                          ? "border-[#0b4f2a] bg-[#0b4f2a] text-white"
                          : "border-border text-muted-foreground hover:border-[#0b4f2a]/50 hover:text-foreground",
                      )}
                    >
                      {y} <span className="tabular-nums opacity-75">· {count}</span>
                    </button>
                  ))}
                </div>
              </header>

              <div className="p-4">
                {loading && !data ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading discharges…
                  </div>
                ) : data && data.results.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">{filtered ? "No discharges match these filters" : "No discharges in the last five years"}</p>
                    <p className="text-sm text-muted-foreground">
                      Inmates appear here once their discharge is approved.
                    </p>
                  </div>
                ) : data && (
                  <>
                    <div className={cn("overflow-x-auto rounded-md border border-border", loading && "opacity-60")}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">Discharged</TableHead>
                            <TableHead>Prison No.</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Offences</TableHead>
                            <TableHead className="whitespace-nowrap">Admitted</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Days in custody</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="whitespace-nowrap">Approved by</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.results.map((entry) => (
                            <TableRow
                              key={entry.id}
                              className="cursor-pointer"
                              tabIndex={0}
                              onClick={() => navigate(`/inmates/${entry.id}`)}
                              onKeyDown={(e) => e.key === "Enter" && navigate(`/inmates/${entry.id}`)}
                            >
                              <TableCell className="whitespace-nowrap font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                  {fmt(entry.discharge_date)}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{entry.prison_number}</TableCell>
                              <TableCell>{entry.name}</TableCell>
                              <TableCell className="max-w-[260px]">
                                <span className="line-clamp-2 text-sm">{entry.offences.join("; ") || "—"}</span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{fmt(entry.admission_date)}</TableCell>
                              <TableCell className="text-right tabular-nums">{entry.days_in_custody ?? "—"}</TableCell>
                              <TableCell className="max-w-[220px]">
                                <span className="line-clamp-2 text-sm">{entry.reason || "—"}</span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap font-mono text-xs">{entry.discharged_by || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {data.total.toLocaleString()} discharge{data.total === 1 ? "" : "s"} · {fmt(data.range.start)} – {fmt(data.range.end)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page <= 1}
                          onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="tabular-nums">Page {page} of {pages}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= pages}
                          onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-2">Archive</Badge>
              Discharges older than five years are moved to the archive and no longer listed here.
            </p>
          </>
        )}
      </div>
    </PrisonLayout>
  );
}
