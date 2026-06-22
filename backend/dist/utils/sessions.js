"use strict";
/* ─────────────────────────────────────────────────
   Shared in-memory stores
───────────────────────────────────────────────── */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginAttemptAlerts = exports.activeSessions = exports.userBrowserMap = exports.otpResendCount = exports.otpAttempts = exports.otpStore = void 0;
exports.getActiveSession = getActiveSession;
exports.registerActiveSession = registerActiveSession;
exports.touchActiveSession = touchActiveSession;
exports.clearActiveSession = clearActiveSession;
exports.recordLoginAttempt = recordLoginAttempt;
exports.getLoginAttemptAlert = getLoginAttemptAlert;
exports.detectBrowser = detectBrowser;
/* OTP store: userId → { otp, expiresAt } */
exports.otpStore = new Map();
/* OTP wrong attempts: userId → { count, blockedUntil? } */
exports.otpAttempts = new Map();
/* OTP resend count: userId → number (max 1 resend) */
exports.otpResendCount = new Map();
/* Browser/Tab info: userId → { browser, tabId, openedAt, tabVisible, hiddenAt } */
exports.userBrowserMap = new Map();
exports.activeSessions = new Map();
exports.loginAttemptAlerts = new Map();
let loginAttemptSeq = 0;
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min without activity → allow re-login
function getActiveSession(userId) {
    const session = exports.activeSessions.get(userId);
    if (!session)
        return null;
    if (Date.now() - session.at > SESSION_IDLE_MS) {
        exports.activeSessions.delete(userId);
        return null;
    }
    return session;
}
function registerActiveSession(userId, sid, tv) {
    exports.activeSessions.set(userId, { sid, tv, at: Date.now() });
}
function touchActiveSession(userId) {
    const session = exports.activeSessions.get(userId);
    if (session)
        session.at = Date.now();
}
function clearActiveSession(userId) {
    exports.activeSessions.delete(userId);
}
function recordLoginAttempt(userId) {
    loginAttemptSeq += 1;
    exports.loginAttemptAlerts.set(userId, { attemptId: loginAttemptSeq, at: Date.now() });
    return loginAttemptSeq;
}
function getLoginAttemptAlert(userId) {
    return exports.loginAttemptAlerts.get(userId) ?? null;
}
/* ── Detect browser from User-Agent ── */
function detectBrowser(ua) {
    if (!ua)
        return "Unknown";
    if (ua.includes("Edg/"))
        return "Edge";
    if (ua.includes("OPR/") || ua.includes("Opera/"))
        return "Opera";
    if (ua.includes("Chrome/"))
        return "Chrome";
    if (ua.includes("Firefox/"))
        return "Firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome/"))
        return "Safari";
    return "Browser";
}
