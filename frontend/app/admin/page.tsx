"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useStaffSidebar } from "@/app/hooks/useStaffSidebar";
import { useStaffBase } from "@/app/hooks/useStaffBase";
import RecentActivity   from "./components/widgets/RecentActivity";
import TopPerformers    from "./components/widgets/TopPerformer";
import ActiveProjectsWidget from "./components/widgets/ActiveProjectsWidget";
import { getAdminSummary, peekAdminSummary, type AdminDashboardSummary } from "@/lib/adminSummaryCache";
import {
  Users, PhoneCall, CheckCircle2, Clock3, Star,
  TrendingUp, Briefcase, Trophy, RefreshCw, FolderKanban,
} from "lucide-react";

const PerformanceChart = dynamic(() => import("./components/charts/PerformanceChart"), {
  ssr: false,
  loading: () => <div className="h-[240px] rounded-xl bg-gray-100 animate-pulse" />,
});

const OverviewChart = dynamic(() => import("./components/charts/OverviewChart"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-xl bg-gray-100 animate-pulse" />,
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

const CARD = "bg-white rounded-2xl p-4 shadow-sm border border-gray-100";

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

  const chartSeries = useMemo(() => {
    const s = summary?.chartSeries;
    if (!s) return undefined;
    const key = selectedRange as keyof NonNullable<typeof s>;
    return s[key];
  }, [summary?.chartSeries, selectedRange]);

  const tiles = useMemo(() => [
    { label: "Total Leads",  value: stats?.totalLeads  ?? 0, from: "from-[#B8112D]", to: "to-[#8b0d22]",  icon: <PhoneCall    size={14}/>, href: `${staffBase}/leads` },
    { label: "Completed",    value: stats?.closed ?? stats?.completed ?? 0, from: "from-[#059669]", to: "to-[#047857]",  icon: <CheckCircle2 size={14}/>, href: `${staffBase}/leads?tab=closed` },
    { label: "Pending",      value: stats?.pending     ?? 0, from: "from-[#D97706]", to: "to-[#B45309]",  icon: <Clock3       size={14}/>, href: `${staffBase}/leads` },
    { label: "Important",    value: stats?.importantOnly ?? stats?.important ?? 0, from: "from-[#DC2626]", to: "to-[#B91C1C]",  icon: <Star         size={14}/>, href: `${staffBase}/leads?tab=important` },
    { label: "Interested",   value: stats?.interested  ?? 0, from: "from-[#2563EB]", to: "to-[#1D4ED8]",  icon: <TrendingUp   size={14}/>, href: `${staffBase}/leads?tab=interested` },
    { label: "Close Client", value: stats?.projectWon  ?? 0, from: "from-[#7C3AED]", to: "to-[#6D28D9]",  icon: <Trophy       size={14}/>, href: `${staffBase}/leads?tab=closed` },
    { label: "Online CSRs",  value: stats?.onlineCSRs  ?? 0, from: "from-[#0891B2]", to: "to-[#0E7490]",  icon: <Briefcase    size={14}/> },
    { label: "Users Online", value: stats?.totalOnline ?? 0, from: "from-[#4F46E5]", to: "to-[#4338CA]",  icon: <Users        size={14}/> },
  ], [stats, staffBase]);

  const dataReady = overviewLoaded || loadingOverview;

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <StaffSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-5 overflow-x-hidden mt-[64px]">
        <div className="max-w-[1600px] mx-auto space-y-4">

          {/* Header + refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Dashboard Overview</h1>
              <p className="text-xs text-gray-500 mt-0.5">Live metrics · business day resets 4:00 AM PKT</p>
            </div>
            <button
              type="button"
              onClick={() => void loadOverview(true)}
              disabled={loadingOverview}
              className="h-9 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 flex items-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF6F7] disabled:opacity-60 shadow-sm shrink-0"
            >
              <RefreshCw size={14} className={loadingOverview ? "animate-spin" : ""} />
              {loadingOverview ? "Refreshing…" : "Refresh stats"}
            </button>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-2.5">
            {tiles.map(tile => {
              const inner = (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-white/75 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide leading-tight truncate">
                      {tile.label}
                    </span>
                    <span className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                      {tile.icon}
                    </span>
                  </div>
                  {loadingOverview ? (
                    <div className="h-7 w-12 bg-white/25 rounded-lg animate-pulse" />
                  ) : (
                    <span className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none">
                      {overviewLoaded ? tile.value.toLocaleString() : "—"}
                    </span>
                  )}
                </>
              );
              const cls = `bg-gradient-to-br ${tile.from} ${tile.to} rounded-xl p-2.5 sm:p-3 text-white shadow-md flex flex-col gap-1.5 min-h-[72px]`;
              return tile.href ? (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => router.push(tile.href!)}
                  className={`${cls} text-left hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer`}
                >
                  {inner}
                </button>
              ) : (
                <div key={tile.label} className={cls}>{inner}</div>
              );
            })}
          </div>

          {/* Row 1: Performance + Lead Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className={`lg:col-span-7 ${CARD} flex flex-col`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Performance Overview</h3>
                  <p className="text-xs text-gray-400">CSR call activity</p>
                </div>
                {dataReady && (
                  <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
                )}
              </div>
              {dataReady ? (
                <PerformanceChart series={chartSeries} range={selectedRange} />
              ) : (
                <div className="h-[240px] rounded-xl bg-gray-100 animate-pulse flex-1" />
              )}
            </div>

            <div className={`lg:col-span-5 ${CARD} flex flex-col min-h-0`}>
              {dataReady ? (
                <OverviewChart distribution={summary?.distribution} />
              ) : (
                <div className="h-[200px] rounded-xl bg-gray-100 animate-pulse flex-1" />
              )}
            </div>
          </div>

          {/* Row 2: Recent Activity + Top Performers + Project DB */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className={`lg:col-span-5 ${CARD}`}>
              {dataReady ? (
                <RecentActivity recent={summary?.recent} recentStatus={summary?.recentStatus} />
              ) : (
                <div className="h-[220px] rounded-xl bg-gray-100 animate-pulse" />
              )}
            </div>

            <div className={`lg:col-span-3 ${CARD}`}>
              {dataReady ? (
                <TopPerformers performers={summary?.performers} />
              ) : (
                <div className="h-[220px] rounded-xl bg-gray-100 animate-pulse" />
              )}
            </div>

            <div className={`lg:col-span-4 ${CARD} flex flex-col`}>
              {projectsEnabled ? (
                <ActiveProjectsWidget enabled />
              ) : (
                <LazySectionPrompt
                  icon={<FolderKanban size={22} className="text-gray-300" />}
                  label="Load Project DB preview"
                  onLoad={() => setProjectsEnabled(true)}
                />
              )}
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
}: {
  icon: React.ReactNode;
  label: string;
  onLoad: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onLoad}
      disabled={loading}
      className="flex-1 w-full flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-gray-200 hover:border-[#B8112D]/40 hover:bg-[#FFF6F7] transition-colors disabled:opacity-60 min-h-[220px] py-8"
    >
      {icon}
      <p className="text-sm text-gray-500 mt-2 font-medium">{loading ? "Loading…" : label}</p>
      <p className="text-xs text-gray-400 mt-1">Click to fetch active projects</p>
    </button>
  );
}

const DateRangePicker = ({ selected, onChange }: { selected: string; onChange: (r: string) => void }) => (
  <div className="flex gap-1 flex-wrap">
    {["Today (4AM+)", "Week", "Month", "Year"].map(r => (
      <button
        key={r}
        onClick={() => onChange(r.toLowerCase().replace(" (4am+)", ""))}
        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
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
