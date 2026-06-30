"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { BarChart3, Upload, LogOut, MessageSquare } from "lucide-react";
import API from "@/lib/api";
import { logoutSession } from "@/lib/session";
import { getAuthMe } from "@/lib/authMeCache";
import { useChatUnreadBadge } from "@/lib/useChatUnreadBadge";
import { forceStopChatUnreadPolling } from "@/lib/chatUnreadStore";
import { forceStopChatStatusHeartbeat } from "@/lib/chatStatusHeartbeat";
import ChatPanel from "@/app/components/chat/ChatPanel";
import ThemeToggle from "@/app/components/ThemeToggle";

const navItems = [
  { title: "Reports", href: "/manager/reports", icon: BarChart3 },
  { title: "Uploads", href: "/manager/uploads", icon: Upload },
];

type UserInfo = { name: string; email: string; role: string };

export default function ManagerSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const totalUnread = useChatUnreadBadge();
  const profileRef = useRef<HTMLDivElement>(null);

  const closeChat = () => {
    forceStopChatUnreadPolling();
    forceStopChatStatusHeartbeat();
    setChatOpen(false);
  };

  useEffect(() => () => {
    forceStopChatUnreadPolling();
    forceStopChatStatusHeartbeat();
  }, []);

  useEffect(() => {
    getAuthMe().then(u => { if (u) setUser(u); }).catch(() => {});
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
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

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 bg-crm-surface border-b border-crm-border shadow-sm">
        <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">
          <Link href="/manager/reports" prefetch={false} className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-[14px] bg-[#B8112D] flex items-center justify-center shadow-sm overflow-hidden p-1">
              <Image
                src="/images/image.png"
                alt="logo"
                width={44}
                height={44}
                className="object-cover w-full h-full rounded-[10px] bg-white"
              />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-[18px] md:text-[20px] font-extrabold leading-none text-crm-text tracking-tight">
                CRM Dashboard
              </h2>
              <p className="text-[10px] md:text-[11px] font-semibold text-[#B8112D] mt-1 tracking-wide uppercase">
                Manager Panel
              </p>
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <nav
              className="mx-auto w-fit max-w-full flex items-center gap-0.5 bg-crm-nav-pill rounded-[18px] p-1 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {navItems.map(({ title, href, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    className={`h-10 px-3 md:px-4 rounded-[13px] flex items-center gap-2 text-[12px] md:text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                      active
                        ? "bg-[#B8112D] text-white shadow-md shadow-[#B8112D]/20"
                        : "text-crm-text-secondary hover:bg-crm-surface hover:text-[#B8112D]"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="hidden lg:inline">{title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setChatOpen(v => !v)}
            className={`relative w-9 h-9 rounded-[13px] flex items-center justify-center transition-all shrink-0 ${
              chatOpen
                ? "bg-[#B8112D] text-white shadow-md"
                : "bg-crm-nav-pill text-crm-text-muted hover:bg-crm-brand-soft hover:text-[#B8112D]"
            }`}
            title="Messages"
          >
            <MessageSquare size={16} />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#B8112D] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>

          <div ref={profileRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setProfileOpen(v => !v)}
              className="w-9 h-9 rounded-full bg-[#B8112D] text-white text-[11px] font-bold flex items-center justify-center"
            >
              {initials}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-2xl z-50 p-4">
                <p className="font-bold text-sm text-crm-text truncate">{user?.name ?? "Manager"}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="mt-4 w-full h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#fce8ec] disabled:opacity-60"
                >
                  <LogOut size={15} />
                  {loggingOut ? "Logging out…" : "Logout"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {chatOpen && <ChatPanel onClose={closeChat} />}
    </>
  );
}
