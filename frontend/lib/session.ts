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
      return false;
    }
    return true;
  } catch (err) {
    console.error("[session] set-session error:", err);
    return false;
  }
}

/** Clear httpOnly session cookie on the Next.js domain. */
export async function clearFrontendSession(): Promise<void> {
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

export function resolveLoginRole(data: {
  role?: string;
  user?: { role?: string };
}): "admin" | "csr" | null {
  const r = (data.role ?? data.user?.role ?? "").toLowerCase();
  if (r === "admin" || r === "csr") return r;
  return null;
}

export function dashboardPathForRole(role: "admin" | "csr"): string {
  return role === "admin" ? "/admin" : "/csr";
}
