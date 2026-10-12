"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

const NINE_MS = 9 * 60 * 60 * 1000;
const MAX_MINUTES = 12 * 60;
const FIFTY_HOURS_MS = 50 * 60 * 60 * 1000;
const TIMER_KEY = "overtime_timer_start";

type TimerState = { accumulatedMs: number; segmentStart: number | null };

function elapsedMs(state: TimerState, now = Date.now()): number {
  return state.accumulatedMs + (state.segmentStart != null ? Math.max(0, now - state.segmentStart) : 0);
}

function readTimer(): TimerState | null {
  try {
    const raw = sessionStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    let state: TimerState | null = null;
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as TimerState;
      const accumulatedMs = Number(parsed.accumulatedMs) || 0;
      const segmentStart = parsed.segmentStart != null && Number(parsed.segmentStart) > 0 ? Number(parsed.segmentStart) : null;
      if (accumulatedMs > 0 || segmentStart != null) state = { accumulatedMs, segmentStart };
    } else {
      const n = Number(raw);
      if (n > 0) state = { accumulatedMs: 0, segmentStart: n };
    }
    if (!state || elapsedMs(state) >= FIFTY_HOURS_MS) {
      sessionStorage.removeItem(TIMER_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function writeTimer(state: TimerState | null) {
  try {
    if (!state) sessionStorage.removeItem(TIMER_KEY);
    else sessionStorage.setItem(TIMER_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export type ShiftOvertimeItem = {
  id: string;
  personKey: string;
  personName: string;
  department: string;
  day: string;
  comment: string;
  status: string;
  editedBy: string | null;
};

export default function OvertimeShiftButton({ compact = false, since }: { compact?: boolean; since?: string }) {
  const [gate, setGate] = useState({ allowed: false, weekend: false, shiftMs: 0, open: false, at: Date.now() });
  const [now, setNow] = useState(Date.now());
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () => {
      API.get("/attendance/overtime/gate")
        .then((res) => {
          if (stop) return;
          setGate({
            allowed: !!res.data.allowed,
            weekend: !!res.data.weekend,
            shiftMs: Number(res.data.shiftMs) || 0,
            open: !!res.data.open,
            at: Date.now(),
          });
        })
        .catch(() => {});
    };
    setTimer(readTimer());
    load();
    const id = window.setInterval(load, 15_000);
    const tick = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      setTimer((current) => {
        if (!current || elapsedMs(current, at) < FIFTY_HOURS_MS) return current;
        writeTimer(null);
        return null;
      });
    }, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, []);

  const sinceMs = since ? new Date(since).getTime() : 0;
  const fromCheckIn = Number.isFinite(sinceMs) && sinceMs > 0 ? Math.max(0, now - sinceMs) : 0;
  const liveMs = Math.max(gate.shiftMs + (gate.open ? Math.max(0, now - gate.at) : 0), fromCheckIn);
  const ready = gate.allowed || gate.weekend || liveMs >= NINE_MS;
  const running = timer?.segmentStart != null;
  const paused = timer != null && !running;
  const elapsed = timer ? elapsedMs(timer, now) : 0;
  const shiftLabel = formatTimer(liveMs);
  const waiting = !ready && !running && !paused && liveMs > 0;
  const btn = compact ? "h-9 px-2.5 text-xs" : "h-10 px-3 text-sm";

  const saveTimer = (next: TimerState | null) => {
    setTimer(next);
    writeTimer(next);
  };

  const start = () => {
    saveTimer({ accumulatedMs: 0, segmentStart: Date.now() });
  };

  const pause = () => {
    if (!timer?.segmentStart) return;
    saveTimer({
      accumulatedMs: timer.accumulatedMs + Math.max(0, Date.now() - timer.segmentStart),
      segmentStart: null,
    });
  };

  const resume = () => {
    if (!timer || timer.segmentStart != null) return;
    saveTimer({ accumulatedMs: timer.accumulatedMs, segmentStart: Date.now() });
  };

  const stop = async () => {
    if (!timer || busy) return;
    const ms = elapsedMs(timer);
    if (ms >= FIFTY_HOURS_MS) {
      saveTimer(null);
      toast.success("Overtime past 50 hours was cleared.");
      return;
    }
    const rawMinutes = Math.max(1, Math.round(ms / 60000));
    const capped = rawMinutes > MAX_MINUTES;
    const minutes = capped ? MAX_MINUTES : rawMinutes;
    setBusy(true);
    try {
      await API.post("/attendance/overtime", { minutes });
      saveTimer(null);
      toast.success(capped ? "Overtime sent. It is capped at 12 hours." : "Overtime sent.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send overtime."));
    } finally {
      setBusy(false);
    }
  };

  if (running || paused) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`${btn} rounded-xl bg-[#B8112D] text-white font-semibold inline-flex items-center gap-1 tabular-nums`}>
          <Clock size={compact ? 14 : 15} />
          {formatTimer(elapsed)}
        </span>
        {running ? (
          <button type="button" onClick={pause} disabled={busy} className={`${btn} rounded-xl bg-[#FEF3C7] text-[#92400E] font-semibold disabled:opacity-40 touch-manipulation`}>
            Pause
          </button>
        ) : (
          <button type="button" onClick={resume} disabled={busy} className={`${btn} rounded-xl bg-[#FEF3C7] text-[#92400E] font-semibold disabled:opacity-40 touch-manipulation`}>
            Resume
          </button>
        )}
        <button type="button" onClick={() => void stop()} disabled={busy} className={`${btn} rounded-xl bg-[#0F172A] text-white font-semibold disabled:opacity-40 touch-manipulation`}>
          {busy ? "Saving…" : "Stop"}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={!ready}
      title={ready ? "Start overtime" : `Weekday overtime opens after a 9 hour shift. This shift is ${shiftLabel}.`}
      onClick={start}
      className={`${btn} rounded-xl font-semibold inline-flex items-center gap-1 disabled:opacity-40 touch-manipulation bg-[#FEF3C7] text-[#92400E]`}
    >
      <Clock size={compact ? 14 : 15} />
      {waiting ? formatTimer(NINE_MS - liveMs) : "Start"}
    </button>
  );
}

function splitOvertime(comment: string): { hours: string; mins: string } {
  const match = /(\d+)\s*h\s*(\d+)\s*m/i.exec(comment);
  if (!match) return { hours: "1", mins: "0" };
  return { hours: String(Number(match[1])), mins: String(Number(match[2])) };
}

export function OvertimeShiftCell({
  item,
  canReview,
  onChanged,
  draft,
}: {
  item: ShiftOvertimeItem | null;
  canReview: boolean;
  onChanged: () => void;
  draft?: { personKey: string; personName: string; day: string };
}) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState("1");
  const [mins, setMins] = useState("0");
  const [busy, setBusy] = useState(false);
  if (!item && !(canReview && draft)) return <span className="text-xs text-gray-300">—</span>;

  const openEdit = () => {
    const parsed = splitOvertime(item?.comment ?? "");
    setHours(parsed.hours);
    setMins(parsed.mins);
    setEditing(true);
  };

  const review = async (action: "approve" | "decline" | "edit", minutes?: number) => {
    if (!item) return;
    setBusy(true);
    try {
      await API.put(`/attendance/overtime/${item.id}`, { action, ...(minutes != null ? { minutes } : {}) });
      toast.success(action === "approve" ? "Approved." : action === "decline" ? "Declined." : "Time updated.");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update overtime."));
    } finally {
      setBusy(false);
    }
  };

  const saveTime = async () => {
    const minutes = Number(hours) * 60 + Number(mins);
    if (!Number.isFinite(minutes) || minutes < 1) {
      toast.error("Enter the overtime time.");
      return;
    }
    if (item) {
      await review("edit", minutes);
      return;
    }
    if (!draft) return;
    setBusy(true);
    try {
      await API.post("/attendance/overtime/estimator", { ...draft, minutes });
      toast.success("Overtime saved.");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update overtime."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-[168px]">
      <p className="text-xs font-semibold text-[#111827] whitespace-pre-wrap">{item?.comment || "No overtime"}</p>
      {item ? (
        <p className={`text-[10px] font-bold uppercase tracking-wide ${
          item.status === "approved" ? "text-green-700" : item.status === "declined" ? "text-red-600" : "text-amber-600"
        }`}>
          {item.status}{item.editedBy ? ` · ${item.editedBy}` : ""}
        </p>
      ) : null}
      {canReview ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item?.status === "pending" ? (
            <>
              <button type="button" disabled={busy} onClick={() => void review("approve")} className="h-7 px-2 rounded-lg bg-green-600 text-white text-[10px] font-bold disabled:opacity-50">Approve</button>
              <button type="button" disabled={busy} onClick={() => void review("decline")} className="h-7 px-2 rounded-lg bg-red-600 text-white text-[10px] font-bold disabled:opacity-50">Decline</button>
            </>
          ) : null}
          <button type="button" disabled={busy} onClick={openEdit} className="h-7 px-2 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold">Edit</button>
        </div>
      ) : null}
      {editing ? (
        <div className="mt-2 flex items-center gap-1">
          <input type="number" min={0} max={12} value={hours} onChange={(e) => setHours(e.target.value)} className="w-14 h-8 rounded-lg border border-gray-200 px-2 text-xs" />
          <span className="text-[10px] text-gray-400">h</span>
          <input type="number" min={0} max={59} value={mins} onChange={(e) => setMins(e.target.value)} className="w-14 h-8 rounded-lg border border-gray-200 px-2 text-xs" />
          <button type="button" disabled={busy} onClick={() => void saveTime()} className="h-8 px-2 rounded-lg bg-[#B8112D] text-white text-[10px] font-bold">Save</button>
        </div>
      ) : null}
    </div>
  );
}
