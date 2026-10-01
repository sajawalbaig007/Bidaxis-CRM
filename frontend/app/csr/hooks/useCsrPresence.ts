import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import API, { getApiBase, getClientAuthToken } from "@/lib/api";
import { visibleInterval } from "@/lib/visibleInterval";
import { REAL_ACTION_MS, clearRealAction, peekLastActionAt, watchRealActivity } from "@/lib/realActivityWatch";
import { alertCheckedOut, armCheckoutAlert } from "@/lib/checkoutAlert";

const CHECKIN_EVENT = "csr-checkin-changed";
export const CSR_IDLE_RECHECK_KEY = "csr_idle_recheckin";
const PROMPT_EVENT = "csr-activity-prompt";
const CONFIRM_EVENT = "csr-activity-confirm";
const ACTION_KEY = "csr_last_real_action";

export function requestCsrIdlePermission(): void {
  armCheckoutAlert();
}

function markIdleRecheck() {
  try {
    sessionStorage.setItem(CSR_IDLE_RECHECK_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function useCsrPresence() {
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.get("/csr/work-session")
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
      const last = peekLastActionAt();
      if (last && Date.now() - Date.parse(last) < REAL_ACTION_MS) return;
      done = true;
      const lastActionAt = peekLastActionAt();
      clearRealAction(ACTION_KEY);
      API.post("/csr/check-out", lastActionAt ? { lastActionAt } : {})
        .then(() => {
          markIdleRecheck();
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
    if (!tabId) { tabId = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("crm_tab_id", tabId); }
    const openedAt = sessionStorage.getItem("crm_tab_opened") ?? new Date().toISOString();
    sessionStorage.setItem("crm_tab_opened", openedAt);

    const sendHeartbeat = () => {
      const visible = document.visibilityState === "visible";
      API.post("/csr/heartbeat", {
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
      fetch(`${getApiBase()}/csr/offline`, {
        method: "POST", credentials: "include", keepalive: true,
        headers,
        body: JSON.stringify({ tabId }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const stopInterval = visibleInterval(sendHeartbeat, 60_000);

    const onVisibility = () => { sendHeartbeat(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", markOffline);
    };
  }, []);
}
