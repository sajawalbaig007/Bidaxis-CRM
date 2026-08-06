/** Technical-team (and shared) payroll formulas — editable inputs, computed outputs. */

export type EmployeeSalaryDetail = {
  basic: number;
  allowance: number;
  /** Optional home allowance line on salary slip (Misc = allowance). */
  homeAllowance?: number;
  /** Technical manager / itemized allowance lines */
  medicalAllowance?: number;
  travelAllowance?: number;
  /** Technical manager — utility allowance (10% of gross) */
  utilityAllowance?: number;
  /** Technical manager — package gross (drives % splits) */
  grossSalary?: number;

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
  /** This month's loan installment (salary cut or separate cash) */
  loanThisMonth: number;
  /**
   * How this month's loan amount was cleared:
   * - salary → deduct from net salary
   * - cash → separate cash payment (salary net unchanged)
   */
  loanPaymentMode?: "salary" | "cash";

  /** Manual income tax deduction */
  incomeTax: number;

  /** If true, PF = 8% of basic; if false use pfOverride */
  pfAuto: boolean;
  pfOverride?: number | null;

  remarks: string;

  /** Salary slip / HR profile (optional — fill before month-end download) */
  employeeId?: string;
  address?: string;
  phone?: string;
  cnic?: string;

  /** Executive only — commission % of net profit (before executive salaries) */
  commissionPct?: number;
  /** Executive only — loan the company owes to the executive */
  loanPositive?: number;
  /** Executive only — loan the executive owes to the company */
  loanNegative?: number;
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
  /** Amount actually taken from salary (0 when cash clearance) */
  loanFromSalary: number;
  /** Net before loan salary deduction */
  netBeforeLoan: number;
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
    loanPaymentMode: "salary",
    incomeTax: 0,
    pfAuto: true,
    pfOverride: null,
    remarks: "",
    ...partial,
  };
}

/** Amount deducted from salary this month (0 if cleared via separate cash). */
export function loanAmountFromSalary(
  detail: Pick<EmployeeSalaryDetail, "loanThisMonth" | "loanPaymentMode">,
): number {
  const amt = Math.max(0, Number(detail.loanThisMonth) || 0);
  if (amt <= 0) return 0;
  return detail.loanPaymentMode === "cash" ? 0 : amt;
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

/**
 * Late deduction for Administration (evening shift 18:00).
 * 18:00–18:15 none | 18:15–18:30 ⅕ day | 18:30–19:00 ¼ day |
 * 19:00–20:00 ⅓ day | 20:00 onwards half day.
 */
export function calcAdminLateDeduction(
  daySalary: number,
  checkIn: string,
  override?: number | null,
): { amount: number; rule: string } {
  if (override != null && Number.isFinite(override) && override >= 0) {
    return { amount: Number(override) || 0, rule: "Manual late override" };
  }

  const inMin = timeToMinutes(checkIn);
  if (inMin == null) return { amount: 0, rule: "No check-in — no late cut" };

  const t = (h: number, m: number) => h * 60 + m;
  if (inMin <= t(18, 15)) return { amount: 0, rule: "On time / relief (≤ 18:15)" };
  if (inMin <= t(18, 30)) return { amount: daySalary / 5, rule: "18:15–18:30 → ⅕ day" };
  if (inMin <= t(19, 0)) return { amount: daySalary / 4, rule: "18:30–19:00 → ¼ day" };
  if (inMin < t(20, 0)) return { amount: daySalary / 3, rule: "19:00–20:00 → ⅓ day" };
  return { amount: daySalary / 2, rule: "20:00 onwards → half day" };
}

/**
 * Administration payroll:
 * Basic + Allowance = Total Earning (no overtime).
 * Late (6 PM slabs) + Unpaid leaves + Loan (this month) + PF (8% of basic) + Tax = Total Deduction.
 * Total Earning − Total Deduction = Total Salary.
 */
export function computeAdminSalary(detail: EmployeeSalaryDetail): SalaryBreakdown {
  const basic = Number(detail.basic) || 0;
  const allowance = Number(detail.allowance) || 0;
  const homeAllowance = Number(detail.homeAllowance) || 0;
  const medicalAllowance = Number(detail.medicalAllowance) || 0;
  const travelAllowance = Number(detail.travelAllowance) || 0;
  const monthlySalary = basic + allowance + homeAllowance + medicalAllowance + travelAllowance;
  const daySalary = monthlySalary / 30;
  const hourSalary = daySalary / 8;

  const totalEarning = monthlySalary;

  const late = calcAdminLateDeduction(daySalary, detail.checkIn, detail.lateDeductionOverride);

  const unpaidLeaveDays = Number(detail.unpaidLeaveDays) || 0;
  const unpaidLeaveDeduction = unpaidLeaveDays * daySalary;
  const paidLeaveDays = Number(detail.paidLeaveDays) || 0;

  const loanTotal = Number(detail.loanTotal) || 0;
  const loanPaid = Number(detail.loanPaid) || 0;
  const loanThisMonth = Number(detail.loanThisMonth) || 0;
  const loanFromSalary = loanAmountFromSalary(detail);
  const loanRemaining = Math.max(0, loanTotal - loanPaid - loanThisMonth);

  const pf = detail.pfAuto ? basic * 0.08 : Number(detail.pfOverride) || 0;
  const incomeTax = Number(detail.incomeTax) || 0;

  const baseDeduction = late.amount + unpaidLeaveDeduction + pf + incomeTax;
  const totalDeduction = baseDeduction + loanFromSalary;
  const netBeforeLoan = totalEarning - baseDeduction;
  const totalSalary = totalEarning - totalDeduction;

  return {
    monthlySalary,
    daySalary,
    hourSalary,
    weekdayOtPay: 0,
    weekendOtPay: 0,
    totalOvertime: 0,
    totalEarning,
    lateDeduction: late.amount,
    unpaidLeaveDeduction,
    paidLeaveDays,
    unpaidLeaveDays,
    loanThisMonth,
    loanFromSalary,
    netBeforeLoan,
    loanRemaining,
    pf,
    incomeTax,
    totalDeduction,
    totalSalary,
    lateRuleApplied: late.rule,
  };
}

export type ExecutiveBreakdown = {
  basic: number;
  commissionPct: number;
  /** Net profit (before executive salaries) used as commission base */
  commissionBase: number;
  commission: number;
  /** Basic + Commission */
  totalSalary: number;
  /** Loan the company owes to the executive */
  loanPositive: number;
  /** Loan the executive owes to the company */
  loanNegative: number;
};

/**
 * Executive payroll:
 * Commission = % of net profit (profit before executive salaries; no commission on loss).
 * Basic Salary + Commission = Total Salary.
 * Loan +ve / −ve are tracked as a ledger and do not change the total salary.
 */
export function computeExecutiveSalary(
  detail: Partial<EmployeeSalaryDetail>,
  profitBase: number,
): ExecutiveBreakdown {
  const basic = Number(detail.basic) || 0;
  const commissionPct = Number(detail.commissionPct) || 0;
  const commissionBase = Math.max(0, Number(profitBase) || 0);
  const commission = (commissionBase * commissionPct) / 100;
  return {
    basic,
    commissionPct,
    commissionBase,
    commission,
    totalSalary: basic + commission,
    loanPositive: Number(detail.loanPositive) || 0,
    loanNegative: Number(detail.loanNegative) || 0,
  };
}

export function computeSalary(detail: EmployeeSalaryDetail): SalaryBreakdown {
  const basic = Number(detail.basic) || 0;
  const allowance = Number(detail.allowance) || 0;
  const homeAllowance = Number(detail.homeAllowance) || 0;
  const medicalAllowance = Number(detail.medicalAllowance) || 0;
  const travelAllowance = Number(detail.travelAllowance) || 0;
  const monthlySalary = basic + allowance + homeAllowance + medicalAllowance + travelAllowance;
  const daySalary = monthlySalary / 30;
  const hourSalary = daySalary / 8;

  const weekdayOtHours = Number(detail.weekdayOtHours) || 0;
  const weekendOtHours = Number(detail.weekendOtHours) || 0;
  const weekdayOtPay = weekdayOtHours * hourSalary * 1.5;
  const weekendOtPay = weekendOtHours * hourSalary * 2;
  const totalOvertime = weekdayOtPay + weekendOtPay;

  const totalEarning = basic + allowance + homeAllowance + medicalAllowance + travelAllowance + totalOvertime;

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
  const loanFromSalary = loanAmountFromSalary(detail);
  const loanRemaining = Math.max(0, loanTotal - loanPaid - loanThisMonth);

  const pf = detail.pfAuto
    ? basic * 0.08
    : Number(detail.pfOverride) || 0;

  const incomeTax = Number(detail.incomeTax) || 0;

  const baseDeduction = late.amount + unpaidLeaveDeduction + pf + incomeTax;
  const totalDeduction = baseDeduction + loanFromSalary;
  const netBeforeLoan = totalEarning - baseDeduction;
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
    loanFromSalary,
    netBeforeLoan,
    loanRemaining,
    pf,
    incomeTax,
    totalDeduction,
    totalSalary,
    lateRuleApplied: late.rule,
  };
}

/** Technical Manager package splits of Gross Salary */
export const TECH_MGR_GROSS_SPLITS = {
  basic: 0.5,
  medical: 0.1,
  home: 0.2,
  utility: 0.1,
  travel: 0.1,
} as const;

export type TechManagerBreakdown = SalaryBreakdown & {
  grossSalary: number;
  basic: number;
  medicalAllowance: number;
  homeAllowance: number;
  utilityAllowance: number;
  travelAllowance: number;
  /** Gross − Medical (medical treated as non-taxable) */
  taxableIncome: number;
};

/** Gross = explicit field, else sum of stored package lines (legacy rows). */
export function resolveTechnicalManagerGross(detail: EmployeeSalaryDetail): number {
  const g = Number(detail.grossSalary) || 0;
  if (g > 0) return g;
  return (
    (Number(detail.basic) || 0) +
    (Number(detail.homeAllowance) || 0) +
    (Number(detail.medicalAllowance) || 0) +
    (Number(detail.utilityAllowance) || 0) +
    (Number(detail.travelAllowance) || 0) +
    (Number(detail.allowance) || 0)
  );
}

/** Write Gross and auto-fill Basic / Medical / Home / Utility / Travel. */
export function applyTechnicalManagerGross(
  detail: EmployeeSalaryDetail,
  gross: number,
): EmployeeSalaryDetail {
  const g = Math.max(0, Number(gross) || 0);
  const s = TECH_MGR_GROSS_SPLITS;
  return {
    ...detail,
    grossSalary: g,
    basic: g * s.basic,
    medicalAllowance: g * s.medical,
    homeAllowance: g * s.home,
    utilityAllowance: g * s.utility,
    travelAllowance: g * s.travel,
    allowance: 0,
    pfAuto: true,
  };
}

/**
 * Technical Manager package salary (sheet formula):
 * Basic 50% · Medical 10% · Home 20% · Utility 10% · Travel 10% of Gross
 * PF = 8% of Basic · Taxable = Gross − Medical · Net = Gross − PF − Tax (− loan this month)
 */
export function computeTechnicalManagerSalary(detail: EmployeeSalaryDetail): TechManagerBreakdown {
  const gross = resolveTechnicalManagerGross(detail);
  const s = TECH_MGR_GROSS_SPLITS;
  const basic = gross * s.basic;
  const medicalAllowance = gross * s.medical;
  const homeAllowance = gross * s.home;
  const utilityAllowance = gross * s.utility;
  const travelAllowance = gross * s.travel;
  const monthlySalary = gross;
  const daySalary = monthlySalary / 30;
  const hourSalary = daySalary / 8;

  const pf =
    detail.pfAuto !== false ? basic * 0.08 : Number(detail.pfOverride) || 0;
  const incomeTax = Number(detail.incomeTax) || 0;
  const loanThisMonth = Number(detail.loanThisMonth) || 0;
  const loanFromSalary = loanAmountFromSalary(detail);
  const loanRemaining = Math.max(
    0,
    (Number(detail.loanTotal) || 0) - (Number(detail.loanPaid) || 0) - loanThisMonth,
  );

  const taxableIncome = gross - medicalAllowance;
  const totalEarning = gross;
  const baseDeduction = pf + incomeTax;
  const totalDeduction = baseDeduction + loanFromSalary;
  const netBeforeLoan = totalEarning - baseDeduction;
  const totalSalary = totalEarning - totalDeduction;

  return {
    grossSalary: gross,
    basic,
    medicalAllowance,
    homeAllowance,
    utilityAllowance,
    travelAllowance,
    taxableIncome,
    monthlySalary,
    daySalary,
    hourSalary,
    weekdayOtPay: 0,
    weekendOtPay: 0,
    totalOvertime: 0,
    totalEarning,
    lateDeduction: 0,
    unpaidLeaveDeduction: 0,
    paidLeaveDays: Number(detail.paidLeaveDays) || 0,
    unpaidLeaveDays: Number(detail.unpaidLeaveDays) || 0,
    loanThisMonth,
    loanFromSalary,
    netBeforeLoan,
    loanRemaining,
    pf,
    incomeTax,
    totalDeduction,
    totalSalary,
    lateRuleApplied: "Package salary — no late slabs",
  };
}
