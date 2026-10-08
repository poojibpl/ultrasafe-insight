import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, Columns3, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AgeBadge } from "./AgingChart";
import { fmtCell, type Dataset, type Ticket, type Role, type Cell } from "@/lib/tickets";

const TAT_COL = "TAT (days)";
const AGE_CALC = "No of Days (calculated)";
const DEFAULT_ROLES: Role[] = ["ticketId", "customer", "created", "closed", "status", "type", "days", "product", "serial", "engineer", "branch", "zone", "warranty", "city", "state"];

export function TicketTable({ ds, rows, onSelect }: { ds: Dataset; rows: Ticket[]; onSelect: (t: Ticket) => void }) {
  const ageCol = ds.mapping.days ?? AGE_CALC;
  const allCols = useMemo(() => [...ds.columns, ...(ds.mapping.days ? [] : [AGE_CALC]), ...(ds.mapping.created && ds.mapping.closed ? [TAT_COL] : [])], [ds]);
  const defaults = useMemo(() => {
    const d = DEFAULT_ROLES.map((r) => (r === "days" ? ds.mapping.days ?? AGE_CALC : ds.mapping[r])).filter(Boolean) as string[];
    return ds.mapping.created && ds.mapping.closed ? [...d, TAT_COL] : d;
  }, [ds]);
  const [visible, setVisible] = useState<string[]>(defaults);
  useEffect(() => setVisible(defaults), [defaults]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);

  const val = (t: Ticket, c: string): Cell => (c === TAT_COL ? t.tat : c === ageCol ? t.age : t.raw[c] ?? null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let r = s ? rows.filter((t) => visible.some((c) => fmtCell(val(t, c)).toLowerCase().includes(s))) : rows;
    if (sort) {
      r = [...r].sort((a, b) => {
        const x = val(a, sort.col), y = val(b, sort.col);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const xv = x instanceof Date ? x.getTime() : x, yv = y instanceof Date ? y.getTime() : y;
        if (typeof xv === "number" && typeof yv === "number") return (xv - yv) * sort.dir;
        return String(xv).localeCompare(String(yv), undefined, { numeric: true }) * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort, visible]);
  useEffect(() => setPage(0), [rows, q, size]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const slice = filtered.slice(page * size, page * size + size);

  const exportData = (kind: "csv" | "xlsx") => {
    const data = filtered.map((t) => Object.fromEntries(visible.map((c) => { const v = val(t, c); return [c, v instanceof Date ? fmtCell(v) : v ?? ""]; })));
    const ws = XLSX.utils.json_to_sheet(data, { header: visible });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered Tickets");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ultrasound_tickets_filtered_${stamp}.${kind}`, { bookType: kind });
  };

  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div>
          <h3 className="text-sm font-semibold">Ticket Details</h3>
          <p className="text-xs text-muted-foreground">{filtered.length.toLocaleString("en-IN")} tickets · click a row for full details</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search table…" className="h-9 w-56 pl-8" />
          </div>
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm"><Columns3 className="h-4 w-4" /> Columns ({visible.length})</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <div className="mb-2 flex gap-2 text-xs">
                <button className="text-primary hover:underline" onClick={() => setVisible(allCols)}>All</button>
                <button className="text-primary hover:underline" onClick={() => setVisible(defaults)}>Default</button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {allCols.map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-secondary">
                    <input type="checkbox" className="accent-primary" checked={visible.includes(c)} onChange={() => setVisible(visible.includes(c) ? visible.filter((x) => x !== c) : allCols.filter((x) => x === c || visible.includes(x)))} />
                    {c}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => exportData("csv")}><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportData("xlsx")}><Download className="h-4 w-4" /> Excel</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr>
              {visible.map((c) => (
                <th key={c} onClick={() => setSort(sort?.col === c ? (sort.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 })} className="cursor-pointer whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-secondary-foreground hover:text-primary">
                  <span className="inline-flex items-center gap-1">{c}{sort?.col === c && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => (
              <tr key={t._idx} onClick={() => onSelect(t)} className="cursor-pointer border-t hover:bg-accent/50">
                {visible.map((c) => {
                  const v = fmtCell(val(t, c));
                  const isStatus = c === ds.mapping.status;
                  return (
                    <td key={c} className="max-w-[260px] truncate whitespace-nowrap px-3 py-2" title={v}>
                      {c === ageCol ? <AgeBadge n={t.age} /> : isStatus && v ? <StatusBadge group={t.statusGroup} text={v} /> : v || <span className="text-muted-foreground">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!slice.length && <tr><td colSpan={visible.length} className="py-10 text-center text-muted-foreground">No tickets match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          Rows per page
          <select value={size} onChange={(e) => setSize(+e.target.value)} className="rounded border bg-card px-1 py-1">
            {[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          Page {page + 1} of {pages}
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)}>First</Button>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>Last</Button>
        </div>
      </div>
    </section>
  );
}

export function StatusBadge({ group, text }: { group: Ticket["statusGroup"]; text: string }) {
  const cls = group === "Closed" ? "bg-success/15 text-success" : group === "Open" ? "bg-primary/10 text-primary" : "bg-warning/20 text-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
}
