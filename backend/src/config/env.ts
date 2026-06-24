const REQUIRED_PROD = [
  "JWT_SECRET",
  "DATABASE_URL",
  "FRONTEND_URL",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return;

  const missing = REQUIRED_PROD.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(`[Security] Missing required production env: ${missing.join(", ")}`);
  }

  const jwt = process.env.JWT_SECRET?.trim() ?? "";
  if (jwt.length < 32) {
    throw new Error("[Security] JWT_SECRET must be at least 32 characters in production.");
  }
}

export function getAdminAllowedIps(): string[] {
  const raw = process.env.ADMIN_ALLOWED_IPS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function isCaptchaConfigured(): boolean {
  return !!(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export function getSessionHours(rememberMe: boolean): number {
  if (rememberMe) return Number(process.env.SESSION_REMEMBER_HOURS ?? 168); // 7d
  return Number(process.env.SESSION_DEFAULT_HOURS ?? 12);
}
