"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Scale, TrendingUp, Landmark, Building2, LogOut, Users } from "lucide-react";
import { logoutSession } from "@/lib/session";
import API from "@/lib/api";
import ThemeToggle from "@/app/components/ThemeToggle";

const BASE = "/accounts";

const navItems = [
  { title: "Dashboard", href: `${BASE}`, icon: LayoutDashboard },
  { title: "Balance Sheet", href: `${BASE}/balance-sheet`, icon: Scale },
  { title: "Income Statement", href: `${BASE}/income-statement`, icon: TrendingUp },
  { title: "CSR Payroll", href: `${BASE}/csr-payroll`, icon: Users },
  { title: "Cash Flow Statement", href: `${BASE}/cash-flow-statement`, icon: Landmark },
  { title: "Total Assets", href: `${BASE}/total-assets`, icon: Building2 },
];

export default function AccountsSidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await logoutSession(() => API.post("/auth/logout", {}));
    window.location.href = "/login/accounts";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200/70 shadow-[0_1px_12px_-4px_rgba(15,23,42,0.08)]">
      <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">
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
            <h2 className="text-[18px] md:text-[20px] font-extrabold leading-none text-[#0F172A] tracking-tight">
              CRM Dashboard
            </h2>
            <p className="text-[10px] md:text-[11px] font-semibold text-[#B8112D] mt-1 tracking-wide uppercase">
              Accounts Panel
            </p>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <nav className="mx-auto w-fit max-w-full flex items-center gap-0.5 bg-[#F4F5F8] rounded-[18px] p-1 overflow-x-auto border border-gray-100/80" style={{ scrollbarWidth: "none" }}>
            {navItems.map(({ title, href, icon: Icon }) => {
              const active = href === BASE ? pathname === BASE : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className={`h-10 px-3 md:px-4 rounded-[13px] flex items-center gap-2 text-[12px] md:text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                    active
                      ? "bg-[#B8112D] text-white shadow-md shadow-[#B8112D]/25"
                      : "text-gray-600 hover:bg-white hover:text-[#B8112D]"
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
          onClick={() => void handleLogout()}
          className="h-10 px-3 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#FFE4E8] transition-colors border border-[#F3D7DC]/50"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
