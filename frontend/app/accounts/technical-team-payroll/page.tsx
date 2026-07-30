"use client";

import AccountsSidebar from "../components/layout/Sidebar";
import TechnicalPayrollPageContent from "../components/technicalPayroll/TechnicalPayrollPageContent";

export default function TechnicalTeamPayrollPage() {
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <AccountsSidebar />
      <main className="pt-[76px] pb-10">
        <TechnicalPayrollPageContent />
      </main>
    </div>
  );
}
