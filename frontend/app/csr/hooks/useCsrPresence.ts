import { useEffect } from "react";
import API, { getApiBase, getClientAuthToken } from "@/lib/api";
import { visibleInterval } from "@/lib/visibleInterval";

export function useCsrPresence() {
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
    const stopInterval = visibleInterval(sendHeartbeat, 30_000);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      stopInterval();
      window.removeEventListener("beforeunload", markOffline);
    };
  }, []);
}
