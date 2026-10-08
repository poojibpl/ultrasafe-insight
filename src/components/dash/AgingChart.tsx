import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "./ChartCard";
import { AGE_BUCKETS, type Dataset, type Ticket } from "@/lib/tickets";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

export function AgingChart({ ds, rows, active, onSelect }: { ds: Dataset; rows: Ticket[]; active: string | null; onSelect: (b: string | null) => void }) {
  const pending = useMemo(() => rows.filter((t) => t.statusGroup !== "Closed"), [rows]);
  const data = useMemo(
    () => AGE_BUCKETS.map((b) => ({ ...b, value: pending.filter((t) => t.age != null && t.age >= b.lo && t.age <= b.hi).length })),
    [pending],
  );
  const noAge = pending.filter((t) => t.age == null).length;
  const old = data.filter((d) => d.lo >= 31).reduce((s, d) => s + d.value, 0);
  const source = ds.mapping.days
    ? `From the “${ds.mapping.days}” column`
    : `Days since System Ticket Creation Date (no “No of Days” column in sheet)`;

  return (
    <ChartCard
      title="Open / Pending Ticket Aging"
      subtitle={`${pending.length.toLocaleString("en-IN")} open & pending tickets · ${source} · click a bar to filter`}
      actions={
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-md bg-age-5-bg px-2 py-1 font-medium text-age-5">{old.toLocaleString("en-IN")} older than 30 days</span>
          {active && <button onClick={() => onSelect(null)} className="text-primary hover:underline">Clear bucket</button>}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={axis} interval={0} />
          <YAxis tick={axis} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} cursor={{ fill: "var(--secondary)" }} />
          <Bar dataKey="value" name="Tickets" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(d: { name?: string }) => d.name && onSelect(d.name === active ? null : d.name)}>
            {data.map((d) => (
              <Cell key={d.name} fill={`var(--age-${d.level})`} fillOpacity={!active || active === d.name ? 1 : 0.3} />
            ))}
            <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {noAge > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{noAge} open/pending tickets have no valid day value and are not shown.</p>}
    </ChartCard>
  );
}

export function AgeBadge({ n }: { n: number | null }) {
  if (n == null) return <span className="text-muted-foreground">—</span>;
  const lvl = AGE_BUCKETS.find((b) => n >= b.lo && n <= b.hi)?.level ?? 1;
  const cls = ["", "bg-age-1-bg text-age-1", "bg-age-2-bg text-age-2", "bg-age-3-bg text-age-3", "bg-age-4-bg text-age-4", "bg-age-5-bg text-age-5"][lvl];
  return <span className={`inline-block min-w-10 rounded px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${cls}`}>{n}</span>;
}
