import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { attendanceNameMatch } from "./salaryAttendanceSync";

export type PaidLeavePublic = {
  id: string;
  personName: string;
  personKey: string;
  fromDay: string;
  toDay: string;
  month: string;
  status: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function eachDay(from: string, to: string): string[] {
  if (!DAY.test(from) || !DAY.test(to) || to < from) return [];
  const [year, month, day] = from.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const days: string[] = [];
  while (days.length < 40) {
    const ymd = cursor.toISOString().slice(0, 10);
    if (ymd > to) break;
    days.push(ymd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function plainName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function leaveDaysFor(name: string, rows: { personName: string; fromDay: string; toDay: string; status: string }[], month: string) {
  const days = new Set<string>();
  for (const row of rows) {
    if (row.status !== "approved") continue;
    if (plainName(row.personName) !== plainName(name) && !attendanceNameMatch(row.personName, name)) continue;
    for (const day of eachDay(row.fromDay, row.toDay)) {
      if (day.startsWith(month)) days.add(day);
    }
  }
  return days;
}

export async function listPaidLeaves(month: string): Promise<PaidLeavePublic[] | null> {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const rows = await prisma.paidLeave.findMany({
    where: { month },
    orderBy: [{ personName: "asc" }, { fromDay: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    personName: row.personName,
    personKey: row.personKey,
    fromDay: row.fromDay,
    toDay: row.toDay,
    month: row.month,
    status: row.status,
  }));
}

export async function addPaidLeave(input: {
  personName: string;
  personKey?: string;
  fromDay: string;
  toDay: string;
}): Promise<{ ok: true; leave: PaidLeavePublic } | { ok: false; message: string }> {
  const personName = input.personName.trim();
  const fromDay = input.fromDay.trim();
  const toDay = input.toDay.trim();
  if (!personName) return { ok: false, message: "Pick an employee." };
  if (!DAY.test(fromDay) || !DAY.test(toDay) || toDay < fromDay) {
    return { ok: false, message: "Pick a start and end date." };
  }
  if (fromDay.slice(0, 7) !== toDay.slice(0, 7)) {
    return { ok: false, message: "Keep one leave inside a single month. Add another leave for the next month." };
  }
  if (eachDay(fromDay, toDay).length > 31) return { ok: false, message: "That leave is too long." };
  const row = await prisma.paidLeave.create({
    data: {
      personName,
      personKey: input.personKey?.trim() || "",
      fromDay,
      toDay,
      month: fromDay.slice(0, 7),
      status: "pending",
    },
  });
  return {
    ok: true,
    leave: {
      id: row.id,
      personName: row.personName,
      personKey: row.personKey,
      fromDay: row.fromDay,
      toDay: row.toDay,
      month: row.month,
      status: row.status,
    },
  };
}

/** Approved paid leave, split by month so those days are not deducted. */
export async function grantApprovedPaidLeave(input: {
  personName: string;
  personKey?: string;
  fromDay: string;
  toDay: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const personName = input.personName.trim();
  const fromDay = input.fromDay.trim();
  const toDay = input.toDay.trim();
  if (!personName) return { ok: false, message: "Missing the employee name." };
  if (!DAY.test(fromDay) || !DAY.test(toDay) || toDay < fromDay) {
    return { ok: false, message: "Pick a start and end date." };
  }
  const days: string[] = [];
  const [year, month, day] = fromDay.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  while (days.length < 62) {
    const ymd = cursor.toISOString().slice(0, 10);
    if (ymd > toDay) break;
    days.push(ymd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!days.length || days[days.length - 1] !== toDay) {
    return { ok: false, message: "That leave is too long." };
  }
  const byMonth = new Map<string, string[]>();
  for (const ymd of days) {
    const key = ymd.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(ymd);
    byMonth.set(key, list);
  }
  for (const [leaveMonth, list] of byMonth) {
    await prisma.paidLeave.create({
      data: {
        personName,
        personKey: input.personKey?.trim() || "",
        fromDay: list[0]!,
        toDay: list[list.length - 1]!,
        month: leaveMonth,
        status: "approved",
      },
    });
    await stampPaidLeaveDates(leaveMonth, personName);
  }
  return { ok: true };
}

export async function reviewPaidLeave(id: string, status: "approved" | "declined") {
  const existing = await prisma.paidLeave.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.paidLeave.update({ where: { id }, data: { status } });
  await stampPaidLeaveDates(row.month, row.personName);
  return {
    id: row.id,
    personName: row.personName,
    personKey: row.personKey,
    fromDay: row.fromDay,
    toDay: row.toDay,
    month: row.month,
    status: row.status,
  };
}

type SalarySub = {
  label?: string;
  salary?: Record<string, unknown>;
  salesPayroll?: Record<string, unknown>;
};

/** Write the approved dates onto that person's salary row so accounts skips them. */
export async function stampPaidLeaveDates(month: string, personName: string) {
  const leaves = await prisma.paidLeave.findMany({ where: { month, status: "approved" } });
  const days = [...leaveDaysFor(personName, leaves, month)];
  const records = await monthStatements(month);
  for (const record of records) {
    const data = JSON.parse(JSON.stringify(record.data ?? {})) as Record<string, unknown>;
    const teams = (data.teamSalaries as { subHeads?: SalarySub[] }[] | undefined) ?? [];
    let changed = false;
    for (const team of teams) {
      for (const sub of team.subHeads ?? []) {
        if (plainName(String(sub.label ?? "")) !== plainName(personName)) continue;
        if (sub.salary) {
          sub.salary.paidLeaveDates = days;
          sub.salary.paidLeaveDays = days.length;
          changed = true;
        }
        if (sub.salesPayroll) {
          sub.salesPayroll.paidLeaveDates = days;
          sub.salesPayroll.paidLeaveDays = days.length;
          changed = true;
        }
      }
    }
    if (!changed) continue;
    await prisma.accountsRecord.update({
      where: { id: record.id },
      data: { data: data as Prisma.InputJsonValue },
    });
  }
}

export async function monthStatements(month: string) {
  return prisma.accountsRecord.findMany({
    where: {
      page: "income_statement",
      recordDate: { gte: `${month}-01`, lte: `${month}-31` },
    },
    orderBy: { recordDate: "desc" },
  });
}
