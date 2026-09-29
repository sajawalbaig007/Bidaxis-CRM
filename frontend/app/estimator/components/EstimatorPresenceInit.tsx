"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API, { getApiBase, getClientAuthToken } from "@/lib/api";
import { visibleInterval } from "@/lib/visibleInterval";

const IDLE_MS = 5 * 60 * 1000;
const CHECKIN_EVENT = "estimator-checkin-changed";

type IdleDetectorInstance = EventTarget & {
  userState: "active" | "idle";
  screenState: "locked" | "unlocked";
  start: (opts: { threshold: number; signal?: AbortSignal }) => Promise<void>;
};

type IdleDetectorCtor = {
  new (): IdleDetectorInstance;
  requestPermission: () => Promise<"granted" | "denied">;
};

function idleDetectorCtor(): IdleDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as Window & { IdleDetector?: IdleDetectorCtor }).IdleDetector;
  return ctor ?? null;
}

/** Ask during Check In so a still cursor can check them out even if this window is minimized. */
export function requestEstimatorIdlePermission(): void {
  const Ctor = idleDetectorCtor();
  if (!Ctor) return;
  void Ctor.requestPermission().catch(() => {});
}

function watchCursorIdle(onIdle: () => void): () => void {
  const Ctor = idleDetectorCtor();
  const abort = new AbortController();
  let stopped = false;
  let fallbackTimer = 0;
  const removeFallback = () => {
    window.clearInterval(fallbackTimer);
    fallbackTimer = 0;
  };

  const startFallback = () => {
    let lastMove = Date.now();
    const bump = () => {
      lastMove = Date.now();
    };
    const opts: AddEventListenerOptions = { passive: true, signal: abort.signal };
    window.addEventListener("pointermove", bump, opts);
    window.addEventListener("mousemove", bump, opts);
    window.addEventListener("wheel", bump, opts);
    window.addEventListener("keydown", bump, opts);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") lastMove = Date.now();
    }, { signal: abort.signal });
    fallbackTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastMove >= IDLE_MS) onIdle();
    }, 15_000);
  };

  if (Ctor) {
    const detector = new Ctor();
    detector.addEventListener("change", () => {
      if (stopped) return;
      if (detector.userState === "idle" || detector.screenState === "locked") onIdle();
    });
    void detector.start({ threshold: IDLE_MS, signal: abort.signal }).catch(() => {
      if (!stopped) startFallback();
    });
  } else {
    startFallback();
  }

  return () => {
    stopped = true;
    abort.abort();
    removeFallback();
  };
}

/** Heartbeat ticks open work session (dashboard/away) after Check In. */
export function useEstimatorPresence() {
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.get("/estimator/work-session")
      .then((res) => {
        if (!cancelled) setCheckedIn(!!res.data?.checkedIn);
      })
      .catch(() => {});
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ checkedIn?: boolean }>).detail;
      if (typeof detail?.checkedIn === "boolean") setCheckedIn(detail.checkedIn);
    };
    window.addEventListener(CHECKIN_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(CHECKIN_EVENT, onChanged);
    };
  }, []);

  useEffect(() => {
    if (!checkedIn) return;
    let done = false;
    const checkout = () => {
      if (done) return;
      done = true;
      API.post("/estimator/check-out", {})
        .then(() => {
          toast("Checked out — the cursor was still for 5 minutes.");
          window.dispatchEvent(new CustomEvent(CHECKIN_EVENT, { detail: { checkedIn: false } }));
        })
        .catch(() => {
          done = false;
        });
    };
    const stop = watchCursorIdle(checkout);
    return () => {
      done = true;
      stop();
    };
  }, [checkedIn]);
  useEffect(() => {
    let tabId = sessionStorage.getItem("crm_tab_id");
    if (!tabId) {
      tabId = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("crm_tab_id", tabId);
    }
    const openedAt = sessionStorage.getItem("crm_tab_opened") ?? new Date().toISOString();
    sessionStorage.setItem("crm_tab_opened", openedAt);

    const sendHeartbeat = () => {
      const visible = document.visibilityState === "visible";
      API.post("/estimator/heartbeat", {
        userAgent: navigator.userAgent,
        tabId,
        openedAt,
        tabVisible: visible,
        hiddenAt: visible ? null : new Date().toISOString(),
      }).catch(() => {});
    };

    const markOffline = () => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getClientAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      fetch(`${getApiBase()}/estimator/offline`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers,
        body: JSON.stringify({ tabId }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const stopInterval = visibleInterval(sendHeartbeat, 60_000);

    const onVisibility = () => {
      sendHeartbeat();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", markOffline);
    };
  }, []);
}

export default function EstimatorPresenceInit() {
  useEstimatorPresence();
  return null;
}
