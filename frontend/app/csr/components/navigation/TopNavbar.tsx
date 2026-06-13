"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Link2, AlertTriangle, ThumbsDown, Users, FolderKanban, Trash2, User,
  Bell, LogOut, ChevronDown,
} from "lucide-react";
import API from "@/lib/api";

const menuItems = [
  { title: "Call Data",         href: "/csr",                icon: Link2       },
  { title: "Potential Clients", href: "/csr/important",      icon: AlertTriangle },
  { title: "Not Interested",    href: "/csr/not-interested",  icon: ThumbsDown  },
  { title: "Clients",           href: "/csr/leads",           icon: Users       },
  { title: "Active Projects",   href: "/csr/projects",        icon: FolderKanban },
  { title: "Bin",                href: "/csr/bin",             icon: Trash2      },
  { title: "Profile",           href: "/csr/profile",         icon: User        },
];

export default function TopNavbar() {
  const pathname = usePathname();
  const router    = useRouter();

  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut,  setLoggingOut]  = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
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

  return (
    <header className="sticky top-0 z-30 relative bg-linear-to-r from-[#7A0D1F]/95 via-[#B8112D]/95 to-[#9C1029]/95 backdrop-blur-md shadow-lg shadow-[#B8112D]/20">
      <div className="absolute inset-0 bg-linear-to-b from-white/15 to-transparent pointer-events-none" />
      <div className="relative px-3 sm:px-4 md:px-5 lg:px-8 h-16 sm:h-[72px] flex items-center gap-2 sm:gap-3 lg:gap-5">
        {/* Logo */}
        <Link href="/csr" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-[42px] sm:h-[42px] rounded-xl overflow-hidden shrink-0 bg-white/95 p-0.5 shadow-sm">
            <Image src="/images/image.png" alt="logo" width={42} height={42} className="object-cover w-full h-full rounded-[10px]" />
          </div>
          <div className="hidden sm:block">
            <div className="flex gap-1.5">
              <h2 className="text-[15px] font-bold leading-none text-white">BEM</h2>
              <h2 className="text-[15px] font-bold leading-none text-white/80">Solutions</h2>
            </div>
            <p className="text-[10px] text-white/60 mt-[2px]">CSR Panel</p>
          </div>
        </Link>

        <div className="hidden lg:block w-px h-7 bg-white/15 shrink-0" />

        {/* Nav tabs — single scrollable row with edge fade */}
        <div className="flex-1 relative min-w-0">
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-6">
            {menuItems.map(item => {
              const Icon   = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.title} href={item.href}
                  className={`flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-full text-[12px] sm:text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                    active ? "bg-white text-[#B8112D] shadow-sm" : "text-white/75 hover:text-white hover:bg-white/10"
                  }`}>
                  <Icon size={14} className="sm:w-3.75 sm:h-3.75 shrink-0" />
                  <span className="hidden sm:inline">{item.title}</span>
                </Link>
              );
            })}
          </nav>
          <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-linear-to-l from-[#9C1029] to-transparent" />
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white/75 hover:text-white hover:bg-white/10 transition-colors">
            <Bell size={18} />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2 sm:gap-2.5 hover:bg-white/10 rounded-full pl-1 pr-2 sm:pr-3 h-10 sm:h-11 transition-colors">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white text-[#B8112D] flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                C
              </div>
              <div className="hidden md:block text-left">
                <h4 className="text-[12px] font-semibold leading-none text-white">CSR User</h4>
                <p className="text-[10px] text-white/65 mt-1">Customer Support</p>
              </div>
              <ChevronDown size={14} className="hidden sm:block text-white/65" />
            </button>

            {profileOpen && (
              <div className="absolute top-12 sm:top-13 right-0 z-50 w-50 bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden p-1.5 sm:p-2">
                <Link href="/csr/profile" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#667085] hover:bg-[#F9FAFB] transition-colors">
                  <User size={16} />Profile
                </Link>
                <button onClick={handleLogout} disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#B8112D] hover:bg-[#FFF1F3] transition-colors disabled:opacity-60">
                  <LogOut size={16} />{loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
