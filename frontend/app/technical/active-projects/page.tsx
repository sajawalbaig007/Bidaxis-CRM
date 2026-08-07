"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, Calendar, Users, ClipboardList, CheckCircle2,
  Calculator, Send, Layers, UserPlus, Check,
} from "lucide-react";

import TechnicalSidebar from "../components/layout/Sidebar";
import DashboardNavbar from "@/app/admin/components/layout/Navbar";
import CapsuleTabs from "@/app/components/CapsuleTabs";
import CommentCell from "@/app/csr/components/shared/CommentCell";
import StateFilterDropdown from "@/app/csr/components/shared/StateFilterDropdown";
import PhoneAreaCodeFilterInput from "@/app/csr/components/shared/PhoneAreaCodeFilterInput";
import { matchesStateLocationFilter, matchesPhoneAreaCodeFilter } from "@/lib/stateLocationFilter";
import { NoteEntry } from "@/app/csr/hooks/useLeadsData";
import {
  TECHNICAL_PROJECT_COLS,
  CsrColGroup,
  CSR_THEAD,
} from "@/app/csr/components/shared/csrTableStyles";
import {
  ProjectDetailCell,
  PROJECT_TABLE_CARD,
  PROJECT_TABLE_HEAD,
} from "@/app/components/projects/ProjectTableCells";
import AssignEstimatorsModal from "../components/AssignEstimatorsModal";
import API from "@/lib/api";
import {
  matchesTechnicalTab,
  parseTechnicalAssignments,
  projectReceiveDate,
  type TechnicalAssignment,
  type TechnicalEstimator,
  type TechnicalWorkflowTab,
} from "@/lib/technicalAssignments";

type Project = {
  id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  status: string;
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
  technicalAssignments?: string | null;
  createdAt?: string;
  updatedAt: string;
  csr: { id: string; name: string; email: string; csrCode: string | null };
  uploadFile: { companyName: string | null } | null;
  notes?: { id: string; text: string; createdAt: string }[];
};

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
    company: p.company ?? p.uploadFile?.companyName ?? null,
    ownerName: p.ownerName,
    phone: p.phone,
    email: p.email,
    projectCode: p.projectCode,
    clientCode: p.clientCode,
    projectTitle: p.projectTitle,
    projectScope: p.projectScope,
    interestedService: p.interestedService,
    projectBudget: null,
    projectDeadline: p.projectDeadline,
    projectPhase: p.projectPhase,
    projectPayments: p.projectPayments,
    state: p.state,
  };
}

function AssignedToCell({
  assignments,
  onAssign,
  showTakeoff,
  onToggleTakeoff,
}: {
  assignments: TechnicalAssignment[];
  onAssign: () => void;
  showTakeoff?: boolean;
  onToggleTakeoff?: (estimatorId: string, done: boolean) => void;
}) {
  if (assignments.length === 0) {
    return (
      <button
        type="button"
        onClick={onAssign}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#B8112D] text-white text-[11px] font-semibold hover:bg-[#a30f27] transition-colors shadow-sm shadow-red-100"
      >
        <UserPlus size={12} />
        Assign
      </button>
    );
  }

  return (
    <div className="space-y-1.5 min-w-0">
      {assignments.map((a) => (
        <div
          key={a.estimatorId}
          className="flex items-center gap-1.5 min-w-0 bg-[#F8F9FC] rounded-lg px-2 py-1.5 border border-gray-100"
        >
          <div className="w-6 h-6 rounded-full bg-[#B8112D]/15 text-[#B8112D] flex items-center justify-center text-[10px] font-bold shrink-0">
            {a.estimatorName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[#0F172A] truncate">{a.estimatorName}</p>
            <p className="text-[9px] text-gray-400 truncate">
              {a.manHours ? `${a.manHours}h` : "—"} · {formatDate(a.deadline)}
            </p>
          </div>
          {showTakeoff && onToggleTakeoff && (
            <button
              type="button"
              title={a.takeoffDone ? "Mark remaining" : "Mark takeoff done"}
              onClick={() => onToggleTakeoff(a.estimatorId, !a.takeoffDone)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                a.takeoffDone
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
              }`}
            >
              <Check size={12} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAssign}
        className="text-[10px] font-semibold text-[#B8112D] hover:underline"
      >
        Reassign
      </button>
    </div>
  );
}

export default function TechnicalActiveProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [workflowTab, setWorkflowTab] = useState<TechnicalWorkflowTab>("all");
  const [estimators, setEstimators] = useState<TechnicalEstimator[]>([]);
  const [assignProject, setAssignProject] = useState<Project | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        lite: "1",
        page: "1",
        limit: "100",
      };
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (search.trim()) params.search = search.trim();
      const res = await API.get("/admin/projects", { params });
      setProjects(res.data.leads ?? []);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    API.get("/admin/technical-estimators")
      .then((res) => setEstimators(res.data.estimators ?? []))
      .catch(() => {});
  }, []);

  const addNote = async (id: string, text: string) => {
    const res = await API.post(`/admin/lead/${id}/notes`, { text });
    const note = res.data.note as { id: string; text: string; createdAt: string };
    const entry: NoteEntry = { id: note.id, text: note.text, createdAt: note.createdAt };
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes: [...(p.notes ?? []), note] } : p)),
    );
    return entry;
  };

  const confirmAssign = async (assignments: TechnicalAssignment[]) => {
    if (!assignProject) return;
    setAssignSaving(true);
    try {
      const res = await API.put(`/admin/project/${assignProject.id}/assign-estimators`, {
        assignments,
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success("Estimators assigned");
      setAssignProject(null);
    } catch {
      toast.error("Failed to assign estimators");
    } finally {
      setAssignSaving(false);
    }
  };

  const toggleTakeoff = async (projectId: string, estimatorId: string, takeoffDone: boolean) => {
    try {
      const res = await API.put(`/admin/project/${projectId}/estimator-takeoff`, {
        estimatorId,
        takeoffDone,
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
    } catch {
      toast.error("Failed to update takeoff status");
    }
  };

  const baseFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => {
      const assignments = parseTechnicalAssignments(p.technicalAssignments);
      const assignNames = assignments.map((a) => a.estimatorName).join(" ");
      const matchSearch =
        !q ||
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.projectTitle ?? "").toLowerCase().includes(q) ||
        (p.projectCode ?? "").toLowerCase().includes(q) ||
        (p.clientCode ?? "").toLowerCase().includes(q) ||
        (p.projectScope ?? "").toLowerCase().includes(q) ||
        (p.company ?? "").toLowerCase().includes(q) ||
        assignNames.toLowerCase().includes(q);
      const matchState = matchesStateLocationFilter(p.state, p.phone, stateFilter);
      const matchPhone = matchesPhoneAreaCodeFilter(p.phone, phoneFilter);
      return matchSearch && matchState && matchPhone;
    });
  }, [projects, search, stateFilter, phoneFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<TechnicalWorkflowTab, number> = {
      all: baseFiltered.length,
      not_assigned: 0,
      assigned: 0,
      takeoff_done: 0,
      pricing: 0,
      final_submission: 0,
    };
    for (const p of baseFiltered) {
      (["not_assigned", "assigned", "takeoff_done", "pricing", "final_submission"] as const).forEach(
        (tab) => {
          if (matchesTechnicalTab(tab, p)) counts[tab] += 1;
        },
      );
    }
    return counts;
  }, [baseFiltered]);

  const displayed = useMemo(
    () => baseFiltered.filter((p) => matchesTechnicalTab(workflowTab, p)),
    [baseFiltered, workflowTab],
  );

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const paginated = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const headers = [
    "Project Details",
    "Receive Date",
    "Deadline",
    "Bid Instruction",
    "Notes",
    "Assigned To",
    "",
  ];

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }} />
      <TechnicalSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
              Active Projects
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              Technical workflow — assign estimators, track takeoff, pricing & submission.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold w-fit">
            <div className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
            Live Data
          </div>
        </div>

        <CapsuleTabs
          className="mb-4 sm:mb-5"
          activeKey={workflowTab}
          onChange={(key) => {
            setWorkflowTab(key);
            setPage(1);
          }}
          tabs={[
            { key: "all", label: "All Projects", shortLabel: "All", count: tabCounts.all, icon: Layers },
            {
              key: "not_assigned",
              label: "Not Assigned",
              shortLabel: "Unassigned",
              count: tabCounts.not_assigned,
              icon: ClipboardList,
            },
            {
              key: "assigned",
              label: "Assigned",
              shortLabel: "Assigned",
              count: tabCounts.assigned,
              icon: Users,
            },
            {
              key: "takeoff_done",
              label: "Take Off Done",
              shortLabel: "Takeoff",
              count: tabCounts.takeoff_done,
              icon: CheckCircle2,
            },
            {
              key: "pricing",
              label: "Pricing",
              shortLabel: "Pricing",
              count: tabCounts.pricing,
              icon: Calculator,
            },
            {
              key: "final_submission",
              label: "Final Submission",
              shortLabel: "Final",
              count: tabCounts.final_submission,
              icon: Send,
            },
          ]}
        />

        <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-5">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1 sm:max-w-sm lg:max-w-md">
              <Search size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search code, title, scope, estimator..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D]"
              />
            </div>
            <StateFilterDropdown
              value={stateFilter}
              onChange={(v) => {
                setStateFilter(v);
                setPage(1);
              }}
            />
            <PhoneAreaCodeFilterInput
              value={phoneFilter}
              onChange={(v) => {
                setPhoneFilter(v);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
            <div className="flex items-center gap-2 flex-1 sm:max-w-md">
              <Calendar size={15} className="text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="flex-1 h-10 sm:h-11 bg-white border border-gray-200 rounded-xl px-3 text-sm outline-none focus:border-[#B8112D]"
              />
              <span className="text-xs text-gray-400 shrink-0">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="flex-1 h-10 sm:h-11 bg-white border border-gray-200 rounded-xl px-3 text-sm outline-none focus:border-[#B8112D]"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
                className="h-10 px-4 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-all"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-36 animate-pulse" />
            ))
          ) : paginated.length > 0 ? (
            paginated.map((p) => {
              const assignments = parseTechnicalAssignments(p.technicalAssignments);
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                  <ProjectDetailCell p={projectAsRow(p)} />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Receive Date</p>
                      <p className="font-semibold text-gray-700">{formatDate(projectReceiveDate(p))}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Deadline</p>
                      <p className="font-semibold text-gray-700">{formatDate(p.projectDeadline)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Bid Instruction</p>
                    {p.projectNotes?.trim() ? (
                      <p className="text-[12px] text-gray-600 whitespace-pre-wrap">{p.projectNotes}</p>
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Notes</p>
                    <CommentCell
                      id={p.id}
                      apiRole="admin"
                      noteHistory={notesToHistory(p.notes)}
                      onAddNote={addNote}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Assigned To</p>
                    <AssignedToCell
                      assignments={assignments}
                      onAssign={() => setAssignProject(p)}
                      showTakeoff={workflowTab === "takeoff_done"}
                      onToggleTakeoff={(eid, done) => void toggleTakeoff(p.id, eid, done)}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <FolderKanban size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium text-sm">No projects found</p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className={`hidden lg:block ${PROJECT_TABLE_CARD}`}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse" style={{ minWidth: "1100px" }}>
              <CsrColGroup widths={TECHNICAL_PROJECT_COLS} />
              <thead className={CSR_THEAD}>
                <tr className="text-left">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className={`px-3 xl:px-4 py-3 xl:py-4 whitespace-nowrap ${PROJECT_TABLE_HEAD} ${
                        i === headers.length - 1 ? "text-right" : ""
                      }`}
                    >
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
                  paginated.map((p) => {
                    const assignments = parseTechnicalAssignments(p.technicalAssignments);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-all align-top"
                      >
                        <td className="px-3 xl:px-4 py-3 xl:py-4">
                          <ProjectDetailCell p={projectAsRow(p)} />
                        </td>
                        <td className="px-3 xl:px-4 py-3 xl:py-4">
                          <p className="text-[10px] xl:text-xs font-semibold text-gray-700 flex items-center gap-1">
                            <Calendar size={10} className="text-[#B8112D] shrink-0" />
                            {formatDate(projectReceiveDate(p))}
                          </p>
                        </td>
                        <td className="px-3 xl:px-4 py-3 xl:py-4">
                          <p className="text-[10px] xl:text-xs font-semibold text-gray-700">
                            {formatDate(p.projectDeadline)}
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
                            apiRole="admin"
                            noteHistory={notesToHistory(p.notes)}
                            onAddNote={addNote}
                          />
                        </td>
                        <td className="px-3 xl:px-4 py-3 xl:py-4">
                          <AssignedToCell
                            assignments={assignments}
                            onAssign={() => setAssignProject(p)}
                            showTakeoff={workflowTab === "takeoff_done" || workflowTab === "assigned"}
                            onToggleTakeoff={(eid, done) => void toggleTakeoff(p.id, eid, done)}
                          />
                        </td>
                        <td className="px-3 xl:px-4 py-3 xl:py-4 text-right">
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                            {(p.projectPhase ?? "not_started").replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={headers.length} className="py-16 text-center">
                      <FolderKanban size={36} className="text-gray-200 mx-auto mb-3" />
                      <p className="font-semibold text-gray-400 text-sm">No projects found</p>
                      <p className="text-xs text-gray-300 mt-1">
                        {search ? "Try a different search." : "No projects in this section yet."}
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
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, displayed.length)} of{" "}
                {displayed.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg"
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
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <AssignEstimatorsModal
        open={!!assignProject}
        project={assignProject}
        estimators={estimators}
        saving={assignSaving}
        onClose={() => setAssignProject(null)}
        onConfirm={confirmAssign}
      />
    </div>
  );
}
