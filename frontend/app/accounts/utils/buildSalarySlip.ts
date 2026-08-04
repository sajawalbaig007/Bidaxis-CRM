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
  type SalesPayrollEmployee,
} from "./salesPayrollFormula";
import { salarySlipMonthLabel, type SalarySlipPayload } from "./salarySlipPdf";
import {
  DEFAULT_SALARY_SLIP_COMPANY,
  type SalarySlipCompanyKey,
} from "./salarySlipCompanies";

export type SlipPayrollKind = "technical" | "admin" | "sales" | "sales_lead" | "executive";

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
    const projectBasedCommission = b.oldComm + b.newComm + (kind === "sales_lead" ? salesExtra : 0);
    const fixedClientCommission = b.fixComm;
    const useSalesLeadTemplate = kind === "sales_lead";
    const useSalesTeamTemplate = kind === "sales";
    return {
      companyKey,
      monthLabel,
      employeeName: emp.name,
      employeeId: emp.code || undefined,
      earnings: useSalesLeadTemplate
        ? [
            { label: "Basic Salary", amount: emp.basic },
            { label: "Misc Allowance", amount: emp.allowance },
            { label: "Home Allowance", amount: 0 },
            { label: "Project Based Comm", amount: projectBasedCommission },
            { label: "Fixed Client Comm", amount: fixedClientCommission },
          ].filter(r => r.amount !== 0 || r.label === "Basic Salary")
        : useSalesTeamTemplate
          ? [
              { label: "Basic Salary", amount: emp.basic },
              { label: "Misc Allowance", amount: emp.allowance },
              { label: "Project Based Comm", amount: projectBasedCommission },
              { label: "Fixed Client Comm", amount: fixedClientCommission },
            ].filter(r => r.amount !== 0 || r.label === "Basic Salary")
        : [
            { label: "BasicSalary", amount: emp.basic },
            { label: "MiscAllowance", amount: emp.allowance },
            { label: "HomeAllowance", amount: 0 },
            { label: "Commission", amount: b.totalCommission + salesExtra },
          ].filter(r => r.amount !== 0 || r.label === "BasicSalary"),
      deductions: [
        { label: "Income Tax", amount: emp.incomeTax },
        { label: "Unpaid Leaves", amount: b.unpaidLeaveDeduction },
        { label: "Late Arrival Deduction", amount: b.lateDeduction },
        { label: "Employee PF Share", amount: b.pf },
        { label: "Loan Deduction", amount: emp.loanThisMonth },
      ],
      comments: commentsFrom(emp, emp.unpaidLeaveDays, emp.paidLeaveDays),
      employeePf: b.pf,
      employerPf: b.pf,
      ...(useSalesLeadTemplate || useSalesTeamTemplate ? { projectCount: b.totalProjects } : {}),
    };
  }

  if (kind === "executive") {
    const sal = emptySalaryDetail(sub.salary ?? { basic: sub.amount });
    const ex = computeExecutiveSalary(sal, execProfitBase);
    const profile = profileFromSalary(sal);
    return {
      companyKey,
      monthLabel,
      employeeName: sub.label,
      ...profile,
      earnings: [
        { label: "BasicSalary", amount: ex.basic },
        { label: "MiscAllowance", amount: 0 },
        { label: "HomeAllowance", amount: 0 },
        { label: "Commission", amount: ex.commission, qty: `${ex.commissionPct}%` },
      ].filter(r => r.amount !== 0 || r.label === "BasicSalary"),
      deductions: [
        { label: "Income Tax", amount: 0 },
        { label: "Unpaid Leaves", amount: 0 },
        { label: "Late Arrival Deduction", amount: 0 },
        { label: "Employee PF Share", amount: 0 },
        { label: "Loan Deduction", amount: 0 },
      ],
      comments: commentsFrom(sal),
      employeePf: 0,
      employerPf: 0,
    };
  }

  const sal = emptySalaryDetail(sub.salary ?? { basic: sub.amount });
  const b = kind === "admin" ? computeAdminSalary(sal) : computeSalary(sal);
  const profile = profileFromSalary(sal);
  const home = Number(sal.homeAllowance) || 0;

  return {
    companyKey,
    monthLabel,
    employeeName: sub.label,
    ...profile,
    earnings: [
      { label: "BasicSalary", amount: sal.basic },
      { label: "MiscAllowance", amount: sal.allowance },
      { label: "HomeAllowance", amount: home },
      ...(b.totalOvertime > 0 ? [{ label: "Overtime", amount: b.totalOvertime }] : []),
    ],
    deductions: [
      { label: "Income Tax", amount: b.incomeTax },
      { label: "Unpaid Leaves", amount: b.unpaidLeaveDeduction },
      { label: "Late Arrival Deduction", amount: b.lateDeduction },
      { label: "Employee PF Share", amount: b.pf },
      { label: "Loan Deduction", amount: b.loanThisMonth },
    ],
    comments: commentsFrom(sal, sal.unpaidLeaveDays, sal.paidLeaveDays),
    employeePf: b.pf,
    employerPf: b.pf,
  };
}
