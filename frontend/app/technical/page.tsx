"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban, CheckCircle2, Clock3, AlertTriangle,
  ArrowRight, BarChart3, Users, GitBranch, RefreshCw,
} from "lucide-react";
import TechnicalSidebar from "./components/layout/Sidebar";
import API from "@/lib/api";

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

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/projects", { params: { limit: 100 } });
      const rows = res.data?.leads ?? res.data?.projects ?? [];
      setProjects(Array.isArray(rows) ? (rows as ProjectRow[]) : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
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
    { title: "KPI Dashboard", desc: "Productivity, evaluation & scores (coming next)", href: "/technical/kpi", icon: BarChart3 },
    { title: "Team Monitoring", desc: "Team leads & estimator workload (coming next)", href: "/technical/team", icon: Users },
    { title: "Revision Monitoring", desc: "Construction, as-built, take-off, pricing", href: "/technical/revisions", icon: GitBranch },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <TechnicalSidebar />

      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">

          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">
                Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                Project overview · active work · deadlines
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF6F7] disabled:opacity-60 shadow-sm w-full sm:w-auto shrink-0"
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
                <thead className="bg-[#FAFAFA] text-[11px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Code</th>
                    <th className="px-4 py-2.5 font-semibold">Project</th>
                    <th className="px-4 py-2.5 font-semibold">Phase</th>
                    <th className="px-4 py-2.5 font-semibold">Deadline</th>
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
      </main>
    </div>
  );
}
