"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DashboardNavbar    from "./components/Navbar";
import DashboardSidebar   from "./components/Sidebar";
import StatsCards         from "./components/StatsCards";
import PerformanceChart   from "./components/PerformanceChart";
import OverviewChart      from "./components/OverviewChart";
import AnnouncementBanner from "./components/Announcement";
import QuickActions       from "./components/Quickactions";
import RecentActivity     from "./components/Recentactivity";
import TopPerformers      from "./components/TopPerformer";
import SystemHealth       from "./components/Systemhealth";
import WelcomeHeader      from "./components/Welcome";
import { RefreshCw } from "lucide-react";

const REFRESH_INTERVAL = 30_000;

export default function DashboardPage() {
  const [selectedRange,  setSelectedRange]  = useState("week");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null);
  const [countdown,      setCountdown]      = useState(REFRESH_INTERVAL / 1000);
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetCountdown = useCallback(() => {
    setCountdown(REFRESH_INTERVAL / 1000);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return REFRESH_INTERVAL / 1000;
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setLastUpdated(new Date());
      resetCountdown();
    }, 0);

    const autoRefresh = setInterval(() => {
      setRefreshTrigger(t => t + 1);
      setLastUpdated(new Date());
      resetCountdown();
    }, REFRESH_INTERVAL);

    return () => {
      clearTimeout(initTimer);
      clearInterval(autoRefresh);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetCountdown]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(t => t + 1);
    setLastUpdated(new Date());
    resetCountdown();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <DashboardSidebar />

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar />

        <div className="space-y-3 sm:space-y-4 lg:space-y-5">

          {/* Welcome header */}
          <WelcomeHeader />

          {/* ── LIVE STATUS BAR ── */}
          {/* Stacks on mobile, single row on sm+ */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 bg-white rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 shadow-sm border border-gray-100">

            {/* Left: Live indicator + last updated */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-green-500" />
              </span>
              <span className="text-xs sm:text-sm font-semibold text-green-700">Live</span>
              <span className="text-xs sm:text-sm text-gray-400">
                Last updated:{" "}
                <span className="font-medium text-gray-600">{formattedTime}</span>
              </span>
            </div>

            {/* Right: countdown ring + refresh button */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-400">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 -rotate-90" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="#E5E7EB" strokeWidth="2" />
                  <circle
                    cx="10" cy="10" r="8" fill="none"
                    stroke="#B8112D" strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 8}`}
                    strokeDashoffset={`${2 * Math.PI * 8 * (1 - countdown / (REFRESH_INTERVAL / 1000))}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span>
                  Refreshing in{" "}
                  <span className="font-semibold text-gray-600">{countdown}s</span>
                </span>
              </div>

              <button
                onClick={handleManualRefresh}
                className="flex items-center gap-1.5 sm:gap-2 h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg sm:rounded-xl bg-[#FFF1F3] text-[#B8112D] text-[10px] sm:text-xs font-semibold hover:bg-[#fce8ec] transition-colors"
              >
                <RefreshCw
                  size={11}
                  className={`sm:w-[13px] sm:h-[13px] ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* Announcement banner */}
          <AnnouncementBanner />

          {/* Stats cards */}
          <StatsCards key={`stats-${refreshTrigger}`} refreshTrigger={refreshTrigger} />

          {/* Quick actions */}
          <QuickActions />

          {/* ── MAIN GRID ──
              Mobile/tablet: stacked (1 col)
              lg+: Performance+Activity (8 cols) | Charts+Performers+Health (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5">

            {/* LEFT column — Performance + Recent Activity */}
            <div className="lg:col-span-8 space-y-3 sm:space-y-4 lg:space-y-5">

              {/* Performance chart card */}
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-3 sm:mb-5">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Performance Overview</h3>
                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                      Track CSR performance and activity trends
                    </p>
                  </div>
                  {/* Date range picker — wraps on very small screens */}
                  <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
                </div>

                <PerformanceChart
                  key={`perf-${refreshTrigger}-${selectedRange}`}
                  range={selectedRange}
                  refreshTrigger={refreshTrigger}
                />
              </div>

              {/* Recent Activity card */}
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <RecentActivity
                  key={`activity-${refreshTrigger}`}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            </div>

            {/* RIGHT column — Overview + Top Performers + System Health */}
            {/* On mobile: rendered after left column (natural stacking) */}
            {/* On lg+: 4-col right rail */}
            <div className="lg:col-span-4 space-y-3 sm:space-y-4 lg:space-y-5">

              {/* Overview donut/stat chart */}
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <OverviewChart
                  key={`overview-${refreshTrigger}`}
                  refreshTrigger={refreshTrigger}
                />
              </div>

              {/* Top Performers */}
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <TopPerformers
                  key={`top-${refreshTrigger}`}
                  refreshTrigger={refreshTrigger}
                />
              </div>

              {/* System Health */}
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <SystemHealth
                  key={`health-${refreshTrigger}`}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── DATE RANGE PICKER ── */
interface DateRangePickerProps {
  selected: string;
  onChange: (range: string) => void;
}

const DateRangePicker = ({ selected, onChange }: DateRangePickerProps) => (
  /* Horizontally scrollable on very small screens */
  <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 shrink-0">
    {["Today", "Week", "Month", "Year"].map(range => {
      const isActive = selected === range.toLowerCase();
      return (
        <button
          key={range}
          onClick={() => onChange(range.toLowerCase())}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs lg:text-sm font-medium transition-all whitespace-nowrap ${
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