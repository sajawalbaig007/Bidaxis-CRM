"use client";

import { useMemo, useState, useEffect } from "react";
import API from "./../../../lib/api";
import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar  from "../components/Navbar";

import {
  PhoneCall, ShoppingCart, Clock3, FileBarChart2,
  TrendingUp, Database, AlertTriangle, ChevronDown, Users,
} from "lucide-react";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid, YAxis, Legend,
} from "recharts";

/* ── Types ── */
type CSRPerformance = {
  id: string; csrId: string; name: string;
  totalLeads: number; completed: number; pending: number;
  important: number; interested: number;
  notCompleted: number; projectWon: number;
};

type ReportResponse = {
  period: string;
  totalLeads: number; completed: number; pending: number;
  important: number; interested: number;
  csrPerformance: CSRPerformance[];
  timeChart: { label: string; leads: number; completed: number }[];
};

export default function ReportsPage() {
  const [reportData,    setReportData]    = useState<ReportResponse | null>(null);
  const [activePeriod,  setActivePeriod]  = useState<"today" | "week" | "month" | "all">("today");
  const [loadingReport, setLoadingReport] = useState(false);
  const [fromDate,      setFromDate]      = useState("");
  const [toDate,        setToDate]        = useState("");

  /* Selected CSR — null = All */
  const [selectedCSRId, setSelectedCSRId] = useState<string>("all");
  const [dropdownOpen,  setDropdownOpen]  = useState(false);

  /* ── FETCH ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchReports = async (
    period: string = "today",
    customFrom?: string,
    customTo?: string,
  ) => {
    try {
      setLoadingReport(true);
      const url = (customFrom && customTo)
        ? `/reports?fromDate=${customFrom}&toDate=${customTo}`
        : `/reports?period=${period}`;
      const res = await API.get(url);
      setReportData(res.data);
      setSelectedCSRId("all"); // reset on period change
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    const load = async () => { await fetchReports("today"); };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Derived: selected CSR object ── */
  const csrList     = reportData?.csrPerformance ?? [];
  const selectedCSR = csrList.find(c => c.id === selectedCSRId) ?? null;

  /* ── Stats to show ── */
  const stats = selectedCSR
    ? {
        totalLeads:   selectedCSR.totalLeads,
        completed:    selectedCSR.completed,
        pending:      selectedCSR.pending,
        important:    selectedCSR.important,
        interested:   selectedCSR.interested,
        notCompleted: selectedCSR.notCompleted  ?? 0,
        projectWon:   selectedCSR.projectWon    ?? 0,
      }
    : {
        totalLeads:   reportData?.totalLeads  ?? 0,
        completed:    reportData?.completed   ?? 0,
        pending:      reportData?.pending     ?? 0,
        important:    reportData?.important   ?? 0,
        interested:   reportData?.interested  ?? 0,
        notCompleted: 0,
        projectWon:   0,
      };

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    if (selectedCSR) {
      /* Single CSR — show their breakdown as one grouped bar */
      return [
        { day: selectedCSR.name, calls: selectedCSR.totalLeads, completed: selectedCSR.completed },
      ];
    }
    /* All CSRs with timeChart */
    if (activePeriod !== "all" && reportData?.timeChart?.length) {
      return reportData.timeChart.map(t => ({ day: t.label, calls: t.leads, completed: t.completed }));
    }
    /* Fallback — CSR names */
    return csrList.map(c => ({ day: c.name, calls: c.totalLeads, completed: c.completed }));
  }, [selectedCSR, activePeriod, reportData, csrList]);

  /* ── CSR dropdown label ── */
  const dropdownLabel = selectedCSR ? selectedCSR.name : "All CSRs";

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6FA]">
      <DashboardSidebar/>

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 mt-[72px] lg:mt-0">
        <DashboardNavbar/>

        {/* ── HEADER ── */}
        <div className="mt-5 mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B8112D] text-white">
              <FileBarChart2 size={20}/>
            </div>
            <div>
              <h1 className="text-[28px] font-bold text-[#111827]">Reports & Analytics</h1>
              <p className="text-sm text-gray-400 mt-0.5">CSR performance — filter by period or date range.</p>
            </div>
          </div>

          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"/>
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="h-11 rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"/>
            <button
              onClick={() => { if (!fromDate || !toDate) return; setActivePeriod("all"); fetchReports("all", fromDate, toDate); }}
              disabled={!fromDate || !toDate}
              className={`h-11 px-5 rounded-2xl text-sm font-semibold transition-all ${fromDate && toDate ? "bg-[#B8112D] text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
              Filter
            </button>
            <button
              onClick={() => { setFromDate(""); setToDate(""); setActivePeriod("today"); fetchReports("today"); }}
              className="h-11 px-5 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Reset
            </button>
          </div>
        </div>

        {/* ── PERIOD + CSR FILTER BAR ── */}
        <div className="bg-white rounded-[24px] border border-gray-100 p-4 shadow-sm mb-6 flex flex-wrap items-center gap-3">
          {/* Period buttons */}
          {([
            { key:"today", label:"Today"   },
            { key:"week",  label:"7 Days"  },
            { key:"month", label:"30 Days" },
          ] as const).map(({ key, label }) => (
            <button key={key}
              onClick={() => { setActivePeriod(key); setFromDate(""); setToDate(""); fetchReports(key); }}
              className={`h-10 px-5 rounded-2xl text-sm font-semibold transition-all ${
                activePeriod === key && !fromDate
                  ? "bg-[#B8112D] text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {loadingReport && activePeriod === key ? "Loading..." : label}
            </button>
          ))}

          <div className="h-6 w-px bg-gray-200"/>

          {/* CSR Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-10 px-4 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 flex items-center gap-2 min-w-[160px] hover:bg-gray-50 transition-all">
              <Users size={15} className="text-[#B8112D]"/>
              {dropdownLabel}
              <ChevronDown size={15} className={`ml-auto text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}/>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-12 z-50 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]">
                <button
                  onClick={() => { setSelectedCSRId("all"); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold flex items-center gap-2 hover:bg-[#FFF1F3] transition-all ${selectedCSRId === "all" ? "text-[#B8112D] bg-[#FFF1F3]" : "text-gray-700"}`}>
                  <div className="w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                    <Users size={13}/>
                  </div>
                  All CSRs
                </button>
                {csrList.map(csr => (
                  <button key={csr.id}
                    onClick={() => { setSelectedCSRId(csr.id); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-semibold flex items-center gap-2 hover:bg-[#FFF1F3] transition-all border-t border-gray-50 ${selectedCSRId === csr.id ? "text-[#B8112D] bg-[#FFF1F3]" : "text-gray-700"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${selectedCSRId === csr.id ? "bg-[#B8112D] text-white" : "bg-[#F3F4F6] text-gray-600"}`}>
                      {csr.name.charAt(0).toUpperCase()}
                    </div>
                    {csr.name}
                    <span className="ml-auto text-[10px] text-gray-400">{csr.totalLeads} leads</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCSR && (
            <span className="text-xs text-[#B8112D] font-semibold bg-[#FFF1F3] px-3 py-1.5 rounded-xl">
              Viewing: {selectedCSR.name}
            </span>
          )}

          {loadingReport && (
            <div className="w-4 h-4 border-2 border-[#B8112D] border-t-transparent rounded-full animate-spin ml-auto"/>
          )}
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label:"Total Leads", value: stats.totalLeads,  bg:"bg-red-50",    color:"text-[#B8112D]",     icon:<PhoneCall size={24}/> },
            { label:"Completed",   value: stats.completed,   bg:"bg-green-50",  color:"text-green-600",     icon:<ShoppingCart size={24}/> },
            { label:"Pending",     value: stats.pending,     bg:"bg-yellow-50", color:"text-yellow-600",    icon:<Clock3 size={24}/> },
            { label:"Important",   value: stats.important,   bg:"bg-red-50",    color:"text-red-600",       icon:<AlertTriangle size={24}/> },
          ].map((c, i) => (
            <div key={i} className="rounded-[24px] bg-white p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{c.label}</p>
                  {loadingReport
                    ? <div className="h-8 w-14 bg-gray-100 rounded-lg mt-2 animate-pulse"/>
                    : <h2 className="mt-2 text-3xl font-bold text-[#111827]">{c.value}</h2>
                  }
                </div>
                <div className={`flex h-13 w-13 items-center justify-center rounded-2xl ${c.bg} ${c.color}`}>{c.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── CHARTS + INSIGHTS ── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 mb-6">

          {/* Bar Chart */}
          <div className="xl:col-span-8 rounded-[24px] bg-white p-5 shadow-sm border border-gray-100">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#111827]">
                  {selectedCSR ? `${selectedCSR.name}'s Performance` : "Overall Performance"}
                </h2>
                <p className="mt-0.5 text-sm text-gray-400">
                  {activePeriod === "today" ? "Today's breakdown by hour" :
                   activePeriod === "week"  ? "Last 7 days" :
                   activePeriod === "month" ? "Last 30 days" :
                   fromDate && toDate ? `${fromDate} → ${toDate}` : "All time"}
                </p>
              </div>
            </div>
            <div style={{ height: 280 }}>
              {chartData.length === 0 || chartData.every(d => d.calls === 0) ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Database size={36} className="text-gray-200 mb-3"/>
                  <p className="font-semibold text-gray-400 text-sm">No data for this period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}/>
                    <Tooltip
                      contentStyle={{ borderRadius:"12px", border:"1px solid #eee", fontSize:"13px" }}
                      formatter={(v, n) => [v, n === "calls" ? "Total Leads" : "Completed"]}/>
                    <Legend formatter={v => v === "calls" ? "Total Leads" : "Completed"}/>
                    <Bar dataKey="calls"     fill="#B8112D" radius={[6,6,0,0]} name="calls"/>
                    <Bar dataKey="completed" fill="#12B76A" radius={[6,6,0,0]} name="completed"/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Quick Insights */}
          <div className="xl:col-span-4 rounded-[24px] bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-[#111827] mb-1">
              {selectedCSR ? `${selectedCSR.name}` : "Quick Insights"}
            </h2>
            <p className="text-sm text-gray-400 mb-5">
              {activePeriod === "today" ? "Today" : activePeriod === "week" ? "Last 7 days" : activePeriod === "month" ? "Last 30 days" : "Custom range"}
            </p>

            {loadingReport ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse"/>)}
              </div>
            ) : stats.totalLeads === 0 ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Database size={32} className="text-gray-200 mb-3"/>
                <p className="text-sm text-gray-400">No data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label:"Total Leads",    value: stats.totalLeads,   bg:"bg-red-50",    color:"text-[#B8112D]",  icon:<PhoneCall size={16}/> },
                  { label:"Completed",      value: stats.completed,    bg:"bg-green-50",  color:"text-green-600",  icon:<ShoppingCart size={16}/> },
                  { label:"Interested",     value: stats.interested,   bg:"bg-orange-50", color:"text-orange-600", icon:<TrendingUp size={16}/> },
                  { label:"Important",      value: stats.important,    bg:"bg-red-50",    color:"text-red-600",    icon:<AlertTriangle size={16}/> },
                  ...(selectedCSR ? [
                    { label:"Not Completed", value: stats.notCompleted, bg:"bg-gray-50",   color:"text-gray-500",   icon:<Clock3 size={16}/> },
                    { label:"Close Client",   value: stats.projectWon,   bg:"bg-emerald-50",color:"text-emerald-600",icon:<ShoppingCart size={16}/> },
                  ] : []),
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg} ${s.color} shrink-0`}>{s.icon}</div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">{s.label}</p>
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CSR PERFORMANCE TABLE ── */}
        <div className="overflow-x-auto rounded-[24px] bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-[#111827] mb-5">
            {selectedCSR ? `${selectedCSR.name} — Detail` : "All CSRs Performance"}
          </h2>

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left bg-[#FAFAFB]">
                {["CSR","Total","Completed","Pending","Important","Interested","Not Picked","Close Client"].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingReport ? (
                [1,2,3].map(i => (
                  <tr key={i} className="border-b border-gray-50">
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 w-10 bg-gray-100 rounded animate-pulse"/>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (selectedCSR ? [selectedCSR] : csrList).map(csr => (
                <tr key={csr.id}
                  
                  className={`border-b border-gray-50 transition-all ${
                    "hover:bg-[#FAFAFB]"
                  }`}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {csr.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-[#111827]">{csr.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-[#111827]">{csr.totalLeads}</td>
                  <td className="px-4 py-4"><span className="text-sm font-semibold text-green-600">{csr.completed}</span></td>
                  <td className="px-4 py-4"><span className="text-sm font-semibold text-yellow-600">{csr.pending}</span></td>
                  <td className="px-4 py-4"><span className="text-sm font-semibold text-orange-600">{csr.important}</span></td>
                  <td className="px-4 py-4"><span className="text-sm font-semibold text-blue-600">{csr.interested ?? 0}</span></td>
                  <td className="px-4 py-4"><span className="text-sm font-semibold text-gray-500">{csr.notCompleted ?? 0}</span></td>
                  <td className="px-4 py-4"><span className="text-sm font-semibold text-emerald-600">{csr.projectWon ?? 0}</span></td>
                </tr>
              ))}

              {!loadingReport && csrList.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400 text-sm">
                    No data for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* close dropdown on outside click */}
        {dropdownOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)}/>
        )}
      </main>
    </div>
  );
}