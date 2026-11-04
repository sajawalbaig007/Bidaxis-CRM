"use client";

import { useEffect, useState } from "react";
import { Play, Plus, Square } from "lucide-react";
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

function pktToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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

export type OvertimeSession = { startAt: string; endAt: string | null; reason: string; manual?: boolean; hoursOnly?: boolean; fromRequest?: boolean };

export type ShiftOvertimeItem = {
  id: string;
  personKey: string;
  personName: string;
  department: string;
  day: string;
  comment: string;
  checkIn?: string | null;
  checkOut?: string | null;
  /** Start / Stop sessions, oldest first. */
  sessions?: OvertimeSession[];
  status: string;
  editedBy: string | null;
};

function sessionClock(iso: string | null): string {
  return iso ? formatOtClock(pktClock(new Date(iso))) : "running";
}

function sessionLength(session: OvertimeSession, now = Date.now()): string {
  const end = session.endAt ? Date.parse(session.endAt) : now;
  const total = Math.max(0, Math.round((end - Date.parse(session.startAt)) / 60_000));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

/** Each Start / Stop with its reason — latest on top, earlier ones behind "+n". The total is the day's sum. */
export function OvertimeSessionList({ sessions, total }: { sessions: OvertimeSession[]; total?: string }) {
  const [open, setOpen] = useState(false);
  if (!sessions.length) return null;
  const latestFirst = [...sessions].reverse();
  const shown = open ? latestFirst : latestFirst.slice(0, 1);
  const hidden = latestFirst.length - 1;
  return (
    <div className="space-y-1">
      {shown.map((session) => (
        <div key={session.startAt} className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-4 text-[#111827]">
          <p className="font-semibold">
            {session.hoursOnly
              ? <>{sessionLength(session)} <span className="font-normal text-gray-500">(hours)</span></>
              : <>{sessionClock(session.startAt)} – {sessionClock(session.endAt)}
                <span className="ml-1 font-normal text-gray-500">({sessionLength(session)})</span></>}
            {session.manual ? <span className="ml-1 rounded bg-white px-1 text-[9px] font-bold uppercase text-amber-700">{session.fromRequest ? "Request approved" : "Added by hand"}</span> : null}
          </p>
          {session.reason ? <p className="text-gray-600 whitespace-pre-wrap">{session.reason}</p> : null}
        </div>
      ))}
      <div className="flex items-center gap-2">
        {hidden > 0 ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="h-6 rounded-md bg-gray-100 px-2 text-[10px] font-bold text-gray-700">
            {open ? "Hide" : `+${hidden}`}
          </button>
        ) : null}
        {total ? <span className="text-[11px] font-bold text-[#92400E]">Total {total}</span> : null}
      </div>
    </div>
  );
}

export function overtimeWindowText(item: Pick<ShiftOvertimeItem, "checkIn" | "checkOut" | "comment" | "status" | "editedBy"> | null): string {
  if (!item) return "—";
  const clocks = item.checkIn || item.checkOut
    ? `In ${formatOtClock(item.checkIn)} · Out ${formatOtClock(item.checkOut)}`
    : "";
  const status = item.status === "approved" ? "Approved" : item.status === "declined" ? "Declined" : item.comment || clocks ? "Pending" : "";
  const edited = item.editedBy ? `Edited by ${item.editedBy}` : "";
  return [clocks, item.comment, status, edited].filter(Boolean).join(" · ") || "No overtime";
}

type MineState = { running: OvertimeSession | null; sessions: OvertimeSession[]; status: string | null };

export default function OvertimeShiftButton({ compact = false, since }: { compact?: boolean; since?: string }) {
  const [gate, setGate] = useState({ allowed: false, weekend: false, shiftMs: 0, open: false, at: Date.now() });
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState(false);
  const [reason, setReason] = useState("");
  const [mine, setMine] = useState<MineState>({ running: null, sessions: [], status: null });
  const [busy, setBusy] = useState(false);
  /** Overtime typed in by hand: date, then hours or In / Out, and the reason. */
  const [manual, setManual] = useState<{ day: string; hours: string; checkIn: string; checkOut: string; reason: string } | null>(null);

  const applyMine = (data: Partial<MineState> | undefined) => {
    setMine({ running: data?.running ?? null, sessions: data?.sessions ?? [], status: data?.status ?? null });
  };

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
      API.get("/attendance/overtime/mine")
        .then((res) => { if (!stop) applyMine(res.data); })
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

  const start = async () => {
    if (busy) return;
    if (!reason.trim()) {
      toast.error("Write the reason for overtime first.");
      return;
    }
    setBusy(true);
    try {
      const res = await API.post("/attendance/overtime/start", { reason: reason.trim() });
      applyMine(res.data);
      setForm(false);
      setReason("");
      toast.success("Overtime started.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not start overtime."));
    } finally {
      setBusy(false);
    }
  };

  const stopOvertime = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await API.post("/attendance/overtime/stop");
      applyMine(res.data);
      toast.success("Overtime stopped and sent for approval.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not stop overtime."));
    } finally {
      setBusy(false);
    }
  };

  const saveManual = async () => {
    if (busy || !manual) return;
    const byHours = manual.hours.trim() !== "";
    if (!manual.day || (!byHours && (!/^d{2}:d{2}$/.test(manual.checkIn) || !/^d{2}:d{2}$/.test(manual.checkOut)))) {
      toast.error("Pick the date, then enter the hours or the In and Out time.");
      return;
    }
    if (!manual.reason.trim()) {
      toast.error("Write the reason for overtime.");
      return;
    }
    setBusy(true);
    try {
      const res = await API.post("/attendance/overtime/manual", {
        day: manual.day,
        reason: manual.reason.trim(),
        ...(byHours ? { hours: manual.hours.trim() } : { checkIn: manual.checkIn, checkOut: manual.checkOut }),
      });
      applyMine(res.data);
      setManual(null);
      toast.success(res.data?.message || "Overtime sent for approval.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add overtime."));
    } finally {
      setBusy(false);
    }
  };

  if (manual) {
    const input = "h-9 rounded-lg border border-amber-200 bg-white px-2 text-xs text-[#111827]";
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <input type="date" value={manual.day} max={pktToday()} onChange={(e) => setManual({ ...manual, day: e.target.value })} className={input} />
        <label className="text-[10px] font-bold text-[#92400E]">
          Hours <input type="number" min="0.1" max="16" step="0.25" inputMode="decimal" value={manual.hours} placeholder="2.5" onChange={(e) => setManual({ ...manual, hours: e.target.value })} className={`${input} w-16`} />
        </label>
        <span className="text-[10px] font-bold text-gray-400">or</span>
        <label className="text-[10px] font-bold text-[#92400E]">
          In <input type="time" value={manual.checkIn} onChange={(e) => setManual({ ...manual, checkIn: e.target.value })} className={input} />
        </label>
        <label className="text-[10px] font-bold text-[#92400E]">
          Out <input type="time" value={manual.checkOut} onChange={(e) => setManual({ ...manual, checkOut: e.target.value })} className={input} />
        </label>
        <input
          value={manual.reason}
          onChange={(e) => setManual({ ...manual, reason: e.target.value })}
          maxLength={300}
          placeholder="Reason for overtime"
          className={`${input} w-44`}
        />
        <button type="button" onClick={() => void saveManual()} disabled={busy} className={`${btn} rounded-xl bg-[#0F172A] text-white font-semibold disabled:opacity-40`}>
          {busy ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={() => setManual(null)} disabled={busy} className={`${btn} rounded-xl bg-gray-100 text-gray-600 font-semibold`}>
          Cancel
        </button>
      </span>
    );
  }

  const addButton = (
    <button
      type="button"
      onClick={() => setManual({ day: pktToday(), hours: "", checkIn: "", checkOut: "", reason: "" })}
      title="Add overtime by hand — date, In, Out and the reason"
      className={`${btn} rounded-xl font-semibold inline-flex items-center gap-1 touch-manipulation border border-amber-200 bg-white text-[#92400E]`}
    >
      <Plus size={compact ? 13 : 14} /> Add OT
    </button>
  );

  if (mine.running) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => void stopOvertime()}
        disabled={busy}
        title={`Overtime started ${sessionClock(mine.running.startAt)} — ${mine.running.reason}`}
        className={`${btn} rounded-xl font-semibold inline-flex items-center gap-1 disabled:opacity-40 touch-manipulation bg-[#B8112D] text-white`}
      >
        <Square size={compact ? 12 : 13} fill="currentColor" />
        {busy ? "Stopping…" : `Stop OT · ${sessionLength(mine.running, now)}`}
      </button>
      {addButton}
      </span>
    );
  }

  if (form) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void start(); }}
          maxLength={300}
          placeholder="Reason for overtime"
          className="h-9 w-48 rounded-lg border border-amber-200 bg-white px-2 text-xs text-[#111827]"
        />
        <button type="button" onClick={() => void start()} disabled={busy || !reason.trim()} className={`${btn} rounded-xl bg-[#0F172A] text-white font-semibold disabled:opacity-40`}>
          {busy ? "Starting…" : "Start"}
        </button>
        <button type="button" onClick={() => setForm(false)} disabled={busy} className={`${btn} rounded-xl bg-gray-100 text-gray-600 font-semibold`}>
          Cancel
        </button>
      </span>
    );
  }

  const done = mine.sessions.filter((session) => session.endAt).length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
    <button
      type="button"
      disabled={!ready}
      title={ready
        ? done ? `Start another overtime. ${done} already today (${mine.status ?? "pending"}).` : "Start overtime — you will be asked for the reason"
        : `Weekday overtime opens after a 9 hour shift. This shift is ${shiftLabel}.`}
      onClick={() => setForm(true)}
      className={`${btn} rounded-xl font-semibold inline-flex items-center gap-1 disabled:opacity-40 touch-manipulation bg-[#FEF3C7] text-[#92400E]`}
    >
      <Play size={compact ? 13 : 14} fill="currentColor" />
      Start OT{done ? ` (${done})` : ""}
    </button>
    {addButton}
    </span>
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
  /* A reviewer's time edit replaces the session total, so then the edited In / Out is shown instead. */
  const sessions = item && !item.editedBy ? item.sessions ?? [] : [];

  return (
    <div className="min-w-[168px]">
      {sessions.length ? (
        <OvertimeSessionList sessions={sessions} total={item?.comment.split("\n")[0]} />
      ) : item?.checkIn || item?.checkOut ? (
        <div className="text-xs font-semibold text-[#111827] leading-5">
          <p>In {formatOtClock(item.checkIn)}</p>
          <p>Out {formatOtClock(item.checkOut)}</p>
        </div>
      ) : (
        <p className="text-xs font-semibold text-[#111827] whitespace-pre-wrap">{item?.comment || "No overtime"}</p>
      )}
      {!sessions.length && (item?.checkIn || item?.checkOut) ? (
        <p className="text-[11px] text-gray-500">{item?.comment.split("\n")[0]}</p>
      ) : null}
      {note && !sessions.length ? <p className="text-[11px] text-gray-500 whitespace-pre-wrap">{note}</p> : null}
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
