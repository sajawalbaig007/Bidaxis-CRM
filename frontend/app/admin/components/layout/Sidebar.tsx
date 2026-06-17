"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  LayoutDashboard, Users, FileText, BarChart3,
  FolderKanban, Upload, Trash2, Settings,
  LogOut, ChevronDown, MessageSquare,
} from "lucide-react";
import API from "@/lib/api";
import { getAuthMe } from "@/lib/authMeCache";
import { getCsrDashboard } from "@/lib/csrDashboardCache";
import { visibleInterval } from "@/lib/visibleInterval";
import SessionNotifierInit from "@/app/components/SessionNotifierInit";
import AdminChatPanel from "./AdminChatPanel";

const navItems = [
  { title: "Dashboard",       href: "/admin",                 icon: LayoutDashboard },
  { title: "Users",           href: "/admin/users",           icon: Users           },
  { title: "Leads",           href: "/admin/leads",           icon: FileText        },
  { title: "Reports",         href: "/admin/reports",         icon: BarChart3       },
  { title: "Active Projects", href: "/admin/active-projects", icon: FolderKanban    },
  { title: "Uploads",         href: "/admin/uploads",         icon: Upload          },
  { title: "Bin",             href: "/admin/bin",             icon: Trash2          },
  { title: "Settings",        href: "/admin/settings",        icon: Settings        },
];

type UserInfo = { name: string; email: string; role: string };

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [user,        setUser]        = useState<UserInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const profileRef    = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<Record<string, number>>({});
  const notifOk       = useRef(false);

  useEffect(() => {
    getAuthMe().then(u => { if (u) setUser(u); }).catch(() => {});
    if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
      Notification.requestPermission().then(p => { notifOk.current = p === "granted"; });
    } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      notifOk.current = true;
    }
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (chatOpen) return;

    let isFirst = true;
    const poll = async () => {
      try {
        const r = await API.get("/chat/conversations");
        const convs: { id: string; name: string; unreadCount: number; lastMessage?: string }[] =
          r.data.conversations ?? r.data ?? [];
        const total = convs.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
        setTotalUnread(total);

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
    return visibleInterval(poll, 30_000);
  }, [chatOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await API.post("/auth/logout", {});
      document.cookie = "token=; path=/; max-age=0; SameSite=None; Secure";
      toast.success("Logged out successfully.");
      router.push("/");
      router.refresh();
    } catch { toast.error("Logout failed."); }
    finally { setLoggingOut(false); }
  };

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  return (
    <>
      <SessionNotifierInit />
      <header className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">

          {/* Logo */}
          <Link href="/admin" className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-[14px] bg-[#B8112D] flex items-center justify-center shadow-sm overflow-hidden p-1">
              <Image
                src="/images/image.png" alt="logo"
                width={44} height={44}
                className="object-cover w-full h-full rounded-[10px] bg-white"
              />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-[18px] md:text-[20px] font-extrabold leading-none text-[#111827] tracking-tight">
                CRM Dashboard
              </h2>
              <p className="text-[10px] md:text-[11px] font-semibold text-[#B8112D] mt-1 tracking-wide uppercase">
                Admin Panel
              </p>
            </div>
          </Link>

          {/* Nav */}
          <div className="flex-1 min-w-0">
            <nav
              className="mx-auto w-fit max-w-full flex items-center gap-0.5 bg-[#F3F4F6] rounded-[18px] p-1 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {navItems.map(({ title, href, icon: Icon }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                return (
                  <Link
                    key={href} href={href} prefetch={false}
                    className={`h-10 px-3 md:px-4 rounded-[13px] flex items-center gap-2 text-[12px] md:text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                      active
                        ? "bg-[#B8112D] text-white shadow-md shadow-[#B8112D]/20"
                        : "text-[#374151] hover:bg-white hover:text-[#B8112D]"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="hidden lg:inline">{title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Chat button */}
          <button
            onClick={() => setChatOpen(v => !v)}
            className={`relative w-9 h-9 rounded-[13px] flex items-center justify-center transition-all shrink-0 ${chatOpen ? "bg-[#B8112D] text-white shadow-md" : "bg-[#F3F4F6] text-gray-500 hover:bg-[#FFF1F3] hover:text-[#B8112D]"}`}
            title="Messages"
          >
            <MessageSquare size={16} />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#B8112D] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>

          {/* Profile */}
          <div ref={profileRef} className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2 hover:bg-[#F3F4F6] rounded-[14px] pl-1.5 pr-2.5 h-10 transition-colors"
            >
              <div className="w-8 h-8 rounded-[11px] bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {initials}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-[12px] font-bold leading-none text-[#111827] max-w-[90px] truncate">
                  {user?.name ?? "Admin"}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Administration</p>
              </div>
              <ChevronDown
                size={13}
                className={`hidden sm:block text-gray-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 overflow-hidden">
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

      {chatOpen && <AdminChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}
