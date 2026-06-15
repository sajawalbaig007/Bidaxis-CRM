/* ─────────────────────────────────────────────────
   Shared in-memory stores
───────────────────────────────────────────────── */

/* OTP store: userId → { otp, expiresAt } */
export const otpStore = new Map<string, { otp: string; expiresAt: number }>();

/* OTP wrong attempts: userId → { count, blockedUntil? } */
export const otpAttempts = new Map<string, { count: number; blockedUntil?: number }>();

/* OTP resend count: userId → number (max 1 resend) */
export const otpResendCount = new Map<string, number>();

/* Browser/Tab info: userId → { browser, tabId, openedAt, tabVisible, hiddenAt } */
export const userBrowserMap = new Map<string, {
  browser:     string;
  tabId:       string;
  openedAt:    string;
  tabVisible:  boolean;   // true = on dashboard, false = switched to another tab
  hiddenAt:    string | null;  // when they left dashboard
}>();

/* ── Detect browser from User-Agent ── */
export function detectBrowser(ua: string): string {
  if (!ua)                                              return "Unknown";
  if (ua.includes("Edg/"))                             return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/"))   return "Opera";
  if (ua.includes("Chrome/"))                          return "Chrome";
  if (ua.includes("Firefox/"))                         return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return "Browser";
}