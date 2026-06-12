"use client";

import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, TrendingUp, X,
  DollarSign, Calendar, Briefcase, Building2, User2,
  Phone, Mail, Clock3, ChevronDown, ArrowRightLeft, Check, RefreshCw,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar  from "../components/Navbar";
import API from "@/lib/api";

/* ── Types ── */
type Project = {
  id:                string;
  name:              string | null;
  company:           string | null;
  phone:             string | null;
  email:             string | null;
  status:            string;
  interestedService: string | null;
  projectTitle:      string | null;
  projectDeadline:   string | null;
  projectBudget:     string | null;
  projectNotes:      string | null;
  updatedAt:         string;
  csr: { id: string; name: string; email: string; csrCode: string | null };
  uploadFile: { companyName: string | null } | null;
};

type Stats = { total: number; withBudget: number; thisMonth: number };

/* ── Helpers ── */
const serviceColors: Record<string, string> = {
  "Estimating":   "bg-blue-100 text-blue-700",
  "Scheduling":   "bg-purple-100 text-purple-700",
  "Shop Drawing": "bg-orange-100 text-orange-700",
  "Drafting":     "bg-teal-100 text-teal-700",
  "BIM":          "bg-indigo-100 text-indigo-700",
  "IT":           "bg-pink-100 text-pink-700",
};
const getServiceColor = (s: string | null) =>
  serviceColors[s ?? ""] ?? "bg-gray-100 text-gray-600";

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const isOverdue = (d: string | null) => !!d && new Date(d) < new Date();

/* ── Stat Card ── */
function StatCard({
  title, value, icon, bg, loading,
}: {
  title: string; value: number; icon: React.ReactNode; bg: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-400 truncate">{title}</p>
          {loading ? (
            <div className="h-8 w-12 bg-gray-100 rounded-lg mt-1.5 sm:mt-2 animate-pulse" />
          ) : (
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-1.5 sm:mt-2">
              {value}
            </h2>
          )}
        </div>
        <div className={`w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ── Project Card (mobile / tablet) ── */
function ProjectCard({ p, onView }: { p: Project; onView: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-800 truncate">{p.name ?? "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">{p.phone ?? "—"}</p>
        </div>
        <button
          onClick={onView}
          className="px-3 py-1.5 rounded-xl bg-[#111827] text-white text-xs font-semibold shrink-0 hover:bg-black transition-all"
        >
          View
        </button>
      </div>

      {p.projectTitle && (
        <p className="text-sm font-semibold text-gray-700 truncate">{p.projectTitle}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {p.uploadFile?.companyName && (
          <span className="inline-flex items-center gap-1 bg-[#FFF1F3] text-[#B8112D] px-2.5 py-1 rounded-xl text-xs font-semibold">
            <Building2 size={10} />{p.uploadFile.companyName}
          </span>
        )}
        {p.interestedService && (
          <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${getServiceColor(p.interestedService)}`}>
            {p.interestedService}
          </span>
        )}
        {p.projectDeadline && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl ${
            isOverdue(p.projectDeadline)
              ? "bg-red-100 text-red-600"
              : "bg-[#ECFDF5] text-[#065F46]"
          }`}>
            <Calendar size={10} />{formatDate(p.projectDeadline)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-50">
        <span className="font-medium text-[#065F46] truncate flex items-center gap-1.5">
          {p.csr.csrCode && (
            <span className="bg-[#B8112D]/10 text-[#B8112D] text-[9px] font-bold px-1.5 py-0.5 rounded-md">{p.csr.csrCode}</span>
          )}
          {p.csr.name}
        </span>
        {p.projectBudget && (
          <span className="font-bold text-gray-700 shrink-0 ml-2">${p.projectBudget}</span>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
const PAGE_SIZE = 30;

export default function AdminProjectsPage() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [stats,     setStats]     = useState<Stats>({ total: 0, withBudget: 0, thisMonth: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filterCSR, setFilterCSR] = useState("all");
  const [selected,  setSelected]  = useState<Project | null>(null);
  const [page,      setPage]      = useState(1);

  /* ── Reassign modal ── */
  type CSROption = { id: string; name: string; csrCode: string | null };
  const [showReassign,  setShowReassign]  = useState(false);
  const [reassignProj,  setReassignProj]  = useState<Project | null>(null);
  const [csrOpts,       setCsrOpts]       = useState<CSROption[]>([]);
  const [selCsrId,      setSelCsrId]      = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [csrOptsLoaded, setCsrOptsLoaded] = useState(false);

  const openReassign = async (p: Project) => {
    setReassignProj(p);
    setSelCsrId("");
    setShowReassign(true);
    if (!csrOptsLoaded) {
      try {
        const res = await API.get("/admin/csrs");
        setCsrOpts(res.data.csrs ?? []);
        setCsrOptsLoaded(true);
      } catch { toast.error("Failed to load CSRs."); }
    }
  };

  const confirmReassign = async () => {
    if (!reassignProj || !selCsrId) return;
    setIsReassigning(true);
    try {
      await API.put(`/admin/lead/${reassignProj.id}/reassign`, { csrId: selCsrId });
      const csr = csrOpts.find(c => c.id === selCsrId);
      toast.success(`Project reassigned to ${csr?.name ?? "CSR"}.`);
      setProjects(prev => prev.map(p =>
        p.id === reassignProj.id
          ? { ...p, csr: { id: selCsrId, name: csr?.name ?? p.csr.name, email: p.csr.email, csrCode: csr?.csrCode ?? p.csr.csrCode } }
          : p
      ));
      setShowReassign(false);
      setReassignProj(null);
    } catch { toast.error("Failed to reassign project."); }
    finally { setIsReassigning(false); }
  };

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/admin/projects");
      setProjects(res.data.leads ?? []);
      setStats(res.data.stats   ?? { total: 0, withBudget: 0, thisMonth: 0 });
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => { await fetchProjects(); };
    load();
  }, [fetchProjects]);

  const csrList = Array.from(
    new Map(projects.map((p) => [p.csr.id, p.csr.name])).entries()
  );

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.projectTitle ?? "").toLowerCase().includes(q) ||
      (p.company ?? "").toLowerCase().includes(q) ||
      (p.interestedService ?? "").toLowerCase().includes(q) ||
      p.csr.name.toLowerCase().includes(q) ||
      (p.uploadFile?.companyName ?? "").toLowerCase().includes(q);
    return matchSearch && (filterCSR === "all" || p.csr.id === filterCSR);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster
        position="top-right"
        toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }}
      />
      <DashboardSidebar />

      {/* ─── MAIN ─── */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar />

        {/* HEADER */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
              Close Client
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              All client projects across every CSR — real-time.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold w-fit">
            <div className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
            Live Data
          </div>
        </div>

        {/* STATS — 1 col mobile → 3 col sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <StatCard
            title="Total Projects"
            value={stats.total}
            bg="bg-[#F8ECEF]"
            loading={loading}
            icon={<FolderKanban size={22} className="text-[#B8112D] sm:w-[26px] sm:h-[26px]" />}
          />
          <StatCard
            title="This Month"
            value={stats.thisMonth}
            bg="bg-blue-100"
            loading={loading}
            icon={<TrendingUp size={22} className="text-blue-600 sm:w-[26px] sm:h-[26px]" />}
          />
          <StatCard
            title="With Budget Set"
            value={stats.withBudget}
            bg="bg-green-100"
            loading={loading}
            icon={<DollarSign size={22} className="text-green-600 sm:w-[26px] sm:h-[26px]" />}
          />
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-5">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-sm lg:max-w-md">
            <Search size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects, client, service..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D]"
            />
          </div>

          {/* CSR filter */}
          <div className="relative w-full sm:w-auto">
            <User2 size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterCSR}
              onChange={(e) => { setFilterCSR(e.target.value); setPage(1); }}
              className="appearance-none w-full sm:min-w-[200px] lg:min-w-[220px] h-10 sm:h-12 bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-9 sm:pr-10 text-sm outline-none focus:border-[#B8112D]"
            >
              <option value="all">All CSRs</option>
              {csrList.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ── MOBILE / TABLET CARDS (< lg) ── */}
        <div className="lg:hidden space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-32 animate-pulse" />
            ))
          ) : filtered.length > 0 ? (
            paginated.map((p) => (
              <ProjectCard key={p.id} p={p} onView={() => setSelected(p)} />
            ))
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 sm:p-12 text-center">
              <FolderKanban size={32} className="text-gray-200 mx-auto mb-3 sm:w-9 sm:h-9" />
              <p className="text-gray-400 font-medium text-sm sm:text-base">No projects found</p>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100">
              <p className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
                <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
              </div>
            </div>
          )}
        </div>

        {/* ── DESKTOP TABLE (lg+) ── */}
        <div className="hidden lg:block bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
          {/* Scrollable wrapper so table never breaks layout on laptop */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "860px" }}>
              <thead className="bg-[#FAFAFB] border-b border-gray-100">
                <tr className="text-left text-xs xl:text-sm text-gray-400">
                  {["Client", "Project Title", "Company", "Service", "Budget", "Deadline", "CSR", ""].map(
                    (h, i) => (
                      <th
                        key={i}
                        className={`px-4 xl:px-5 py-3 xl:py-4 font-medium whitespace-nowrap ${
                          i === 7 ? "text-right" : ""
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                        <td key={j} className="px-4 xl:px-5 py-4 xl:py-5">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-16 xl:w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? (
                  paginated.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-[#FAFAFB] transition-all">

                      {/* CLIENT */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4">
                        <p className="font-semibold text-gray-800 text-xs xl:text-sm whitespace-nowrap">
                          {p.name ?? "—"}
                        </p>
                        <p className="text-[11px] xl:text-xs text-gray-400 mt-0.5">
                          {p.phone ?? "—"}
                        </p>
                      </td>

                      {/* PROJECT TITLE */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4">
                        <p className="font-semibold text-gray-800 text-xs xl:text-sm whitespace-nowrap max-w-[140px] xl:max-w-[180px] truncate">
                          {p.projectTitle ?? "—"}
                        </p>
                        <p className="text-[11px] xl:text-xs text-gray-400 mt-0.5 truncate max-w-[140px] xl:max-w-[160px]">
                          {p.company ?? "—"}
                        </p>
                      </td>

                      {/* COMPANY */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4 whitespace-nowrap">
                        {p.uploadFile?.companyName ? (
                          <span className="inline-flex items-center gap-1 bg-[#FFF1F3] text-[#B8112D] px-2 xl:px-2.5 py-1 rounded-xl text-[11px] xl:text-xs font-semibold">
                            <Building2 size={9} className="xl:w-2.5 xl:h-2.5" />
                            <span className="max-w-[80px] xl:max-w-none truncate">
                              {p.uploadFile.companyName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs xl:text-sm">—</span>
                        )}
                      </td>

                      {/* SERVICE */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4 whitespace-nowrap">
                        {p.interestedService ? (
                          <span className={`px-2 xl:px-2.5 py-1 rounded-xl text-[11px] xl:text-xs font-semibold ${getServiceColor(p.interestedService)}`}>
                            {p.interestedService}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs xl:text-sm">—</span>
                        )}
                      </td>

                      {/* BUDGET */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4 whitespace-nowrap">
                        <span className={`text-xs xl:text-sm font-semibold ${p.projectBudget ? "text-[#065F46]" : "text-gray-400"}`}>
                          {p.projectBudget ? `$${p.projectBudget}` : "Not set"}
                        </span>
                      </td>

                      {/* DEADLINE */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4 whitespace-nowrap">
                        {p.projectDeadline ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] xl:text-xs font-semibold px-2 xl:px-2.5 py-1 rounded-xl ${
                            isOverdue(p.projectDeadline)
                              ? "bg-red-100 text-red-600"
                              : "bg-[#ECFDF5] text-[#065F46]"
                          }`}>
                            <Calendar size={9} className="xl:w-2.5 xl:h-2.5" />
                            {formatDate(p.projectDeadline)}
                            {isOverdue(p.projectDeadline) && " · Overdue"}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs xl:text-sm">—</span>
                        )}
                      </td>

                      {/* CSR */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {p.csr.csrCode && (
                            <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-1.5 py-0.5 rounded-md">{p.csr.csrCode}</span>
                          )}
                          <span className="text-xs xl:text-sm font-semibold text-[#065F46]">{p.csr.name}</span>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 xl:px-5 py-3 xl:py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => void openReassign(p)}
                            className="px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl bg-blue-100 text-blue-700 text-xs xl:text-sm font-medium hover:bg-blue-200 transition-all whitespace-nowrap flex items-center gap-1.5"
                          >
                            <ArrowRightLeft size={12} className="xl:w-[13px] xl:h-[13px]" />
                            Reassign
                          </button>
                          <button
                            onClick={() => setSelected(p)}
                            className="px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl bg-[#111827] text-white text-xs xl:text-sm font-medium hover:bg-black transition-all whitespace-nowrap"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-16 xl:py-20 text-center">
                      <FolderKanban size={36} className="text-gray-200 mx-auto mb-3 xl:w-10 xl:h-10" />
                      <p className="font-semibold text-gray-400 text-sm xl:text-base">No projects found</p>
                      <p className="text-xs xl:text-sm text-gray-300 mt-1">
                        {search ? "Try a different search." : "No leads marked as Close Client yet."}
                      </p>
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
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
                <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
              </div>
            </div>
          )}
        </div>

        {/* ── DETAIL MODAL ── */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg lg:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">

              {/* Modal header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                <div className="min-w-0 pr-3">
                  <h2 className="text-base sm:text-xl font-bold text-gray-800 truncate">
                    {selected.projectTitle ?? "Untitled Project"}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{selected.name ?? "—"}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all shrink-0"
                >
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">

                {/* Company + Service */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-[#FFF1F3] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                      <Building2 size={11} />Company
                    </p>
                    <p className="font-bold text-[#B8112D] text-sm truncate">
                      {selected.uploadFile?.companyName ?? "—"}
                    </p>
                  </div>
                  <div className="bg-[#F0FDF4] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                      <Briefcase size={11} />Service
                    </p>
                    <p className="font-bold text-[#065F46] text-sm truncate">
                      {selected.interestedService ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Budget + Deadline */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                      <DollarSign size={11} />Budget
                    </p>
                    <p className="font-bold text-gray-800 text-base sm:text-lg">
                      {selected.projectBudget ? `$${selected.projectBudget}` : "Not set"}
                    </p>
                  </div>
                  <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 ${isOverdue(selected.projectDeadline) ? "bg-red-50" : "bg-[#F8F9FC]"}`}>
                    <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 sm:gap-1.5 mb-1.5 sm:mb-2">
                      <Calendar size={11} />Deadline
                    </p>
                    <p className={`font-bold text-base sm:text-lg ${isOverdue(selected.projectDeadline) ? "text-red-600" : "text-gray-800"}`}>
                      {formatDate(selected.projectDeadline)}
                    </p>
                  </div>
                </div>

                {/* Client info */}
                <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
                    Client Info
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {[
                      { icon: <User2 size={12} />,     label: "Name",    value: selected.name    },
                      { icon: <Phone size={12} />,     label: "Phone",   value: selected.phone   },
                      { icon: <Mail size={12} />,      label: "Email",   value: selected.email   },
                      { icon: <Building2 size={12} />, label: "Address", value: selected.company },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-gray-400">{label}</p>
                          <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                            {value ?? "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CSR */}
                <div className="bg-emerald-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Handled by CSR</p>
                  <div className="flex items-center gap-2">
                    {selected.csr.csrCode && (
                      <span className="bg-[#B8112D]/10 text-[#B8112D] text-[11px] font-bold px-2 py-0.5 rounded-lg">{selected.csr.csrCode}</span>
                    )}
                    <p className="font-bold text-[#065F46] text-sm sm:text-base">{selected.csr.name}</p>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400">{selected.csr.email}</p>
                </div>

                {/* Notes */}
                {selected.projectNotes && (
                  <div className="bg-[#FFFBEB] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">Project Notes</p>
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                      {selected.projectNotes}
                    </p>
                  </div>
                )}

                <p className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400">
                  <Clock3 size={10} className="sm:w-[11px] sm:h-[11px]" />
                  Close Client on {formatDate(selected.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        )}
      {/* ══ REASSIGN CSR MODAL ══ */}
      {showReassign && reassignProj && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Reassign Project</h2>
                  <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                    Reassigning <span className="font-semibold text-white">{reassignProj.projectTitle ?? reassignProj.name ?? "project"}</span>
                  </p>
                </div>
                <button onClick={() => setShowReassign(false)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0">
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
              {!csrOptsLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw size={20} className="animate-spin text-gray-400" />
                </div>
              ) : csrOpts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No CSRs available.</p>
              ) : csrOpts.map(csr => (
                <button key={csr.id} onClick={() => setSelCsrId(csr.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                    selCsrId === csr.id ? "border-[#B8112D] bg-[#FFF1F3]" : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                    selCsrId === csr.id ? "bg-[#B8112D]" : "bg-gray-400"
                  }`}>
                    {csr.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${selCsrId === csr.id ? "text-[#B8112D]" : "text-[#0F172A]"}`}>
                      {csr.name}
                    </p>
                    {csr.csrCode && <p className="text-xs text-gray-400">{csr.csrCode}</p>}
                  </div>
                  {selCsrId === csr.id && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2">
              <button onClick={() => setShowReassign(false)}
                className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={confirmReassign} disabled={!selCsrId || isReassigning}
                className="flex-1 h-11 rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                <ArrowRightLeft size={14} />
                {isReassigning ? "Reassigning…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}