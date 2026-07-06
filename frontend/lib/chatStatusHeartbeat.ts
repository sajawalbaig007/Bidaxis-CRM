import API from "@/lib/api";

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatOwners = 0;
let lastPingAt = 0;
const PING_TTL_MS = 75_000;
const HEARTBEAT_MS = 90_000;

function pingOnline(force = false) {
  if (!force && Date.now() - lastPingAt < PING_TTL_MS) return;
  lastPingAt = Date.now();
  void API.post("/chat/status", { online: true }).catch(() => {});
}

export function startChatStatusHeartbeat(): void {
  if (typeof window === "undefined") return;
  heartbeatOwners += 1;
  if (heartbeatTimer) return;

  pingOnline(true);
  heartbeatTimer = setInterval(() => pingOnline(), HEARTBEAT_MS);
}

export function stopChatStatusHeartbeat(): void {
  heartbeatOwners = Math.max(0, heartbeatOwners - 1);
  if (heartbeatOwners > 0 || !heartbeatTimer) return;

  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  void API.post("/chat/status", { online: false }).catch(() => {});
}

/** Hard stop — route change or panel force-close. */
export function forceStopChatStatusHeartbeat(): void {
  heartbeatOwners = 0;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  void API.post("/chat/status", { online: false }).catch(() => {});
}
