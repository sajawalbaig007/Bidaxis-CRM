"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNavbar  from "./components/layout/Navbar";
import DashboardSidebar from "./components/layout/Sidebar";
import PerformanceChart, { type ClientLead } from "./components/charts/PerformanceChart";
import OverviewChart    from "./components/charts/OverviewChart";
import RecentActivity   from "./components/widgets/RecentActivity";
import TopPerformers    from "./components/widgets/TopPerformer";
import ActiveProjectsWidget from "./components/widgets/ActiveProjectsWidget";
import { getAdminSummary, type AdminDashboardSummary } from "@/lib/adminSummaryCache";
import {
  Users, PhoneCall, CheckCircle2, Clock3, Star,
  TrendingUp, Briefcase, Trophy, RefreshCw, BarChart3, FolderKanban,
} from "lucide-react";

type QuickStats = {
  totalLeads:  number;
  completed:   number;
  closed:      number;
  pending:     number;
  important:   number;
  interested:  number;
  projectWon:  number;
  onlineCSRs:  number;
  totalOnline: number;
};

function statsFromSummary(s: AdminDashboardSummary): QuickStats {
  return {
    totalLeads:  s.stats?.totalLeads  ?? 0,
    completed:   s.stats?.completed   ?? 0,
    closed:      s.stats?.closed      ?? 0,
    pending:     s.stats?.pending     ?? 0,
    important:   s.stats?.important   ?? 0,
    interested:  s.stats?.interested  ?? 0,
    projectWon:  s.stats?.projectWon  ?? 0,
    onlineCSRs:  s.stats?.onlineCSRs  ?? 0,
    totalOnline: s.stats?.totalOnline ?? 0,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [selectedRange, setSelectedRange] = useState("week");
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [projectsEnabled, setProjectsEnabled] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const loadOverview = async () => {
    setLoadingOverview(true);
    try {
      const s = await getAdminSummary();
      setSummary(s);
      setStats(statsFromSummary(s));
      setOverviewLoaded(true);
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("[AdminDash]", err);
    } finally {
      setLoadingOverview(false);
    }
  };

  const chartLeads: ClientLead[] = (summary?.chartLeads ?? []).map(c => ({ createdAt: c.createdAt }));

  const tiles = [
    { label: "Total Leads",  value: stats?.totalLeads  ?? 0, from: "from-[#B8112D]", to: "to-[#8b0d22]",  icon: <PhoneCall    size={15}/>, bar: "70%", href: "/admin/leads" },
    { label: "Completed",    value: stats?.closed ?? stats?.completed ?? 0, from: "from-[#059669]", to: "to-[#047857]",  icon: <CheckCircle2 size={15}/>, bar: "85%", href: "/admin/leads?tab=closed" },
    { label: "Pending",      value: stats?.pending     ?? 0, from: "from-[#D97706]", to: "to-[#B45309]",  icon: <Clock3       size={15}/>, bar: "50%", href: "/admin/leads" },
    { label: "Important",    value: stats?.important   ?? 0, from: "from-[#DC2626]", to: "to-[#B91C1C]",  icon: <Star         size={15}/>, bar: "40%", href: "/admin/leads?tab=important" },
    { label: "Interested",   value: stats?.interested  ?? 0, from: "from-[#2563EB]", to: "to-[#1D4ED8]",  icon: <TrendingUp   size={15}/>, bar: "60%", href: "/admin/leads?tab=interested" },
    { label: "Close Client", value: stats?.projectWon  ?? 0, from: "from-[#7C3AED]", to: "to-[#6D28D9]",  icon: <Trophy       size={15}/>, bar: "30%", href: "/admin/leads?tab=closed" },
    { label: "Online CSRs",  value: stats?.onlineCSRs  ?? 0, from: "from-[#0891B2]", to: "to-[#0E7490]",  icon: <Briefcase    size={15}/>, bar: "55%" },
    { label: "Users Online", value: stats?.totalOnline ?? 0, from: "from-[#4F46E5]", to: "to-[#4338CA]",  icon: <Users        size={15}/>, bar: "65%" },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <DashboardSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        <div className="space-y-4 sm:space-y-5">

          {!overviewLoaded && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">Dashboard ready</h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  Stats and charts load only when you click — page opens instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadOverview()}
                disabled={loadingOverview}
                className="h-10 sm:h-11 px-5 rounded-xl bg-[#B8112D] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#a30f27] disabled:opacity-60 shrink-0"
              >
                {loadingOverview
                  ? <><RefreshCw size={15} className="animate-spin" /> Loading…</>
                  : <><BarChart3 size={15} /> Load stats &amp; charts</>}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 sm:gap-3">
            {tiles.map(tile => {
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest leading-tight">
                      {tile.label}
                    </span>
                    <span className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                      {tile.icon}
                    </span>
                  </div>
                  {loadingOverview ? (
                    <div className="h-8 w-14 bg-white/25 rounded-xl animate-pulse" />
                  ) : (
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">
                      {overviewLoaded ? tile.value.toLocaleString() : "—"}
                    </span>
                  )}
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white/60 rounded-full" style={{ width: tile.bar }} />
                  </div>
                </>
              );
              return tile.href ? (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => router.push(tile.href!)}
                  className={`bg-gradient-to-br ${tile.from} ${tile.to} rounded-2xl p-3 sm:p-4 text-white shadow-lg flex flex-col gap-2.5 text-left hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer`}
                >
                  {inner}
                </button>
              ) : (
                <div
                  key={tile.label}
                  className={`bg-gradient-to-br ${tile.from} ${tile.to} rounded-2xl p-3 sm:p-4 text-white shadow-lg flex flex-col gap-2.5`}
                >
                  {inner}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5">

            <div className="lg:col-span-8 space-y-3 sm:space-y-4">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-3 sm:mb-5">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">Performance Overview</h3>
                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Track CSR performance and activity trends</p>
                  </div>
                  {overviewLoaded && (
                    <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
                  )}
                </div>
                {overviewLoaded ? (
                  <PerformanceChart leads={chartLeads} range={selectedRange} />
                ) : (
                  <LazySectionPrompt
                    icon={<BarChart3 size={28} className="text-gray-300" />}
                    label="Load stats & charts to view performance"
                    onLoad={() => void loadOverview()}
                    loading={loadingOverview}
                  />
                )}
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                {projectsEnabled ? (
                  <ActiveProjectsWidget enabled />
                ) : (
                  <LazySectionPrompt
                    icon={<FolderKanban size={28} className="text-gray-300" />}
                    label="Click to load Project DB preview"
                    onLoad={() => setProjectsEnabled(true)}
                  />
                )}
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                {overviewLoaded ? (
                  <RecentActivity recent={summary?.recent} />
                ) : (
                  <LazySectionPrompt
                    icon={<RefreshCw size={28} className="text-gray-300" />}
                    label="Load stats to see recent activity"
                    onLoad={() => void loadOverview()}
                    loading={loadingOverview}
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-3 sm:space-y-4">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                {overviewLoaded ? (
                  <OverviewChart distribution={summary?.distribution} />
                ) : (
                  <LazySectionPrompt
                    icon={<BarChart3 size={28} className="text-gray-300" />}
                    label="Load stats for status overview"
                    onLoad={() => void loadOverview()}
                    loading={loadingOverview}
                    compact
                  />
                )}
              </div>
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                {overviewLoaded ? (
                  <TopPerformers performers={summary?.performers} />
                ) : (
                  <LazySectionPrompt
                    icon={<Trophy size={28} className="text-gray-300" />}
                    label="Load stats for top performers"
                    onLoad={() => void loadOverview()}
                    loading={loadingOverview}
                    compact
                  />
                )}
              </div>
            </div>
          </div>

          {overviewLoaded && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void loadOverview()}
                disabled={loadingOverview}
                className="text-xs text-gray-400 hover:text-[#B8112D] flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={loadingOverview ? "animate-spin" : ""} />
                Refresh stats
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function LazySectionPrompt({
  icon,
  label,
  onLoad,
  loading = false,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  onLoad: () => void;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onLoad}
      disabled={loading}
      className={`w-full flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-gray-200 hover:border-[#B8112D]/40 hover:bg-[#FFF6F7] transition-colors disabled:opacity-60 ${
        compact ? "py-10" : "py-14 sm:py-16"
      }`}
    >
      {icon}
      <p className="text-sm text-gray-500 mt-3 font-medium">{loading ? "Loading…" : label}</p>
    </button>
  );
}

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
