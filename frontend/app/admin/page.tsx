"use client";

import { useState } from "react";
import DashboardNavbar from "./components/Navbar";
import DashboardSidebar from "./components/Sidebar";
import StatsCards from "./components/StatsCards";
import PerformanceChart from "./components/PerformanceChart";
import OverviewChart from "./components/OverviewChart";
import AnnouncementBanner from "./components/Announcement";
import QuickActions from "./components/Quickactions";
import RecentActivity from "./components/Recentactivity";
import TopPerformers from "./components/TopPerformer";
import SystemHealth from "./components/Systemhealth";
import WelcomeHeader from "./components/Welcome";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <DashboardSidebar />

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden lg:ml-0 mt-[72px] lg:mt-0">
        <DashboardNavbar />

        <div className="space-y-5">
          <WelcomeHeader />

          <AnnouncementBanner />

          <StatsCards />

          <QuickActions />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      Performance Overview
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Track CSR performance and activity trends
                    </p>
                  </div>

                  <DateRangePicker />
                </div>

                <PerformanceChart />
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <RecentActivity />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <OverviewChart />
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <TopPerformers />
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <SystemHealth />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const DateRangePicker = () => {
  const [selectedRange, setSelectedRange] = useState("week");

  return (
    <div className="flex flex-wrap gap-2">
      {["Today", "Week", "Month", "Year"].map((range) => {
        const isActive = selectedRange === range.toLowerCase();

        return (
          <button
            key={range}
            onClick={() => setSelectedRange(range.toLowerCase())}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              isActive
                ? "bg-[#B8112D] text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
};