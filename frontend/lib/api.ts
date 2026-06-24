import axios from "axios";
import toast from "react-hot-toast";

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/**
 * Local dev → direct backend (fast, CORS allowed).
 * Production (dashboard.bemsolutions.io etc.) → /api/backend proxy (same-origin cookies).
 */
export function resolveBaseURL(): string {
  if (typeof window !== "undefined") {
    if (isLocalHost()) {
      return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api").replace(/\/$/, "");
    }
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

const API = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: true,
  timeout: 30_000,
});

API.interceptors.response.use(
  r => r,
  err => {
    if (
      err?.response?.status === 401 &&
      err?.response?.data?.code === "SESSION_INVALID" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/"
    ) {
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
