import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChartCard, MissingNote, PALETTE, STATUS_GROUP_COLORS } from "./ChartCard";
import { BLANK, TAT_BUCKETS, countBy, type Dataset, type MultiRole, type Ticket, ROLE_LABELS } from "@/lib/tickets";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 } };

interface Props {
  ds: Dataset;
  rows: Ticket[];
  onDrill: (role: MultiRole | "statusGroup", value: string) => void;
  part: "summary" | "more";
}

function HBar({ data, onClick, color = "var(--chart-1)", height }: { data: { name: string; value: number }[]; onClick: (n: string) => void; color?: string; height?: number }) {
  const h = height ?? Math.max(180, data.length * 26 + 30);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={axis} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={170} tick={axis} interval={0} tickFormatter={(v: string) => (v.length > 26 ? v.slice(0, 25) + "…" : v)} />
        <Tooltip {...tip} cursor={{ fill: "var(--secondary)" }} />
        <Bar dataKey="value" name="Tickets" fill={color} radius={[0, 4, 4, 0]} className="cursor-pointer" onClick={(d: { name?: string }) => d.name && onClick(d.name)} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Charts({ ds, rows, onDrill, part }: Props) {
  const m = ds.mapping;
  const [engSort, setEngSort] = useState<"desc" | "asc" | "name">("desc");
  const [engAll, setEngAll] = useState(false);
  const [prodAll, setProdAll] = useState(false);

  const groups = useMemo(() => countBy(rows, (t) => t.statusGroup), [rows]);
  const statuses = useMemo(() => countBy(rows, (t) => t.dims.status ?? null), [rows]);
  const types = useMemo(() => countBy(rows, (t) => t.dims.type ?? null), [rows]);
  const products = useMemo(() => countBy(rows, (t) => t.dims.product ?? null), [rows]);
  const zones = useMemo(() => countBy(rows, (t) => t.dims.zone ?? null), [rows]);
  const branches = useMemo(() => countBy(rows, (t) => t.dims.branch ?? null), [rows]);
  const engineers = useMemo(() => {
    const d = countBy(rows, (t) => t.dims.engineer ?? null);
    if (engSort === "asc") d.sort((a, b) => a.value - b.value);
    if (engSort === "name") d.sort((a, b) => a.name.localeCompare(b.name));
    return d;
  }, [rows, engSort]);
  const tatRows = useMemo(() => rows.filter((t) => t.tat != null), [rows]);
  const tatDist = useMemo(() => TAT_BUCKETS.map(([name, lo, hi]) => ({ name, value: tatRows.filter((t) => t.tat! >= lo && t.tat! <= hi).length })), [tatRows]);
  const tatEng = useMemo(() => {
    const mp = new Map<string, { s: number; n: number }>();
    for (const t of tatRows) { const k = t.dims.engineer ?? BLANK; const e = mp.get(k) || { s: 0, n: 0 }; e.s += t.tat!; e.n++; mp.set(k, e); }
    return [...mp.entries()].filter(([, e]) => e.n >= 3).map(([name, e]) => ({ name, value: +(e.s / e.n).toFixed(1), n: e.n })).sort((a, b) => b.value - a.value);
  }, [tatRows]);

  const need = (r: keyof typeof m) => `Column for "${ROLE_LABELS[r]}" not found in the sheet — chart hidden.`;
  const toggleBtn = (on: boolean, set: (v: boolean) => void, total: number) => (
    <button onClick={() => set(!on)} className="rounded border px-2 py-1 text-xs text-primary hover:bg-secondary">{on ? "Show top 15" : `View all (${total})`}</button>
  );

  const summary = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <ChartCard title="Ticket Status" subtitle="Click a slice to filter" className="xl:col-span-4">
        {!m.status ? <MissingNote what={need("status")} /> : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={groups} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} className="cursor-pointer" onClick={(d: { name?: string }) => d.name && onDrill("statusGroup", d.name)}>
                  {groups.map((g) => <Cell key={g.name} fill={STATUS_GROUP_COLORS[g.name]} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 max-h-28 overflow-y-auto border-t pt-2">
              {statuses.map((s) => (
                <button key={s.name} onClick={() => onDrill("status", s.name)} className="flex w-full justify-between rounded px-1 py-0.5 text-xs hover:bg-secondary">
                  <span>{s.name}</span><span className="tabular-nums text-muted-foreground">{s.value}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </ChartCard>

      <ChartCard title="Ticket Type" subtitle="Click a bar to filter" className="xl:col-span-8">
        {!m.type ? <MissingNote what={need("type")} /> : <HBar data={types} onClick={(n) => onDrill("type", n)} color="var(--chart-2)" />}
      </ChartCard>

    </div>
  );
  if (part === "summary") return summary;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <ChartCard title="Product / Ultrasound Model" subtitle={`${products.length} models · click to filter`} className="xl:col-span-6" actions={products.length > 15 && toggleBtn(prodAll, setProdAll, products.length)}>
        {!m.product ? <MissingNote what={need("product")} /> : <div className="max-h-[520px] overflow-y-auto"><HBar data={prodAll ? products : products.slice(0, 15)} onClick={(n) => onDrill("product", n)} color="var(--chart-3)" /></div>}
      </ChartCard>

      <ChartCard
        title="Engineer Workload" subtitle={`${engineers.length} engineers · click to view their tickets`} className="xl:col-span-6"
        actions={
          <div className="flex gap-1">
            <select value={engSort} onChange={(e) => setEngSort(e.target.value as typeof engSort)} className="rounded border bg-card px-1 py-1 text-xs">
              <option value="desc">Most tickets</option><option value="asc">Fewest tickets</option><option value="name">Name A–Z</option>
            </select>
            {engineers.length > 15 && toggleBtn(engAll, setEngAll, engineers.length)}
          </div>
        }
      >
        {!m.engineer ? <MissingNote what={need("engineer")} /> : <div className="max-h-[520px] overflow-y-auto"><HBar data={engAll ? engineers : engineers.slice(0, 15)} onClick={(n) => onDrill("engineer", n)} /></div>}
      </ChartCard>

      <ChartCard title="Zone Analysis" subtitle="Click to filter" className="xl:col-span-4">
        {!m.zone ? <MissingNote what={need("zone")} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={zones}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={axis} interval={0} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip {...tip} cursor={{ fill: "var(--secondary)" }} />
              <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(d: { name?: string }) => d.name && onDrill("zone", d.name)}>
                {zones.map((z, i) => <Cell key={z.name} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Branch Analysis" subtitle="Click to filter" className="xl:col-span-8">
        {!m.branch ? <MissingNote what={need("branch")} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={branches}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={axis} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip {...tip} cursor={{ fill: "var(--secondary)" }} />
              <Bar dataKey="value" name="Tickets" fill="var(--chart-1)" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(d: { name?: string }) => d.name && onDrill("branch", d.name)} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="TAT Distribution" subtitle={`Closed Date − Creation Date · ${tatRows.length.toLocaleString("en-IN")} tickets with both dates`} className="xl:col-span-5">
        {!m.created || !m.closed ? <MissingNote what="TAT needs both creation and closed date columns." /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tatDist}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={axis} interval={0} angle={-30} textAnchor="end" height={55} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip {...tip} cursor={{ fill: "var(--secondary)" }} />
              <Bar dataKey="value" name="Tickets" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Average TAT by Engineer (days)" subtitle="Engineers with ≥ 3 TAT-eligible tickets · click to filter" className="xl:col-span-7">
        {!m.created || !m.closed || !m.engineer ? <MissingNote what="Needs creation date, closed date and engineer columns." /> : tatEng.length === 0 ? <MissingNote what="Not enough closed tickets in selection." /> : (
          <div className="max-h-[280px] overflow-y-auto"><HBar data={tatEng} onClick={(n) => onDrill("engineer", n)} color="var(--chart-4)" /></div>
        )}
      </ChartCard>
    </div>
  );
}
