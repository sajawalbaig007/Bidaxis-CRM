"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

type WorkSession = {
  id: string;
  checkInAt: string;
  checkInAtEst: string;
  totalDuration: string;
  dashboardDuration: string;
  awayDuration: string;
};

type StatusResponse = {
  success: boolean;
  checkedIn: boolean;
  session: WorkSession | null;
  message?: string;
};

function formatSince(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function CsrCheckInControl({ compact = false }: { compact?: boolean }) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [session, setSession] = useState<WorkSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await API.get<StatusResponse>("/csr/work-session");
      setCheckedIn(!!res.data.checkedIn);
      setSession(res.data.session ?? null);
    } catch {
      /* ignore — presence still works */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const checkIn = async () => {
    setBusy(true);
    try {
      const res = await API.post<StatusResponse>("/csr/check-in", {});
      setCheckedIn(!!res.data.checkedIn);
      setSession(res.data.session ?? null);
      toast.success(res.data.message || "Checked in.");
      window.dispatchEvent(new Event("csr-checkin-changed"));
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
      setSession(null);
      toast.success(res.data.message || "Checked out.");
      window.dispatchEvent(new Event("csr-checkin-changed"));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Check-out failed."));
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
        className={`hidden sm:flex items-center gap-1.5 ${compact ? "h-9 px-2.5" : "h-10 px-3"} rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/30 text-[11px] font-semibold`}
        title={session ? `On dashboard ${session.dashboardDuration} · Away ${session.awayDuration}` : "Checked in"}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>In</span>
        {session && (
          <span className="text-emerald-600/80 dark:text-emerald-300/80 font-medium">
            {formatSince(session.checkInAt)} · {session.totalDuration}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => void checkOut()}
        disabled={busy}
        title="Check out (logout also checks out)"
        className={`inline-flex items-center gap-1 ${compact ? "h-9 px-2.5" : "h-10 px-3"} rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11px] sm:text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-500/30 disabled:opacity-60 transition-colors`}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
        <span className="hidden md:inline">Check Out</span>
        <span className="md:hidden">Out</span>
      </button>
    </div>
  );
}
