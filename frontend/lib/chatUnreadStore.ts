import API from "@/lib/api";
import { playChatSound } from "@/lib/chatSound";

export type ChatConvPreview = {
  id: string;
  name: string;
  unreadCount: number;
  lastMessage?: string;
};

type Listener = (total: number, convs: ChatConvPreview[]) => void;

let totalUnread = 0;
let lastConvs: ChatConvPreview[] = [];
const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let prevTotal = 0;
let prevById: Record<string, number> = {};
let notifOk = false;
let isFirstPoll = true;

function notify() {
  listeners.forEach(fn => fn(totalUnread, lastConvs));
}

export function getChatUnreadTotal() {
  return totalUnread;
}

export function subscribeChatUnread(fn: Listener): () => void {
  listeners.add(fn);
  fn(totalUnread, lastConvs);
  return () => listeners.delete(fn);
}

export async function pollChatUnread(): Promise<number> {
  try {
    const r = await API.get("/chat/conversations");
    const convs: ChatConvPreview[] = r.data.conversations ?? r.data ?? [];
    const total = convs.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

    if (!isFirstPoll && total > prevTotal) {
      playChatSound();
      if (notifOk && typeof Notification !== "undefined") {
        convs.forEach(c => {
          const prev = prevById[c.id] ?? 0;
          if ((c.unreadCount ?? 0) > prev) {
            new Notification("New message", {
              body: `${c.name}: ${c.lastMessage ?? "You have a new message"}`,
              icon: "/images/image.png",
            });
          }
        });
      }
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
  }
}

/** Start global polling once ΓÇö works even when chat panel is closed. */
export function ensureChatUnreadPolling(intervalMs = 10_000): void {
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
  pollTimer = setInterval(() => void pollChatUnread(), intervalMs);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void pollChatUnread();
  });
}

export function stopChatUnreadPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  started = false;
}
