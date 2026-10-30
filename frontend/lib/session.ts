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
    const payload = JSON.parse(atob(padded)) as { role?: string };
    return String(payload.role ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function asLoginBody(data: unknown): { role?: string; user?: { role?: string }; token?: string } {
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  const inner =
    o.data && typeof o.data === "object" && !Array.isArray(o.data) && !(o.role || o.token || o.user)
      ? (o.data as Record<string, unknown>)
      : o;
  const user = inner.user && typeof inner.user === "object" ? (inner.user as { role?: string }) : undefined;
  return {
    role: typeof inner.role === "string" ? inner.role : user?.role,
    user,
    token: typeof inner.token === "string" ? inner.token : typeof o.token === "string" ? o.token : undefined,
  };
}

export function resolveLoginRole(data: unknown): PortalRole | null {
  const body = asLoginBody(data);
  const r = String(body.role ?? body.user?.role ?? roleFromToken(body.token) ?? "")
    .trim()
    .toLowerCase();
  if (r === "ceo") return "admin";
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

export function loginTokenFrom(data: unknown): string {
  return (asLoginBody(data).token ?? "").trim();
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
