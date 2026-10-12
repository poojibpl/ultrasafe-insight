import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, Hourglass, Loader2, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Ticket as TicketIcon, Upload, CalendarRange, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/dash/FilterPanel";
import { Charts } from "@/components/dash/Charts";
import { TicketTable } from "@/components/dash/TicketTable";
import { TicketDetail } from "@/components/dash/TicketDetail";
import { GroupAnalysis } from "@/components/dash/GroupAnalysis";
import { AgingChart } from "@/components/dash/AgingChart";
import { SelectionSummary } from "@/components/dash/SelectionSummary";
import { FcnView, NormalSummary, TrendsView } from "@/components/dash/Views";
import { clearLatest, loadLatest, saveLatest } from "@/lib/latestUpload";
import {
  applyBase, applyFilters, EMPTY_FILTERS, istToday, defaultFilters, uniqueIds, MONTHS, ExcelReadError, pruneFilters, parseWorkbook, periodRange, kpiMatch, ROLE_LABELS,
  type Dataset, type Filters, type KpiKey, type MultiRole, type Ticket,
} from "@/lib/tickets";

import ticketsAsset from "@/assets/tickets.xlsx.asset.json";
const DATA_URL = ticketsAsset.url;
type View = "overview" | "normal" | "fcn" | "trends";
const VIEWS: [View, string][] = [["overview", "Overview"], ["normal", "Normal Service Calls"], ["fcn", "FCN Analysis"], ["trends", "Current Trends"]];
interface LoadError { message: string; missing: string[]; headers: string[]; file: string }

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ultrasound Service Calls Dashboard | BPL Medical Technologies" },
      { name: "description", content: "Live view of BPL Ultrasound service tickets: status, workload, engineers, models, zones, branches and TAT." },
      { property: "og:title", content: "Ultrasound Service Calls Dashboard | BPL Medical Technologies" },
      { property: "og:description", content: "Ultrasound service-ticket analytics for the National Service Head." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [buf, setBuf] = useState<{ data: ArrayBuffer; name: string; source: "server" | "upload" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [applied, setApplied] = useState<Filters>(() => defaultFilters());
  const [draft, setDraft] = useState<Filters>(() => defaultFilters());
  const [view, setView] = useState<View>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Single source of truth: `ds` is the active dataset. It is only replaced after a file parses and validates.
  const activate = useCallback((d: Dataset, data: ArrayBuffer, source: "server" | "upload") => {
    setDs(d);
    setBuf({ data, name: d.fileName, source });
    setSelected(null);
    setApplied((f) => pruneFilters(f, d));
    setDraft((f) => pruneFilters(f, d));
    setError(null);
  }, []);

  const tryParse = useCallback((data: ArrayBuffer, name: string, sheet?: string): Dataset | null => {
    try {
      return parseWorkbook(data, name, sheet);
    } catch (e) {
      const err = e instanceof ExcelReadError ? e : null;
      setError({
        message: err?.message ?? "Could not read the Excel file. Please check the Excel format and required columns.",
        missing: err?.missingColumns ?? [],
        headers: err?.detectedHeaders ?? [],
        file: name,
      });
      return null;
    }
  }, []);

  const loadServer = useCallback(async (notify = false, sheet?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.arrayBuffer();
      const d = tryParse(data, "tickets.xlsx", sheet);
      if (d) {
        activate(d, data, "server");
        if (notify) toast.success(`Excel loaded successfully — ${d.tickets.length.toLocaleString("en-IN")} records`, { description: `File: ${d.fileName} · Loaded: ${d.loadedAt.toLocaleString("en-IN")}` });
      }
    } catch {
      setError({ message: `The default data file could not be loaded (public${DATA_URL}). Use “Open Excel” to load a file.`, missing: [], headers: [], file: "tickets.xlsx" });
    } finally {
      setLoading(false);
    }
  }, [tryParse, activate]);

  // Startup: the latest successfully uploaded workbook (saved in this browser) wins over the default file.
  const loadSaved = useCallback(async (notify: boolean) => {
    setLoading(true);
    try {
      const saved = await loadLatest();
      if (!saved) return false;
      const d = tryParse(saved.data, saved.name, saved.sheet);
      if (!d) return true; // keep error visible; never fall back silently
      activate(d, saved.data, "upload");
      if (notify) toast.success(`Reloaded ${saved.name} — ${d.tickets.length.toLocaleString("en-IN")} records`, { description: `Uploaded ${new Date(saved.savedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST` });
      return true;
    } finally { setLoading(false); }
  }, [tryParse, activate]);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    loadSaved(false).then((had) => { if (!had) loadServer(); });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const onUpload = async (f: File) => {
    setLoading(true);
    try {
      const data = await f.arrayBuffer();
      const d = tryParse(data, f.name);
      if (d) {
        activate(d, data, "upload");
        const ok = await saveLatest({ name: f.name, data, sheet: d.sheet, savedAt: Date.now() });
        if (!ok) toast.warning("Loaded, but this browser could not save the file for next time.");
        toast.success(`Excel loaded successfully — ${d.tickets.length.toLocaleString("en-IN")} records`, { description: `File: ${f.name} · Loaded: ${d.loadedAt.toLocaleString("en-IN")}` });
      } else {
        toast.error(ds ? "Upload failed — the previous data is still shown." : "Upload failed.");
      }
    } catch {
      setError({ message: "Could not read the selected file.", missing: [], headers: [], file: f.name });
    } finally {
      setLoading(false);
    }
  };

  const onSheet = (sheet: string) => {
    if (!buf) return;
    const d = tryParse(buf.data, buf.name, sheet);
    if (d) { activate(d, buf.data, buf.source); if (buf.source === "upload") saveLatest({ name: buf.name, data: buf.data, sheet, savedAt: Date.now() }); toast.success(`Worksheet “${sheet}” loaded — ${d.tickets.length.toLocaleString("en-IN")} records`); }
  };

  const reload = () => {
    if (buf?.source === "upload") { loadSaved(true); return; } // latest saved upload, never the old default
    loadServer(true, ds?.sheet);
  };

  const rows = useMemo(() => (ds ? applyFilters(ds.tickets, applied) : []), [ds, applied]);
  const baseRows = useMemo(() => (ds ? applyBase(ds.tickets, applied) : []), [ds, applied]);
  const agingRows = useMemo(() => (ds ? applyFilters(ds.tickets, { ...applied, ageBucket: null }) : []), [ds, applied]);
  const [more, setMore] = useState(false);
  const trendRows = useMemo(() => (ds ? applyBase(ds.tickets, { ...applied, year: "", month: "" }) : []), [ds, applied]);
  const today = istToday();
  const useDefault = async () => { await clearLatest(); loadServer(true); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  const commit = (f: Filters) => { setApplied(f); setDraft(f); };
  const scrollTable = () => setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  const onDrill = (role: MultiRole | "statusGroup", value: string) => {
    if (role === "statusGroup") commit({ ...applied, statusGroup: [value] });
    else commit({ ...applied, multi: { ...applied.multi, [role]: [value] } });
    toast(`Filtered: ${value}`);
    scrollTable();
  };
  const onKpi = (k: KpiKey) => {
    commit({ ...applied, kpi: applied.kpi === k ? null : k, ageBucket: null });
    if (applied.kpi !== k) scrollTable();
  };

  if (loading && !ds) return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /> Reading Excel data…</Centered>;
  if (!ds) return (
    <Centered>
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <div className="max-w-xl">{error ? <ErrorDetails e={error} /> : <p className="text-center">No data loaded.</p>}</div>
      <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Open Excel file</Button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
    </Centered>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`sticky top-0 h-screen shrink-0 border-r bg-sidebar transition-all duration-200 ${collapsed ? "w-14" : "w-72"}`}>
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!collapsed && <span className="text-sm font-semibold">Filters</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        {!collapsed && (
          <div className="h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
            <FilterPanel ds={ds} draft={draft} setDraft={setDraft} dirty={dirty} currentYM={istToday()} onApply={() => setApplied(draft)} onReset={() => commit(defaultFilters())} onClear={() => commit(EMPTY_FILTERS)} />
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-5 backdrop-blur">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Activity className="h-4 w-4" /></div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">BPL Medical Technologies</div>
            <div className="text-xs text-muted-foreground">Ultrasound Service Calls Dashboard</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {buf?.name} · {ds.sheet} · {ds.tickets.length.toLocaleString("en-IN")} records · {uniqueIds(ds.tickets).toLocaleString("en-IN")} unique IDs · loaded {ds.loadedAt.toLocaleString("en-IN")}
            </span>
            {ds.sheetNames.length > 1 && (
              <select value={ds.sheet} onChange={(e) => onSheet(e.target.value)} className="h-8 rounded border bg-card px-2 text-xs" aria-label="Worksheet">
                {ds.sheetNames.map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
            {buf?.source === "upload" && <Button variant="ghost" size="sm" onClick={useDefault} title="Forget the saved upload and load the default tickets.xlsx">Use default file</Button>}
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Open Excel</Button>
            <Button size="sm" onClick={reload} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reload Data</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" hidden onChange={(e) => { e.target.files?.[0] && onUpload(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </header>

        <nav className="flex gap-1 border-b bg-card px-5" aria-label="Sections">
          {VIEWS.map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} aria-current={view === k ? "page" : undefined}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${view === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </nav>
        <main className="space-y-4 p-5">
          {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading Excel…</div>}
          {applied.year && view !== "trends" && (
            <div className="text-xs text-muted-foreground">Period: <b className="text-foreground">{applied.month ? `${MONTHS[+applied.month - 1]} ${applied.year}` : `Year ${applied.year}`}</b> (by System Ticket Creation Date · today {today.day}-{today.month}-{today.year} IST)</div>
          )}
          {applied.year && !baseRows.length && (
            <Notice tone="warn">No records for {applied.month ? `${MONTHS[+applied.month - 1]} ${applied.year}` : applied.year} in “{buf?.name}”. Choose another month/year or “All Time” in the sidebar.</Notice>
          )}
          {error && <Notice tone="error"><ErrorDetails e={error} /> <span className="text-xs">The previously loaded data is still shown below.</span></Notice>}
          {ds.missing.length > 0 && (
            <Notice tone="warn">
              Columns not found in sheet “{ds.sheet}”: <b>{ds.missing.map((m) => ROLE_LABELS[m]).join(", ")}</b>. Related filters and charts are hidden.
            </Notice>
          )}
          {ds.duplicateIds > 0 && <Notice tone="warn">{ds.duplicateIds} rows share a Ticket ID with another row. All rows are kept and counted as they appear in the Excel.</Notice>}

          {view === "overview" && <>
          <Kpis ds={ds} rows={baseRows} applied={applied} onSelect={onKpi} />
          <Charts ds={ds} rows={rows} onDrill={onDrill} part="summary" />
          {(ds.mapping.days || ds.mapping.created) && ds.mapping.status && (
            <AgingChart ds={ds} rows={agingRows} active={applied.ageBucket} onSelect={(b) => { commit({ ...applied, ageBucket: b }); if (b) scrollTable(); }} />
          )}
          <div className="rounded-lg border bg-card shadow-sm">
            <button onClick={() => setMore(!more)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-secondary/40">
              <span>Product, Engineer, Zone, Branch &amp; TAT Analysis</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${more ? "rotate-180" : ""}`} />
            </button>
            {more && <div className="space-y-4 border-t p-4"><GroupAnalysis ds={ds} rows={rows} selected={applied.multi} onPick={onDrill} /><Charts ds={ds} rows={rows} onDrill={onDrill} part="more" /></div>}
          </div>
          <div ref={tableRef} className="scroll-mt-16 space-y-4">
            <SelectionSummary rows={rows} applied={applied} onChange={commit} onClear={() => commit(EMPTY_FILTERS)} />
            <TicketTable ds={ds} rows={rows} onSelect={setSelected} />
          </div>
          </>}
          {view === "normal" && (() => {
            const nr = rows.filter((t) => !t.isFcn), na = agingRows.filter((t) => !t.isFcn);
            return <>
              <NormalSummary ds={ds} rows={nr} />
              {(ds.mapping.days || ds.mapping.created) && ds.mapping.status && <AgingChart ds={ds} rows={na} active={applied.ageBucket} onSelect={(b) => commit({ ...applied, ageBucket: b })} />}
              <Charts ds={ds} rows={nr} onDrill={onDrill} part="more" />
              <div ref={tableRef} className="scroll-mt-16 space-y-4">
                <SelectionSummary rows={nr} applied={applied} onChange={commit} onClear={() => commit(EMPTY_FILTERS)} />
                <TicketTable ds={ds} rows={nr} onSelect={setSelected} />
              </div>
            </>;
          })()}
          {view === "fcn" && (() => {
            const fr = rows.filter((t) => t.isFcn);
            return <>
              <FcnView ds={ds} rows={fr} />
              {fr.length > 0 && <div ref={tableRef}><TicketTable ds={ds} rows={fr} onSelect={setSelected} /></div>}
            </>;
          })()}
          {view === "trends" && <TrendsView ds={ds} rows={trendRows} ym={today} />}
        </main>
      </div>
      <TicketDetail ds={ds} ticket={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Kpis({ ds, rows, applied, onSelect }: { ds: Dataset; rows: Ticket[]; applied: Filters; onSelect: (k: KpiKey) => void }) {
  const k = useMemo(() => {
    let open = 0, closed = 0, other = 0, tatSum = 0, tatN = 0;
    for (const t of rows) {
      if (t.statusGroup === "Open") open++; else if (t.statusGroup === "Closed") closed++; else other++;
      if (t.tat != null) { tatSum += t.tat; tatN++; }
    }
    return { open, closed, other, avg: tatN ? tatSum / tatN : null, tatN };
  }, [rows]);
  const period = useMemo(() => {
    const p = periodRange(rows, applied);
    return { value: rows.filter((t) => kpiMatch(t, "period", p)).length, label: p.label };
  }, [rows, applied]);
  const pct = (n: number) => (rows.length ? `${((n / rows.length) * 100).toFixed(1)}% of total` : "");
  const total = ds.tickets.length;
  const hasTat = !!(ds.mapping.created && ds.mapping.closed);
  const card = (key: KpiKey, p: Omit<KpiProps, "active" | "onClick">, enabled = true) => (
    <Kpi {...p} active={applied.kpi === key} onClick={enabled ? () => onSelect(key) : undefined} />
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Click a card to see its tickets and Ticket Type breakdown</span>
        {applied.kpi && <button onClick={() => onSelect(applied.kpi!)} className="text-xs font-medium text-primary hover:underline">Clear KPI selection</button>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {card("total", { icon: TicketIcon, label: "Total Tickets", value: rows.length, sub: rows.length === total ? "All rows in Excel" : `of ${total.toLocaleString("en-IN")} in Excel`, tone: "primary" })}
        {card("open", { icon: Clock, label: "Open Tickets", value: k.open, sub: pct(k.open), tone: "primary" })}
        {card("closed", { icon: CheckCircle2, label: "Closed Tickets", value: k.closed, sub: pct(k.closed), tone: "success" })}
        {card("pending", { icon: Hourglass, label: "Pending / Other", value: k.other, sub: pct(k.other), tone: "warning" })}
        {card("tat", { icon: Activity, label: "Average TAT", value: hasTat ? (k.avg == null ? "—" : `${k.avg.toFixed(1)} days`) : "N/A", sub: hasTat ? `${k.tatN.toLocaleString("en-IN")} tickets with both dates` : "Date column missing", tone: "primary" }, hasTat)}
        {card("period", { icon: CalendarRange, label: "Created in Period", value: ds.mapping.created ? period.value : "N/A", sub: ds.mapping.created ? period.label : "Creation date missing", tone: "primary" }, !!ds.mapping.created)}
      </div>
    </div>
  );
}

interface KpiProps { icon: typeof Activity; label: string; value: number | string; sub?: string; tone: "primary" | "success" | "warning"; active: boolean; onClick?: (() => void) | undefined }
function Kpi({ icon: Icon, label, value, sub, tone, active, onClick }: KpiProps) {
  const iconCls = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary";
  const bar = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={active}
      className={`group relative overflow-hidden rounded-lg border bg-card p-4 text-left shadow-sm transition-all ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"} ${active ? "border-primary ring-2 ring-primary/25" : "hover:border-primary/40"}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${bar} ${active ? "opacity-100" : "opacity-60"}`} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={`rounded-md p-1.5 ${iconCls}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</div>}
      {active && <span className="mt-2 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">Selected</span>}
    </button>
  );
}

function ErrorDetails({ e }: { e: LoadError }) {
  return (
    <div className="space-y-1">
      <div className="font-medium">{e.message}</div>
      <div className="text-xs">File: {e.file}</div>
      {e.missing.length > 0 && <div className="text-xs">Missing column(s): <b>{e.missing.join(", ")}</b></div>}
      {e.headers.length > 0 && <div className="text-xs">Detected headers: {e.headers.join(" · ")}</div>}
    </div>
  );
}

function Notice({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${tone === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-warning/50 bg-warning/10"}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div>{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">{children}</div>;
}
