"use client";

import { useEffect, useState } from "react";
import { subscribeChatUnread } from "@/lib/chatUnreadStore";

export function useChatUnreadBadge() {
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => subscribeChatUnread(total => setTotalUnread(total)), []);

  return totalUnread;
}
