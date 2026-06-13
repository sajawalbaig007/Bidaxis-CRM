"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Menu, LogOut, ChevronDown,
  Link2, AlertTriangle, ThumbsDown, Users,
  FolderKanban, Trash2, MessageSquare,
} from "lucide-react";
import API from "@/lib/api";
import toast from "react-hot-toast";

const navItems = [
  { title: "Call Data",       href: "/csr",                icon: Link2         },
  { title: "Potential",       href: "/csr/important",      icon: AlertTriangle },
  { title: "Not Interested",  href: "/csr/not-interested", icon: ThumbsDown    },
  { title: "Clients",         href: "/csr/leads",          icon: Users         },
  { title: "Projects",        href: "/csr/projects",       icon: FolderKanban  },
  { title: "Bin",             href: "/csr/bin",            icon: Trash2        },
  { title: "Chat",            href: "/csr/profile",        icon: MessageSquare },
];

type UserInfo = { name: string; email: string; role: string; csrCode?: string | null };

interface NavbarProps {
  setIsOpen: (value: boolean) => void;
}

export default function CSRNavbar({ setIsOpen }: NavbarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const [user,       setUser]       = useState<UserInfo | null>(null);
  const [dropOpen,   setDropOpen]   = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    API.get("/auth/me")
      .then(r => { if (r.data?.user) setUser(r.data.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropOpen(false);
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
    } catch { toast.error("Logout failed."); }
    finally { setLoggingOut(false); }
  };

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "CR";

  return (
    <div className="sticky top-0 z-30 bg-[#F5F6FA] pb-4">

      {/* ── MOBILE ──────────────────────────────────────────── */}
      <div className="lg:hidden bg-white border border-gray-200 rounded-2xl px-4 h-[64px] flex items-center justify-between shadow-sm">
        <Image
          src="/images/logo.jpeg"
          alt="logo"
          width={120}
          height={36}
          className="object-contain h-auto w-auto"
        />
        <div className="flex items-center gap-2">
          <button className="relative w-[40px] h-[40px] rounded-xl bg-[#FFF1F3] border border-[#F5C6CE] flex items-center justify-center">
            <Bell size={16} className="text-[#B8112D]" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#B8112D]" />
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="w-[40px] h-[40px] rounded-xl bg-[#F5F6FA] border border-gray-200 flex items-center justify-center"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────── */}
      <div className="hidden lg:flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 h-[68px] shadow-sm">

        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-gray-100">
            <Image
              src="/images/image.png"
              alt="logo"
              width={36}
              height={36}
              className="object-cover w-full h-full"
            />
          </div>
          <div className="leading-none">
            <div className="flex gap-1">
              <span className="text-[13px] font-extrabold text-[#B8112D]">BEM</span>
              <span className="text-[13px] font-extrabold text-[#0F172A]">Solutions</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5 tracking-wide">CSR Panel</p>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-100 shrink-0 mx-1" />

        {/* Nav tabs — colored pills, only active is red */}
        <div
          className="flex items-center gap-0.5 bg-[#F5F6FA] rounded-xl p-[5px] flex-1 min-w-0 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {navItems.map(({ title, href, icon: Icon }) => {
            const active =
              href === "/csr"
                ? pathname === "/csr"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] text-[12px] font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${
                  active
                    ? "bg-[#B8112D] text-white shadow-sm"
                    : "text-[#667085] hover:text-[#0F172A] hover:bg-white hover:shadow-sm"
                }`}
              >
                <Icon size={12} strokeWidth={2.2} />
                {title}
              </Link>
            );
          })}
        </div>

        <div className="w-px h-8 bg-gray-100 shrink-0 mx-1" />

        {/* Bell */}
        <button className="relative w-[40px] h-[40px] rounded-xl bg-[#F5F6FA] border border-gray-100 flex items-center justify-center hover:border-[#B8112D] hover:bg-[#FFF1F3] transition-all shrink-0">
          <Bell size={16} className="text-gray-500" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#B8112D]" />
        </button>

        {/* Profile dropdown */}
        <div ref={dropRef} className="relative shrink-0">
          <button
            onClick={() => setDropOpen(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
              dropOpen
                ? "bg-[#FFF1F3] border-[#B8112D]"
                : "bg-[#F5F6FA] border-gray-100 hover:border-[#B8112D] hover:bg-[#FFF1F3]"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#B8112D] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
              {initials}
            </div>
            <div className="hidden xl:block text-left min-w-0">
              <p className="text-[12px] font-semibold text-[#0F172A] leading-none max-w-[84px] truncate">
                {user?.name ?? "CSR User"}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 max-w-[84px] truncate">
                {user?.csrCode ?? "Customer Support"}
              </p>
            </div>
            <ChevronDown
              size={12}
              className={`text-gray-400 transition-transform duration-200 ${dropOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown panel */}
          {dropOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[232px] bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 overflow-hidden">

              {/* gradient header */}
              <div className="bg-gradient-to-br from-[#B8112D] to-[#7A0B1E] px-4 py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 text-white flex items-center justify-center text-base font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-[13px] font-semibold truncate">
                    {user?.name ?? "CSR User"}
                  </p>
                  <p className="text-white/65 text-[11px] truncate">
                    {user?.email ?? "—"}
                  </p>
                </div>
              </div>

              {/* info rows */}
              <div className="p-3 space-y-1.5">
                <InfoRow
                  label="Role"
                  value={user?.role === "csr" ? "Customer Support" : (user?.role ?? "CSR")}
                />
                {user?.csrCode && (
                  <InfoRow label="CSR Code" value={user.csrCode} mono />
                )}
                <InfoRow label="Email" value={user?.email ?? "—"} small />
              </div>

              {/* logout */}
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
  );
}

function InfoRow({
  label, value, mono, small,
}: {
  label: string; value: string; mono?: boolean; small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-[#F5F6FA] rounded-xl">
      <span className="text-[10px] text-gray-400 font-medium shrink-0">{label}</span>
      <span
        className={`text-right truncate max-w-[130px] ${
          mono  ? "font-mono text-[#B8112D] text-[11px] font-bold" :
          small ? "text-[10px] text-[#0F172A]" :
                  "text-[11px] font-semibold text-[#0F172A]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
