"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LayoutDashboard, Users, FileText, BarChart3,
  FolderKanban, Upload, Trash2, Settings,
  LogOut, ChevronDown, MessageSquare, Bell, Phone, Clock, X,
} from "lucide-react";
import API from "@/lib/api";
import { dismissNotification, getDismissedNotificationIds, clearDismissedNotifications } from "@/lib/notificationDismiss";
import { logoutSession } from "@/lib/session";
import { getAuthMe } from "@/lib/authMeCache";
import { useChatUnreadBadge } from "@/lib/useChatUnreadBadge";
import { forceStopChatUnreadPolling } from "@/lib/chatUnreadStore";
import { forceStopChatStatusHeartbeat } from "@/lib/chatStatusHeartbeat";
import { forceDisconnectChatSocket } from "@/lib/chatSocket";
import AdminChatPanel from "./AdminChatPanel";
import ThemeToggle from "@/app/components/ThemeToggle";
import StaffMobileNav from "@/app/components/staff/StaffMobileNav";

const navItems = [
  { title: "Dashboard",       href: "/admin",                 icon: LayoutDashboard },
  { title: "Users",           href: "/admin/users",           icon: Users           },
  { title: "Leads",           href: "/admin/leads",           icon: FileText        },
  { title: "Reports",         href: "/admin/reports",         icon: BarChart3       },
  { title: "Project DB",      href: "/admin/active-projects", icon: FolderKanban    },
  { title: "Uploads",         href: "/admin/uploads",         icon: Upload          },
  { title: "Bin",             href: "/admin/bin",             icon: Trash2          },
  { title: "Settings",        href: "/admin/settings",        icon: Settings        },
];

type UserInfo = { name: string; email: string; role: string };

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

function labelDate(d: string) {
  const tmr = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
  if (d === TODAY) return "Today";
  if (d === tmr) return "Tomorrow";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function DashboardSidebar() {
  const [user,        setUser]        = useState<UserInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen,    setBellOpen]    = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>(() =>
    Date.now() - _lastNotifFetch < NOTIF_CACHE_TTL ? filterDismissedCalls(_cachedScheduledCalls) : []
  );
  const totalUnread   = useChatUnreadBadge();
  const profileRef    = useRef<HTMLDivElement>(null);
  const bellRef       = useRef<HTMLDivElement>(null);

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
    getAuthMe().then(u => { if (u) setUser(u); }).catch(() => {});

    if (Date.now() - _lastNotifFetch < NOTIF_CACHE_TTL) {
      setScheduledCalls(filterDismissedCalls(_cachedScheduledCalls));
      return;
    }
    fetchNotifications();
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
    } catch { toast.error("Logout failed."); }
    finally { setLoggingOut(false); }
  };

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  const todayCalls = scheduledCalls.filter(c => c.date === TODAY);

  const handleClearNotifications = () => {
    clearDismissedNotifications();
    _cachedScheduledCalls = [];
    setScheduledCalls([]);
    toast.success("Notifications cleared.");
  };

  const dismissOne = (id: string) => {
    dismissNotification(id);
    _cachedScheduledCalls = _cachedScheduledCalls.filter(c => c.id !== id);
    setScheduledCalls(prev => prev.filter(c => c.id !== id));
  };

  const hasNotifications = scheduledCalls.length > 0;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 bg-crm-surface border-b border-crm-border shadow-sm">
        <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">

          {/* Logo */}
          <Link href="/admin" prefetch={false} className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-[14px] bg-[#B8112D] flex items-center justify-center shadow-sm overflow-hidden p-1">
              <Image
                src="/images/image.png" alt="logo"
                width={44} height={44}
                className="object-cover w-full h-full rounded-[10px] bg-white"
              />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-[18px] md:text-[20px] font-extrabold leading-none text-crm-text tracking-tight">
                CRM Dashboard
              </h2>
              <p className="text-[10px] md:text-[11px] font-semibold text-[#B8112D] mt-1 tracking-wide uppercase">
                Admin Panel
              </p>
            </div>
          </Link>

          <div className="flex-1 min-w-0 flex justify-center">
            <StaffMobileNav items={navItems} baseHref="/admin" />
          </div>

          <ThemeToggle />

          {/* Chat button */}
          <button
            onClick={() => { setChatOpen(v => !v); setBellOpen(false); }}
            className={`relative w-9 h-9 rounded-[13px] flex items-center justify-center transition-all shrink-0 ${chatOpen ? "bg-[#B8112D] text-white shadow-md" : "bg-crm-nav-pill text-crm-text-muted hover:bg-crm-brand-soft hover:text-[#B8112D]"}`}
            title="Messages"
          >
            <MessageSquare size={16} />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#B8112D] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>

          {/* Meeting notifications */}
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
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-[#B8112D]" />
                    <span className="text-[13px] font-bold text-[#0F172A]">Meetings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {todayCalls.length > 0 && (
                      <span className="text-[11px] bg-[#FFF1F3] text-[#B8112D] font-bold px-2 py-0.5 rounded-full">
                        {todayCalls.length} today
                      </span>
                    )}
                    {hasNotifications && (
                      <button
                        type="button"
                        onClick={handleClearNotifications}
                        className="text-[10px] font-semibold text-gray-400 hover:text-[#B8112D] transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                  {scheduledCalls.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell size={24} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-gray-400 text-[13px]">No scheduled meetings</p>
                      <p className="text-gray-300 text-[11px] mt-1">CSR important leads with call times</p>
                    </div>
                  ) : (
                    scheduledCalls.map((c) => {
                      const label = labelDate(c.date);
                      const isToday = label === "Today";
                      const tzShort = c.timezone
                        ? c.timezone.split("/").pop()?.replace("_", " ") ?? c.timezone
                        : "";

                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${
                            isToday ? "bg-[#FFFBF5]" : ""
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isToday ? "bg-[#FFF1F3] text-[#B8112D]" : "bg-[#FFF7E6] text-[#B54708]"
                          }`}>
                            <Phone size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#0F172A] truncate">{c.client}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock size={10} className="text-gray-400 shrink-0" />
                              <p className="text-[11px] text-gray-500 truncate">
                                {c.time}{tzShort ? ` · ${tzShort}` : ""}
                              </p>
                            </div>
                            {c.csrName && (
                              <p className="text-[10px] text-[#065F46] font-semibold mt-0.5 truncate">
                                {c.csrCode ? `${c.csrCode} · ` : ""}{c.csrName}
                              </p>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            isToday ? "bg-[#FFF1F3] text-[#B8112D]" : "bg-[#FFF7E6] text-[#B54708]"
                          }`}>
                            {label}
                          </span>
                          <button
                            type="button"
                            onClick={() => dismissOne(c.id)}
                            className="w-6 h-6 rounded-lg text-gray-300 hover:text-[#B8112D] hover:bg-[#FFF1F3] flex items-center justify-center shrink-0"
                            title="Dismiss"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setProfileOpen(v => !v); setBellOpen(false); }}
              className="crm-profile-btn flex items-center gap-2 rounded-[14px] pl-1.5 pr-2.5 h-10 transition-colors"
            >
              <div className="w-8 h-8 rounded-[11px] bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {initials}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-[12px] font-bold leading-none text-crm-text max-w-[90px] truncate">
                  {user?.name ?? "Admin"}
                </p>
                <p className="text-[10px] text-crm-text-muted mt-1">Administration</p>
              </div>
              <ChevronDown
                size={13}
                className={`hidden sm:block text-crm-text-faint transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-2xl z-50 overflow-hidden">
                <div className="bg-gradient-to-br from-[#B8112D] to-[#7A0B1E] px-4 py-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-[14px] font-bold truncate">{user?.name ?? "Admin"}</p>
                    <p className="text-white/65 text-[11px] truncate mt-0.5">{user?.email ?? "—"}</p>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-[#F5F6FA] rounded-xl">
                    <span className="text-[10px] text-gray-400 font-medium shrink-0">Role</span>
                    <span className="text-[11px] font-semibold text-[#0F172A]">{user?.role ?? "Admin"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-[#F5F6FA] rounded-xl">
                    <span className="text-[10px] text-gray-400 font-medium shrink-0">Email</span>
                    <span className="text-[10px] text-[#0F172A] truncate max-w-[140px]">{user?.email ?? "—"}</span>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <button
                    onClick={handleLogout} disabled={loggingOut}
                    className="w-full h-9 rounded-xl bg-[#FFF1F3] hover:bg-[#ffe4e9] text-[#B8112D] text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                  >
                    <LogOut size={13} />
                    {loggingOut ? "Logging out…" : "Logout"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Zero-width in-flow placeholder so flex siblings still get full width */}
      <div className="w-0 shrink-0" />

      {chatOpen && <AdminChatPanel onClose={closeChat} />}
    </>
  );
}
