import API from "@/lib/api";
import { playChatSound } from "@/lib/chatSound";
import type { ChatConversation } from "./chatConversations";

type Listener = (total: number, convs: ChatConversation[]) => void;

let totalUnread = 0;
let lastConvs: ChatConversation[] = [];
const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let inflight: Promise<number> | null = null;
let prevTotal = 0;
let prevById: Record<string, number> = {};
let notifOk = false;
let isFirstPoll = true;

/** Visible tab: badge + notifications. Chat open still uses message poll for instant UI. */
const POLL_VISIBLE_MS = 4_000;
const POLL_HIDDEN_MS  = 15_000;

function schedulePoll() {
  if (typeof document === "undefined") return;
  if (pollTimer) clearInterval(pollTimer);
  const ms = document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
  pollTimer = setInterval(() => void pollChatUnread(), ms);
}

function notify() {
  listeners.forEach(fn => fn(totalUnread, lastConvs));
}

export function getChatUnreadTotal() {
  return totalUnread;
}

export function getChatConversations() {
  return lastConvs;
}

export function subscribeChatUnread(fn: Listener): () => void {
  listeners.add(fn);
  fn(totalUnread, lastConvs);
  return () => listeners.delete(fn);
}

export async function pollChatUnread(): Promise<number> {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await API.get("/chat/conversations");
      const convs: ChatConversation[] = r.data.conversations ?? r.data ?? [];
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

/** Start global polling once — single source for conversation list + unread badge. */
export function ensureChatUnreadPolling(): void {
  if (typeof window === "undefined") return;

  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") notifOk = true;
    else if (Notification.permission === "default") {
      Notification.requestPermission().then(p => { notifOk = p === "granted"; });
    }
  }

  if (started) return;
  started = true;

  void pollChatUnread();
  schedulePoll();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void pollChatUnread();
    schedulePoll();
  });
}

export function stopChatUnreadPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  started = false;
  inflight = null;
}
