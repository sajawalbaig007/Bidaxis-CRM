/** Build a salary-slip payload from Income Statement employee rows. */

import type { SubHeadEntry } from "../types";
import {
  computeAdminSalary,
  computeExecutiveSalary,
  computeSalary,
  emptySalaryDetail,
  type EmployeeSalaryDetail,
} from "./payrollFormula";
import {
  computeSalesEmployeePayroll,
  type SalesCommissionFields,
  type SalesPayrollEmployee,
} from "./salesPayrollFormula";
import {
  getSlipTemplateForKind,
  linesFromTemplate,
  type SlipAmountBag,
  type SlipPayrollKind,
} from "./salarySlipFieldConfig";
import {
  salarySlipMonthLabel,
  salarySlipMonthCompact,
  type SalarySlipPayload,
} from "./salarySlipShared";
import {
  DEFAULT_SALARY_SLIP_COMPANY,
  salarySlipCompanyForKind,
  type SalarySlipCompanyKey,
} from "./salarySlipCompanies";

export type { SlipPayrollKind } from "./salarySlipFieldConfig";

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

function employeeRowsFromTemplate(
  kind: SlipPayrollKind,
  data: {
    employeeName: string;
    employeeId?: string;
    address?: string;
    phone?: string;
    cnic?: string;
    projectCount?: number;
  },
) {
  const tpl = getSlipTemplateForKind(kind);
  const values: Record<string, string> = {
    employeeName: data.employeeName || "",
    employeeId: data.employeeId || "",
    address: data.address || "",
    phone: data.phone || "",
    cnic: data.cnic || "",
    projectCount:
      data.projectCount != null ? `${Math.max(0, Number(data.projectCount) || 0)}` : "",
  };
  return tpl.employeeFields
    .filter(f => f.enabled)
    .map(f => ({
      label: f.label,
      value: f.key === "custom" ? f.defaultValue || "" : values[f.key] ?? "",
    }));
}

function withTemplateMeta(
  kind: SlipPayrollKind,
  base: SalarySlipPayload,
  bag: SlipAmountBag,
): SalarySlipPayload {
  const tpl = getSlipTemplateForKind(kind);
  return {
    ...base,
    template: tpl.layout,
    employeeRows: employeeRowsFromTemplate(kind, base),
    footer: { ...tpl.footer },
    customSections: (tpl.customSections ?? [])
      .filter(s => s.enabled)
      .map(s => ({
        title: s.title || "Extra",
        lines: linesFromTemplate(s.fields ?? [], bag),
      }))
      .filter(s => s.lines.length > 0),
  };
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
  const tpl = getSlipTemplateForKind(kind);

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
      incomeTax: Number(sp?.incomeTax) || 0,
      remarks: sp?.remarks || "",
    };
    const b = computeSalesEmployeePayroll(emp, salesExtra);
    const qty = commissionQtyLabels(emp.commission);
    const bag: SlipAmountBag = {
      basic: emp.basic,
      allowance: emp.allowance,
      homeAllowance: Number(emp.homeAllowance) || 0,
      projectComm: b.oldComm + b.newComm,
      fixComm: b.fixComm,
      teamLeadComm: salesExtra,
      incomeTax: emp.incomeTax,
      unpaidLeaves: b.unpaidLeaveDeduction,
      lateDeduction: b.lateDeduction,
      employeePf: b.pf,
      loanDeduction: emp.loanThisMonth,
      qty: {
        projectComm: [qty.old, qty.new].filter(Boolean).join(" · ") || undefined,
        fixComm: qty.fix,
        teamLeadComm: salesExtra > 0 ? "Assigned reps" : undefined,
        unpaidLeaves: emp.unpaidLeaveDays > 0 ? `${emp.unpaidLeaveDays} day(s)` : undefined,
      },
    };
    return withTemplateMeta(kind, {
      companyKey,
      template: tpl.layout,
      monthLabel,
      monthCompact,
      employeeName: emp.name,
      employeeId: emp.code || undefined,
      earnings: linesFromTemplate(tpl.earnings, bag),
      deductions: linesFromTemplate(tpl.deductions, bag),
      comments: commentsFrom(emp, emp.unpaidLeaveDays, emp.paidLeaveDays),
      employeePf: b.pf,
      employerPf: b.pf,
      /** No. of projects — only on Sales Team slips (not team lead / technical) */
      projectCount: kind === "sales" ? b.totalProjects : undefined,
    }, bag);
  }

  if (kind === "executive") {
    const sal = emptySalaryDetail(sub.salary ?? { basic: sub.amount });
    const ex = computeExecutiveSalary(sal, execProfitBase);
    const profile = profileFromSalary(sal);
    const bag: SlipAmountBag = {
      basic: ex.basic,
      allowance: Number(sal.allowance) || 0,
      homeAllowance: Number(sal.homeAllowance) || 0,
      commission: ex.commission,
      incomeTax: 0,
      unpaidLeaves: 0,
      lateDeduction: 0,
      employeePf: 0,
      loanDeduction: 0,
      qty: {
        commission: `${ex.commissionPct}%`,
      },
    };
    return withTemplateMeta(kind, {
      companyKey,
      template: tpl.layout,
      monthLabel,
      monthCompact,
      employeeName: sub.label,
      ...profile,
      earnings: linesFromTemplate(tpl.earnings, bag),
      deductions: linesFromTemplate(tpl.deductions, bag),
      comments: commentsFrom(sal),
      employeePf: 0,
      employerPf: 0,
    }, bag);
  }

  const sal = emptySalaryDetail(sub.salary ?? { basic: sub.amount });
  const isTechMgr = kind === "technical_manager";
  const isTechnical = kind === "technical" || isTechMgr;
  const b = kind === "admin" ? computeAdminSalary(sal) : computeSalary(sal);
  const profile = profileFromSalary(sal);
  const home = Number(sal.homeAllowance) || 0;
  const unpaidDays = Number(sal.unpaidLeaveDays) || 0;

  const bag: SlipAmountBag = {
    basic: sal.basic,
    allowance: sal.allowance,
    homeAllowance: home,
    medicalAllowance: Number(sal.medicalAllowance) || 0,
    travelAllowance: Number(sal.travelAllowance) || 0,
    allowancesCombined: sal.allowance + home,
    weekdayOt: b.weekdayOtPay,
    weekendOt: b.weekendOtPay,
    overtimeTotal: b.totalOvertime,
    incomeTax: b.incomeTax,
    unpaidLeaves: b.unpaidLeaveDeduction,
    lateDeduction: b.lateDeduction,
    employeePf: b.pf,
    loanDeduction: b.loanThisMonth,
    qty: {
      weekdayOt: sal.weekdayOtHours > 0 ? `${sal.weekdayOtHours} hr` : undefined,
      weekendOt: sal.weekendOtHours > 0 ? `${sal.weekendOtHours} hr` : undefined,
      unpaidLeaves: unpaidDays > 0 ? `${unpaidDays} day(s)` : undefined,
    },
  };

  return withTemplateMeta(kind, {
    companyKey: isTechnical ? salarySlipCompanyForKind(kind, companyKey) : companyKey,
    template: tpl.layout,
    monthLabel,
    monthCompact,
    employeeName: sub.label,
    ...profile,
    earnings: linesFromTemplate(tpl.earnings, bag),
    deductions: linesFromTemplate(tpl.deductions, bag),
    comments: commentsFrom(sal, sal.unpaidLeaveDays, sal.paidLeaveDays),
    employeePf: b.pf,
    employerPf: b.pf,
  }, bag);
}
