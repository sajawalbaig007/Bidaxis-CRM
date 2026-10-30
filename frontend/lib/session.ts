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
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { role?: string };
    return String(payload.role ?? "");
  } catch {
    return "";
  }
}

export function resolveLoginRole(data: {
  role?: string;
  user?: { role?: string };
  token?: string;
}): PortalRole | null {
  const r = (data.role ?? data.user?.role ?? roleFromToken(data.token)).toLowerCase();
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

export type PortalRole = "admin" | "csr" | "manager" | "technical_manager" | "accounts" | "estimator" | "bim_manager" | "bim";

export function dashboardPathForRole(role: PortalRole): string {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  if (role === "technical_manager" || role === "bim_manager") return "/technical";
  if (role === "accounts") return "/accounts";
  if (role === "estimator" || role === "bim") return "/estimator";
  return "/csr";
}
