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

export default function TechnicalOverviewPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/projects", { params: { limit: 500 } });
      setProjects((res.data.projects ?? res.data ?? []) as ProjectRow[]);
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
    { label: "Total Projects", value: stats.total, icon: FolderKanban, color: "text-[#0B84F3]", bg: "bg-[#EAF5FF]" },
    { label: "Active", value: stats.active, icon: Clock3, color: "text-[#D97706]", bg: "bg-[#FFF4E5]" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "text-[#15803D]", bg: "bg-[#ECFDF5]" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-[#B8112D]", bg: "bg-[#FFF1F3]" },
  ];

  const modules = [
    { title: "Active Projects", desc: "Same project DB as Admin — live from admin data", href: "/technical/active-projects", icon: FolderKanban },
    { title: "KPI Dashboard", desc: "Productivity, evaluation & scores (coming next)", href: "/technical/kpi", icon: BarChart3 },
    { title: "Team Monitoring", desc: "Team leads & estimator workload (coming next)", href: "/technical/team", icon: Users },
    { title: "Revision Monitoring", desc: "Construction, as-built, take-off, pricing", href: "/technical/revisions", icon: GitBranch },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6FA] dark:bg-gray-950">
      <TechnicalSidebar />
      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#0F172A] dark:text-gray-100">
              Technical Manager Overview
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Project data comes directly from Admin Active Projects.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white dark:bg-crm-surface border border-gray-200 dark:border-crm-border text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-[#B8112D]/40"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {cards.map(c => (
            <div
              key={c.label}
              className="rounded-2xl bg-white dark:bg-crm-surface border border-gray-100 dark:border-crm-border p-4 shadow-sm"
            >
              <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.color} flex items-center justify-center mb-3`}>
                <c.icon size={16} />
              </div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-bold text-[#0F172A] dark:text-gray-100 mt-1">
                {loading ? "—" : c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {modules.map(m => (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-2xl bg-white dark:bg-crm-surface border border-gray-100 dark:border-crm-border p-5 shadow-sm hover:border-[#B8112D]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                  <m.icon size={18} />
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-[#B8112D] group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="mt-3 text-base font-bold text-[#0F172A] dark:text-gray-100">{m.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl bg-white dark:bg-crm-surface border border-gray-100 dark:border-crm-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-crm-border">
            <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-gray-100">Recent Active Projects</h2>
            <Link href="/technical/active-projects" className="text-xs font-semibold text-[#B8112D] hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#FAFAFA] dark:bg-crm-muted text-[11px] text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Code</th>
                  <th className="px-4 py-2.5 font-semibold">Project</th>
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Phase</th>
                  <th className="px-4 py-2.5 font-semibold">Deadline</th>
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
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                      No projects yet — they appear here from Admin Project DB.
                    </td>
                  </tr>
                ) : (
                  recent.map(p => (
                    <tr key={p.id} className="border-t border-gray-50 dark:border-crm-border hover:bg-[#FFF8F9] dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-xs font-semibold text-[#B8112D] whitespace-nowrap">
                        {p.projectCode || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#0F172A] dark:text-gray-100 truncate max-w-[220px]">
                        {p.projectTitle || p.name || "Untitled"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 truncate max-w-[160px]">
                        {p.company || "—"}
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
        </div>
      </main>
    </div>
  );
}
