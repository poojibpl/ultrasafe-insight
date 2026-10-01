import * as XLSX from "xlsx";

export type Role =
  | "ticketId" | "customer" | "created" | "closed" | "status" | "type" | "product"
  | "category" | "serial" | "engineer" | "branch" | "zone" | "warranty" | "city" | "state";

export const ROLE_LABELS: Record<Role, string> = {
  ticketId: "Ticket ID", customer: "Customer / Hospital", created: "System Ticket Creation Date",
  closed: "Ticket Closed Date", status: "Ticket Status", type: "Ticket Type", product: "Product / Model",
  category: "Product Category", serial: "Serial Number", engineer: "BPL Engineer", branch: "Branch",
  zone: "Zone", warranty: "Warranty", city: "City", state: "State",
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
};

export type Cell = string | number | Date | null;
export interface Ticket {
  _idx: number;
  raw: Record<string, Cell>;
  id: string | null;
  created: Date | null;
  closed: Date | null;
  tat: number | null;
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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapColumns(cols: string[]) {
  const mapping: Partial<Record<Role, string>> = {};
  const used = new Set<string>();
  (Object.keys(ALIASES) as Role[]).forEach((role) => {
    for (const a of ALIASES[role]) {
      const hit = cols.find((c) => !used.has(c) && norm(c) === a);
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
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); return isNaN(d.getTime()) ? null : d; }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s.slice(0, 10) + "T00:00:00"); return isNaN(d.getTime()) ? null : d; }
  return null;
}
const isBlank = (v: unknown) => v == null || (typeof v === "string" && (v.trim() === "" || v.trim() === "#"));
export const cleanStr = (v: unknown): string | null => {
  if (isBlank(v)) return null;
  if (v instanceof Date) return fmtDate(v);
  return String(v).replace(/\u00a0/g, " ").replace(/Â/g, "").trim() || null;
};

export function classifyStatus(s: string | null): Ticket["statusGroup"] {
  const n = (s || "").toLowerCase().trim();
  if (/^clos/.test(n)) return "Closed";
  if (n === "open") return "Open";
  return "Pending / Other";
}

export function parseWorkbook(buf: ArrayBuffer, fileName: string, preferredSheet?: string): Dataset {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetNames = wb.SheetNames;
  // Pick sheet: preferred, else the one whose headers map the most roles.
  let sheet = preferredSheet && sheetNames.includes(preferredSheet) ? preferredSheet : "";
  if (!sheet) {
    let best = -1;
    for (const n of sheetNames) {
      const hdr = (XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, range: 0 })[0] || []).map(String);
      const score = Object.keys(mapColumns(hdr)).length;
      if (score > best) { best = score; sheet = n; }
    }
  }
  const ws = wb.Sheets[sheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
  const columns = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, range: 0 })[0] || [])
    .map((c) => String(c ?? "").trim()).filter(Boolean);
  const dateColumns = columns.filter((c) => /date/i.test(c));
  const mapping = mapColumns(columns);
  const missing = (Object.keys(ALIASES) as Role[]).filter((r) => !mapping[r]);

  const seen = new Map<string, number>();
  let duplicateIds = 0;
  const tickets: Ticket[] = [];
  rows.forEach((r, i) => {
    if (Object.values(r).every(isBlank)) return;
    const raw: Record<string, Cell> = {};
    for (const c of columns) {
      const v = r[c];
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
    const dims: Ticket["dims"] = {};
    (Object.keys(ALIASES) as Role[]).forEach((role) => {
      if (role !== "created" && role !== "closed") dims[role] = mapping[role] ? cleanStr(get(role)) : null;
    });
    const id = dims.ticketId ?? null;
    if (id) { const c = seen.get(id) || 0; if (c >= 1) duplicateIds++; seen.set(id, c + 1); }
    tickets.push({ _idx: i, raw, id, created, closed, tat, statusGroup: classifyStatus(dims.status ?? null), dims });
  });
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
}
export const EMPTY_FILTERS: Filters = { ticketId: "", serial: "", multi: {}, statusGroup: [], createdFrom: "", createdTo: "", closedFrom: "", closedTo: "" };
export const BLANK = "(Blank)";

const dayStart = (s: string) => (s ? new Date(s + "T00:00:00").getTime() : null);
const dayEnd = (s: string) => (s ? new Date(s + "T23:59:59").getTime() : null);

export function applyFilters(ts: Ticket[], f: Filters): Ticket[] {
  const idQ = f.ticketId.trim().toLowerCase();
  const snQ = f.serial.trim().toLowerCase();
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
  const [y, m] = k.split("-");
  return new Date(+y, +m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}
export function monthly(ts: Ticket[], pick: (t: Ticket) => Date | null) {
  const m = new Map<string, number>();
  for (const t of ts) { const d = pick(t); if (d) m.set(monthKey(d), (m.get(monthKey(d)) || 0) + 1); }
  const keys = [...m.keys()].sort();
  if (!keys.length) return [];
  const out: { key: string; label: string; value: number }[] = [];
  let [y, mo] = keys[0].split("-").map(Number);
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
