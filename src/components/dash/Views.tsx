import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, MissingNote } from "./ChartCard";
import { countBy, monthKey, monthLabel, TAT_BUCKETS, type Dataset, type Ticket } from "@/lib/tickets";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 } };
const n = (v: number) => v.toLocaleString("en-IN");

export function Stat({ label, value, sub, tone = "primary" }: { label: string; value: string | number; sub?: string; tone?: "primary" | "success" | "warning" | "destructive" }) {
  const bar = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive" }[tone];
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-1 opacity-60 ${bar}`} />
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{typeof value === "number" ? n(value) : value}</div>
      {sub && <div className="mt-1 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</div>}
    </div>
  );
}

function stats(v: (number | null)[]) {
  const a = v.filter((x): x is number => x != null).sort((x, y) => x - y);
  if (!a.length) return null;
  return { n: a.length, avg: a.reduce((s, x) => s + x, 0) / a.length, median: a[Math.floor(a.length / 2)]! };
}
const days = (s: ReturnType<typeof stats>) => (s ? `${s.avg.toFixed(1)} days` : "—");

/** Monthly counts for several date pickers, on one continuous month axis. */
function monthlyMulti(rows: Ticket[], series: Record<string, (t: Ticket) => Date | null>) {
  const m = new Map<string, Record<string, number>>();
  for (const t of rows) for (const [k, pick] of Object.entries(series)) {
    const d = pick(t); if (!d) continue;
    const key = monthKey(d); const o = m.get(key) || {}; o[k] = (o[k] || 0) + 1; m.set(key, o);
  }
  const keys = [...m.keys()].sort();
  if (!keys.length) return [];
  const out: Record<string, string | number>[] = [];
  let y = +keys[0]!.slice(0, 4), mo = +keys[0]!.slice(5, 7);
  for (let g = 0; g < 600; g++) {
    const k = `${y}-${String(mo).padStart(2, "0")}`;
    const row: Record<string, string | number> = { key: k, label: monthLabel(k) };
    for (const s of Object.keys(series)) row[s] = m.get(k)?.[s] || 0;
    out.push(row);
    if (k === keys[keys.length - 1]) break;
    if (++mo > 12) { mo = 1; y++; }
  }
  return out;
}

function MonthBars({ data, series }: { data: Record<string, string | number>[]; series: [string, string][] }) {
  if (!data.length) return <MissingNote what="No dated records in the current selection." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={axis} />
        <YAxis tick={axis} allowDecimals={false} />
        <Tooltip {...tip} cursor={{ fill: "var(--secondary)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(([k, c]) => <Bar key={k} dataKey={k} fill={c} radius={[4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function Dist({ values }: { values: (number | null)[] }) {
  const v = values.filter((x): x is number => x != null);
  const data = TAT_BUCKETS.map(([name, lo, hi]) => ({ name, value: v.filter((x) => x >= lo && x <= hi).length }));
  if (!v.length) return <MissingNote what="No records with both dates in the current selection." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={axis} interval={0} angle={-30} textAnchor="end" height={55} />
        <YAxis tick={axis} allowDecimals={false} />
        <Tooltip {...tip} cursor={{ fill: "var(--secondary)" }} />
        <Bar dataKey="value" name="Tickets" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Normal service calls: everything not identified as FCN. TAT = Ticket Closed Date − Creation Date. */
export function NormalSummary({ ds, rows }: { ds: Dataset; rows: Ticket[] }) {
  const m = ds.mapping;
  const s = useMemo(() => {
    let open = 0, closed = 0, other = 0;
    for (const t of rows) { if (t.statusGroup === "Open") open++; else if (t.statusGroup === "Closed") closed++; else other++; }
    return { open, closed, other, tat: stats(rows.map((t) => t.tat)), noClose: rows.filter((t) => t.statusGroup === "Closed" && !t.closed).length };
  }, [rows]);
  const monthly = useMemo(() => monthlyMulti(rows, { Created: (t) => t.created, Closed: (t) => t.closed }), [rows]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Normal Calls" value={rows.length} sub="FCN records excluded" />
        <Stat label="Open" value={s.open} />
        <Stat label="Closed" value={s.closed} tone="success" />
        <Stat label="Pending / Other" value={s.other} tone="warning" />
        <Stat label="Avg Normal-Call TAT" value={m.created && m.closed ? days(s.tat) : "N/A"} sub={s.tat ? `Median ${s.tat.median} d · ${n(s.tat.n)} tickets` : `${m.closed ?? "Closed date"} − creation date`} />
        <Stat label="Closed, no close date" value={s.noClose} tone={s.noClose ? "warning" : "primary"} sub="Not counted in TAT" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <ChartCard title="Normal Calls by Month" subtitle={`Created by “${m.created ?? "—"}” · Closed by “${m.closed ?? "—"}”`} className="xl:col-span-7">
          <MonthBars data={monthly} series={[["Created", "var(--chart-1)"], ["Closed", "var(--success)"]]} />
        </ChartCard>
        <ChartCard title="Normal-Call TAT Distribution" subtitle="Completed calls only (Ticket Closed Date − System Ticket Creation Date)" className="xl:col-span-5">
          {!m.created || !m.closed ? <MissingNote what="TAT needs both creation and closed date columns." /> : <Dist values={rows.map((t) => t.tat)} />}
        </ChartCard>
      </div>
    </div>
  );
}

const FCN_LOOKED_FOR = "FCN No / FCN Number, FCN Closed Date, CRM Timeline Closure Date (or a Ticket Type containing “FCN”)";

export function FcnView({ ds, rows }: { ds: Dataset; rows: Ticket[] }) {
  const m = ds.mapping;
  const hasAny = !!(m.fcn || m.fcnClosed || m.crmClosed) || ds.tickets.some((t) => t.isFcn);
  const s = useMemo(() => ({
    fcnTat: stats(rows.map((t) => t.fcnTat)),
    crmTat: stats(rows.map((t) => t.crmTat)),
    fcnClosed: rows.filter((t) => t.fcnClosed).length,
    crmClosed: rows.filter((t) => t.crmClosed).length,
    awaiting: rows.filter((t) => !t.fcnClosed && t.statusGroup !== "Closed").length,
    missing: rows.filter((t) => !t.fcnClosed || t.fcnInvalid || (m.crmClosed && (!t.crmClosed || t.crmInvalid))).length,
    invalid: rows.filter((t) => t.fcnInvalid || t.crmInvalid).length,
  }), [rows, m.crmClosed]);
  const fcnMonthly = useMemo(() => monthlyMulti(rows, { "FCN Closed": (t) => t.fcnClosed }), [rows]);
  const crmMonthly = useMemo(() => monthlyMulti(rows, { "CRM Timeline Closed": (t) => t.crmClosed }), [rows]);

  if (!hasAny) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold">FCN Analysis</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The active sheet “{ds.sheet}” in <b>{ds.fileName}</b> has no FCN columns, so no FCN figures are shown (nothing is estimated).
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Looked for: {FCN_LOOKED_FOR}.</p>
        <p className="mt-1 text-xs text-muted-foreground">Date columns found: {ds.dateColumns.join(" · ") || "none"}.</p>
        <p className="mt-2 text-xs text-muted-foreground">Open an Excel that contains these columns and this section fills in automatically. Normal-call TAT never uses FCN dates.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Columns used: FCN ID “{m.fcn ?? "not found"}” · FCN closure “{m.fcnClosed ?? "not found"}” · CRM timeline closure “{m.crmClosed ?? "not found"}” · start date “{m.created ?? "not found"}”
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="FCN Records" value={rows.length} />
        <Stat label="Avg FCN Closure" value={m.fcnClosed ? days(s.fcnTat) : "N/A"} sub={s.fcnTat ? `${n(s.fcnTat.n)} with FCN Closed Date` : "FCN Closed Date missing"} />
        <Stat label="Avg CRM Timeline Closure" value={m.crmClosed ? days(s.crmTat) : "N/A"} sub={s.crmTat ? `${n(s.crmTat.n)} with CRM date` : "CRM Timeline Closure Date missing"} />
        <Stat label="FCN Closed" value={s.fcnClosed} tone="success" sub="Has a valid FCN Closed Date" />
        <Stat label="Awaiting FCN Closure" value={s.awaiting} tone="warning" sub="No FCN Closed Date, ticket not closed" />
        <Stat label="Missing / Invalid Dates" value={s.missing} tone={s.invalid ? "destructive" : "warning"} sub={`${n(s.invalid)} unreadable date values`} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="FCN Closures by Month" subtitle={`By “${m.fcnClosed ?? "FCN Closed Date"}”`}>
          {m.fcnClosed ? <MonthBars data={fcnMonthly} series={[["FCN Closed", "var(--success)"]]} /> : <MissingNote what="FCN Closed Date column not found." />}
        </ChartCard>
        <ChartCard title="CRM Timeline Closures by Month" subtitle={`By “${m.crmClosed ?? "CRM Timeline Closure Date"}”`}>
          {m.crmClosed ? <MonthBars data={crmMonthly} series={[["CRM Timeline Closed", "var(--chart-2)"]]} /> : <MissingNote what="CRM Timeline Closure Date column not found." />}
        </ChartCard>
        <ChartCard title="FCN Closure Duration" subtitle="FCN Closed Date − System Ticket Creation Date">
          {m.fcnClosed && m.created ? <Dist values={rows.map((t) => t.fcnTat)} /> : <MissingNote what="Needs FCN Closed Date and creation date." />}
        </ChartCard>
        <ChartCard title="CRM Timeline Closure Duration" subtitle="CRM Timeline Closure Date − System Ticket Creation Date">
          {m.crmClosed && m.created ? <Dist values={rows.map((t) => t.crmTat)} /> : <MissingNote what="Needs CRM Timeline Closure Date and creation date." />}
        </ChartCard>
      </div>
    </div>
  );
}

/** Trend across all months (Year/Month filter ignored here so the trend has context). */
export function TrendsView({ ds, rows, ym }: { ds: Dataset; rows: Ticket[]; ym: { year: string; month: string } }) {
  const m = ds.mapping;
  const data = useMemo(() => monthlyMulti(rows, { Created: (t) => t.created, Closed: (t) => t.closed }), [rows]);
  const cur = `${ym.year}-${ym.month}`;
  const prevD = new Date(+ym.year, +ym.month - 2, 1);
  const prev = monthKey(prevD);
  const inM = (k: string) => rows.filter((t) => t.created && monthKey(t.created) === k);
  const curRows = inM(cur), prevRows = inM(prev);
  const closedCur = rows.filter((t) => t.closed && monthKey(t.closed) === cur).length;
  const delta = prevRows.length ? ((curRows.length - prevRows.length) / prevRows.length) * 100 : null;
  const types = countBy(curRows, (t) => t.dims.type ?? null);
  const last = data.length ? String(data[data.length - 1]!.key) : null;
  if (!m.created) return <MissingNote what="Trends need the System Ticket Creation Date column." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Created · ${monthLabel(cur)}`} value={curRows.length} sub={curRows.length ? "Current month (India time)" : "No records for the current month yet"} />
        <Stat label={`Created · ${monthLabel(prev)}`} value={prevRows.length} sub="Previous month" />
        <Stat label="Change vs previous" value={delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`} tone={delta != null && delta > 0 ? "warning" : "primary"} />
        <Stat label={`Closed · ${monthLabel(cur)}`} value={closedCur} tone="success" sub={`By “${m.closed ?? "closed date"}”`} />
      </div>
      {last && last < cur && <p className="text-xs text-muted-foreground">Latest month with data in this file: {monthLabel(last)}. Newer months appear after the Excel is updated and reloaded.</p>}
      <ChartCard title="Monthly Created vs Closed" subtitle="All months in the file · other sidebar filters applied, Year/Month ignored">
        {!data.length ? <MissingNote what="No dated records." /> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="Created" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              <Line dataKey="Closed" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      <ChartCard title={`Ticket Types · ${monthLabel(cur)}`} subtitle="Current month by creation date">
        {!types.length ? <MissingNote what="No tickets created in the current month." /> : (
          <div className="flex flex-wrap gap-2">{types.map((t) => <span key={t.name} className="rounded-md border px-2 py-1 text-xs">{t.name} <b className="tabular-nums">{t.value}</b></span>)}</div>
        )}
      </ChartCard>
    </div>
  );
}
