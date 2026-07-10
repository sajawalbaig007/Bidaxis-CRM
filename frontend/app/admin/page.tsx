"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useStaffSidebar } from "@/app/hooks/useStaffSidebar";
import { useStaffBase } from "@/app/hooks/useStaffBase";
import RecentActivity   from "./components/widgets/RecentActivity";
import TopPerformers    from "./components/widgets/TopPerformer";
import ActiveProjectsWidget from "./components/widgets/ActiveProjectsWidget";
import { getAdminSummary, peekAdminSummary, subscribeAdminSummaryStale, type AdminDashboardSummary } from "@/lib/adminSummaryCache";
import {
  Users, PhoneCall, CheckCircle2, Clock3, Star,
  TrendingUp, Briefcase, Trophy, RefreshCw, FolderKanban,
} from "lucide-react";

const PerformanceChart = dynamic(() => import("./components/charts/PerformanceChart"), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-xl bg-gray-100 animate-pulse" />,
});

const OverviewChart = dynamic(() => import("./components/charts/OverviewChart"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-xl bg-gray-100 animate-pulse" />,
});

type QuickStats = {
  totalLeads:  number;
  completed:   number;
  closed:      number;
  pending:     number;
  important:   number;
  importantOnly?: number;
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
    importantOnly: s.stats?.importantOnly ?? s.stats?.important ?? 0,
    interested:  s.stats?.interested  ?? 0,
    projectWon:  s.stats?.projectWon  ?? 0,
    onlineCSRs:  s.stats?.onlineCSRs  ?? 0,
    totalOnline: s.stats?.totalOnline ?? 0,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const StaffSidebar = useStaffSidebar();
  const staffBase = useStaffBase();
  const [selectedRange, setSelectedRange] = useState("week");
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [projectsEnabled, setProjectsEnabled] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const loadOverview = useCallback(async (force = false) => {
    setLoadingOverview(true);
    try {
      const s = await getAdminSummary(force);
      setSummary(s);
      setStats(statsFromSummary(s));
      setOverviewLoaded(true);
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("[AdminDash]", err);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    const cached = peekAdminSummary();
    if (cached) {
      setSummary(cached);
      setStats(statsFromSummary(cached));
      setOverviewLoaded(true);
    } else {
      void loadOverview(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    return subscribeAdminSummaryStale(() => {
      void loadOverview(true);
    });
  }, [loadOverview]);

  const chartSeries = useMemo(() => {
    const s = summary?.chartSeries;
    if (!s) return undefined;
    const key = selectedRange as keyof NonNullable<typeof s>;
    return s[key];
  }, [summary?.chartSeries, selectedRange]);

  const tiles = useMemo(() => [
    { label: "Total Leads",  value: stats?.totalLeads  ?? 0, from: "from-[#B8112D]", to: "to-[#8b0d22]",  icon: <PhoneCall    size={15}/>, bar: "70%", href: `${staffBase}/leads` },
    { label: "Completed",    value: stats?.closed ?? stats?.completed ?? 0, from: "from-[#059669]", to: "to-[#047857]",  icon: <CheckCircle2 size={15}/>, bar: "85%", href: `${staffBase}/leads?tab=closed` },
    { label: "Pending",      value: stats?.pending     ?? 0, from: "from-[#D97706]", to: "to-[#B45309]",  icon: <Clock3       size={15}/>, bar: "50%", href: `${staffBase}/leads` },
    { label: "Important",    value: stats?.importantOnly ?? stats?.important ?? 0, from: "from-[#DC2626]", to: "to-[#B91C1C]",  icon: <Star         size={15}/>, bar: "40%", href: `${staffBase}/leads?tab=important` },
    { label: "Interested",   value: stats?.interested  ?? 0, from: "from-[#2563EB]", to: "to-[#1D4ED8]",  icon: <TrendingUp   size={15}/>, bar: "60%", href: `${staffBase}/leads?tab=interested` },
    { label: "Close Client", value: stats?.projectWon  ?? 0, from: "from-[#7C3AED]", to: "to-[#6D28D9]",  icon: <Trophy       size={15}/>, bar: "30%", href: `${staffBase}/leads?tab=closed` },
    { label: "Online CSRs",  value: stats?.onlineCSRs  ?? 0, from: "from-[#0891B2]", to: "to-[#0E7490]",  icon: <Briefcase    size={15}/>, bar: "55%" },
    { label: "Users Online", value: stats?.totalOnline ?? 0, from: "from-[#4F46E5]", to: "to-[#4338CA]",  icon: <Users        size={15}/>, bar: "65%" },
  ], [stats, staffBase]);

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <StaffSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 overflow-x-hidden mt-[64px]">
        <div className="space-y-4 sm:space-y-5">

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void loadOverview(true)}
              disabled={loadingOverview}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF6F7] disabled:opacity-60 shadow-sm shrink-0"
            >
              <RefreshCw size={15} className={loadingOverview ? "animate-spin" : ""} />
              {loadingOverview ? "Refreshing…" : "Refresh stats"}
            </button>
          </div>

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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-5 items-start">

            <div className="lg:col-span-8 space-y-3 sm:space-y-4">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 mb-3 sm:mb-5">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">Performance Overview</h3>
                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                      CSR call activity · business day resets 4:00 AM (PKT)
                    </p>
                  </div>
                  {(overviewLoaded || loadingOverview) && (
                    <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
                  )}
                </div>
                {overviewLoaded || loadingOverview ? (
                  <PerformanceChart series={chartSeries} range={selectedRange} />
                ) : (
                  <div className="h-[260px] rounded-xl bg-gray-100 animate-pulse" />
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
            </div>

            <div className="lg:col-span-4">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 h-full">
                {overviewLoaded || loadingOverview ? (
                  <OverviewChart distribution={summary?.distribution} />
                ) : (
                  <div className="h-[220px] rounded-xl bg-gray-100 animate-pulse" />
                )}
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                {overviewLoaded || loadingOverview ? (
                  <RecentActivity recent={summary?.recent} recentStatus={summary?.recentStatus} />
                ) : (
                  <div className="h-[260px] rounded-xl bg-gray-100 animate-pulse" />
                )}
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="bg-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100">
                {overviewLoaded || loadingOverview ? (
                  <TopPerformers performers={summary?.performers} />
                ) : (
                  <div className="h-[260px] rounded-xl bg-gray-100 animate-pulse" />
                )}
              </div>
            </div>
          </div>

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
    {["Today (4AM+)", "Week", "Month", "Year"].map(r => (
      <button
        key={r}
        onClick={() => onChange(r.toLowerCase().replace(" (4am+)", ""))}
        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
          (r.startsWith("Today") ? selected === "today" : selected === r.toLowerCase())
            ? "bg-[#B8112D] text-white shadow-sm"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {r}
      </button>
    ))}
  </div>
);
