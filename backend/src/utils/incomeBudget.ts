/**
 * Income Statement → 3-month budget helpers (server).
 * Sales Team + Lead share one line; Technical Team + Manager share one line.
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

export function emptyBudgetActuals(): Record<BudgetLineKey, number> {
  return {
    revenue: 0,
    sales: 0,
    technical: 0,
    email_marketing: 0,
    administration: 0,
    executive: 0,
    opex: 0,
    loans: 0,
    pf: 0,
    other_payroll: 0,
  };
}

/** Map an Income Statement team title → budget bucket. */
export function budgetKeyForTeamTitle(teamTitle: string): BudgetLineKey {
  const t = teamTitle.trim().toLowerCase();
  if (t.includes("email")) return "email_marketing";
  if (t.includes("sales")) return "sales"; // Sales Team + Sales Team Lead
  if (t.includes("technical")) return "technical"; // Technical Team + Technical Manager
  if (t.includes("admin")) return "administration";
  if (t.includes("executive")) return "executive";
  return "other_payroll";
}

function lineTotal(row: {
  amount?: number;
  totalSalary?: number;
  subHeads?: { amount?: number }[];
}): number {
  if (row.subHeads && row.subHeads.length > 0) {
    return row.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  }
  return Number(row.amount ?? row.totalSalary) || 0;
}

export function accumulateIncomeStatementIntoBudget(
  data: Record<string, unknown>,
  into: Record<BudgetLineKey, number>,
  revenue: number,
): void {
  into.revenue += revenue;
  const teams = (data.teamSalaries as {
    team?: string;
    amount?: number;
    totalSalary?: number;
    subHeads?: { amount?: number }[];
  }[]) ?? [];
  for (const team of teams) {
    const key = budgetKeyForTeamTitle(String(team.team ?? ""));
    into[key] += lineTotal(team);
  }
  for (const row of (data.opexHeads as { amount?: number; subHeads?: { amount?: number }[] }[]) ?? []) {
    into.opex += lineTotal(row);
  }
  for (const row of (data.loanHeads as { amount?: number; subHeads?: { amount?: number }[] }[]) ?? []) {
    into.loans += lineTotal(row);
  }
  for (const row of (data.providentFundHeads as { amount?: number; subHeads?: { amount?: number }[] }[]) ?? []) {
    into.pf += lineTotal(row);
  }
}

export function quarterIdFromMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const q = Math.ceil((m || 1) / 3);
  return `${y}-Q${q}`;
}

export function quarterMonths(quarterId: string): { startMonth: string; endMonth: string; months: string[] } {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarterId.trim());
  if (!m) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const q = Math.ceil((now.getUTCMonth() + 1) / 3);
    return quarterMonths(`${y}-Q${q}`);
  }
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
