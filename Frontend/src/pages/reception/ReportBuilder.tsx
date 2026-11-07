import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Loader2,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { PrisonLayout } from "@/components/PrisonLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  reportsApi,
  type ReportColumnMeta,
  type ReportResult,
  type ReportSort,
  type ReportSourceMeta,
  type SavedReport,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { QueryBuilder, type FilterGroup } from "./components/QueryBuilder";

const MAX_COLUMNS = 40;
const PAGE_SIZE = 50;
const EMPTY_FILTERS: FilterGroup = { operator: "AND", conditions: [] };

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const Panel = ({ title, hint, actions, children, className }: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
    <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {actions}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

function OrderedColumn({ column, index, total, onMove, onRemove }: {
  column: ReportColumnMeta;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5",
        isDragging && "z-10 shadow-lg ring-1 ring-[#d7a928]",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Drag ${column.label} to reorder`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {column.label}
        <span className="ml-2 text-xs text-muted-foreground">{column.group}</span>
      </span>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0}
        onClick={() => onMove(index, index - 1)} aria-label={`Move ${column.label} up`}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)} aria-label={`Move ${column.label} down`}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600"
        onClick={onRemove} aria-label={`Remove ${column.label}`}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ReportBuilder() {
  const { toast } = useToast();
  const [sources, setSources] = useState<ReportSourceMeta[] | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [view, setView] = useState<"home" | "builder">("home");

  // Builder state
  const [source, setSource] = useState<ReportSourceMeta | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<SavedReport | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterGroup>(EMPTY_FILTERS);
  const [sort, setSort] = useState<ReportSort[]>([]);
  const [search, setSearch] = useState("");

  // Preview state
  const [result, setResult] = useState<ReportResult | null>(null);
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSaved = useCallback(async () => {
    const res = await reportsApi.getTemplates();
    const data: any = res.data;
    setSaved(Array.isArray(data) ? data : data?.results || []);
  }, []);

  useEffect(() => {
    reportsApi.catalogue().then((res) => setSources(res.data?.sources || []));
    loadSaved();
  }, [loadSaved]);

  const columnMap = useMemo(
    () => Object.fromEntries((source?.columns || []).map((c) => [c.key, c])),
    [source],
  );

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const out: Record<string, ReportColumnMeta[]> = {};
    (source?.columns || []).forEach((c) => {
      if (term && !`${c.label} ${c.group}`.toLowerCase().includes(term)) return;
      (out[c.group] ||= []).push(c);
    });
    return out;
  }, [source, search]);

  const request = useMemo(
    () => (source ? { source: source.key, columns, filters, sort } : null),
    [source, columns, filters, sort],
  );

  /* ----- open builder ----- */
  const startNew = (s: ReportSourceMeta) => {
    setSource(s);
    setEditing(null);
    setName(s.label);
    setColumns([...s.default_columns]);
    setFilters(EMPTY_FILTERS);
    setSort([...s.default_sort]);
    setResult(null);
    setRunError(null);
    setSearch("");
    setView("builder");
  };

  const openSaved = (report: SavedReport) => {
    const s = sources?.find((x) => x.key === report.base_model);
    if (!s) return;
    const known = new Set(s.columns.map((c) => c.key));
    setSource(s);
    setEditing(report);
    setName(report.name);
    setColumns(report.selected_fields.filter((k) => known.has(k)));
    setFilters(report.filters && report.filters.conditions ? report.filters : EMPTY_FILTERS);
    setSort((report.sort || []).filter((x) => known.has(x.key)));
    setResult(null);
    setRunError(null);
    setSearch("");
    setView("builder");
  };

  /* ----- columns ----- */
  const toggleColumn = (key: string) =>
    setColumns((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_COLUMNS) {
        toast({ title: "Column limit reached", description: `A report can have up to ${MAX_COLUMNS} columns.` });
        return prev;
      }
      return [...prev, key];
    });

  const moveColumn = (from: number, to: number) => setColumns((prev) => arrayMove(prev, from, to));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      setColumns((prev) => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
    }
  };

  /* ----- preview ----- */
  const runPreview = useCallback(async (targetPage = 1) => {
    if (!request || request.columns.length === 0) return;
    setRunning(true);
    setRunError(null);
    const res = await reportsApi.run({ ...request, page: targetPage, page_size: PAGE_SIZE });
    setRunning(false);
    if (res.error || !res.data) {
      setRunError(res.error || "The report could not be run.");
      return;
    }
    setResult(res.data);
    setPage(targetPage);
  }, [request]);

  // Refresh the preview automatically when the design changes.
  useEffect(() => {
    if (view !== "builder" || !request || request.columns.length === 0) return;
    const timer = setTimeout(() => runPreview(1), 350);
    return () => clearTimeout(timer);
  }, [view, request, runPreview]);

  /* ----- export & save ----- */
  const exportAs = async (format: "csv" | "excel" | "pdf") => {
    if (!request) return;
    setExporting(format);
    const res = await reportsApi.export({ ...request, format, title: name || source?.label });
    setExporting(null);
    if (res.error || !res.blob) {
      toast({ title: "Export failed", description: res.error || undefined, variant: "destructive" });
      return;
    }
    download(res.blob, res.filename || `report.${format === "excel" ? "xlsx" : format}`);
  };

  const save = async (asCopy = false) => {
    if (!source || !name.trim()) {
      toast({ title: "Name the report", description: "Give the report a name before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), base_model: source.key, selected_fields: columns, filters, sort };
    const res = editing && editing.is_owner && !asCopy
      ? await reportsApi.updateTemplate(editing.id, payload)
      : await reportsApi.createTemplate(payload);
    setSaving(false);
    if (res.error || !res.data) {
      toast({ title: "Not saved", description: res.error || undefined, variant: "destructive" });
      return;
    }
    setEditing(res.data);
    await loadSaved();
    toast({ title: "Report saved", description: `"${res.data.name}" is in your saved reports.` });
  };

  const removeSaved = async (report: SavedReport) => {
    if (!window.confirm(`Delete the saved report "${report.name}"?`)) return;
    const res = await reportsApi.deleteTemplate(report.id);
    if (res.error) {
      toast({ title: "Not deleted", description: res.error, variant: "destructive" });
      return;
    }
    loadSaved();
  };

  /* ----- sort ----- */
  const updateSort = (index: number, patch: Partial<ReportSort>) =>
    setSort((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.page_size)) : 1;

  /* ================================================================== */

  return (
    <PrisonLayout title="Report Builder" description="Build, preview and export reports from the records your role can access.">
      {view === "home" ? (
        <div className="mx-auto max-w-6xl space-y-6">
          <Panel title="New report" hint="Only the data your role is permitted to report on is listed. Rows are limited to your station.">
            {sources === null ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading available reports…
              </div>
            ) : sources.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No reports are available for your role</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Reports draw on operational records. Ask your station administrator if your role should have access.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sources.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => startNew(s)}
                    className="group flex flex-col rounded-lg border border-border p-4 text-left transition hover:border-[#0b4f2a] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7a928]"
                  >
                    <span className="mb-2 flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{s.module}</Badge>
                      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-[#0b4f2a]" />
                    </span>
                    <span className="font-semibold">{s.label}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{s.description}</span>
                    <span className="mt-3 text-xs text-muted-foreground">{s.columns.length} columns available</span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Saved reports" hint="Your reports and those saved by colleagues in the same role.">
            {saved.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No saved reports yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Columns</TableHead>
                      <TableHead>Saved by</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saved.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.source_label}</TableCell>
                        <TableCell>{r.selected_fields.length}</TableCell>
                        <TableCell>{r.is_owner ? "You" : r.created_by_name}</TableCell>
                        <TableCell>{new Date(r.updated_at).toLocaleDateString()}</TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => openSaved(r)}>Open</Button>
                          {r.is_owner && (
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => removeSaved(r)} aria-label={`Delete ${r.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>
      ) : source && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => { setView("home"); loadSaved(); }}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Reports
            </Button>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <Label htmlFor="report-name" className="sr-only">Report name</Label>
              <Input id="report-name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm font-medium" />
              <Badge variant="outline">{source.label}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => save(false)} disabled={saving || !columns.length}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {editing?.is_owner ? "Save" : "Save report"}
              </Button>
              {editing && (
                <Button size="sm" variant="ghost" onClick={() => save(true)} disabled={saving || !columns.length}>
                  <Copy className="mr-1.5 h-4 w-4" /> Save as copy
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
            {/* Column picker */}
            <Panel
              title="Columns"
              hint="Tick the columns to include."
              className="xl:sticky xl:top-20 xl:self-start"
              actions={
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setColumns([...source.default_columns])}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Defaults
                </Button>
              }
            >
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search columns" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
              <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {Object.entries(grouped).map(([group, cols]) => (
                  <fieldset key={group}>
                    <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0b4f2a] dark:text-[#d7a928]">{group}</legend>
                    <div className="space-y-0.5">
                      {cols.map((c) => (
                        <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
                          <Checkbox checked={columns.includes(c.key)} onCheckedChange={() => toggleColumn(c.key)} />
                          <span className="flex-1">{c.label}</span>
                          {columns.includes(c.key) && (
                            <span className="text-xs tabular-nums text-muted-foreground">#{columns.indexOf(c.key) + 1}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                {Object.keys(grouped).length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No column matches “{search}”.</p>
                )}
              </div>
            </Panel>

            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 2xl:grid-cols-2">
                {/* Column order */}
                <Panel title={`Column order (${columns.length}/${MAX_COLUMNS})`} hint="Drag, or use the arrows, to arrange the report from left to right.">
                  {columns.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Tick at least one column.</p>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                      <SortableContext items={columns} strategy={verticalListSortingStrategy}>
                        <ol className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                          {columns.map((key, i) => columnMap[key] && (
                            <OrderedColumn key={key} column={columnMap[key]} index={i} total={columns.length}
                              onMove={moveColumn} onRemove={() => toggleColumn(key)} />
                          ))}
                        </ol>
                      </SortableContext>
                    </DndContext>
                  )}
                </Panel>

                {/* Sort */}
                <Panel
                  title="Sort rows"
                  hint="Up to three levels, applied in order."
                  actions={sort.length < 3 && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => setSort((p) => [...p, { key: columns[0] || source.columns[0].key, direction: "asc" }])}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add level
                    </Button>
                  )}
                >
                  {sort.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Rows are in the order they were recorded.</p>
                  ) : (
                    <ol className="space-y-2">
                      {sort.map((s, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-xs text-muted-foreground">{i === 0 ? "Sort by" : "then"}</span>
                          <Select value={s.key} onValueChange={(v) => updateSort(i, { key: v })}>
                            <SelectTrigger className="h-9 flex-1" aria-label={`Sort level ${i + 1} column`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {source.columns.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={s.direction} onValueChange={(v) => updateSort(i, { direction: v as "asc" | "desc" })}>
                            <SelectTrigger className="h-9 w-32" aria-label={`Sort level ${i + 1} direction`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">Ascending</SelectItem>
                              <SelectItem value="desc">Descending</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Remove sort level"
                            onClick={() => setSort((p) => p.filter((_, j) => j !== i))}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ol>
                  )}
                </Panel>
              </div>

              <Panel title="Filters" hint="Only rows matching these conditions are included.">
                <QueryBuilder group={filters} onChange={setFilters} fieldsSchema={source.columns} />
              </Panel>

              {/* Preview */}
              <Panel
                title="Preview"
                hint={result ? `${result.total.toLocaleString()} matching record${result.total === 1 ? "" : "s"} · exports include up to 10,000` : "Updates as you design the report."}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => runPreview(page)} disabled={running || !columns.length}>
                      {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />} Refresh
                    </Button>
                    {(["csv", "excel", "pdf"] as const).map((f) => (
                      <Button key={f} size="sm" variant={f === "pdf" ? "default" : "outline"}
                        className={f === "pdf" ? "bg-[#0b4f2a] hover:bg-[#063f20]" : undefined}
                        disabled={!columns.length || !result || exporting !== null} onClick={() => exportAs(f)}>
                        {exporting === f ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          : f === "excel" ? <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                          : f === "pdf" ? <FileText className="mr-1.5 h-4 w-4" /> : <Download className="mr-1.5 h-4 w-4" />}
                        {f === "excel" ? "Excel" : f.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                }
              >
                {runError ? (
                  <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{runError}</p>
                ) : !result ? (
                  <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Building preview…
                  </div>
                ) : result.rows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No records match this report.</p>
                ) : (
                  <>
                    <div className={cn("overflow-x-auto rounded-md border border-border", running && "opacity-60")}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {result.columns.map((c) => (
                              <TableHead key={c.key} className={cn("whitespace-nowrap", c.type === "number" && "text-right")}>{c.label}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.rows.map((row, i) => (
                            <TableRow key={i}>
                              {row.map((value, j) => (
                                <TableCell key={j} className={cn("whitespace-nowrap", result.columns[j]?.type === "number" && "text-right tabular-nums")}>
                                  {value === "" || value === null ? <span className="text-muted-foreground">—</span> : String(value)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Rows {(result.page - 1) * result.page_size + 1}–{(result.page - 1) * result.page_size + result.rows.length} of {result.total.toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page <= 1 || running}
                          onClick={() => runPreview(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="tabular-nums">Page {page} of {totalPages}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= totalPages || running}
                          onClick={() => runPreview(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </PrisonLayout>
  );
}
