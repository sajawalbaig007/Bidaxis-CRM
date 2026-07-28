"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openCsrWorkSession = openCsrWorkSession;
exports.checkInCsrWorkSession = checkInCsrWorkSession;
exports.checkOutCsrWorkSession = checkOutCsrWorkSession;
exports.getCsrWorkSessionStatus = getCsrWorkSessionStatus;
exports.tickCsrWorkSession = tickCsrWorkSession;
exports.closeCsrWorkSession = closeCsrWorkSession;
exports.buildCsrSessionReport = buildCsrSessionReport;
exports.adminAdjustCsrWorkSession = adminAdjustCsrWorkSession;
const db_1 = __importDefault(require("../config/db"));
const sessions_1 = require("./sessions");
const estTime_1 = require("./estTime");
const MAX_TICK_MS = 5 * 60 * 1000;
/**
 * Reports: gaps longer than this (lock / sleep / no heartbeat) count as away.
 * Matches Users-page presence threshold but does not close the work session.
 */
const SILENCE_MS = 90000;
/** Open sessions older than this are auto-closed (forgotten check-outs / zombies). */
const MAX_OPEN_SESSION_MS = 16 * 60 * 60 * 1000;
function openSessionWhere(userId) {
    /* MongoDB: null filter alone can miss docs where logoutAt was never set. */
    return {
        userId,
        OR: [
            { logoutAt: null },
            { logoutAt: { isSet: false } },
        ],
    };
}
async function findAllOpenSessions(userId) {
    return db_1.default.csrWorkSession.findMany({
        where: openSessionWhere(userId),
        orderBy: { loginAt: "desc" },
    });
}
function sessionAgeMs(loginAt, now = new Date()) {
    return Math.max(0, now.getTime() - new Date(loginAt).getTime());
}
function isStaleOpenSession(loginAt, now = new Date()) {
    return sessionAgeMs(loginAt, now) > MAX_OPEN_SESSION_MS;
}
async function finalizeOpenSession(session, reason, now = new Date()) {
    try {
        await applyHeartbeatTick(session, session.lastVisible, now);
    }
    catch {
        /* still close even if tick fails */
    }
    await db_1.default.csrWorkSession.update({
        where: { id: session.id },
        data: {
            logoutAt: now,
            closedReason: reason,
        },
    });
}
/**
 * Keep at most one open session: drop stale (>16h) and close older duplicates.
 * Returns the single active session, or null if none / all closed.
 */
async function reconcileOpenSessions(userId) {
    const sessions = await findAllOpenSessions(userId);
    if (sessions.length === 0)
        return null;
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
async function applyHeartbeatTick(session, tabVisible, now = new Date()) {
    const prevAt = session.lastHeartbeatAt ?? session.loginAt;
    const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());
    const wallMs = sessionAgeMs(session.loginAt, now);
    let dashboardMs = session.dashboardMs;
    let awayMs = session.awayMs;
    if (rawDelta > SILENCE_MS) {
        // Lock / sleep / no network — count gap as away, but never past wall-clock.
        const room = Math.max(0, wallMs - (dashboardMs + awayMs));
        awayMs += Math.min(rawDelta, room);
    }
    else {
        const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
        dashboardMs += session.lastVisible ? deltaMs : 0;
        awayMs += !session.lastVisible ? deltaMs : 0;
    }
    /* Clamp so stored counters never exceed elapsed wall time */
    const sum = dashboardMs + awayMs;
    if (sum > wallMs && sum > 0) {
        const scale = wallMs / sum;
        dashboardMs = Math.round(dashboardMs * scale);
        awayMs = Math.max(0, wallMs - dashboardMs);
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
                logoutAt: null,
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
/** Explicit CSR Check In — resumes a fresh same-day session; replaces stale/duplicates. */
async function checkInCsrWorkSession(opts) {
    const existing = await reconcileOpenSessions(opts.userId);
    if (existing) {
        return { created: false, sessionId: existing.id, loginAt: existing.loginAt };
    }
    const ua = opts.userAgent ?? "";
    const created = await db_1.default.csrWorkSession.create({
        data: {
            userId: opts.userId,
            loginAt: new Date(),
            logoutAt: null,
            lastHeartbeatAt: new Date(),
            lastVisible: true,
            ip: opts.ip ?? null,
            browser: ua ? (0, sessions_1.detectBrowser)(ua) : null,
            deviceId: opts.deviceId ?? null,
        },
    });
    return { created: true, sessionId: created.id, loginAt: created.loginAt };
}
async function checkOutCsrWorkSession(userId) {
    const closed = await closeCsrWorkSession(userId, "check_out");
    return closed > 0;
}
async function getCsrWorkSessionStatus(userId) {
    const session = await reconcileOpenSessions(userId);
    if (!session) {
        return {
            checkedIn: false,
            session: null,
        };
    }
    const { dashboardMs, awayMs, totalMs } = liveTotals(session);
    return {
        checkedIn: true,
        session: {
            id: session.id,
            checkInAt: session.loginAt.toISOString(),
            checkInAtEst: (0, estTime_1.formatEstDateTime)(session.loginAt),
            dashboardMs,
            awayMs,
            totalMs,
            dashboardDuration: (0, estTime_1.formatDurationMs)(dashboardMs),
            awayDuration: (0, estTime_1.formatDurationMs)(awayMs),
            totalDuration: (0, estTime_1.formatDurationMs)(totalMs),
        },
    };
}
async function tickCsrWorkSession(opts) {
    try {
        const session = await reconcileOpenSessions(opts.userId);
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
/** Close every open work session for this CSR (handles zombie duplicates). */
async function closeCsrWorkSession(userId, reason) {
    try {
        const sessions = await findAllOpenSessions(userId);
        if (sessions.length === 0)
            return 0;
        const now = new Date();
        for (const session of sessions) {
            await finalizeOpenSession(session, reason, now);
        }
        return sessions.length;
    }
    catch (err) {
        console.log("[csr-session] close failed:", err);
        return 0;
    }
}
function closedReasonLabel(reason, hasLogout) {
    if (!hasLogout)
        return "Still checked in";
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
function liveTotals(session) {
    const now = new Date();
    let dashboardMs = session.dashboardMs;
    let awayMs = session.awayMs;
    const endAt = session.logoutAt ?? now;
    const totalMs = Math.max(0, endAt.getTime() - new Date(session.loginAt).getTime());
    if (!session.logoutAt) {
        const prevAt = session.lastHeartbeatAt ?? session.loginAt;
        const rawDelta = Math.max(0, now.getTime() - new Date(prevAt).getTime());
        if (rawDelta > SILENCE_MS) {
            const room = Math.max(0, totalMs - (dashboardMs + awayMs));
            awayMs += Math.min(rawDelta, room);
        }
        else {
            const deltaMs = Math.min(MAX_TICK_MS, rawDelta);
            if (session.lastVisible)
                dashboardMs += deltaMs;
            else
                awayMs += deltaMs;
        }
    }
    const sum = dashboardMs + awayMs;
    if (sum > totalMs && sum > 0) {
        const scale = totalMs / sum;
        dashboardMs = Math.round(dashboardMs * scale);
        awayMs = Math.max(0, totalMs - dashboardMs);
    }
    return { dashboardMs, awayMs, totalMs };
}
async function buildCsrSessionReport(opts) {
    /* Clean zombies before reporting so Totals / Still checked-in stay accurate */
    try {
        const openWhere = {
            ...(opts.csrId ? { userId: opts.csrId } : {}),
            OR: [{ logoutAt: null }, { logoutAt: { isSet: false } }],
            user: { role: "csr" },
        };
        const openRows = await db_1.default.csrWorkSession.findMany({
            where: openWhere,
            orderBy: { loginAt: "desc" },
            take: 2000,
        });
        const now = new Date();
        const seen = new Set();
        for (const row of openRows) {
            if (seen.has(row.userId) || isStaleOpenSession(row.loginAt, now)) {
                await finalizeOpenSession(row, seen.has(row.userId) ? "session_replaced" : "stale_timeout", now);
                continue;
            }
            seen.add(row.userId);
        }
    }
    catch (err) {
        console.log("[csr-session] report cleanup failed:", err);
    }
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
        const logoutAtEst = row.logoutAt ? (0, estTime_1.formatEstDateTime)(row.logoutAt) : "Still checked in";
        return {
            id: row.id,
            csrId: row.user.id,
            csrName: row.user.name,
            csrCode: row.user.csrCode,
            loginAt: row.loginAt.toISOString(),
            loginAtEst: (0, estTime_1.formatEstDateTime)(row.loginAt),
            logoutAt: row.logoutAt?.toISOString() ?? null,
            logoutAtEst,
            checkInAtEst: (0, estTime_1.formatEstDateTime)(row.loginAt),
            checkOutAtEst: logoutAtEst,
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
            closedReasonLabel: closedReasonLabel(row.closedReason, !!row.logoutAt),
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
/** Admin override of check-in / check-out times (EST wall-clock → stored UTC). */
async function adminAdjustCsrWorkSession(opts) {
    const session = await db_1.default.csrWorkSession.findUnique({
        where: { id: opts.sessionId },
        include: { user: { select: { id: true, name: true, role: true } } },
    });
    if (!session || session.user.role !== "csr") {
        return { ok: false, message: "Session not found." };
    }
    const checkInAt = opts.checkInAt;
    let checkOutAt = opts.clearCheckOut ? null : (opts.checkOutAt ?? session.logoutAt);
    if (checkOutAt && checkOutAt.getTime() < checkInAt.getTime()) {
        return { ok: false, message: "Check-out must be after check-in." };
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
        }
        else {
            dashboardMs = totalMs;
            awayMs = 0;
        }
    }
    else {
        dashboardMs = Math.max(0, dashboardMs ?? session.dashboardMs);
        awayMs = Math.max(0, awayMs ?? session.awayMs);
    }
    const updated = await db_1.default.csrWorkSession.update({
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
        ok: true,
        session: updated,
        csrName: session.user.name,
    };
}
