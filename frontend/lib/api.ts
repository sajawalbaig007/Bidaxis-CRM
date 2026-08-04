import axios from "axios";
import toast from "react-hot-toast";
import { getClientDeviceMacLikeId } from "./deviceIdentity";

let clientAuthToken: string | null = null;

/** Keep JWT in-memory only (no local/session storage persistence). */
export function setClientAuthToken(token: string | null): void {
  clientAuthToken = token ?? null;
}

export function getClientAuthToken(): string | null {
  return clientAuthToken;
}

/** Current logged-in user id from JWT (client cache scoping). */
export function getTokenUserId(): string | null {
  const token = getClientAuthToken();
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { id?: string; sub?: string };
    return payload.id ?? payload.sub ?? null;
  } catch {
    return null;
  }
}

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Browser → same-origin `/api/backend` proxy (forwards httpOnly session cookie).
 * Server-side / SSR → direct BACKEND_URL.
 */
export function resolveBaseURL(): string {
  const direct = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

  if (typeof window !== "undefined") {
    if (isLocalHost()) {
      return "/api/backend";
    }
    if (direct && !/localhost|127\.0\.0\.1/i.test(direct)) return direct;
    return "/api/backend";
  }

  const root = backendRoot();
  return `${root}/api`;
}

function backendRoot(): string {
  const raw =
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ??
    "http://127.0.0.1:5000";
  return raw.replace(/\/$/, "").replace(/:\/\/localhost\b/i, "://127.0.0.1");
}

export function getApiBase(): string {
  return resolveBaseURL();
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${esc}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? "") : "";
}

const API = axios.create({
  withCredentials: true,
  timeout: 30_000,
});

let handling401 = false;

API.interceptors.request.use((config) => {
  config.baseURL = resolveBaseURL();
  const method = String(config.method ?? "get").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrf = readCookie("csrf_token");
    if (csrf) config.headers["X-CSRF-Token"] = csrf;
  }
  const token = getClientAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const device = getClientDeviceMacLikeId();
  if (device) {
    config.headers["X-Client-Mac"] = device;
  }
  return config;
});

API.interceptors.response.use(
  r => r,
  err => {
    const status = err?.response?.status;
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const isProtected =
      path.startsWith("/admin") ||
      path.startsWith("/csr") ||
      path.startsWith("/manager") ||
      path.startsWith("/technical") ||
      path.startsWith("/accounts");

    if (
      status === 401 &&
      typeof window !== "undefined" &&
      isProtected &&
      !handling401
    ) {
      handling401 = true;
      setClientAuthToken(null);
      void fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      toast.error("Session expired. Please log in again.", { duration: 4000 });
      setTimeout(() => { window.location.href = "/"; }, 1200);
    }
    return Promise.reject(err);
  }
);

export default API;

export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  const e = err as {
    response?: { status?: number; data?: { message?: string } };
    code?: string;
    message?: string;
  };
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.response?.status === 404) {
    return "API not found. Redeploy frontend and set BACKEND_URL on Vercel.";
  }
  if (e?.response?.status === 502) {
    return "API server unreachable. Set BACKEND_URL on Vercel to your Render backend URL.";
  }
  if (e?.response?.status === 429) return "Too many attempts. Please wait and try again.";
  if (!e?.response) {
    if (isLocalHost()) return "Cannot reach backend. Start it: cd backend && npm run dev";
    return "Cannot reach server. Check BACKEND_URL on Vercel.";
  }
  if (e?.code === "ECONNABORTED") return "Request timed out. Please try again.";
  return fallback;
}
