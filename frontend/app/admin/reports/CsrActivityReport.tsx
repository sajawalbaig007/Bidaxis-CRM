"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import { EST_TZ_ABBR, EST_TZ_LABEL, formatEstDateTimeLocalInput } from "@/lib/estTime";
import { ChevronDown, Clock, Download, LogIn, LogOut, Monitor, Pencil, Users, X } from "lucide-react";

type ClockTz = "est" | "pkt";

const CLOCKS: Record<ClockTz, { tz: string; abbr: string; label: string; button: string }> = {
  est: { tz: "America/New_York", abbr: EST_TZ_ABBR, label: EST_TZ_LABEL, button: "EST" },
  pkt: { tz: "Asia/Karachi", abbr: "PKT", label: "Pakistan Time (PKT)", button: "Pakistan" },
};

function formatSessionStamp(iso: string | null | undefined, timeZone: string, empty = "—"): string {
  if (!iso) return empty;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return empty;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(d);
}

type CsrOption = { id: string; name: string; csrCode?: string | null };

type SessionRow = {
  id: string;
  csrId: string;
  csrName: string;
  csrCode: string | null;
  loginAt: string;
  logoutAt: string | null;
  loginAtEst: string;
  logoutAtEst: string;
  checkInAtEst?: string;
  checkOutAtEst?: string;
  dashboardDuration: string;
  awayDuration: string;
  totalDuration: string;
  status: "active" | "closed";
  browser: string | null;
  ip: string | null;
  closedReason: string | null;
  closedReasonLabel?: string;
};

type SummaryRow = {
  csrId: string;
  csrName: string;
  csrCode: string | null;
  sessions: number;
  dashboardDuration: string;
  awayDuration: string;
  totalDuration: string;
  firstLoginAt?: string;
  lastLogoutAt?: string | null;
  stillOpen?: boolean;
};

type ReportResponse = {
  success: boolean;
  timezoneLabel: string;
  sessions: SessionRow[];
  summary: SummaryRow[];
};

function calendarYmd(timeZone: string, value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function toPktLocalInput(iso: string | null | undefined): string {
  return formatEstDateTimeLocalInput(iso);
}

function pktWeekStart(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

type PeriodPreset = "daily" | "weekly" | "monthly" | "all";
const ALL_TIME_FROM = "2020-01-01";

function rangeForPeriod(period: PeriodPreset, today: string): { from: string; to: string } {
  if (period === "daily") return { from: today, to: today };
  if (period === "weekly") return { from: pktWeekStart(today), to: today };
  if (period === "monthly") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: ALL_TIME_FROM, to: today };
}

function periodFromDates(from: string, to: string, today: string): PeriodPreset | "custom" {
  if (from === today && to === today) return "daily";
  if (from === pktWeekStart(today) && to === today) return "weekly";
  if (from === `${today.slice(0, 7)}-01` && to === today) return "monthly";
  if (from === ALL_TIME_FROM && to === today) return "all";
  return "custom";
}

function downloadCsv(rows: SessionRow[], filename: string, personLabel: string, clock: ClockTz) {
  const tz = CLOCKS[clock];
  const headers = [
    personLabel,
    "Code",
    `Check In (${tz.abbr})`,
    `Check Out (${tz.abbr})`,
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
      escape(formatSessionStamp(r.loginAt, tz.tz)),
      escape(r.logoutAt ? formatSessionStamp(r.logoutAt, tz.tz) : "Still checked in"),
      escape(r.dashboardDuration),
      escape(r.awayDuration),
      escape(r.totalDuration),
      escape(r.status === "active" ? "Checked In" : "Checked Out"),
      escape(r.browser ?? ""),
      escape(r.ip ?? ""),
      escape(r.closedReasonLabel ?? r.closedReason ?? ""),
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

function escHtml(v: string) {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadExcel(
  sessions: SessionRow[],
  summary: SummaryRow[],
  filename: string,
  personLabel: string,
  title: string,
  clock: ClockTz,
) {
  const tz = CLOCKS[clock];
  const sessionHeader = [personLabel, "Code", `Check In (${tz.abbr})`, `Check Out (${tz.abbr})`, "On Dashboard", "Away", "Total", "Status", "Browser", "IP", "Closed Reason"];
  const sessionBody = sessions.map(r => [
    r.csrName,
    r.csrCode ?? "",
    formatSessionStamp(r.loginAt, tz.tz),
    r.logoutAt ? formatSessionStamp(r.logoutAt, tz.tz) : "Still checked in",
    r.dashboardDuration,
    r.awayDuration,
    r.totalDuration,
    r.status === "active" ? "Checked In" : "Checked Out",
    r.browser ?? "",
    r.ip ?? "",
    r.closedReasonLabel ?? r.closedReason ?? "",
  ].map(escHtml));
  const summaryHeader = [personLabel, `First Check In (${tz.abbr})`, `Last Check Out (${tz.abbr})`, "Sessions", "On Dashboard", "Away", "Total"];
  const summaryBody = summary.map(r => [
    r.csrName,
    r.firstLoginAt ? formatSessionStamp(r.firstLoginAt, tz.tz) : "—",
    r.stillOpen || !r.lastLogoutAt ? "Still checked in" : formatSessionStamp(r.lastLogoutAt, tz.tz),
    String(r.sessions),
    r.dashboardDuration,
    r.awayDuration,
    r.totalDuration,
  ].map(escHtml));

  const table = (headers: string[], rows: string[][]) =>
    `<table border="1"><thead><tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join("")}</tr></thead><tbody>${
      rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")
    }</tbody></table>`;

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"></head>
<body>
<h2>${escHtml(title)}</h2>
<p>All times in ${escHtml(tz.label)}</p>
<h3>Per session</h3>
${table(sessionHeader, sessionBody)}
<h3>Per ${escHtml(personLabel)}</h3>
${table(summaryHeader, summaryBody)}
</body></html>`;

  const blob = new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsrActivityReport({
  staffRole = "csr",
  allowEdit = true,
  defaultOpen = false,
}: {
  staffRole?: "csr" | "estimator";
  allowEdit?: boolean;
  defaultOpen?: boolean;
}) {
  const today = calendarYmd(CLOCKS.est.tz);
  const isEstimator = staffRole === "estimator";
  const title = isEstimator ? "Estimator Check In / Check Out" : "CSR Check In / Check Out";
  const personLabel = isEstimator ? "Estimator" : "CSR";
  const peopleLabel = isEstimator ? "Estimators" : "CSRs";
  const allLabel = isEstimator ? "All Estimators" : "All CSRs";

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [csrId, setCsrId] = useState("all");
  const [csrs, setCsrs] = useState<CsrOption[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [clockTz, setClockTz] = useState<ClockTz>("est");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState<"sessions" | "summary">("sessions");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editStillOpen, setEditStillOpen] = useState(false);
  const [editNote, setEditNote] = useState("admin_adjusted");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (row: SessionRow) => {
    setEditing(row);
    setEditCheckIn(toPktLocalInput(row.loginAt));
    setEditCheckOut(toPktLocalInput(row.logoutAt));
    setEditStillOpen(row.status === "active" || !row.logoutAt);
    setEditNote("admin_adjusted");
  };

  const closeEdit = () => {
    setEditing(null);
    setSavingEdit(false);
  };

  const saveEdit = async () => {
    if (!editing || !editCheckIn) {
      toast.error("Check-in time is required.");
      return;
    }
    if (!editStillOpen && !editCheckOut) {
      toast.error("Enter check-out time, or mark as still checked in.");
      return;
    }
    try {
      setSavingEdit(true);
      await API.put(`/admin/csr-work-session/${editing.id}`, {
        checkInAt: editCheckIn,
        checkOutAt: editStillOpen ? null : editCheckOut,
        clearCheckOut: editStillOpen,
        note: editNote.trim() || "admin_adjusted",
      });
      toast.success("Session times updated.");
      closeEdit();
      await loadReport();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to update session."));
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    API.get(isEstimator ? "/admin/csrs?role=estimator" : "/admin/csrs")
      .then(res => setCsrs(res.data.csrs ?? []))
      .catch(() => {});
  }, [isEstimator]);

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
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        role: staffRole,
        tz: clockTz === "pkt" ? "Asia/Karachi" : "America/New_York",
      });
      if (csrId !== "all") params.set("csrId", csrId);
      const res = await API.get<ReportResponse>(`/admin/csr-session-report?${params}`);
      setSessions(res.data.sessions ?? []);
      setSummary(res.data.summary ?? []);
      setHasLoaded(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Failed to load ${personLabel} activity report.`));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, csrId, staffRole, personLabel, clockTz]);

  useEffect(() => {
    if (!open) return;
    void loadReport();
  }, [open, loadReport]);

  const selectedCsr = csrs.find(c => c.id === csrId) ?? null;
  const dropdownLabel = selectedCsr ? selectedCsr.name : allLabel;
  const clock = CLOCKS[clockTz];
  const timezoneLabel = clock.label;
  const activePeriod = periodFromDates(fromDate, toDate, calendarYmd(clock.tz));

  const applyPeriod = (period: PeriodPreset) => {
    const range = rangeForPeriod(period, calendarYmd(clock.tz));
    setFromDate(range.from);
    setToDate(range.to);
  };

  const totals = useMemo(() => ({
    sessions: sessions.length,
    csrs: summary.length,
  }), [sessions, summary]);

  return (
    <div className="rounded-[1.75rem] border border-gray-100/90 bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors -m-1 p-1 sm:p-1.5"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 shrink-0">
            <Clock size={18} />
          </div>
          <div className="text-left min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[#111827] dark:text-gray-100 truncate">
              {title}
            </h2>
            <p className="text-xs text-gray-400 truncate">
              {open
                ? `Shift tracking · all times in ${timezoneLabel}`
                : hasLoaded
                  ? `${totals.sessions} session${totals.sessions === 1 ? "" : "s"} · click to expand`
                  : "Click to expand shift tracking report"}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold shrink-0 transition-colors ${
          open
            ? "bg-gray-100 dark:bg-crm-muted text-gray-600 dark:text-gray-300"
            : "bg-[#B8112D] text-white"
        }`}>
          {open ? "Collapse" : "Expand"}
          <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr] mt-3 sm:mt-4" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          {open && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {([
              ["daily", "Daily"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
              ["all", "All time"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPeriod(key)}
                className={`h-8 px-3 rounded-full text-xs font-bold border ${
                  activePeriod === key
                    ? "bg-[#B8112D] text-white border-[#B8112D]"
                    : "bg-white dark:bg-crm-muted text-gray-600 dark:text-crm-text-secondary border-gray-200 dark:border-crm-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-10 flex-1 min-w-[130px] sm:flex-none rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D]"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-10 flex-1 min-w-[130px] sm:flex-none rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D]"
            />
            <div className="flex items-center gap-1.5">
              {(["est", "pkt"] as const).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setClockTz(key)}
                  className={`h-10 px-3 rounded-xl text-xs font-bold border ${
                    clockTz === key
                      ? "bg-[#B8112D] text-white border-[#B8112D]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#B8112D]/40"
                  }`}
                >
                  {CLOCKS[key].button}
                </button>
              ))}
            </div>
            <p className="w-full text-[11px] text-gray-400 -mt-1">
              From / To follow {timezoneLabel} calendar days.
            </p>

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
                    {allLabel}
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
              onClick={() => downloadCsv(sessions, `${isEstimator ? "estimator" : "csr"}-activity-${fromDate}-${toDate}.csv`, personLabel, clockTz)}
              disabled={!sessions.length}
              className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => downloadExcel(
                sessions,
                summary,
                `${isEstimator ? "estimator" : "csr"}-activity-${fromDate}-${toDate}`,
                personLabel,
                title,
                clockTz,
              )}
              disabled={!sessions.length && !summary.length}
              className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Download size={14} />
              Download Excel
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
              <span className="text-gray-500">{peopleLabel}:</span>
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
                Per {personLabel}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {view === "sessions" ? (
              <table className="w-full" style={{ minWidth: "980px" }}>
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    <th colSpan={allowEdit ? 9 : 8} className="px-3 py-2 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Times</span>
                        {(["est", "pkt"] as const).map(key => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setClockTz(key)}
                            className={`h-7 px-3 rounded-lg text-[11px] font-bold border ${
                              clockTz === key
                                ? "bg-[#B8112D] text-white border-[#B8112D]"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#B8112D]/40"
                            }`}
                          >
                            {CLOCKS[key].button}
                          </button>
                        ))}
                        <span className="text-[11px] text-gray-400">{clock.label}</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="border-b border-gray-100 text-left bg-[#FAFAFB]">
                    {[personLabel, `Check In (${clock.abbr})`, `Check Out (${clock.abbr})`, "On Dashboard", "Away", "Total", "Status", "Closed By", ...(allowEdit ? [""] : [])].map(h => (
                      <th key={h || "actions"} className="px-3 py-2.5 text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="border-b border-gray-50">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => (
                          <td key={j} className="px-3 py-3">
                            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                        No {personLabel.toLowerCase()} check-in sessions in this date range
                      </td>
                    </tr>
                  ) : sessions.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-sm text-[#111827]">{row.csrName}</div>
                        {row.csrCode && <div className="text-[10px] text-gray-400">{row.csrCode}</div>}
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><LogIn size={12} className="text-green-500" />{formatSessionStamp(row.loginAt, clock.tz)}</span>
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <LogOut size={12} className={row.status === "active" ? "text-amber-500" : "text-gray-400"} />
                          {row.logoutAt ? formatSessionStamp(row.logoutAt, clock.tz) : "Still checked in"}
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
                          {row.status === "active" ? "Checked In" : "Checked Out"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                        {row.closedReasonLabel ?? (row.status === "active" ? "—" : (row.closedReason ?? "—"))}
                      </td>
                      {allowEdit ? (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-[#FFF1F3] text-[#B8112D] text-[11px] font-bold hover:bg-[#B8112D] hover:text-white transition-colors"
                          title="Adjust check-in / check-out times"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                      </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full" style={{ minWidth: "980px" }}>
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    <th colSpan={7} className="px-3 py-2 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Times</span>
                        {(["est", "pkt"] as const).map(key => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setClockTz(key)}
                            className={`h-7 px-3 rounded-lg text-[11px] font-bold border ${
                              clockTz === key
                                ? "bg-[#B8112D] text-white border-[#B8112D]"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#B8112D]/40"
                            }`}
                          >
                            {CLOCKS[key].button}
                          </button>
                        ))}
                        <span className="text-[11px] text-gray-400">{clock.label} · first check-in, last check-out</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="border-b border-gray-100 text-left bg-[#FAFAFB]">
                    {[personLabel, `First Check In (${clock.abbr})`, `Last Check Out (${clock.abbr})`, "Sessions", "On Dashboard", "Away", "Total"].map(h => (
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
                  ) : summary.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                        No summary for this date range
                      </td>
                    </tr>
                  ) : summary.map(row => (
                    <tr key={row.csrId} className="border-b border-gray-50 hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-sm text-[#111827]">{row.csrName}</div>
                        {row.csrCode ? <div className="text-[10px] text-gray-400">{row.csrCode}</div> : null}
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <LogIn size={12} className="text-green-500" />
                          {row.firstLoginAt ? formatSessionStamp(row.firstLoginAt, clock.tz) : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <LogOut size={12} className={row.stillOpen ? "text-amber-500" : "text-gray-400"} />
                          {row.stillOpen || !row.lastLogoutAt
                            ? "Still checked in"
                            : formatSessionStamp(row.lastLogoutAt, clock.tz)}
                        </span>
                      </td>
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
      </div>

      {editing && allowEdit && (
        <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#111827]">Adjust session times</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editing.csrName} · edit times in {EST_TZ_LABEL}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Check In</label>
                <input
                  type="datetime-local"
                  value={editCheckIn}
                  onChange={e => setEditCheckIn(e.target.value)}
                  className="w-full h-11 rounded-xl border-2 border-gray-200 px-3 text-sm outline-none focus:border-[#B8112D]"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editStillOpen}
                  onChange={e => setEditStillOpen(e.target.checked)}
                  className="rounded border-gray-300 text-[#B8112D] focus:ring-[#B8112D]"
                />
                Still checked in (no check-out)
              </label>

              {!editStillOpen && (
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Check Out</label>
                  <input
                    type="datetime-local"
                    value={editCheckOut}
                    onChange={e => setEditCheckOut(e.target.value)}
                    className="w-full h-11 rounded-xl border-2 border-gray-200 px-3 text-sm outline-none focus:border-[#B8112D]"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Note / reason</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  placeholder="admin_adjusted"
                  className="w-full h-11 rounded-xl border-2 border-gray-200 px-3 text-sm outline-none focus:border-[#B8112D]"
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={savingEdit}
                className="flex-1 h-11 rounded-xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save times"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
