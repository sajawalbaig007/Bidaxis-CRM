/** Build a salary-slip payload from Income Statement employee rows. */

import type { SubHeadEntry } from "../types";
import {
  computeAdminSalary,
  computeExecutiveSalary,
  computeSalary,
  computeTechnicalManagerSalary,
  emptySalaryDetail,
  type EmployeeSalaryDetail,
} from "./payrollFormula";
import {
  computeSalesEmployeePayroll,
  type SalesCommissionFields,
  type SalesPayrollEmployee,
} from "./salesPayrollFormula";
import {
  salarySlipMonthLabel,
  salarySlipMonthCompact,
  slipTemplateForKind,
  type SalarySlipLine,
  type SalarySlipPayload,
  type SalarySlipTemplate,
} from "./salarySlipShared";
import {
  DEFAULT_SALARY_SLIP_COMPANY,
  salarySlipCompanyForKind,
  type SalarySlipCompanyKey,
} from "./salarySlipCompanies";

export type SlipPayrollKind =
  | "technical"
  | "technical_manager"
  | "admin"
  | "sales"
  | "sales_lead"
  | "executive";

function profileFromSalary(sal?: Partial<EmployeeSalaryDetail> | null) {
  return {
    employeeId: sal?.employeeId || "",
    address: sal?.address || "",
    phone: sal?.phone || "",
    cnic: sal?.cnic || "",
  };
}

function commentsFrom(sal?: { remarks?: string }, unpaidDays = 0, paidDays = 0): string {
  const bits: string[] = [];
  if (sal?.remarks?.trim()) bits.push(sal.remarks.trim());
  if (paidDays > 0) bits.push(`Your ${paidDays} leave(s) considered as paid/casual leave.`);
  if (unpaidDays > 0) bits.push(`Unpaid leave days: ${unpaidDays}.`);
  return bits.join(" ") || "";
}

function commissionQtyLabels(c: SalesCommissionFields) {
  const oldCount = Number(c.oldClientProjects) || 0;
  const partial = Math.min(Number(c.oldClientPartialCount) || 0, oldCount);
  const oldFull = oldCount - partial;
  const newCount = Number(c.newClientProjects) || 0;
  const fixCount = (c.fixClientProjects ?? []).length;
  return {
    old:
      oldCount > 0
        ? partial > 0
          ? `${oldFull} full + ${partial} half`
          : `${oldCount} proj`
        : undefined,
    new: newCount > 0 ? `${newCount} proj` : undefined,
    fix: fixCount > 0 ? `${fixCount} client` : undefined,
  };
}

function buildSalesSlipEarnings(
  emp: SalesPayrollEmployee,
  b: ReturnType<typeof computeSalesEmployeePayroll>,
  kind: "sales" | "sales_lead",
  salesExtra: number,
  _template: SalarySlipTemplate,
): SalarySlipLine[] {
  const qty = commissionQtyLabels(emp.commission);
  const projectComm = b.oldComm + b.newComm;
  const lines: SalarySlipLine[] = [
    { label: "Basic Salary", amount: emp.basic },
    { label: "Misc Allowance", amount: emp.allowance },
  ];

  if (kind === "sales_lead") {
    lines.push({ label: "Home Allowance", amount: Number(emp.homeAllowance) || 0 });
  }

  lines.push(
    {
      label: "Project Based Comm",
      amount: projectComm,
      qty: qty.old || qty.new ? [qty.old, qty.new].filter(Boolean).join(" · ") : undefined,
    },
    {
      label: "Fixed Client Comm",
      amount: b.fixComm,
      qty: qty.fix,
    },
  );

  if (kind === "sales_lead" && salesExtra > 0) {
    lines.push({
      label: "Team Lead Commission",
      amount: salesExtra,
      qty: "Assigned reps",
    });
  }

  return lines;
}

function buildTechnicalManagerEarnings(
  sal: EmployeeSalaryDetail,
): SalarySlipLine[] {
  const tm = computeTechnicalManagerSalary(sal);
  return [
    { label: "Gross Salary", amount: tm.grossSalary },
    { label: "Basic Salary (50%)", amount: tm.basic },
    { label: "Medical Allowance (10%)", amount: tm.medicalAllowance },
    { label: "Home Allowance (20%)", amount: tm.homeAllowance },
    { label: "Utility Allowance (10%)", amount: tm.utilityAllowance },
    { label: "Travel Allowance (10%)", amount: tm.travelAllowance },
  ];
}

function standardDeductions(
  b: {
    incomeTax: number;
    unpaidLeaveDeduction: number;
    lateDeduction: number;
    pf: number;
    loanThisMonth?: number;
  },
  sal: { unpaidLeaveDays?: number; loanThisMonth?: number },
  loanThisMonth: number,
): SalarySlipLine[] {
  const unpaidDays = Number(sal.unpaidLeaveDays) || 0;
  return [
    { label: "Income Tax", amount: b.incomeTax },
    {
      label: "Unpaid Leaves",
      amount: b.unpaidLeaveDeduction,
      qty: unpaidDays > 0 ? `${unpaidDays} day(s)` : undefined,
    },
    { label: "Late Arrival Deduction", amount: b.lateDeduction },
    { label: "Employee PF Share", amount: b.pf },
    { label: "Loan Deduction", amount: loanThisMonth },
  ];
}

export function buildSalarySlipFromSub(opts: {
  sub: SubHeadEntry;
  kind: SlipPayrollKind;
  recordDate: string;
  companyKey?: SalarySlipCompanyKey;
  execProfitBase?: number;
  salesExtra?: number;
}): SalarySlipPayload {
  const {
    sub,
    kind,
    recordDate,
    companyKey = DEFAULT_SALARY_SLIP_COMPANY,
    execProfitBase = 0,
    salesExtra = 0,
  } = opts;
  const monthLabel = salarySlipMonthLabel(recordDate);
  const monthCompact = salarySlipMonthCompact(recordDate);
  const template = slipTemplateForKind(kind);

  if (kind === "sales" || kind === "sales_lead") {
    const sp = sub.salesPayroll as SalesPayrollEmployee | undefined;
    const role = kind === "sales_lead" || sp?.role === "team_lead" ? "team_lead" : "sales";
    const emp: SalesPayrollEmployee = {
      id: sp?.id || sub.id,
      name: sub.label,
      code: sp?.code || "",
      role,
      basic: Number(sp?.basic) || 0,
      allowance: Number(sp?.allowance) || 0,
      homeAllowance: role === "team_lead" ? Number(sp?.homeAllowance) || Number(sub.salary?.homeAllowance) || 0 : 0,
      commission: sp?.commission ?? {
        oldClientProjects: 0,
        oldClientPartialCount: 0,
        newClientProjects: 0,
        fixClientProjects: [],
      },
      assignedToLead: !!sp?.assignedToLead,
      assignedTeamLeadId: sp?.assignedTeamLeadId ?? null,
      checkIn: sp?.checkIn || "18:00",
      lateDeductionOverride: sp?.lateDeductionOverride ?? null,
      paidLeaveDays: Number(sp?.paidLeaveDays) || 0,
      unpaidLeaveDays: Number(sp?.unpaidLeaveDays) || 0,
      loanTotal: Number(sp?.loanTotal) || 0,
      loanPaid: Number(sp?.loanPaid) || 0,
      loanThisMonth: Number(sp?.loanThisMonth) || 0,
      loanPaymentMode: sp?.loanPaymentMode === "cash" ? "cash" : "salary",
      incomeTax: Number(sp?.incomeTax) || 0,
      remarks: sp?.remarks || "",
    };
    const b = computeSalesEmployeePayroll(emp, salesExtra);
    return {
      companyKey,
      template,
      monthLabel,
      monthCompact,
      employeeName: emp.name,
      employeeId: emp.code || undefined,
      earnings: buildSalesSlipEarnings(emp, b, kind, salesExtra, template),
      deductions: standardDeductions(
        {
          incomeTax: emp.incomeTax,
          unpaidLeaveDeduction: b.unpaidLeaveDeduction,
          lateDeduction: b.lateDeduction,
          pf: b.pf,
        },
        emp,
        b.loanFromSalary,
      ),
      comments: commentsFrom(emp, emp.unpaidLeaveDays, emp.paidLeaveDays),
      employeePf: b.pf,
      employerPf: b.pf,
      /** No. of projects — only on Sales Team slips (not team lead / technical) */
      projectCount: kind === "sales" ? b.totalProjects : undefined,
    };
  }

  if (kind === "executive") {
    const sal = emptySalaryDetail(sub.salary ?? { basic: sub.amount });
    const ex = computeExecutiveSalary(sal, execProfitBase);
    const profile = profileFromSalary(sal);
    return {
      companyKey,
      template,
      monthLabel,
      monthCompact,
      employeeName: sub.label,
      ...profile,
      earnings: [
        { label: "BasicSalary", amount: ex.basic },
        { label: "MiscAllowance", amount: 0 },
        { label: "HomeAllowance", amount: 0 },
        { label: "Commission", amount: ex.commission, qty: `${ex.commissionPct}%` },
        ...(ex.loanPositive > 0
          ? [{ label: "Loan (company owes)", amount: ex.loanPositive }]
          : []),
      ].filter(r => r.amount !== 0 || r.label === "BasicSalary"),
      deductions: [
        { label: "Income Tax", amount: 0 },
        { label: "Unpaid Leaves", amount: 0 },
        { label: "Late Arrival Deduction", amount: 0 },
        { label: "Employee PF Share", amount: 0 },
        { label: "Loan Deduction", amount: ex.loanNegative },
      ],
      comments: commentsFrom(sal),
      employeePf: 0,
      employerPf: 0,
    };
  }

  const sal = emptySalaryDetail(sub.salary ?? { basic: sub.amount });
  const isTechMgr = kind === "technical_manager";
  const isTechnical = kind === "technical" || isTechMgr;
  const b = isTechMgr
    ? computeTechnicalManagerSalary(sal)
    : kind === "admin"
      ? computeAdminSalary(sal)
      : computeSalary(sal);
  const profile = profileFromSalary(sal);
  const home = Number(sal.homeAllowance) || 0;

  return {
    companyKey: isTechnical ? salarySlipCompanyForKind(kind, companyKey) : companyKey,
    template: isTechnical ? slipTemplateForKind(kind) : template,
    monthLabel,
    monthCompact,
    employeeName: sub.label,
    ...profile,
    earnings: isTechMgr
      ? buildTechnicalManagerEarnings(sal)
      : isTechnical
        ? [
            { label: "Basic Salary", amount: sal.basic },
            { label: "Allowances", amount: sal.allowance + home },
            {
              label: "Weekday Overtime (1.5x)",
              amount: b.weekdayOtPay,
              qty: sal.weekdayOtHours > 0 ? `${sal.weekdayOtHours} hr` : undefined,
            },
            {
              label: "Weekend Overtime (2x)",
              amount: b.weekendOtPay,
              qty: sal.weekendOtHours > 0 ? `${sal.weekendOtHours} hr` : undefined,
            },
          ]
        : [
            { label: "Basic Salary", amount: sal.basic },
            { label: "Misc Allowance", amount: sal.allowance },
            { label: "Home Allowance", amount: home },
            ...(b.totalOvertime > 0 ? [{ label: "Overtime", amount: b.totalOvertime }] : []),
          ],
    deductions: isTechMgr
      ? [
          { label: "PF Deduction (8% of Basic)", amount: b.pf },
          { label: "Tax Amount", amount: b.incomeTax },
          ...(b.loanFromSalary > 0 ? [{ label: "Loan Deduction", amount: b.loanFromSalary }] : []),
        ]
      : standardDeductions(
          { ...b, loanThisMonth: b.loanFromSalary },
          sal,
          b.loanFromSalary,
        ),
    comments: commentsFrom(sal, sal.unpaidLeaveDays, sal.paidLeaveDays),
    employeePf: b.pf,
    employerPf: b.pf,
  };
}
