"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban, CheckCircle2, Clock3, AlertTriangle,
  ArrowRight, RefreshCw, Star, Trophy,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts";
import EstimatorPageShell from "./components/EstimatorPageShell";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { CSR_THEAD } from "@/app/csr/components/shared/csrTableStyles";
import { PROJECT_TABLE_HEAD } from "@/app/components/projects/ProjectTableCells";
import API from "@/lib/api";
import { fetchMyPreviousMonthRating, starsDisplay, type EstimatorMonthRating } from "@/lib/estimatorPreviousMonthRating";

type RecentRow = {
  id: string;
  projectTitle?: string | null;
  projectCode?: string | null;
  projectDeadline?: string | null;
  projectPhase?: string | null;
  myAssignment?: {
    manHours: string;
    deadline: string;
    takeoffDone: boolean;
  };
};

type Stats = {
  total: number;
  pending: number;
  takeoffDone: number;
  overdue: number;
};

export default function EstimatorDashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, takeoffDone: 0, overdue: 0 });
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevRating, setPrevRating] = useState<EstimatorMonthRating | null>(null);
  const [prevMonthLabel, setPrevMonthLabel] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [dashRes, ratingRes] = await Promise.all([
        API.get("/estimator/dashboard"),
        fetchMyPreviousMonthRating().catch(() => null),
      ]);
      setStats(dashRes.data?.stats ?? { total: 0, pending: 0, takeoffDone: 0, overdue: 0 });
      setRecent(Array.isArray(dashRes.data?.recent) ? dashRes.data.recent : []);
      if (ratingRes?.success) {
        setPrevRating(ratingRes.rating);
        setPrevMonthLabel(ratingRes.monthLabel);
      } else {
        setPrevRating(null);
        setPrevMonthLabel("");
      }
    } catch {
      setStats({ total: 0, pending: 0, takeoffDone: 0, overdue: 0 });
      setRecent([]);
      setPrevRating(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const statusPie = useMemo(() => {
    const pendingOnTrack = Math.max(0, stats.pending - stats.overdue);
    return [
      { name: "Pending", value: pendingOnTrack, color: "#D97706" },
      { name: "Overdue", value: stats.overdue, color: "#B8112D" },
      { name: "Takeoff done", value: stats.takeoffDone, color: "#059669" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const workloadBar = useMemo(
    () =>
      [
        { name: "Assigned", count: stats.total, fill: "#7C3AED" },
        { name: "Pending", count: stats.pending, fill: "#D97706" },
        { name: "Done", count: stats.takeoffDone, fill: "#059669" },
        { name: "Overdue", count: stats.overdue, fill: "#B8112D" },
      ].filter((d) => d.count > 0),
    [stats],
  );

  const cards = [
    { label: "Assigned", value: stats.total, icon: FolderKanban, from: "from-[#7C3AED]", to: "to-[#5B21B6]", bar: "70%" },
    { label: "Pending", value: stats.pending, icon: Clock3, from: "from-[#D97706]", to: "to-[#B45309]", bar: "55%" },
    { label: "Takeoff Done", value: stats.takeoffDone, icon: CheckCircle2, from: "from-[#059669]", to: "to-[#047857]", bar: "80%" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, from: "from-[#B8112D]", to: "to-[#8b0d22]", bar: "35%" },
  ];

  return (
    <EstimatorPageShell>
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-crm-text tracking-tight">
                Estimator Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-crm-text-muted mt-0.5 sm:mt-1">
                Your assigned projects · takeoff · deadlines
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-crm-border bg-crm-surface text-sm font-semibold text-crm-text-secondary inline-flex items-center justify-center gap-2 hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-60 shadow-sm w-full sm:w-auto shrink-0"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing…" : "Refresh stats"}
            </button>
          </header>

          {prevRating ? (
            <section className="rounded-2xl sm:rounded-3xl border border-violet-200 dark:border-violet-500/30 bg-gradient-to-br from-violet-50 via-white to-amber-50/40 dark:from-violet-500/10 dark:via-crm-surface dark:to-amber-500/10 p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                    <Trophy size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">
                      {prevMonthLabel} — your rating
                    </p>
                    <p className="text-sm sm:text-base font-bold text-crm-text mt-0.5">
                      Shown all month on your dashboard
                    </p>
                    {prevRating.remarks ? (
                      <p className="text-xs text-crm-text-secondary mt-1 line-clamp-2">{prevRating.remarks}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Marks</p>
                    <p className="text-2xl font-extrabold text-violet-700 tabular-nums">
                      {prevRating.marks || "—"}
                      <span className="text-sm text-gray-400">/10</span>
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Stars</p>
                    <p className="text-lg text-amber-500 tracking-wide flex items-center gap-1">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      {starsDisplay(prevRating.stars)}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section aria-label="Quick stats">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              {cards.map(c => (
                <div
                  key={c.label}
                  className={`bg-gradient-to-br ${c.from} ${c.to} rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md flex flex-col gap-2 sm:gap-2.5 min-h-[96px] sm:min-h-[108px]`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white/75 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider leading-snug">
                      {c.label}
                    </span>
                    <span className="w-6 h-6 sm:w-7 sm:h-7 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                      <c.icon size={15} />
                    </span>
                  </div>
                  {loading ? (
                    <div className="h-7 sm:h-8 w-12 sm:w-14 bg-white/25 rounded-lg animate-pulse" />
                  ) : (
                    <span className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-none tabular-nums">
                      {c.value.toLocaleString()}
                    </span>
                  )}
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-auto">
                    <div className="h-full bg-white/60 rounded-full" style={{ width: c.bar }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-crm-surface rounded-2xl sm:rounded-3xl shadow-sm border border-crm-border-subtle p-4 sm:p-5">
              <h2 className="font-bold text-crm-text text-sm sm:text-base">Assignment mix</h2>
              <p className="text-[11px] sm:text-xs text-crm-text-faint mt-0.5 mb-3">Pending · overdue · takeoff done</p>
              {loading ? (
                <div className="h-[200px] bg-crm-border-subtle/40 rounded-2xl animate-pulse" />
              ) : statusPie.length === 0 ? (
                <p className="text-sm text-crm-text-faint text-center py-16">No assignments yet</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <RechartsBox height={180} className="sm:w-[180px] shrink-0">
                    <PieChart>
                      <Pie
                        data={statusPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={68}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {statusPie.map((s) => (
                          <Cell key={s.name} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                        formatter={(value) => [`${value} projects`, ""]}
                      />
                    </PieChart>
                  </RechartsBox>
                  <div className="flex-1 w-full grid gap-2">
                    {statusPie.map((s) => (
                      <div key={s.name} className="flex items-center gap-3 bg-[#FAFAFA] dark:bg-black/20 rounded-xl px-3 py-2.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <p className="flex-1 text-xs sm:text-sm font-medium text-crm-text-secondary">{s.name}</p>
                        <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-crm-surface rounded-2xl sm:rounded-3xl shadow-sm border border-crm-border-subtle p-4 sm:p-5">
              <h2 className="font-bold text-crm-text text-sm sm:text-base">Workload snapshot</h2>
              <p className="text-[11px] sm:text-xs text-crm-text-faint mt-0.5 mb-3">Your assigned pipeline at a glance</p>
              {loading ? (
                <div className="h-[200px] bg-crm-border-subtle/40 rounded-2xl animate-pulse" />
              ) : workloadBar.length === 0 ? (
                <p className="text-sm text-crm-text-faint text-center py-16">No workload data yet</p>
              ) : (
                <RechartsBox height={200}>
                  <BarChart data={workloadBar} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                      cursor={{ fill: "rgba(124,58,237,0.06)" }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {workloadBar.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </RechartsBox>
              )}
            </div>
          </section>

          <Link
            href="/estimator/my-projects"
            className="group bg-crm-surface rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-crm-border-subtle hover:border-[#7C3AED]/30 hover:shadow-md transition-all flex items-start justify-between gap-3"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/15 text-[#7C3AED] flex items-center justify-center mb-3">
                <FolderKanban size={18} />
              </div>
              <h3 className="font-bold text-crm-text text-sm sm:text-base">My Projects</h3>
              <p className="text-[11px] sm:text-xs text-crm-text-faint mt-0.5">
                Open assigned work — man hours, deadlines & takeoff status
              </p>
            </div>
            <ArrowRight size={16} className="text-crm-text-faint group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </Link>

          <section className="bg-crm-surface rounded-2xl sm:rounded-3xl shadow-sm border border-crm-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-crm-border-subtle">
              <div>
                <h2 className="font-bold text-crm-text text-sm sm:text-base">Recent Assignments</h2>
                <p className="text-[11px] sm:text-xs text-crm-text-faint mt-0.5">Latest projects assigned to you</p>
              </div>
              <Link href="/estimator/my-projects" className="text-xs sm:text-sm font-semibold text-[#7C3AED] hover:underline">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className={CSR_THEAD}>
                  <tr>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Code</th>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Project</th>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Hours</th>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Deadline</th>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3, 4].map(i => (
                      <tr key={i} className="border-t border-gray-50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                        </td>
                      </tr>
                    ))
                  ) : recent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-crm-text-faint font-medium">
                        No assignments yet — technical will assign projects to you.
                      </td>
                    </tr>
                  ) : (
                    recent.map(p => (
                      <tr key={p.id} className="border-t border-crm-border-subtle hover:bg-violet-50/40 dark:hover:bg-violet-500/10">
                        <td className="px-4 py-3 text-xs font-semibold text-[#7C3AED] whitespace-nowrap">
                          {p.projectCode || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-crm-text truncate max-w-[220px]">
                          {p.projectTitle || "Untitled"}
                        </td>
                        <td className="px-4 py-3 text-xs text-crm-text-secondary whitespace-nowrap">
                          {p.myAssignment?.manHours ? `${p.myAssignment.manHours}h` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-crm-text-secondary whitespace-nowrap">
                          {p.myAssignment?.deadline
                            ? new Date(p.myAssignment.deadline).toLocaleDateString()
                            : p.projectDeadline
                              ? new Date(p.projectDeadline).toLocaleDateString()
                              : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.myAssignment?.takeoffDone ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                              DONE
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">
                              PENDING
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
    </EstimatorPageShell>
  );
}
