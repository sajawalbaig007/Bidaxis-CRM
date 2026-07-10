"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import { ChevronDown, Clock, Download, LogIn, LogOut, Monitor, Users } from "lucide-react";

type CsrOption = { id: string; name: string; csrCode?: string | null };

type SessionRow = {
  id: string;
  csrId: string;
  csrName: string;
  csrCode: string | null;
  loginAtEst: string;
  logoutAtEst: string;
  dashboardDuration: string;
  awayDuration: string;
  totalDuration: string;
  status: "active" | "closed";
  browser: string | null;
  ip: string | null;
  closedReason: string | null;
};

type SummaryRow = {
  csrId: string;
  csrName: string;
  csrCode: string | null;
  sessions: number;
  dashboardDuration: string;
  awayDuration: string;
  totalDuration: string;
};

type ReportResponse = {
  success: boolean;
  timezoneLabel: string;
  sessions: SessionRow[];
  summary: SummaryRow[];
};

function estTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function downloadCsv(rows: SessionRow[], filename: string) {
  const headers = [
    "CSR",
    "Code",
    "Login (EST)",
    "Logout (EST)",
    "On Dashboard",
    "Away",
    "Total",
    "Status",
    "Browser",
    "IP",
    "Closed Reason",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map(r => [
      escape(r.csrName),
      escape(r.csrCode ?? ""),
      escape(r.loginAtEst),
      escape(r.logoutAtEst),
      escape(r.dashboardDuration),
      escape(r.awayDuration),
      escape(r.totalDuration),
      escape(r.status),
      escape(r.browser ?? ""),
      escape(r.ip ?? ""),
      escape(r.closedReason ?? ""),
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsrActivityReport() {
  const today = estTodayYmd();
  const weekAgo = addDaysYmd(today, -6);

  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate, setToDate] = useState(today);
  const [csrId, setCsrId] = useState("all");
  const [csrs, setCsrs] = useState<CsrOption[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [timezoneLabel, setTimezoneLabel] = useState("Eastern Time (EST/EDT)");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<"sessions" | "summary">("sessions");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    API.get("/admin/csrs")
      .then(res => setCsrs(res.data.csrs ?? []))
      .catch(() => {});
  }, []);

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

  const loadReport = useCallback(async () => {
    if (!fromDate || !toDate) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (csrId !== "all") params.set("csrId", csrId);
      const res = await API.get<ReportResponse>(`/admin/csr-session-report?${params}`);
      setSessions(res.data.sessions ?? []);
      setSummary(res.data.summary ?? []);
      setTimezoneLabel(res.data.timezoneLabel ?? "Eastern Time (EST/EDT)");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load CSR activity report."));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, csrId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const selectedCsr = csrs.find(c => c.id === csrId) ?? null;
  const dropdownLabel = selectedCsr ? selectedCsr.name : "All CSRs";

  const totals = useMemo(() => ({
    sessions: sessions.length,
    csrs: summary.length,
  }), [sessions, summary]);

  return (
    <div className="rounded-2xl sm:rounded-[24px] bg-white p-4 sm:p-5 shadow-sm border border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between mb-3 sm:mb-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Clock size={18} />
          </div>
          <div className="text-left">
            <h2 className="text-base sm:text-lg font-bold text-[#111827]">CSR Login & Activity</h2>
            <p className="text-xs text-gray-400">All times in {timezoneLabel}</p>
          </div>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-10 flex-1 min-w-[130px] sm:flex-none rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D]"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-10 flex-1 min-w-[130px] sm:flex-none rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D]"
            />

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(v => !v)}
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 flex items-center gap-2 min-w-[140px]"
              >
                <Users size={14} className="text-gray-400" />
                <span className="truncate max-w-[120px]">{dropdownLabel}</span>
                <ChevronDown size={14} className="text-gray-400 ml-auto" />
              </button>
              {dropdownOpen && (
                <div className="absolute z-20 mt-1 w-52 max-h-60 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg py-1">
                  <button
                    type="button"
                    onClick={() => { setCsrId("all"); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${csrId === "all" ? "text-[#B8112D] font-semibold" : "text-gray-700"}`}
                  >
                    All CSRs
                  </button>
                  {csrs.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCsrId(c.id); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${csrId === c.id ? "text-[#B8112D] font-semibold" : "text-gray-700"}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void loadReport()}
              disabled={loading || !fromDate || !toDate}
              className="h-10 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => downloadCsv(sessions, `csr-activity-${fromDate}-${toDate}.csv`)}
              disabled={!sessions.length}
              className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs sm:text-sm">
              <LogIn size={14} className="text-green-600" />
              <span className="text-gray-500">Sessions:</span>
              <span className="font-bold text-gray-800">{totals.sessions}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs sm:text-sm">
              <Users size={14} className="text-blue-600" />
              <span className="text-gray-500">CSRs:</span>
              <span className="font-bold text-gray-800">{totals.csrs}</span>
            </div>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setView("sessions")}
                className={`px-3 py-2 font-semibold ${view === "sessions" ? "bg-[#B8112D] text-white" : "bg-white text-gray-600"}`}
              >
                Per session
              </button>
              <button
                type="button"
                onClick={() => setView("summary")}
                className={`px-3 py-2 font-semibold ${view === "summary" ? "bg-[#B8112D] text-white" : "bg-white text-gray-600"}`}
              >
                Per CSR
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {view === "sessions" ? (
              <table className="w-full" style={{ minWidth: "900px" }}>
                <thead>
                  <tr className="border-b border-gray-100 text-left bg-[#FAFAFB]">
                    {["CSR", "Login (EST)", "Logout (EST)", "On Dashboard", "Away", "Total", "Status"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="border-b border-gray-50">
                        {[1, 2, 3, 4, 5, 6, 7].map(j => (
                          <td key={j} className="px-3 py-3">
                            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                        No CSR sessions in this date range
                      </td>
                    </tr>
                  ) : sessions.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-sm text-[#111827]">{row.csrName}</div>
                        {row.csrCode && <div className="text-[10px] text-gray-400">{row.csrCode}</div>}
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><LogIn size={12} className="text-green-500" />{row.loginAtEst}</span>
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <LogOut size={12} className={row.status === "active" ? "text-amber-500" : "text-gray-400"} />
                          {row.logoutAtEst}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm font-semibold text-emerald-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Monitor size={12} />{row.dashboardDuration}</span>
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm font-semibold text-amber-600 whitespace-nowrap">{row.awayDuration}</td>
                      <td className="px-3 py-3 text-xs sm:text-sm font-semibold text-gray-800 whitespace-nowrap">{row.totalDuration}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full ${
                          row.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {row.status === "active" ? "Active" : "Closed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full" style={{ minWidth: "700px" }}>
                <thead>
                  <tr className="border-b border-gray-100 text-left bg-[#FAFAFB]">
                    {["CSR", "Sessions", "On Dashboard", "Away", "Total"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="border-b border-gray-50">
                        {[1, 2, 3, 4, 5].map(j => (
                          <td key={j} className="px-3 py-3">
                            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : summary.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                        No summary for this date range
                      </td>
                    </tr>
                  ) : summary.map(row => (
                    <tr key={row.csrId} className="border-b border-gray-50 hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3 font-semibold text-sm text-[#111827]">{row.csrName}</td>
                      <td className="px-3 py-3 text-sm font-bold text-gray-700">{row.sessions}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-emerald-600">{row.dashboardDuration}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-amber-600">{row.awayDuration}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-800">{row.totalDuration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
