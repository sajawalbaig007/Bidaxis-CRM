"use client";

import AccountsSidebar from "../components/layout/Sidebar";
import CsrPayrollDesignView from "../components/csrPayroll/CsrPayrollDesignView";

export default function CsrPayrollPage() {
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <AccountsSidebar />
      <main className="pt-[76px] pb-10">
        <CsrPayrollDesignView />
      </main>
    </div>
  );
}
