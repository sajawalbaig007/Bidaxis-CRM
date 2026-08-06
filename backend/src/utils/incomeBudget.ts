/**
 * Income Statement → 3-month budget helpers (server).
 * Sales Team + Lead share one line; Technical Team + Manager share one line.
 * OPEX expands to sub-heads. Loans / PF are excluded.
 */

export type CoreBudgetKey =
  | "revenue"
  | "sales"
  | "technical"
  | "email_marketing"
  | "administration"
  | "executive"
  | "other_payroll";

export const CORE_BUDGET_LINE_DEFS: { key: CoreBudgetKey; label: string }[] = [
  { key: "revenue", label: "Total Revenue" },
  { key: "sales", label: "Sales Team (incl. Team Lead)" },
  { key: "technical", label: "Technical Team (incl. Manager)" },
  { key: "email_marketing", label: "Email Marketing" },
  { key: "administration", label: "Administration" },
  { key: "executive", label: "Executive" },
  { key: "other_payroll", label: "Other Team Salaries" },
];

export function emptyCoreActuals(): Record<CoreBudgetKey, number> {
  return {
    revenue: 0,
    sales: 0,
    technical: 0,
    email_marketing: 0,
    administration: 0,
    executive: 0,
    other_payroll: 0,
  };
}

export function budgetKeyForTeamTitle(teamTitle: string): CoreBudgetKey {
  const t = teamTitle.trim().toLowerCase();
  if (t.includes("email")) return "email_marketing";
  if (t.includes("sales")) return "sales";
  if (t.includes("technical")) return "technical";
  if (t.includes("admin")) return "administration";
  if (t.includes("executive")) return "executive";
  return "other_payroll";
}

export function opexSubKey(headLabel: string, subLabel: string): string {
  return `opex::${headLabel.trim()}::${subLabel.trim()}`;
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

export function accumulateCoreBudget(
  data: Record<string, unknown>,
  into: Record<CoreBudgetKey, number>,
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
}

export type OpexSubBucket = {
  key: string;
  headLabel: string;
  subLabel: string;
  label: string;
  amount: number;
};

/** Collect OPEX sub-head amounts (head with no subs → one line for the head). */
export function collectOpexSubAmounts(data: Record<string, unknown>): OpexSubBucket[] {
  const out: OpexSubBucket[] = [];
  const heads = (data.opexHeads as {
    label?: string;
    amount?: number;
    subHeads?: { label?: string; amount?: number }[];
  }[]) ?? [];

  for (const head of heads) {
    const headLabel = String(head.label ?? "").trim() || "OPEX";
    const subs = head.subHeads ?? [];
    if (subs.length === 0) {
      const amt = Number(head.amount) || 0;
      if (amt === 0) continue;
      out.push({
        key: opexSubKey(headLabel, headLabel),
        headLabel,
        subLabel: headLabel,
        label: headLabel,
        amount: amt,
      });
      continue;
    }
    for (const s of subs) {
      const subLabel = String(s.label ?? "").trim() || "—";
      const amt = Number(s.amount) || 0;
      out.push({
        key: opexSubKey(headLabel, subLabel),
        headLabel,
        subLabel,
        label: `${headLabel} · ${subLabel}`,
        amount: amt,
      });
    }
  }
  return out;
}

export function accumulateOpexSubs(
  data: Record<string, unknown>,
  into: Record<string, OpexSubBucket>,
): void {
  for (const row of collectOpexSubAmounts(data)) {
    const prev = into[row.key];
    if (prev) {
      prev.amount += row.amount;
    } else {
      into[row.key] = { ...row };
    }
  }
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
