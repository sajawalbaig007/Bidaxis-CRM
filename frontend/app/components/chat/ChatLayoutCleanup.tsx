"use client";

import { useEffect } from "react";
import { forceStopChatUnreadPolling } from "@/lib/chatUnreadStore";
import { forceStopChatStatusHeartbeat } from "@/lib/chatStatusHeartbeat";

/** Stop chat polling when leaving CSR or admin route trees. */
export default function ChatLayoutCleanup() {
  useEffect(() => () => {
    forceStopChatUnreadPolling();
    forceStopChatStatusHeartbeat();
  }, []);

  return null;
}
