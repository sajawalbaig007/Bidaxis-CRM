"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import API from "./api";
import { visibleInterval } from "./visibleInterval";

const STORAGE_KEY = "crm_session_notify_tv";

export function useSessionNotifier() {
  const notifiedRef = useRef(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) notifiedRef.current = parseInt(stored, 10) || 0;

    const check = async () => {
      try {
        const res = await API.get("/auth/session-status");
        const { loginFromOtherDevice, currentTokenVersion } = res.data ?? {};
        if (
          loginFromOtherDevice &&
          typeof currentTokenVersion === "number" &&
          currentTokenVersion > notifiedRef.current
        ) {
          notifiedRef.current = currentTokenVersion;
          sessionStorage.setItem(STORAGE_KEY, String(currentTokenVersion));
          toast("Your account was logged in on another device.", { duration: 5000 });
        }
      } catch {
        /* ignore */
      }
    };

    void check();
    return visibleInterval(check, 60_000);
  }, []);
}
