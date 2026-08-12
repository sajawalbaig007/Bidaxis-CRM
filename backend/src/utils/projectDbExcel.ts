import * as XLSX from "xlsx";
import { type ProjectPaymentEntry } from "./projectPayments";

/** Max payment columns in the Project DB Excel template. */
export const PROJECT_DB_EXCEL_PAYMENT_SLOTS = 5;

const SERVICES = [
  "Estimating",
  "Scheduling",
  "Shop Drawing",
  "Drafting",
  "BIM",
  "IT",
] as const;

const PHASES = [
  "not_started",
  "takeoff_started",
  "takeoff_completed",
  "pricing_phase",
  "qa_phase",
  "delivery_phase",
] as const;

const WORK_STATUSES = ["in_progress", "not_completed", "completed"] as const;
const TIMINGS = ["", "morning", "cob"] as const;
const PAYMENT_TYPES = ["Partial", "Milestone", "Final", "Other"] as const;
const CHANNELS = ["AH", "SN", "CHQ", "HM"] as const;
const CURRENCIES = ["USD", "CAD", "PKR"] as const;

/** Canonical headers — row 1 of Projects sheet. */
export const PROJECT_DB_EXCEL_HEADERS = [
  "name",
  "company",
  "phone",
  "email",
  "ownerName",
  "state",
  "timezone",
  "projectCode",
  "clientCode",
  "projectTitle",
  "projectScope",
  "interestedService",
  "projectBudget",
  "projectDeadline",
  "deadlineTiming",
  "projectPhase",
  "takeoffDeadline",
  "pricingDeadline",
  "qaDeadline",
  "projectNotes",
  "projectWorkStatus",
  "status",
  "csrCode",
  "projectSource",
  "createdAt",
  ...Array.from({ length: PROJECT_DB_EXCEL_PAYMENT_SLOTS }, (_, i) => {
    const n = i + 1;
    return [
      `payment${n}Type`,
      `payment${n}Amount`,
      `payment${n}IsPaid`,
      `payment${n}PaidAt`,
      `payment${n}Channel`,
      `payment${n}Currency`,
      `payment${n}AccountsMonth`,
      `payment${n}Link`,
      `payment${n}CreatedAt`,
    ];
  }).flat(),
] as const;

export type ProjectDbExcelHeader = (typeof PROJECT_DB_EXCEL_HEADERS)[number];

export type ProjectDbExcelRow = {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  ownerName?: string;
  state?: string;
  timezone?: string;
  projectCode?: string;
  clientCode?: string;
  projectTitle: string;
  projectScope?: string;
  interestedService: string;
  projectBudget?: string;
  projectDeadline: string;
  deadlineTiming?: string;
  projectPhase?: string;
  takeoffDeadline?: string;
  pricingDeadline?: string;
  qaDeadline?: string;
  projectNotes?: string;
  projectWorkStatus?: string;
  status?: string;
  csrCode?: string;
  projectSource?: string;
  /** YYYY-MM-DD — optional historical create date */
  createdAt?: string;
  projectPayments?: ProjectPaymentEntry[];
};

export type ProjectDbExcelParseResult = {
  rows: ProjectDbExcelRow[];
  errors: { row: number; message: string }[];
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date → ISO date when it looks like a date serial
    if (v > 20000 && v < 80000) {
      const parsed = XLSX.SSF.parse_date_code(v);
      if (parsed) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, "0");
        const d = String(parsed.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
    return String(v);
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

function normalizeHeader(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "")
    .toLowerCase();
}

/** Map flexible header labels → canonical key. */
const HEADER_ALIASES: Record<string, ProjectDbExcelHeader> = (() => {
  const map: Record<string, ProjectDbExcelHeader> = {};
  for (const h of PROJECT_DB_EXCEL_HEADERS) {
    map[normalizeHeader(h)] = h;
  }
  const extras: [string, ProjectDbExcelHeader][] = [
    ["clientname", "name"],
    ["client", "name"],
    ["fullname", "name"],
    ["companyname", "company"],
    ["owner", "ownerName"],
    ["title", "projectTitle"],
    ["code", "projectCode"],
    ["service", "interestedService"],
    ["division", "interestedService"],
    ["budget", "projectBudget"],
    ["quoted", "projectBudget"],
    ["deadline", "projectDeadline"],
    ["clientdeadline", "projectDeadline"],
    ["phase", "projectPhase"],
    ["notes", "projectNotes"],
    ["bidinstruction", "projectNotes"],
    ["bidnotes", "projectNotes"],
    ["workstatus", "projectWorkStatus"],
    ["csr", "csrCode"],
    ["assignedcsr", "csrCode"],
    ["source", "projectSource"],
    ["external", "projectSource"],
    ["othersource", "projectSource"],
    ["recorddate", "createdAt"],
    ["projectdate", "createdAt"],
    ["dateadded", "createdAt"],
    ["scope", "projectScope"],
  ];
  for (const [alias, key] of extras) {
    if (!map[alias]) map[alias] = key;
  }
  return map;
})();

function parseBool(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y" || v === "paid";
}

function normalizeDeadline(raw: string): string {
  const s = cellStr(raw);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or MM/DD/YYYY — prefer ISO-looking; if 4-digit year at end
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3];
    // If first > 12 → DD/MM/YYYY else assume MM/DD/YYYY (US)
    if (a > 12) {
      return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
    return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function paymentsFromCells(get: (key: string) => string): ProjectPaymentEntry[] {
  const out: ProjectPaymentEntry[] = [];
  for (let i = 1; i <= PROJECT_DB_EXCEL_PAYMENT_SLOTS; i++) {
    const type = get(`payment${i}Type`);
    const amount = get(`payment${i}Amount`);
    if (!type && !amount) continue;
    const paidAt = normalizeDeadline(get(`payment${i}PaidAt`));
    const createdAt = normalizeDeadline(get(`payment${i}CreatedAt`)) || paidAt || undefined;
    const entry: ProjectPaymentEntry = {
      id: `pay_import_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      type: type || "Partial",
      amount: amount || "0",
      isPaid: parseBool(get(`payment${i}IsPaid`)) || !!paidAt,
    };
    if (paidAt) entry.paidAt = paidAt;
    if (createdAt) entry.createdAt = createdAt;
    const channel = get(`payment${i}Channel`).toUpperCase();
    if ((CHANNELS as readonly string[]).includes(channel)) {
      entry.paymentChannel = channel as ProjectPaymentEntry["paymentChannel"];
    }
    const currency = get(`payment${i}Currency`).toUpperCase();
    if ((CURRENCIES as readonly string[]).includes(currency)) {
      entry.currency = currency as ProjectPaymentEntry["currency"];
    }
    const month = get(`payment${i}AccountsMonth`).trim();
    if (/^\d{4}-\d{2}$/.test(month)) entry.accountsMonth = month;
    else if (/^\d{4}-\d{2}-\d{2}/.test(month)) entry.accountsMonth = month.slice(0, 7);
    const link = get(`payment${i}Link`).trim();
    if (link) entry.link = link;
    out.push(entry);
  }
  return out;
}

function exampleRow(): Record<string, string> {
  const row: Record<string, string> = {};
  for (const h of PROJECT_DB_EXCEL_HEADERS) row[h] = "";
  row.name = "John Smith";
  row.company = "ABC Construction";
  row.phone = "+1 555 0100";
  row.email = "john@abc.com";
  row.ownerName = "Jane Owner";
  row.state = "TX";
  row.timezone = "CST";
  row.projectCode = "CSR001-01";
  row.clientCode = "CSR001-01";
  row.projectTitle = "Warehouse Takeoff";
  row.projectScope = "Full takeoff + pricing";
  row.interestedService = "Estimating";
  row.projectBudget = "2500";
  row.projectDeadline = "2024-06-15";
  row.deadlineTiming = "";
  row.projectPhase = "delivery_phase";
  row.takeoffDeadline = "2024-05-01";
  row.pricingDeadline = "2024-05-20";
  row.qaDeadline = "2024-06-01";
  row.projectNotes = "Bid notes / instructions";
  row.projectWorkStatus = "completed";
  row.status = "Close Client";
  row.csrCode = "CSR001";
  row.projectSource = "";
  row.createdAt = "2024-04-01";
  row.payment1Type = "Partial";
  row.payment1Amount = "1000";
  row.payment1IsPaid = "yes";
  row.payment1PaidAt = "2024-04-10";
  row.payment1Channel = "AH";
  row.payment1Currency = "USD";
  row.payment1AccountsMonth = "2024-04";
  row.payment1Link = "";
  row.payment1CreatedAt = "2024-04-10";
  row.payment2Type = "Final";
  row.payment2Amount = "1500";
  row.payment2IsPaid = "yes";
  row.payment2PaidAt = "2024-06-01";
  row.payment2Channel = "SN";
  row.payment2Currency = "USD";
  row.payment2AccountsMonth = "2024-06";
  return row;
}

/** Build .xlsx buffer: Instructions + Projects (headers + 1 example). */
export function buildProjectDbTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  const instructions: string[][] = [
    ["BEM CRM — Project DB Excel Template"],
    [""],
    ["Required columns: name, projectTitle, interestedService, projectDeadline"],
    ["Any past or future projectDeadline / createdAt is allowed (historical imports OK)."],
    [""],
    ["interestedService values:", SERVICES.join(" | ")],
    ["projectPhase values:", PHASES.join(" | ")],
    ["deadlineTiming values:", "empty | morning | cob"],
    ["projectWorkStatus values:", WORK_STATUSES.join(" | ")],
    ["status typical:", "Close Client | completed"],
    ["csrCode:", "Active CSR code (e.g. CSR001). Leave empty to assign to uploading admin."],
    ["projectSource:", "Use when project is from external resource (not a CSR). Leave csrCode empty."],
    ["createdAt:", "Optional YYYY-MM-DD — sets record date for month filters / history."],
    [""],
    ["Payments (up to 5):"],
    ["paymentNType:", PAYMENT_TYPES.join(" | ")],
    ["paymentNAmount:", "Number or currency string"],
    ["paymentNIsPaid:", "yes / no / true / false / 1 / 0"],
    ["paymentNPaidAt / paymentNCreatedAt:", "YYYY-MM-DD"],
    ["paymentNChannel:", CHANNELS.join(" | ")],
    ["paymentNCurrency:", CURRENCIES.join(" | ")],
    ["paymentNAccountsMonth:", "YYYY-MM (Accounts currency month)"],
    ["paymentNLink:", "Optional payment / slip URL"],
    [""],
    ["Fill the Projects sheet. Keep the header row. Delete the example row before upload if not needed."],
    ["Upload via Project DB → Upload Excel."],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(instructions);
  wsInfo["!cols"] = [{ wch: 28 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Instructions");

  const headers = [...PROJECT_DB_EXCEL_HEADERS];
  const example = exampleRow();
  const dataRows = [headers, headers.map((h) => example[h] ?? "")];
  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws["!cols"] = headers.map((h) => ({ wch: Math.min(22, Math.max(12, h.length + 2)) }));
  XLSX.utils.book_append_sheet(wb, ws, "Projects");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function parseProjectDbExcel(buffer: Buffer): ProjectDbExcelParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase() === "projects") ??
    wb.SheetNames.find((n) => n.toLowerCase() !== "instructions") ??
    wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ row: 0, message: "Workbook has no sheets." }] };
  }
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as (string | number | Date | null)[][];

  if (!matrix.length) {
    return { rows: [], errors: [{ row: 0, message: "Projects sheet is empty." }] };
  }

  const headerCells = (matrix[0] ?? []).map((c) => cellStr(c));
  const colIndex = new Map<ProjectDbExcelHeader, number>();
  headerCells.forEach((label, idx) => {
    const key = HEADER_ALIASES[normalizeHeader(label)];
    if (key && !colIndex.has(key)) colIndex.set(key, idx);
  });

  const required: ProjectDbExcelHeader[] = [
    "name",
    "projectTitle",
    "interestedService",
    "projectDeadline",
  ];
  for (const r of required) {
    if (!colIndex.has(r)) {
      return {
        rows: [],
        errors: [{ row: 1, message: `Missing required column: ${r}` }],
      };
    }
  }

  const rows: ProjectDbExcelRow[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const excelRow = r + 1;
    const get = (key: ProjectDbExcelHeader | string): string => {
      const idx = colIndex.get(key as ProjectDbExcelHeader);
      if (idx == null) return "";
      return cellStr(line[idx]);
    };

    const name = get("name");
    const projectTitle = get("projectTitle");
    const interestedService = get("interestedService");
    const projectDeadline = normalizeDeadline(get("projectDeadline"));

    // Skip fully blank rows
    if (!name && !projectTitle && !interestedService && !projectDeadline) continue;

    if (!name || !projectTitle || !interestedService || !projectDeadline) {
      errors.push({
        row: excelRow,
        message: "name, projectTitle, interestedService, projectDeadline are required.",
      });
      continue;
    }

    if (!(SERVICES as readonly string[]).includes(interestedService)) {
      // Allow free-text services that already exist in DB historically
      if (!interestedService.trim()) {
        errors.push({ row: excelRow, message: "interestedService is required." });
        continue;
      }
    }

    let projectPhase = get("projectPhase").trim() || "not_started";
    if (!(PHASES as readonly string[]).includes(projectPhase as (typeof PHASES)[number])) {
      const lower = projectPhase.toLowerCase().replace(/\s+/g, "_");
      projectPhase = (PHASES as readonly string[]).includes(lower) ? lower : "not_started";
    }

    let deadlineTiming = get("deadlineTiming").trim().toLowerCase();
    if (deadlineTiming && !(TIMINGS as readonly string[]).includes(deadlineTiming as (typeof TIMINGS)[number])) {
      deadlineTiming = "";
    }

    let projectWorkStatus = get("projectWorkStatus").trim().toLowerCase();
    if (
      projectWorkStatus &&
      !(WORK_STATUSES as readonly string[]).includes(
        projectWorkStatus as (typeof WORK_STATUSES)[number],
      )
    ) {
      projectWorkStatus = "";
    }

    const payments = paymentsFromCells(get);
    const createdAtRaw = normalizeDeadline(get("createdAt"));

    rows.push({
      name,
      company: get("company") || undefined,
      phone: get("phone") || undefined,
      email: get("email") || undefined,
      ownerName: get("ownerName") || undefined,
      state: get("state") || undefined,
      timezone: get("timezone") || undefined,
      projectCode: get("projectCode") || undefined,
      clientCode: get("clientCode") || undefined,
      projectTitle,
      projectScope: get("projectScope") || undefined,
      interestedService,
      projectBudget: get("projectBudget") || undefined,
      projectDeadline,
      deadlineTiming: deadlineTiming || undefined,
      projectPhase,
      takeoffDeadline: normalizeDeadline(get("takeoffDeadline")) || undefined,
      pricingDeadline: normalizeDeadline(get("pricingDeadline")) || undefined,
      qaDeadline: normalizeDeadline(get("qaDeadline")) || undefined,
      projectNotes: get("projectNotes") || undefined,
      projectWorkStatus: projectWorkStatus || undefined,
      status: get("status") || "Close Client",
      csrCode: get("csrCode") || undefined,
      projectSource: get("projectSource") || undefined,
      createdAt: createdAtRaw || undefined,
      projectPayments: payments.length ? payments : undefined,
    });
  }

  return { rows, errors };
}

/** Convert a parsed row into POST /project body fields. */
export function excelRowToProjectBody(row: ProjectDbExcelRow): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: row.name,
    projectTitle: row.projectTitle,
    interestedService: row.interestedService,
    projectDeadline: row.projectDeadline,
    status: row.status || "Close Client",
  };
  const optional = [
    "company",
    "phone",
    "email",
    "ownerName",
    "state",
    "timezone",
    "projectCode",
    "clientCode",
    "projectScope",
    "projectBudget",
    "deadlineTiming",
    "projectPhase",
    "takeoffDeadline",
    "pricingDeadline",
    "qaDeadline",
    "projectNotes",
    "projectWorkStatus",
    "projectSource",
  ] as const;
  for (const k of optional) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") body[k] = v;
  }
  if (row.projectPayments?.length) {
    body.projectPayments = row.projectPayments;
  }
  return body;
}
