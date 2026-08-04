"use client";

import { useEffect, useState } from "react";
import { getAuthMe, peekAuthMe } from "@/lib/authMeCache";

/** Whether the signed-in user may use staff chat (default true if unknown). */
export function useChatEnabled(): boolean {
  const peek = peekAuthMe();
  const [enabled, setEnabled] = useState(peek?.chatEnabled !== false);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      void getAuthMe().then(u => {
        if (!cancelled) setEnabled(u?.chatEnabled !== false);
      });
    };
    sync();
    const onUpdate = () => sync();
    window.addEventListener("crm-auth-me-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("crm-auth-me-updated", onUpdate);
    };
  }, []);

  return enabled;
}
