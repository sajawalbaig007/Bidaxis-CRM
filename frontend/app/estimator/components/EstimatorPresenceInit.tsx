"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API, { getApiBase, getClientAuthToken } from "@/lib/api";
import { visibleInterval } from "@/lib/visibleInterval";
import { clearRealAction, peekLastActionAt, watchRealActivity } from "@/lib/realActivityWatch";
import { alertCheckedOut, armCheckoutAlert } from "@/lib/checkoutAlert";

const CHECKIN_EVENT = "estimator-checkin-changed";
export const ESTIMATOR_IDLE_RECHECK_KEY = "estimator_idle_recheckin";
const PROMPT_EVENT = "estimator-activity-prompt";
const CONFIRM_EVENT = "estimator-activity-confirm";
const ACTION_KEY = "estimator_last_real_action";

export function requestEstimatorIdlePermission(): void {
  armCheckoutAlert();
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
      const lastActionAt = peekLastActionAt();
      clearRealAction(ACTION_KEY);
      API.post("/estimator/check-out", lastActionAt ? { lastActionAt } : {})
        .then(() => {
          try { sessionStorage.setItem(ESTIMATOR_IDLE_RECHECK_KEY, "1"); } catch { /* ignore */ }
          alertCheckedOut();
          toast("You have to check in again.");
          window.dispatchEvent(new CustomEvent(CHECKIN_EVENT, { detail: { checkedIn: false, idle: true } }));
        })
        .catch(() => {
          done = false;
        });
    };
    const stop = watchRealActivity({
      onCheckout: checkout,
      confirmEvent: CONFIRM_EVENT,
      promptEvent: PROMPT_EVENT,
      storageKey: ACTION_KEY,
    });
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
        ...(peekLastActionAt() ? { lastActionAt: peekLastActionAt() } : {}),
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
