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
  tabVisible:  boolean;
  hiddenAt:    string | null;
}>();

/* Active login sessions: userId → session */
export type ActiveSession = {
  sid: string;
  tv:  number;
  at:  number;
};
export const activeSessions = new Map<string, ActiveSession>();

/* Login-attempt alerts for already-logged-in users */
export type LoginAttemptAlert = {
  attemptId: number;
  at:        number;
};
export const loginAttemptAlerts = new Map<string, LoginAttemptAlert>();

let loginAttemptSeq = 0;

const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min without activity → allow re-login

export function getActiveSession(userId: string): ActiveSession | null {
  const session = activeSessions.get(userId);
  if (!session) return null;
  if (Date.now() - session.at > SESSION_IDLE_MS) {
    activeSessions.delete(userId);
    return null;
  }
  return session;
}

export function registerActiveSession(userId: string, sid: string, tv: number): void {
  activeSessions.set(userId, { sid, tv, at: Date.now() });
}

export function touchActiveSession(userId: string): void {
  const session = activeSessions.get(userId);
  if (session) session.at = Date.now();
}

export function clearActiveSession(userId: string): void {
  activeSessions.delete(userId);
}

export function recordLoginAttempt(userId: string): number {
  loginAttemptSeq += 1;
  loginAttemptAlerts.set(userId, { attemptId: loginAttemptSeq, at: Date.now() });
  return loginAttemptSeq;
}

export function getLoginAttemptAlert(userId: string): LoginAttemptAlert | null {
  return loginAttemptAlerts.get(userId) ?? null;
}

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