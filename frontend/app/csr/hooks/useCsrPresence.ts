import { useEffect } from "react";
import API from "@/lib/api";
import { visibleInterval } from "@/lib/visibleInterval";

export function useCsrPresence() {
  useEffect(() => {
    let tabId = sessionStorage.getItem("crm_tab_id");
    if (!tabId) { tabId = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("crm_tab_id", tabId); }
    const openedAt = sessionStorage.getItem("crm_tab_opened") ?? new Date().toISOString();
    sessionStorage.setItem("crm_tab_opened", openedAt);
    let hiddenAt: string | null = null;

    const sendHeartbeat = (forceVisible?: boolean) => {
      const visible = forceVisible ?? document.visibilityState === "visible";
      if (!visible && hiddenAt === null) hiddenAt = new Date().toISOString();
      if (visible) hiddenAt = null;
      API.post("/csr/heartbeat", { userAgent: navigator.userAgent, tabId, openedAt, tabVisible: visible, hiddenAt }).catch(() => {});
    };
    const markOffline = () => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"}/csr/offline`, {
        method: "POST", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId }),
      }).catch(() => {});
    };

    sendHeartbeat(true);
    const stopInterval = visibleInterval(sendHeartbeat, 10_000);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      stopInterval();
      window.removeEventListener("beforeunload", markOffline);
    };
  }, []);
}
