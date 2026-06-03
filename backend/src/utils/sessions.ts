/* ─────────────────────────────────────────────────
   Shared in-memory stores
───────────────────────────────────────────────── */

/* Logout-all: userId → timestamp */
export const loggedOutAllMap = new Map<string, number>();

/* OTP store: userId → { otp, expiresAt } */
export const otpStore = new Map<string, { otp: string; expiresAt: number }>();

/* OTP wrong attempts: userId → { count, blockedUntil? } */
export const otpAttempts = new Map<string, { count: number; blockedUntil?: number }>();

/* OTP resend count: userId → number of times resent (max 1 resend allowed) */
export const otpResendCount = new Map<string, number>();