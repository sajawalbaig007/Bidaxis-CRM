import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import API from "@/lib/api";
import { visibleInterval } from "@/lib/visibleInterval";

function playNotifyTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* ignore */ }
}

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

export function useChatNotifications() {
  const pathname = usePathname();
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
        const convs: {
          id: string; name: string; unreadCount: number;
          lastMessage?: string; updatedAt?: string;
        }[] = r.data.conversations ?? r.data ?? [];

        if (!isFirst && notifOk.current) {
          convs.forEach(c => {
            const prev = prevUnreadRef.current[c.id] ?? 0;
            if ((c.unreadCount ?? 0) > prev) {
              playNotifyTone();
              const when = fmtLocalTime(c.updatedAt);
              new Notification("New chat message", {
                body: `${c.name}: ${c.lastMessage ?? "You have a new message"}${when ? ` · ${when}` : ""}`,
                icon: "/images/image.png",
                tag: `chat-${c.id}`,
              });
            }
          });
        }
        isFirst = false;
        prevUnreadRef.current = Object.fromEntries(convs.map(c => [c.id, c.unreadCount ?? 0]));
      } catch {}
    };
    void poll();
    return visibleInterval(poll, pathname?.includes("/chat") ? 30_000 : 90_000);
  }, [pathname]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}
