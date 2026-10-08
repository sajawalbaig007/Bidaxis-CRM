import prisma from "../config/db";
import { ceoSetPortalShiftDay } from "./csrSessionTracking";
import { grantApprovedPaidLeave } from "./paidLeave";
import {
  AttendanceDept,
  isValidDay,
  isValidTime,
  saveAttendance,
} from "./staffAttendance";

export const REQUEST_KINDS = [
  "attendance_correction",
  "leave",
  "reimbursement",
  "wfh",
  "asset",
  "custom",
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number];

const LABELS: Record<RequestKind, string> = {
  attendance_correction: "Attendance Correction",
  leave: "Leave Request",
  reimbursement: "Reimbursement",
  wfh: "Work From Home",
  asset: "Asset Issue",
  custom: "Custom Request",
};

export function isRequestKind(value: string): value is RequestKind {
  return (REQUEST_KINDS as readonly string[]).includes(value);
}

function clock12(time: string | null | undefined): string {
  if (!time) return "";
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

function clip(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

export type RequestDraft = {
  kind: RequestKind;
  day: string;
  summary: string;
  detail: string;
  checkIn: string | null;
  checkOut: string | null;
};

export function parseRequestDraft(body: Record<string, unknown>): { ok: true; draft: RequestDraft } | { ok: false; message: string } {
  const kind = String(body.kind ?? "");
  if (!isRequestKind(kind)) return { ok: false, message: "Choose a request type." };
  const day = String(body.day ?? "").trim();
  if (!isValidDay(day)) return { ok: false, message: "Choose a date." };
  const detail = clip(body.detail);
  const title = clip(body.title, 120);
  const amount = clip(body.amount, 40);
  const endDay = String(body.endDay ?? "").trim();
  const checkIn = clip(body.checkIn, 5) || null;
  const checkOut = clip(body.checkOut, 5) || null;

  if (kind === "attendance_correction") {
    if (!checkIn || !isValidTime(checkIn)) return { ok: false, message: "Enter a check-in time." };
    if (checkOut && !isValidTime(checkOut)) return { ok: false, message: "Enter a valid check-out time." };
    const out = checkOut ? clock12(checkOut) : "still in";
    return {
      ok: true,
      draft: {
        kind,
        day,
        summary: `${day} · In ${clock12(checkIn)} · Out ${out}`,
        detail,
        checkIn,
        checkOut,
      },
    };
  }

  if (kind === "leave" || kind === "wfh") {
    if (!detail) return { ok: false, message: "Add a short reason." };
    const end = isValidDay(endDay) && endDay !== day ? ` – ${endDay}` : "";
    return { ok: true, draft: { kind, day, summary: `${day}${end}`, detail, checkIn: null, checkOut: null } };
  }

  if (kind === "reimbursement") {
    if (!amount) return { ok: false, message: "Enter an amount." };
    return {
      ok: true,
      draft: { kind, day, summary: `${amount} · ${day}`, detail, checkIn: null, checkOut: null },
    };
  }

  const summary = title || detail;
  if (!summary) return { ok: false, message: "Describe the request." };
  return {
    ok: true,
    draft: { kind, day, summary: summary.slice(0, 120), detail: title && detail ? detail : detail, checkIn: null, checkOut: null },
  };
}

export function toPublicRequest(row: {
  id: string;
  personKey: string;
  personName: string;
  department: string;
  kind: string;
  day: string;
  summary: string;
  detail: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  reviewedBy: string | null;
  reviewNote?: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    personKey: row.personKey,
    personName: row.personName,
    department: row.department,
    kind: row.kind,
    kindLabel: LABELS[row.kind as RequestKind] ?? row.kind,
    day: row.day,
    summary: row.summary,
    detail: row.detail,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    status: row.status,
    reviewedBy: row.reviewedBy,
    reviewNote: row.reviewNote ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

function pktMonthKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function shiftMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const next = new Date(Date.UTC(year, (month || 1) - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, (month || 1) - 1, 1)),
  );
}

/** This month and the previous month, for the person who sent the request. */
export async function listRequestHistory(personKey: string) {
  const current = pktMonthKey();
  const previous = shiftMonth(current, -1);
  const from = `${previous}-01`;
  const to = `${current}-31`;
  const rows = await prisma.staffRequest.findMany({
    where: {
      personKey,
      OR: [
        { day: { gte: from, lte: to } },
        { createdAt: { gte: new Date(`${from}T00:00:00+05:00`) } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  const monthOf = (row: (typeof rows)[number]) => {
    const created = pktMonthKey(row.createdAt);
    if (created === current || created === previous) return created;
    return row.day.slice(0, 7);
  };
  const bucket = (month: string) => rows.filter((row) => monthOf(row) === month).map(toPublicRequest);
  return {
    current: { month: current, label: monthLabel(current), requests: bucket(current) },
    previous: { month: previous, label: monthLabel(previous), requests: bucket(previous) },
  };
}

export type ApprovalOverrides = {
  day?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  stillIn?: boolean;
  fromDay?: string;
  toDay?: string;
};

/** Attendance correction writes the CEO's times. Leave and work-from-home become paid leave. */
export async function applyApprovedRequest(row: {
  kind: string;
  department: string;
  personKey: string;
  personName: string;
  day: string;
  summary: string;
  checkIn: string | null;
  checkOut: string | null;
}, overrides: ApprovalOverrides = {}) {
  if (row.kind === "leave" || row.kind === "wfh") {
    const fromDay = overrides.fromDay || row.day;
    const toDay = overrides.toDay || endDayFromSummary(row.summary) || fromDay;
    return grantApprovedPaidLeave({
      personName: row.personName,
      personKey: row.personKey,
      fromDay,
      toDay,
    });
  }

  if (row.kind !== "attendance_correction") return { ok: true as const };
  const day = overrides.day && isValidDay(overrides.day) ? overrides.day : row.day;
  const checkIn = clock(overrides.checkIn || row.checkIn);
  const stillIn = overrides.stillIn === true;
  const checkOut = stillIn ? null : clock(overrides.checkOut === undefined ? row.checkOut : overrides.checkOut);
  if (!checkIn || !isValidTime(checkIn)) {
    return { ok: false as const, message: "Enter a check-in time." };
  }
  if (checkOut && !isValidTime(checkOut)) {
    return { ok: false as const, message: "Enter a valid check-out time." };
  }

  if (row.department === "csr" || row.department === "estimator" || row.department === "bim") {
    return ceoSetPortalShiftDay({
      userId: row.personKey,
      department: row.department,
      day,
      checkIn,
      checkOut,
    });
  }

  const saved = await saveAttendance({
    personKey: row.personKey,
    personName: row.personName,
    department: row.department as AttendanceDept,
    day,
    checkIn,
    checkOut,
  });
  if (!saved.ok) return { ok: false as const, message: saved.message };
  return { ok: true as const, day, checkIn, checkOut };
}

function clock(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? null;
}

function endDayFromSummary(summary: string): string {
  const match = summary.match(/(\d{4}-\d{2}-\d{2})\s*[–-]\s*(\d{4}-\d{2}-\d{2})/);
  return match?.[2] && isValidDay(match[2]) ? match[2] : "";
}
