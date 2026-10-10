import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "./MultiSelect";
import { countBy, MONTHS, periodOptions, ROLE_LABELS, type Dataset, type Filters, type MultiRole } from "@/lib/tickets";

const ADV_LABELS: Partial<Record<MultiRole, string>> = {
  status: "Exact Ticket Status", engineer: "BPL Engineer", zone: "Zone", branch: "Branch", customer: "Customer / Hospital", warranty: "Warranty",
};
const ADV: MultiRole[] = ["status", "engineer", "zone", "branch", "customer", "warranty"];

interface Props {
  ds: Dataset;
  draft: Filters;
  setDraft: (f: Filters) => void;
  dirty: boolean;
  currentYM: { year: string; month: string };
  onApply: () => void;
  onReset: () => void;
  onClear: () => void;
}

const sel = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm hover:border-primary/50";

export function FilterPanel({ ds, draft, setDraft, dirty, currentYM, onApply, onReset, onClear }: Props) {
  const [adv, setAdv] = useState(() => ADV.some((r) => draft.multi[r]?.length));
  const opts = (r: MultiRole) => countBy(ds.tickets, (t) => t.dims[r] ?? null).sort((a, b) => a.name.localeCompare(b.name));
  const periods = useMemo(() => periodOptions(ds.tickets), [ds]);
  const years = useMemo(() => {
    const y = new Set(periods.keys());
    y.add(currentYM.year);
    return [...y].sort((a, b) => b.localeCompare(a));
  }, [periods, currentYM.year]);
  const months = useMemo(() => {
    if (!draft.year) return [];
    const m = new Map(periods.get(draft.year) ?? []);
    if (draft.year === currentYM.year && !m.has(currentYM.month)) m.set(currentYM.month, 0);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [periods, draft.year, currentYM]);
  const statusGroups = useMemo(() => countBy(ds.tickets, (t) => t.statusGroup), [ds]);
  const set = (p: Partial<Filters>) => setDraft({ ...draft, ...p });

  return (
    <div className="space-y-3">
      {ds.mapping.created && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Year">
            <select className={sel} value={draft.year} onChange={(e) => set({ year: e.target.value, month: "" })} aria-label="Year">
              <option value="">All Time</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Month">
            <select className={sel} value={draft.month} onChange={(e) => set({ month: e.target.value })} disabled={!draft.year} aria-label="Month">
              <option value="">All months</option>
              {months.map(([m, n]) => <option key={m} value={m}>{MONTHS[+m - 1]}{n ? "" : " (no records)"}</option>)}
            </select>
          </Field>
        </div>
      )}
      {ds.mapping.created && <p className="-mt-1 text-[11px] text-muted-foreground">By System Ticket Creation Date</p>}
      {ds.mapping.ticketId && (
        <Field label="Ticket ID"><Input className="h-9" value={draft.ticketId} onChange={(e) => set({ ticketId: e.target.value })} placeholder="Search ticket ID" onKeyDown={(e) => e.key === "Enter" && onApply()} /></Field>
      )}
      {ds.mapping.status && <MultiSelect label="Ticket Status" options={statusGroups} selected={draft.statusGroup} onChange={(v) => set({ statusGroup: v })} />}
      {ds.mapping.type && <MultiSelect label="Ticket Type" options={opts("type")} selected={draft.multi.type || []} onChange={(v) => set({ multi: { ...draft.multi, type: v } })} />}
      {ds.mapping.product && <MultiSelect label="Product / Model" options={opts("product")} selected={draft.multi.product || []} onChange={(v) => set({ multi: { ...draft.multi, product: v } })} />}
      {ds.mapping.serial && (
        <Field label="Serial Number"><Input className="h-9" value={draft.serial} onChange={(e) => set({ serial: e.target.value })} placeholder="Search serial no." onKeyDown={(e) => e.key === "Enter" && onApply()} /></Field>
      )}

      <div className="rounded-md border">
        <button onClick={() => setAdv(!adv)} className="flex w-full items-center justify-between px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary/50">
          More filters <ChevronDown className={`h-3.5 w-3.5 transition-transform ${adv ? "rotate-180" : ""}`} />
        </button>
        {adv && (
          <div className="space-y-3 border-t p-2.5">
            {ADV.filter((r) => ds.mapping[r]).map((r) => (
              <MultiSelect key={r} label={ADV_LABELS[r]!} options={opts(r)} selected={draft.multi[r] || []} onChange={(v) => set({ multi: { ...draft.multi, [r]: v } })} />
            ))}
          </div>
        )}
      </div>

      {ds.missing.length > 0 && (
        <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
          Not in sheet (filter hidden): {ds.missing.map((m) => ROLE_LABELS[m]).join(", ")}
        </p>
      )}
      <div className="sticky bottom-0 space-y-2 bg-sidebar pt-2">
        <Button className="w-full" onClick={onApply} disabled={!dirty}>Apply Filters</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>Reset</Button>
          <Button variant="outline" size="sm" onClick={onClear}>Clear All</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><div className="text-xs font-medium text-muted-foreground">{label}</div>{children}</div>;
}
