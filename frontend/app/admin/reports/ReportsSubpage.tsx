"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import DashboardNavbar from "../components/layout/Navbar";
import { StaffSidebar } from "@/app/hooks/useStaffSidebar";

export default function ReportsSubpage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const manager = pathname.startsWith("/manager");
  const back = manager ? "/manager/reports" : "/admin/reports";

  return (
    <div className="flex min-h-screen bg-[#EEF1F7] dark:bg-crm-bg-subtle">
      <StaffSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[var(--app-header-h,64px)]">
        <DashboardNavbar />
        <div className="w-full px-3 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-4 sm:py-5 space-y-3.5 sm:space-y-4">
          <header>
            <Link
              href={back}
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-semibold text-[#B8112D] shadow-sm dark:border-crm-border dark:bg-crm-surface"
            >
              <ArrowLeft size={14} /> Reports
            </Link>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#B8112D]/80">
              {manager ? "Admin portal · Reports" : "Admin · Reports"}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-crm-text">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-crm-text-muted">{subtitle}</p>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
