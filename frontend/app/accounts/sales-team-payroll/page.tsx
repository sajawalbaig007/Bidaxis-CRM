"use client";

import AccountsSidebar from "../components/layout/Sidebar";
import SalesPayrollPageContent from "../components/salesPayroll/SalesPayrollPageContent";

export default function SalesTeamPayrollPage() {
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <AccountsSidebar />
      <main className="pt-[76px] pb-10">
        <SalesPayrollPageContent variant="sales" />
      </main>
    </div>
  );
}
