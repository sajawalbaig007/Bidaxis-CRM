import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { detectBrowser } from "./sessions";
import { formatDurationMs, formatEstDateTime, estDateYmd, CSR_REPORT_TIMEZONE } from "./estTime";
import { pktNow, pktShiftDay } from "./staffAttendance";

const MAX_TICK_MS = 5 * 60 * 1000;
/**
 * Reports: gaps longer than this (lock / sleep / no heartbeat) count as away.
 * Matches Users-page presence threshold but does not close the work session.
 */
const SILENCE_MS = 90_000;
/** Forgotten check-out: close the shift 9 hours 30 minutes after check-in. */
const MAX_OPEN_SESSION_MS = (9 * 60 + 30) * 60 * 1000;

function openSessionWhere(userId: string) {
  /* MongoDB: null filter alone can miss docs where logoutAt was never set. */
  return {
    userId,
    OR: [
      { logoutAt: null },
      { logoutAt: { isSet: false } },
    ],
  };
}

async function findAllOpenSessions(userId: string) {
  return prisma.csrWorkSession.findMany({
    where: openSessionWhere(userId),
    orderBy: { loginAt: "desc" },
  });
}

function sessionAgeMs(loginAt: Date, now = new Date()) {
  return Math.max(0, now.getTime() - new Date(loginAt).getTime());
}

function autoCheckoutAt(loginAt: Date): Date {
  return new Date(new Date(loginAt).getTime() + MAX_OPEN_SESSION_MS);
}

function isStaleOpenSession(loginAt: Date, now = new Date()) {
  return sessionAgeMs(loginAt, now) >= MAX_OPEN_SESSION_MS;
}

async function finalizeOpenSession(
  session: {
    id: string;
    loginAt: Date;
    dashboardMs: number;
    awayMs: number;
    pausedMs?: number;
    pausedAt?: Date | null;
    lastHeartbeatAt: Date | null;
    lastVisible: boolean;
  },
  reason: string,
  now = new Date(),
) {
  try {
    await applyHeartbeatTick(session, session.lastVisible, now);
  } catch {
    /* still close even if tick fails */
  }
  /* Flush any open pause into pausedMs before closing */
  let pausedMs = session.pausedMs ?? 0;
  if (session.pausedAt) {
    pausedMs += Math.max(0, now.getTime() - new Date(session.pausedAt).getTime());
  }
  await prisma.csrWorkSession.update({
    where: { id: session.id },
    data: {
      logoutAt: now,
      closedReason: reason,
      pausedAt: null,
      pausedMs,
    },
  });
}

/**
 * Keep at most one open session: drop shifts open 9h 30m or longer, and close older duplicates.
 * Returns the single active session, or null if none / all closed.
 */
async function reconcileOpenSessions(userId: string) {
  const sessions = await findAllOpenSessions(userId);
  if (sessions.length === 0) return null;

  const now = new Date();
  const [newest, ...older] = sessions;

  for (const session of older) {
    await finalizeOpenSession(session, "session_replaced", newest.loginAt);
  }

  if (isStaleOpenSession(newest.loginAt, now)) {
    await finalizeOpenSession(newest, "stale_timeout", autoCheckoutAt(newest.loginAt));
    return null;
  }

  return newest;
}

/** Close every CSR and estimator shift that is still open 9h 30m after check-in. */
export async function closeForgottenWorkSessions() {
  const cutoff = new Date(Date.now() - MAX_OPEN_SESSION_MS);
  const rows = await prisma.csrWorkSession.findMany({
    where: {
      loginAt: { lte: cutoff },
      OR: [{ logoutAt: null }, { logoutAt: { isSet: false } }],
    },
    take: 500,
  });
  for (const row of rows) {
    await finalizeOpenSession(row, "stale_timeout", autoCheckoutAt(row.loginAt));
  }
}

async function applyHeartbeatTick(
  session: {
    id: string;
    loginAt: Date;
    dashboardMs: number;
    awayMs: number;
    pausedMs?: number;
    pausedAt?: Date | null;
    lastHeartbeatAt: Date | null;
    lastVisible: boolean;
  },
  tabVisible: boolean,
  now = new Date(),
) {
  const prevAt = session.lastHeartbeatAt ?? session.loginAt;
  const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());
  const wallMs = sessionAgeMs(session.loginAt, now);

  let dashboardMs = session.dashboardMs;
  let awayMs = session.awayMs;
  let pausedMs = session.pausedMs ?? 0;
  const isPaused = !!session.pausedAt;

  if (isPaused) {
    /* Explicit pause — don't count as dashboard work; accumulate pausedMs */
    const deltaMs = Math.min(MAX_TICK_MS, rawDelta > SILENCE_MS ? rawDelta : rawDelta);
    pausedMs += deltaMs;
  } else if (rawDelta > SILENCE_MS) {
    // Lock / sleep / no network — count gap as away, but never past wall-clock.
    const room = Math.max(0, wallMs - (dashboardMs + awayMs + pausedMs));
    awayMs += Math.min(rawDelta, room);
  } else {
    const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
    dashboardMs += session.lastVisible ? deltaMs : 0;
    awayMs += !session.lastVisible ? deltaMs : 0;
  }

  /* Clamp so stored counters never exceed elapsed wall time */
  const sum = dashboardMs + awayMs + pausedMs;
  if (sum > wallMs && sum > 0) {
    const scale = wallMs / sum;
    dashboardMs = Math.round(dashboardMs * scale);
    awayMs = Math.round(awayMs * scale);
    pausedMs = Math.max(0, wallMs - dashboardMs - awayMs);
  }

  return prisma.csrWorkSession.update({
    where: { id: session.id },
    data: {
      dashboardMs,
      awayMs,
      pausedMs,
      lastHeartbeatAt: now,
      lastVisible: tabVisible,
    },
  });
}

export async function openCsrWorkSession(opts: {
  userId: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}): Promise<void> {
  try {
    await closeCsrWorkSession(opts.userId, "session_replaced");
    const ua = opts.userAgent ?? "";
    await prisma.csrWorkSession.create({
      data: {
        userId: opts.userId,
        loginAt: new Date(),
        logoutAt: null,
        lastHeartbeatAt: new Date(),
        lastVisible: true,
        ip: opts.ip ?? null,
        browser: ua ? detectBrowser(ua) : null,
        deviceId: opts.deviceId ?? null,
      },
    });
  } catch (err) {
    console.log("[csr-session] open failed:", err);
  }
}

/** Explicit CSR Check In — resumes a fresh same-day session; replaces stale/duplicates. */
export async function checkInCsrWorkSession(opts: {
  userId: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}): Promise<{ created: boolean; sessionId: string; loginAt: Date }> {
  const existing = await reconcileOpenSessions(opts.userId);
  if (existing) {
    return { created: false, sessionId: existing.id, loginAt: existing.loginAt };
  }

  const ua = opts.userAgent ?? "";
  const created = await prisma.csrWorkSession.create({
    data: {
      userId: opts.userId,
      loginAt: new Date(),
      logoutAt: null,
      lastHeartbeatAt: new Date(),
      lastVisible: true,
      ip: opts.ip ?? null,
      browser: ua ? detectBrowser(ua) : null,
      deviceId: opts.deviceId ?? null,
    },
  });
  return { created: true, sessionId: created.id, loginAt: created.loginAt };
}

export async function checkOutCsrWorkSession(userId: string): Promise<boolean> {
  const closed = await closeCsrWorkSession(userId, "check_out");
  return closed > 0;
}

export async function getCsrWorkSessionStatus(userId: string) {
  const session = await reconcileOpenSessions(userId);
  if (!session) {
    return {
      checkedIn: false as const,
      paused: false as const,
      session: null,
    };
  }
  const { dashboardMs, awayMs, pausedMs, totalMs } = liveTotals(session);
  const paused = !!session.pausedAt;
  return {
    checkedIn: true as const,
    paused,
    session: {
      id: session.id,
      checkInAt: session.loginAt.toISOString(),
      checkInAtEst: formatEstDateTime(session.loginAt),
      paused,
      pausedAt: session.pausedAt ? session.pausedAt.toISOString() : null,
      dashboardMs,
      awayMs,
      pausedMs,
      totalMs,
      dashboardDuration: formatDurationMs(dashboardMs),
      awayDuration: formatDurationMs(awayMs),
      pausedDuration: formatDurationMs(pausedMs),
      totalDuration: formatDurationMs(totalMs),
    },
  };
}

/** CSR left dashboard (e.g. WhatsApp) — pause work clock without checking out. */
export async function pauseCsrWorkSession(userId: string): Promise<boolean> {
  const session = await reconcileOpenSessions(userId);
  if (!session) return false;
  if (session.pausedAt) return true;
  const now = new Date();
  await applyHeartbeatTick(session, session.lastVisible, now);
  await prisma.csrWorkSession.update({
    where: { id: session.id },
    data: { pausedAt: now, lastHeartbeatAt: now },
  });
  return true;
}

/** CSR back on dashboard — resume work clock. */
export async function resumeCsrWorkSession(userId: string): Promise<boolean> {
  const session = await reconcileOpenSessions(userId);
  if (!session) return false;
  if (!session.pausedAt) return true;
  const now = new Date();
  const extra = Math.max(0, now.getTime() - new Date(session.pausedAt).getTime());
  await prisma.csrWorkSession.update({
    where: { id: session.id },
    data: {
      pausedAt: null,
      pausedMs: (session.pausedMs ?? 0) + extra,
      lastHeartbeatAt: now,
      lastVisible: true,
    },
  });
  return true;
}

function parseActionAt(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() > Date.now() + 60_000) return null;
  return date;
}

export async function stampLastAction(userId: string, raw: unknown) {
  const actionAt = parseActionAt(raw);
  if (!actionAt) return;
  const session = await prisma.csrWorkSession.findFirst({
    where: openSessionWhere(userId),
    orderBy: { loginAt: "desc" },
    select: { id: true, lastActionAt: true },
  });
  if (!session) return;
  if (session.lastActionAt && session.lastActionAt >= actionAt) return;
  await prisma.csrWorkSession.update({
    where: { id: session.id },
    data: { lastActionAt: actionAt },
  });
}

export async function tickCsrWorkSession(opts: {
  userId: string;
  tabVisible: boolean;
  deviceId?: string;
  lastActionAt?: unknown;
}): Promise<void> {
  try {
    const session = await reconcileOpenSessions(opts.userId);
    if (!session) return;

    await applyHeartbeatTick(session, opts.tabVisible);

    const actionAt = parseActionAt(opts.lastActionAt);
    const deviceChanged = !!opts.deviceId && opts.deviceId !== session.deviceId;
    const actionNewer = !!actionAt && (!session.lastActionAt || actionAt > session.lastActionAt);
    if (deviceChanged || actionNewer) {
      await prisma.csrWorkSession.update({
        where: { id: session.id },
        data: {
          ...(deviceChanged ? { deviceId: opts.deviceId } : {}),
          ...(actionNewer ? { lastActionAt: actionAt } : {}),
        },
      });
    }
  } catch (err) {
    console.log("[csr-session] tick failed:", err);
  }
}

/** Close every open work session for this CSR (handles zombie duplicates). */
export async function closeCsrWorkSession(
  userId: string,
  reason: string,
): Promise<number> {
  try {
    const sessions = await findAllOpenSessions(userId);
    if (sessions.length === 0) return 0;

    const now = new Date();
    for (const session of sessions) {
      await finalizeOpenSession(session, reason, now);
    }
    return sessions.length;
  } catch (err) {
    console.log("[csr-session] close failed:", err);
    return 0;
  }
}

export type CsrSessionReportRow = {
  id: string;
  csrId: string;
  csrName: string;
  csrCode: string | null;
  loginAt: string;
  loginAtEst: string;
  logoutAt: string | null;
  logoutAtEst: string;
  checkInAtEst: string;
  checkOutAtEst: string;
  dashboardDuration: string;
  awayDuration: string;
  totalDuration: string;
  dashboardMs: number;
  awayMs: number;
  totalMs: number;
  status: "active" | "closed";
  browser: string | null;
  ip: string | null;
  closedReason: string | null;
  closedReasonLabel: string;
  lastActionAt: string | null;
  overtimeId?: string | null;
  overtimeComment?: string | null;
  overtimeStatus?: string | null;
  overtimeEditedBy?: string | null;
  sessionCount: number;
  memberIds: string[];
  day?: string;
};

function closedReasonLabel(reason: string | null, hasLogout: boolean): string {
  if (!hasLogout) return "Still checked in";
  switch ((reason ?? "").toLowerCase()) {
    case "stale_timeout": return "Auto (9h 30m)";
    case "check_out": return "Check Out";
    case "logout": return "Logout";
    case "session_replaced": return "New check-in";
    case "logout_all": return "Logout all";
    case "admin_adjusted": return "Admin adjusted";
    case "request_approved": return "Request approved";
    default: return reason ? reason.replace(/_/g, " ") : "Closed";
  }
}

export type CsrSessionSummary = {
  csrId: string;
  csrName: string;
  csrCode: string | null;
  sessions: number;
  dashboardMs: number;
  awayMs: number;
  totalMs: number;
  dashboardDuration: string;
  awayDuration: string;
  totalDuration: string;
  firstLoginAt: string;
  lastLogoutAt: string | null;
  stillOpen: boolean;
  day: string;
  lastActionAt?: string | null;
  overtimeId?: string | null;
  overtimeComment?: string | null;
  overtimeStatus?: string | null;
  overtimeEditedBy?: string | null;
};

function liveTotals(session: {
  loginAt: Date;
  logoutAt: Date | null;
  dashboardMs: number;
  awayMs: number;
  pausedMs?: number;
  pausedAt?: Date | null;
  lastHeartbeatAt: Date | null;
  lastVisible: boolean;
}) {
  const now = new Date();
  let dashboardMs = session.dashboardMs;
  let awayMs = session.awayMs;
  let pausedMs = session.pausedMs ?? 0;

  const endAt = session.logoutAt ?? now;
  const totalMs = Math.max(0, endAt.getTime() - new Date(session.loginAt).getTime());

  if (!session.logoutAt) {
    if (session.pausedAt) {
      pausedMs += Math.max(0, now.getTime() - new Date(session.pausedAt).getTime());
    } else {
      const prevAt = session.lastHeartbeatAt ?? session.loginAt;
      const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());

      if (rawDelta > SILENCE_MS) {
        const room = Math.max(0, totalMs - (dashboardMs + awayMs + pausedMs));
        awayMs += Math.min(rawDelta, room);
      } else {
        const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
        if (session.lastVisible) dashboardMs += deltaMs;
        else awayMs += deltaMs;
      }
    }
  }

  const sum = dashboardMs + awayMs + pausedMs;
  if (sum > totalMs && sum > 0) {
    const scale = totalMs / sum;
    dashboardMs = Math.round(dashboardMs * scale);
    awayMs = Math.round(awayMs * scale);
    pausedMs = Math.max(0, totalMs - dashboardMs - awayMs);
  }

  return { dashboardMs, awayMs, pausedMs, totalMs };
}

/** One row per person per calendar day: first check-in, last check-out or still in, times summed. */
function mergeSessionsByCalendarDay(
  sessions: CsrSessionReportRow[],
  timeZone?: string,
  dayOf?: (loginAtIso: string) => string,
): CsrSessionReportRow[] {
  const map = new Map<string, CsrSessionReportRow>();
  const ordered = [...sessions].sort((a, b) => a.loginAt.localeCompare(b.loginAt));
  for (const s of ordered) {
    const day = dayOf ? dayOf(s.loginAt) : estDateYmd(new Date(s.loginAt), timeZone);
    const key = `${s.csrId}:${day}`;
    const hit = map.get(key);
    if (!hit) {
      map.set(key, { ...s, day, sessionCount: s.sessionCount || 1, memberIds: s.memberIds?.length ? [...s.memberIds] : [s.id] });
      continue;
    }
    hit.sessionCount += s.sessionCount || 1;
    hit.memberIds = [...new Set([...(hit.memberIds ?? [hit.id]), ...(s.memberIds?.length ? s.memberIds : [s.id])])];
    hit.dashboardMs += s.dashboardMs;
    hit.awayMs += s.awayMs;
    hit.totalMs += s.totalMs;
    hit.dashboardDuration = formatDurationMs(hit.dashboardMs);
    hit.awayDuration = formatDurationMs(hit.awayMs);
    hit.totalDuration = formatDurationMs(hit.totalMs);
    if (s.lastActionAt && (!hit.lastActionAt || s.lastActionAt > hit.lastActionAt)) {
      hit.lastActionAt = s.lastActionAt;
    }
    if (s.status === "active") {
      hit.status = "active";
      hit.logoutAt = null;
      hit.logoutAtEst = "Still checked in";
      hit.checkOutAtEst = "Still checked in";
      hit.closedReason = null;
      hit.closedReasonLabel = "Still checked in";
      hit.id = s.id;
    } else if (hit.status !== "active") {
      if (s.logoutAt && (!hit.logoutAt || s.logoutAt > hit.logoutAt)) {
        hit.logoutAt = s.logoutAt;
        hit.logoutAtEst = s.logoutAtEst;
        hit.checkOutAtEst = s.checkOutAtEst;
        hit.closedReason = s.closedReason;
        hit.closedReasonLabel = s.closedReasonLabel;
        hit.id = s.id;
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const t = b.loginAt.localeCompare(a.loginAt);
    if (t) return t;
    return a.csrName.localeCompare(b.csrName);
  });
}

export async function buildCsrSessionReport(opts: {
  from?: Date;
  to?: Date;
  csrId?: string;
  role?: "csr" | "estimator";
  timeZone?: string;
}): Promise<{ sessions: CsrSessionReportRow[]; summary: CsrSessionSummary[] }> {
  const staffRole: "csr" | "estimator" = opts.role === "estimator" ? "estimator" : "csr";
  const tz = opts.timeZone;
  /* Clean zombies before reporting so Totals / Still checked-in stay accurate */
  try {
    const openWhere: Prisma.CsrWorkSessionWhereInput = {
      ...(opts.csrId ? { userId: opts.csrId } : {}),
      OR: [{ logoutAt: null }, { logoutAt: { isSet: false } }],
      user: { is: { role: staffRole } },
    };
    const openRows = await prisma.csrWorkSession.findMany({
      where: openWhere,
      orderBy: { loginAt: "desc" },
      take: 2000,
    });
    const now = new Date();
    const newestLogin = new Map<string, Date>();
    for (const row of openRows) {
      const kept = newestLogin.get(row.userId);
      if (kept) {
        await finalizeOpenSession(row, "session_replaced", kept);
        continue;
      }
      if (isStaleOpenSession(row.loginAt, now)) {
        await finalizeOpenSession(row, "stale_timeout", autoCheckoutAt(row.loginAt));
        continue;
      }
      newestLogin.set(row.userId, row.loginAt);
    }
  } catch (err) {
    console.log("[csr-session] report cleanup failed:", err);
  }

  const range: { gte?: Date; lte?: Date } = {};
  if (opts.from) range.gte = opts.from;
  if (opts.to) range.lte = opts.to;

  const where: Prisma.CsrWorkSessionWhereInput = {
    ...(opts.csrId ? { userId: opts.csrId } : {}),
    ...(range.gte || range.lte ? { loginAt: range } : {}),
    user: { is: { role: staffRole } },
  };

  const rows = await prisma.csrWorkSession.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, csrCode: true } },
    },
    orderBy: { loginAt: "desc" },
    take: 5000,
  });

  const sessions: CsrSessionReportRow[] = rows.map(row => {
    const { dashboardMs, awayMs, totalMs } = liveTotals(row);
    const logoutAtEst = row.logoutAt ? formatEstDateTime(row.logoutAt, tz) : "Still checked in";
    return {
      id: row.id,
      csrId: row.user.id,
      csrName: row.user.name,
      csrCode: row.user.csrCode,
      loginAt: row.loginAt.toISOString(),
      loginAtEst: formatEstDateTime(row.loginAt, tz),
      logoutAt: row.logoutAt?.toISOString() ?? null,
      logoutAtEst,
      checkInAtEst: formatEstDateTime(row.loginAt, tz),
      checkOutAtEst: logoutAtEst,
      dashboardDuration: formatDurationMs(dashboardMs),
      awayDuration: formatDurationMs(awayMs),
      totalDuration: formatDurationMs(totalMs),
      dashboardMs,
      awayMs,
      totalMs,
      status: row.logoutAt ? "closed" : "active",
      browser: row.browser,
      ip: row.ip,
      closedReason: row.closedReason,
      closedReasonLabel: closedReasonLabel(row.closedReason, !!row.logoutAt),
      lastActionAt: row.lastActionAt?.toISOString() ?? null,
      sessionCount: 1,
      memberIds: [row.id],
    };
  });

  const merged = mergeSessionsByCalendarDay(
    sessions,
    tz,
    staffRole === "csr" ? (iso) => pktShiftDay(new Date(iso)) : undefined,
  );
  if (staffRole === "estimator") {
    const notes = await prisma.overtimeRequest.findMany({ where: { department: "estimator" } });
    const byKey = new Map(notes.map((note) => [`${note.personKey}:${note.day}`, note]));
    for (const row of merged) {
      const note = byKey.get(`${row.csrId}:${estDateYmd(new Date(row.loginAt), tz)}`);
      row.overtimeId = note?.id ?? null;
      row.overtimeComment = note?.comment ?? null;
      row.overtimeStatus = note?.status ?? null;
      row.overtimeEditedBy = note?.editedBy ?? null;
    }
  }
  const summary: CsrSessionSummary[] = merged.map(s => ({
    csrId: s.csrId,
    csrName: s.csrName,
    csrCode: s.csrCode,
    sessions: s.sessionCount,
    dashboardMs: s.dashboardMs,
    awayMs: s.awayMs,
    totalMs: s.totalMs,
    dashboardDuration: s.dashboardDuration,
    awayDuration: s.awayDuration,
    totalDuration: s.totalDuration,
    firstLoginAt: s.loginAt,
    lastLogoutAt: s.logoutAt,
    stillOpen: s.status === "active",
    day: staffRole === "csr" ? pktShiftDay(new Date(s.loginAt)) : estDateYmd(new Date(s.loginAt), tz),
    lastActionAt: s.lastActionAt ?? null,
    overtimeId: s.overtimeId ?? null,
    overtimeComment: s.overtimeComment ?? null,
    overtimeStatus: s.overtimeStatus ?? null,
    overtimeEditedBy: s.overtimeEditedBy ?? null,
  })).sort((a, b) => {
    const name = a.csrName.localeCompare(b.csrName);
    if (name) return name;
    return b.firstLoginAt.localeCompare(a.firstLoginAt);
  });

  return {
    sessions: merged,
    summary,
  };
}

/** Admin override of check-in / check-out times. */
export async function adminAdjustCsrWorkSession(opts: {
  sessionId: string;
  memberIds?: string[];
  checkInAt: Date;
  checkOutAt: Date | null;
  clearCheckOut?: boolean;
  dashboardMs?: number;
  awayMs?: number;
  note?: string;
}) {
  const ids = [...new Set((opts.memberIds?.length ? opts.memberIds : [opts.sessionId]).filter(Boolean))];
  const rows = await prisma.csrWorkSession.findMany({
    where: { id: { in: ids } },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  if (!rows.length) {
    return { ok: false as const, message: "Session not found." };
  }
  const user = rows[0]!.user;
  if (user.role !== "csr" && user.role !== "estimator") {
    return { ok: false as const, message: "Session not found." };
  }
  if (rows.some(r => r.userId !== user.id)) {
    return { ok: false as const, message: "Session not found." };
  }

  const ordered = [...rows].sort((a, b) => a.loginAt.getTime() - b.loginAt.getTime());
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const checkInAt = opts.checkInAt;
  const checkOutAt: Date | null = opts.clearCheckOut ? null : (opts.checkOutAt ?? last.logoutAt);

  if (checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) {
    return { ok: false as const, message: "Check-out must be after check-in." };
  }

  const note = opts.note?.trim() || "admin_adjusted";

  const scaleTimes = (
    session: (typeof rows)[0],
    loginAt: Date,
    logoutAt: Date | null,
  ) => {
    const endAt = logoutAt ?? new Date();
    const totalMs = Math.max(0, endAt.getTime() - loginAt.getTime());
    const prevTotal = Math.max(1, session.dashboardMs + session.awayMs);
    if (opts.dashboardMs !== undefined || opts.awayMs !== undefined) {
      return {
        dashboardMs: Math.max(0, opts.dashboardMs ?? session.dashboardMs),
        awayMs: Math.max(0, opts.awayMs ?? session.awayMs),
      };
    }
    if (session.dashboardMs + session.awayMs > 0 && totalMs > 0) {
      const ratio = session.dashboardMs / prevTotal;
      const dashboardMs = Math.round(totalMs * ratio);
      return { dashboardMs, awayMs: Math.max(0, totalMs - dashboardMs) };
    }
    return { dashboardMs: totalMs, awayMs: 0 };
  };

  if (first.id === last.id) {
    const scaled = scaleTimes(first, checkInAt, checkOutAt);
    const updated = await prisma.csrWorkSession.update({
      where: { id: first.id },
      data: {
        loginAt: checkInAt,
        logoutAt: checkOutAt,
        dashboardMs: scaled.dashboardMs,
        awayMs: scaled.awayMs,
        lastHeartbeatAt: checkOutAt ?? new Date(),
        lastVisible: true,
        closedReason: checkOutAt ? note : null,
      },
    });
    return { ok: true as const, session: updated, csrName: user.name };
  }

  const firstScaled = scaleTimes(first, checkInAt, first.logoutAt);
  await prisma.csrWorkSession.update({
    where: { id: first.id },
    data: {
      loginAt: checkInAt,
      dashboardMs: firstScaled.dashboardMs,
      awayMs: firstScaled.awayMs,
      closedReason: first.logoutAt ? (first.closedReason || note) : first.closedReason,
    },
  });

  const lastScaled = scaleTimes(last, last.loginAt, checkOutAt);
  const updated = await prisma.csrWorkSession.update({
    where: { id: last.id },
    data: {
      logoutAt: checkOutAt,
      dashboardMs: lastScaled.dashboardMs,
      awayMs: lastScaled.awayMs,
      lastHeartbeatAt: checkOutAt ?? new Date(),
      lastVisible: true,
      closedReason: checkOutAt ? note : null,
    },
  });

  return {
    ok: true as const,
    session: updated,
    csrName: user.name,
  };
}

/** Remove a day's sessions so check-in works again. CEO can edit a new punch after. */
export async function adminClearCsrWorkDay(memberIds: string[]) {
  const ids = [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { ok: false as const, message: "Session id required." };
  const rows = await prisma.csrWorkSession.findMany({
    where: { id: { in: ids } },
    select: { id: true, user: { select: { role: true } } },
  });
  const allowed = rows.filter((row) => row.user.role === "csr" || row.user.role === "estimator");
  if (!allowed.length) return { ok: false as const, message: "Session not found." };
  await prisma.csrWorkSession.deleteMany({ where: { id: { in: allowed.map((row) => row.id) } } });
  return { ok: true as const, removed: allowed.length };
}

function historyDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, (m || 1) - 1, d || 1)));
}

function historyClock(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

/** Recent days: first check-in and last check-out. CSR days run 5:00 PM PKT to the next 5:00 PM. */
export async function listUserShiftHistory(userId: string, evening = false) {
  const since = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const rows = await prisma.csrWorkSession.findMany({
    where: { userId, loginAt: { gte: since } },
    orderBy: { loginAt: "asc" },
    select: { loginAt: true, logoutAt: true },
  });
  const tz = evening ? "Asia/Karachi" : CSR_REPORT_TIMEZONE;
  type Bucket = { day: string; first: Date; lastOut: Date | null; open: boolean };
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const day = evening ? pktShiftDay(row.loginAt) : estDateYmd(row.loginAt, tz);
    const hit = map.get(day);
    if (!hit) {
      map.set(day, { day, first: row.loginAt, lastOut: row.logoutAt, open: !row.logoutAt });
      continue;
    }
    if (row.loginAt < hit.first) hit.first = row.loginAt;
    if (!row.logoutAt) {
      hit.open = true;
      hit.lastOut = null;
    } else if (!hit.open && row.logoutAt && (!hit.lastOut || row.logoutAt > hit.lastOut)) {
      hit.lastOut = row.logoutAt;
    }
  }
  const days = [...map.values()]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 30)
    .map((bucket) => {
      const checkInCal = pktNow(bucket.first).day;
      const checkOutCal = bucket.lastOut ? pktNow(bucket.lastOut).day : null;
      const overnight = evening
        ? !!checkOutCal && checkOutCal > checkInCal
        : !!checkOutCal && estDateYmd(bucket.lastOut!, tz) > bucket.day;
      const checkOutDay = evening ? checkOutCal : (bucket.lastOut ? estDateYmd(bucket.lastOut, tz) : null);
      return {
        day: bucket.day,
        dayLabel: historyDayLabel(bucket.day),
        checkIn: historyClock(bucket.first, tz),
        checkOut: bucket.open || !bucket.lastOut ? null : historyClock(bucket.lastOut, tz),
        overnight,
        checkOutLabel: overnight && checkOutDay ? historyDayLabel(checkOutDay) : null,
        checkInLabel: evening && checkInCal !== bucket.day ? historyDayLabel(checkInCal) : null,
      };
    });
  return days;
}
