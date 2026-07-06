import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import API from "@/lib/api";
import { playChatSound, primeChatSound } from "@/lib/chatSound";
import { visibleInterval } from "@/lib/visibleInterval";

function fmtLocalTime(iso?: string): string {
  try {
    return new Date(iso ?? Date.now()).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return "";
  }
}

/** Background chat unread polling + sound ping on all staff dashboards. */
export function useChatNotifications() {
  const pathname = usePathname();
  const prevUnreadRef = useRef<Record<string, number>>({});
  const notifOk = useRef(false);

  useEffect(() => {
    primeChatSound();
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      notifOk.current = true;
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then(p => { notifOk.current = p === "granted"; });
    }
  }, []);

  useEffect(() => {
    let isFirst = true;
    const poll = async () => {
      try {
        const r = await API.get("/chat/conversations");
        const convs: {
          id: string; name: string; unreadCount: number;
          lastMessage?: string; updatedAt?: string;
        }[] = r.data.conversations ?? r.data ?? [];

        if (!isFirst) {
          let hasNewUnread = false;
          convs.forEach(c => {
            const prev = prevUnreadRef.current[c.id] ?? 0;
            if ((c.unreadCount ?? 0) > prev) {
              hasNewUnread = true;
              if (notifOk.current && typeof Notification !== "undefined") {
                const when = fmtLocalTime(c.updatedAt);
                new Notification("New chat message", {
                  body: `${c.name}: ${c.lastMessage ?? "You have a new message"}${when ? ` · ${when}` : ""}`,
                  icon: "/images/image.png",
                  tag: `chat-${c.id}`,
                });
              }
            }
          });
          if (hasNewUnread) playChatSound();
        }
        isFirst = false;
        prevUnreadRef.current = Object.fromEntries(convs.map(c => [c.id, c.unreadCount ?? 0]));
      } catch { /* ignore */ }
    };

    void poll();
    const ms = pathname?.includes("/chat") ? 20_000 : 30_000;
    return visibleInterval(poll, ms);
  }, [pathname]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}
