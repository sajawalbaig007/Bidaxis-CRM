"use client";

import { useEffect } from "react";
import { ensureChatUnreadPolling } from "@/lib/chatUnreadStore";

/** Mount once in layout — keeps unread badge + notifications alive globally. */
export default function ChatUnreadInit() {
  useEffect(() => {
    ensureChatUnreadPolling(10_000);
  }, []);
  return null;
}
