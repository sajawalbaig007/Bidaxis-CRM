import prisma from "../config/db";
import { applyStaffPayrollToIncomeData } from "./loadStaffPayroll";
import { leaveDaysFor } from "./paidLeave";
import { attendanceNameMatch, punchNameMatch } from "./salaryAttendanceSync";
import { addCalendarDays, DEPT_ROSTER } from "./staffAttendance";
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

type PersonCut = { name: string; department: string; perDay: number; day: number; month: number; range: number; personKey: string };

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

function expandRange(from: string, to: string, today: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  let start = from;
  let end = to;
  if (start > end) [start, end] = [end, start];
  if (end > today) end = today;
  if (start > end) return [];
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 370) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function addRange(primary: PersonCut[], extra: PersonCut[]) {
  for (const row of extra) {
    if (!row.range) continue;
    const exact = primary.find((person) => person.name.toLowerCase() === row.name.toLowerCase());
    if (exact) {
      exact.range += row.range;
      continue;
    }
    const fuzzy = primary.filter((person) => attendanceNameMatch(person.name, row.name) || attendanceNameMatch(row.name, person.name));
    if (fuzzy.length === 1) fuzzy[0].range += row.range;
  }
}

async function peopleForMonth(month: string, dayList: string[], monthDays: string[], rangeDays: string[]) {
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
        if (!prevEmpty) byName.set(name.toLowerCase(), { name, department: teamName || "—", perDay: 0, day: 0, month: 0, range: 0, personKey: "" });
        continue;
      }
      const person = {
        personKey: (typeof sal.latePersonKey === "string" && sal.latePersonKey) || salesKey,
        personName: name,
      };
      const skip = leaveDaysFor(name, approvedLeaves, month, person.personKey);
      const perDay = perDayForPolicy(department, month, amounts, person) ?? 0;
      const sales = !!sub.salesPayroll;
      const cutFor = (days: string[]) => sales
        ? salesDeductionForDays(perDay, punches, days, skip)
        : policyDeductionForDays(department, month, amounts, punches ?? [], days, person, skip) ?? 0;
      const dayCut = cutFor(dayList);
      const monthCut = cutFor(monthDays);
      const rangeCut = cutFor(rangeDays);
      const prev = byName.get(name.toLowerCase());
      if (prev && prev.month >= monthCut && prev.day >= dayCut) {
        if (rangeCut > prev.range) prev.range = rangeCut;
        if (!prev.personKey && person.personKey) prev.personKey = person.personKey;
        continue;
      }
      byName.set(name.toLowerCase(), { name, department: teamName || department, perDay, day: dayCut, month: monthCut, range: rangeCut, personKey: person.personKey });
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
      const cutFor = (days: string[]) => policyDeductionForDays(policyDept, month, amounts, punches, days, personRef, skip) ?? 0;
      byName.set(person.name.toLowerCase(), {
        name: person.name,
        department: onAdministration ? "Administration" : (rosterTitle[person.department] ?? person.department),
        perDay,
        day: cutFor(dayList),
        month: cutFor(monthDays),
        range: cutFor(rangeDays),
        personKey: person.key,
      });
    }
  }

  return [...byName.values()].sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
}

export async function dailyLateReport(date: string, rangeFrom = "", rangeTo = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const month = date.slice(0, 7);
  const today = pktToday();
  await refreshLatePolicies();
  const monthDays = elapsedMonthDays(month, today);
  const dayList = date <= today ? [date] : [];
  const rangeDays = expandRange(rangeFrom, rangeTo, today);
  const people = await peopleForMonth(month, dayList, monthDays, rangeDays.filter((day) => day.startsWith(`${month}-`)));
  const otherMonths = [...new Set(rangeDays.map((day) => day.slice(0, 7)))].filter((item) => item !== month);
  for (const other of otherMonths) {
    const extra = await peopleForMonth(other, [], [], rangeDays.filter((day) => day.startsWith(`${other}-`)));
    addRange(people, extra);
  }
  return {
    date,
    month,
    through: monthDays[monthDays.length - 1] ?? `${month}-01`,
    rangeFrom: rangeDays[0] ?? "",
    rangeTo: rangeDays[rangeDays.length - 1] ?? "",
    people,
  };
}

/** Same current-day and month-so-far cut the CEO late deduction table shows for this person. */
export async function lateDeductionSummary(personKey: string, personName = "") {
  try {
    const today = pktToday();
    let name = personName.trim();
    if (!name && personKey) {
      const user = await prisma.user.findUnique({ where: { id: personKey }, select: { name: true } });
      name = user?.name?.trim() ?? "";
    }
    const report = await dailyLateReport(today);
    if (!report) return null;
    const key = personKey.trim();
    const byKey = key ? report.people.find((person) => person.personKey === key) : undefined;
    const exact = name ? report.people.find((person) => person.name.toLowerCase() === name.toLowerCase()) : undefined;
    const fuzzy = name ? report.people.filter((person) => punchNameMatch(person.name, name)) : [];
    const hit = byKey ?? exact ?? (fuzzy.length === 1 ? fuzzy[0] : undefined);
    return {
      day: hit?.day ?? 0,
      month: hit?.month ?? 0,
      date: report.date,
      through: report.through,
    };
  } catch (error) {
    console.error("[late-deduction-summary]", error);
    return null;
  }
}
