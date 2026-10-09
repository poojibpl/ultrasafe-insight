import * as XLSX from "xlsx";

export type Role =
  | "ticketId" | "customer" | "created" | "closed" | "status" | "type" | "product"
  | "category" | "serial" | "engineer" | "branch" | "zone" | "warranty" | "city" | "state" | "days";

export const ROLE_LABELS: Record<Role, string> = {
  ticketId: "Ticket ID", customer: "Customer / Hospital", created: "System Ticket Creation Date",
  closed: "Ticket Closed Date", status: "Ticket Status", type: "Ticket Type", product: "Product / Model",
  category: "Product Category", serial: "Serial Number", engineer: "BPL Engineer", branch: "Branch",
  zone: "Zone", warranty: "Warranty", city: "City", state: "State", days: "No of Days",
};

// Header aliases (normalized: lowercase, alphanumerics only). First match wins.
const ALIASES: Record<Role, string[]> = {
  ticketId: ["ticketid", "ticketno", "ticketnumber", "ticket"],
  customer: ["customername", "customer", "hospitalname", "hospital", "accountname"],
  created: ["systemticketcreationdate", "ticketcreationdate", "creationdate", "createddate", "createdon"],
  closed: ["ticketcloseddate", "closeddate", "closuredate", "closedon", "closedate"],
  status: ["ticketstatus", "status"],
  type: ["tickettype", "calltype", "type"],
  product: ["productcode", "productmodel", "model", "productname", "product"],
  category: ["productcategory", "category"],
  serial: ["serialno", "serialnumber", "serial", "srno"],
  engineer: ["bplengineer", "engineername", "engineer", "assignedto"],
  branch: ["branch", "branchname"],
  zone: ["zone", "region"],
  warranty: ["warranty", "warrantystatus"],
  city: ["city"],
  state: ["state"],
  days: ["noofdays", "noofday", "numberofdays", "ageingdays", "agingdays", "ageing", "aging", "days"],
};

export type Cell = string | number | Date | null;
export interface Ticket {
  _idx: number;
  raw: Record<string, Cell>;
  id: string | null;
  created: Date | null;
  closed: Date | null;
  tat: number | null;
  /** Aging in days: "No of Days" column if present, else computed (open: today − created, closed: TAT). */
  age: number | null;
  statusGroup: "Open" | "Closed" | "Pending / Other";
  dims: Partial<Record<Role, string | null>>;
}
export interface Dataset {
  fileName: string;
  sheetNames: string[];
  sheet: string;
  columns: string[];
  dateColumns: string[];
  mapping: Partial<Record<Role, string>>;
  missing: Role[];
  tickets: Ticket[];
  duplicateIds: number;
  loadedAt: Date;
}

/** Null-safe header/value normalisation for matching (never throws). */
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Display-safe header: trims, collapses spaces and line breaks. */
export const cleanHeader = (s: unknown) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

export class ExcelReadError extends Error {
  constructor(message: string, public detectedHeaders: string[] = [], public missingColumns: string[] = []) { super(message); }
}

export function mapColumns(cols: unknown[]) {
  const list = cols.map((c) => cleanHeader(c)).filter(Boolean);
  const mapping: Partial<Record<Role, string>> = {};
  const used = new Set<string>();
  (Object.keys(ALIASES) as Role[]).forEach((role) => {
    for (const a of ALIASES[role]) {
      const hit = list.find((c) => !used.has(c) && norm(c) === a);
      if (hit) { mapping[role] = hit; used.add(hit); break; }
    }
  });
  return mapping;
}

function serialToDate(n: number): Date | null {
  const p = XLSX.SSF.parse_date_code(n);
  if (!p || !p.y) return null;
  return new Date(p.y, p.m - 1, p.d, p.H || 0, p.M || 0, Math.floor(p.S || 0));
}
function parseDateLike(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") return v > 20000 && v < 80000 ? serialToDate(v) : null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) { const d = new Date(+m[3]!, +m[2]! - 1, +m[1]!); return isNaN(d.getTime()) ? null : d; }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s.slice(0, 10) + "T00:00:00"); return isNaN(d.getTime()) ? null : d; }
  return null;
}
const isBlank = (v: unknown) => v == null || (typeof v === "string" && (v.trim() === "" || v.trim() === "#"));
export const cleanStr = (v: unknown): string | null => {
  if (isBlank(v)) return null;
  if (v instanceof Date) return fmtDate(v);
  return String(v ?? "").replace(/\u00a0/g, " ").replace(/Â/g, "").trim() || null;
};

export function classifyStatus(s: string | null): Ticket["statusGroup"] {
  const n = String(s ?? "").toLowerCase().trim();
  if (/^clos/.test(n)) return "Closed";
  if (n === "open") return "Open";
  return "Pending / Other";
}

const toRow = (r: unknown): unknown[] => (Array.isArray(r) ? Array.from(r, (c) => (c === undefined ? null : c)) : []);

/** Finds the header row (within the first 15 rows) that maps the most known columns. */
function findHeader(aoa: unknown[][]) {
  let best = { idx: 0, score: -1 };
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const score = Object.keys(mapColumns(toRow(aoa[i]))).length;
    if (score > best.score) best = { idx: i, score };
  }
  return best;
}

export function parseWorkbook(buf: ArrayBuffer, fileName: string, preferredSheet?: string): Dataset {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: false });
  } catch {
    throw new ExcelReadError("Could not read the Excel file. Please check that it is a valid .xlsx/.xls/.csv file.");
  }
  const sheetNames = wb.SheetNames ?? [];
  if (!sheetNames.length) throw new ExcelReadError("The Excel file contains no worksheets.");
  const sheetAoa = (n: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, { header: 1, defval: null, raw: true, blankrows: false }).map(toRow);
  let sheet = preferredSheet && sheetNames.includes(preferredSheet) ? preferredSheet : "";
  if (!sheet) {
    let best = -1;
    for (const n of sheetNames) {
      const sc = findHeader(sheetAoa(n)).score;
      if (sc > best) { best = sc; sheet = n; }
    }
  }
  const aoa = sheetAoa(sheet);
  const { idx: headerIdx } = findHeader(aoa);
  const headerRow = toRow(aoa[headerIdx]);
  // Unique, non-blank column names (original text kept; blanks/duplicates get a suffix).
  const columns: string[] = [];
  const colIndex: number[] = [];
  const counts = new Map<string, number>();
  headerRow.forEach((h, i) => {
    let name = cleanHeader(h);
    const hasData = aoa.slice(headerIdx + 1).some((r) => !isBlank(r[i]));
    if (!name) { if (!hasData) return; name = `Column ${i + 1}`; }
    const c = (counts.get(name) || 0) + 1; counts.set(name, c);
    columns.push(c > 1 ? `${name} (${c})` : name);
    colIndex.push(i);
  });
  const rows: Record<string, unknown>[] = aoa.slice(headerIdx + 1).map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c, k) => { o[c] = r[colIndex[k]!] ?? null; });
    return o;
  });
  const dateColumns = columns.filter((c) => /date/i.test(c));
  const mapping = mapColumns(columns);
  const missing = (Object.keys(ALIASES) as Role[]).filter((r) => !mapping[r] && r !== "days");
  const required: Role[] = ["ticketId", "status"];
  const reqMissing = required.filter((r) => !mapping[r]);
  if (reqMissing.length) {
    throw new ExcelReadError(
      `Required column(s) not found in sheet “${sheet}”: ${reqMissing.map((r) => ROLE_LABELS[r]).join(", ")}.`,
      columns, reqMissing.map((r) => ROLE_LABELS[r]),
    );
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const seen = new Map<string, number>();
  let duplicateIds = 0;
  const tickets: Ticket[] = [];
  rows.forEach((r, i) => {
    if (Object.values(r).every(isBlank)) return;
    const raw: Record<string, Cell> = {};
    for (const c of columns) {
      const v = r[c] ?? null;
      if (isBlank(v)) raw[c] = null;
      else if (dateColumns.includes(c)) raw[c] = parseDateLike(v) ?? cleanStr(v);
      else raw[c] = typeof v === "number" ? v : cleanStr(v);
    }
    const get = (role: Role) => (mapping[role] ? raw[mapping[role]!] : null);
    const created = mapping.created ? (get("created") instanceof Date ? (get("created") as Date) : null) : null;
    const closed = mapping.closed ? (get("closed") instanceof Date ? (get("closed") as Date) : null) : null;
    let tat: number | null = null;
    if (created && closed) {
      const d = Math.round((closed.getTime() - created.getTime()) / 86400000);
      if (d >= 0) tat = d;
    }
    const statusGroup = classifyStatus(mapping.status ? cleanStr(get("status")) : null);
    let age: number | null = null;
    if (mapping.days) {
      const v = get("days");
      const n = typeof v === "number" ? v : v != null && !(v instanceof Date) ? parseFloat(String(v)) : NaN;
      age = Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    } else if (statusGroup === "Closed") age = tat;
    else if (created) { const d = Math.floor((today.getTime() - created.getTime()) / 86400000); age = d >= 0 ? d : null; }
    const dims: Ticket["dims"] = {};
    (Object.keys(ALIASES) as Role[]).forEach((role) => {
      if (role !== "created" && role !== "closed" && role !== "days") dims[role] = mapping[role] ? cleanStr(get(role)) : null;
    });
    const id = dims.ticketId ?? null;
    if (id) { const c = seen.get(id) || 0; if (c >= 1) duplicateIds++; seen.set(id, c + 1); }
    tickets.push({ _idx: i, raw, id, created, closed, tat, age, statusGroup, dims });
  });
  if (!tickets.length) throw new ExcelReadError(`Sheet “${sheet}” has headers but no ticket rows.`, columns);
  return { fileName, sheetNames, sheet, columns, dateColumns, mapping, missing, tickets, duplicateIds, loadedAt: new Date() };
}

// ---------- Filters ----------
export const MULTI_ROLES = ["status", "type", "category", "product", "engineer", "zone", "branch", "customer", "warranty"] as const;
export type MultiRole = (typeof MULTI_ROLES)[number];
export interface Filters {
  ticketId: string;
  serial: string;
  multi: Partial<Record<MultiRole, string[]>>;
  statusGroup: string[];
  createdFrom: string; createdTo: string;
  closedFrom: string; closedTo: string;
  kpi: KpiKey | null;
  ageBucket: string | null;
}
export type KpiKey = "total" | "open" | "closed" | "pending" | "tat" | "period";
export const KPI_LABELS: Record<KpiKey, string> = {
  total: "All Tickets", open: "Open Tickets", closed: "Closed Tickets", pending: "Pending / Other Tickets",
  tat: "Tickets used for TAT", period: "Created in Period",
};
export const AGE_BUCKETS: { name: string; lo: number; hi: number; level: 1 | 2 | 3 | 4 | 5 }[] = [
  { name: "0–4 Days", lo: 0, hi: 4, level: 1 }, { name: "5–10 Days", lo: 5, hi: 10, level: 2 },
  { name: "11–15 Days", lo: 11, hi: 15, level: 3 }, { name: "16–30 Days", lo: 16, hi: 30, level: 4 },
  { name: "31–60 Days", lo: 31, hi: 60, level: 5 }, { name: "60+ Days", lo: 61, hi: Infinity, level: 5 },
];
export const ageBucketOf = (n: number | null) => (n == null ? null : AGE_BUCKETS.find((b) => n >= b.lo && n <= b.hi) ?? null);
export const ageLevel = (n: number | null) => ageBucketOf(n)?.level ?? 0;
/** Reference window for the "Created in Period" KPI: the date filter, else the last 30 days of data. */
export function periodRange(rows: Ticket[], f: Filters): { from: number | null; to: number | null; label: string } {
  if (f.createdFrom || f.createdTo) {
    return { from: dayStart(f.createdFrom), to: dayEnd(f.createdTo), label: `${f.createdFrom ? fmtDate(new Date(f.createdFrom + "T00:00")) : "start"} → ${f.createdTo ? fmtDate(new Date(f.createdTo + "T00:00")) : "latest"}` };
  }
  let max = -Infinity;
  for (const t of rows) if (t.created && t.created.getTime() > max) max = t.created.getTime();
  if (max === -Infinity) return { from: null, to: null, label: "No creation dates" };
  return { from: max - 29 * 86400000, to: max + 86399999, label: `Last 30 days of data (to ${fmtDate(new Date(max))})` };
}
export function kpiMatch(t: Ticket, k: KpiKey, period?: { from: number | null; to: number | null }) {
  switch (k) {
    case "total": return true;
    case "open": return t.statusGroup === "Open";
    case "closed": return t.statusGroup === "Closed";
    case "pending": return t.statusGroup === "Pending / Other";
    case "tat": return t.tat != null;
    case "period": {
      if (!t.created || !period || (period.from == null && period.to == null)) return false;
      const v = t.created.getTime();
      return (period.from == null || v >= period.from) && (period.to == null || v <= period.to);
    }
  }
}
export const EMPTY_FILTERS: Filters = { ticketId: "", serial: "", multi: {}, statusGroup: [], createdFrom: "", createdTo: "", closedFrom: "", closedTo: "", kpi: null, ageBucket: null };
export const BLANK = "(Blank)";

const dayStart = (s: string) => (s ? new Date(s + "T00:00:00").getTime() : null);
const dayEnd = (s: string) => (s ? new Date(s + "T23:59:59").getTime() : null);

/** Base filters (sidebar + chart drills), then the KPI/aging selection on top. */
export function applyFilters(ts: Ticket[], f: Filters): Ticket[] {
  const base = applyBase(ts, f);
  let r = base;
  if (f.kpi) { const p = f.kpi === "period" ? periodRange(base, f) : undefined; r = r.filter((t) => kpiMatch(t, f.kpi!, p)); }
  if (f.ageBucket) {
    const b = AGE_BUCKETS.find((x) => x.name === f.ageBucket);
    if (b) r = r.filter((t) => t.statusGroup !== "Closed" && t.age != null && t.age >= b.lo && t.age <= b.hi);
  }
  return r;
}
export function applyBase(ts: Ticket[], f: Filters): Ticket[] {
  const idQ = String(f.ticketId ?? "").trim().toLowerCase();
  const snQ = String(f.serial ?? "").trim().toLowerCase();
  const cf = dayStart(f.createdFrom), ct = dayEnd(f.createdTo), xf = dayStart(f.closedFrom), xt = dayEnd(f.closedTo);
  const multis = Object.entries(f.multi).filter(([, v]) => v && v.length) as [MultiRole, string[]][];
  const sets = multis.map(([k, v]) => [k, new Set(v)] as const);
  const sg = new Set(f.statusGroup);
  return ts.filter((t) => {
    if (idQ && !(t.id || "").toLowerCase().includes(idQ)) return false;
    if (snQ && !(t.dims.serial || "").toLowerCase().includes(snQ)) return false;
    if (sg.size && !sg.has(t.statusGroup)) return false;
    for (const [k, s] of sets) if (!s.has(t.dims[k] ?? BLANK)) return false;
    if (cf != null || ct != null) {
      if (!t.created) return false;
      const v = t.created.getTime();
      if (cf != null && v < cf) return false;
      if (ct != null && v > ct) return false;
    }
    if (xf != null || xt != null) {
      if (!t.closed) return false;
      const v = t.closed.getTime();
      if (xf != null && v < xf) return false;
      if (xt != null && v > xt) return false;
    }
    return true;
  });
}

export function countBy(ts: Ticket[], fn: (t: Ticket) => string | null) {
  const m = new Map<string, number>();
  for (const t of ts) { const k = fn(t) ?? BLANK; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export function monthLabel(k: string) {
  const y = Number(k.slice(0, 4)), m = Number(k.slice(5, 7));
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}
export function monthly(ts: Ticket[], pick: (t: Ticket) => Date | null) {
  const m = new Map<string, number>();
  for (const t of ts) { const d = pick(t); if (d) m.set(monthKey(d), (m.get(monthKey(d)) || 0) + 1); }
  const keys = [...m.keys()].sort();
  if (!keys.length) return [];
  const out: { key: string; label: string; value: number }[] = [];
  let y = Number(keys[0]!.slice(0, 4)), mo = Number(keys[0]!.slice(5, 7));
  const last = keys[keys.length - 1];
  for (let guard = 0; guard < 600; guard++) {
    const k = `${y}-${String(mo).padStart(2, "0")}`;
    out.push({ key: k, label: monthLabel(k), value: m.get(k) || 0 });
    if (k === last) break;
    mo++; if (mo > 12) { mo = 1; y++; }
  }
  return out;
}
export const TAT_BUCKETS: [string, number, number][] = [
  ["Same day", 0, 0], ["1 day", 1, 1], ["2–3 days", 2, 3], ["4–7 days", 4, 7],
  ["8–15 days", 8, 15], ["16–30 days", 16, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["> 90 days", 91, Infinity],
];

export function fmtDate(d: Date | null) {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}
export function fmtCell(v: Cell): string {
  if (v == null) return "";
  if (v instanceof Date) return fmtDate(v);
  return String(v);
}
export const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Keeps only filter selections whose values exist in the (new) active dataset. */
export function pruneFilters(f: Filters, ds: Dataset): Filters {
  const multi: Filters["multi"] = {};
  for (const [k, v] of Object.entries(f.multi) as [MultiRole, string[] | undefined][]) {
    if (!v?.length || !ds.mapping[k]) continue;
    const have = new Set(ds.tickets.map((t) => t.dims[k] ?? BLANK));
    const kept = v.filter((x) => have.has(x));
    if (kept.length) multi[k] = kept;
  }
  return {
    ...f, multi,
    ticketId: ds.mapping.ticketId ? f.ticketId : "", serial: ds.mapping.serial ? f.serial : "",
    createdFrom: ds.mapping.created ? f.createdFrom : "", createdTo: ds.mapping.created ? f.createdTo : "",
    closedFrom: ds.mapping.closed ? f.closedFrom : "", closedTo: ds.mapping.closed ? f.closedTo : "",
  };
}

/** Per-group operational summary (engineer / zone / branch / product). */
export function groupStats(ts: Ticket[], role: Role) {
  const m = new Map<string, { total: number; open: number; closed: number; other: number; tatS: number; tatN: number; ageS: number; ageN: number; types: Map<string, number> }>();
  for (const t of ts) {
    const k = t.dims[role] ?? BLANK;
    let g = m.get(k);
    if (!g) { g = { total: 0, open: 0, closed: 0, other: 0, tatS: 0, tatN: 0, ageS: 0, ageN: 0, types: new Map() }; m.set(k, g); }
    g.total++;
    if (t.statusGroup === "Open") g.open++; else if (t.statusGroup === "Closed") g.closed++; else g.other++;
    if (t.tat != null) { g.tatS += t.tat; g.tatN++; }
    if (t.statusGroup !== "Closed" && t.age != null) { g.ageS += t.age; g.ageN++; }
    const ty = t.dims.type ?? BLANK; g.types.set(ty, (g.types.get(ty) || 0) + 1);
  }
  return [...m.entries()].map(([name, g]) => {
    const top = [...g.types.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      name, total: g.total, open: g.open, closed: g.closed, other: g.other,
      avgTat: g.tatN ? g.tatS / g.tatN : null, avgAge: g.ageN ? g.ageS / g.ageN : null,
      topType: top ? `${top[0]} (${top[1]})` : "",
    };
  }).sort((a, b) => b.total - a.total);
}
