import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { fmtCell, type Dataset, type Ticket } from "@/lib/tickets";
import { StatusBadge } from "./TicketTable";

export function TicketDetail({ ds, ticket, onClose }: { ds: Dataset; ticket: Ticket | null; onClose: () => void }) {
  const dupes = ticket?.id ? ds.tickets.filter((t) => t.id === ticket.id).length : 0;
  return (
    <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {ticket && (
          <>
            <SheetHeader>
              <SheetTitle>Ticket {ticket.id ?? "(no ID)"}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {ticket.dims.status && <StatusBadge group={ticket.statusGroup} text={ticket.dims.status} />}
                {ticket.tat != null && <span className="text-xs">TAT: <b>{ticket.tat} days</b></span>}
                <span className="text-xs">Excel row {ticket._idx + 2}</span>
                {dupes > 1 && <span className="rounded bg-warning/20 px-2 py-0.5 text-xs">This Ticket ID appears {dupes} times</span>}
              </SheetDescription>
            </SheetHeader>
            <dl className="mt-4 divide-y rounded-md border px-4">
              {ds.columns.map((c) => {
                const v = fmtCell(ticket.raw[c] ?? null);
                return (
                  <div key={c} className="grid grid-cols-5 gap-3 py-2 text-sm">
                    <dt className="col-span-2 text-muted-foreground">{c}</dt>
                    <dd className="col-span-3 break-words">{v || <span className="text-muted-foreground">—</span>}</dd>
                  </div>
                );
              })}
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
