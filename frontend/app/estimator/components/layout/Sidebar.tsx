"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard, FolderKanban, LogOut, ChevronDown, MessageSquare,
} from "lucide-react";
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
import EstimatorCheckInControl from "@/app/estimator/components/EstimatorCheckInControl";
import EstimatorCheckInBanner from "@/app/estimator/components/EstimatorCheckInBanner";
import API from "@/lib/api";

const BASE = "/estimator";
const ACCENT = "#7C3AED";

const navItems = [
  { title: "Dashboard", shortTitle: "Dashboard", href: `${BASE}`, icon: LayoutDashboard },
  { title: "My Projects", shortTitle: "Projects", href: `${BASE}/my-projects`, icon: FolderKanban },
];

type UserInfo = { name: string; email: string; role: string; profilePic?: string | null };

export default function EstimatorSidebar() {
  const [user, setUser] = useState<UserInfo | null>(() => peekAuthMe());
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const totalUnread = useChatUnreadBadge();
  const chatEnabled = useChatEnabled();
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
    window.location.href = "/login/estimator";
  };

  const initials = (user?.name ?? "ES")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 bg-crm-surface border-b border-crm-border shadow-sm">
        <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">
          <div className="flex-1 min-w-0 flex items-center">
            <Link href={BASE} prefetch={false} className="flex items-center gap-3 min-w-0">
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
                <p className="text-[10px] md:text-[11px] font-semibold mt-1 tracking-wide uppercase" style={{ color: ACCENT }}>
                  Estimator
                </p>
              </div>
            </Link>
          </div>

          <div className="min-w-0 shrink">
            <CapsuleChipNav items={navItems} baseHref={BASE} accent={ACCENT} variant="inline" />
          </div>

          <div className="flex-1 min-w-0 flex items-center justify-end gap-2 sm:gap-3">
            <EstimatorCheckInControl compact />
            <ThemeToggle />

            <button
              type="button"
              onClick={() => setChatOpen(v => !v)}
              className={`relative w-9 h-9 rounded-[13px] flex items-center justify-center transition-all shrink-0 ${
                chatOpen
                  ? "text-white shadow-md"
                  : "bg-crm-nav-pill text-crm-text-muted hover:text-[#7C3AED]"
              } ${!chatEnabled ? "opacity-50" : ""}`}
              style={chatOpen ? { background: ACCENT } : undefined}
              title={chatEnabled ? "Messages" : "Chat disabled by admin"}
            >
              <MessageSquare size={16} />
              {chatEnabled && totalUnread > 0 && (
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
                <div
                  className="w-8 h-8 rounded-[11px] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden"
                  style={{ background: ACCENT }}
                >
                  {user?.profilePic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-[12px] font-bold leading-none text-crm-text max-w-[90px] truncate">
                    {user?.name ?? "Estimator"}
                  </p>
                  <p className="text-[10px] text-crm-text-muted mt-1">Estimator</p>
                </div>
                <ChevronDown
                  size={13}
                  className={`hidden sm:block text-crm-text-faint transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-2xl z-50 overflow-hidden">
                  <div className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] px-4 py-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
                      {user?.profilePic ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-[14px] font-bold truncate">{user?.name ?? "Estimator"}</p>
                      <p className="text-white/65 text-[11px] truncate mt-0.5">{user?.email ?? "—"}</p>
                    </div>
                  </div>
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={loggingOut}
                      className="w-full h-9 rounded-xl bg-violet-50 text-[#7C3AED] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-violet-100 transition-colors"
                    >
                      <LogOut size={13} />
                      {loggingOut ? "Logging out…" : "Logout"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <EstimatorCheckInBanner />

      {chatOpen && <ChatPanel onClose={closeChat} />}
    </>
  );
}
