"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

const NINE_MS = 9 * 60 * 60 * 1000;

function pktClock(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function formatOtClock(time: string | null | undefined): string {
  if (!time) return "—";
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

export type ShiftOvertimeItem = {
  id: string;
  personKey: string;
  personName: string;
  department: string;
  day: string;
  comment: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: string;
  editedBy: string | null;
};

export function overtimeWindowText(item: Pick<ShiftOvertimeItem, "checkIn" | "checkOut" | "comment" | "status" | "editedBy"> | null): string {
  if (!item) return "—";
  const clocks = item.checkIn || item.checkOut
    ? `In ${formatOtClock(item.checkIn)} · Out ${formatOtClock(item.checkOut)}`
    : "";
  const status = item.status === "approved" ? "Approved" : item.status === "declined" ? "Declined" : item.comment || clocks ? "Pending" : "";
  const edited = item.editedBy ? `Edited by ${item.editedBy}` : "";
  return [clocks, item.comment, status, edited].filter(Boolean).join(" · ") || "No overtime";
}

export default function OvertimeShiftButton({ compact = false, since }: { compact?: boolean; since?: string }) {
  const [gate, setGate] = useState({ allowed: false, weekend: false, shiftMs: 0, open: false, at: Date.now() });
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
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
    load();
    const id = window.setInterval(load, 15_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
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
  const shiftLabel = (() => {
    const total = Math.max(0, Math.floor(liveMs / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();
  const btn = compact ? "h-9 px-2.5 text-xs" : "h-10 px-3 text-sm";

  const openForm = () => {
    setCheckIn(pktClock());
    setCheckOut("");
    setForm(true);
  };

  const apply = async () => {
    if (busy) return;
    if (!/^\d{2}:\d{2}$/.test(checkIn) || !/^\d{2}:\d{2}$/.test(checkOut)) {
      toast.error("Enter overtime check-in and check-out.");
      return;
    }
    setBusy(true);
    try {
      await API.post("/attendance/overtime", { checkIn, checkOut });
      setForm(false);
      toast.success("Overtime sent.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send overtime."));
    } finally {
      setBusy(false);
    }
  };

  if (form) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <label className="text-[10px] font-bold text-[#92400E]">
          In
          <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="ml-1 h-9 rounded-lg border border-amber-200 bg-white px-2 text-xs text-[#111827]" />
        </label>
        <label className="text-[10px] font-bold text-[#92400E]">
          Out
          <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="ml-1 h-9 rounded-lg border border-amber-200 bg-white px-2 text-xs text-[#111827]" />
        </label>
        <button type="button" onClick={() => void apply()} disabled={busy} className={`${btn} rounded-xl bg-[#0F172A] text-white font-semibold disabled:opacity-40`}>
          {busy ? "Sending…" : "Apply"}
        </button>
        <button type="button" onClick={() => setForm(false)} disabled={busy} className={`${btn} rounded-xl bg-gray-100 text-gray-600 font-semibold`}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={!ready}
      title={ready ? "Apply overtime with check-in and check-out" : `Weekday overtime opens after a 9 hour shift. This shift is ${shiftLabel}.`}
      onClick={openForm}
      className={`${btn} rounded-xl font-semibold inline-flex items-center gap-1 disabled:opacity-40 touch-manipulation bg-[#FEF3C7] text-[#92400E]`}
    >
      <Clock size={compact ? 14 : 15} />
      Apply
    </button>
  );
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
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [busy, setBusy] = useState(false);
  if (!item && !(canReview && draft)) return <span className="text-xs text-gray-300">—</span>;

  const openEdit = () => {
    setCheckIn(item?.checkIn || "");
    setCheckOut(item?.checkOut || "");
    setEditing(true);
  };

  const review = async (action: "approve" | "decline") => {
    if (!item) return;
    setBusy(true);
    try {
      await API.put(`/attendance/overtime/${item.id}`, { action });
      toast.success(action === "approve" ? "Approved." : "Declined.");
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update overtime."));
    } finally {
      setBusy(false);
    }
  };

  const saveTime = async () => {
    if (!/^\d{2}:\d{2}$/.test(checkIn) || !/^\d{2}:\d{2}$/.test(checkOut)) {
      toast.error("Enter overtime check-in and check-out.");
      return;
    }
    setBusy(true);
    try {
      if (item) {
        await API.put(`/attendance/overtime/${item.id}`, { action: "edit", checkIn, checkOut });
        toast.success("Time updated.");
      } else if (draft) {
        await API.post("/attendance/overtime/estimator", { ...draft, checkIn, checkOut });
        toast.success("Overtime saved.");
      }
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update overtime."));
    } finally {
      setBusy(false);
    }
  };

  const note = item?.comment?.split("\n").slice(1).join("\n").trim();

  return (
    <div className="min-w-[168px]">
      {item?.checkIn || item?.checkOut ? (
        <div className="text-xs font-semibold text-[#111827] leading-5">
          <p>In {formatOtClock(item.checkIn)}</p>
          <p>Out {formatOtClock(item.checkOut)}</p>
        </div>
      ) : (
        <p className="text-xs font-semibold text-[#111827] whitespace-pre-wrap">{item?.comment || "No overtime"}</p>
      )}
      {item?.checkIn || item?.checkOut ? (
        <p className="text-[11px] text-gray-500">{item.comment.split("\n")[0]}</p>
      ) : null}
      {note ? <p className="text-[11px] text-gray-500 whitespace-pre-wrap">{note}</p> : null}
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
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-8 rounded-lg border border-gray-200 px-2 text-xs" />
          <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-8 rounded-lg border border-gray-200 px-2 text-xs" />
          <button type="button" disabled={busy} onClick={() => void saveTime()} className="h-8 px-2 rounded-lg bg-[#B8112D] text-white text-[10px] font-bold">Save</button>
        </div>
      ) : null}
    </div>
  );
}
