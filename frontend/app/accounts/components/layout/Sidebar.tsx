"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Scale, TrendingUp, Landmark, Building2, LogOut } from "lucide-react";
import { logoutSession } from "@/lib/session";
import API from "@/lib/api";

const BASE = "/accounts";

const navItems = [
  { title: "Dashboard", href: `${BASE}`, icon: LayoutDashboard },
  { title: "Balance Sheet", href: `${BASE}/balance-sheet`, icon: Scale },
  { title: "Income Statement", href: `${BASE}/income-statement`, icon: TrendingUp },
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
    <header className="fixed top-0 left-0 right-0 z-30 bg-crm-surface border-b border-crm-border shadow-sm">
      <div className="h-[64px] px-3 sm:px-4 lg:px-5 flex items-center gap-3">
        <Link href={BASE} prefetch={false} className="shrink-0">
          <h2 className="text-[18px] md:text-[20px] font-extrabold leading-none text-crm-text tracking-tight">
            Accounts
          </h2>
          <p className="text-[10px] md:text-[11px] font-semibold text-[#B8112D] mt-1 tracking-wide uppercase">
            Financial Dashboard
          </p>
        </Link>

        <div className="flex-1 min-w-0">
          <nav className="mx-auto w-fit max-w-full flex items-center gap-0.5 bg-crm-nav-pill rounded-[18px] p-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="h-10 px-3 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#FFE4E8]"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
}
