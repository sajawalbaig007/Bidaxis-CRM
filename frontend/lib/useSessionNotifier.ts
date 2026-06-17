"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import API from "./api";
import { visibleInterval } from "./visibleInterval";

const STORAGE_KEY = "crm_login_attempt_ack";

export function useSessionNotifier() {
  const notifiedRef = useRef(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) notifiedRef.current = parseInt(stored, 10) || 0;

    const check = async () => {
      try {
        const res = await API.get("/auth/session-status");
        const { loginAttemptPending, attemptId, message } = res.data ?? {};
        if (
          loginAttemptPending &&
          typeof attemptId === "number" &&
          attemptId > notifiedRef.current
        ) {
          notifiedRef.current = attemptId;
          sessionStorage.setItem(STORAGE_KEY, String(attemptId));
          toast.error(message ?? "Someone is trying to login to your account.", { duration: 6000 });
        }
      } catch {
        /* ignore */
      }
    };

    void check();
    return visibleInterval(check, 30_000);
  }, []);
}
