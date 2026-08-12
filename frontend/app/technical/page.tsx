"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban, CheckCircle2, Clock3, AlertTriangle,
  ArrowRight, BarChart3, Users, GitBranch, RefreshCw, FileText, Trophy,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts";
import TechnicalPageShell from "./components/TechnicalPageShell";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { CSR_THEAD } from "@/app/csr/components/shared/csrTableStyles";
import { PROJECT_TABLE_HEAD } from "@/app/components/projects/ProjectTableCells";
import API from "@/lib/api";
import {
  fetchPreviousMonthRatings,
  starsDisplay,
  topPerformers,
  type EstimatorMonthRating,
} from "@/lib/estimatorPreviousMonthRating";

type ProjectRow = {
  id: string;
  projectTitle?: string | null;
  projectCode?: string | null;
  company?: string | null;
  name?: string | null;
  projectPhase?: string | null;
  projectDeadline?: string | null;
  status?: string;
  updatedAt?: string;
};

function isDelivered(p: ProjectRow) {
  const phase = (p.projectPhase ?? "").toLowerCase();
  return phase.includes("deliver") || phase.includes("complete") || phase.includes("closed");
}

function isOverdue(p: ProjectRow) {
  if (!p.projectDeadline || isDelivered(p)) return false;
  const d = new Date(p.projectDeadline);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export default function TechnicalDashboardPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [top5, setTop5] = useState<EstimatorMonthRating[]>([]);
  const [prevMonthLabel, setPrevMonthLabel] = useState("");
  const [ratingsLoading, setRatingsLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setRatingsLoading(true);
    try {
      const [projRes, ratingsRes] = await Promise.all([
        API.get("/admin/projects", { params: { limit: 100, technicalView: "1", excludeRevisions: "1" } }),
        fetchPreviousMonthRatings().catch(() => null),
      ]);
      const rows = projRes.data?.leads ?? projRes.data?.projects ?? [];
      setProjects(Array.isArray(rows) ? (rows as ProjectRow[]) : []);
      if (ratingsRes?.success) {
        setTop5(topPerformers(ratingsRes.ratings, 5));
        setPrevMonthLabel(ratingsRes.monthLabel);
      } else {
        setTop5([]);
        setPrevMonthLabel("");
      }
    } catch {
      setProjects([]);
      setTop5([]);
    } finally {
      setLoading(false);
      setRatingsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const active = projects.filter(p => !isDelivered(p));
    const delivered = projects.filter(isDelivered);
    const overdue = projects.filter(isOverdue);
    return {
      total: projects.length,
      active: active.length,
      delivered: delivered.length,
      overdue: overdue.length,
    };
  }, [projects]);

  const statusPie = useMemo(() => {
    const onTrack = Math.max(0, stats.active - stats.overdue);
    return [
      { name: "On track", value: onTrack, color: "#D97706" },
      { name: "Overdue", value: stats.overdue, color: "#B8112D" },
      { name: "Delivered", value: stats.delivered, color: "#059669" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const phaseBar = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      const raw = (p.projectPhase ?? "not_started").toLowerCase();
      const label =
        raw.includes("deliver") || raw.includes("qa")
          ? "Final / Delivery"
          : raw.includes("pricing")
            ? "Pricing"
            : raw.includes("takeoff")
              ? "Takeoff"
              : raw.includes("assign") || raw === "in_progress"
                ? "In progress"
                : "Not started";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const order = ["Not started", "In progress", "Takeoff", "Pricing", "Final / Delivery"];
    return order
      .filter((name) => (counts.get(name) ?? 0) > 0)
      .map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [projects]);

  const recent = useMemo(
    () => [...projects]
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
      .slice(0, 8),
    [projects],
  );

  const cards = [
    { label: "Total Projects", value: stats.total, icon: FolderKanban, from: "from-[#0B84F3]", to: "to-[#0369A1]", bar: "70%" },
    { label: "Active", value: stats.active, icon: Clock3, from: "from-[#D97706]", to: "to-[#B45309]", bar: "55%" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle2, from: "from-[#059669]", to: "to-[#047857]", bar: "80%" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, from: "from-[#B8112D]", to: "to-[#8b0d22]", bar: "35%" },
  ];

  const modules = [
    { title: "Active Projects", desc: "Same project DB as Admin — live from admin data", href: "/technical/active-projects", icon: FolderKanban },
    { title: "KPI Dashboard", desc: "Pipeline health, completion rates & estimator scores", href: "/technical/kpi", icon: BarChart3 },
    { title: "Team Monitoring", desc: "Live workload, timers, deadlines & monthly KPI snapshot", href: "/technical/team", icon: Users },
    { title: "Revision Monitoring", desc: "Construction, as-built, take-off, pricing", href: "/technical/revisions", icon: GitBranch },
    { title: "Reports", desc: "Monthly KPI export, charts & Save to Word", href: "/technical/reports", icon: FileText },
  ];

  return (
    <TechnicalPageShell>
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">

          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-crm-text tracking-tight">
                Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-crm-text-muted mt-0.5 sm:mt-1">
                Project overview · active work · deadlines
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-crm-border bg-crm-surface text-sm font-semibold text-crm-text-secondary inline-flex items-center justify-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF6F7] dark:hover:bg-crm-brand-soft disabled:opacity-60 shadow-sm w-full sm:w-auto shrink-0"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing…" : "Refresh stats"}
            </button>
          </header>

          <section aria-label="Quick stats">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              {cards.map(c => (
                <div
                  key={c.label}
                  className={`bg-gradient-to-br ${c.from} ${c.to} rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md flex flex-col gap-2 sm:gap-2.5 min-h-[96px] sm:min-h-[108px]`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white/75 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider leading-snug line-clamp-2">
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
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-5">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Project mix</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 mb-3">On track · overdue · delivered</p>
              {loading ? (
                <div className="h-[200px] bg-gray-50 rounded-2xl animate-pulse" />
              ) : statusPie.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-16">No project data yet</p>
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
                      <div key={s.name} className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl px-3 py-2.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <p className="flex-1 text-xs sm:text-sm font-medium text-gray-600">{s.name}</p>
                        <span className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-5">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">By workflow stage</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 mb-3">Count of projects in each stage</p>
              {loading ? (
                <div className="h-[200px] bg-gray-50 rounded-2xl animate-pulse" />
              ) : phaseBar.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-16">No phase data yet</p>
              ) : (
                <RechartsBox height={200}>
                  <BarChart data={phaseBar} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                      cursor={{ fill: "#FFF1F3" }}
                    />
                    <Bar dataKey="count" fill="#B8112D" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </RechartsBox>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-[#FFFBEB] to-white">
              <div>
                <h2 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" />
                  Top 5 Performers
                </h2>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                  {prevMonthLabel ? `${prevMonthLabel} rating` : "Previous month KPI marks & stars"}
                </p>
              </div>
              <Link href="/technical/kpi" className="text-xs sm:text-sm font-semibold text-[#B8112D] hover:underline">
                KPI Dashboard
              </Link>
            </div>
            <div className="p-4 sm:p-5">
              {ratingsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : top5.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No previous month ratings yet — auto-fill KPI at month end.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {top5.map((e, idx) => (
                    <div
                      key={e.estimatorId}
                      className={`rounded-2xl border p-4 flex flex-col gap-2 ${
                        idx === 0
                          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100"
                          : "border-gray-100 bg-[#FAFBFC]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold ${
                            idx === 0 ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                          {e.marks ? `${e.marks}/10` : "—"}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[#0F172A] truncate">{e.name}</p>
                        <p className="text-[10px] text-gray-400">{e.code}</p>
                      </div>
                      <p className="text-amber-600 text-sm tracking-wide">{starsDisplay(e.stars)}</p>
                      {e.delivered ? (
                        <p className="text-[10px] text-gray-500">{e.delivered} delivered</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {modules.map(m => (
              <Link
                key={m.href}
                href={m.href}
                className="group bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 hover:border-[#B8112D]/30 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                    <m.icon size={18} />
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-[#B8112D] group-hover:translate-x-0.5 transition-all" />
                </div>
                <h3 className="mt-3 font-bold text-gray-800 text-sm sm:text-base">{m.title}</h3>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">{m.desc}</p>
              </Link>
            ))}
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">Recent Active Projects</h2>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Latest updates from Project DB</p>
              </div>
              <Link href="/technical/active-projects" className="text-xs sm:text-sm font-semibold text-[#B8112D] hover:underline">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className={CSR_THEAD}>
                  <tr>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Code</th>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Project</th>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Phase</th>
                    <th className={`px-4 py-2.5 font-semibold ${PROJECT_TABLE_HEAD}`}>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3, 4].map(i => (
                      <tr key={i} className="border-t border-gray-50">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                        </td>
                      </tr>
                    ))
                  ) : recent.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400 font-medium">
                        No projects yet — they appear here from Admin Project DB.
                      </td>
                    </tr>
                  ) : (
                    recent.map(p => (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-[#FFF8F9]">
                        <td className="px-4 py-3 text-xs font-semibold text-[#B8112D] whitespace-nowrap">
                          {p.projectCode || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#0F172A] truncate max-w-[220px]">
                          {p.projectTitle || p.name || "Untitled"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {p.projectPhase || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {p.projectDeadline
                            ? new Date(p.projectDeadline).toLocaleDateString()
                            : "—"}
                          {isOverdue(p) && (
                            <span className="ml-2 text-[10px] font-bold text-[#B8112D]">OVERDUE</span>
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
    </TechnicalPageShell>
  );
}
