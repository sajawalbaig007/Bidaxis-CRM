"use client";

import { useEffect, useState } from "react";
import { visibleInterval } from "@/lib/visibleInterval";
import DashboardNavbar  from "./components/layout/Navbar";
import DashboardSidebar from "./components/layout/Sidebar";
import PerformanceChart, { type ClientLead } from "./components/charts/PerformanceChart";
import OverviewChart    from "./components/charts/OverviewChart";
import RecentActivity   from "./components/widgets/RecentActivity";
import TopPerformers    from "./components/widgets/TopPerformer";
import API from "@/lib/api";
import {
  Users, PhoneCall, CheckCircle2, Clock3, Star,
  TrendingUp, Briefcase, Trophy,
} from "lucide-react";

const REFRESH_INTERVAL = 30_000;

type QuickStats = {
  totalLeads:  number;
  completed:   number;
  pending:     number;
  important:   number;
  interested:  number;
  projectWon:  number;
  onlineCSRs:  number;
  totalOnline: number;
};

export default function DashboardPage() {
  const [selectedRange,  setSelectedRange]  = useState("week");
  const [stats,          setStats]          = useState<QuickStats | null>(null);
  const [loadingStats,   setLoadingStats]   = useState(true);
  const [clientLeads,    setClientLeads]    = useState<ClientLead[]>([]);

  useEffect(() => {
    const fetchQuick = async () => {
      try {
        const [rep, usrs, cls] = await Promise.all([
          API.get("/reports?period=today"),
          API.get("/users"),
          API.get("/admin/clients"),
        ]);
        const d        = rep.data;
        const usersArr = Array.isArray(usrs.data) ? usrs.data : [];
        setStats({
          totalLeads:  d.totalLeads  ?? 0,
          completed:   d.completed   ?? 0,
          pending:     d.pending     ?? 0,
          important:   d.important   ?? 0,
          interested:  d.interested  ?? 0,
          projectWon:  d.projectWon  ?? 0,
          onlineCSRs:  usersArr.filter((u: { role?: string; isOnline?: boolean }) => u.role === "csr" && u.isOnline).length,
          totalOnline: usersArr.filter((u: { isOnline?: boolean }) => u.isOnline).length,
        });
        setClientLeads(cls.data.leads ?? []);
      } catch (err) {
        if (process.env.NODE_ENV === "development") console.error("[AdminDash]", err);
      }
      finally { setLoadingStats(false); }
    };
    void fetchQuick();
    return visibleInterval(() => void fetchQuick(), REFRESH_INTERVAL);
  }, []);

  const tiles = [
    { label: "Total Leads",  value: stats?.totalLeads  ?? 0, from: "from-[#B8112D]", to: "to-[#8b0d22]",  icon: <PhoneCall    size={15}/>, bar: "70%" },
    { label: "Completed",    value: stats?.completed   ?? 0, from: "from-[#059669]", to: "to-[#047857]",  icon: <CheckCircle2 size={15}/>, bar: "85%" },
    { label: "Pending",      value: stats?.pending     ?? 0, from: "from-[#D97706]", to: "to-[#B45309]",  icon: <Clock3       size={15}/>, bar: "50%" },
    { label: "Important",    value: stats?.important   ?? 0, from: "from-[#DC2626]", to: "to-[#B91C1C]",  icon: <Star         size={15}/>, bar: "40%" },
    { label: "Interested",   value: stats?.interested  ?? 0, from: "from-[#2563EB]", to: "to-[#1D4ED8]",  icon: <TrendingUp   size={15}/>, bar: "60%" },
    { label: "Close Client", value: stats?.projectWon  ?? 0, from: "from-[#7C3AED]", to: "to-[#6D28D9]",  icon: <Trophy       size={15}/>, bar: "30%" },
    { label: "Online CSRs",  value: stats?.onlineCSRs  ?? 0, from: "from-[#0891B2]", to: "to-[#0E7490]",  icon: <Briefcase    size={15}/>, bar: "55%" },
    { label: "Users Online", value: stats?.totalOnline ?? 0, from: "from-[#4F46E5]", to: "to-[#4338CA]",  icon: <Users        size={15}/>, bar: "65%" },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <DashboardSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        <div className="space-y-4 sm:space-y-5">

          {/* ── COLORFUL METRIC TILES ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 sm:gap-3">
            {tiles.map(tile => (
              <div
                key={tile.label}
                className={`bg-gradient-to-br ${tile.from} ${tile.to} rounded-2xl p-3 sm:p-4 text-white shadow-lg flex flex-col gap-2.5`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest leading-tight">
                    {tile.label}
                  </span>
                  <span className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    {tile.icon}
                  </span>
                </div>
                {loadingStats ? (
                  <div className="h-8 w-14 bg-white/25 rounded-xl animate-pulse" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">
                    {tile.value.toLocaleString()}
                  </span>
                )}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 rounded-full" style={{ width: tile.bar }} />
                </div>
              </div>
            ))}
          </div>

          {/* ── MAIN GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5">

            {/* LEFT — 8 cols */}
            <div className="lg:col-span-8 space-y-3 sm:space-y-4">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-3 sm:mb-5">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">Performance Overview</h3>
                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Track CSR performance and activity trends</p>
                  </div>
                  <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
                </div>
                <PerformanceChart
                  leads={clientLeads}
                  range={selectedRange}
                />
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <RecentActivity leads={clientLeads} />
              </div>
            </div>

            {/* RIGHT — 4 cols */}
            <div className="lg:col-span-4 space-y-3 sm:space-y-4">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <OverviewChart leads={clientLeads} />
              </div>
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <TopPerformers leads={clientLeads} />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

/* ── DATE RANGE PICKER ── */
const DateRangePicker = ({ selected, onChange }: { selected: string; onChange: (r: string) => void }) => (
  <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 shrink-0">
    {["Today", "Week", "Month", "Year"].map(r => (
      <button
        key={r}
        onClick={() => onChange(r.toLowerCase())}
        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
          selected === r.toLowerCase()
            ? "bg-[#B8112D] text-white shadow-sm"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {r}
      </button>
    ))}
  </div>
);
