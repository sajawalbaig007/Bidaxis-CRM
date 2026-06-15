"use client";

import { useChatNotifications } from "../hooks/useChatNotifications";

export default function CsrChatNotifier() {
  useChatNotifications();
  return null;
}
