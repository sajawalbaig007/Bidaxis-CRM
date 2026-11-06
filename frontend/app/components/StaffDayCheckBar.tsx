"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, Pause, Play } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import ShiftHistoryButton from "@/app/components/ShiftHistoryButton";
import StaffRequestButton from "@/app/components/StaffRequestButton";
import OvertimeShiftButton from "@/app/components/OvertimeShiftButton";

type Row = { checkIn: string | null; checkOut: string | null; day: string; paused?: boolean; pausedMinutes?: number };

function formatClock(time: string | null | undefined): string {
  if (!time) return "—";
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

export default function StaffDayCheckBar({
  defaultVisible = false,
  compact = false,
  showOvertime = false,
  chiefDashboard = false,
}: {
  defaultVisible?: boolean;
  compact?: boolean;
  showOvertime?: boolean;
  chiefDashboard?: boolean;
}) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [row, setRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(defaultVisible);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/attendance/mine", chiefDashboard ? { params: { dashboard: "chief" } } : undefined);
      setName(res.data.name || "");
      setDepartment(res.data.department || "");
      setRow(res.data.row ?? null);
      setVisible(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (defaultVisible) setVisible(true);
      else if (status === 401 || status === 403) setVisible(false);
    }
  }, [chiefDashboard, defaultVisible]);

  useEffect(() => {
    void load();
  }, [load]);

  const punch = async (action: "in" | "out" | "pause" | "resume") => {
    setBusy(true);
    try {
      await API.post("/attendance/mine/punch", { action, ...(chiefDashboard ? { dashboard: "chief" } : {}) });
      toast.success(action === "pause" ? "Paused." : action === "resume" ? "Resumed." : "Saved.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  const shiftStart = (() => {
    if (!row?.day || !row.checkIn || row.checkOut) return undefined;
    const at = new Date(`${row.day}T${row.checkIn}:00+05:00`);
    return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
  })();
  const overtime = showOvertime || department === "chief_estimator"
    ? <OvertimeShiftButton compact={compact} since={shiftStart} />
    : null;
  const checkedOut = Boolean(row?.checkIn && row?.checkOut);
  const canCheckInAgain = department === "chief_estimator" && checkedOut;
  const inDisabled = busy || (Boolean(row?.checkIn) && !canCheckInAgain);
  /* Chief Estimator: pause when leaving the office, resume from home. Break time is not worked time. */
  const canPause = department === "chief_estimator" && Boolean(row?.checkIn) && !row?.checkOut;
  const pauseButton = (small: boolean) => department === "chief_estimator" ? (
    <button
      type="button"
      disabled={busy || !canPause}
      onClick={() => void punch(row?.paused ? "resume" : "pause")}
      title={row?.pausedMinutes ? `Break so far: ${Math.floor(row.pausedMinutes / 60)}h ${row.pausedMinutes % 60}m` : "Pause the shift when you leave; resume when you start again"}
      className={`${small ? "h-9 px-2.5 text-xs" : "h-10 px-3 text-sm"} rounded-xl font-semibold inline-flex items-center gap-1 disabled:opacity-60 touch-manipulation ${row?.paused ? "bg-[#0F766E] text-white" : "bg-amber-100 text-amber-800"}`}
    >
      {row?.paused ? <Play size={small ? 13 : 14} fill="currentColor" /> : <Pause size={small ? 13 : 14} fill="currentColor" />}
      {row?.paused ? "Resume" : "Pause"}
    </button>
  ) : null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 w-full min-w-0 [&>*]:shrink-0">
        <span className="text-[11px] font-semibold text-crm-text-muted tabular-nums whitespace-nowrap">
          {formatClock(row?.checkIn)} – {formatClock(row?.checkOut)}
        </span>
        <button
          type="button"
          disabled={inDisabled}
          onClick={() => void punch("in")}
          className="h-9 px-2.5 rounded-xl bg-[#0F766E] text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60 touch-manipulation"
        >
          <LogIn size={14} /> {row?.checkIn && !canCheckInAgain ? "In" : "Check in"}
        </button>
        {pauseButton(true)}
        <button
          type="button"
          disabled={busy || !row?.checkIn || Boolean(row?.checkOut)}
          onClick={() => void punch("out")}
          className="h-9 px-2.5 rounded-xl bg-[#0F398A] text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60 touch-manipulation"
        >
          <LogOut size={14} /> {row?.checkOut ? "Out" : "Check out"}
        </button>
        <ShiftHistoryButton url="/attendance/mine/history" params={chiefDashboard ? { dashboard: "chief" } : undefined} compact />
        <StaffRequestButton compact mode={department === "admin" || department === "accounts" ? "evening" : "pkt"} dashboard={chiefDashboard ? "chief" : undefined} />
        {overtime}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-100 dark:border-crm-border bg-white dark:bg-crm-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F398A]">Today</p>
        {department === "admin" || department === "accounts" ? (
          <p className="text-[10px] text-gray-500 dark:text-crm-text-muted">5:00 PM to next day 5:00 PM, Pakistan time</p>
        ) : null}
        <p className="text-sm font-semibold text-[#0F172A] dark:text-crm-text">
          {name ? `${name} · ` : ""}
          In {formatClock(row?.checkIn)} · Out {formatClock(row?.checkOut)}
          {row?.paused ? <span className="ml-1 text-amber-700"> · Paused</span> : null}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={inDisabled}
          onClick={() => void punch("in")}
          className="h-10 px-3 rounded-xl bg-[#0F766E] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 touch-manipulation"
        >
          <LogIn size={15} /> {row?.checkIn && !canCheckInAgain ? "Checked in" : "Check in"}
        </button>
        {pauseButton(false)}
        <button
          type="button"
          disabled={busy || !row?.checkIn || Boolean(row?.checkOut)}
          onClick={() => void punch("out")}
          className="h-10 px-3 rounded-xl bg-[#0F398A] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 touch-manipulation"
        >
          <LogOut size={15} /> {row?.checkOut ? "Checked out" : "Check out"}
        </button>
        <ShiftHistoryButton url="/attendance/mine/history" />
        <StaffRequestButton mode={department === "admin" || department === "accounts" ? "evening" : "pkt"} dashboard={chiefDashboard ? "chief" : undefined} />
        {overtime}
      </div>
    </section>
  );
}
