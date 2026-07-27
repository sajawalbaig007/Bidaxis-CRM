"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, BarChart3, Users,
  GitBranch, FileText, LogOut, ChevronDown, MessageSquare,
} from "lucide-react";
import { logoutSession } from "@/lib/session";
import { getAuthMe, peekAuthMe } from "@/lib/authMeCache";
import { useChatUnreadBadge } from "@/lib/useChatUnreadBadge";
import { forceStopChatUnreadPolling } from "@/lib/chatUnreadStore";
import { forceStopChatStatusHeartbeat } from "@/lib/chatStatusHeartbeat";
import { forceDisconnectChatSocket } from "@/lib/chatSocket";
import ChatPanel from "@/app/components/chat/ChatPanel";
import ThemeToggle from "@/app/components/ThemeToggle";
import API from "@/lib/api";

const BASE = "/technical";

const navItems = [
  { title: "Dashboard",        href: `${BASE}`,                 icon: LayoutDashboard },
  { title: "Active Projects",  href: `${BASE}/active-projects`, icon: FolderKanban    },
  { title: "KPI",              href: `${BASE}/kpi`,             icon: BarChart3       },
  { title: "Team",             href: `${BASE}/team`,            icon: Users           },
  { title: "Revisions",        href: `${BASE}/revisions`,       icon: GitBranch       },
  { title: "Reports",          href: `${BASE}/reports`,         icon: FileText        },
];

type UserInfo = { name: string; email: string; role: string; profilePic?: string | null };

export default function TechnicalSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(() => peekAuthMe());
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const totalUnread = useChatUnreadBadge();
  const profileRef = useRef<HTMLDivElement>(null);

  const closeChat = () => {
    forceStopChatUnreadPolling();
    setChatOpen(false);
  };

  useEffect(() => () => {
    forceStopChatUnreadPolling();
    forceStopChatStatusHeartbeat();
    forceDisconnectChatSocket();
  }, []);

  useEffect(() => {
    const apply = (u: UserInfo | null) => { if (u) setUser(u); };
    apply(peekAuthMe());
    void getAuthMe().then(u => apply(u as UserInfo | null)).catch(() => {});
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutSession(() => API.post("/auth/logout", {}));
    window.location.href = "/login/technical_manager";
  };

  const initials = (user?.name ?? "TM")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 bg-crm-surface border-b border-crm-border shadow-sm">
        <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">
          <Link href={BASE} prefetch={false} className="flex items-center gap-3 shrink-0">
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
                Technical Manager
              </p>
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <nav
              className="mx-auto w-fit max-w-full flex items-center gap-0.5 bg-crm-nav-pill rounded-[18px] p-1 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {navItems.map(({ title, href, icon: Icon }) => {
                const active = href === BASE ? pathname === BASE : pathname.startsWith(href);
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
                    <span className="hidden md:inline">{title}</span>
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
              className="crm-profile-btn flex items-center gap-2 rounded-[14px] pl-1.5 pr-2.5 h-10 transition-colors"
            >
              <div className="w-8 h-8 rounded-[11px] bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {user?.profilePic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-[12px] font-bold leading-none text-crm-text max-w-[90px] truncate">
                  {user?.name ?? "TM"}
                </p>
                <p className="text-[10px] text-crm-text-muted mt-1">Technical Manager</p>
              </div>
              <ChevronDown
                size={13}
                className={`hidden sm:block text-crm-text-faint transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-2xl z-50 overflow-hidden">
                <div className="bg-gradient-to-br from-[#B8112D] to-[#7A0B1E] px-4 py-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
                    {user?.profilePic ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-[14px] font-bold truncate">{user?.name ?? "Technical Manager"}</p>
                    <p className="text-white/65 text-[11px] truncate mt-0.5">{user?.email ?? "—"}</p>
                  </div>
                </div>
                <div className="p-3">
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={loggingOut}
                    className="w-full h-9 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#FFE4E8] transition-colors"
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

      {chatOpen && <ChatPanel onClose={closeChat} />}
    </>
  );
}
