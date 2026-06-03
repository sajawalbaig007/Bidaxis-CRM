"use client";

import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, TrendingUp, X,
  DollarSign, Calendar, Briefcase, Building2, User2,
  Phone, Mail, Clock3, ChevronDown,
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
  csr: { id: string; name: string; email: string };
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
const getServiceColor = (s: string | null) => serviceColors[s ?? ""] ?? "bg-gray-100 text-gray-600";

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
};

const isOverdue = (d: string | null) => !!d && new Date(d) < new Date();

/* ── Stat Card ── */
function StatCard({ title, value, icon, bg, loading }: {
  title: string; value: number; icon: React.ReactNode; bg: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          {loading
            ? <div className="h-9 w-12 bg-gray-100 rounded-lg mt-2 animate-pulse"/>
            : <h2 className="text-3xl font-semibold text-gray-800 mt-2">{value}</h2>
          }
        </div>
        <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center`}>{icon}</div>
      </div>
    </div>
  );
}

/* ── Project Card (mobile) ── */
function ProjectCard({ p, onView }: { p: Project; onView: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-800">{p.name ?? "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">{p.phone ?? "—"}</p>
        </div>
        <button onClick={onView}
          className="px-3 py-1.5 rounded-xl bg-[#111827] text-white text-xs font-semibold shrink-0">
          View
        </button>
      </div>

      {p.projectTitle && <p className="text-sm font-semibold text-gray-700">{p.projectTitle}</p>}

      <div className="flex flex-wrap gap-2">
        {p.uploadFile?.companyName && (
          <span className="inline-flex items-center gap-1 bg-[#FFF1F3] text-[#B8112D] px-2.5 py-1 rounded-xl text-xs font-semibold">
            <Building2 size={10}/>{p.uploadFile.companyName}
          </span>
        )}
        {p.interestedService && (
          <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${getServiceColor(p.interestedService)}`}>
            {p.interestedService}
          </span>
        )}
        {p.projectDeadline && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl ${
            isOverdue(p.projectDeadline) ? "bg-red-100 text-red-600" : "bg-[#ECFDF5] text-[#065F46]"
          }`}>
            <Calendar size={10}/>{formatDate(p.projectDeadline)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-50">
        <span className="font-medium text-[#065F46] whitespace-nowrap">CSR: {p.csr.name}</span>
        {p.projectBudget && <span className="font-bold text-gray-700">${p.projectBudget}</span>}
      </div>
    </div>
  );
}

export default function AdminProjectsPage() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [stats,     setStats]     = useState<Stats>({ total: 0, withBudget: 0, thisMonth: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filterCSR, setFilterCSR] = useState("all");
  const [selected,  setSelected]  = useState<Project | null>(null);

  /* ── FETCH — ESLint-safe ── */
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/admin/projects");
      setProjects(res.data.leads  ?? []);
      setStats(res.data.stats     ?? { total: 0, withBudget: 0, thisMonth: 0 });
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

  /* ── Unique CSRs ── */
  const csrList = Array.from(new Map(projects.map(p => [p.csr.id, p.csr.name])).entries());

  /* ── Filtered ── */
  const filtered = projects.filter(p => {
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

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{ style:{ borderRadius:"16px", fontSize:"14px" } }}/>
      <DashboardSidebar/>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-18 lg:mt-0">
        <DashboardNavbar/>

        {/* HEADER */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Project Won</h1>
            <p className="text-sm text-gray-400 mt-1">All client projects across every CSR — real-time.</p>
          </div>
          <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] px-4 py-2 rounded-2xl text-sm font-semibold w-fit">
            <div className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse"/>Live Data
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total Projects"  value={stats.total}      bg="bg-[#F8ECEF]" loading={loading}
            icon={<FolderKanban size={26} className="text-[#B8112D]"/>}/>
          <StatCard title="This Month"      value={stats.thisMonth}  bg="bg-blue-100"  loading={loading}
            icon={<TrendingUp size={26} className="text-blue-600"/>}/>
          <StatCard title="With Budget Set" value={stats.withBudget} bg="bg-green-100" loading={loading}
            icon={<DollarSign size={26} className="text-green-600"/>}/>
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 sm:max-w-90">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search projects, client, service..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
          <div className="relative">
            <User2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <select value={filterCSR} onChange={e => setFilterCSR(e.target.value)}
              className="appearance-none h-12 bg-white border border-gray-200 rounded-2xl pl-11 pr-10 text-sm outline-none focus:border-[#B8112D] min-w-50 w-full sm:w-auto">
              <option value="all">All CSRs</option>
              {csrList.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          </div>
        </div>

        {/* MOBILE CARDS */}
        <div className="lg:hidden space-y-3">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-32 animate-pulse"/>)
          ) : filtered.length > 0 ? filtered.map(p => (
            <ProjectCard key={p.id} p={p} onView={() => setSelected(p)}/>
          )) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <FolderKanban size={36} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-gray-400 font-medium">No projects found</p>
            </div>
          )}
        </div>

        {/* DESKTOP TABLE — no overflow scroll, no min-w */}
        <div className="hidden lg:block bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-[#FAFAFB] border-b border-gray-100">
              <tr className="text-left text-sm text-gray-400">
                <th className="px-5 py-4 font-medium">Client</th>
                <th className="px-5 py-4 font-medium">Project Title</th>
                <th className="px-5 py-4 font-medium">Company</th>
                <th className="px-5 py-4 font-medium">Service</th>
                <th className="px-5 py-4 font-medium">Budget</th>
                <th className="px-5 py-4 font-medium">Deadline</th>
                <th className="px-5 py-4 font-medium">CSR</th>
                <th className="px-5 py-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="border-b border-gray-100">
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <td key={j} className="px-5 py-5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-20"/>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length > 0 ? filtered.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-[#FAFAFB] transition-all">

                  {/* CLIENT */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <p className="font-semibold text-gray-800 text-sm">{p.name ?? "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.phone ?? "—"}</p>
                  </td>

                  {/* PROJECT */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <p className="font-semibold text-gray-800 text-sm">{p.projectTitle ?? "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{p.company ?? "—"}</p>
                  </td>

                  {/* COMPANY */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {p.uploadFile?.companyName ? (
                      <span className="inline-flex items-center gap-1 bg-[#FFF1F3] text-[#B8112D] px-2.5 py-1 rounded-xl text-xs font-semibold">
                        <Building2 size={10}/>{p.uploadFile.companyName}
                      </span>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>

                  {/* SERVICE */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {p.interestedService ? (
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${getServiceColor(p.interestedService)}`}>
                        {p.interestedService}
                      </span>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>

                  {/* BUDGET */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${p.projectBudget ? "text-[#065F46]" : "text-gray-400"}`}>
                      {p.projectBudget ? `$${p.projectBudget}` : "Not set"}
                    </span>
                  </td>

                  {/* DEADLINE */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    {p.projectDeadline ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl ${
                        isOverdue(p.projectDeadline) ? "bg-red-100 text-red-600" : "bg-[#ECFDF5] text-[#065F46]"
                      }`}>
                        <Calendar size={10}/>{formatDate(p.projectDeadline)}
                        {isOverdue(p.projectDeadline) && " · Overdue"}
                      </span>
                    ) : <span className="text-gray-400 text-sm">—</span>}
                  </td>

                  {/* CSR */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-[#065F46]">{p.csr.name}</span>
                  </td>

                  {/* VIEW */}
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => setSelected(p)}
                      className="px-4 py-2 rounded-xl bg-[#111827] text-white text-sm font-medium hover:bg-black transition-all">
                      View
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <FolderKanban size={40} className="text-gray-200 mx-auto mb-3"/>
                    <p className="font-semibold text-gray-400">No projects found</p>
                    <p className="text-sm text-gray-300 mt-1">
                      {search ? "Try a different search." : "No leads marked as Project Won yet."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── DETAIL MODAL ── */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">

              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selected.projectTitle ?? "Untitled Project"}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{selected.name ?? "—"}</p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
                  <X size={18}/>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Company + Service */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#FFF1F3] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><Building2 size={12}/>Company</p>
                    <p className="font-bold text-[#B8112D]">{selected.uploadFile?.companyName ?? "—"}</p>
                  </div>
                  <div className="bg-[#F0FDF4] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><Briefcase size={12}/>Service</p>
                    <p className="font-bold text-[#065F46]">{selected.interestedService ?? "—"}</p>
                  </div>
                </div>

                {/* Budget + Deadline */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F8F9FC] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><DollarSign size={12}/>Budget</p>
                    <p className="font-bold text-gray-800 text-lg">{selected.projectBudget ? `$${selected.projectBudget}` : "Not set"}</p>
                  </div>
                  <div className={`rounded-2xl p-4 ${isOverdue(selected.projectDeadline) ? "bg-red-50" : "bg-[#F8F9FC]"}`}>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2"><Calendar size={12}/>Deadline</p>
                    <p className={`font-bold text-lg ${isOverdue(selected.projectDeadline) ? "text-red-600" : "text-gray-800"}`}>
                      {formatDate(selected.projectDeadline)}
                    </p>
                  </div>
                </div>

                {/* Client info */}
                <div className="bg-[#F8F9FC] rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client Info</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon:<User2 size={13}/>,     label:"Name",    value: selected.name    },
                      { icon:<Phone size={13}/>,     label:"Phone",   value: selected.phone   },
                      { icon:<Mail size={13}/>,      label:"Email",   value: selected.email   },
                      { icon:<Building2 size={13}/>, label:"Address", value: selected.company },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
                        <div>
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-medium text-gray-700">{value ?? "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CSR */}
                <div className="bg-emerald-50 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Handled by CSR</p>
                  <p className="font-bold text-[#065F46]">{selected.csr.name}</p>
                  <p className="text-xs text-gray-400">{selected.csr.email}</p>
                </div>

                {/* Notes */}
                {selected.projectNotes && (
                  <div className="bg-[#FFFBEB] rounded-2xl p-4">
                    <p className="text-xs text-gray-500 mb-2">Project Notes</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{selected.projectNotes}</p>
                  </div>
                )}

                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock3 size={11}/>Project Won on {formatDate(selected.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}