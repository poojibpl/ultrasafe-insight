import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  options: { name: string; value: number }[];
  selected: string[];
  onChange: (v: string[]) => void;
}

export function MultiSelect({ label, options, selected, onChange }: Props) {
  const [q, setQ] = useState("");
  const set = new Set(selected);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? options.filter((o) => o.name.toLowerCase().includes(s)) : options).slice(0, 300);
  }, [q, options]);
  const toggle = (n: string) => onChange(set.has(n) ? selected.filter((x) => x !== n) : [...selected, n]);

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm hover:border-primary/50">
            <span className={cn("truncate", !selected.length && "text-muted-foreground")}>
              {selected.length === 0 ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <Input placeholder={`Search ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} className="mb-2 h-8" />
          <div className="max-h-64 overflow-y-auto">
            {shown.map((o) => (
              <button key={o.name} onClick={() => toggle(o.name)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-secondary">
                <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", set.has(o.name) ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                  {set.has(o.name) && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate">{o.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{o.value}</span>
              </button>
            ))}
            {!shown.length && <div className="px-2 py-4 text-center text-sm text-muted-foreground">No matches</div>}
            {options.length > 300 && shown.length === 300 && <div className="px-2 py-1 text-xs text-muted-foreground">Showing first 300 — type to search</div>}
          </div>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
              <X className="h-3 w-3" /> Clear selection
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
