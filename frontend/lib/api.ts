import axios from "axios";
import toast from "react-hot-toast";

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api",
  withCredentials: true,
});

API.interceptors.response.use(
  r => r,
  err => {
    if (
      err?.response?.status === 401 &&
      err?.response?.data?.code === "SESSION_INVALID" &&
      typeof window !== "undefined"
    ) {
      void fetch("/api/auth/clear-session", { method: "POST", credentials: "include" });
      toast.error("Session expired. Please log in again.", { duration: 4000 });
      setTimeout(() => { window.location.href = "/"; }, 1200);
    }
    return Promise.reject(err);
  }
);

export default API;
