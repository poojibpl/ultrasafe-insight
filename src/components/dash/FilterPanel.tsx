import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "./MultiSelect";
import { countBy, ROLE_LABELS, type Dataset, type Filters, type MultiRole } from "@/lib/tickets";

const LABELS: Record<MultiRole, string> = {
  status: "Ticket Status", type: "Ticket Type", category: "Product Category", product: "Product / Model",
  engineer: "BPL Engineer", zone: "Zone", branch: "Branch", customer: "Customer / Hospital", warranty: "Warranty",
};
const ORDER: MultiRole[] = ["status", "type", "category", "product", "engineer", "zone", "branch", "customer", "warranty"];

interface Props {
  ds: Dataset;
  draft: Filters;
  setDraft: (f: Filters) => void;
  dirty: boolean;
  onApply: () => void;
  onReset: () => void;
  onClear: () => void;
}

export function FilterPanel({ ds, draft, setDraft, dirty, onApply, onReset, onClear }: Props) {
  const options = useMemo(() => {
    const o: Partial<Record<MultiRole, { name: string; value: number }[]>> = {};
    for (const r of ORDER) if (ds.mapping[r]) o[r] = countBy(ds.tickets, (t) => t.dims[r] ?? null).sort((a, b) => a.name.localeCompare(b.name));
    return o;
  }, [ds]);
  const set = (p: Partial<Filters>) => setDraft({ ...draft, ...p });

  return (
    <div className="space-y-3">
      {ds.mapping.ticketId && (
        <Field label="Ticket ID"><Input className="h-9" value={draft.ticketId} onChange={(e) => set({ ticketId: e.target.value })} placeholder="Search ticket ID" onKeyDown={(e) => e.key === "Enter" && onApply()} /></Field>
      )}
      {ds.mapping.serial && (
        <Field label="Serial Number"><Input className="h-9" value={draft.serial} onChange={(e) => set({ serial: e.target.value })} placeholder="Search serial no." onKeyDown={(e) => e.key === "Enter" && onApply()} /></Field>
      )}
      {ORDER.filter((r) => options[r]).map((r) => (
        <MultiSelect key={r} label={LABELS[r]} options={options[r]!} selected={draft.multi[r] || []} onChange={(v) => set({ multi: { ...draft.multi, [r]: v } })} />
      ))}
      {ds.mapping.created && (
        <Field label="Ticket Creation Date">
          <div className="grid grid-cols-2 gap-1">
            <Input type="date" className="h-9 px-2 text-xs" value={draft.createdFrom} onChange={(e) => set({ createdFrom: e.target.value })} />
            <Input type="date" className="h-9 px-2 text-xs" value={draft.createdTo} onChange={(e) => set({ createdTo: e.target.value })} />
          </div>
        </Field>
      )}
      {ds.mapping.closed && (
        <Field label="Ticket Closed Date">
          <div className="grid grid-cols-2 gap-1">
            <Input type="date" className="h-9 px-2 text-xs" value={draft.closedFrom} onChange={(e) => set({ closedFrom: e.target.value })} />
            <Input type="date" className="h-9 px-2 text-xs" value={draft.closedTo} onChange={(e) => set({ closedTo: e.target.value })} />
          </div>
        </Field>
      )}
      {ds.missing.length > 0 && (
        <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
          Not in sheet (filter hidden): {ds.missing.map((m) => ROLE_LABELS[m]).join(", ")}
        </p>
      )}
      <div className="sticky bottom-0 space-y-2 bg-sidebar pt-2">
        <Button className="w-full" onClick={onApply} disabled={!dirty}>Apply Filters</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onReset} disabled={!dirty}>Reset</Button>
          <Button variant="outline" size="sm" onClick={onClear}>Clear All</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><div className="text-xs font-medium text-muted-foreground">{label}</div>{children}</div>;
}
