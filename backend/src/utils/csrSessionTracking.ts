import prisma from "../config/db";
import { detectBrowser } from "./sessions";
import { formatDurationMs, formatEstDateTime } from "./estTime";

const MAX_TICK_MS = 5 * 60 * 1000;
/**
 * Reports: gaps longer than this (lock / sleep / no heartbeat) count as away.
 * Matches Users-page presence threshold but does not close the work session.
 */
const SILENCE_MS = 90_000;
/** Open sessions older than this are auto-closed (forgotten check-outs / zombies). */
const MAX_OPEN_SESSION_MS = 16 * 60 * 60 * 1000;

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

function isStaleOpenSession(loginAt: Date, now = new Date()) {
  return sessionAgeMs(loginAt, now) > MAX_OPEN_SESSION_MS;
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
 * Keep at most one open session: drop stale (>16h) and close older duplicates.
 * Returns the single active session, or null if none / all closed.
 */
async function reconcileOpenSessions(userId: string) {
  const sessions = await findAllOpenSessions(userId);
  if (sessions.length === 0) return null;

  const now = new Date();
  const [newest, ...older] = sessions;

  for (const session of older) {
    await finalizeOpenSession(session, "session_replaced", now);
  }

  if (isStaleOpenSession(newest.loginAt, now)) {
    await finalizeOpenSession(newest, "stale_timeout", now);
    return null;
  }

  return newest;
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

export async function tickCsrWorkSession(opts: {
  userId: string;
  tabVisible: boolean;
  deviceId?: string;
}): Promise<void> {
  try {
    const session = await reconcileOpenSessions(opts.userId);
    if (!session) return;

    await applyHeartbeatTick(session, opts.tabVisible);

    if (opts.deviceId && opts.deviceId !== session.deviceId) {
      await prisma.csrWorkSession.update({
        where: { id: session.id },
        data:  { deviceId: opts.deviceId },
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
};

function closedReasonLabel(reason: string | null, hasLogout: boolean): string {
  if (!hasLogout) return "Still checked in";
  switch ((reason ?? "").toLowerCase()) {
    case "stale_timeout": return "Auto (stale)";
    case "check_out": return "Check Out";
    case "logout": return "Logout";
    case "session_replaced": return "New check-in";
    case "logout_all": return "Logout all";
    case "admin_adjusted": return "Admin adjusted";
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

export async function buildCsrSessionReport(opts: {
  from?: Date;
  to?: Date;
  csrId?: string;
}): Promise<{ sessions: CsrSessionReportRow[]; summary: CsrSessionSummary[] }> {
  /* Clean zombies before reporting so Totals / Still checked-in stay accurate */
  try {
    const openWhere = {
      ...(opts.csrId ? { userId: opts.csrId } : {}),
      OR: [{ logoutAt: null }, { logoutAt: { isSet: false } }],
      user: { role: "csr" as const },
    };
    const openRows = await prisma.csrWorkSession.findMany({
      where: openWhere,
      orderBy: { loginAt: "desc" },
      take: 2000,
    });
    const now = new Date();
    const seen = new Set<string>();
    for (const row of openRows) {
      if (seen.has(row.userId) || isStaleOpenSession(row.loginAt, now)) {
        await finalizeOpenSession(row, seen.has(row.userId) ? "session_replaced" : "stale_timeout", now);
        continue;
      }
      seen.add(row.userId);
    }
  } catch (err) {
    console.log("[csr-session] report cleanup failed:", err);
  }

  const range: { gte?: Date; lte?: Date } = {};
  if (opts.from) range.gte = opts.from;
  if (opts.to) range.lte = opts.to;

  const where = {
    ...(opts.csrId ? { userId: opts.csrId } : {}),
    ...(range.gte || range.lte ? { loginAt: range } : {}),
    user: { role: "csr" as const },
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
    const logoutAtEst = row.logoutAt ? formatEstDateTime(row.logoutAt) : "Still checked in";
    return {
      id: row.id,
      csrId: row.user.id,
      csrName: row.user.name,
      csrCode: row.user.csrCode,
      loginAt: row.loginAt.toISOString(),
      loginAtEst: formatEstDateTime(row.loginAt),
      logoutAt: row.logoutAt?.toISOString() ?? null,
      logoutAtEst,
      checkInAtEst: formatEstDateTime(row.loginAt),
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
    };
  });

  const summaryMap = new Map<string, CsrSessionSummary>();
  for (const s of sessions) {
    const hit = summaryMap.get(s.csrId);
    if (!hit) {
      summaryMap.set(s.csrId, {
        csrId: s.csrId,
        csrName: s.csrName,
        csrCode: s.csrCode,
        sessions: 1,
        dashboardMs: s.dashboardMs,
        awayMs: s.awayMs,
        totalMs: s.totalMs,
        dashboardDuration: formatDurationMs(s.dashboardMs),
        awayDuration: formatDurationMs(s.awayMs),
        totalDuration: formatDurationMs(s.totalMs),
      });
      continue;
    }
    hit.sessions += 1;
    hit.dashboardMs += s.dashboardMs;
    hit.awayMs += s.awayMs;
    hit.totalMs += s.totalMs;
    hit.dashboardDuration = formatDurationMs(hit.dashboardMs);
    hit.awayDuration = formatDurationMs(hit.awayMs);
    hit.totalDuration = formatDurationMs(hit.totalMs);
  }

  return {
    sessions,
    summary: [...summaryMap.values()].sort((a, b) => a.csrName.localeCompare(b.csrName)),
  };
}

/** Admin override of check-in / check-out times (EST wall-clock → stored UTC). */
export async function adminAdjustCsrWorkSession(opts: {
  sessionId: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  clearCheckOut?: boolean;
  dashboardMs?: number;
  awayMs?: number;
  note?: string;
}) {
  const session = await prisma.csrWorkSession.findUnique({
    where: { id: opts.sessionId },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  if (!session || session.user.role !== "csr") {
    return { ok: false as const, message: "Session not found." };
  }

  const checkInAt = opts.checkInAt;
  let checkOutAt: Date | null =
    opts.clearCheckOut ? null : (opts.checkOutAt ?? session.logoutAt);

  if (checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) {
    return { ok: false as const, message: "Check-out must be after check-in." };
  }

  const endAt = checkOutAt ?? new Date();
  const totalMs = Math.max(0, endAt.getTime() - checkInAt.getTime());

  let dashboardMs = opts.dashboardMs;
  let awayMs = opts.awayMs;

  if (dashboardMs === undefined && awayMs === undefined) {
    const prevTotal = Math.max(1, session.dashboardMs + session.awayMs);
    if (session.dashboardMs + session.awayMs > 0 && totalMs > 0) {
      const ratio = session.dashboardMs / prevTotal;
      dashboardMs = Math.round(totalMs * ratio);
      awayMs = Math.max(0, totalMs - dashboardMs);
    } else {
      dashboardMs = totalMs;
      awayMs = 0;
    }
  } else {
    dashboardMs = Math.max(0, dashboardMs ?? session.dashboardMs);
    awayMs = Math.max(0, awayMs ?? session.awayMs);
  }

  const updated = await prisma.csrWorkSession.update({
    where: { id: session.id },
    data: {
      loginAt: checkInAt,
      logoutAt: checkOutAt,
      dashboardMs,
      awayMs,
      lastHeartbeatAt: checkOutAt ?? new Date(),
      lastVisible: true,
      closedReason: checkOutAt
        ? (opts.note?.trim() || "admin_adjusted")
        : null,
    },
  });

  return {
    ok: true as const,
    session: updated,
    csrName: session.user.name,
  };
}
