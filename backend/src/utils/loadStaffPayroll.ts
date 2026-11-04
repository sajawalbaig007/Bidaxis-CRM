import prisma from "../config/db";
import {
  isAccountsPayrollHead,
  mergeStaffPayrollIntoIncomeStatement,
  staffPayrollSubId,
  type StaffPayrollPerson,
} from "./staffPayrollSync";
import { applyAttendanceCheckIns } from "./salaryAttendanceSync";
import { overtimeNoteMinutes } from "./overtimeRequest";

const BIM_HEAD = "BIM Modeler Salaries";
const DEV_HEAD = "Dev Salaries";

function forcedPayrollHead(name: string): string | null {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const ahmad = tokens.includes("ahmad") || tokens.includes("ahmed");
  if (ahmad && (tokens.includes("nadeem") || tokens.includes("naseem"))) return BIM_HEAD;
  const first = tokens[0] ?? "";
  if (first === "ahmer" || first === "sajawal") return DEV_HEAD;
  return null;
}

/** Load assigned staff employees (profile from User when linked). */
export async function loadStaffPayrollPeople(): Promise<StaffPayrollPerson[]> {
  const rows = await prisma.staffEmployee.findMany();
  const assigned = rows.filter(r => !!r.payrollHead && !!r.payrollStartMonth);
  const userIds = assigned.map(r => r.userId).filter((id): id is string => !!id);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            employeeCode: true,
            currentAddress: true,
            contactNo: true,
            cnic: true,
          },
        })
      : [];
  const byId = new Map(users.map(u => [u.id, u]));

  const out: StaffPayrollPerson[] = [];
  for (const r of assigned) {
    if (!isAccountsPayrollHead(r.payrollHead) || !r.payrollStartMonth) continue;
    const u = r.userId ? byId.get(r.userId) : null;
    const name = (u?.name || r.name || "").trim();
    if (!name) continue;
    const forced = forcedPayrollHead(name);
    const payrollHead = forced ?? r.payrollHead;
    if (forced && forced !== r.payrollHead) {
      await prisma.staffEmployee.update({ where: { id: r.id }, data: { payrollHead: forced } });
    }
    out.push({
      id: r.id,
      name,
      employeeCode: u?.employeeCode ?? r.employeeCode ?? null,
      currentAddress: u?.currentAddress ?? r.currentAddress ?? null,
      contactNo: u?.contactNo ?? r.contactNo ?? null,
      cnic: u?.cnic ?? r.cnic ?? null,
      payrollHead,
      payrollStartMonth: r.payrollStartMonth,
      payrollStartDate: r.payrollStartDate ?? null,
      payrollEndDate: r.payrollEndDate ?? null,
      userId: r.userId ?? null,
    });
  }
  return out;
}

/** Approved Start/Stop overtime fills payroll OT hours from this month on. Earlier months keep their typed hours. */
const OVERTIME_PAYROLL_FROM = "2026-11";

function isWeekendDay(day: string): boolean {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/**
 * Approved estimator / Chief Estimator overtime → Weekday OT and Weekend OT hours
 * on that person's salary row for the month. Only people with approved overtime that month change.
 */
async function applyApprovedOvertimeHours(
  data: Record<string, unknown>,
  recordDate: string,
  people: StaffPayrollPerson[],
): Promise<Record<string, unknown>> {
  const month = String(recordDate || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month) || month < OVERTIME_PAYROLL_FROM) return data;
  const userByStaff = new Map(people.filter(p => p.userId).map(p => [staffPayrollSubId(p.id), p.userId as string]));
  if (!userByStaff.size) return data;
  /* Someone who took over an account mid-month only gets overtime from their first day. */
  const startByUser = new Map(people.filter(p => p.userId && p.payrollStartDate).map(p => [p.userId as string, p.payrollStartDate as string]));

  const approved = await prisma.overtimeRequest.findMany({
    where: {
      status: "approved",
      department: { in: ["estimator", "chief_estimator"] },
      personKey: { in: [...new Set(userByStaff.values())] },
      day: { gte: `${month}-01`, lte: `${month}-31` },
    },
    select: { personKey: true, day: true, comment: true },
  });
  if (!approved.length) return data;
  const hours = new Map<string, { weekday: number; weekend: number }>();
  for (const note of approved) {
    const minutes = overtimeNoteMinutes(note.comment);
    if (!minutes) continue;
    const firstDay = startByUser.get(note.personKey);
    if (firstDay && note.day < firstDay) continue;
    const sum = hours.get(note.personKey) ?? { weekday: 0, weekend: 0 };
    if (isWeekendDay(note.day)) sum.weekend += minutes;
    else sum.weekday += minutes;
    hours.set(note.personKey, sum);
  }

  const round = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
  let changed = false;
  const teams = ((data.teamSalaries as Record<string, unknown>[] | undefined) ?? []).map(team => {
    const subs = (team.subHeads as Record<string, unknown>[] | undefined) ?? [];
    const next = subs.map(sub => {
      const userId = userByStaff.get(String(sub.id ?? ""));
      const sum = userId ? hours.get(userId) : undefined;
      const salary = sub.salary as Record<string, unknown> | undefined;
      if (!sum || !salary) return sub;
      const weekdayOtHours = round(sum.weekday);
      const weekendOtHours = round(sum.weekend);
      if (salary.weekdayOtHours === weekdayOtHours && salary.weekendOtHours === weekendOtHours) return sub;
      changed = true;
      return { ...sub, salary: { ...salary, weekdayOtHours, weekendOtHours } };
    });
    return { ...team, subHeads: next };
  });
  return changed ? { ...data, teamSalaries: teams } : data;
}

export async function applyStaffPayrollToIncomeData(
  data: Record<string, unknown>,
  recordDate: string,
): Promise<Record<string, unknown>> {
  try {
    const people = await loadStaffPayrollPeople();
    if (!people.length) {
      const pruned = mergeStaffPayrollIntoIncomeStatement(data, recordDate, []);
      return applyAttendanceCheckIns(pruned, recordDate);
    }
    const merged = mergeStaffPayrollIntoIncomeStatement(data, recordDate, people);
    const withOvertime = await applyApprovedOvertimeHours(merged, recordDate, people);
    return applyAttendanceCheckIns(withOvertime, recordDate);
  } catch (err) {
    console.error("[staffPayroll] merge failed", err);
    return data;
  }
}
