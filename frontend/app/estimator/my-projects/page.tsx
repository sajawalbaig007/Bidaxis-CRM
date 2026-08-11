"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, Calendar, Check, Clock3, Play, Pause, Lock, RefreshCw,
} from "lucide-react";
import EstimatorPageShell from "../components/EstimatorPageShell";
import CommentCell from "@/app/csr/components/shared/CommentCell";
import { NoteEntry } from "@/app/csr/hooks/useLeadsData";
import {
  CsrColGroup,
  CSR_THEAD,
} from "@/app/csr/components/shared/csrTableStyles";
import {
  ProjectDetailCell,
  PROJECT_TABLE_CARD,
  PROJECT_TABLE_HEAD,
} from "@/app/components/projects/ProjectTableCells";
import CapsuleTabs from "@/app/components/CapsuleTabs";
import API from "@/lib/api";
import {
  projectReceiveDate,
  formatElapsed,
  canCompleteAfterTimer,
  MIN_COMPLETE_TIMER_SECONDS,
  parseTechnicalNotes,
  type TechnicalAssignment,
} from "@/lib/technicalAssignments";

type Project = {
  id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  state: string | null;
  ownerName: string | null;
  interestedService: string | null;
  projectTitle: string | null;
  projectCode: string | null;
  clientCode?: string | null;
  projectScope: string | null;
  projectPhase: string | null;
  projectDeadline: string | null;
  projectNotes: string | null;
  projectPayments: string | null;
  technicalReceivedAt?: string | null;
  technicalNotes?: string | null;
  createdAt?: string;
  updatedAt: string;
  myAssignment?: TechnicalAssignment;
  notes?: { id: string; text: string; createdAt: string }[];
};

type FilterTab = "all" | "pending" | "done";

const PAGE_SIZE = 30;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.split("T")[0] || "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function notesToHistory(notes?: { id: string; text: string; createdAt: string }[]): NoteEntry[] {
  return (notes ?? []).map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt }));
}

function projectAsRow(p: Project) {
  return {
    id: p.id,
    name: p.name,
    company: p.company,
    ownerName: p.ownerName,
    phone: p.phone,
    email: p.email,
    projectCode: p.projectCode,
    clientCode: p.clientCode,
    projectTitle: p.projectTitle,
    projectScope: p.projectScope,
    interestedService: p.interestedService,
    projectBudget: null as string | null,
    projectDeadline: p.projectDeadline,
    projectPhase: p.projectPhase,
    projectPayments: p.projectPayments,
    state: p.state,
  };
}

function TimerControls({
  p,
  elapsed,
  running,
  busy,
  onTimer,
  onComplete,
}: {
  p: Project;
  elapsed: number;
  running: boolean;
  busy: boolean;
  onTimer: (id: string, action: "start" | "pause") => void;
  onComplete: (id: string) => void;
}) {
  const a = p.myAssignment;
  const done = !!a?.takeoffDone;
  const canComplete = canCompleteAfterTimer(elapsed);
  const waitLeft = Math.max(0, MIN_COMPLETE_TIMER_SECONDS - Math.floor(elapsed));

  if (done) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-bold tabular-nums text-emerald-700">{formatElapsed(elapsed)}</p>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold">
          <Lock size={10} /> Completed
        </span>
        <p className="text-[9px] text-gray-400 leading-snug">Locked — Miss can reopen if needed</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 min-w-0">
      <p className={`text-sm font-bold tabular-nums ${running ? "text-[#7C3AED]" : "text-gray-700"}`}>
        {formatElapsed(elapsed)}
        {running ? <span className="ml-1 text-[9px] font-semibold uppercase text-[#7C3AED]">Live</span> : null}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {running ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onTimer(p.id, "pause")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-[10px] font-bold hover:bg-amber-200 disabled:opacity-50"
          >
            <Pause size={11} /> Pause
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onTimer(p.id, "start")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#7C3AED] text-white text-[10px] font-bold hover:bg-[#6d28d9] disabled:opacity-50"
          >
            <Play size={11} /> Start
          </button>
        )}
        <button
          type="button"
          disabled={busy || !canComplete}
          onClick={() => onComplete(p.id)}
          title={
            canComplete
              ? "Mark complete"
              : `Start timer — Complete unlocks after ${MIN_COMPLETE_TIMER_SECONDS}s (${waitLeft}s left)`
          }
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={11} /> Complete
          {!canComplete ? (
            <span className="tabular-nums opacity-90">{waitLeft}s</span>
          ) : null}
        </button>
      </div>
      {!canComplete ? (
        <p className="text-[9px] text-gray-400 leading-snug">
          {running || elapsed > 0
            ? `Complete unlocks in ${waitLeft}s`
            : `Start timer — Complete after ${MIN_COMPLETE_TIMER_SECONDS}s`}
        </p>
      ) : null}
    </div>
  );
}

/** Client-anchored live clock — avoids jumps from server/client clock skew. */
type LiveClock = {
  projectId: string;
  baseSeconds: number;
  startedAtMs: number;
};

function liveElapsed(clock: LiveClock, now: number): number {
  return clock.baseSeconds + Math.max(0, Math.floor((now - clock.startedAtMs) / 1000));
}

export default function EstimatorMyProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [liveClock, setLiveClock] = useState<LiveClock | null>(null);
  const busyRef = useRef<string | null>(null);
  const liveClockRef = useRef<LiveClock | null>(null);
  const projectsRef = useRef<Project[]>([]);
  projectsRef.current = projects;
  liveClockRef.current = liveClock;

  const anyRunning =
    !!liveClock ||
    projects.some((p) => !!p.myAssignment?.timerStartedAt && !p.myAssignment?.takeoffDone);

  useEffect(() => {
    if (!anyRunning) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [anyRunning]);

  // Re-anchor after refresh/poll if server says running but we have no live clock
  useEffect(() => {
    if (liveClockRef.current) return;
    const running = projects.find(
      (p) => !!p.myAssignment?.timerStartedAt && !p.myAssignment?.takeoffDone,
    );
    if (!running?.myAssignment) return;
    const base = running.myAssignment.timerSeconds ?? 0;
    setLiveClock({
      projectId: running.id,
      baseSeconds: base,
      startedAtMs: Date.now(),
    });
  }, [projects]);

  const getElapsed = useCallback(
    (p: Project) => {
      const a = p.myAssignment;
      if (!a) return 0;
      if (liveClock && liveClock.projectId === p.id) {
        return liveElapsed(liveClock, now);
      }
      // Paused / completed — never use server timerStartedAt (skew)
      return Math.max(0, a.timerSeconds ?? 0);
    },
    [liveClock, now],
  );

  const fetchProjects = useCallback(async (mode: "initial" | "manual" | "silent" = "silent") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "manual") setRefreshing(true);
      const res = await API.get("/estimator/projects");
      if (busyRef.current) return;
      const leads = (res.data.leads ?? []) as Project[];
      const clock = liveClockRef.current;
      setProjects(
        leads.map((lead) => {
          if (!clock || lead.id !== clock.projectId || !lead.myAssignment) return lead;
          // Keep running flag; display stays on client clock
          return {
            ...lead,
            myAssignment: {
              ...lead.myAssignment,
              timerSeconds: clock.baseSeconds,
              timerStartedAt: lead.myAssignment.timerStartedAt
                ? new Date(clock.startedAtMs).toISOString()
                : null,
            },
          };
        }),
      );
      // If server paused this project, drop live clock
      if (clock) {
        const mine = leads.find((l) => l.id === clock.projectId);
        if (!mine?.myAssignment?.timerStartedAt || mine.myAssignment.takeoffDone) {
          setLiveClock(null);
        }
      }
    } catch {
      if (mode !== "silent") toast.error("Failed to load projects");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects("initial");
  }, [fetchProjects]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (busyRef.current) return;
      void fetchProjects("silent");
    }, 8000);
    const onFocus = () => {
      if (busyRef.current) return;
      void fetchProjects("silent");
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchProjects]);

  const applyLead = (lead: Project, opts?: { keepLive?: boolean; pausedSeconds?: number }) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === lead.id);
      if (!exists) return [lead, ...prev];
      return prev.map((p) => {
        if (p.id !== lead.id) return p;
        if (opts?.pausedSeconds != null && lead.myAssignment) {
          return {
            ...p,
            ...lead,
            myAssignment: {
              ...lead.myAssignment,
              timerSeconds: opts.pausedSeconds,
              timerStartedAt: null,
            },
          };
        }
        if (opts?.keepLive && liveClockRef.current?.projectId === lead.id && lead.myAssignment) {
          const clock = liveClockRef.current;
          return {
            ...p,
            ...lead,
            myAssignment: {
              ...lead.myAssignment,
              timerSeconds: clock.baseSeconds,
              timerStartedAt: new Date(clock.startedAtMs).toISOString(),
            },
          };
        }
        return { ...p, ...lead };
      });
    });
  };

  const addTechnicalNote = async (id: string, text: string) => {
    const res = await API.post(`/estimator/lead/${id}/notes`, { text });
    const note = res.data.note as { id: string; text: string; createdAt: string };
    const list = res.data.technicalNotes as { id: string; text: string; createdAt: string }[] | undefined;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              technicalNotes: list
                ? JSON.stringify(list)
                : JSON.stringify([...parseTechnicalNotes(p.technicalNotes), note]),
            }
          : p,
      ),
    );
    return { id: note.id, text: note.text, createdAt: note.createdAt } as NoteEntry;
  };

  const runTimer = async (projectId: string, action: "start" | "pause") => {
    if (busyRef.current) return;
    const current = projectsRef.current.find((p) => p.id === projectId);
    if (!current?.myAssignment || current.myAssignment.takeoffDone) return;

    const tick = Date.now();
    const pauseProjectIds =
      action === "start"
        ? projectsRef.current
            .filter(
              (p) =>
                p.id !== projectId &&
                ((!p.myAssignment?.takeoffDone && !!p.myAssignment?.timerStartedAt) ||
                  liveClockRef.current?.projectId === p.id),
            )
            .map((p) => p.id)
        : [];

    busyRef.current = projectId;
    setBusyId(projectId);
    setNow(tick);

    let pausedSeconds: number | undefined;

    if (action === "start") {
      const base = current.myAssignment.timerSeconds ?? 0;
      const prevClock = liveClockRef.current;
      const clock = { projectId, baseSeconds: base, startedAtMs: tick };
      setLiveClock(clock);
      liveClockRef.current = clock;
      setProjects((prev) =>
        prev.map((p) => {
          if (!p.myAssignment || p.myAssignment.takeoffDone) return p;
          if (p.id === projectId) {
            return {
              ...p,
              myAssignment: {
                ...p.myAssignment,
                timerSeconds: base,
                timerStartedAt: new Date(tick).toISOString(),
              },
            };
          }
          const otherLive = prevClock?.projectId === p.id ? prevClock : null;
          if (otherLive || p.myAssignment.timerStartedAt) {
            const secs = otherLive
              ? liveElapsed(otherLive, tick)
              : Math.max(0, p.myAssignment.timerSeconds ?? 0);
            return {
              ...p,
              myAssignment: {
                ...p.myAssignment,
                timerSeconds: secs,
                timerStartedAt: null,
              },
            };
          }
          return p;
        }),
      );
    } else {
      const clock = liveClockRef.current?.projectId === projectId ? liveClockRef.current : null;
      pausedSeconds = clock
        ? liveElapsed(clock, tick)
        : current.myAssignment.timerSeconds ?? 0;
      setLiveClock(null);
      liveClockRef.current = null;
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId || !p.myAssignment) return p;
          return {
            ...p,
            myAssignment: {
              ...p.myAssignment,
              timerSeconds: pausedSeconds!,
              timerStartedAt: null,
            },
          };
        }),
      );
    }

    try {
      const res = await API.put(`/estimator/project/${projectId}/timer`, {
        action,
        pauseProjectIds,
        // Client elapsed so server stores the same seconds (no clock-skew jump)
        clientElapsedSeconds: action === "pause" ? pausedSeconds : undefined,
      });
      if (action === "start") {
        applyLead(res.data.lead as Project, { keepLive: true });
      } else {
        applyLead(res.data.lead as Project, { pausedSeconds });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update timer";
      toast.error(msg);
      setLiveClock(null);
      liveClockRef.current = null;
      void fetchProjects("silent");
    } finally {
      busyRef.current = null;
      setBusyId(null);
    }
  };

  const completeTask = async (projectId: string) => {
    if (busyRef.current) return;
    busyRef.current = projectId;
    setBusyId(projectId);
    const toastId = toast.loading("Completing task…");
    const tick = Date.now();
    const clock = liveClockRef.current?.projectId === projectId ? liveClockRef.current : null;
    const finalSeconds = clock
      ? liveElapsed(clock, tick)
      : projectsRef.current.find((p) => p.id === projectId)?.myAssignment?.timerSeconds ?? 0;
    setLiveClock(null);
    liveClockRef.current = null;
    try {
      const res = await API.put(`/estimator/project/${projectId}/complete`, {
        clientElapsedSeconds: finalSeconds,
      });
      applyLead(res.data.lead as Project, { pausedSeconds: finalSeconds });
      toast.success("Task completed — locked. Miss can reopen if needed.", { id: toastId });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to complete task";
      toast.error(msg, { id: toastId });
      void fetchProjects("silent");
    } finally {
      busyRef.current = null;
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => {
      const done = !!p.myAssignment?.takeoffDone;
      if (tab === "pending" && done) return false;
      if (tab === "done" && !done) return false;
      if (!q) return true;
      return (
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.projectTitle ?? "").toLowerCase().includes(q) ||
        (p.projectCode ?? "").toLowerCase().includes(q) ||
        (p.clientCode ?? "").toLowerCase().includes(q) ||
        (p.projectScope ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, search, tab]);

  const counts = useMemo(() => ({
    all: projects.length,
    pending: projects.filter((p) => !p.myAssignment?.takeoffDone).length,
    done: projects.filter((p) => !!p.myAssignment?.takeoffDone).length,
  }), [projects]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const headers = [
    "Project Details",
    "Receive",
    "Deadline",
    "Bid Instruction",
    "Notes for Sir",
    "Work Detail",
    "Hours",
    "Timer / Task",
  ];

  return (
    <EstimatorPageShell bgClass="bg-[#F5F6FA] dark:bg-crm-bg" className="p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 overflow-x-hidden">
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }} />
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-crm-text">My Projects</h1>
            <p className="text-xs sm:text-sm text-crm-text-muted mt-0.5">
              Start / Pause timer · Complete task (locked after complete — only Miss can reopen)
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchProjects("manual")}
            disabled={refreshing || loading}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-crm-border bg-crm-surface text-xs sm:text-sm font-semibold text-crm-text-secondary inline-flex items-center justify-center gap-2 hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-60 shadow-sm w-fit"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing || loading ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <CapsuleTabs
          className="mb-4"
          accent="#7C3AED"
          activeKey={tab}
          onChange={(key) => { setTab(key); setPage(1); }}
          tabs={[
            { key: "all", label: "All", count: counts.all, icon: FolderKanban },
            { key: "pending", label: "Pending", count: counts.pending, icon: Clock3 },
            { key: "done", label: "Completed", count: counts.done, icon: Check },
          ]}
        />

        <div className="relative mb-4 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search code, title, scope..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-crm-surface border border-crm-border rounded-xl sm:rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-crm-text outline-none focus:border-[#7C3AED]"
          />
        </div>

        <div className="lg:hidden space-y-3">
          {loading && projects.length === 0 ? (
            <div className="bg-crm-surface rounded-2xl border border-crm-border-subtle p-10 text-center">
              <RefreshCw size={22} className="text-[#7C3AED] mx-auto mb-2 animate-spin" />
              <p className="text-crm-text-muted text-sm font-medium">Loading projects…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="bg-crm-surface rounded-2xl border border-crm-border-subtle p-10 text-center">
              <FolderKanban size={32} className="text-crm-text-faint mx-auto mb-3 opacity-40" />
              <p className="text-crm-text-faint font-medium text-sm">No projects found</p>
            </div>
          ) : (
            paginated.map((p) => (
              <div key={p.id} className="bg-crm-surface rounded-2xl border border-crm-border-subtle p-4 shadow-sm space-y-3">
                <ProjectDetailCell p={projectAsRow(p)} />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Receive</p>
                    <p className="font-semibold text-gray-700">{formatDate(projectReceiveDate(p))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">My Deadline</p>
                    <p className="font-semibold text-gray-700">
                      {formatDate(p.myAssignment?.deadline || p.projectDeadline)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Bid Instruction</p>
                  <CommentCell
                    id={p.id}
                    apiRole="estimator"
                    readOnly
                    skipNotesFetch
                    comment={p.projectNotes ?? undefined}
                    noteHistory={notesToHistory(p.notes)}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Notes for Sir</p>
                  <CommentCell
                    id={p.id}
                    apiRole="estimator"
                    skipNotesFetch
                    noteHistory={notesToHistory(parseTechnicalNotes(p.technicalNotes))}
                    onAddNote={addTechnicalNote}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Work Detail</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-snug">
                    {p.myAssignment?.workDetail?.trim() || "—"}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3 pt-1 border-t border-gray-50">
                  <span className="text-xs font-semibold text-[#7C3AED]">
                    {p.myAssignment?.manHours ? `${p.myAssignment.manHours}h` : "Hours —"}
                  </span>
                  <TimerControls
                    p={p}
                    elapsed={getElapsed(p)}
                    running={
                      liveClock?.projectId === p.id ||
                      (!!p.myAssignment?.timerStartedAt && !p.myAssignment?.takeoffDone)
                    }
                    busy={busyId === p.id}
                    onTimer={(id, action) => void runTimer(id, action)}
                    onComplete={(id) => void completeTask(id)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className={`hidden lg:block ${PROJECT_TABLE_CARD}`}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse" style={{ minWidth: "1280px" }}>
              <CsrColGroup widths={["18%", "9%", "9%", "12%", "12%", "12%", "7%", "21%"] as const} />
              <thead className={CSR_THEAD}>
                <tr className="text-left">
                  {headers.map((h, i) => (
                    <th key={i} className={`px-3 xl:px-4 py-3 xl:py-4 whitespace-nowrap ${PROJECT_TABLE_HEAD}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && projects.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} className="py-16 text-center">
                      <RefreshCw size={22} className="text-[#7C3AED] mx-auto mb-2 animate-spin" />
                      <p className="text-gray-500 text-sm font-medium">Loading projects…</p>
                    </td>
                  </tr>
                ) : paginated.length > 0 ? (
                  paginated.map((p) => (
                    <tr key={p.id} className="border-b border-crm-border-subtle hover:bg-crm-surface-muted transition-all align-top">
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <ProjectDetailCell p={projectAsRow(p)} />
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <p className="text-[10px] xl:text-xs font-semibold text-gray-700 flex items-center gap-1">
                          <Calendar size={10} className="text-[#7C3AED] shrink-0" />
                          {formatDate(projectReceiveDate(p))}
                        </p>
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <p className="text-[10px] xl:text-xs font-semibold text-gray-700">
                          {formatDate(p.myAssignment?.deadline || p.projectDeadline)}
                        </p>
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <CommentCell
                          id={p.id}
                          apiRole="estimator"
                          readOnly
                          skipNotesFetch
                          comment={p.projectNotes ?? undefined}
                          noteHistory={notesToHistory(p.notes)}
                        />
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <CommentCell
                          id={p.id}
                          apiRole="estimator"
                          skipNotesFetch
                          noteHistory={notesToHistory(parseTechnicalNotes(p.technicalNotes))}
                          onAddNote={addTechnicalNote}
                        />
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <p className="text-[11px] text-gray-700 whitespace-pre-wrap leading-snug line-clamp-4">
                          {p.myAssignment?.workDetail?.trim() || "—"}
                        </p>
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <span className="text-xs font-bold text-[#7C3AED]">
                          {p.myAssignment?.manHours ? `${p.myAssignment.manHours}h` : "—"}
                        </span>
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <TimerControls
                          p={p}
                          elapsed={getElapsed(p)}
                          running={
                            liveClock?.projectId === p.id ||
                            (!!p.myAssignment?.timerStartedAt && !p.myAssignment?.takeoffDone)
                          }
                          busy={busyId === p.id}
                          onTimer={(id, action) => void runTimer(id, action)}
                          onComplete={(id) => void completeTask(id)}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={headers.length} className="py-16 text-center">
                      <FolderKanban size={36} className="text-gray-200 mx-auto mb-3" />
                      <p className="font-semibold text-gray-400 text-sm">No projects found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
    </EstimatorPageShell>
  );
}
