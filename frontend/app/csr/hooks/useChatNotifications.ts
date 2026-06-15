import { useEffect, useRef } from "react";
import API from "@/lib/api";
import { visibleInterval } from "@/lib/visibleInterval";

export function useChatNotifications() {
  const prevUnreadRef = useRef<Record<string, number>>({});
  const notifOk       = useRef(false);

  useEffect(() => {
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
        const convs: { id: string; name: string; unreadCount: number; lastMessage?: string }[] =
          r.data.conversations ?? r.data ?? [];

        if (!isFirst && notifOk.current) {
          convs.forEach(c => {
            const prev = prevUnreadRef.current[c.id] ?? 0;
            if ((c.unreadCount ?? 0) > prev) {
              new Notification("New message", {
                body: `${c.name}: ${c.lastMessage ?? "You have a new message"}`,
                icon: "/images/image.png",
              });
            }
          });
        }
        isFirst = false;
        prevUnreadRef.current = Object.fromEntries(convs.map(c => [c.id, c.unreadCount ?? 0]));
      } catch {}
    };
    void poll();
    return visibleInterval(poll, 10_000);
  }, []);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}
