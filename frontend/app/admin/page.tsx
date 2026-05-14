"use client";

import { useState } from "react";
import DashboardNavbar from "./components/Navbar";
import DashboardSidebar from "./components/Sidebar";
import StatsCards from "./components/StatsCards";
import PerformanceChart from "./components/PerformanceChart";
import OverviewChart from "./components/OverviewChart";
import AnnouncementBanner from "./Announcementbanner/page";
import QuickActions from "./quickactions/page";
import RecentActivity from "./recentactivity/page";
import TopPerformers from "./topperformer/page";
import PendingTasks from "./pendingtasks/page";
import SystemHealth from "./systemhealth/page";
import WelcomeHeader from "./welcomeheader/page";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      {/* SIDEBAR */}
      <DashboardSidebar />

      {/* MAIN */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden lg:ml-0 mt-[72px] lg:mt-0">
        {/* NAVBAR */}
        <DashboardNavbar />
        
        {/* Welcome Header */}
        <WelcomeHeader />
        
        {/* Announcement Banner */}
        <AnnouncementBanner />
        
        {/* Stats Cards */}
        <StatsCards />
        
        {/* Quick Actions */}
        <QuickActions />
        
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
          
          {/* Left Column - Charts & Activity */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Performance Overview</h3>
                <DateRangePicker />
              </div>
              <PerformanceChart />
            </div>
            
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <RecentActivity />
            </div>
          </div>
          
          {/* Right Column - Sidebar Widgets */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <OverviewChart />
            </div>
            <TopPerformers />
            <PendingTasks />
            <SystemHealth />
          </div>
          
        </div>
      </main>
    </div>
  );
}

// Date Range Picker Component
const DateRangePicker = () => {
  const [selectedRange, setSelectedRange] = useState("week");
  
  return (
    <div className="flex gap-2">
      {["Today", "Week", "Month", "Year"].map(range => (
        <button
          key={range}
          onClick={() => setSelectedRange(range.toLowerCase())}
          className={`px-3 py-1 rounded-lg text-xs sm:text-sm transition-all ${
            selectedRange === range.toLowerCase()
              ? "bg-[#B8112D] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
};