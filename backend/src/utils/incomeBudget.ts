/**
 * Income Statement → 3-month budget helpers (server).
 * Sales / Technical salaries are split from commission and overtime.
 * OPEX = head totals only (no sub-heads). Loans / PF are excluded.
 */

import {
  calcTlAssignedCommission,
  computeSalesEmployeePayroll,
  type SalesPayrollCalcOpts,
} from "./salesPayrollFormula";
import type { SalesPayrollEmployee } from "./salesPayrollDefaults";

export type CoreBudgetKey =
  | "revenue"
  | "sales"
  | "sales_commission"
  | "technical"
  | "technical_overtime"
  | "email_marketing"
  | "administration"
  | "executive"
  | "other_payroll";

export const CORE_BUDGET_LINE_DEFS: { key: CoreBudgetKey; label: string }[] = [
  { key: "revenue", label: "Total Revenue" },
  { key: "sales", label: "Sales Team (incl. Team Lead)" },
  { key: "sales_commission", label: "Sales Team Commission (incl. Team Lead)" },
  { key: "technical", label: "Technical Team (incl. Manager)" },
  { key: "technical_overtime", label: "Technical Overtime (incl. Manager)" },
  { key: "email_marketing", label: "Email Marketing" },
  { key: "administration", label: "Administration" },
  { key: "executive", label: "Executive" },
  { key: "other_payroll", label: "Other Team Salaries" },
];

export function emptyCoreActuals(): Record<CoreBudgetKey, number> {
  return {
    revenue: 0,
    sales: 0,
    sales_commission: 0,
    technical: 0,
    technical_overtime: 0,
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

/** One budget/actual line per OPEX head (sub-heads rolled up). */
export function opexHeadKey(headLabel: string): string {
  return `opex_head::${headLabel.trim()}`;
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

type TeamSub = {
  id?: string;
  label?: string;
  amount?: number;
  salary?: Record<string, unknown>;
  salesPayroll?: SalesPayrollEmployee;
};

type TeamRow = {
  team?: string;
  amount?: number;
  totalSalary?: number;
  subHeads?: TeamSub[];
};

function salesEmpFromSub(teamTitle: string, sub: TeamSub): SalesPayrollEmployee | null {
  const sp = sub.salesPayroll;
  const role: "sales" | "team_lead" =
    sp?.role === "team_lead" || /lead/i.test(teamTitle) ? "team_lead" : "sales";
  const name = String(sp?.name || sub.label || "").trim();
  if (!sp && !name) return null;
  return {
    id: String(sp?.id || sub.id || name || "sales"),
    name: name || String(sp?.name || ""),
    code: String(sp?.code ?? ""),
    role,
    basic: Number(sp?.basic) || 0,
    allowance: Number(sp?.allowance) || 0,
    homeAllowance: Number(sp?.homeAllowance) || 0,
    fuelAllowance: Number(sp?.fuelAllowance) || 0,
    medicalAllowance: Number(sp?.medicalAllowance) || 0,
    commission: {
      oldClientProjects: Number(sp?.commission?.oldClientProjects) || 0,
      oldClientPartialCount: Number(sp?.commission?.oldClientPartialCount) || 0,
      newClientProjects: Number(sp?.commission?.newClientProjects) || 0,
      fixClientProjects: sp?.commission?.fixClientProjects ?? [],
    },
    assignedToLead: !!sp?.assignedToLead,
    assignedTeamLeadId: sp?.assignedTeamLeadId ?? null,
    checkIn: String(sp?.checkIn || "18:00"),
    lateDeductionOverride: sp?.lateDeductionOverride ?? null,
    paidLeaveDays: Number(sp?.paidLeaveDays) || 0,
    unpaidLeaveDays: Number(sp?.unpaidLeaveDays) || 0,
    loanTotal: Number(sp?.loanTotal) || 0,
    loanPaid: Number(sp?.loanPaid) || 0,
    loanThisMonth: Number(sp?.loanThisMonth) || 0,
    incomeTax: Number(sp?.incomeTax) || 0,
    remarks: String(sp?.remarks ?? ""),
  };
}

function tlExtraForLead(
  lead: SalesPayrollEmployee,
  salesPeers: SalesPayrollEmployee[],
  opts?: SalesPayrollCalcOpts,
): number {
  const leadId = String(lead.id || "").trim();
  return salesPeers
    .filter(p => {
      if (!p.assignedToLead) return false;
      const tid = String(p.assignedTeamLeadId || "").trim();
      if (!tid) return /hammad/i.test(lead.name) || /lead/i.test(lead.role);
      return tid === leadId;
    })
    .reduce((sum, p) => sum + calcTlAssignedCommission(p, opts), 0);
}

/** Weekday 1.5× + weekend 2× · hourly = (Basic + Allowances) ÷ 30 ÷ 8 */
function overtimeFromSalary(sal: Record<string, unknown> | undefined): number {
  if (!sal) return 0;
  const basic = Number(sal.basic) || 0;
  const allowance =
    (Number(sal.allowance) || 0) +
    (Number(sal.homeAllowance) || 0) +
    (Number(sal.fuelAllowance) || 0) +
    (Number(sal.medicalAllowance) || 0) +
    (Number(sal.travelAllowance) || 0);
  const hour = (basic + allowance) / 30 / 8;
  const weekday = Number(sal.weekdayOtHours) || 0;
  const weekend = Number(sal.weekendOtHours) || 0;
  return weekday * hour * 1.5 + weekend * hour * 2;
}

export function accumulateCoreBudget(
  data: Record<string, unknown>,
  into: Record<CoreBudgetKey, number>,
  revenue: number,
  recordDate?: string,
): void {
  into.revenue += revenue;
  const teams = (data.teamSalaries as TeamRow[] | undefined) ?? [];
  const opts: SalesPayrollCalcOpts = { recordDate };

  const salesPeers: SalesPayrollEmployee[] = [];
  for (const team of teams) {
    if (budgetKeyForTeamTitle(String(team.team ?? "")) !== "sales") continue;
    if (/lead/i.test(String(team.team ?? ""))) continue;
    for (const sub of team.subHeads ?? []) {
      const emp = salesEmpFromSub(String(team.team ?? ""), sub);
      if (emp) salesPeers.push(emp);
    }
  }

  for (const team of teams) {
    const key = budgetKeyForTeamTitle(String(team.team ?? ""));
    const total = lineTotal(team);

    if (key === "sales") {
      let commission = 0;
      const title = String(team.team ?? "");
      for (const sub of team.subHeads ?? []) {
        const emp = salesEmpFromSub(title, sub);
        if (!emp) continue;
        const extra = emp.role === "team_lead" ? tlExtraForLead(emp, salesPeers, opts) : 0;
        const b = computeSalesEmployeePayroll(emp, extra, opts);
        commission += (Number(b.totalCommission) || 0) + extra;
      }
      commission = Math.max(0, commission);
      into.sales_commission += commission;
      into.sales += Math.max(0, total - commission);
      continue;
    }

    if (key === "technical") {
      let overtime = 0;
      for (const sub of team.subHeads ?? []) {
        overtime += overtimeFromSalary(sub.salary);
      }
      overtime = Math.max(0, overtime);
      into.technical_overtime += overtime;
      into.technical += Math.max(0, total - overtime);
      continue;
    }

    into[key] += total;
  }
}

export type OpexSubBucket = {
  key: string;
  headLabel: string;
  subLabel: string;
  label: string;
  amount: number;
};

export type OpexHeadBucket = {
  key: string;
  headLabel: string;
  label: string;
  amount: number;
};

/** Default OPEX heads (same as Income Statement seed) — always listed in budget even at 0. */
export const DEFAULT_OPEX_HEAD_LABELS = [
  "Office Management Expenses",
  "IT Equipments Expenses",
  "Regular IT Expenses",
  "Outsourcing Expenses",
  "Asset Purchasing Expenses",
  "Miscellaneous Expenses",
] as const;

/** Collect OPEX head totals (all sub-heads summed into the head). Includes 0-amount heads. */
export function collectOpexHeadAmounts(data: Record<string, unknown>): OpexHeadBucket[] {
  const out: OpexHeadBucket[] = [];
  const heads = (data.opexHeads as {
    label?: string;
    amount?: number;
    subHeads?: { label?: string; amount?: number }[];
  }[]) ?? [];

  for (const head of heads) {
    const headLabel = String(head.label ?? "").trim() || "OPEX";
    const subs = head.subHeads ?? [];
    const amt =
      subs.length > 0
        ? subs.reduce((a, s) => a + (Number(s.amount) || 0), 0)
        : Number(head.amount) || 0;
    out.push({
      key: opexHeadKey(headLabel),
      headLabel,
      label: headLabel,
      amount: amt,
    });
  }
  return out;
}

export function accumulateOpexHeads(
  data: Record<string, unknown>,
  into: Record<string, OpexHeadBucket>,
): void {
  for (const row of collectOpexHeadAmounts(data)) {
    const prev = into[row.key];
    if (prev) {
      prev.amount += row.amount;
    } else {
      into[row.key] = { ...row };
    }
  }
}

/** @deprecated Prefer collectOpexHeadAmounts — kept for any legacy callers. */
export function collectOpexSubAmounts(data: Record<string, unknown>): OpexSubBucket[] {
  return collectOpexHeadAmounts(data).map(h => ({
    key: h.key,
    headLabel: h.headLabel,
    subLabel: h.headLabel,
    label: h.label,
    amount: h.amount,
  }));
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
