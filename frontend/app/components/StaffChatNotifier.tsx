"use client";

import { useEffect } from "react";
import { initChatRealtime } from "@/lib/chatUnreadStore";

/** Starts WebSocket-driven chat notifications on all staff dashboards. */
export default function StaffChatNotifier() {
  useEffect(() => {
    initChatRealtime();
  }, []);

  return null;
}
