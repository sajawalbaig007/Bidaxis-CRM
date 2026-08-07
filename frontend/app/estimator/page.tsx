"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban, CheckCircle2, Clock3, AlertTriangle,
  ArrowRight, RefreshCw,
} from "lucide-react";
import EstimatorSidebar from "./components/layout/Sidebar";
import API from "@/lib/api";

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

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get("/estimator/dashboard");
      setStats(res.data?.stats ?? { total: 0, pending: 0, takeoffDone: 0, overdue: 0 });
      setRecent(Array.isArray(res.data?.recent) ? res.data.recent : []);
    } catch {
      setStats({ total: 0, pending: 0, takeoffDone: 0, overdue: 0 });
      setRecent([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const cards = [
    { label: "Assigned", value: stats.total, icon: FolderKanban, from: "from-[#7C3AED]", to: "to-[#5B21B6]", bar: "70%" },
    { label: "Pending", value: stats.pending, icon: Clock3, from: "from-[#D97706]", to: "to-[#B45309]", bar: "55%" },
    { label: "Takeoff Done", value: stats.takeoffDone, icon: CheckCircle2, from: "from-[#059669]", to: "to-[#047857]", bar: "80%" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, from: "from-[#B8112D]", to: "to-[#8b0d22]", bar: "35%" },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <EstimatorSidebar />

      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">
                Estimator Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                Your assigned projects · takeoff · deadlines
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:bg-violet-50 disabled:opacity-60 shadow-sm w-full sm:w-auto shrink-0"
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

          <Link
            href="/estimator/my-projects"
            className="group bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 hover:border-[#7C3AED]/30 hover:shadow-md transition-all flex items-start justify-between gap-3"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#7C3AED] flex items-center justify-center mb-3">
                <FolderKanban size={18} />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">My Projects</h3>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                Open assigned work — man hours, deadlines & takeoff status
              </p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </Link>

          <section className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">Recent Assignments</h2>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Latest projects assigned to you</p>
              </div>
              <Link href="/estimator/my-projects" className="text-xs sm:text-sm font-semibold text-[#7C3AED] hover:underline">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#FAFAFA] text-[11px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Code</th>
                    <th className="px-4 py-2.5 font-semibold">Project</th>
                    <th className="px-4 py-2.5 font-semibold">Hours</th>
                    <th className="px-4 py-2.5 font-semibold">Deadline</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
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
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400 font-medium">
                        No assignments yet — technical will assign projects to you.
                      </td>
                    </tr>
                  ) : (
                    recent.map(p => (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-violet-50/40">
                        <td className="px-4 py-3 text-xs font-semibold text-[#7C3AED] whitespace-nowrap">
                          {p.projectCode || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#0F172A] truncate max-w-[220px]">
                          {p.projectTitle || "Untitled"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {p.myAssignment?.manHours ? `${p.myAssignment.manHours}h` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
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
      </main>
    </div>
  );
}
