"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Link2,
  AlertTriangle,
  ThumbsDown,
  Users,
  FolderKanban,
  Trash2,
  MessageSquare,
  Bell,
  LogOut,
  ChevronDown,
  Phone,
  Clock,
} from "lucide-react";
import API from "@/lib/api";
import { requestNotificationPermission } from "../../hooks/useChatNotifications";

const navItems = [
  { title: "Call Data",         href: "/csr",                      icon: Link2        },
  { title: "Potential Clients", href: "/csr/potential-clients",    icon: AlertTriangle },
  { title: "Not Interested",    href: "/csr/not-interested",       icon: ThumbsDown   },
  { title: "Clients",           href: "/csr/clients",              icon: Users        },
  { title: "Active Projects",   href: "/csr/active-projects",      icon: FolderKanban },
  { title: "Bin",               href: "/csr/bin",                  icon: Trash2       },
  { title: "Chat",              href: "/csr/chat",                 icon: MessageSquare },
];

type UserInfo = {
  name: string;
  email: string;
  role: string;
  csrCode?:    string | null;
  cnic?:       string | null;
  profilePic?: string | null;
};

type ScheduledCall = {
  id: string;
  client: string;
  date: string;
  time: string;
  timezone: string;
};

const TODAY = new Date().toISOString().split("T")[0];

// Module-level cache — persists across page navigations within the same session
let _cachedUser: UserInfo | null = null;
let _cachedCalls: ScheduledCall[] = [];
let _lastFetch = 0;
const NAV_CACHE_TTL = 60_000;

function labelDate(d: string) {
  const tmr = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];
  if (d === TODAY) return "Today";
  if (d === tmr) return "Tomorrow";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export default function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(
    () => (Date.now() - _lastFetch < NAV_CACHE_TTL ? _cachedUser : null)
  );
  const [calls, setCalls] = useState<ScheduledCall[]>(
    () => (Date.now() - _lastFetch < NAV_CACHE_TTL ? _cachedCalls : [])
  );
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [bellOpen,     setBellOpen]     = useState(false);
  const [loggingOut,   setLoggingOut]   = useState(false);
  const [notifPerm,    setNotifPerm]    = useState<NotificationPermission | "unsupported">(
    () => typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  const profileRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Date.now() - _lastFetch < NAV_CACHE_TTL) return;

    type L = {
      id: string;
      name?: string;
      status?: string;
      nextSchedule?: string;
      nextTime?: string;
      timezone?: string;
    };

    Promise.all([
      API.get("/auth/me").catch(() => null),
      API.get("/csr/dashboard").catch(() => null),
    ]).then(([meRes, dashRes]) => {
      const userData: UserInfo | null = meRes?.data?.user ?? null;
      const leads: L[] = dashRes?.data?.leads ?? [];
      const upcoming = leads
        .filter((l) => l.status === "important" && l.nextSchedule && l.nextTime)
        .filter((l) => (l.nextSchedule ?? "") >= TODAY)
        .sort((a, b) => (`${a.nextSchedule}T${a.nextTime}` < `${b.nextSchedule}T${b.nextTime}` ? -1 : 1))
        .slice(0, 20)
        .map((l) => ({ id: l.id, client: l.name ?? "Client", date: l.nextSchedule!, time: l.nextTime!, timezone: l.timezone ?? "" }));

      _cachedUser  = userData;
      _cachedCalls = upcoming;
      _lastFetch   = Date.now();
      setUser(userData);
      setCalls(upcoming);
    });
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }

      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };

    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await API.post("/auth/logout", {});
      document.cookie = "token=; path=/; max-age=0; SameSite=None; Secure";
      toast.success("Logged out successfully.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Logout failed.");
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CR";

  const todayCalls = calls.filter((c) => c.date === TODAY);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPerm(granted ? "granted" : Notification.permission);
    if (granted) toast.success("Notifications enabled!");
    else toast.error("Notifications blocked — enable in browser settings.");
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">
        <Link href="/csr" className="flex items-center gap-3 shrink-0">
          <div className="w-11 h-11 rounded-[14px] bg-[#B8112D] flex items-center justify-center shadow-sm overflow-hidden p-1">
            <Image
              src="/images/image.png"
              alt="logo"
              width={44}
              height={44}
              className="object-cover w-full h-full rounded-[10px] bg-white"
            />
          </div>

          <div className="hidden sm:block min-w-[170px]">
            <h2 className="text-[18px] md:text-[20px] font-extrabold leading-none text-[#111827] tracking-tight">
              CRM Dashboard
            </h2>
            <p className="text-[10px] md:text-[11px] font-semibold text-[#B8112D] mt-1 tracking-wide uppercase">
              BEM Solutions
            </p>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <nav
            className="mx-auto w-fit max-w-full flex items-center gap-1 bg-[#F3F4F6] rounded-[18px] p-1 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {navItems.map(({ title, href, icon: Icon }) => {
              const active =
                href === "/csr" ? pathname === "/csr" : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className={`h-10 px-3.5 md:px-4 rounded-[13px] flex items-center gap-2 text-[12px] md:text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                    active
                      ? "bg-[#B8112D] text-white shadow-md shadow-[#B8112D]/20"
                      : "text-[#374151] hover:bg-white hover:text-[#B8112D]"
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="hidden md:inline">{title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div ref={bellRef} className="relative">
            <button
              onClick={() => {
                setBellOpen((v) => !v);
                setProfileOpen(false);
              }}
              className="relative w-10 h-10 rounded-[13px] flex items-center justify-center text-[#4B5563] hover:text-[#B8112D] hover:bg-[#F3F4F6] transition-colors"
            >
              <Bell size={18} />

              {calls.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] bg-[#B8112D] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {calls.length > 9 ? "9+" : calls.length}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[300px] sm:w-[320px] bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-[#B8112D]" />
                    <span className="text-[13px] font-bold text-[#0F172A]">
                      Scheduled Calls
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {todayCalls.length > 0 && (
                      <span className="text-[11px] bg-[#FFF1F3] text-[#B8112D] font-bold px-2 py-0.5 rounded-full">
                        {todayCalls.length} today
                      </span>
                    )}
                    {calls.length === 0 && (
                      <span className="text-[11px] text-gray-400">No upcoming</span>
                    )}
                  </div>
                </div>

                {notifPerm !== "granted" && notifPerm !== "unsupported" && (
                  <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-amber-700 font-medium">
                      {notifPerm === "denied" ? "Notifications blocked in browser" : "Enable message notifications"}
                    </p>
                    {notifPerm !== "denied" && (
                      <button
                        onClick={handleEnableNotifications}
                        className="text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2.5 py-1 rounded-lg shrink-0 transition-colors"
                      >
                        Enable
                      </button>
                    )}
                  </div>
                )}

                <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-50">
                  {calls.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell size={26} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-gray-400 text-[13px]">
                        No scheduled calls
                      </p>
                      <p className="text-gray-300 text-[11px] mt-1">
                        Mark leads as Important + set a time
                      </p>
                    </div>
                  ) : (
                    calls.map((c) => {
                      const label = labelDate(c.date);
                      const isToday = label === "Today";
                      const tzShort = c.timezone
                        ? c.timezone.split("/").pop()?.replace("_", " ") ??
                          c.timezone
                        : "";

                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            isToday ? "bg-[#FFFBF5]" : "hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isToday
                                ? "bg-[#FFF1F3] text-[#B8112D]"
                                : "bg-[#FFF7E6] text-[#B54708]"
                            }`}
                          >
                            <Phone size={14} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                              {c.client}
                            </p>

                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock
                                size={10}
                                className="text-gray-400 shrink-0"
                              />
                              <p className="text-[11px] text-gray-500 truncate">
                                {c.time}
                                {tzShort ? ` · ${tzShort}` : ""}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              isToday
                                ? "bg-[#FFF1F3] text-[#B8112D]"
                                : "bg-[#FFF7E6] text-[#B54708]"
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={profileRef} className="relative">
            <button
              onClick={() => {
                setProfileOpen((v) => !v);
                setBellOpen(false);
              }}
              className="flex items-center gap-2 hover:bg-[#F3F4F6] rounded-[14px] pl-1.5 pr-2.5 h-10 transition-colors"
            >
              <div className="w-8 h-8 rounded-[11px] bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {user?.profilePic
                  ? <Image src={user.profilePic} alt={user.name} width={32} height={32} className="w-full h-full object-cover" />
                  : initials
                }
              </div>

              <div className="hidden lg:block text-left">
                <p className="text-[12px] font-bold leading-none text-[#111827] max-w-[90px] truncate">
                  {user?.name ?? "CSR User"}
                </p>
                <p className="text-[10px] text-gray-500 mt-1 max-w-[90px] truncate">
                  {user?.csrCode ?? "Customer Support"}
                </p>
              </div>

              <ChevronDown
                size={13}
                className={`hidden sm:block text-gray-400 transition-transform duration-200 ${
                  profileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[240px] bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 overflow-hidden">
                <div className="bg-gradient-to-br from-[#B8112D] to-[#7A0B1E] px-4 py-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
                    {user?.profilePic
                      ? <Image src={user.profilePic} alt={user?.name ?? "Avatar"} width={48} height={48} className="w-full h-full object-cover" />
                      : initials
                    }
                  </div>

                  <div className="min-w-0">
                    <p className="text-white text-[14px] font-bold truncate">
                      {user?.name ?? "CSR User"}
                    </p>
                    <p className="text-white/65 text-[11px] truncate mt-0.5">
                      {user?.email ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="p-3 space-y-1.5">
                  <InfoRow label="Full Name" value={user?.name ?? "—"} />
                  <InfoRow label="Email" value={user?.email ?? "—"} small />
                  <InfoRow label="Role" value="Customer Support" />

                  {user?.csrCode && (
                    <InfoRow label="CSR Code" value={user.csrCode} mono />
                  )}
                  {user?.cnic && (
                    <InfoRow label="CNIC" value={user.cnic} mono />
                  )}
                </div>

                <div className="px-3 pb-3">
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
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
      </div>
    </header>
  );
}

function InfoRow({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-[#F5F6FA] rounded-xl">
      <span className="text-[10px] text-gray-400 font-medium shrink-0">
        {label}
      </span>

      <span
        className={`text-right truncate max-w-[140px] ${
          mono
            ? "font-mono text-[#B8112D] text-[11px] font-bold"
            : small
            ? "text-[10px] text-[#0F172A]"
            : "text-[11px] font-semibold text-[#0F172A]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}