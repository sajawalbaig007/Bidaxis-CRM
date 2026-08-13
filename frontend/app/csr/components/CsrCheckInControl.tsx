"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, Loader2, Pause, Play } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

type WorkSession = {
  id: string;
  checkInAt: string;
  checkInAtEst: string;
  paused?: boolean;
  pausedAt?: string | null;
  totalDuration: string;
  dashboardDuration: string;
  awayDuration: string;
  pausedDuration?: string;
};

type StatusResponse = {
  success: boolean;
  checkedIn?: boolean;
  paused?: boolean;
  created?: boolean;
  session?: WorkSession | null;
  message?: string;
};

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCheckInLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function CsrCheckInControl({ compact = false }: { compact?: boolean }) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const applyStatus = useCallback((data: StatusResponse | undefined, forceIn = false) => {
    const inNow = forceIn || !!data?.checkedIn || !!data?.session;
    setCheckedIn(inNow);
    setPaused(!!data?.paused || !!data?.session?.paused);
    setSession(data?.session ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await API.get<StatusResponse>("/csr/work-session");
      applyStatus(res.data);
    } catch {
      /* ignore — presence still works */
    } finally {
      setLoading(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    void refresh();
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ checkedIn?: boolean; paused?: boolean }>).detail;
      if (detail && typeof detail.checkedIn === "boolean") {
        setCheckedIn(detail.checkedIn);
        if (!detail.checkedIn) {
          setSession(null);
          setPaused(false);
        } else if (typeof detail.paused === "boolean") {
          setPaused(detail.paused);
        }
        return;
      }
      void refresh();
    };
    window.addEventListener("csr-checkin-changed", onChanged);
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.removeEventListener("csr-checkin-changed", onChanged);
      window.clearInterval(id);
    };
  }, [refresh]);

  /* Live elapsed timer between server polls */
  useEffect(() => {
    if (!checkedIn || !session?.checkInAt) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [checkedIn, session?.checkInAt]);

  const liveDuration =
    session?.checkInAt
      ? formatDurationMs(nowMs - new Date(session.checkInAt).getTime())
      : session?.totalDuration ?? "";

  const checkIn = async () => {
    setBusy(true);
    try {
      const res = await API.post<StatusResponse>("/csr/check-in", {});
      applyStatus(res.data, true);
      if (!res.data?.session) {
        await refresh();
      }
      toast.success(res.data.message || "Checked in.");
      window.dispatchEvent(
        new CustomEvent("csr-checkin-changed", { detail: { checkedIn: true, paused: false } }),
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Check-in failed."));
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    setBusy(true);
    try {
      const res = await API.post<StatusResponse>("/csr/check-out", {});
      setCheckedIn(false);
      setPaused(false);
      setSession(null);
      toast.success(res.data.message || "Checked out.");
      window.dispatchEvent(
        new CustomEvent("csr-checkin-changed", { detail: { checkedIn: false, paused: false } }),
      );
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Check-out failed."));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const pause = async () => {
    setBusy(true);
    try {
      const res = await API.post<StatusResponse>("/csr/pause", {});
      applyStatus(res.data, true);
      setPaused(true);
      toast.success(res.data.message || "Paused.");
      window.dispatchEvent(
        new CustomEvent("csr-checkin-changed", { detail: { checkedIn: true, paused: true } }),
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Pause failed."));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    setBusy(true);
    try {
      const res = await API.post<StatusResponse>("/csr/resume", {});
      applyStatus(res.data, true);
      setPaused(false);
      toast.success(res.data.message || "Resumed.");
      window.dispatchEvent(
        new CustomEvent("csr-checkin-changed", { detail: { checkedIn: true, paused: false } }),
      );
    } catch (err) {
      toast.error(apiErrorMessage(err, "Resume failed."));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 ${compact ? "h-9 px-2" : "h-10 px-3"} rounded-xl bg-crm-nav-pill text-crm-text-muted text-[11px] font-semibold`}>
        <Loader2 size={13} className="animate-spin" />
        <span className="hidden lg:inline">Session…</span>
      </div>
    );
  }

  if (!checkedIn) {
    return (
      <button
        type="button"
        onClick={() => void checkIn()}
        disabled={busy}
        title="Check in to start tracking work time"
        className={`inline-flex items-center gap-1.5 ${compact ? "h-9 px-2.5" : "h-10 px-3"} rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold shadow-sm shadow-emerald-500/25 disabled:opacity-60 transition-colors shrink-0`}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
        <span>Check In</span>
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 sm:gap-1.5 ${compact ? "h-9" : "h-10"} shrink-0`}>
      <div
        className={`flex items-center gap-1.5 ${compact ? "h-9 px-2" : "h-10 px-3"} rounded-xl border text-[11px] font-semibold max-w-[140px] sm:max-w-none overflow-hidden ${
          paused
            ? "bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-200/80 dark:border-amber-500/30"
            : "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/30"
        }`}
        title={
          session
            ? `On dashboard ${session.dashboardDuration} · Away ${session.awayDuration}${
                session.pausedDuration ? ` · Paused ${session.pausedDuration}` : ""
              }`
            : paused
              ? "Paused"
              : "Checked in"
        }
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            paused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
          }`}
        />
        <span className="hidden xl:inline shrink-0">{paused ? "Paused" : "In"}</span>
        {session ? (
          <span className="opacity-80 font-medium truncate tabular-nums">
            <span className="hidden xl:inline">{formatCheckInLabel(session.checkInAt)} · </span>
            {liveDuration}
          </span>
        ) : (
          <span className="truncate">{paused ? "Paused" : "Checked in"}</span>
        )}
      </div>

      {paused ? (
        <button
          type="button"
          onClick={() => void resume()}
          disabled={busy}
          title="Resume work time — back on dashboard"
          className={`inline-flex items-center gap-1 ${compact ? "h-9 px-2" : "h-10 px-3"} rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold shadow-sm shadow-emerald-500/25 disabled:opacity-60 transition-colors`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          <span className="hidden sm:inline">Resume</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void pause()}
          disabled={busy}
          title="Pause work time — leaving for WhatsApp / break"
          className={`inline-flex items-center gap-1 ${compact ? "h-9 px-2" : "h-10 px-3"} rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] sm:text-xs font-bold shadow-sm shadow-sky-500/25 disabled:opacity-60 transition-colors`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Pause size={13} />}
          <span className="hidden sm:inline">Pause</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => void checkOut()}
        disabled={busy}
        title="Check out to end your shift (logout does not check you out)"
        className={`inline-flex items-center gap-1 ${compact ? "h-9 px-2.5" : "h-10 px-3"} rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] sm:text-xs font-bold shadow-sm shadow-amber-500/25 disabled:opacity-60 transition-colors`}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
        <span className="hidden sm:inline">Check Out</span>
        <span className="sm:hidden">Out</span>
      </button>
    </div>
  );
}
