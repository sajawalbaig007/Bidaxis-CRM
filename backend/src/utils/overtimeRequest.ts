import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { addCalendarDays, pktNow, pktShiftDay, staffCheckInInstant } from "./staffAttendance";

const NINE_HOURS_MS = 9 * 60 * 60 * 1000;

export function formatOvertimeMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes between two HH:mm clocks. Checkout before check-in counts as the next day. */
export function overtimeMinutesFromClocks(checkIn: string, checkOut: string): number | null {
  if (!CLOCK_RE.test(checkIn) || !CLOCK_RE.test(checkOut)) return null;
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  const start = ih * 60 + im;
  const end = oh * 60 + om;
  const minutes = end > start ? end - start : end + 24 * 60 - start;
  if (minutes < 1 || minutes > 12 * 60) return null;
  return minutes;
}

function appliedWindow(input: { checkIn?: string; checkOut?: string }): { ok: true; minutes: number; checkIn: string; checkOut: string } | { ok: false; message: string } {
  const checkIn = String(input.checkIn ?? "").trim();
  const checkOut = String(input.checkOut ?? "").trim();
  const minutes = overtimeMinutesFromClocks(checkIn, checkOut);
  if (minutes == null) {
    return { ok: false, message: "Enter overtime check-in and check-out. Overtime can be from 1 minute up to 12 hours." };
  }
  return { ok: true, minutes, checkIn, checkOut };
}

export function isWeekend(date: Date, timeZone: string): boolean {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return day === "Sat" || day === "Sun";
}

export type OvertimeDepartment = "dev" | "estimator" | "chief_estimator" | "bim_modeler";

const REVIEW_LABEL: Record<string, string> = {
  admin: "CEO",
  technical_manager: "Chief Estimator",
};

export function overtimeReviewerLabel(role: string): string | null {
  return REVIEW_LABEL[role] ?? null;
}

export async function saveOvertimeComment(input: {
  personKey: string;
  personName: string;
  department: OvertimeDepartment;
  day: string;
  comment: string;
}) {
  const comment = input.comment.trim().slice(0, 500);
  if (!comment) return null;
  const where = {
    personKey_day_department: {
      personKey: input.personKey,
      day: input.day,
      department: input.department,
    },
  };
  const existing = await prisma.overtimeRequest.findUnique({ where });
  if (!existing) {
    return prisma.overtimeRequest.create({
      data: {
        personKey: input.personKey,
        personName: input.personName,
        department: input.department,
        day: input.day,
        comment,
        status: "pending",
      },
    });
  }
  if (existing.comment === comment) return existing;
  return prisma.overtimeRequest.update({
    where: { id: existing.id },
    data: { comment, personName: input.personName, status: "pending", editedBy: null },
  });
}

export async function reviewOvertime(input: {
  id: string;
  role: string;
  action: "approve" | "decline" | "edit";
  comment?: string;
  minutes?: number;
  checkIn?: string;
  checkOut?: string;
}) {
  const note = await prisma.overtimeRequest.findUnique({ where: { id: input.id } });
  if (!note) return { ok: false as const, message: "Overtime comment not found." };
  const reviewer = overtimeReviewerLabel(input.role);
  if (!reviewer) return { ok: false as const, message: "You cannot review overtime." };
  if (input.role === "technical_manager" && note.department !== "estimator") {
    return { ok: false as const, message: "Chief Estimator reviews estimator overtime. The CEO reviews Chief Estimator overtime." };
  }
  if (input.role === "admin" && note.department === "estimator") {
    return { ok: false as const, message: "Chief Estimator reviews estimator overtime." };
  }
  if (input.action === "edit") {
    const window = appliedWindow({ checkIn: input.checkIn, checkOut: input.checkOut });
    const minutes = window.ok ? window.minutes : Number(input.minutes);
    const keptNote = note.comment.split("\n").slice(1).join("\n").trim();
    const duration = Number.isInteger(minutes) && minutes >= 1 && minutes <= 12 * 60
      ? formatOvertimeMinutes(minutes)
      : "";
    const comment = duration
      ? (keptNote ? `${duration}\n${keptNote}` : duration)
      : (input.comment ?? "").trim().slice(0, 500);
    if (!comment) return { ok: false as const, message: "Enter the overtime check-in and check-out." };
    const updated = await prisma.overtimeRequest.update({
      where: { id: note.id },
      data: {
        comment,
        editedBy: reviewer,
        ...(window.ok ? { checkIn: window.checkIn, checkOut: window.checkOut } : {}),
      },
    });
    return { ok: true as const, note: updated };
  }
  const updated = await prisma.overtimeRequest.update({
    where: { id: note.id },
    data: { status: input.action === "approve" ? "approved" : "declined" },
  });
  return { ok: true as const, note: updated };
}

/** Re-check-in within this gap still belongs to the same shift. */
const SHIFT_GAP_MS = 3 * 60 * 60 * 1000;

function hasClock(value: string | null | undefined): value is string {
  return !!value && value !== "";
}

/**
 * Wall-clock of the current shift. A check-in that started before midnight
 * Eastern still counts — Pakistani daytime shifts often cross that date line,
 * so filtering to "today ET" left the button off after a full 9 hour shift.
 */
async function estimatorShiftMs(userId: string): Promise<{ ms: number; open: boolean }> {
  const now = Date.now();
  const sessions = await prisma.csrWorkSession.findMany({
    where: { userId, loginAt: { gte: new Date(now - 36 * 60 * 60 * 1000) } },
    select: { loginAt: true, logoutAt: true },
    orderBy: { loginAt: "asc" },
  });
  if (sessions.length === 0) return { ms: 0, open: false };
  let ms = 0;
  let laterStart = Number.POSITIVE_INFINITY;
  let open = false;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    const start = session.loginAt.getTime();
    const ended = !!session.logoutAt;
    const end = ended ? session.logoutAt!.getTime() : now;
    if (laterStart !== Number.POSITIVE_INFINITY && laterStart - end > SHIFT_GAP_MS) break;
    if (!ended) open = true;
    const clippedEnd = Math.min(end, laterStart);
    ms += Math.max(0, clippedEnd - start);
    laterStart = Math.min(laterStart, start);
  }
  return { ms, open };
}

async function chiefShiftMs(userId: string): Promise<{ ms: number; open: boolean }> {
  const day = pktShiftDay(new Date(), "chief_estimator", userId);
  const today = await prisma.staffDayAttendance.findUnique({
    where: { personKey_day: { personKey: userId, day } },
  });
  let row = today?.checkIn ? today : null;
  if (!row) {
    const prev = await prisma.staffDayAttendance.findUnique({
      where: { personKey_day: { personKey: userId, day: addCalendarDays(day, -1) } },
    });
    if (prev?.checkIn && !hasClock(prev.checkOut)) row = prev;
  }
  if (!row?.checkIn) return { ms: 0, open: false };
  const start = staffCheckInInstant(row.department || "chief_estimator", row.day, row.checkIn, row.personKey);
  const open = !hasClock(row.checkOut);
  if (!start) return { ms: 0, open };
  let end = new Date();
  if (!open && row.checkOut) {
    const outDay = row.checkOut < row.checkIn ? addCalendarDays(row.day, 1) : row.day;
    const out = new Date(`${outDay}T${row.checkOut}:00+05:00`);
    if (!Number.isNaN(out.getTime())) end = out;
  }
  return { ms: Math.max(0, end.getTime() - start.getTime()), open };
}

export async function overtimeGate(userId: string, role: string) {
  const estimator = role === "estimator";
  const timeZone = "Asia/Karachi";
  const weekend = isWeekend(new Date(), timeZone);
  const shift = estimator ? await estimatorShiftMs(userId) : await chiefShiftMs(userId);
  return {
    /* The Chief Estimator can start overtime at any time; estimators after a 9 hour weekday shift. */
    allowed: !estimator || weekend || shift.ms >= NINE_HOURS_MS,
    weekend,
    shiftMs: shift.ms,
    open: shift.open,
  };
}

export async function submitShiftOvertime(input: { userId: string; role: string; name: string; checkIn: string; checkOut: string }) {
  if (input.role !== "estimator" && input.role !== "technical_manager") {
    return { ok: false as const, message: "Overtime is only for estimators and the Chief Estimator." };
  }
  const window = appliedWindow(input);
  if (!window.ok) return window;
  const gate = await overtimeGate(input.userId, input.role);
  if (!gate.allowed) {
    return { ok: false as const, message: "Overtime opens on Saturday and Sunday, or after a 9 hour weekday shift." };
  }
  const department = input.role === "estimator" ? "estimator" : "chief_estimator";
  const day = pktShiftDay(new Date(), input.role === "estimator" ? "estimator" : "chief_estimator", input.userId);
  const comment = formatOvertimeMinutes(window.minutes);
  const where = { personKey_day_department: { personKey: input.userId, day, department } };
  const existing = await prisma.overtimeRequest.findUnique({ where });
  const note = existing
    ? await prisma.overtimeRequest.update({
        where: { id: existing.id },
        data: {
          comment,
          checkIn: window.checkIn,
          checkOut: window.checkOut,
          personName: input.name,
          status: "pending",
          editedBy: null,
        },
      })
    : await prisma.overtimeRequest.create({
        data: {
          personKey: input.userId,
          personName: input.name,
          department,
          day,
          comment,
          checkIn: window.checkIn,
          checkOut: window.checkOut,
          status: "pending",
        },
      });
  return { ok: true as const, note };
}

/** Chief Estimator enters their own overtime. The CEO approves it. */
export async function submitChiefOvertime(input: { userId: string; name: string; day: string; checkIn: string; checkOut: string; note?: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) {
    return { ok: false as const, message: "Pick a date." };
  }
  const window = appliedWindow(input);
  if (!window.ok) return window;
  const noteText = String(input.note ?? "").trim().slice(0, 300);
  const comment = noteText ? `${formatOvertimeMinutes(window.minutes)}\n${noteText}` : formatOvertimeMinutes(window.minutes);
  const where = { personKey_day_department: { personKey: input.userId, day: input.day, department: "chief_estimator" } };
  const existing = await prisma.overtimeRequest.findUnique({ where });
  const note = existing
    ? await prisma.overtimeRequest.update({
        where: { id: existing.id },
        data: {
          comment,
          checkIn: window.checkIn,
          checkOut: window.checkOut,
          personName: input.name,
          status: "pending",
          editedBy: null,
        },
      })
    : await prisma.overtimeRequest.create({
        data: {
          personKey: input.userId,
          personName: input.name,
          department: "chief_estimator",
          day: input.day,
          comment,
          checkIn: window.checkIn,
          checkOut: window.checkOut,
          status: "pending",
        },
      });
  return { ok: true as const, note };
}

/** Chief Estimator sets or corrects an estimator's overtime for a shift day. */
export async function chiefSetEstimatorOvertime(input: {
  personKey: string;
  personName: string;
  day: string;
  checkIn: string;
  checkOut: string;
}) {
  if (!input.personKey || !/^\d{4}-\d{2}-\d{2}$/.test(input.day)) {
    return { ok: false as const, message: "Pick the estimator and date." };
  }
  const window = appliedWindow(input);
  if (!window.ok) return window;
  const user = await prisma.user.findUnique({
    where: { id: input.personKey },
    select: { role: true, name: true },
  });
  if (user?.role !== "estimator") {
    return { ok: false as const, message: "You can only edit estimator overtime." };
  }
  const comment = formatOvertimeMinutes(window.minutes);
  const where = { personKey_day_department: { personKey: input.personKey, day: input.day, department: "estimator" } };
  const existing = await prisma.overtimeRequest.findUnique({ where });
  const note = existing
    ? await prisma.overtimeRequest.update({
        where: { id: existing.id },
        data: {
          comment,
          checkIn: window.checkIn,
          checkOut: window.checkOut,
          personName: user.name || input.personName,
          editedBy: "Chief Estimator",
        },
      })
    : await prisma.overtimeRequest.create({
        data: {
          personKey: input.personKey,
          personName: user.name || input.personName,
          department: "estimator",
          day: input.day,
          comment,
          checkIn: window.checkIn,
          checkOut: window.checkOut,
          status: "pending",
          editedBy: "Chief Estimator",
        },
      });
  return { ok: true as const, note };
}

export type OvertimeSession = { startAt: string; endAt: string | null; reason: string; manual?: boolean };

/** Stored sessions, oldest first. Bad rows are skipped. */
export function readOvertimeSessions(value: unknown): OvertimeSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const startAt = typeof row?.startAt === "string" ? row.startAt : "";
    if (!startAt || Number.isNaN(Date.parse(startAt))) return [];
    const endAt = typeof row?.endAt === "string" && !Number.isNaN(Date.parse(row.endAt)) ? row.endAt : null;
    return [{ startAt, endAt, reason: String(row?.reason ?? "").trim().slice(0, 300), ...(row?.manual ? { manual: true } : {}) }];
  });
}

function sessionMinutes(session: OvertimeSession): number {
  if (!session.endAt) return 0;
  return Math.max(0, Math.round((Date.parse(session.endAt) - Date.parse(session.startAt)) / 60_000));
}

function pktClock(iso: string): string {
  return pktNow(new Date(iso)).time.slice(0, 5);
}

/** An overtime window applied the old way (In / Out clocks) becomes the first session of the day. */
function legacySession(note: { day: string; checkIn?: string | null; checkOut?: string | null; comment: string }): OvertimeSession | null {
  if (!note.checkIn || !note.checkOut) return null;
  const minutes = overtimeMinutesFromClocks(note.checkIn, note.checkOut);
  if (minutes == null) return null;
  const start = new Date(`${note.day}T${note.checkIn}:00+05:00`);
  if (Number.isNaN(start.getTime())) return null;
  return {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    reason: note.comment.split("\n").slice(1).join(" ").trim().slice(0, 300),
  };
}

/** Comment line 1 is the day's total ("2h 05m"); the next lines are the reasons, latest first. */
function sessionFields(sessions: OvertimeSession[]) {
  const minutes = sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const reasons = [...sessions].reverse().map((session) => session.reason).filter(Boolean);
  const last = sessions[sessions.length - 1];
  return {
    sessions: sessions as unknown as Prisma.InputJsonValue,
    comment: [formatOvertimeMinutes(minutes), ...reasons].join("\n").slice(0, 500),
    checkIn: sessions.length ? pktClock(sessions[0].startAt) : null,
    checkOut: last?.endAt ? pktClock(last.endAt) : null,
  };
}

/** Total minutes on an overtime note — the "2h 05m" first line written by every overtime flow. */
export function overtimeNoteMinutes(comment: string): number {
  const match = /^(\d+)h\s+(\d{1,2})m\b/.exec(comment.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function overtimeDepartmentFor(role: string): "estimator" | "chief_estimator" | null {
  if (role === "estimator") return "estimator";
  if (role === "technical_manager") return "chief_estimator";
  return null;
}

async function findOpenOvertime(personKey: string, department: string) {
  const recent = await prisma.overtimeRequest.findMany({
    where: { personKey, department },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  return recent.find((note) => readOvertimeSessions(note.sessions).some((session) => !session.endAt)) ?? null;
}

/** This person's overtime today: every session plus the one still running, if any. */
export async function myOvertimeSessions(userId: string, role: string) {
  const department = overtimeDepartmentFor(role);
  if (!department) return { running: null, sessions: [] as OvertimeSession[], status: null as string | null, minutes: 0 };
  const open = await findOpenOvertime(userId, department);
  const day = pktShiftDay(new Date(), department, userId);
  const note = open ?? await prisma.overtimeRequest.findUnique({
    where: { personKey_day_department: { personKey: userId, day, department } },
  });
  const sessions = readOvertimeSessions(note?.sessions);
  return {
    running: sessions.find((session) => !session.endAt) ?? null,
    sessions: [...sessions].reverse(),
    status: note?.status ?? null,
    minutes: note ? overtimeNoteMinutes(note.comment) : 0,
  };
}

/** Start overtime. A reason is required; a second start on the same day adds another session. */
export async function startOvertimeSession(input: { userId: string; role: string; name: string; reason: string }) {
  const department = overtimeDepartmentFor(input.role);
  if (!department) return { ok: false as const, message: "Overtime is only for estimators and the Chief Estimator." };
  const reason = input.reason.trim().slice(0, 300);
  if (!reason) return { ok: false as const, message: "Write the reason for overtime first." };
  if (await findOpenOvertime(input.userId, department)) {
    return { ok: false as const, message: "Overtime is already running. Stop it first." };
  }
  const gate = await overtimeGate(input.userId, input.role);
  if (!gate.allowed) {
    return { ok: false as const, message: "Overtime opens on Saturday and Sunday, or after a 9 hour weekday shift." };
  }
  const day = pktShiftDay(new Date(), department, input.userId);
  const where = { personKey_day_department: { personKey: input.userId, day, department } };
  const existing = await prisma.overtimeRequest.findUnique({ where });
  let sessions = readOvertimeSessions(existing?.sessions);
  if (existing && !sessions.length) {
    const legacy = legacySession(existing);
    if (legacy) sessions = [legacy];
  }
  sessions.push({ startAt: new Date().toISOString(), endAt: null, reason });
  const data = { ...sessionFields(sessions), personName: input.name, status: "pending", editedBy: null };
  const note = existing
    ? await prisma.overtimeRequest.update({ where: { id: existing.id }, data })
    : await prisma.overtimeRequest.create({ data: { ...data, personKey: input.userId, department, day } });
  return { ok: true as const, note };
}

/**
 * Overtime typed in by hand (date, In, Out, reason). It is added as one more session on that day,
 * so it sums with Start / Stop sessions, and goes for approval like them.
 */
export async function addManualOvertimeSession(input: {
  userId: string;
  role: string;
  name: string;
  day: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}) {
  const department = overtimeDepartmentFor(input.role);
  if (!department) return { ok: false as const, message: "Overtime is only for estimators and the Chief Estimator." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return { ok: false as const, message: "Pick a date." };
  if (input.day > pktNow().day) return { ok: false as const, message: "Overtime cannot be added for a future date." };
  const reason = input.reason.trim().slice(0, 300);
  if (!reason) return { ok: false as const, message: "Write the reason for overtime." };
  const window = appliedWindow(input);
  if (!window.ok) return window;
  const start = new Date(`${input.day}T${window.checkIn}:00+05:00`);
  const added: OvertimeSession = {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + window.minutes * 60_000).toISOString(),
    reason,
    manual: true,
  };
  const where = { personKey_day_department: { personKey: input.userId, day: input.day, department } };
  const existing = await prisma.overtimeRequest.findUnique({ where });
  let sessions = readOvertimeSessions(existing?.sessions);
  if (existing && !sessions.length) {
    const legacy = legacySession(existing);
    if (legacy) sessions = [legacy];
  }
  const overlaps = sessions.some((session) => {
    const end = session.endAt ? Date.parse(session.endAt) : Date.now();
    return Date.parse(added.startAt) < end && Date.parse(added.endAt!) > Date.parse(session.startAt);
  });
  if (overlaps) return { ok: false as const, message: "This time overlaps overtime already on that day." };
  sessions = [...sessions, added].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const data = { ...sessionFields(sessions), personName: input.name, status: "pending", editedBy: null };
  const note = existing
    ? await prisma.overtimeRequest.update({ where: { id: existing.id }, data })
    : await prisma.overtimeRequest.create({ data: { ...data, personKey: input.userId, department, day: input.day } });
  return { ok: true as const, note };
}

/** Stop the running overtime session. The day's total is the sum of all its sessions. */
export async function stopOvertimeSession(input: { userId: string; role: string }) {
  const department = overtimeDepartmentFor(input.role);
  if (!department) return { ok: false as const, message: "Overtime is only for estimators and the Chief Estimator." };
  const open = await findOpenOvertime(input.userId, department);
  if (!open) return { ok: false as const, message: "No overtime is running." };
  const now = new Date().toISOString();
  const sessions = readOvertimeSessions(open.sessions).map((session) => (session.endAt ? session : { ...session, endAt: now }));
  const note = await prisma.overtimeRequest.update({
    where: { id: open.id },
    data: { ...sessionFields(sessions), status: "pending", editedBy: null },
  });
  return { ok: true as const, note };
}

export function overtimePublic(note: {
  id: string;
  comment: string;
  status: string;
  editedBy: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  sessions?: unknown;
} | null | undefined) {
  return {
    overtimeId: note?.id ?? null,
    overtimeComment: note?.comment ?? null,
    overtimeCheckIn: note?.checkIn ?? null,
    overtimeCheckOut: note?.checkOut ?? null,
    overtimeStatus: note?.status ?? null,
    overtimeEditedBy: note?.editedBy ?? null,
    overtimeSessions: readOvertimeSessions(note?.sessions),
  };
}

type SessionHit = {
  loginAt: Date;
  logoutAt: Date | null;
  user: { id: string; name: string };
};

/** Estimator shifts grouped by the check-in day. A next-morning checkout stays on that day. */
export async function listEstimatorShiftRows(staffRole: "estimator" | "bim" = "estimator") {
  const sessions = await prisma.csrWorkSession.findMany({
    where: { user: { is: { role: staffRole } } },
    orderBy: { loginAt: "asc" },
    take: 8000,
    select: {
      loginAt: true,
      logoutAt: true,
      user: { select: { id: true, name: true } },
    },
  });
  type Bucket = {
    personKey: string;
    personName: string;
    day: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    open: boolean;
  };
  const map = new Map<string, Bucket>();
  for (const row of sessions as SessionHit[]) {
    const day = pktShiftDay(row.loginAt, staffRole, row.user.id);
    const key = `${row.user.id}:${day}`;
    const hit = map.get(key);
    if (!hit) {
      map.set(key, {
        personKey: row.user.id,
        personName: row.user.name,
        day,
        checkInAt: row.loginAt,
        checkOutAt: row.logoutAt,
        open: !row.logoutAt,
      });
      continue;
    }
    if (row.loginAt < hit.checkInAt) hit.checkInAt = row.loginAt;
    if (!row.logoutAt) {
      hit.open = true;
      hit.checkOutAt = null;
    } else if (!hit.open && (!hit.checkOutAt || row.logoutAt > hit.checkOutAt)) {
      hit.checkOutAt = row.logoutAt;
    }
  }
  const notes = await prisma.overtimeRequest.findMany({
    where: { department: staffRole },
  });
  const byKey = new Map(notes.map((note) => [`${note.personKey}:${note.day}`, note]));
  return [...map.values()]
    .sort((a, b) => b.day.localeCompare(a.day) || a.personName.localeCompare(b.personName))
    .map((bucket) => {
      const note = byKey.get(`${bucket.personKey}:${bucket.day}`);
      return {
        id: note?.id ?? `estimator:${bucket.personKey}:${bucket.day}`,
        personKey: bucket.personKey,
        personName: bucket.personName,
        department: staffRole,
        day: bucket.day,
        checkIn: null,
        checkOut: null,
        checkInAt: bucket.checkInAt.toISOString(),
        checkOutAt: bucket.open || !bucket.checkOutAt ? null : bucket.checkOutAt.toISOString(),
        comment: null,
        ...overtimePublic(note),
      };
    });
}
