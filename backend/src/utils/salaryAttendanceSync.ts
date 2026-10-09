import type { Role } from "@prisma/client";
import prisma from "../config/db";
import { SEED_USER_EMAILS } from "../constants/seedUsers";
import type { AttendanceDay } from "./lateDeduction";
import { addCalendarDays, attendanceShift, DEPT_ROSTER, pktNow, pktShiftDay } from "./staffAttendance";

function attendanceTokens(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token !== "mr" && token !== "mrs" && token !== "ms");
}

function attendanceSame(a: string, b: string): boolean {
  const left = attendanceTokens(a);
  const right = attendanceTokens(b);
  if (!left.length || !right.length) return false;
  if (left.join(" ") === right.join(" ")) return true;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return short.every((token, index) => long[index] === token);
}

export function attendanceNameMatch(a: string, b: string): boolean {
  return attendanceSame(a, b);
}

/** "Saad Nadeem" matches "Muhammad Saad Nadeem". A single word still has to line up from the start, so Ismail does not match Muhammad Ismail. */
export function punchNameMatch(label: string, personName: string): boolean {
  if (attendanceNameMatch(label, personName)) return true;
  const left = attendanceTokens(label);
  const right = attendanceTokens(personName);
  if (left.length < 2 || right.length < 2) return false;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  for (let index = 0; index <= long.length - short.length; index++) {
    if (short.every((token, offset) => long[index + offset] === token)) return true;
  }
  return false;
}

function samePerson(label: string, people: PersonRef[]): PersonRef[] {
  const exact = people.filter((item) => attendanceTokens(item.personName).join(" ") === attendanceTokens(label).join(" "));
  if (exact.length) {
    const extras = people.filter((item) => {
      if (exact.includes(item)) return false;
      const tokens = attendanceTokens(item.personName);
      const labelTokens = attendanceTokens(label);
      return tokens.length < labelTokens.length && tokens.every((token, index) => labelTokens[index] === token);
    });
    return [...exact, ...extras];
  }
  const prefix = people.filter((item) => attendanceSame(item.personName, label));
  if (!prefix.length) return [];
  const longest = Math.max(...prefix.map((item) => attendanceTokens(item.personName).length));
  return prefix.filter((item) => attendanceTokens(item.personName).length === longest);
}

type SalarySub = {
  label?: string;
  amount?: number;
  salary?: Record<string, unknown>;
  salesPayroll?: Record<string, unknown>;
  [key: string]: unknown;
};

type SalaryTeam = {
  team?: string;
  subHeads?: SalarySub[];
  [key: string]: unknown;
};

type PersonRef = { personKey: string; personName: string; department: string };

const ROSTER_KEYS = new Set<string>(Object.values(DEPT_ROSTER).flatMap((rows) => rows.map((row) => row.key)));

const ROLE_DEPARTMENT: Partial<Record<Role, string>> = {
  csr: "csr",
  estimator: "estimator",
  technical_manager: "chief_estimator",
  manager: "admin",
  accounts: "accounts",
  bim: "bim",
  bim_manager: "bim_manager",
};

function monthOf(recordDate: string): string {
  return /^\d{4}-\d{2}/.test(recordDate) ? recordDate.slice(0, 7) : "";
}

/**
 * Salary-table department used when this person has no individual ranges.
 * Administration salaries use Administration. An individual row, such as Khalil’s Office Boy time, still wins.
 */
function salaryLateDepartment(teamName: string, attendanceDepartment: string): string | null {
  if (teamName.toLowerCase().includes("admin")) return "admin";
  return lateDepartmentFor(attendanceDepartment);
}

/** Each attendance department uses the time ranges saved on that department. */
function lateDepartmentFor(department: string): string | null {
  if (department === "admin") return "admin";
  if (department === "dev") return "dev";
  if (
    department === "accounts"
    || department === "hr"
    || department === "office_boy"
    || department === "bim_modeler"
    || department === "estimator"
    || department === "chief_estimator"
    || department === "csr"
  ) {
    return department;
  }
  return null;
}

function minutesOf(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Evening shifts: 18:06 is the first punch and 06:05 the next morning, not an earlier check-in. */
function earlierInShift(left: string, right: string, shiftStart: string): boolean {
  const a = minutesOf(left);
  const b = minutesOf(right);
  const start = minutesOf(shiftStart) ?? 0;
  if (a == null) return false;
  if (b == null) return true;
  const rank = (time: number) => (time >= start ? time : time + 24 * 60);
  return rank(a) < rank(b);
}

function mergeDay(prev: AttendanceDay | undefined, next: AttendanceDay, shiftStart: string | null = null): AttendanceDay {
  if (!prev) return next;
  const checkIns = [prev.checkIn, next.checkIn].map((value) => String(value ?? "").trim()).filter(Boolean);
  const checkOuts = [prev.checkOut, next.checkOut].map((value) => String(value ?? "").trim()).filter(Boolean);
  const first = (values: string[], latest: boolean) => {
    return values.reduce((chosen, value) => {
      const before = shiftStart ? earlierInShift(value, chosen, shiftStart) : value < chosen;
      return latest ? (before ? chosen : value) : (before ? value : chosen);
    });
  };
  return {
    day: next.day,
    checkIn: checkIns.length ? first(checkIns, false) : "",
    checkOut: checkOuts.length ? first(checkOuts, true) : "",
  };
}

function shiftStartFor(department: string, personKey = ""): string | null {
  const window = attendanceShift(department, personKey);
  return window.overnight ? window.start : null;
}

type ApprovedPunch = { personKey: string; personName: string; day: string; checkIn: string; checkOut: string };

function clock(value: string | null | undefined): string {
  const match = String(value ?? "").match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? "";
}

function daysEqual(left: unknown, right: AttendanceDay[]): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right);
}

/**
 * Copy this month's check-in days onto each matching salary row.
 * A day with no punch is left off the list. Only a late check-in deducts a percent of that day’s pay.
 */
export async function applyAttendanceCheckIns(
  data: Record<string, unknown>,
  recordDate: string,
): Promise<Record<string, unknown>> {
  const month = monthOf(recordDate);
  const teams = (data.teamSalaries as SalaryTeam[] | undefined) ?? [];
  if (!month || !teams.length) return data;

  const people: PersonRef[] = [];
  for (const [department, roster] of Object.entries(DEPT_ROSTER)) {
    for (const person of roster) {
      people.push({ personKey: person.key, personName: person.name, department });
    }
  }
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { notIn: SEED_USER_EMAILS },
      role: { in: Object.keys(ROLE_DEPARTMENT) as Role[] },
    },
    select: { id: true, name: true, role: true },
  });
  for (const user of users) {
    const department = ROLE_DEPARTMENT[user.role];
    if (!department) continue;
    people.push({ personKey: user.id, personName: user.name, department });
  }

  const byPerson = new Map<string, Map<string, AttendanceDay>>();
  const addDay = (personKey: string, day: AttendanceDay, department = "") => {
    if (!byPerson.has(personKey)) byPerson.set(personKey, new Map());
    const days = byPerson.get(personKey)!;
    days.set(day.day, mergeDay(days.get(day.day), day, department ? shiftStartFor(department, personKey) : null));
  };

  const staff = await prisma.staffDayAttendance.findMany({
    where: { day: { gte: `${month}-01`, lte: `${month}-31` } },
  });
  for (const row of staff) {
    if (!people.some((person) => person.personKey === row.personKey)) {
      people.push({ personKey: row.personKey, personName: row.personName, department: row.department });
    }
    addDay(row.personKey, {
      day: row.day,
      checkIn: row.checkIn ?? "",
      checkOut: row.checkOut ?? "",
    }, row.department);
  }

  const monthStart = new Date(`${month}-01T00:00:00+05:00`);
  const nextMonth = `${addCalendarDays(`${month}-28`, 7).slice(0, 7)}-01`;
  const sessions = await prisma.csrWorkSession.findMany({
    where: {
      loginAt: {
        gte: new Date(monthStart.getTime() - 36 * 60 * 60 * 1000),
        lt: new Date(`${nextMonth}T00:00:00+05:00`),
      },
      user: { email: { notIn: SEED_USER_EMAILS } },
    },
    select: { userId: true, loginAt: true, logoutAt: true, user: { select: { role: true } } },
  });
  for (const session of sessions) {
    const department = ROLE_DEPARTMENT[session.user.role] ?? "csr";
    const day = pktShiftDay(session.loginAt, department, session.userId);
    if (!day.startsWith(month)) continue;
    addDay(session.userId, {
      day,
      checkIn: pktNow(session.loginAt).time,
      checkOut: session.logoutAt ? pktNow(session.logoutAt).time : "",
    }, department);
  }

  const approved = await prisma.staffRequest.findMany({
    where: {
      kind: "attendance_correction",
      status: "approved",
      day: { gte: `${month}-01`, lte: `${month}-31` },
    },
    orderBy: { updatedAt: "asc" },
    select: { personKey: true, personName: true, department: true, day: true, checkIn: true, checkOut: true },
  });
  const corrections: ApprovedPunch[] = [];
  for (const request of approved) {
    const checkIn = clock(request.checkIn);
    if (!checkIn) continue;
    corrections.push({
      personKey: request.personKey,
      personName: request.personName,
      day: request.day,
      checkIn,
      checkOut: clock(request.checkOut),
    });
    if (!people.some((person) => person.personKey === request.personKey)) {
      people.push({
        personKey: request.personKey,
        personName: request.personName,
        department: request.department || "",
      });
    }
    const days = byPerson.get(request.personKey) ?? new Map<string, AttendanceDay>();
    days.set(request.day, { day: request.day, checkIn, checkOut: clock(request.checkOut) });
    byPerson.set(request.personKey, days);
  }

  let changed = false;
  const nextTeams = teams.map((team) => {
    const subs = (team.subHeads ?? []).map((sub) => {
      const label = String(sub.label || sub.salesPayroll?.name || "").trim();
      const matches = samePerson(label, people);
      const person = matches.find((item) => ROSTER_KEYS.has(item.personKey)) ?? matches[0];
      const storedKey = String(sub.salary?.latePersonKey ?? sub.salesPayroll?.latePersonKey ?? "");
      const daysMap = new Map<string, AttendanceDay>();
      const storedDays = (Array.isArray(sub.salesPayroll?.attendanceDays) ? sub.salesPayroll?.attendanceDays : sub.salary?.attendanceDays) as AttendanceDay[] | undefined;
      for (const day of storedDays ?? []) {
        if (!day?.day) continue;
        daysMap.set(day.day, { day: day.day, checkIn: String(day.checkIn ?? ""), checkOut: String(day.checkOut ?? "") });
      }
      if (person) {
        for (const match of matches) {
          for (const day of byPerson.get(match.personKey)?.values() ?? []) {
            const prev = daysMap.get(day.day);
            daysMap.set(day.day, prev ? mergeDay(prev, day, shiftStartFor(match.department, match.personKey)) : day);
          }
        }
      }
      const linkedKeys = [...new Set([person?.personKey, storedKey, ...matches.map((item) => item.personKey)].filter(Boolean))] as string[];
      let correctionKey = "";
      for (const punch of corrections) {
        const linked = !!punch.personKey && linkedKeys.includes(punch.personKey);
        const named = punchNameMatch(label, punch.personName);
        if (!linked && !named) continue;
        daysMap.set(punch.day, { day: punch.day, checkIn: punch.checkIn, checkOut: punch.checkOut });
        if (!correctionKey && punch.personKey) correctionKey = punch.personKey;
      }
      if (!person && !daysMap.size) return sub;
      const days = [...daysMap.values()].sort((a, b) => a.day.localeCompare(b.day));
      const personKey = person?.personKey || storedKey || correctionKey;
      const lateDepartment = person
        ? salaryLateDepartment(String(team.team ?? ""), person.department)
        : (typeof sub.salary?.lateDepartment === "string" ? sub.salary.lateDepartment : null);
      const latest = [...days].reverse().find((day) => day.checkIn);
      let next = sub;

      if (sub.salary) {
        const prev = sub.salary;
        const same = daysEqual(prev.attendanceDays, days)
          && prev.payMonth === month
          && prev.latePersonKey === personKey
          && (!lateDepartment || prev.lateDepartment === lateDepartment)
          && (!latest || prev.checkIn === latest.checkIn);
        if (!same) {
          changed = true;
          next = {
            ...next,
            salary: {
              ...prev,
              payMonth: month,
              attendanceDays: days,
              latePersonKey: personKey,
              ...(lateDepartment ? { lateDepartment } : {}),
              ...(latest ? { checkIn: latest.checkIn } : {}),
            },
          };
        }
      }

      if (sub.salesPayroll) {
        const prev = sub.salesPayroll;
        const same = daysEqual(prev.attendanceDays, days) && prev.payMonth === month;
        if (!same) {
          changed = true;
          next = {
            ...next,
            salesPayroll: {
              ...prev,
              payMonth: month,
              attendanceDays: days,
            },
          };
        }
      }

      return next;
    });
    return { ...team, subHeads: subs };
  });

  return changed ? { ...data, teamSalaries: nextTeams } : data;
}
