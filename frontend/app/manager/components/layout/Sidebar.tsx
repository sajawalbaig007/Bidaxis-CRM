"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LayoutDashboard, FileText, BarChart3,
  FolderKanban, Upload, Trash2,
  LogOut, ChevronDown, MessageSquare, Bell, X,
} from "lucide-react";
import API from "@/lib/api";
import { dismissNotification, getDismissedNotificationIds } from "@/lib/notificationDismiss";
import { logoutSession } from "@/lib/session";
import { getAuthMe, peekAuthMe } from "@/lib/authMeCache";
import { useChatUnreadBadge } from "@/lib/useChatUnreadBadge";
import { useChatEnabled } from "@/lib/useChatEnabled";
import { forceStopChatUnreadPolling } from "@/lib/chatUnreadStore";
import { forceStopChatStatusHeartbeat } from "@/lib/chatStatusHeartbeat";
import { forceDisconnectChatSocket } from "@/lib/chatSocket";
import ChatPanel from "@/app/components/chat/ChatPanel";
import ThemeToggle from "@/app/components/ThemeToggle";
import CapsuleChipNav from "@/app/components/CapsuleChipNav";

const BASE = "/manager";

const navItems = [
  { title: "Dashboard",  shortTitle: "Dashboard",  href: `${BASE}`,                 icon: LayoutDashboard },
  { title: "Leads",      shortTitle: "Leads",      href: `${BASE}/leads`,           icon: FileText        },
  { title: "Reports",    shortTitle: "Reports",    href: `${BASE}/reports`,         icon: BarChart3       },
  { title: "Project DB", shortTitle: "Project DB", href: `${BASE}/active-projects`, icon: FolderKanban    },
  { title: "Uploads",    shortTitle: "Uploads",    href: `${BASE}/uploads`,         icon: Upload          },
  { title: "Bin",        shortTitle: "Bin",        href: `${BASE}/bin`,             icon: Trash2          },
];

type UserInfo = { name: string; email: string; role: string; profilePic?: string | null };

type ScheduledCall = {
  id: string;
  client: string;
  date: string;
  time: string;
  timezone: string;
  csrName: string;
  csrCode: string;
  csrId: string;
};

const TODAY = new Date().toISOString().split("T")[0];

let _cachedScheduledCalls: ScheduledCall[] = [];
let _lastNotifFetch = 0;
const NOTIF_CACHE_TTL = 60_000;

function filterDismissedCalls(all: ScheduledCall[]) {
  const dismissed = getDismissedNotificationIds();
  return all.filter(c => !dismissed.has(c.id));
}

export default function ManagerSidebar() {
  const [user, setUser] = useState<UserInfo | null>(() => peekAuthMe());
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>(() =>
    Date.now() - _lastNotifFetch < NOTIF_CACHE_TTL ? filterDismissedCalls(_cachedScheduledCalls) : [],
  );
  const totalUnread = useChatUnreadBadge();
  const chatEnabled = useChatEnabled();
  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const closeChat = () => {
    forceStopChatUnreadPolling();
    setChatOpen(false);
  };

  useEffect(() => () => {
    forceStopChatUnreadPolling();
  }, []);

  const fetchNotifications = () => {
    API.get("/admin/notifications")
      .then(res => {
        const all = (res.data.scheduledCalls ?? []) as ScheduledCall[];
        _cachedScheduledCalls = all;
        _lastNotifFetch = Date.now();
        setScheduledCalls(filterDismissedCalls(all));
      })
      .catch(() => {});
  };

  useEffect(() => {
    const apply = (u: UserInfo | null) => { if (u) setUser(u); };
    apply(peekAuthMe());
    getAuthMe(false).then(apply).catch(() => {});

    const onAuthUpdated = () => {
      apply(peekAuthMe());
      getAuthMe(true).then(apply).catch(() => {});
    };
    window.addEventListener("crm-auth-me-updated", onAuthUpdated);
    if (Date.now() - _lastNotifFetch < NOTIF_CACHE_TTL) {
      setScheduledCalls(filterDismissedCalls(_cachedScheduledCalls));
      return () => window.removeEventListener("crm-auth-me-updated", onAuthUpdated);
    }
    fetchNotifications();
    return () => window.removeEventListener("crm-auth-me-updated", onAuthUpdated);
  }, []);

  useEffect(() => {
    if (!bellOpen) return;
    if (Date.now() - _lastNotifFetch < NOTIF_CACHE_TTL) return;
    fetchNotifications();
  }, [bellOpen]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      forceStopChatStatusHeartbeat();
      forceDisconnectChatSocket();
      await logoutSession(() => API.post("/auth/logout", {}));
      toast.success("Logged out successfully.");
      window.location.href = "/";
    } catch {
      toast.error("Logout failed.");
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "MG";

  const todayCalls = scheduledCalls.filter(c => c.date === TODAY);

  const dismissOne = (id: string) => {
    dismissNotification(id);
    _cachedScheduledCalls = _cachedScheduledCalls.filter(c => c.id !== id);
    setScheduledCalls(prev => prev.filter(c => c.id !== id));
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 bg-crm-surface border-b border-crm-border shadow-sm">
        <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">
          <div className="flex-1 min-w-0 flex items-center">
          <Link href={BASE} prefetch={false} className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-[14px] bg-[#B8112D] flex items-center justify-center shadow-sm overflow-hidden p-1">
              <Image src="/images/image.png" alt="logo" width={44} height={44} className="object-cover w-full h-full rounded-[10px] bg-white" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-[18px] md:text-[20px] font-extrabold leading-none text-crm-text tracking-tight">CRM Dashboard</h2>
              <p className="text-[10px] md:text-[11px] font-semibold text-[#B8112D] mt-1 tracking-wide uppercase">Manager Panel</p>
            </div>
          </Link>
          </div>

          <div className="min-w-0 shrink">
            <CapsuleChipNav items={navItems} baseHref={BASE} accent="#B8112D" variant="inline" />
          </div>

          <div className="flex-1 min-w-0 flex items-center justify-end gap-3">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => { setChatOpen(v => !v); setBellOpen(false); }}
            className={`relative w-9 h-9 rounded-[13px] flex items-center justify-center transition-all shrink-0 ${
              chatOpen ? "bg-[#B8112D] text-white shadow-md" : "bg-crm-nav-pill text-crm-text-muted hover:bg-crm-brand-soft hover:text-[#B8112D]"
            } ${!chatEnabled ? "opacity-50" : ""}`}
            title={chatEnabled ? "Messages" : "Chat disabled by admin"}
          >
            <MessageSquare size={16} />
            {chatEnabled && totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#B8112D] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>

          <div ref={bellRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setBellOpen(v => !v); setProfileOpen(false); }}
              className="relative w-9 h-9 rounded-[13px] flex items-center justify-center text-crm-text-muted hover:text-[#B8112D] hover:bg-crm-nav-pill transition-colors"
              title="Scheduled meetings"
            >
              <Bell size={17} />
              {scheduledCalls.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#B8112D] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                  {scheduledCalls.length > 9 ? "9+" : scheduledCalls.length}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[300px] sm:w-[340px] bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-crm-border-subtle">
                  <span className="text-[13px] font-bold text-[#0F172A]">Meetings</span>
                  {todayCalls.length > 0 && (
                    <span className="text-[11px] bg-[#FFF1F3] text-[#B8112D] font-bold px-2 py-0.5 rounded-full">{todayCalls.length} today</span>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {scheduledCalls.length === 0 ? (
                    <p className="py-8 text-center text-gray-400 text-[13px]">No scheduled meetings</p>
                  ) : (
                    scheduledCalls.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">{c.client}</p>
                          <p className="text-[11px] text-gray-500">{c.time}</p>
                        </div>
                        <button type="button" onClick={() => dismissOne(c.id)} className="text-gray-300 hover:text-[#B8112D]">
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={profileRef} className="relative shrink-0">
            <button type="button" onClick={() => { setProfileOpen(v => !v); setBellOpen(false); }} className="crm-profile-btn flex items-center gap-2 rounded-[14px] pl-1.5 pr-2.5 h-10">
              <div className="w-8 h-8 rounded-[11px] bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs overflow-hidden">
                {user?.profilePic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <ChevronDown size={13} className="hidden sm:block text-crm-text-faint" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-crm-surface rounded-2xl border shadow-2xl z-50 p-3">
                <p className="font-bold text-sm truncate">{user?.name ?? "Manager"}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="mt-3 w-full h-9 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <LogOut size={13} />
                  {loggingOut ? "Logging out…" : "Logout"}
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      <div className="w-0 shrink-0" />

      {chatOpen && <ChatPanel onClose={closeChat} />}
    </>
  );
}
