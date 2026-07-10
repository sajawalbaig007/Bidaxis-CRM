import prisma from "../config/db";
import { detectBrowser } from "./sessions";
import { formatDurationMs, formatEstDateTime } from "./estTime";

const MAX_TICK_MS = 5 * 60 * 1000;
/**
 * Reports: gaps longer than this (lock / sleep / no heartbeat) count as away.
 * Matches Users-page presence threshold but does not close the work session.
 */
const SILENCE_MS = 90_000;

function openSessionWhere(userId: string) {
  return { userId, logoutAt: null as Date | null };
}

async function findOpenSession(userId: string) {
  return prisma.csrWorkSession.findFirst({
    where: openSessionWhere(userId),
    orderBy: { loginAt: "desc" },
  });
}

async function applyHeartbeatTick(
  session: {
    id: string;
    loginAt: Date;
    dashboardMs: number;
    awayMs: number;
    lastHeartbeatAt: Date | null;
    lastVisible: boolean;
  },
  tabVisible: boolean,
  now = new Date(),
) {
  const prevAt = session.lastHeartbeatAt ?? session.loginAt;
  const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());

  let dashboardMs = session.dashboardMs;
  let awayMs = session.awayMs;

  if (rawDelta > SILENCE_MS) {
    // Lock / sleep / no network — full gap counts as away, session stays open.
    awayMs += rawDelta;
  } else {
    const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
    dashboardMs += session.lastVisible ? deltaMs : 0;
    awayMs += !session.lastVisible ? deltaMs : 0;
  }

  return prisma.csrWorkSession.update({
    where: { id: session.id },
    data: {
      dashboardMs,
      awayMs,
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

export async function tickCsrWorkSession(opts: {
  userId: string;
  tabVisible: boolean;
  deviceId?: string;
}): Promise<void> {
  try {
    const session = await findOpenSession(opts.userId);
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

export async function closeCsrWorkSession(
  userId: string,
  reason: string,
): Promise<void> {
  try {
    const session = await findOpenSession(userId);
    if (!session) return;

    await applyHeartbeatTick(session, session.lastVisible);

    await prisma.csrWorkSession.update({
      where: { id: session.id },
      data: {
        logoutAt: new Date(),
        closedReason: reason,
      },
    });
  } catch (err) {
    console.log("[csr-session] close failed:", err);
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
};

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
  lastHeartbeatAt: Date | null;
  lastVisible: boolean;
}) {
  const now = new Date();
  let dashboardMs = session.dashboardMs;
  let awayMs = session.awayMs;

  if (!session.logoutAt) {
    const prevAt = session.lastHeartbeatAt ?? session.loginAt;
    const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());

    if (rawDelta > SILENCE_MS) {
      awayMs += rawDelta;
    } else {
      const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
      if (session.lastVisible) dashboardMs += deltaMs;
      else awayMs += deltaMs;
    }
  }

  const endAt = session.logoutAt ?? now;
  const totalMs = Math.max(0, endAt.getTime() - session.loginAt.getTime());
  return { dashboardMs, awayMs, totalMs };
}

export async function buildCsrSessionReport(opts: {
  from?: Date;
  to?: Date;
  csrId?: string;
}): Promise<{ sessions: CsrSessionReportRow[]; summary: CsrSessionSummary[] }> {
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
    return {
      id: row.id,
      csrId: row.user.id,
      csrName: row.user.name,
      csrCode: row.user.csrCode,
      loginAt: row.loginAt.toISOString(),
      loginAtEst: formatEstDateTime(row.loginAt),
      logoutAt: row.logoutAt?.toISOString() ?? null,
      logoutAtEst: row.logoutAt ? formatEstDateTime(row.logoutAt) : "Still active",
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
