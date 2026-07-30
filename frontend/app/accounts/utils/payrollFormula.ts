/** Technical-team (and shared) payroll formulas — editable inputs, computed outputs. */

export type EmployeeSalaryDetail = {
  basic: number;
  allowance: number;

  /** Weekday overtime hours */
  weekdayOtHours: number;
  /** Weekend overtime hours */
  weekendOtHours: number;

  /** Check-in / check-out HH:mm (24h) — used for late relief & 9h shift waiver */
  checkIn: string;
  checkOut: string;
  /** Manual late override — if set, used instead of time-based late calc */
  lateDeductionOverride?: number | null;

  paidLeaveDays: number;
  unpaidLeaveDays: number;

  /** Loan ledger */
  loanTotal: number;
  loanPaid: number;
  /** This month's loan installment deducted from salary (optional) */
  loanThisMonth: number;

  /** Manual income tax deduction */
  incomeTax: number;

  /** If true, PF = 8% of basic; if false use pfOverride */
  pfAuto: boolean;
  pfOverride?: number | null;

  remarks: string;
};

export type SalaryBreakdown = {
  monthlySalary: number;
  daySalary: number;
  hourSalary: number;
  weekdayOtPay: number;
  weekendOtPay: number;
  totalOvertime: number;
  totalEarning: number;
  lateDeduction: number;
  unpaidLeaveDeduction: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  loanThisMonth: number;
  loanRemaining: number;
  pf: number;
  incomeTax: number;
  totalDeduction: number;
  totalSalary: number;
  lateRuleApplied: string;
};

export function emptySalaryDetail(partial?: Partial<EmployeeSalaryDetail>): EmployeeSalaryDetail {
  return {
    basic: 0,
    allowance: 0,
    weekdayOtHours: 0,
    weekendOtHours: 0,
    checkIn: "07:00",
    checkOut: "16:00",
    lateDeductionOverride: null,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    loanTotal: 0,
    loanPaid: 0,
    loanThisMonth: 0,
    incomeTax: 0,
    pfAuto: true,
    pfOverride: null,
    remarks: "",
    ...partial,
  };
}

/** Parse "HH:mm" → minutes from midnight; invalid → null */
export function timeToMinutes(t: string | undefined | null): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t.trim())) return null;
  const [h, m] = t.trim().split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Late deduction for Technical Team.
 * Shift 07:00–16:00 (9h). Relief until 07:30.
 * 07:30–08:00 → 1/4 day | 08:00–09:00 → 1/3 day | 09:00+ → half day
 * Waiver: if check-in late but worked ≥ 9 hours, no late cut.
 */
export function calcLateDeduction(
  daySalary: number,
  checkIn: string,
  checkOut: string,
  override?: number | null,
): { amount: number; rule: string } {
  if (override != null && Number.isFinite(override) && override >= 0) {
    return { amount: Number(override) || 0, rule: "Manual late override" };
  }

  const inMin = timeToMinutes(checkIn);
  const outMin = timeToMinutes(checkOut);
  if (inMin == null) return { amount: 0, rule: "No check-in — no late cut" };

  const reliefEnd = 7 * 60 + 30; // 07:30
  const eight = 8 * 60;
  const nine = 9 * 60;

  if (inMin <= reliefEnd) {
    return { amount: 0, rule: "On time / relief (≤ 07:30)" };
  }

  // Full 9h shift waiver
  if (outMin != null) {
    const worked = outMin >= inMin ? outMin - inMin : outMin + 24 * 60 - inMin;
    if (worked >= 9 * 60) {
      return { amount: 0, rule: "Late but completed ≥ 9h shift — waived" };
    }
  }

  if (inMin < eight) {
    return { amount: daySalary / 4, rule: "07:30–08:00 → ¼ day" };
  }
  if (inMin < nine) {
    return { amount: daySalary / 3, rule: "08:00–09:00 → ⅓ day" };
  }
  return { amount: daySalary / 2, rule: "09:00+ → half day" };
}

export function computeSalary(detail: EmployeeSalaryDetail): SalaryBreakdown {
  const basic = Number(detail.basic) || 0;
  const allowance = Number(detail.allowance) || 0;
  const monthlySalary = basic + allowance;
  const daySalary = monthlySalary / 30;
  const hourSalary = daySalary / 8;

  const weekdayOtHours = Number(detail.weekdayOtHours) || 0;
  const weekendOtHours = Number(detail.weekendOtHours) || 0;
  const weekdayOtPay = weekdayOtHours * hourSalary * 1.5;
  const weekendOtPay = weekendOtHours * hourSalary * 2;
  const totalOvertime = weekdayOtPay + weekendOtPay;

  const totalEarning = basic + totalOvertime + allowance;

  const late = calcLateDeduction(
    daySalary,
    detail.checkIn,
    detail.checkOut,
    detail.lateDeductionOverride,
  );

  const unpaidLeaveDays = Number(detail.unpaidLeaveDays) || 0;
  const unpaidLeaveDeduction = unpaidLeaveDays * daySalary;
  const paidLeaveDays = Number(detail.paidLeaveDays) || 0;

  const loanTotal = Number(detail.loanTotal) || 0;
  const loanPaid = Number(detail.loanPaid) || 0;
  const loanThisMonth = Number(detail.loanThisMonth) || 0;
  const loanRemaining = Math.max(0, loanTotal - loanPaid);

  const pf = detail.pfAuto
    ? basic * 0.08
    : Number(detail.pfOverride) || 0;

  const incomeTax = Number(detail.incomeTax) || 0;

  const totalDeduction =
    late.amount + unpaidLeaveDeduction + loanThisMonth + pf + incomeTax;

  const totalSalary = totalEarning - totalDeduction;

  return {
    monthlySalary,
    daySalary,
    hourSalary,
    weekdayOtPay,
    weekendOtPay,
    totalOvertime,
    totalEarning,
    lateDeduction: late.amount,
    unpaidLeaveDeduction,
    paidLeaveDays,
    unpaidLeaveDays,
    loanThisMonth,
    loanRemaining,
    pf,
    incomeTax,
    totalDeduction,
    totalSalary,
    lateRuleApplied: late.rule,
  };
}
