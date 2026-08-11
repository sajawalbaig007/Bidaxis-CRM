export type PaymentChannel = "AH" | "SN" | "CHQ" | "HM";
export type PaymentCurrency = "USD" | "CAD" | "PKR";

export const PAYMENT_CHANNEL_OPTIONS: { value: PaymentChannel; label: string }[] = [
  { value: "AH", label: "Ahmed Hamza" },
  { value: "SN", label: "Sharjeel Nasir" },
  { value: "CHQ", label: "Cheque" },
  { value: "HM", label: "Habib Metro" },
];

export const PAYMENT_CURRENCY_OPTIONS: PaymentCurrency[] = ["USD", "CAD", "PKR"];

export type ProjectPayment = {
  id: string;
  type: string;
  amount: string;
  link?: string;
  isPaid: boolean;
  paidAt?: string;
  /** Accounts currency channel — Admin/Manager when payment arrives */
  paymentChannel?: PaymentChannel;
  /** USD / CAD / PKR — shown on Accounts currency section */
  currency?: PaymentCurrency;
  /** YYYY-MM — Accounts month this payment counts in */
  accountsMonth?: string;
};

export const PROJECT_PHASE_OPTIONS = [
  { value: "not_started",       label: "Not Started" },
  { value: "takeoff_started",   label: "Takeoff Started" },
  { value: "takeoff_completed", label: "Takeoff Completed" },
  { value: "pricing_phase",     label: "Pricing Phase" },
  { value: "qa_phase",          label: "QA Phase" },
  { value: "delivery_phase",    label: "Delivery Phase" },
] as const;

export const PAYMENT_TYPE_OPTIONS = [
  "Advance",
  "Partial",
  "Milestone",
  "Final",
  "Retainer",
  "Other",
] as const;

function normalizePaymentChannel(raw: unknown): PaymentChannel | undefined {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "AH" || v === "SN" || v === "CHQ" || v === "HM") return v;
  return undefined;
}

function normalizePaymentCurrency(raw: unknown): PaymentCurrency | undefined {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "USD" || v === "CAD" || v === "PKR") return v;
  return undefined;
}

function normalizeAccountsMonth(raw: unknown): string | undefined {
  const v = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 7);
  return undefined;
}

function sanitizePayment(raw: Partial<ProjectPayment> & Record<string, unknown>): ProjectPayment {
  const channel = normalizePaymentChannel(raw.paymentChannel);
  const currency = normalizePaymentCurrency(raw.currency);
  const accountsMonth = normalizeAccountsMonth(raw.accountsMonth);
  const entry: ProjectPayment = {
    id: String(raw.id ?? ""),
    type: String(raw.type ?? "Partial"),
    amount: String(raw.amount ?? ""),
    isPaid: Boolean(raw.isPaid),
  };
  if (typeof raw.link === "string" && raw.link.trim()) entry.link = raw.link.trim();
  if (typeof raw.paidAt === "string" && raw.paidAt.trim()) entry.paidAt = raw.paidAt;
  if (channel) entry.paymentChannel = channel;
  if (currency) entry.currency = currency;
  if (accountsMonth) entry.accountsMonth = accountsMonth;
  return entry;
}

export function parsePayments(raw: unknown): ProjectPayment[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((e) => sanitizePayment((e ?? {}) as Record<string, unknown>));
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((e) => sanitizePayment((e ?? {}) as Record<string, unknown>))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseMoney(raw: string | number | null | undefined): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

/** Strip currency symbols for budget/amount inputs (avoids "$" + "$620" / "$0.00" overlap) */
export function stripBudgetForInput(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/^[\$\s]*(?:Rs\.?|PKR|CAD|C\$)?\s*/i, "")
    .replace(/,/g, "")
    .trim();
}

export function formatQuotedAmount(raw: string | null | undefined): string {
  const n = parseMoney(raw);
  return n > 0 ? `$${n.toLocaleString()}` : "—";
}

export function paidTotal(payments: ProjectPayment[]): number {
  return payments.filter((p) => p.isPaid).reduce((s, p) => s + parseMoney(p.amount), 0);
}

export function latestPaidPayment(payments: ProjectPayment[]): ProjectPayment | null {
  const paid = payments.filter((p) => p.isPaid);
  if (!paid.length) return null;
  const withDate = paid.filter((p) => p.paidAt);
  if (!withDate.length) return paid[paid.length - 1];
  return [...withDate].sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0];
}

export function paymentPercent(payments: ProjectPayment[], budget: string | number | null | undefined): number {
  const budgetNum = parseMoney(budget);
  if (budgetNum <= 0) return 0;
  return Math.min(100, (paidTotal(payments) / budgetNum) * 100);
}

export function phaseLabel(phase: string | null | undefined): string {
  return PROJECT_PHASE_OPTIONS.find((p) => p.value === phase)?.label ?? "Not Started";
}

export function formatPaymentWhen(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function newPaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export type ProjectWorkbenchData = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  ownerName: string;
  state: string;
  projectCode: string;
  projectTitle: string;
  projectScope: string;
  interestedService: string;
  projectBudget: string;
  projectDeadline: string;
  /** Emergency submit: morning | cob | "" */
  deadlineTiming: "" | "morning" | "cob";
  projectPhase: string;
  takeoffDeadline: string;
  pricingDeadline: string;
  qaDeadline: string;
  projectPayments: ProjectPayment[];
  assignedTo?: string;
  projectSource?: string;
  projectNotes?: string;
  csrName?: string;
  csrCode?: string | null;
};

export const CSR_ASSIGN_OTHER = "__other__";

export function emptyWorkbench(): ProjectWorkbenchData {
  return {
    id: "",
    name: "",
    company: "",
    phone: "",
    email: "",
    ownerName: "",
    state: "",
    projectCode: "",
    projectTitle: "",
    projectScope: "",
    interestedService: "",
    projectBudget: "",
    projectDeadline: "",
    deadlineTiming: "",
    projectPhase: "not_started",
    takeoffDeadline: "",
    pricingDeadline: "",
    qaDeadline: "",
    projectPayments: [],
  };
}

/** Same rule as Admin → Active Projects tab. */
export function isProjectActive(p: {
  status?: string | null;
  projectDeadline?: string | null;
  projectWorkStatus?: string | null;
}): boolean {
  const work = (p.projectWorkStatus ?? "").toLowerCase();
  if (work === "completed" || work === "not_completed") return false;
  if (work === "in_progress") return true;

  const st = (p.status ?? "").toLowerCase();
  if (st === "completed") return false;
  if (p.projectDeadline) {
    const deadline = p.projectDeadline.split("T")[0] ?? "";
    const today = new Date().toISOString().split("T")[0] ?? "";
    return deadline >= today;
  }
  return st === "close client";
}

export type ProjectWorkStatus = "completed" | "in_progress" | "not_completed";

export type DeadlineTiming = "" | "morning" | "cob";

export function normalizeDeadlineTiming(raw: unknown): DeadlineTiming {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "morning" || v === "cob") return v;
  return "";
}

export const PROJECT_WORK_STATUS_OPTIONS: { value: ProjectWorkStatus; label: string }[] = [
  { value: "in_progress", label: "In Progress" },
  { value: "not_completed", label: "Not Completed" },
  { value: "completed", label: "Completed" },
];

export function getProjectWorkStatus(p: {
  status?: string | null;
  projectDeadline?: string | null;
  projectWorkStatus?: string | null;
}): { key: ProjectWorkStatus; label: string } {
  const work = (p.projectWorkStatus ?? "").toLowerCase();
  if (work === "completed") return { key: "completed", label: "Completed" };
  if (work === "in_progress") return { key: "in_progress", label: "In Progress" };
  if (work === "not_completed") return { key: "not_completed", label: "Not Completed" };

  const st = (p.status ?? "").toLowerCase();
  if (st === "completed") return { key: "completed", label: "Completed" };
  if (isProjectActive(p)) return { key: "in_progress", label: "In Progress" };
  return { key: "not_completed", label: "Not Completed" };
}
