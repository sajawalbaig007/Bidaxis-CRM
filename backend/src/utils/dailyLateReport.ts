import prisma from "../config/db";
import { applyStaffPayrollToIncomeData } from "./loadStaffPayroll";
import { leaveDaysFor } from "./paidLeave";
import { attendanceNameMatch } from "./salaryAttendanceSync";
import { DEPT_ROSTER } from "./staffAttendance";
import {
  elapsedMonthDays,
  isPktWeekend,
  pktToday,
  perDayForPolicy,
  policyDeductionForDays,
  refreshLatePolicies,
  type AttendanceDay,
  type PayAmounts,
} from "./lateDeduction";
import { calcSalesLateDeduction } from "./salesPayrollFormula";
import type { SalesPayrollEmployee } from "./salesPayrollDefaults";
import { computeSalesEmployeePayroll } from "./salesPayrollFormula";

type SalarySub = {
  label?: string;
  amount?: number;
  salary?: Record<string, unknown>;
  salesPayroll?: SalesPayrollEmployee & { latePersonKey?: string };
};

type PersonCut = { name: string; department: string; perDay: number; day: number; month: number };

function policyDepartment(teamName: string, sales: boolean): string {
  if (sales) return "csr";
  const title = teamName.toLowerCase();
  if (title.includes("bim")) return "bim_modeler";
  if (title.includes("dev")) return "dev";
  if (title.includes("technical manager") || title.includes("chief")) return "chief_estimator";
  if (title.includes("technical")) return "estimator";
  if (title.includes("sales")) return "csr";
  if (title.includes("admin")) return "admin";
  if (title.includes("account")) return "accounts";
  if (title.includes("office")) return "office_boy";
  if (title === "hr" || title.includes("human resource")) return "hr";
  return "";
}

/** Sales shift starts at 6:00 PM. 6:05 and 6:06 are still on time; the cut starts after 6:15. */
function salesDeductionForDays(
  perDay: number,
  punches: AttendanceDay[] | undefined,
  dayList: string[],
  skip?: ReadonlySet<string>,
): number {
  const byDay = new Map((punches ?? []).filter((day) => day?.day).map((day) => [day.day, day]));
  let amount = 0;
  for (const day of dayList) {
    if (isPktWeekend(day) || skip?.has(day)) continue;
    const checkIn = String(byDay.get(day)?.checkIn ?? "").trim();
    if (!checkIn) continue;
    amount += calcSalesLateDeduction(perDay, checkIn).amount;
  }
  return amount;
}

function payAmounts(sub: SalarySub, recordDate: string): PayAmounts {
  const sal = sub.salary ?? {};
  const sp = sub.salesPayroll;
  const allowanceOf = (row: Record<string, unknown> | SalesPayrollEmployee) =>
    (Number(row.allowance) || 0)
    + (Number(row.homeAllowance) || 0)
    + (Number(row.fuelAllowance) || 0)
    + (Number(row.medicalAllowance) || 0)
    + (Number((row as Record<string, unknown>).travelAllowance) || 0);

  if (sp) {
    const payroll = computeSalesEmployeePayroll(
      { ...sp, name: sub.label || sp.name, lateDeductionOverride: null },
      0,
      { recordDate },
    );
    return {
      basic: Number(sp.basic) || 0,
      commission: Number(payroll.totalCommission) || 0,
      overtime: 0,
      allowance: allowanceOf(sp),
    };
  }

  const basic = Number(sal.basic) || 0;
  const allowance = allowanceOf(sal);
  const travel = Number(sal.travelAllowance) || 0;
  const monthly = basic + allowance + travel;
  const hour = monthly / 30 / 8;
  const overtime =
    (Number(sal.weekdayOtHours) || 0) * hour * 1.5
    + (Number(sal.weekendOtHours) || 0) * hour * 2;
  return { basic, commission: 0, overtime, allowance };
}

export async function dailyLateReport(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const month = date.slice(0, 7);
  const today = pktToday();
  await refreshLatePolicies();

  const saved = await prisma.accountsRecord.findMany({
    where: { page: "income_statement" },
    orderBy: { recordDate: "desc" },
    take: 36,
  });
  const record = saved.find((row) => row.recordDate.slice(0, 7) <= month) ?? saved[0];
  const raw = (record?.data as Record<string, unknown> | undefined) ?? {};
  const recordDate = `${month}-01`;
  const data = await applyStaffPayrollToIncomeData(raw, recordDate);
  const teams = (data.teamSalaries as { team?: string; subHeads?: SalarySub[] }[] | undefined) ?? [];
  const monthDays = elapsedMonthDays(month, today);
  const dayList = date <= today ? [date] : [];
  const approvedLeaves = await prisma.paidLeave.findMany({ where: { month, status: "approved" } });
  const byName = new Map<string, PersonCut>();

  for (const team of teams) {
    const teamName = String(team.team ?? "").replace(/\s*salaries\s*/i, "").trim();
    for (const sub of team.subHeads ?? []) {
      const name = String(sub.label ?? sub.salesPayroll?.name ?? "").trim();
      if (!name) continue;
      const sal = sub.salary ?? {};
      const salesKey = typeof sub.salesPayroll?.latePersonKey === "string" ? sub.salesPayroll.latePersonKey : "";
      const salaryDays = Array.isArray(sal.attendanceDays) ? sal.attendanceDays as AttendanceDay[] : undefined;
      const salesDays = Array.isArray(sub.salesPayroll?.attendanceDays) ? sub.salesPayroll.attendanceDays : undefined;
      const punches = (sub.salesPayroll ? (salesDays ?? salaryDays) : salaryDays) as AttendanceDay[] | undefined;
      const amounts = payAmounts(sub, record?.recordDate || recordDate);
      const department = policyDepartment(teamName, !!sub.salesPayroll);
      if (!department) {
        const prevEmpty = byName.get(name.toLowerCase());
        if (!prevEmpty) byName.set(name.toLowerCase(), { name, department: teamName || "—", perDay: 0, day: 0, month: 0 });
        continue;
      }
      const person = {
        personKey: (typeof sal.latePersonKey === "string" && sal.latePersonKey) || salesKey,
        personName: name,
      };
      const skip = leaveDaysFor(name, approvedLeaves, month, person.personKey);
      const perDay = perDayForPolicy(department, month, amounts, person) ?? 0;
      const sales = !!sub.salesPayroll;
      const dayCut = sales
        ? salesDeductionForDays(perDay, punches, dayList, skip)
        : policyDeductionForDays(department, month, amounts, punches ?? [], dayList, person, skip) ?? 0;
      const monthCut = sales
        ? salesDeductionForDays(perDay, punches, monthDays, skip)
        : policyDeductionForDays(department, month, amounts, punches ?? [], monthDays, person, skip) ?? 0;
      const prev = byName.get(name.toLowerCase());
      if (prev && prev.month >= monthCut && prev.day >= dayCut) continue;
      byName.set(name.toLowerCase(), { name, department: teamName || department, perDay, day: dayCut, month: monthCut });
    }
  }

  const alreadyListed = (name: string) =>
    [...byName.keys()].some((key) => key === name.toLowerCase() || attendanceNameMatch(key, name));
  const missing = Object.entries(DEPT_ROSTER).flatMap(([department, roster]) =>
    roster
      .filter((person) => !alreadyListed(person.name))
      .map((person) => ({ ...person, department })),
  );
  if (missing.length) {
    const staff = await prisma.staffDayAttendance.findMany({
      where: {
        personKey: { in: missing.map((person) => person.key) },
        day: { gte: `${month}-01`, lte: `${month}-31` },
      },
    });
    const rosterTitle: Record<string, string> = {
      dev: "Dev",
      office_boy: "Office Boy",
      hr: "HR",
      bim_modeler: "BIM Modeler",
    };
    for (const person of missing) {
      const punches: AttendanceDay[] = staff
        .filter((row) => row.personKey === person.key)
        .map((row) => ({ day: row.day, checkIn: row.checkIn ?? "", checkOut: row.checkOut ?? "" }));
      const onAdministration = person.department === "office_boy" || person.department === "hr";
      const policyDept = onAdministration ? "admin" : person.department;
      const amounts = { basic: 0, commission: 0, overtime: 0, allowance: 0 };
      const personRef = { personKey: person.key, personName: person.name };
      const skip = leaveDaysFor(person.name, approvedLeaves, month, person.key);
      const perDay = perDayForPolicy(policyDept, month, amounts, personRef) ?? 0;
      const dayCut = policyDeductionForDays(policyDept, month, amounts, punches, dayList, personRef, skip) ?? 0;
      const monthCut = policyDeductionForDays(policyDept, month, amounts, punches, monthDays, personRef, skip) ?? 0;
      byName.set(person.name.toLowerCase(), {
        name: person.name,
        department: onAdministration ? "Administration" : (rosterTitle[person.department] ?? person.department),
        perDay,
        day: dayCut,
        month: monthCut,
      });
    }
  }

  const people = [...byName.values()].sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  return {
    date,
    month,
    through: monthDays[monthDays.length - 1] ?? `${month}-01`,
    people,
  };
}
