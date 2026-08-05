"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Scale, TrendingUp, Landmark, Building2, FileText, LogOut, MessageSquare, ChevronDown } from "lucide-react";
import { logoutSession } from "@/lib/session";
import API from "@/lib/api";
import ThemeToggle from "@/app/components/ThemeToggle";
import ChatPanel from "@/app/components/chat/ChatPanel";
import CapsuleChipNav from "@/app/components/CapsuleChipNav";
import { getAuthMe, peekAuthMe } from "@/lib/authMeCache";
import { useChatUnreadBadge } from "@/lib/useChatUnreadBadge";
import { useChatEnabled } from "@/lib/useChatEnabled";
import { forceStopChatUnreadPolling } from "@/lib/chatUnreadStore";
import { forceStopChatStatusHeartbeat } from "@/lib/chatStatusHeartbeat";
import { forceDisconnectChatSocket } from "@/lib/chatSocket";

const BASE = "/accounts";

const navItems = [
  { title: "Dashboard", href: `${BASE}`, icon: LayoutDashboard },
  { title: "Balance Sheet", href: `${BASE}/balance-sheet`, icon: Scale },
  { title: "Income Statement", href: `${BASE}/income-statement`, icon: TrendingUp },
  { title: "Cash Flow Statement", href: `${BASE}/cash-flow-statement`, icon: Landmark },
  { title: "Total Assets", href: `${BASE}/total-assets`, icon: Building2 },
  { title: "Reports", href: `${BASE}/reports`, icon: FileText },
];

type UserInfo = {
  name: string;
  email: string;
  role: string;
  profilePic?: string | null;
};

export default function AccountsSidebar() {
  const [user, setUser] = useState<UserInfo | null>(() => peekAuthMe());
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const totalUnread = useChatUnreadBadge();
  const chatEnabled = useChatEnabled();

  useEffect(() => {
    void getAuthMe(false).then(u => {
      if (u) setUser(u);
    });
    const onAuthUpdated = () => {
      const snap = peekAuthMe();
      if (snap) setUser(snap);
      void getAuthMe(true).then(u => {
        if (u) setUser(u);
      });
    };
    window.addEventListener("crm-auth-me-updated", onAuthUpdated);
    return () => window.removeEventListener("crm-auth-me-updated", onAuthUpdated);
  }, []);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => () => {
    forceStopChatUnreadPolling();
  }, []);

  const handleLogout = async () => {
    forceStopChatUnreadPolling();
    forceStopChatStatusHeartbeat();
    forceDisconnectChatSocket();
    await logoutSession(() => API.post("/auth/logout", {}));
    window.location.href = "/login/accounts";
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map(n => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AC";

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-30 bg-crm-surface/90 backdrop-blur-md border-b border-crm-border shadow-[0_1px_12px_-4px_rgba(15,23,42,0.08)]">
      <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-2 sm:gap-3">
        <Link href={BASE} prefetch={false} className="flex items-center gap-3 shrink-0">
          <div className="w-11 h-11 rounded-[14px] bg-[#B8112D] flex items-center justify-center shadow-md shadow-[#B8112D]/25 overflow-hidden p-1">
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
              Accounts Panel
            </p>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <CapsuleChipNav
            items={navItems}
            baseHref={BASE}
            accent="#B8112D"
            variant="inline"
          />
        </div>

        <ThemeToggle />

        <button
          type="button"
          onClick={() => {
            setChatOpen(v => !v);
            setProfileOpen(false);
          }}
          className={`relative w-9 h-9 rounded-[12px] flex items-center justify-center transition-all shrink-0 ${
            chatOpen
              ? "bg-[#B8112D] text-white shadow-md"
              : "bg-crm-nav-pill text-crm-text-muted hover:bg-crm-brand-soft hover:text-[#B8112D]"
          } ${!chatEnabled ? "opacity-50" : ""}`}
          title={chatEnabled ? "Messages" : "Chat disabled by admin"}
        >
          <MessageSquare size={16} />
          {chatEnabled && totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#B8112D] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-crm-surface">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>

        <div ref={profileRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setProfileOpen(v => !v);
              setChatOpen(false);
            }}
            className="crm-profile-btn flex items-center gap-2 rounded-[14px] pl-1.5 pr-2.5 h-10 transition-colors"
          >
            <div className="w-8 h-8 rounded-[10px] bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
              {user?.profilePic
                ? <Image src={user.profilePic} alt={user.name} width={32} height={32} className="w-full h-full object-cover" />
                : initials
              }
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-[12px] font-bold leading-none text-crm-text max-w-[90px] truncate">
                {user?.name ?? "Accounts User"}
              </p>
              <p className="text-[10px] text-crm-text-muted mt-1 max-w-[90px] truncate">
                Accounts
              </p>
            </div>
            <ChevronDown size={13} className={`hidden sm:block text-crm-text-faint transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-2xl z-50 overflow-hidden">
              <div className="bg-gradient-to-br from-[#B8112D] to-[#7A0B1E] px-4 py-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
                  {user?.profilePic
                    ? <Image src={user.profilePic} alt={user?.name ?? "Avatar"} width={48} height={48} className="w-full h-full object-cover" />
                    : initials
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-white text-[14px] font-bold truncate">
                    {user?.name ?? "Accounts User"}
                  </p>
                  <p className="text-white/65 text-[11px] truncate mt-0.5">
                    {user?.email ?? "—"}
                  </p>
                </div>
              </div>
              <div className="p-3">
                <p className="text-[10px] text-crm-text-muted font-semibold uppercase tracking-wide mb-1">Role</p>
                <p className="text-[12px] font-semibold text-crm-text">{user?.role ?? "accounts"}</p>
              </div>
              <div className="px-3 pb-3">
                <button
                  onClick={() => void handleLogout()}
                  className="w-full h-9 rounded-xl bg-[#FFF1F3] dark:bg-[#B8112D]/15 hover:bg-[#ffe4e9] dark:hover:bg-[#B8112D]/25 text-[#B8112D] text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut size={13} />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
    {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}
