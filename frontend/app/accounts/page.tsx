"use client";

import AccountsSidebar from "./components/layout/Sidebar";

export default function AccountsDashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6">
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Accounts overview will be built here.</p>
        </div>
      </main>
    </div>
  );
}
