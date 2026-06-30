import { playChatSound } from "@/lib/chatSound";
import type { ChatConversation } from "./chatConversations";
import {
  fetchArchivedConversations,
  fetchChatConversations,
  peekArchivedConversations,
  peekChatConversations,
} from "./chatApiCache";

type Listener = (total: number, convs: ChatConversation[]) => void;

let totalUnread = 0;
let lastConvs: ChatConversation[] = [];
let lastArchivedConvs: ChatConversation[] = [];
const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let panelOpenCount = 0;
let pollGeneration = 0;
let inflight: Promise<number> | null = null;
let archivedInflight: Promise<ChatConversation[]> | null = null;
let prevTotal = 0;
let prevById: Record<string, number> = {};
let notifOk = false;
let isFirstPoll = true;
let visibilityBound = false;

const POLL_PANEL_VISIBLE_MS = 15_000;
const POLL_PANEL_HIDDEN_MS  = 45_000;

function notify() {
  listeners.forEach(fn => fn(totalUnread, lastConvs));
}

function pollIntervalMs(): number | null {
  if (typeof document === "undefined" || panelOpenCount <= 0) return null;
  return document.hidden ? POLL_PANEL_HIDDEN_MS : POLL_PANEL_VISIBLE_MS;
}

function clearPollTimer() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function onVisibilityChange() {
  syncPolling();
  if (!document.hidden && panelOpenCount > 0) void pollChatUnread();
}

function bindVisibility() {
  if (typeof document === "undefined" || visibilityBound) return;
  document.addEventListener("visibilitychange", onVisibilityChange);
  visibilityBound = true;
}

function unbindVisibility() {
  if (typeof document === "undefined" || !visibilityBound) return;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  visibilityBound = false;
}

function syncPolling() {
  if (typeof document === "undefined") return;

  clearPollTimer();
  const ms = pollIntervalMs();
  if (ms == null) {
    unbindVisibility();
    return;
  }

  bindVisibility();
  pollTimer = setInterval(() => void pollChatUnread(), ms);
}

function requestNotifPermissionOnce() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") notifOk = true;
  else if (Notification.permission === "default") {
    Notification.requestPermission().then(p => { notifOk = p === "granted"; });
  }
}

export function getChatUnreadTotal() {
  return totalUnread;
}

export function getChatConversations() {
  return lastConvs.length > 0 ? lastConvs : peekChatConversations();
}

export function getArchivedConversations() {
  return lastArchivedConvs.length > 0 ? lastArchivedConvs : peekArchivedConversations();
}

export function hasChatCache() {
  return getChatConversations().length > 0;
}

/** Badge + panel UI — cache only, no network when panel is closed. */
export function subscribeChatUnread(fn: Listener): () => void {
  listeners.add(fn);
  fn(totalUnread, lastConvs);
  return () => listeners.delete(fn);
}

export async function pollChatUnread(force = false): Promise<number> {
  if (panelOpenCount <= 0) return totalUnread;
  if (inflight) return inflight;

  const gen = pollGeneration;
  inflight = (async () => {
    try {
      const convs = await fetchChatConversations(force);
      if (gen !== pollGeneration || panelOpenCount <= 0) return totalUnread;
      const total = convs.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

      if (!isFirstPoll) {
        let hasNewUnread = false;
        if (notifOk && typeof Notification !== "undefined") {
          convs.forEach(c => {
            const prev = prevById[c.id] ?? 0;
            if ((c.unreadCount ?? 0) > prev) {
              hasNewUnread = true;
              new Notification("New message", {
                body: `${c.name}: ${c.lastMessage ?? "You have a new message"}`,
                icon: "/images/image.png",
              });
            }
          });
        } else {
          hasNewUnread = convs.some(c => (c.unreadCount ?? 0) > (prevById[c.id] ?? 0));
        }
        if (hasNewUnread || total > prevTotal) playChatSound();
      }

      isFirstPoll = false;
      prevTotal = total;
      prevById = Object.fromEntries(convs.map(c => [c.id, c.unreadCount ?? 0]));
      totalUnread = total;
      lastConvs = convs;
      notify();
      return total;
    } catch {
      return totalUnread;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export async function pollArchivedConversations(force = false): Promise<ChatConversation[]> {
  if (panelOpenCount <= 0) return lastArchivedConvs;
  if (archivedInflight) return archivedInflight;

  archivedInflight = (async () => {
    try {
      lastArchivedConvs = await fetchArchivedConversations(force);
      return lastArchivedConvs;
    } catch {
      return lastArchivedConvs;
    } finally {
      archivedInflight = null;
    }
  })();

  return archivedInflight;
}

function hydrateFromPeek() {
  const peeked = peekChatConversations();
  if (!peeked.length || lastConvs.length > 0) return;
  lastConvs = peeked;
  totalUnread = peeked.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
  notify();
}

/** Start interval polling while chat panel is open. Does not fetch immediately. */
export function ensureChatUnreadPolling(): void {
  if (typeof window === "undefined") return;
  requestNotifPermissionOnce();
  panelOpenCount += 1;
  hydrateFromPeek();
  notify();
  syncPolling();
}

/** Decrement panel ref-count and stop polling when last panel closes. */
export function stopChatUnreadPolling(): void {
  panelOpenCount = Math.max(0, panelOpenCount - 1);
  syncPolling();
}

/** Hard stop — use when chat panel unmounts to avoid leaked timers. */
export function forceStopChatUnreadPolling(): void {
  panelOpenCount = 0;
  pollGeneration += 1;
  inflight = null;
  archivedInflight = null;
  syncPolling();
}
