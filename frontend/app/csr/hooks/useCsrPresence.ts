import { useEffect } from "react";
import API from "@/lib/api";

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
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"}/csr/offline`, {
        method: "POST", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId }),
      }).catch(() => {});
    };

    sendHeartbeat();
    window.addEventListener("beforeunload", markOffline);

    return () => {
      window.removeEventListener("beforeunload", markOffline);
    };
  }, []);
}
