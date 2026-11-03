import { setClientAuthToken } from "./api";
import { invalidateCsrDashboardCache } from "./csrDashboardCache";
import { invalidateAllCsrListCaches } from "./csrApiCache";

function clearCsrClientCaches() {
  invalidateCsrDashboardCache();
  invalidateAllCsrListCaches();
}

/** Set httpOnly session cookie on the Next.js domain (same-origin — works with /api/backend proxy). */
export async function setFrontendSession(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/set-session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      console.error("[session] set-session failed:", data.message ?? res.status);
      setClientAuthToken(null);
      return false;
    }
    setClientAuthToken(token);
    return true;
  } catch (err) {
    console.error("[session] set-session error:", err);
    return false;
  }
}

/** Clear httpOnly session cookie on the Next.js domain. */
export async function clearFrontendSession(): Promise<void> {
  setClientAuthToken(null);
  clearCsrClientCaches();
  await fetch("/api/auth/clear-session", {
    method:      "POST",
    credentials: "include",
  });
}

/** Full logout: backend session + frontend cookie. */
export async function logoutSession(apiLogout: () => Promise<unknown>): Promise<void> {
  try { await apiLogout(); } catch { /* ignore */ }
  await clearFrontendSession();
}

function roleFromToken(token?: string): string {
  if (!token) return "";
  try {
    const part = token.split(".")[1];
    if (!part) return "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { role?: string };
    return String(payload.role ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asJwt(value: unknown): string {
  if (typeof value !== "string") return "";
  const s = value.trim().replace(/^Bearer\s+/i, "");
  const m = s.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return m?.[0] ?? "";
}

function loginTokenFromRecord(o: Record<string, unknown> | null): string {
  if (!o) return "";
  for (const key of ["token", "accessToken", "jwt", "sessionToken"]) {
    const found = asJwt(o[key]);
    if (found) return found;
  }
  return "";
}

function findJwt(value: unknown, depth = 0): string {
  if (depth > 8) return "";
  const direct = asJwt(value);
  if (direct) return direct;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return findJwt(JSON.parse(trimmed) as unknown, depth + 1);
      } catch {
        return "";
      }
    }
    return "";
  }
  const rec = asRecord(value);
  if (!rec) return "";
  const named = loginTokenFromRecord(rec);
  if (named) return named;
  for (const nested of Object.values(rec)) {
    const found = findJwt(nested, depth + 1);
    if (found) return found;
  }
  return "";
}

function asLoginBody(data: unknown): { role?: string; user?: { role?: string }; token?: string } {
  const root = asRecord(data);
  if (!root) return {};
  const nested = asRecord(root.data);
  const user =
    asRecord(root.user) ??
    asRecord(nested?.user) ??
    (nested && typeof nested.role === "string" ? nested : null);
  const token =
    loginTokenFromRecord(root) ||
    loginTokenFromRecord(nested) ||
    loginTokenFromRecord(asRecord(root.user)) ||
    loginTokenFromRecord(asRecord(nested?.user));
  const roleRaw =
    root.role ??
    root.portalRole ??
    nested?.role ??
    nested?.portalRole ??
    user?.role ??
    roleFromToken(token);
  return {
    role: typeof roleRaw === "string" ? roleRaw : undefined,
    user: user ? { role: typeof user.role === "string" ? user.role : undefined } : undefined,
    token: token || undefined,
  };
}

function normalizePortalRole(raw: string): PortalRole | null {
  const r = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (r === "ceo" || r === "owner" || r === "administrator") return "admin";
  if (r === "admin_user") return "admin";
  if (r === "chief_estimator" || r === "technicalmanager") return "technical_manager";
  if (r === "bimmanager") return "bim_manager";
  if (
    r === "admin" ||
    r === "csr" ||
    r === "manager" ||
    r === "technical_manager" ||
    r === "accounts" ||
    r === "estimator" ||
    r === "bim_manager" ||
    r === "bim"
  ) {
    return r;
  }
  return null;
}

export function resolveLoginRole(data: unknown): PortalRole | null {
  const body = asLoginBody(data);
  return normalizePortalRole(String(body.role ?? body.user?.role ?? roleFromToken(body.token) ?? ""));
}

export function loginTokenFrom(data: unknown, headerToken?: string): string {
  return (
    findJwt(data)
    || (asLoginBody(data).token ?? "").trim()
    || asJwt(headerToken)
  );
}

export type PortalRole = "admin" | "csr" | "manager" | "technical_manager" | "accounts" | "estimator" | "bim_manager" | "bim";

export function dashboardPathForRole(role: PortalRole): string {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  if (role === "technical_manager" || role === "bim_manager") return "/technical";
  if (role === "accounts") return "/accounts";
  if (role === "estimator" || role === "bim") return "/estimator";
  return "/csr";
}
