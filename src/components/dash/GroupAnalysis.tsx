import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { groupStats, type Dataset, type MultiRole, type Ticket } from "@/lib/tickets";

type G = "engineer" | "zone" | "branch" | "product";
const TABS: { key: G; label: string }[] = [
  { key: "engineer", label: "Engineer-wise" }, { key: "zone", label: "Zone-wise" },
  { key: "branch", label: "Branch-wise" }, { key: "product", label: "Product / Model-wise" },
];
type Col = "name" | "total" | "open" | "closed" | "other" | "avgTat" | "avgAge";

/** Operational table per Engineer / Zone / Branch / Model, computed from the active filtered rows. Click a row to filter. */
export function GroupAnalysis({ ds, rows, selected, onPick }: { ds: Dataset; rows: Ticket[]; selected: Partial<Record<MultiRole, string[]>>; onPick: (role: MultiRole, v: string) => void }) {
  const tabs = TABS.filter((t) => ds.mapping[t.key]);
  const [tab, setTab] = useState<G>(tabs[0]?.key ?? "engineer");
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "total", dir: -1 });
  const [all, setAll] = useState(false);
  const data = useMemo(() => {
    const d = groupStats(rows, tab);
    return d.sort((a, b) => {
      const x = a[sort.col], y = b[sort.col];
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [rows, tab, sort]);
  if (!tabs.length) return null;
  const shown = all ? data : data.slice(0, 20);
  const active = new Set(selected[tab] || []);
  const hasTat = !!(ds.mapping.created && ds.mapping.closed);
  const th = (col: Col, label: string, right = true) => (
    <th onClick={() => setSort(sort.col === col ? { col, dir: (sort.dir * -1) as 1 | -1 } : { col, dir: col === "name" ? 1 : -1 })} className={`cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-semibold text-secondary-foreground hover:text-primary ${right ? "text-right" : "text-left"}`}>
      <span className="inline-flex items-center gap-1">{label}{sort.col === col && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
    </th>
  );
  const f1 = (n: number | null) => (n == null ? "—" : n.toFixed(1));

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <h3 className="mr-2 text-sm font-semibold">Detailed Analysis</h3>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setAll(false); }} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{t.label}</button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{data.length} {tab === "product" ? "models" : `${tab}s`} · click a row to filter the ticket table</span>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary">
            <tr>
              {th("name", tabs.find((t) => t.key === tab)!.label.replace("-wise", ""), false)}
              {th("total", "Total")}{th("open", "Open")}{th("closed", "Closed")}{th("other", "Pending / Other")}
              {hasTat && th("avgTat", "Avg TAT (d)")}
              {th("avgAge", "Avg No of Days (open)")}
              {ds.mapping.type && <th className="px-3 py-2 text-left text-xs font-semibold text-secondary-foreground">Top Ticket Type</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.name} onClick={() => onPick(tab, r.name)} className={`cursor-pointer border-t hover:bg-accent/50 ${active.has(r.name) ? "bg-primary/5" : ""}`}>
                <td className="max-w-[260px] truncate px-3 py-2 font-medium" title={r.name}>{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.total}</td>
                <td className="px-3 py-2 text-right tabular-nums text-primary">{r.open}</td>
                <td className="px-3 py-2 text-right tabular-nums text-success">{r.closed}</td>
                <td className="px-3 py-2 text-right tabular-nums text-warning">{r.other}</td>
                {hasTat && <td className="px-3 py-2 text-right tabular-nums">{f1(r.avgTat)}</td>}
                <td className="px-3 py-2 text-right tabular-nums">{f1(r.avgAge)}</td>
                {ds.mapping.type && <td className="max-w-[240px] truncate px-3 py-2 text-xs text-muted-foreground" title={r.topType}>{r.topType}</td>}
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No tickets in the current selection.</td></tr>}
          </tbody>
        </table>
      </div>
      {data.length > 20 && (
        <div className="border-t p-2 text-center">
          <button onClick={() => setAll(!all)} className="text-xs text-primary hover:underline">{all ? "Show top 20" : `View all ${data.length}`}</button>
        </div>
      )}
    </section>
  );
}
