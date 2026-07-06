"use client";

import { useEffect } from "react";
import { startChatStatusHeartbeat, stopChatStatusHeartbeat } from "@/lib/chatStatusHeartbeat";
import { primeChatSound } from "@/lib/chatSound";

/** Keeps chat presence online while user is on any staff dashboard (admin / manager / csr). */
export default function StaffPresenceInit() {
  useEffect(() => {
    primeChatSound();
    startChatStatusHeartbeat();
    return () => stopChatStatusHeartbeat();
  }, []);

  return null;
}
