import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export function ChartCard({ title, subtitle, actions, children, className = "" }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border bg-card p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function MissingNote({ what }: { what: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <AlertTriangle className="h-5 w-5 text-warning" />
      {what}
    </div>
  );
}

export const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
export const STATUS_GROUP_COLORS: Record<string, string> = { Open: "var(--chart-1)", Closed: "var(--chart-2)", "Pending / Other": "var(--chart-4)" };
