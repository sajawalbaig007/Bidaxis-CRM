"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openCsrWorkSession = openCsrWorkSession;
exports.tickCsrWorkSession = tickCsrWorkSession;
exports.closeCsrWorkSession = closeCsrWorkSession;
exports.buildCsrSessionReport = buildCsrSessionReport;
const db_1 = __importDefault(require("../config/db"));
const sessions_1 = require("./sessions");
const estTime_1 = require("./estTime");
const MAX_TICK_MS = 5 * 60 * 1000;
/**
 * Reports: gaps longer than this (lock / sleep / no heartbeat) count as away.
 * Matches Users-page presence threshold but does not close the work session.
 */
const SILENCE_MS = 90000;
function openSessionWhere(userId) {
    return { userId, logoutAt: null };
}
async function findOpenSession(userId) {
    return db_1.default.csrWorkSession.findFirst({
        where: openSessionWhere(userId),
        orderBy: { loginAt: "desc" },
    });
}
async function applyHeartbeatTick(session, tabVisible, now = new Date()) {
    const prevAt = session.lastHeartbeatAt ?? session.loginAt;
    const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());
    let dashboardMs = session.dashboardMs;
    let awayMs = session.awayMs;
    if (rawDelta > SILENCE_MS) {
        // Lock / sleep / no network — full gap counts as away, session stays open.
        awayMs += rawDelta;
    }
    else {
        const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
        dashboardMs += session.lastVisible ? deltaMs : 0;
        awayMs += !session.lastVisible ? deltaMs : 0;
    }
    return db_1.default.csrWorkSession.update({
        where: { id: session.id },
        data: {
            dashboardMs,
            awayMs,
            lastHeartbeatAt: now,
            lastVisible: tabVisible,
        },
    });
}
async function openCsrWorkSession(opts) {
    try {
        await closeCsrWorkSession(opts.userId, "session_replaced");
        const ua = opts.userAgent ?? "";
        await db_1.default.csrWorkSession.create({
            data: {
                userId: opts.userId,
                loginAt: new Date(),
                lastHeartbeatAt: new Date(),
                lastVisible: true,
                ip: opts.ip ?? null,
                browser: ua ? (0, sessions_1.detectBrowser)(ua) : null,
                deviceId: opts.deviceId ?? null,
            },
        });
    }
    catch (err) {
        console.log("[csr-session] open failed:", err);
    }
}
async function tickCsrWorkSession(opts) {
    try {
        const session = await findOpenSession(opts.userId);
        if (!session)
            return;
        await applyHeartbeatTick(session, opts.tabVisible);
        if (opts.deviceId && opts.deviceId !== session.deviceId) {
            await db_1.default.csrWorkSession.update({
                where: { id: session.id },
                data: { deviceId: opts.deviceId },
            });
        }
    }
    catch (err) {
        console.log("[csr-session] tick failed:", err);
    }
}
async function closeCsrWorkSession(userId, reason) {
    try {
        const session = await findOpenSession(userId);
        if (!session)
            return;
        await applyHeartbeatTick(session, session.lastVisible);
        await db_1.default.csrWorkSession.update({
            where: { id: session.id },
            data: {
                logoutAt: new Date(),
                closedReason: reason,
            },
        });
    }
    catch (err) {
        console.log("[csr-session] close failed:", err);
    }
}
function liveTotals(session) {
    const now = new Date();
    let dashboardMs = session.dashboardMs;
    let awayMs = session.awayMs;
    if (!session.logoutAt) {
        const prevAt = session.lastHeartbeatAt ?? session.loginAt;
        const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());
        if (rawDelta > SILENCE_MS) {
            awayMs += rawDelta;
        }
        else {
            const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
            if (session.lastVisible)
                dashboardMs += deltaMs;
            else
                awayMs += deltaMs;
        }
    }
    const endAt = session.logoutAt ?? now;
    const totalMs = Math.max(0, endAt.getTime() - session.loginAt.getTime());
    return { dashboardMs, awayMs, totalMs };
}
async function buildCsrSessionReport(opts) {
    const range = {};
    if (opts.from)
        range.gte = opts.from;
    if (opts.to)
        range.lte = opts.to;
    const where = {
        ...(opts.csrId ? { userId: opts.csrId } : {}),
        ...(range.gte || range.lte ? { loginAt: range } : {}),
        user: { role: "csr" },
    };
    const rows = await db_1.default.csrWorkSession.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, csrCode: true } },
        },
        orderBy: { loginAt: "desc" },
        take: 5000,
    });
    const sessions = rows.map(row => {
        const { dashboardMs, awayMs, totalMs } = liveTotals(row);
        return {
            id: row.id,
            csrId: row.user.id,
            csrName: row.user.name,
            csrCode: row.user.csrCode,
            loginAt: row.loginAt.toISOString(),
            loginAtEst: (0, estTime_1.formatEstDateTime)(row.loginAt),
            logoutAt: row.logoutAt?.toISOString() ?? null,
            logoutAtEst: row.logoutAt ? (0, estTime_1.formatEstDateTime)(row.logoutAt) : "Still active",
            dashboardDuration: (0, estTime_1.formatDurationMs)(dashboardMs),
            awayDuration: (0, estTime_1.formatDurationMs)(awayMs),
            totalDuration: (0, estTime_1.formatDurationMs)(totalMs),
            dashboardMs,
            awayMs,
            totalMs,
            status: row.logoutAt ? "closed" : "active",
            browser: row.browser,
            ip: row.ip,
            closedReason: row.closedReason,
        };
    });
    const summaryMap = new Map();
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
                dashboardDuration: (0, estTime_1.formatDurationMs)(s.dashboardMs),
                awayDuration: (0, estTime_1.formatDurationMs)(s.awayMs),
                totalDuration: (0, estTime_1.formatDurationMs)(s.totalMs),
            });
            continue;
        }
        hit.sessions += 1;
        hit.dashboardMs += s.dashboardMs;
        hit.awayMs += s.awayMs;
        hit.totalMs += s.totalMs;
        hit.dashboardDuration = (0, estTime_1.formatDurationMs)(hit.dashboardMs);
        hit.awayDuration = (0, estTime_1.formatDurationMs)(hit.awayMs);
        hit.totalDuration = (0, estTime_1.formatDurationMs)(hit.totalMs);
    }
    return {
        sessions,
        summary: [...summaryMap.values()].sort((a, b) => a.csrName.localeCompare(b.csrName)),
    };
}
