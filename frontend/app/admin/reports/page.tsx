"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import DashboardNavbar  from "../components/layout/Navbar";
import { useStaffSidebar } from "@/app/hooks/useStaffSidebar";
import { fetchReports, type ReportsData } from "@/lib/reportsCache";
import { apiErrorMessage } from "@/lib/api";

import {
  PhoneCall, ShoppingCart, Clock3, FileBarChart2,
  TrendingUp, Database, AlertTriangle, ChevronDown, Users,
} from "lucide-react";

const ReportCharts = dynamic(() => import("./ReportCharts"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-xl bg-gray-100 animate-pulse" />,
});

const CsrActivityReport = dynamic(() => import("./CsrActivityReport"), {
  ssr: false,
  loading: () => <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />,
});

type ReportResponse = ReportsData;

/* ── Main Page ── */
export default function ReportsPage() {
  const StaffSidebar = useStaffSidebar();
  const [reportData,    setReportData]    = useState<ReportResponse | null>(null);
  const [activePeriod,  setActivePeriod]  = useState<"today" | "week" | "month" | "all">("week");
  const [loadingReport, setLoadingReport] = useState(false);
  const [fromDate,      setFromDate]      = useState("");
  const [toDate,        setToDate]        = useState("");
  const [selectedCSRId, setSelectedCSRId] = useState<string>("all");
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [csrPerfOpen,   setCsrPerfOpen]   = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const loadReports = useCallback(async (
    period: string = "week",
    customFrom?: string,
    customTo?: string,
    force = false,
  ) => {
    try {
      setLoadingReport(true);
      const data = await fetchReports(period, customFrom, customTo, force);
      setReportData(data);
    } catch (err) {
      console.error(err);
      toast.error(apiErrorMessage(err, "Failed to load reports."));
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    void loadReports("week");
  }, [loadReports]);

  const csrList     = useMemo(() => reportData?.csrPerformance ?? [], [reportData]);
  const selectedCSR = csrList.find(c => c.id === selectedCSRId) ?? null;

  const stats = selectedCSR
    ? {
        totalLeads:     selectedCSR.totalLeads,
        completed:      selectedCSR.completed,
        pending:        selectedCSR.pending,
        important:      selectedCSR.important,
        interested:     selectedCSR.interested,
        notCompleted:   selectedCSR.notCompleted ?? 0,
        notInterested:  selectedCSR.notInterested ?? 0,
        projectWon:     selectedCSR.projectWon   ?? 0,
        inHouse:        selectedCSR.inHouse      ?? 0,
        noOwner:        0,
        notInService:   0,
      }
    : {
        totalLeads:     reportData?.totalLeads     ?? 0,
        completed:      reportData?.completed      ?? 0,
        pending:        reportData?.pending        ?? 0,
        important:      reportData?.important      ?? 0,
        interested:     reportData?.interested     ?? 0,
        notCompleted:   reportData?.notCompleted   ?? 0,
        notInterested:  reportData?.notInterested  ?? 0,
        projectWon:     reportData?.projectWon     ?? 0,
        inHouse:        reportData?.inHouse        ?? 0,
        noOwner:        reportData?.noOwner        ?? 0,
        notInService:   reportData?.notInService   ?? 0,
      };

  const statusPieData = useMemo(() => {
    const slices = [
      { name: "Important",          value: stats.important },
      { name: "Close Client",       value: stats.projectWon },
      { name: "Not Picked",         value: stats.notCompleted },
      { name: "Not Interested",     value: stats.notInterested },
      { name: "In House",           value: stats.inHouse },
      { name: "Interested Clients", value: stats.interested },
    ];
    return slices.filter(s => s.value > 0);
  }, [stats]);

  const chartData = useMemo(() => {
    if (selectedCSR) {
      return [{ day: selectedCSR.name, calls: selectedCSR.totalLeads, completed: selectedCSR.completed }];
    }
    if (activePeriod !== "all" && reportData?.timeChart?.length) {
      return reportData.timeChart.map(t => ({ day: t.label, calls: t.leads, completed: t.completed }));
    }
    return csrList.map(c => ({ day: c.name, calls: c.totalLeads, completed: c.completed }));
  }, [selectedCSR, activePeriod, reportData, csrList]);

  const chartPeriodLabel =
    activePeriod === "all"    ? "All leads" :
    activePeriod === "today"  ? "Today's breakdown by hour" :
    activePeriod === "week"   ? "Last 7 days" :
    activePeriod === "month"  ? "Last 30 days" :
    fromDate && toDate        ? `${fromDate} → ${toDate}` : "All time";

  const dropdownLabel = selectedCSR ? selectedCSR.name : "All CSRs";

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6FA]">
      <StaffSidebar />

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 mt-[64px]">
        <DashboardNavbar />

        {/* ── HEADER ── */}
        <div className="mt-4 sm:mt-5 mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
          {/* Title */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-[#B8112D] text-white shrink-0">
              <FileBarChart2 size={18} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-[28px] font-bold text-[#111827]">
                Reports & Analytics
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                CSR performance — filter by period or date range.
              </p>
            </div>
          </div>

          {/* Date range filter — wraps on small screens */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-10 sm:h-11 flex-1 min-w-[130px] sm:flex-none rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D]"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-10 sm:h-11 flex-1 min-w-[130px] sm:flex-none rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D]"
            />
            <button
              onClick={() => {
                if (!fromDate || !toDate) return;
                setActivePeriod("all");
                loadReports("all", fromDate, toDate, true);
              }}
              disabled={!fromDate || !toDate}
              className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl text-sm font-semibold transition-all whitespace-nowrap ${
                fromDate && toDate
                  ? "bg-[#B8112D] text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Filter
            </button>
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
                setActivePeriod("all");
                loadReports("all", undefined, undefined, true);
              }}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 whitespace-nowrap"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ── PERIOD + CSR FILTER BAR ── */}
        <div className="bg-white rounded-2xl sm:rounded-[24px] border border-gray-100 shadow-sm mb-4 sm:mb-6">
          <div className="px-3 sm:px-4 py-3 overflow-x-auto">
            <div className="flex items-center gap-2 sm:gap-3 min-w-max">
            {/* Period buttons */}
            {([
              { key: "all",   label: "All Time" },
              { key: "today", label: "Today"   },
              { key: "week",  label: "7 Days"  },
              { key: "month", label: "30 Days" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setActivePeriod(key);
                  setFromDate("");
                  setToDate("");
                  loadReports(key);
                }}
                className={`h-9 sm:h-10 px-3 sm:px-5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activePeriod === key && !fromDate
                    ? "bg-[#B8112D] text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {loadingReport && activePeriod === key ? "Loading..." : label}
              </button>
            ))}

            </div>
          </div>

          <div className="px-3 sm:px-4 pb-3 flex flex-wrap items-center gap-2 sm:gap-3 border-t border-gray-50">
            <div className="relative z-[60]" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1.5 sm:gap-2 min-w-[140px] sm:min-w-[160px] hover:bg-gray-50 transition-all"
              >
                <Users size={13} className="text-[#B8112D] sm:w-[15px] sm:h-[15px]" />
                <span className="truncate max-w-[80px] sm:max-w-none">{dropdownLabel}</span>
                <ChevronDown
                  size={13}
                  className={`ml-auto text-gray-400 transition-transform shrink-0 sm:w-[15px] sm:h-[15px] ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 top-11 sm:top-12 z-[70] bg-white border border-gray-100 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden min-w-[180px] sm:min-w-[200px]">
                  <button
                    type="button"
                    onClick={() => { setSelectedCSRId("all"); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 hover:bg-[#FFF1F3] transition-all ${
                      selectedCSRId === "all" ? "text-[#B8112D] bg-[#FFF1F3]" : "text-gray-700"
                    }`}
                  >
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                      <Users size={11} className="sm:w-[13px] sm:h-[13px]" />
                    </div>
                    All CSRs
                  </button>
                  {csrList.map(csr => (
                    <button
                      key={csr.id}
                      type="button"
                      onClick={() => { setSelectedCSRId(csr.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 hover:bg-[#FFF1F3] transition-all border-t border-gray-50 ${
                        selectedCSRId === csr.id ? "text-[#B8112D] bg-[#FFF1F3]" : "text-gray-700"
                      }`}
                    >
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] sm:text-xs font-bold ${
                        selectedCSRId === csr.id ? "bg-[#B8112D] text-white" : "bg-[#F3F4F6] text-gray-600"
                      }`}>
                        {csr.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        {csr.csrCode && (
                          <span className="bg-[#B8112D]/10 text-[#B8112D] text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">{csr.csrCode}</span>
                        )}
                        <span className="truncate">{csr.name}</span>
                      </div>
                      <span className="ml-auto text-[10px] text-gray-400 shrink-0">{csr.totalLeads}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCSR && (
              <span className="text-[10px] sm:text-xs text-[#B8112D] font-semibold bg-[#FFF1F3] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl whitespace-nowrap">
                Viewing: {selectedCSR.name}
              </span>
            )}

            {loadingReport && (
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-[#B8112D] border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* ── SUMMARY DONUT CHART ── */}
        <div className="bg-white rounded-2xl sm:rounded-[24px] border border-gray-100 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#111827]">Lead Status Breakdown</h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                {selectedCSR ? selectedCSR.name : "All CSRs"} ·{" "}
                {activePeriod === "all" ? "All time" : activePeriod === "today" ? "Today" : activePeriod === "week" ? "7 Days" : activePeriod === "month" ? "30 Days" : "Custom"}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3 sm:gap-4 text-center flex-1">
              {[
                { label:"Total",     value: stats.totalLeads,  color:"text-[#B8112D]"   },
                { label:"Completed", value: stats.completed,   color:"text-green-600"   },
                { label:"Pending",   value: stats.pending,     color:"text-yellow-600"  },
                { label:"Important", value: stats.important,   color:"text-orange-600"  },
              ].map(s => (
                <div key={s.label}>
                  {loadingReport
                    ? <div className="h-7 w-10 bg-gray-100 rounded-lg animate-pulse mx-auto mb-1"/>
                    : <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
                  }
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          {!loadingReport && stats.totalLeads > 0 && (
            <div className="mt-4 h-[10px] bg-gray-100 rounded-full overflow-hidden flex">
              {[
                { val: stats.completed, bg: "bg-green-500"  },
                { val: stats.pending,   bg: "bg-yellow-400" },
                { val: stats.important, bg: "bg-orange-500" },
                { val: stats.interested,bg: "bg-blue-500"   },
              ].map((b, i) => (
                <div key={i} className={`${b.bg} h-full transition-all`} style={{ width: `${(b.val / stats.totalLeads) * 100}%` }}/>
              ))}
            </div>
          )}
          {!loadingReport && stats.totalLeads > 0 && (
            <div className="flex flex-wrap gap-3 mt-2.5">
              {[
                { label:"Completed",  val: stats.completed,  dot:"bg-green-500"  },
                { label:"Pending",    val: stats.pending,    dot:"bg-yellow-400" },
                { label:"Important",  val: stats.important,  dot:"bg-orange-500" },
                { label:"Interested", val: stats.interested, dot:"bg-blue-500"   },
              ].map(b => (
                <span key={b.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${b.dot}`}/>
                  {b.label} <strong className="text-gray-700">{b.val}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── CHART + INSIGHTS ── */}
        {/* Stacked on mobile/tablet, side by side on xl+ */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 mb-4 sm:mb-6">

          {/* Bar Chart + Area Chart — equal width */}
          <div className="xl:col-span-8 rounded-2xl sm:rounded-[24px] bg-white p-4 sm:p-5 shadow-sm border border-gray-100">
            <ReportCharts
              chartData={chartData}
              statusPieData={statusPieData}
              chartPeriodLabel={selectedCSR ? `${selectedCSR.name}'s performance · ${chartPeriodLabel}` : chartPeriodLabel}
              pieSubtitle={`${selectedCSR ? selectedCSR.name : "All CSRs"} — lead status breakdown`}
            />
          </div>

          {/* Quick Insights */}
          <div className="xl:col-span-4 rounded-2xl sm:rounded-[24px] bg-white p-4 sm:p-5 shadow-sm border border-gray-100">
            <h2 className="text-base sm:text-lg font-bold text-[#111827] mb-0.5">
              {selectedCSR ? selectedCSR.name : "Quick Insights"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-5">
              {activePeriod === "all"   ? "All time" :
               activePeriod === "today" ? "Today" :
               activePeriod === "week"  ? "Last 7 days" :
               activePeriod === "month" ? "Last 30 days" : "Custom range"}
            </p>

            {loadingReport ? (
              <div className="space-y-2 sm:space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-12 sm:h-14 bg-gray-100 rounded-xl sm:rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : stats.totalLeads === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 sm:h-40">
                <Database size={28} className="text-gray-200 mb-2 sm:mb-3 sm:w-8 sm:h-8" />
                <p className="text-xs sm:text-sm text-gray-400">No data</p>
              </div>
            ) : (
              /* 2-col grid on mobile/sm for compact view; 1-col on xl */
              <div className="grid grid-cols-2 xl:grid-cols-1 gap-2 sm:gap-3">
                {[
                  { label: "Total Leads",    value: stats.totalLeads,   bg: "bg-red-50",     color: "text-[#B8112D]",   icon: <PhoneCall size={14} className="sm:w-4 sm:h-4" /> },
                  { label: "Completed",      value: stats.completed,    bg: "bg-green-50",   color: "text-green-600",   icon: <ShoppingCart size={14} className="sm:w-4 sm:h-4" /> },
                  { label: "Interested",     value: stats.interested,   bg: "bg-orange-50",  color: "text-orange-600",  icon: <TrendingUp size={14} className="sm:w-4 sm:h-4" /> },
                  { label: "Important",      value: stats.important,    bg: "bg-red-50",     color: "text-red-600",     icon: <AlertTriangle size={14} className="sm:w-4 sm:h-4" /> },
                  ...(selectedCSR ? [
                    { label: "Not Completed", value: stats.notCompleted, bg: "bg-gray-50",    color: "text-gray-500",    icon: <Clock3 size={14} className="sm:w-4 sm:h-4" /> },
                    { label: "Close Client",  value: stats.projectWon,   bg: "bg-emerald-50", color: "text-emerald-600", icon: <ShoppingCart size={14} className="sm:w-4 sm:h-4" /> },
                  ] : []),
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-gray-50 p-2.5 sm:p-3">
                    <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl shrink-0 ${s.bg} ${s.color}`}>
                      {s.icon}
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-400">{s.label}</p>
                      <p className={`text-base sm:text-lg font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <CsrActivityReport />
        </div>

        {/* ── CSR PERFORMANCE TABLE ── */}
        <div className="rounded-2xl sm:rounded-[24px] bg-white p-4 sm:p-5 shadow-sm border border-gray-100">
          <button
            type="button"
            onClick={() => setCsrPerfOpen(v => !v)}
            className="w-full flex items-center justify-between mb-3 sm:mb-5"
          >
            <h2 className="text-base sm:text-lg font-bold text-[#111827]">
              {selectedCSR ? `${selectedCSR.name} — Detail` : "All CSRs Performance"}
            </h2>
            <ChevronDown size={18} className={`text-gray-400 transition-transform ${csrPerfOpen ? "rotate-180" : ""}`} />
          </button>

          {csrPerfOpen && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "700px" }}>
              <thead>
                <tr className="border-b border-gray-100 text-left bg-[#FAFAFB]">
                  {["CSR", "Total", "Completed", "Pending", "Important", "Interested", "Not Picked", "Close Client"].map(h => (
                    <th key={h} className="px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingReport ? (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="border-b border-gray-50">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(j => (
                        <td key={j} className="px-3 sm:px-4 py-3 sm:py-4">
                          <div className="h-3.5 sm:h-4 w-8 sm:w-10 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (selectedCSR ? [selectedCSR] : csrList).map(csr => (
                  <tr key={csr.id} className="border-b border-gray-50 hover:bg-[#FAFAFB] transition-all">
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-2.5">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                          {csr.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-xs sm:text-sm text-[#111827] whitespace-nowrap">
                          {csr.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm font-bold text-[#111827]">{csr.totalLeads}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm font-semibold text-green-600">{csr.completed}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm font-semibold text-yellow-600">{csr.pending}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm font-semibold text-orange-600">{csr.important}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm font-semibold text-blue-600">{csr.interested ?? 0}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm font-semibold text-gray-500">{csr.notCompleted ?? 0}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span className="text-xs sm:text-sm font-semibold text-emerald-600">{csr.projectWon ?? 0}</span>
                    </td>
                  </tr>
                ))}

                {!loadingReport && csrList.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 sm:py-16 text-center text-gray-400 text-xs sm:text-sm">
                      No data for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

      </main>
    </div>
  );
}