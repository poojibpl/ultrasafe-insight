import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, Hourglass, Loader2, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Ticket as TicketIcon, Upload, X, CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/dash/FilterPanel";
import { Charts } from "@/components/dash/Charts";
import { TicketTable } from "@/components/dash/TicketTable";
import { TicketDetail } from "@/components/dash/TicketDetail";
import {
  applyFilters, EMPTY_FILTERS, fmtDate, parseWorkbook, ROLE_LABELS, toISODate,
  type Dataset, type Filters, type MultiRole, type Ticket,
} from "@/lib/tickets";

const DATA_URL = "/data/tickets.xlsx";

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
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const parse = useCallback((data: ArrayBuffer, name: string, sheet?: string) => {
    try {
      const d = parseWorkbook(data, name, sheet);
      setDs(d);
      setError(null);
      return d;
    } catch (e) {
      setError(`Could not read the Excel file: ${(e as Error).message}`);
      return null;
    }
  }, []);

  const loadServer = useCallback(async (notify = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Data file not found at public${DATA_URL} (HTTP ${res.status})`);
      const data = await res.arrayBuffer();
      setBuf({ data, name: "tickets.xlsx", source: "server" });
      const d = parse(data, "tickets.xlsx", ds?.sheet);
      if (d && notify) toast.success(`Reloaded ${d.tickets.length.toLocaleString("en-IN")} tickets`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [parse, ds?.sheet]);

  useEffect(() => { loadServer(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onUpload = async (f: File) => {
    setLoading(true);
    const data = await f.arrayBuffer();
    setBuf({ data, name: f.name, source: "upload" });
    const d = parse(data, f.name);
    setLoading(false);
    if (d) { toast.success(`Loaded ${d.tickets.length.toLocaleString("en-IN")} tickets from ${f.name}`); setApplied(EMPTY_FILTERS); setDraft(EMPTY_FILTERS); }
  };

  const reload = () => {
    if (buf?.source === "upload") { toast.info("Showing an uploaded file — choose it again with “Open Excel” to reload it, or reloading the default data file."); }
    loadServer(true);
  };

  const rows = useMemo(() => (ds ? applyFilters(ds.tickets, applied) : []), [ds, applied]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  const commit = (f: Filters) => { setApplied(f); setDraft(f); };
  const scrollTable = () => setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  const onDrill = (role: MultiRole | "statusGroup", value: string) => {
    if (role === "statusGroup") commit({ ...applied, statusGroup: [value] });
    else commit({ ...applied, multi: { ...applied.multi, [role]: [value] } });
    toast(`Filtered: ${value}`);
    scrollTable();
  };
  const onMonth = (field: "created" | "closed", key: string) => {
    const [y, m] = key.split("-").map(Number);
    const from = toISODate(new Date(y, m - 1, 1)), to = toISODate(new Date(y, m, 0));
    commit(field === "created" ? { ...applied, createdFrom: from, createdTo: to } : { ...applied, closedFrom: from, closedTo: to });
    scrollTable();
  };

  if (loading && !ds) return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /> Reading Excel data…</Centered>;
  if (!ds) return (
    <Centered>
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="max-w-md text-center">{error ?? "No data loaded."}</p>
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
            <FilterPanel ds={ds} draft={draft} setDraft={setDraft} dirty={dirty} onApply={() => setApplied(draft)} onReset={() => setDraft(applied)} onClear={() => commit(EMPTY_FILTERS)} />
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
              {buf?.name} · {ds.sheet} · loaded {ds.loadedAt.toLocaleTimeString("en-IN")}
            </span>
            {ds.sheetNames.length > 1 && (
              <select value={ds.sheet} onChange={(e) => buf && parse(buf.data, buf.name, e.target.value)} className="h-8 rounded border bg-card px-2 text-xs" aria-label="Worksheet">
                {ds.sheetNames.map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Open Excel</Button>
            <Button size="sm" onClick={reload} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reload Data</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" hidden onChange={(e) => { e.target.files?.[0] && onUpload(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </header>

        <main className="space-y-4 p-5">
          {error && <Notice tone="error">{error}</Notice>}
          {ds.missing.length > 0 && (
            <Notice tone="warn">
              Columns not found in sheet “{ds.sheet}”: <b>{ds.missing.map((m) => ROLE_LABELS[m]).join(", ")}</b>. Related filters and charts are hidden.
            </Notice>
          )}
          {ds.duplicateIds > 0 && <Notice tone="warn">{ds.duplicateIds} rows share a Ticket ID with another row. All rows are kept and counted as they appear in the Excel.</Notice>}

          <ActiveChips applied={applied} onChange={commit} />
          <Kpis ds={ds} rows={rows} applied={applied} />
          <Charts ds={ds} rows={rows} onDrill={onDrill} onMonth={onMonth} />
          <div ref={tableRef} className="scroll-mt-16"><TicketTable ds={ds} rows={rows} onSelect={setSelected} /></div>
        </main>
      </div>
      <TicketDetail ds={ds} ticket={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Kpis({ ds, rows, applied }: { ds: Dataset; rows: Ticket[]; applied: Filters }) {
  const k = useMemo(() => {
    let open = 0, closed = 0, other = 0, tatSum = 0, tatN = 0;
    for (const t of rows) {
      if (t.statusGroup === "Open") open++; else if (t.statusGroup === "Closed") closed++; else other++;
      if (t.tat != null) { tatSum += t.tat; tatN++; }
    }
    return { open, closed, other, avg: tatN ? tatSum / tatN : null, tatN };
  }, [rows]);
  const period = useMemo(() => {
    if (applied.createdFrom || applied.createdTo) {
      return { value: rows.filter((t) => t.created).length, label: `${applied.createdFrom ? fmtDate(new Date(applied.createdFrom + "T00:00")) : "start"} → ${applied.createdTo ? fmtDate(new Date(applied.createdTo + "T00:00")) : "latest"}` };
    }
    const ds2 = rows.filter((t) => t.created);
    if (!ds2.length) return { value: 0, label: "No creation dates" };
    const max = Math.max(...ds2.map((t) => t.created!.getTime()));
    const from = max - 29 * 86400000;
    return { value: ds2.filter((t) => t.created!.getTime() >= from).length, label: `Last 30 days of data (to ${fmtDate(new Date(max))})` };
  }, [rows, applied]);
  const pct = (n: number) => (rows.length ? `${((n / rows.length) * 100).toFixed(1)}% of selection` : "");
  const total = ds.tickets.length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi icon={TicketIcon} label="Total Tickets" value={rows.length} sub={rows.length === total ? "All rows in Excel" : `of ${total.toLocaleString("en-IN")} in Excel`} tone="primary" />
      <Kpi icon={Clock} label="Open Tickets" value={k.open} sub={pct(k.open)} tone="primary" />
      <Kpi icon={CheckCircle2} label="Closed Tickets" value={k.closed} sub={pct(k.closed)} tone="success" />
      <Kpi icon={Hourglass} label="Pending / Other" value={k.other} sub={pct(k.other)} tone="warning" />
      <Kpi icon={Activity} label="Average TAT" value={ds.mapping.created && ds.mapping.closed ? (k.avg == null ? "—" : `${k.avg.toFixed(1)} d`) : "N/A"} sub={ds.mapping.created && ds.mapping.closed ? `${k.tatN.toLocaleString("en-IN")} tickets with both dates` : "Date column missing"} tone="success" />
      <Kpi icon={CalendarRange} label="Created in Period" value={ds.mapping.created ? period.value : "N/A"} sub={ds.mapping.created ? period.label : "Creation date missing"} tone="primary" />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Activity; label: string; value: number | string; sub?: string; tone: "primary" | "success" | "warning" }) {
  const toneCls = tone === "success" ? "bg-success/12 text-success" : tone === "warning" ? "bg-warning/20 text-foreground" : "bg-primary/10 text-primary";
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`rounded-md p-1.5 ${toneCls}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</div>}
    </div>
  );
}

function ActiveChips({ applied, onChange }: { applied: Filters; onChange: (f: Filters) => void }) {
  const chips: { label: string; clear: () => Filters }[] = [];
  if (applied.ticketId) chips.push({ label: `Ticket ID: ${applied.ticketId}`, clear: () => ({ ...applied, ticketId: "" }) });
  if (applied.serial) chips.push({ label: `Serial: ${applied.serial}`, clear: () => ({ ...applied, serial: "" }) });
  if (applied.statusGroup.length) chips.push({ label: `Status group: ${applied.statusGroup.join(", ")}`, clear: () => ({ ...applied, statusGroup: [] }) });
  for (const [k, v] of Object.entries(applied.multi)) if (v?.length) chips.push({ label: `${ROLE_LABELS[k as MultiRole]}: ${v.length > 2 ? `${v.length} selected` : v.join(", ")}`, clear: () => ({ ...applied, multi: { ...applied.multi, [k]: [] } }) });
  if (applied.createdFrom || applied.createdTo) chips.push({ label: `Created: ${applied.createdFrom || "…"} → ${applied.createdTo || "…"}`, clear: () => ({ ...applied, createdFrom: "", createdTo: "" }) });
  if (applied.closedFrom || applied.closedTo) chips.push({ label: `Closed: ${applied.closedFrom || "…"} → ${applied.closedTo || "…"}`, clear: () => ({ ...applied, closedFrom: "", closedTo: "" }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Active filters:</span>
      {chips.map((c) => (
        <button key={c.label} onClick={() => onChange(c.clear())} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary hover:bg-primary/10">
          {c.label} <X className="h-3 w-3" />
        </button>
      ))}
      <button onClick={() => onChange(EMPTY_FILTERS)} className="text-xs text-muted-foreground underline hover:text-foreground">Clear all</button>
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
