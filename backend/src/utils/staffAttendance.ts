import { Request } from "express";
import prisma from "../config/db";
import { getAdminAllowedIps } from "../config/env";
import { getClientIp } from "./requestMeta";

export const ATTENDANCE_REVISE_TOKEN = "r7k2m9qx4p8w3n6";
export const CHIEF_ESTIMATOR_NAME = "Ayesha Ashraf";

export const DEPT_ROSTER = {
  dev: [
    { key: "ahmer-shah", name: "Ahmer Shah" },
    { key: "sajawal", name: "Sajawal" },
  ],
  office_boy: [
    { key: "khalil", name: "Khalil" },
    { key: "ismail", name: "Ismail" },
  ],
  hr: [
    { key: "mahnoor-imran", name: "Mahnoor Imran" },
  ],
} as const;

export type RosterDept = keyof typeof DEPT_ROSTER;
export type AttendanceDept = RosterDept | "chief_estimator" | "admin" | "accounts";

const IP_GATED: AttendanceDept[] = ["office_boy", "hr"];

export function pktNow(d = new Date()): { day: string; time: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day);
}

export function isValidTime(time: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export function timeOrderOk(checkIn: string | null | undefined, checkOut: string | null | undefined): boolean {
  if (!checkIn || !checkOut) return true;
  return checkOut > checkIn;
}

let officeIpCache: { at: number; ips: string[] } | null = null;

/** Company network: ADMIN_ALLOWED_IPS plus every active CSR in-house IP. */
export async function getOfficeAllowedIps(): Promise<string[]> {
  const now = Date.now();
  if (officeIpCache && now - officeIpCache.at < 60_000) return officeIpCache.ips;
  const fromEnv = getAdminAllowedIps();
  const csrs = await prisma.user.findMany({
    where: { role: "csr", isActive: true },
    select: { allowedIps: true },
  });
  const set = new Set<string>(fromEnv);
  for (const row of csrs) {
    for (const ip of row.allowedIps ?? []) {
      const cleaned = ip.trim();
      if (cleaned) set.add(cleaned);
    }
  }
  const ips = [...set];
  officeIpCache = { at: now, ips };
  return ips;
}

export async function officeNetworkMessage(req: Request): Promise<string | null> {
  const allowed = await getOfficeAllowedIps();
  if (allowed.length === 0) return null;
  const ip = getClientIp(req);
  if (allowed.includes(ip)) return null;
  return "This account is restricted to the company network.";
}

export function departmentNeedsOfficeIp(department: string): boolean {
  return IP_GATED.includes(department as AttendanceDept);
}

export function rosterPerson(department: RosterDept, personKey: string) {
  return DEPT_ROSTER[department].find((p) => p.key === personKey) ?? null;
}

export function publicRoster() {
  return {
    dev: { title: "Dev", people: DEPT_ROSTER.dev, officeOnly: false },
    office_boy: { title: "Office Boy", people: DEPT_ROSTER.office_boy, officeOnly: true },
    hr: { title: "HR", people: DEPT_ROSTER.hr, officeOnly: true },
  };
}

type SaveInput = {
  personKey: string;
  personName: string;
  department: AttendanceDept;
  day: string;
  checkIn?: string | null;
  checkOut?: string | null;
  userId?: string | null;
};

export async function saveAttendance(input: SaveInput) {
  const existing = await prisma.staffDayAttendance.findUnique({
    where: { personKey_day: { personKey: input.personKey, day: input.day } },
  });
  const checkIn = input.checkIn === undefined ? existing?.checkIn ?? null : input.checkIn;
  const checkOut = input.checkOut === undefined ? existing?.checkOut ?? null : input.checkOut;
  if (!timeOrderOk(checkIn, checkOut)) {
    return { ok: false as const, message: "Check-out must be after check-in." };
  }
  const row = existing
    ? await prisma.staffDayAttendance.update({
        where: { id: existing.id },
        data: {
          personName: input.personName,
          department: input.department,
          checkIn,
          checkOut,
          ...(input.userId ? { userId: input.userId } : {}),
        },
      })
    : await prisma.staffDayAttendance.create({
        data: {
          personKey: input.personKey,
          personName: input.personName,
          department: input.department,
          day: input.day,
          checkIn,
          checkOut,
          userId: input.userId ?? null,
        },
      });
  return { ok: true as const, row: toPublic(row) };
}

export function toPublic(row: {
  id: string;
  personKey: string;
  personName: string;
  department: string;
  day: string;
  checkIn: string | null;
  checkOut: string | null;
}) {
  return {
    id: row.id,
    personKey: row.personKey,
    personName: row.personName,
    department: row.department,
    day: row.day,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
  };
}
