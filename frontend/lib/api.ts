import axios from "axios";
import toast from "react-hot-toast";

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api",
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = document.cookie
      .split("; ")
      .find(r => r.startsWith("token="))
      ?.split("=")[1];
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  r => r,
  err => {
    if (
      err?.response?.status === 401 &&
      err?.response?.data?.code === "SESSION_EXPIRED" &&
      typeof window !== "undefined"
    ) {
      document.cookie = "token=; path=/; max-age=0; SameSite=None; Secure";
      toast.error("Logged in from another device. Please log in again.", { duration: 5000 });
      setTimeout(() => { window.location.href = "/"; }, 1500);
    }
    return Promise.reject(err);
  }
);

export default API;
