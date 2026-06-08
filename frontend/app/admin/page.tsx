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

/* ── How often to auto-refresh (ms) ── */
const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function DashboardPage() {
  const [selectedRange,   setSelectedRange]   = useState("week");
  const [refreshTrigger,  setRefreshTrigger]  = useState(0);   // increments → child components re-fetch
  const [lastUpdated,     setLastUpdated]     = useState<Date>(new Date());
  const [countdown,       setCountdown]       = useState(REFRESH_INTERVAL / 1000);
  const [isRefreshing,    setIsRefreshing]    = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Reset and start countdown ── */
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

  /* ── Auto-refresh every REFRESH_INTERVAL ── */
  useEffect(() => {
    resetCountdown();
    const autoRefresh = setInterval(() => {
      setRefreshTrigger(t => t + 1);
      setLastUpdated(new Date());
      resetCountdown();
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(autoRefresh);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetCountdown]);

  /* ── Manual refresh ── */
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(t => t + 1);
    setLastUpdated(new Date());
    resetCountdown();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  /* ── Format last updated time ── */
  const formattedTime = lastUpdated.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <DashboardSidebar />

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden lg:ml-0 mt-[72px] lg:mt-0">
        <DashboardNavbar />

        <div className="space-y-5">
          <WelcomeHeader />

          {/* ── LIVE STATUS BAR ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              {/* pulsing live dot */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"/>
              </span>
              <span className="text-sm font-semibold text-green-700">Live</span>
              <span className="text-sm text-gray-400">
                Last updated: <span className="font-medium text-gray-600">{formattedTime}</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* countdown ring */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="#E5E7EB" strokeWidth="2"/>
                  <circle
                    cx="10" cy="10" r="8" fill="none"
                    stroke="#B8112D" strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 8}`}
                    strokeDashoffset={`${2 * Math.PI * 8 * (1 - countdown / (REFRESH_INTERVAL / 1000))}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span>Refreshing in <span className="font-semibold text-gray-600">{countdown}s</span></span>
              </div>

              {/* manual refresh */}
              <button
                onClick={handleManualRefresh}
                className="flex items-center gap-2 h-8 px-3 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-xs font-semibold hover:bg-[#fce8ec] transition-colors"
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""}/>
                Refresh
              </button>
            </div>
          </div>

          <AnnouncementBanner />

          {/* Pass refreshTrigger as key → component remounts and re-fetches */}
          <StatsCards key={`stats-${refreshTrigger}`} refreshTrigger={refreshTrigger}/>

          <QuickActions />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
                  <div>
                    <h3 className="font-semibold text-gray-800">Performance Overview</h3>
                    <p className="text-sm text-gray-400 mt-1">Track CSR performance and activity trends</p>
                  </div>
                  <DateRangePicker
                    selected={selectedRange}
                    onChange={setSelectedRange}
                  />
                </div>

                <PerformanceChart
                  key={`perf-${refreshTrigger}-${selectedRange}`}
                  range={selectedRange}
                  refreshTrigger={refreshTrigger}
                />
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <RecentActivity
                  key={`activity-${refreshTrigger}`}
                  refreshTrigger={refreshTrigger}
                />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-5">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <OverviewChart
                  key={`overview-${refreshTrigger}`}
                  refreshTrigger={refreshTrigger}
                />
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                <TopPerformers
                  key={`top-${refreshTrigger}`}
                  refreshTrigger={refreshTrigger}
                />
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
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
  <div className="flex flex-wrap gap-2">
    {["Today", "Week", "Month", "Year"].map(range => {
      const isActive = selected === range.toLowerCase();
      return (
        <button
          key={range}
          onClick={() => onChange(range.toLowerCase())}
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