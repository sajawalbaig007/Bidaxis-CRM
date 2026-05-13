

"use client";

import DashboardNavbar from "./components/Navbar";
import DashboardSidebar from "./components/Sidebar";
import StatsCards from "./components/StatsCards";
import PerformanceChart from "./components/PerformanceChart";
import OverviewChart from "./components/OverviewChart";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* SIDEBAR */}
      <DashboardSidebar />

      {/* MAIN */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden lg:ml-0 mt-[72px] lg:mt-0">

        {/* NAVBAR */}
        <DashboardNavbar />

        {/* TOP CARDS */}
        <StatsCards />

        {/* CHART SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-5">

          {/* LEFT */}
          <div className="xl:col-span-8 flex flex-col gap-5">

            <div className="min-h-[350px]">
              <PerformanceChart />
            </div>

          </div>

          {/* RIGHT */}
          <div className="xl:col-span-4 flex flex-col gap-5">

            <div className="min-h-[350px]">
              <OverviewChart />
            </div>

          </div>

        </div>

      </main>

    </div>
  );
}