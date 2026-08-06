/**
 * Income Statement 3-month budget — Sales+Lead / Technical+Manager combined.
 */

export type BudgetLineKey =
  | "revenue"
  | "sales"
  | "technical"
  | "email_marketing"
  | "administration"
  | "executive"
  | "opex"
  | "loans"
  | "pf"
  | "other_payroll";

export type BudgetLine = {
  key: BudgetLineKey;
  label: string;
  budget: number;
};

export type BudgetQuarter = {
  id: string;
  startMonth: string;
  endMonth: string;
  lines: BudgetLine[];
  notes?: string;
  updatedAt?: string;
};

export type IncomeBudgetData = {
  quarters: BudgetQuarter[];
};

/** Singleton AccountsRecord date for the budget document. */
export const INCOME_BUDGET_STORE_DATE = "2000-01-01";

export const BUDGET_LINE_DEFS: { key: BudgetLineKey; label: string }[] = [
  { key: "revenue", label: "Total Revenue" },
  { key: "sales", label: "Sales Team (incl. Team Lead)" },
  { key: "technical", label: "Technical Team (incl. Manager)" },
  { key: "email_marketing", label: "Email Marketing" },
  { key: "administration", label: "Administration" },
  { key: "executive", label: "Executive" },
  { key: "opex", label: "Operating Expenses" },
  { key: "loans", label: "Loans" },
  { key: "pf", label: "Provident Fund" },
  { key: "other_payroll", label: "Other Team Salaries" },
];

export function emptyBudgetLines(budgets?: Partial<Record<BudgetLineKey, number>>): BudgetLine[] {
  return BUDGET_LINE_DEFS.map(d => ({
    key: d.key,
    label: d.label,
    budget: Math.max(0, Number(budgets?.[d.key]) || 0),
  }));
}

export function quarterIdFromMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const q = Math.ceil((m || 1) / 3);
  return `${y}-Q${q}`;
}

export function currentQuarterId(isoDate = new Date().toISOString().slice(0, 10)): string {
  return quarterIdFromMonth(isoDate.slice(0, 7));
}

export function quarterMonths(quarterId: string): { startMonth: string; endMonth: string; months: string[] } {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarterId.trim());
  if (!m) return quarterMonths(currentQuarterId());
  const y = Number(m[1]);
  const q = Number(m[2]);
  const startM = (q - 1) * 3 + 1;
  const months = [0, 1, 2].map(i => `${y}-${String(startM + i).padStart(2, "0")}`);
  return { startMonth: months[0]!, endMonth: months[2]!, months };
}

export function nextQuarterId(quarterId: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarterId.trim());
  if (!m) return quarterId;
  let y = Number(m[1]);
  let q = Number(m[2]) + 1;
  if (q > 4) {
    q = 1;
    y += 1;
  }
  return `${y}-Q${q}`;
}

export function prevQuarterId(quarterId: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarterId.trim());
  if (!m) return quarterId;
  let y = Number(m[1]);
  let q = Number(m[2]) - 1;
  if (q < 1) {
    q = 4;
    y -= 1;
  }
  return `${y}-Q${q}`;
}

export function quarterLabel(quarterId: string): string {
  const { startMonth, endMonth } = quarterMonths(quarterId);
  const fmt = (ym: string) => {
    const [y, mm] = ym.split("-").map(Number);
    return new Date(Date.UTC(y!, (mm || 1) - 1, 1)).toLocaleString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `${fmt(startMonth)} – ${fmt(endMonth)}`;
}

export function ensureQuarter(
  data: IncomeBudgetData | null | undefined,
  quarterId: string,
): BudgetQuarter {
  const existing = (data?.quarters ?? []).find(q => q.id === quarterId);
  if (existing) {
    const byKey = new Map(existing.lines.map(l => [l.key, l.budget]));
    const { startMonth, endMonth } = quarterMonths(quarterId);
    return {
      ...existing,
      startMonth,
      endMonth,
      lines: emptyBudgetLines(Object.fromEntries(byKey) as Partial<Record<BudgetLineKey, number>>),
    };
  }
  const { startMonth, endMonth } = quarterMonths(quarterId);
  return {
    id: quarterId,
    startMonth,
    endMonth,
    lines: emptyBudgetLines(),
    notes: "",
  };
}

export function upsertQuarter(data: IncomeBudgetData, quarter: BudgetQuarter): IncomeBudgetData {
  const rest = (data.quarters ?? []).filter(q => q.id !== quarter.id);
  return {
    quarters: [...rest, { ...quarter, updatedAt: new Date().toISOString() }].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
}

export type BudgetPredictionRow = {
  key: BudgetLineKey;
  label: string;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number | null;
  /** Suggested budget for the next 3 months */
  predictedBudget: number;
};

/**
 * Next-quarter prediction per line:
 * - If actuals exist: blend toward actuals (70% actual + 30% budget) so under/over-spend informs next budget
 * - Else: carry current budget
 * - Optional growthPct applied on top (e.g. +5%)
 */
export function predictNextQuarterBudget(
  lines: BudgetLine[],
  actuals: Partial<Record<BudgetLineKey, number>>,
  growthPct = 0,
): BudgetPredictionRow[] {
  const growth = 1 + (Number(growthPct) || 0) / 100;
  return lines.map(line => {
    const budget = Math.max(0, Number(line.budget) || 0);
    const actual = Math.max(0, Number(actuals[line.key]) || 0);
    const variance = actual - budget;
    const variancePct = budget > 0 ? (variance / budget) * 100 : actual > 0 ? 100 : null;
    let predicted: number;
    if (actual > 0 && budget > 0) {
      predicted = actual * 0.7 + budget * 0.3;
    } else if (actual > 0) {
      predicted = actual;
    } else {
      predicted = budget;
    }
    predicted = Math.round(predicted * growth);
    return {
      key: line.key,
      label: line.label,
      budget,
      actual,
      variance,
      variancePct,
      predictedBudget: predicted,
    };
  });
}

export function sumBudgetLines(
  lines: { key: BudgetLineKey; budget?: number; actual?: number; predictedBudget?: number }[],
  field: "budget" | "actual" | "predictedBudget",
): number {
  const payrollKeys = new Set<BudgetLineKey>([
    "sales",
    "technical",
    "email_marketing",
    "administration",
    "executive",
    "other_payroll",
  ]);
  return lines
    .filter(l => payrollKeys.has(l.key) || l.key === "opex" || l.key === "revenue" || l.key === "loans" || l.key === "pf")
    .reduce((a, l) => a + (Number(l[field]) || 0), 0);
}

export function payrollTotal(
  rows: { key: BudgetLineKey; budget?: number; actual?: number; predictedBudget?: number }[],
  field: "budget" | "actual" | "predictedBudget",
): number {
  const keys = new Set<BudgetLineKey>([
    "sales",
    "technical",
    "email_marketing",
    "administration",
    "executive",
    "other_payroll",
  ]);
  return rows.filter(r => keys.has(r.key)).reduce((a, r) => a + (Number(r[field]) || 0), 0);
}
