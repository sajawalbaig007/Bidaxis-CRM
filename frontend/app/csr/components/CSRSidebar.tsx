"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import API from "@/lib/api";

import {
  Link2,
  AlertTriangle,
  FolderKanban,
  User,
  LogOut,
  X,
  ThumbsDown,
  Users,
  Trash2,
} from "lucide-react";

const menuItems = [
  {
    title: "Call Data",
    href: "/csr",
    icon: Link2,
  },
  {
    title: "Potential Clients",
    href: "/csr/important",
    icon: AlertTriangle,
  },
  {
    title: "Not Interested",
    href: "/csr/not-interested",
    icon: ThumbsDown,
  },
  {
    title: "Clients",
    href: "/csr/leads",
    icon: Users,
  },
  {
    title: "Active Projects",
    href: "/csr/projects",
    icon: FolderKanban,
  },
  {
    title: "Bin",
    href: "/csr/bin",
    icon: Trash2,
  },
  {
    title: "Profile",
    href: "/csr/profile",
    icon: User,
  },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

export default function CSRSidebar({ isOpen, setIsOpen }: SidebarProps) {

  const pathname = usePathname();
  const router   = useRouter();
  const [loading, setLoading] = useState(false);

  /* ── LOGOUT ── */
  const handleLogout = async () => {
    try {
      setLoading(true);
      await API.post("/auth/logout", {});
      document.cookie = "token=; path=/; max-age=0; SameSite=None; Secure";
      toast.success("Logged out successfully.");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Logout failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* MOBILE OVERLAY */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 transition-all duration-300 lg:hidden ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
      />

      {/* SIDEBAR */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] bg-white border-r border-gray-100 flex flex-col justify-between transition-all duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* TOP */}
        <div>
          {/* LOGO */}
          <div className="h-[92px] px-6 flex items-center justify-between border-b border-gray-100 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-[42px] h-[42px] rounded-xl overflow-hidden shrink-0">
                <Image src="/images/image.png" alt="logo" width={42} height={42} className="object-cover w-full h-full"/>
              </div>
              <div>
                <div className="flex gap-1.5">
                  <h2 className="text-[16px] font-bold leading-none text-[#B8112D]">BEM</h2>
                  <h2 className="text-[16px] font-bold leading-none text-[#0F172A]">Solutions</h2>
                </div>
                <p className="text-[11px] text-gray-400 mt-[2px]">CSR Panel</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden w-9 h-9 rounded-xl bg-[#F5F6FA] flex items-center justify-center"
            >
              <X size={18}/>
            </button>
          </div>

          {/* MENU */}
          <div className="px-4 pt-6 space-y-3">
            {menuItems.map((item) => {
              const Icon   = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-4 h-[50px] px-5 rounded-[18px] text-[15px] font-medium transition-all duration-200 ${
                    active
                      ? "bg-[#B8112D] text-white shadow-sm"
                      : "text-[#667085] hover:bg-[#F9FAFB]"
                  }`}
                >
                  <Icon size={18} strokeWidth={2}/>
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>

        {/* LOGOUT */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full h-[52px] rounded-[18px] bg-[#FFF1F3] hover:bg-[#ffe4e9] transition flex items-center justify-center gap-3 text-[#B8112D] font-medium text-[15px] disabled:opacity-60"
          >
            <LogOut size={18}/>
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}