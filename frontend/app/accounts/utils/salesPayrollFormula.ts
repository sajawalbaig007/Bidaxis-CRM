/** Sales team payroll — commission + 6 PM late (no overtime) */

export type ProjectCurrency = "USD" | "CAD";

export type FixClientProject = {
  id: string;
  clientName: string;
  projectPay: number;
  currency?: ProjectCurrency;
  /** PKR per 1 unit of project currency, captured when the project was entered. */
  fxRate?: number;
};

export type SalesPayrollCalcOpts = {
  recordDate?: string;
  usdToPkr?: number;
  cadToPkr?: number;
};

export type SalesCommissionFields = {
  oldClientProjects: number;
  oldClientPartialCount: number;
  newClientProjects: number;
  fixClientProjects: FixClientProject[];
};

export type SalesPayrollEmployee = {
  id: string;
  name: string;
  code: string;
  role: "sales" | "team_lead";
  basic: number;
  allowance: number;
  /** Team lead only — home allowance on salary slip & net pay */
  homeAllowance?: number;
  commission: SalesCommissionFields;
  assignedToLead: boolean;
  assignedTeamLeadId: string | null;
  checkIn: string;
  lateDeductionOverride: number | null;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  loanTotal: number;
  loanPaid: number;
  loanThisMonth: number;
  /** salary = deduct from net; cash = separate payment (net unchanged) */
  loanPaymentMode?: "salary" | "cash";
  incomeTax: number;
  remarks: string;
  /**
   * One-off / occasional pay — added to net only (no PF / tax / late formulas).
   * Net = (Total Earning − Total Deduction) + Occasional Amount
   */
  occasionalAmount?: number;
  occasionalRemark?: string;
  /** If true (default), PF = 8% of basic; if false use pfOverride */
  pfAuto?: boolean;
  pfOverride?: number | null;
  /** HR profile for salary slip */
  cnic?: string;
  address?: string;
  phone?: string;
};

export type SalesPayrollData = {
  salesTeamMembers: SalesPayrollEmployee[];
  salesTeamLeads: SalesPayrollEmployee[];
};

export type PayrollLoan = {
  id: string;
  employeeName: string;
  department: string;
  totalAmount: number;
  paidAmount: number;
};

const OLD_RATE = 1000;
const NEW_RATE = 3000;
const TL_PER_PROJECT = 1000;
const TL_FIX_PCT = 0.005;
/** September 2026 onward — slab % × 0.89 tax × live FX. */
export const PROJECT_SLAB_FROM_MONTH = "2026-09";
export const PROJECT_TAX_FACTOR = 0.89;

export function usesProjectSlabRules(recordDate?: string | null): boolean {
  const d = String(recordDate ?? "").trim();
  if (!/^\d{4}-\d{2}/.test(d)) return false;
  return d.slice(0, 7) >= PROJECT_SLAB_FROM_MONTH;
}

/** $0–1000 = 3% · $1001–3000 = 3.5% · $3001–5000 = 4% · $5001–10,000 = 4.5% · $10,001+ = 5% */
export function projectSlabRate(amount: number): number {
  const a = Math.max(0, Number(amount) || 0);
  if (a <= 1000) return 0.03;
  if (a <= 3000) return 0.035;
  if (a <= 5000) return 0.04;
  if (a <= 10000) return 0.045;
  return 0.05;
}

function projectFxRate(p: FixClientProject, opts?: SalesPayrollCalcOpts): number {
  const stored = Number(p.fxRate);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const currency = p.currency === "CAD" ? "CAD" : "USD";
  const live = currency === "CAD" ? Number(opts?.cadToPkr) : Number(opts?.usdToPkr);
  return Number.isFinite(live) && live > 0 ? live : 0;
}

/** amount × slab% × 0.89 × FX  (e.g. 300 × 0.03 × 0.89 × 277) */
export function projectCommissionPkr(p: FixClientProject, opts?: SalesPayrollCalcOpts): number {
  const amount = Number(p.projectPay) || 0;
  return amount * projectSlabRate(amount) * PROJECT_TAX_FACTOR * projectFxRate(p, opts);
}

/** Team-lead share of a team project: amount × 0.5% × 0.89 × FX */
export function tlProjectCommissionPkr(p: FixClientProject, opts?: SalesPayrollCalcOpts): number {
  const amount = Number(p.projectPay) || 0;
  return amount * 0.005 * PROJECT_TAX_FACTOR * projectFxRate(p, opts);
}

export function timeToMinutes(t: string | undefined | null): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t.trim())) return null;
  const [h, m] = t.trim().split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function calcSalesLateDeduction(
  daySalary: number,
  checkIn: string,
  override?: number | null,
): { amount: number; rule: string } {
  if (override != null && Number.isFinite(override) && override >= 0) {
    return { amount: Number(override) || 0, rule: "Manual late override" };
  }
  const inMin = timeToMinutes(checkIn);
  if (inMin == null) return { amount: 0, rule: "No check-in — no late cut" };

  const t1815 = 18 * 60 + 15;
  const t1830 = 18 * 60 + 30;
  const t1900 = 19 * 60;
  const t2000 = 20 * 60;

  if (inMin <= t1815) return { amount: 0, rule: "On time (≤ 18:15 PKT)" };
  if (inMin < t1830) return { amount: daySalary / 5, rule: "18:15–18:30 → ⅕ day" };
  if (inMin < t1900) return { amount: daySalary / 4, rule: "18:30–19:00 → ¼ day" };
  if (inMin < t2000) return { amount: daySalary / 3, rule: "19:00–20:00 → ⅓ day" };
  return { amount: daySalary / 2, rule: "20:00+ → half day" };
}

export function calcSalesCommission(
  commission: SalesCommissionFields,
  _role: "sales" | "team_lead",
  opts?: SalesPayrollCalcOpts,
) {
  const oldCount = Number(commission.oldClientProjects) || 0;
  const partial = Math.min(Number(commission.oldClientPartialCount) || 0, oldCount);
  const oldFull = oldCount - partial;
  const oldComm = oldFull * OLD_RATE + partial * (OLD_RATE * 0.5);
  const newComm = (Number(commission.newClientProjects) || 0) * NEW_RATE;
  const slab = usesProjectSlabRules(opts?.recordDate);
  const fixComm = (commission.fixClientProjects ?? []).reduce(
    (s, p) => s + (slab ? projectCommissionPkr(p, opts) : (Number(p.projectPay) || 0) * 0.025),
    0,
  );
  const totalProjects =
    oldCount + (Number(commission.newClientProjects) || 0) + (commission.fixClientProjects?.length ?? 0);
  const totalCommission = oldComm + newComm + fixComm;
  return { oldComm, newComm, fixComm, totalProjects, totalCommission, slab };
}

export function calcTlAssignedCommission(rep: SalesPayrollEmployee, opts?: SalesPayrollCalcOpts) {
  if (!rep.assignedToLead) return 0;
  if (usesProjectSlabRules(opts?.recordDate)) {
    return (rep.commission.fixClientProjects ?? []).reduce(
      (s, p) => s + tlProjectCommissionPkr(p, opts),
      0,
    );
  }
  const { totalProjects } = calcSalesCommission(rep.commission, "sales", opts);
  const fixPay = (rep.commission.fixClientProjects ?? []).reduce(
    (s, p) => s + (Number(p.projectPay) || 0),
    0,
  );
  return totalProjects * TL_PER_PROJECT + fixPay * TL_FIX_PCT;
}

export function computeSalesEmployeePayroll(
  emp: SalesPayrollEmployee,
  extraEarning = 0,
  opts?: SalesPayrollCalcOpts,
) {
  const basic = Number(emp.basic) || 0;
  const allowance = Number(emp.allowance) || 0;
  const homeAllowance = emp.role === "team_lead" ? Number(emp.homeAllowance) || 0 : 0;
  const daySalary = (basic + allowance + homeAllowance) / 30;
  const comm = calcSalesCommission(emp.commission, emp.role, opts);
  const late = calcSalesLateDeduction(daySalary, emp.checkIn, emp.lateDeductionOverride);
  const unpaidDays = Number(emp.unpaidLeaveDays) || 0;
  const unpaidLeaveDeduction = unpaidDays * daySalary;
  const loanThisMonth = Number(emp.loanThisMonth) || 0;
  const loanFromSalary = emp.loanPaymentMode === "cash" ? 0 : loanThisMonth;
  const pfAuto = emp.pfAuto !== false;
  const pf = pfAuto ? basic * 0.08 : Math.max(0, Number(emp.pfOverride) || 0);
  const incomeTax = Number(emp.incomeTax) || 0;
  const totalEarning = basic + allowance + homeAllowance + comm.totalCommission + extraEarning;
  const baseDeduction = late.amount + unpaidLeaveDeduction + pf + incomeTax;
  const totalDeduction = baseDeduction + loanFromSalary;
  const occasionalAmount = Math.max(0, Number(emp.occasionalAmount) || 0);
  return {
    ...comm,
    daySalary,
    lateDeduction: late.amount,
    lateRuleApplied: late.rule,
    unpaidLeaveDeduction,
    pf,
    pfAuto,
    totalEarning,
    totalDeduction,
    loanFromSalary,
    occasionalAmount,
    netBeforeLoan: totalEarning - baseDeduction + occasionalAmount,
    netSalary: totalEarning - totalDeduction + occasionalAmount,
    loanRemaining: Math.max(
      0,
      (Number(emp.loanTotal) || 0) - (Number(emp.loanPaid) || 0) - (Number(emp.loanThisMonth) || 0),
    ),
  };
}

export function newFixClientProject(init?: Partial<FixClientProject>): FixClientProject {
  return {
    id: init?.id ?? `fix-${Date.now()}`,
    clientName: init?.clientName ?? "",
    projectPay: Number(init?.projectPay) || 0,
    currency: init?.currency === "CAD" ? "CAD" : "USD",
    fxRate: Number(init?.fxRate) || 0,
  };
}

export function newRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
