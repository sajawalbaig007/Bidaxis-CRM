"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, Calendar, Check, Clock3,
} from "lucide-react";
import EstimatorSidebar from "../components/layout/Sidebar";
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
import { projectReceiveDate, type TechnicalAssignment } from "@/lib/technicalAssignments";

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
  createdAt?: string;
  updatedAt: string;
  myAssignment?: TechnicalAssignment;
  notes?: { id: string; text: string; createdAt: string }[];
};

type FilterTab = "all" | "pending" | "done";

const COLS = ["24%", "12%", "12%", "16%", "14%", "10%", "12%"] as const;
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

export default function EstimatorMyProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/estimator/projects");
      setProjects(res.data.leads ?? []);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const addNote = async (id: string, text: string) => {
    const res = await API.post(`/estimator/lead/${id}/notes`, { text });
    const note = res.data.note as { id: string; text: string; createdAt: string };
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes: [...(p.notes ?? []), note] } : p)),
    );
    return { id: note.id, text: note.text, createdAt: note.createdAt } as NoteEntry;
  };

  const toggleTakeoff = async (projectId: string, takeoffDone: boolean) => {
    try {
      const res = await API.put(`/estimator/project/${projectId}/takeoff`, { takeoffDone });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success(takeoffDone ? "Marked takeoff done" : "Marked as pending");
    } catch {
      toast.error("Failed to update takeoff");
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
    "Receive Date",
    "Deadline",
    "Bid Instruction",
    "Notes",
    "Man Hours",
    "Takeoff",
  ];

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }} />
      <EstimatorSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 overflow-x-hidden mt-[64px]">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">My Projects</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Projects assigned to you by Technical Manager
          </p>
        </div>

        <CapsuleTabs
          className="mb-4"
          accent="#7C3AED"
          activeKey={tab}
          onChange={(key) => { setTab(key); setPage(1); }}
          tabs={[
            { key: "all", label: "All", count: counts.all, icon: FolderKanban },
            { key: "pending", label: "Pending", count: counts.pending, icon: Clock3 },
            { key: "done", label: "Takeoff Done", count: counts.done, icon: Check },
          ]}
        />

        <div className="relative mb-4 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search code, title, scope..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#7C3AED]"
          />
        </div>

        <div className="lg:hidden space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-36 animate-pulse" />
            ))
          ) : paginated.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <FolderKanban size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium text-sm">No projects found</p>
            </div>
          ) : (
            paginated.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
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
                  <p className="text-xs text-gray-600">{p.projectNotes?.trim() || "—"}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#7C3AED]">
                    {p.myAssignment?.manHours ? `${p.myAssignment.manHours}h` : "Hours —"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleTakeoff(p.id, !p.myAssignment?.takeoffDone)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold ${
                      p.myAssignment?.takeoffDone
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-[#7C3AED] text-white"
                    }`}
                  >
                    <Check size={12} />
                    {p.myAssignment?.takeoffDone ? "Done" : "Mark Done"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={`hidden lg:block ${PROJECT_TABLE_CARD}`}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse" style={{ minWidth: "1000px" }}>
              <CsrColGroup widths={COLS} />
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
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-[#F3F3F3]">
                      {headers.map((_, j) => (
                        <td key={j} className="px-3 xl:px-4 py-4">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length > 0 ? (
                  paginated.map((p) => (
                    <tr key={p.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-all align-top">
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
                        {p.projectNotes?.trim() ? (
                          <p className="text-[11px] text-gray-600 line-clamp-3 whitespace-pre-wrap">
                            {p.projectNotes}
                          </p>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <CommentCell
                          id={p.id}
                          noteHistory={notesToHistory(p.notes)}
                          onAddNote={addNote}
                        />
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <span className="text-xs font-bold text-[#7C3AED]">
                          {p.myAssignment?.manHours ? `${p.myAssignment.manHours}h` : "—"}
                        </span>
                      </td>
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <button
                          type="button"
                          onClick={() => void toggleTakeoff(p.id, !p.myAssignment?.takeoffDone)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] xl:text-xs font-semibold ${
                            p.myAssignment?.takeoffDone
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-violet-100 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white"
                          }`}
                        >
                          <Check size={12} />
                          {p.myAssignment?.takeoffDone ? "Done" : "Mark Done"}
                        </button>
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
      </main>
    </div>
  );
}
