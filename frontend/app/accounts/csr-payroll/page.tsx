"use client";

import AccountsSidebar from "../components/layout/Sidebar";
import SalesPayrollDesignView from "../components/csrPayroll/SalesPayrollDesignView";

export default function SalesPayrollPage() {
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <AccountsSidebar />
      <main className="pt-[76px] pb-10">
        <SalesPayrollDesignView />
      </main>
    </div>
  );
}
