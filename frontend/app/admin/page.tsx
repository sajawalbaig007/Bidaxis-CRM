"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { StaffSidebar } from "@/app/hooks/useStaffSidebar";
import { useStaffBase } from "@/app/hooks/useStaffBase";
import RecentActivity   from "./components/widgets/RecentActivity";
import TopPerformers    from "./components/widgets/TopPerformer";
import TopEstimatorsWidget from "./components/widgets/TopEstimatorsWidget";
import { getAdminSummary, peekAdminSummary, subscribeAdminSummaryStale, type AdminDashboardSummary } from "@/lib/adminSummaryCache";
import {
  Users, PhoneCall, CheckCircle2, Clock3, Star,
  TrendingUp, Trophy, RefreshCw,
} from "lucide-react";

const PerformanceChart = dynamic(() => import("./components/charts/PerformanceChart"), {
  ssr: false,
  loading: () => <div className="h-[180px] sm:h-[200px] rounded-2xl bg-gray-100 animate-pulse" />,
});

const OverviewChart = dynamic(() => import("./components/charts/OverviewChart"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-2xl bg-gray-100 animate-pulse" />,
});

type QuickStats = {
  totalLeads:  number;
  completed:   number;
  closed:      number;
  todayCompletedCalls: number;
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
    todayCompletedCalls: s.stats?.todayCompletedCalls ?? 0,
    pending:     s.stats?.pending     ?? 0,
    important:   s.stats?.important   ?? 0,
    importantOnly: s.stats?.importantOnly ?? s.stats?.important ?? 0,
    interested:  s.stats?.interested  ?? 0,
    projectWon:  s.stats?.projectWon  ?? 0,
    onlineCSRs:  s.stats?.onlineCSRs  ?? 0,
    totalOnline: s.stats?.totalOnline ?? 0,
  };
}

const BENTO =
  "rounded-[1.75rem] border border-gray-100/90 bg-white shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)]";

export default function DashboardPage() {
  const router = useRouter();
  const staffBase = useStaffBase();
  const [selectedRange, setSelectedRange] = useState("week");
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
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
    { label: "Total Leads",  value: stats?.totalLeads  ?? 0, from: "from-[#B8112D]", to: "to-[#8b0d22]",  icon: <PhoneCall    size={15}/>, bar: "70%" },
    { label: "Today Completed Calls", value: stats?.todayCompletedCalls ?? 0, from: "from-[#059669]", to: "to-[#047857]",  icon: <CheckCircle2 size={15}/>, bar: "85%" },
    { label: "Pending",      value: stats?.pending     ?? 0, from: "from-[#D97706]", to: "to-[#B45309]",  icon: <Clock3       size={15}/>, bar: "50%" },
    { label: "Total Completed", value: stats?.completed ?? 0, from: "from-[#DC2626]", to: "to-[#B91C1C]",  icon: <CheckCircle2 size={15}/>, bar: "40%" },
    { label: "Interested",   value: stats?.interested  ?? 0, from: "from-[#2563EB]", to: "to-[#1D4ED8]",  icon: <TrendingUp   size={15}/>, bar: "60%", href: `${staffBase}/leads?tab=interested` },
    { label: "Close Client", value: stats?.projectWon  ?? 0, from: "from-[#7C3AED]", to: "to-[#6D28D9]",  icon: <Trophy       size={15}/>, bar: "30%", href: `${staffBase}/leads?tab=closed` },
    { label: "Important",    value: stats?.importantOnly ?? stats?.important ?? 0, from: "from-[#0891B2]", to: "to-[#0E7490]",  icon: <Star         size={15}/>, bar: "55%", href: `${staffBase}/leads?tab=important` },
    { label: "Users Online", value: stats?.totalOnline ?? 0, from: "from-[#4F46E5]", to: "to-[#4338CA]",  icon: <Users        size={15}/>, bar: "65%" },
  ], [stats, staffBase]);

  return (
    <div className="flex min-h-screen bg-[#EEF1F7]">
      <StaffSidebar />

      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5">

          {/* Header */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#B8112D]/80 mb-1">Admin · Overview</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Pipeline overview · CSR activity · live presence
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadOverview(true)}
              disabled={loadingOverview}
              className="h-11 px-5 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF6F7] disabled:opacity-60 shadow-sm w-full sm:w-auto shrink-0"
            >
              <RefreshCw size={15} className={loadingOverview ? "animate-spin" : ""} />
              {loadingOverview ? "Refreshing…" : "Refresh stats"}
            </button>
          </header>

          {/* Stat tiles — even 4×2 */}
          <section aria-label="Quick stats" className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tiles.map((tile) => {
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-snug line-clamp-2">
                      {tile.label}
                    </span>
                    <span className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                      {tile.icon}
                    </span>
                  </div>
                  {loadingOverview ? (
                    <div className="h-8 w-14 bg-white/25 rounded-lg animate-pulse" />
                  ) : (
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none tabular-nums">
                      {overviewLoaded ? tile.value.toLocaleString() : "—"}
                    </span>
                  )}
                  <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-auto">
                    <div className="h-full bg-white/70 rounded-full" style={{ width: tile.bar }} />
                  </div>
                </>
              );
              const cls = `bg-gradient-to-br ${tile.from} ${tile.to} rounded-[1.5rem] p-3.5 sm:p-4 text-white shadow-md flex flex-col gap-2.5 min-h-[104px] sm:min-h-[112px] h-full`;
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
                <div key={tile.label} className={cls}>
                  {inner}
                </div>
              );
            })}
          </section>

          {/* Content bento — mixed spans like Upload board */}
          <section
            aria-label="Dashboard bento"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 md:grid-rows-[minmax(280px,auto)_minmax(200px,auto)_minmax(240px,auto)] gap-3 sm:gap-4"
          >
            {/* Performance — wide hero */}
            <div className={`sm:col-span-2 md:col-span-8 md:row-span-2 md:col-start-1 md:row-start-1 ${BENTO} p-4 sm:p-5 min-w-0 flex flex-col`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3 shrink-0">
                <div className="min-w-0">
                  <h2 className="font-bold text-[#0F172A] text-base sm:text-lg tracking-tight">Performance Overview</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    CSR call activity · day resets 4:00 AM (PKT)
                  </p>
                </div>
                {(overviewLoaded || loadingOverview) && (
                  <DateRangePicker selected={selectedRange} onChange={setSelectedRange} />
                )}
              </div>
              <div className="flex-1 min-h-[200px]">
                {overviewLoaded || loadingOverview ? (
                  <PerformanceChart series={chartSeries} range={selectedRange} />
                ) : (
                  <div className="h-full min-h-[200px] rounded-2xl bg-gray-100 animate-pulse" />
                )}
              </div>
            </div>

            {/* Lead donut — tall side */}
            <div className={`sm:col-span-1 md:col-span-4 md:row-span-2 md:col-start-9 md:row-start-1 ${BENTO} p-4 sm:p-5 min-w-0 overflow-auto`}>
              {overviewLoaded || loadingOverview ? (
                <OverviewChart distribution={summary?.distribution} />
              ) : (
                <div className="h-[220px] rounded-2xl bg-gray-100 animate-pulse" />
              )}
            </div>

            {/* Top Performers — mid width */}
            <div className={`sm:col-span-1 md:col-span-5 md:col-start-1 md:row-start-3 ${BENTO} p-4 sm:p-5 min-w-0`}>
              {overviewLoaded || loadingOverview ? (
                <TopPerformers performers={summary?.performers} />
              ) : (
                <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
              )}
            </div>

            {/* Recent Activity — wider */}
            <div className={`sm:col-span-1 md:col-span-4 md:col-start-6 md:row-start-3 ${BENTO} p-4 sm:p-5 min-w-0`}>
              {overviewLoaded || loadingOverview ? (
                <RecentActivity recent={summary?.recent} recentStatus={summary?.recentStatus} />
              ) : (
                <div className="h-[200px] rounded-2xl bg-gray-100 animate-pulse" />
              )}
            </div>

            {/* Top Estimators — compact accent tile */}
            <div className={`sm:col-span-2 md:col-span-3 md:col-start-10 md:row-start-3 ${BENTO} p-4 sm:p-5 min-w-0 bg-gradient-to-br from-amber-50/50 via-white to-sky-50/40`}>
              <TopEstimatorsWidget />
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

const DateRangePicker = ({ selected, onChange }: { selected: string; onChange: (r: string) => void }) => (
  <div className="flex gap-1.5 overflow-x-auto max-w-full pb-0.5 shrink-0 -mx-0.5 px-0.5">
    {[
      { key: "today", label: "Today / Pending" },
      { key: "week", label: "Week" },
      { key: "month", label: "Month" },
      { key: "year", label: "Year" },
    ].map(r => (
      <button
        key={r.key}
        type="button"
        onClick={() => onChange(r.key)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
          selected === r.key
            ? "bg-[#B8112D] text-white shadow-sm"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {r.label}
      </button>
    ))}
  </div>
);
