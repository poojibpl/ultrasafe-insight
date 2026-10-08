import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countBy, KPI_LABELS, ROLE_LABELS, type Filters, type MultiRole, type Ticket } from "@/lib/tickets";

/** Explains why the table shows what it shows, plus a Ticket Type breakdown of the current selection. */
export function SelectionSummary({ rows, applied, onChange, onClear }: { rows: Ticket[]; applied: Filters; onChange: (f: Filters) => void; onClear: () => void }) {
  const types = useMemo(() => countBy(rows, (t) => t.dims.type ?? null), [rows]);
  const tat = useMemo(() => {
    const v = rows.map((t) => t.tat).filter((x): x is number => x != null).sort((a, b) => a - b);
    if (!v.length) return null;
    return { n: v.length, avg: v.reduce((s, x) => s + x, 0) / v.length, median: v[Math.floor(v.length / 2)]!, max: v[v.length - 1]!, within7: v.filter((x) => x <= 7).length };
  }, [rows]);

  const steps: string[] = [];
  steps.push(applied.kpi ? KPI_LABELS[applied.kpi] : "All Tickets");
  if (applied.statusGroup.length) steps.push(applied.statusGroup.join(", "));
  for (const [k, v] of Object.entries(applied.multi)) if (v?.length) steps.push(`${ROLE_LABELS[k as MultiRole]}: ${v.length > 2 ? `${v.length} selected` : v.join(", ")}`);
  if (applied.ageBucket) steps.push(`Aging ${applied.ageBucket}`);
  if (applied.createdFrom || applied.createdTo) steps.push(`Created ${applied.createdFrom || "…"} → ${applied.createdTo || "…"}`);
  if (applied.closedFrom || applied.closedTo) steps.push(`Closed ${applied.closedFrom || "…"} → ${applied.closedTo || "…"}`);
  if (applied.ticketId) steps.push(`Ticket ID “${applied.ticketId}”`);
  if (applied.serial) steps.push(`Serial “${applied.serial}”`);
  const anything = steps.length > 1 || applied.kpi;
  const activeTypes = new Set(applied.multi.type || []);

  return (
    <section className="rounded-lg border border-primary/20 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Showing</span>
        <span className="text-sm font-semibold text-foreground">{steps.join(" → ")}</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">{rows.length.toLocaleString("en-IN")} tickets</span>
        {anything && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={onClear}><X className="h-3.5 w-3.5" /> Clear Filters</Button>
        )}
      </div>

      {types.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Ticket Type breakdown · click to filter</div>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const on = activeTypes.has(t.name);
              return (
                <button
                  key={t.name}
                  onClick={() => onChange({ ...applied, multi: { ...applied.multi, type: on ? [] : [t.name] } })}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "bg-secondary/40 hover:border-primary/40 hover:bg-secondary"}`}
                >
                  <span>{t.name}</span>
                  <span className={`font-semibold tabular-nums ${on ? "" : "text-primary"}`}>{t.value.toLocaleString("en-IN")}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {applied.kpi === "tat" && tat && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-5">
          <Stat label="Tickets with TAT" value={tat.n.toLocaleString("en-IN")} />
          <Stat label="Average TAT" value={`${tat.avg.toFixed(1)} days`} />
          <Stat label="Median TAT" value={`${tat.median} days`} />
          <Stat label="Longest TAT" value={`${tat.max} days`} />
          <Stat label="Closed within 7 days" value={`${((tat.within7 / tat.n) * 100).toFixed(1)}%`} />
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/50 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
