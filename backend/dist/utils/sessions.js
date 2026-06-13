"use strict";
/* ─────────────────────────────────────────────────
   Shared in-memory stores
───────────────────────────────────────────────── */
Object.defineProperty(exports, "__esModule", { value: true });
exports.userBrowserMap = exports.otpResendCount = exports.otpAttempts = exports.otpStore = void 0;
exports.detectBrowser = detectBrowser;
/* OTP store: userId → { otp, expiresAt } */
exports.otpStore = new Map();
/* OTP wrong attempts: userId → { count, blockedUntil? } */
exports.otpAttempts = new Map();
/* OTP resend count: userId → number (max 1 resend) */
exports.otpResendCount = new Map();
/* Browser/Tab info: userId → { browser, tabId, openedAt, tabVisible, hiddenAt } */
exports.userBrowserMap = new Map();
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
