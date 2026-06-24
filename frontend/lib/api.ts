import axios from "axios";
import toast from "react-hot-toast";

/** Browser uses same-origin proxy so httpOnly auth cookies work (no third-party blocking). */
function resolveBaseURL(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  const root = (process.env.BACKEND_URL ?? "http://localhost:5000").replace(/\/$/, "");
  return `${root}/api`;
}

export function getApiBase(): string {
  return resolveBaseURL();
}

const API = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: true,
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
