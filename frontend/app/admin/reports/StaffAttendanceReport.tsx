"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Clock, Download, LogIn, LogOut } from "lucide-react";
import API from "@/lib/api";
import { EST_TZ_ABBR, EST_TZ_LABEL } from "@/lib/estTime";

type ClockTz = "est" | "pkt";

const CLOCKS: Record<ClockTz, { tz: string; abbr: string; label: string; button: string }> = {
  est: { tz: "America/New_York", abbr: EST_TZ_ABBR, label: EST_TZ_LABEL, button: "EST" },
  pkt: { tz: "Asia/Karachi", abbr: "PKT", label: "Pakistan Time (PKT)", button: "Pakistan" },
};

const DEPTS = [
  { key: "dev", title: "Dev Check In / Check Out", person: "Dev" },
  { key: "office_boy", title: "Office Boy Check In / Check Out", person: "Office Boy" },
  { key: "hr", title: "HR Check In / Check Out", person: "HR" },
  { key: "bim_modeler", title: "BIM Modeler Check In / Check Out", person: "BIM Modeler" },
  { key: "chief_estimator", title: "Chief Estimator Check In / Check Out", person: "Chief Estimator" },
  { key: "admin", title: "Admin Check In / Check Out", person: "Admin" },
  { key: "accounts", title: "Accounts Check In / Check Out", person: "Accounts" },
] as const;

type Row = {
  id: string;
  personKey: string;
  personName: string;
  department: string;
  day: string;
  checkIn: string | null;
  checkOut: string | null;
};

function calendarYmd(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function pktInstant(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const date = new Date(`${day}T${time}:00+05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatStamp(day: string, time: string | null, tz: string): string {
  if (!time) return "—";
  const date = pktInstant(day, time);
  if (!date) return time;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

function durationLabel(day: string, checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return checkIn && !checkOut ? "Still in" : "—";
  const start = pktInstant(day, checkIn);
  const end = pktInstant(day, checkOut);
  if (!start || !end || end <= start) return "—";
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function downloadExcel(title: string, filename: string, tzLabel: string, headers: string[], body: string[][]) {
  const table = `<table border="1"><thead><tr>${headers.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead><tbody>${
    body.map((row) => `<tr>${row.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><h2>${escHtml(title)}</h2><p>All times in ${escHtml(tzLabel)}</p>${table}</body></html>`;
  const blob = new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StaffAttendanceReport() {
  const pathname = usePathname();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/attendance/report", { params: { from: "2000-01-01", to: "2100-01-01" } });
      setRows(res.data.rows ?? []);
      setLoaded(true);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onReports = pathname.startsWith("/admin") || pathname.startsWith("/manager");

  useEffect(() => {
    if (!onReports) return;
    void load();
  }, [load, onReports]);

  if (!onReports) return null;

  return (
    <div className="space-y-4">
      {DEPTS.map((dept) => (
        <DeptCard
          key={dept.key}
          title={dept.title}
          personLabel={dept.person}
          rows={rows.filter((r) => r.department === dept.key)}
          loading={loading}
          loaded={loaded}
          onRefresh={() => void load()}
        />
      ))}
    </div>
  );
}

function DeptCard({
  title,
  personLabel,
  rows,
  loading,
  loaded,
  onRefresh,
}: {
  title: string;
  personLabel: string;
  rows: Row[];
  loading: boolean;
  loaded: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [clockTz, setClockTz] = useState<ClockTz>("pkt");
  const [fromDate, setFromDate] = useState(() => calendarYmd("Asia/Karachi"));
  const [toDate, setToDate] = useState(() => calendarYmd("Asia/Karachi"));
  const [person, setPerson] = useState("all");
  const clock = CLOCKS[clockTz];

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.personKey, row.personName);
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [rows]);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (person !== "all" && row.personKey !== person) return false;
      return row.day >= fromDate && row.day <= toDate;
    });
  }, [rows, person, fromDate, toDate]);

  const applyPeriod = (key: "daily" | "weekly" | "monthly" | "all") => {
    const today = calendarYmd(clock.tz);
    if (key === "daily") {
      setFromDate(today);
      setToDate(today);
    } else if (key === "weekly") {
      setFromDate(addDays(today, -6));
      setToDate(today);
    } else if (key === "monthly") {
      setFromDate(addDays(today, -29));
      setToDate(today);
    } else {
      setFromDate("2000-01-01");
      setToDate("2100-01-01");
    }
  };

  const headers = ["Name", "Date", `Check In (${clock.abbr})`, `Check Out (${clock.abbr})`, "Total", "Status"];
  const excelBody = visible.map((row) => [
    row.personName,
    row.day,
    formatStamp(row.day, row.checkIn, clock.tz),
    row.checkOut ? formatStamp(row.day, row.checkOut, clock.tz) : "Still checked in",
    durationLabel(row.day, row.checkIn, row.checkOut),
    row.checkOut ? "Checked Out" : row.checkIn ? "Checked In" : "—",
  ]);

  return (
    <div className="rounded-[1.75rem] border border-gray-100/90 bg-white shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
            <Clock size={18} />
          </div>
          <div className="text-left min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-[#111827] truncate">{title}</h2>
            <p className="text-xs text-gray-400 truncate">
              {open ? `All times in ${clock.label}` : loaded ? `${visible.length} day${visible.length === 1 ? "" : "s"} · click to expand` : "Click to expand"}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold ${open ? "bg-gray-100 text-gray-600" : "bg-[#B8112D] text-white"}`}>
          {open ? "Collapse" : "Expand"}
          <ChevronDown size={16} className={open ? "rotate-180" : ""} />
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              ["daily", "Daily"],
              ["weekly", "Weekly"],
              ["monthly", "Monthly"],
              ["all", "All time"],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => applyPeriod(key)} className="h-8 px-3 rounded-full text-xs font-bold border border-gray-200 text-gray-600">
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-sm" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-sm" />
            {(["est", "pkt"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setClockTz(key)}
                className={`h-10 px-3 rounded-xl text-xs font-bold border ${clockTz === key ? "bg-[#B8112D] text-white border-[#B8112D]" : "bg-white text-gray-600 border-gray-200"}`}
              >
                {CLOCKS[key].button}
              </button>
            ))}
            <select value={person} onChange={(e) => setPerson(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-3 text-sm">
              <option value="all">All {personLabel}</option>
              {people.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <button type="button" onClick={onRefresh} className="h-10 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold">
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              disabled={!visible.length}
              onClick={() => downloadExcel(title, `${personLabel.toLowerCase().replace(/\s+/g, "-")}-attendance-${fromDate}-${toDate}`, clock.label, headers, excelBody)}
              className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Download size={14} /> Download Excel
            </button>
          </div>
          <p className="text-[11px] text-gray-400">{clock.label}. Saved time is shown in the clock you pick.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  {headers.map((h) => <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-gray-400">Loading…</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No check-in sessions in this date range</td></tr>
                ) : visible.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50">
                    <td className="px-3 py-3 font-semibold">{row.personName}</td>
                    <td className="px-3 py-3 tabular-nums">{row.day}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><LogIn size={12} className="text-green-500" />{formatStamp(row.day, row.checkIn, clock.tz)}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <LogOut size={12} className={row.checkOut ? "text-gray-400" : "text-amber-500"} />
                        {row.checkOut ? formatStamp(row.day, row.checkOut, clock.tz) : "Still checked in"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold">{durationLabel(row.day, row.checkIn, row.checkOut)}</td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${row.checkOut ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-700"}`}>
                        {row.checkOut ? "Checked Out" : "Checked In"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
