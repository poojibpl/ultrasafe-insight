# BPL Medical Technologies — Ultrasound Service Calls Dashboard

All numbers come straight from your Excel file. Nothing is invented.

## Run it locally

1. Install **Node.js 20+** (https://nodejs.org) — or Bun (https://bun.sh).
2. Double-click **run.bat** (Windows) or run `./run.sh` (Mac/Linux).
   Or manually: `npm install` then `npm run dev`.
3. Open http://localhost:8080 (the address is printed in the terminal).

## Update the data

- Replace `public/data/tickets.xlsx` with your new Excel file (keep the name `tickets.xlsx`).
- Click **Reload Data** in the dashboard header. Row count, filters, charts and the table all refresh.
- Or click **Open Excel** to load any .xlsx from your computer without copying it (the file is read in your browser and never modified).

## How columns are recognised

Headers are matched by name (case/spacing ignored), e.g. `Ticket ID`, `Customer Name`,
`System Ticket Creation Date`, `Ticket Closed Date`, `Ticket Status`, `Ticket Type`,
`Product Code`, `Product Category`, `Serial No`, `BPL Engineer`, `Branch`, `Zone`, `Warranty`, `City`, `State`.
If one is missing, its filter/chart is hidden and a message names the missing column.
With several sheets, the best-matching sheet is chosen and a worksheet selector appears.

## Rules used

- **Closed** = status starting with "Close"; **Open** = status "Open"; everything else = **Pending / Other**.
- **TAT (days)** = Ticket Closed Date − System Ticket Creation Date, only when both dates exist and closed ≥ created.
- Blank cells and `#` are treated as empty. Duplicate Ticket IDs are kept and flagged.
