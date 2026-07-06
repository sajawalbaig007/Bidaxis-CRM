"use client";

import { useChatNotifications } from "@/app/hooks/useChatNotifications";

export default function StaffChatNotifier() {
  useChatNotifications();
  return null;
}
