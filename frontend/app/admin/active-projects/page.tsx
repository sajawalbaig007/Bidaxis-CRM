"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, X, Eye,
  Calendar, Building2, User2,
  ChevronDown, ArrowRightLeft, Check, RefreshCw,
  Plus,
} from "lucide-react";

import { useStaffSidebar } from "@/app/hooks/useStaffSidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import ProjectWorkbenchModal from "@/app/components/projects/ProjectWorkbenchModal";
import CommentCell from "@/app/csr/components/shared/CommentCell";
import StateFilterDropdown from "@/app/csr/components/shared/StateFilterDropdown";
import PhoneAreaCodeFilterInput from "@/app/csr/components/shared/PhoneAreaCodeFilterInput";
import { matchesStateLocationFilter, matchesPhoneAreaCodeFilter } from "@/lib/stateLocationFilter";
import { NoteEntry } from "@/app/csr/hooks/useLeadsData";
import { useClientPhoneLookup, ClientLookupData } from "@/app/csr/hooks/useClientPhoneLookup";
import { ADMIN_PROJECT_COLS, TECHNICAL_PROJECT_COLS, CsrColGroup, CSR_THEAD } from "@/app/csr/components/shared/csrTableStyles";
import {
  ClientDetailCell,
  FulfillmentCell,
  PaymentDetailCell,
  ProjectDetailCell,
  QuotedAmountCell,
  PROJECT_TABLE_CARD,
  PROJECT_TABLE_HEAD,
} from "@/app/components/projects/ProjectTableCells";
import API from "@/lib/api";
import {
  emptyWorkbench,
  parsePayments,
  ProjectWorkbenchData,
  CSR_ASSIGN_OTHER,
  PROJECT_PHASE_OPTIONS,
} from "@/lib/projectFields";

function phaseLabel(value: string) {
  return PROJECT_PHASE_OPTIONS.find(o => o.value === value)?.label ?? value;
}

const ProjectOverviewCharts = dynamic(() => import("./ProjectOverviewCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="h-[200px] bg-gray-50 rounded-2xl animate-pulse" />
      <div className="h-[200px] bg-gray-50 rounded-2xl animate-pulse" />
    </div>
  ),
});

type Project = {
  id:                string;
  name:              string | null;
  company:           string | null;
  phone:             string | null;
  email:             string | null;
  status:            string;
  state:             string | null;
  timezone:          string | null;
  ownerName:         string | null;
  interestedService: string | null;
  projectTitle:      string | null;
  projectCode:       string | null;
  clientCode?:       string | null;
  projectScope:      string | null;
  projectPhase:      string | null;
  projectDeadline:   string | null;
  takeoffDeadline:   string | null;
  pricingDeadline:   string | null;
  qaDeadline:        string | null;
  projectBudget:     string | null;
  projectNotes:      string | null;
  projectPayments:   string | null;
  projectSource:     string | null;
  isOldClient:       boolean;
  updatedAt:         string;
  csr: { id: string; name: string; email: string; csrCode: string | null };
  uploadFile: { companyName: string | null } | null;
  notes?: { id: string; text: string; createdAt: string }[];
};

function projectToWorkbench(p: Project): ProjectWorkbenchData {
  const isOther = !!p.projectSource?.trim();
  return {
    id: p.id,
    name: p.name ?? "",
    company: p.company ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    ownerName: p.ownerName ?? "",
    state: p.state ?? "",
    projectCode: p.projectCode || p.clientCode || "",
    projectTitle: p.projectTitle ?? "",
    projectScope: p.projectScope ?? "",
    interestedService: p.interestedService ?? "",
    projectBudget: p.projectBudget ?? "",
    projectDeadline: (p.projectDeadline ?? "").split("T")[0],
    projectPhase: p.projectPhase ?? "not_started",
    takeoffDeadline: p.takeoffDeadline ?? "",
    pricingDeadline: p.pricingDeadline ?? "",
    qaDeadline: p.qaDeadline ?? "",
    projectPayments: parsePayments(p.projectPayments),
    assignedTo: isOther ? CSR_ASSIGN_OTHER : p.csr.id,
    projectSource: p.projectSource ?? "",
    csrName: projectAssigneeLabel(p),
    csrCode: p.projectSource ? null : p.csr.csrCode,
  };
}

type CSROption = { id: string; name: string; csrCode: string | null };
type Stats = { total: number; withBudget: number; thisMonth: number };

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

const isProjectActive = (p: Project): boolean => {
  const st = (p.status ?? "").toLowerCase();
  if (st === "completed") return false;
  if (p.projectDeadline) {
    const deadline = p.projectDeadline.split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    return deadline >= today;
  }
  return st === "close client";
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
    projectBudget: p.projectBudget,
    projectDeadline: p.projectDeadline,
    projectPhase: p.projectPhase,
    projectPayments: p.projectPayments,
    state: p.state,
    timezone: p.timezone,
  };
}

/* ── Projects Card (mobile / tablet) ── */
function ProjectCard({
  p,
  onView,
  onReassign,
  onAddNote,
  hideClientFinanceCols = false,
}: {
  p: Project;
  onView: () => void;
  onReassign: () => void;
  onAddNote: (id: string, text: string) => Promise<unknown>;
  hideClientFinanceCols?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {hideClientFinanceCols ? (
            <ProjectDetailCell p={projectAsRow(p)} />
          ) : (
            <ClientDetailCell p={projectAsRow(p)} />
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!hideClientFinanceCols && (
            <button onClick={onReassign}
              className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100">
              <ArrowRightLeft size={13} />
            </button>
          )}
          <button onClick={onView}
            className="w-8 h-8 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80">
            <Eye size={13} />
          </button>
        </div>
      </div>

      {!hideClientFinanceCols && <ProjectDetailCell p={projectAsRow(p)} />}

      {!hideClientFinanceCols && (
        <div className="grid grid-cols-2 gap-3">
          <QuotedAmountCell p={projectAsRow(p)} />
          <PaymentDetailCell p={projectAsRow(p)} />
        </div>
      )}
      <FulfillmentCell p={projectAsRow(p)} />

      <div className="pt-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Bid Instruction</p>
        <CommentCell
          id={p.id}
          apiRole="admin"
          noteHistory={notesToHistory(p.notes)}
          onAddNote={onAddNote}
        />
      </div>

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
      </div>

      {!hideClientFinanceCols && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
          <span className="font-medium text-[#065F46] truncate flex items-center gap-1.5">
            {p.csr?.csrCode && !p.projectSource && (
              <span className="bg-[#B8112D]/10 text-[#B8112D] text-[9px] font-bold px-1.5 py-0.5 rounded-md">{p.csr.csrCode}</span>
            )}
            {projectAssigneeLabel(p)}
          </span>
          {p.email && <span className="text-gray-400 truncate max-w-[140px]">{p.email}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Projects list section ── */
function ProjectsSection({
  projects,
  page,
  setPage,
  loading,
  search,
  onView,
  onReassign,
  onAddNote,
  hideClientFinanceCols = false,
}: {
  projects: Project[];
  page: number;
  setPage: (p: number) => void;
  loading: boolean;
  search: string;
  onView: (p: Project) => void;
  onReassign: (p: Project) => void;
  onAddNote: (id: string, text: string) => Promise<unknown>;
  hideClientFinanceCols?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const paginated  = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const headers = hideClientFinanceCols
    ? ["Project Detail", "Client Deadline", "Bid Instruction", ""]
    : ["Client Detail", "Project Detail", "Quoted", "Payment Detail", "Client Deadline", "CSR", "Bid Instruction", ""];
  const colCount = headers.length;
  const colWidths = hideClientFinanceCols ? TECHNICAL_PROJECT_COLS : ADMIN_PROJECT_COLS;

  return (
    <div>
      <div className="lg:hidden space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-32 animate-pulse" />
          ))
        ) : projects.length > 0 ? (
          paginated.map((p) => (
            <ProjectCard
              key={p.id}
              p={p}
              onView={() => onView(p)}
              onReassign={() => void onReassign(p)}
              onAddNote={onAddNote}
              hideClientFinanceCols={hideClientFinanceCols}
            />
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
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, projects.length)} of {projects.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
              <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
            </div>
          </div>
        )}
      </div>

      <div className={`hidden lg:block ${PROJECT_TABLE_CARD}`}>
        <div className="overflow-x-auto">
          <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: hideClientFinanceCols ? "720px" : "1280px" }}
          >
            <CsrColGroup widths={colWidths} />
            <thead className={CSR_THEAD}>
              <tr className="text-left">
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 xl:px-4 py-3 xl:py-4 whitespace-nowrap ${PROJECT_TABLE_HEAD} ${
                      i === colCount - 1 ? "text-right" : ""
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
                    {Array.from({ length: colCount }, (_, j) => (
                      <td key={j} className="px-3 xl:px-4 py-4 xl:py-5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-16 xl:w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : projects.length > 0 ? (
                paginated.map((p) => (
                  <tr key={p.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-all align-top">
                    {!hideClientFinanceCols && (
                      <td className="px-3 xl:px-4 py-3 xl:py-4"><ClientDetailCell p={projectAsRow(p)} /></td>
                    )}
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><ProjectDetailCell p={projectAsRow(p)} /></td>
                    {!hideClientFinanceCols && (
                      <>
                        <td className="px-3 xl:px-4 py-3 xl:py-4"><QuotedAmountCell p={projectAsRow(p)} /></td>
                        <td className="px-3 xl:px-4 py-3 xl:py-4"><PaymentDetailCell p={projectAsRow(p)} /></td>
                      </>
                    )}
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><FulfillmentCell p={projectAsRow(p)} /></td>
                    {!hideClientFinanceCols && (
                      <td className="px-3 xl:px-4 py-3 xl:py-4">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {p.csr?.csrCode && !p.projectSource && (
                            <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">{p.csr.csrCode}</span>
                          )}
                          <span className="text-xs xl:text-sm font-semibold text-[#065F46] truncate">{projectAssigneeLabel(p)}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-3 xl:px-4 py-3 xl:py-4">
                      <CommentCell
                        id={p.id}
                        apiRole="admin"
                        noteHistory={notesToHistory(p.notes)}
                        onAddNote={onAddNote}
                      />
                    </td>
                    <td className="px-3 xl:px-4 py-3 xl:py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {!hideClientFinanceCols && (
                          <button
                            onClick={() => void onReassign(p)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-[10px] xl:text-xs font-medium hover:bg-blue-200 flex items-center gap-1 shrink-0"
                          >
                            <ArrowRightLeft size={11} />
                            <span className="hidden xl:inline">Reassign</span>
                          </button>
                        )}
                        <button
                          onClick={() => onView(p)}
                          className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 shrink-0"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={colCount} className="py-16 xl:py-20 text-center">
                    <FolderKanban size={36} className="text-gray-200 mx-auto mb-3 xl:w-10 xl:h-10" />
                    <p className="font-semibold text-gray-400 text-sm xl:text-base">No projects found</p>
                    <p className="text-xs xl:text-sm text-gray-300 mt-1">
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
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, projects.length)} of {projects.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
              <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 30;

function projectAssigneeLabel(p: Project): string {
  if (p.projectSource?.trim()) return p.projectSource.trim();
  if (p.csr?.csrCode) return p.csr.name ?? "—";
  return p.csr?.name ?? "Unassigned";
}

export default function AdminProjectsPage() {
  const pathname = usePathname();
  const hideClientFinanceCols = pathname?.startsWith("/technical") ?? false;
  const StaffSidebar = useStaffSidebar();
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [stats,     setStats]     = useState<Stats>({ total: 0, withBudget: 0, thisMonth: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [filterCSR, setFilterCSR] = useState("all");
  const [allCsrs,     setAllCsrs]     = useState<CSROption[]>([]);
  const [workbenchProject, setWorkbenchProject] = useState<Project | null>(null);
  const [workbenchSaving, setWorkbenchSaving]   = useState(false);
  const [projectTab,  setProjectTab]  = useState<"all" | "active">("all");
  const [page,        setPage]        = useState(1);
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");

  /* ── Reassign modal ── */
  const [showReassign,  setShowReassign]  = useState(false);
  const [reassignProj,  setReassignProj]  = useState<Project | null>(null);
  const [csrOpts,       setCsrOpts]       = useState<CSROption[]>([]);
  const [selCsrId,      setSelCsrId]      = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [csrOptsLoaded, setCsrOptsLoaded] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addDraft,     setAddDraft]     = useState<ProjectWorkbenchData | null>(null);
  const [addSaving,    setAddSaving]    = useState(false);

  const applyClientLookup = useCallback((client: ClientLookupData) => {
    setAddDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        name: client.name || d.name,
        company: client.company || d.company,
        email: client.email || d.email,
        state: client.state || d.state,
        interestedService: d.interestedService || client.interestedService || "",
      };
    });
  }, []);

  const { phoneLookupLoading, returningClient, resetLookup, onPhoneValueChange, onPhoneBlur, onPhonePaste } =
    useClientPhoneLookup(applyClientLookup, "/admin/lookup-by-phone");

  const resetAddModal = useCallback(() => {
    setShowAddModal(false);
    setAddDraft(null);
    resetLookup();
  }, [resetLookup]);

  const openAddModal = useCallback(() => {
    resetLookup();
    setAddDraft({
      ...emptyWorkbench(),
      assignedTo: filterCSR !== "all" ? filterCSR : "",
    });
    setShowAddModal(true);
  }, [filterCSR, resetLookup]);

  const saveNewProject = async (data: ProjectWorkbenchData) => {
    if (data.assignedTo === CSR_ASSIGN_OTHER && !(data.projectSource ?? "").trim()) {
      toast.error("Enter the external resource name for Other.");
      return;
    }
    if (!data.name.trim()) { toast.error("Client name is required."); return; }
    if (!data.projectTitle.trim()) { toast.error("Project title is required."); return; }
    if (!data.interestedService) { toast.error("Please select a service."); return; }
    if (!data.projectDeadline) { toast.error("Deadline is required."); return; }
    setAddSaving(true);
    try {
      const res = await API.post("/admin/project", {
        csrId:             data.assignedTo || undefined,
        projectSource:     data.projectSource?.trim() || undefined,
        name:              data.name.trim(),
        company:           data.company.trim() || undefined,
        phone:             data.phone.trim() || undefined,
        email:             data.email.trim() || undefined,
        ownerName:         data.ownerName.trim() || undefined,
        state:             data.state.trim() || undefined,
        projectCode:       data.projectCode.trim() || undefined,
        projectTitle:      data.projectTitle.trim(),
        projectScope:      data.projectScope.trim() || undefined,
        interestedService: data.interestedService,
        projectDeadline:   data.projectDeadline,
        projectBudget:     data.projectBudget.trim() || undefined,
        projectNotes:      data.projectNotes?.trim() || undefined,
        projectPhase:      data.projectPhase,
        takeoffDeadline:   data.takeoffDeadline || undefined,
        pricingDeadline:   data.pricingDeadline || undefined,
        qaDeadline:        data.qaDeadline || undefined,
        projectPayments:   data.projectPayments,
        status:            "Close Client",
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => [lead, ...prev]);
      setStats((s) => ({ ...s, total: s.total + 1 }));
      toast.success("Project added");
      resetAddModal();
      void fetchProjects();
    } catch {
      toast.error("Failed to save project. Please try again.");
    } finally {
      setAddSaving(false);
    }
  };

  const addAdminNote = async (id: string, text: string) => {
    const res = await API.post(`/admin/lead/${id}/notes`, { text });
    const note = res.data.note as { id: string; text: string; createdAt: string };
    const entry: NoteEntry = { id: note.id, text: note.text, createdAt: note.createdAt };
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes: [...(p.notes ?? []), note] } : p))
    );
    setWorkbenchProject((prev) =>
      prev?.id === id ? { ...prev, notes: [...(prev.notes ?? []), note] } : prev
    );
    return entry;
  };

  const saveWorkbench = async (data: ProjectWorkbenchData) => {
    setWorkbenchSaving(true);
    try {
      const isOther = data.assignedTo === CSR_ASSIGN_OTHER;
      const res = await API.put(`/admin/project/${data.id}`, {
        name: data.name,
        company: data.company,
        phone: data.phone,
        email: data.email,
        ownerName: data.ownerName,
        state: data.state,
        projectCode: data.projectCode,
        projectTitle: data.projectTitle,
        projectScope: data.projectScope,
        interestedService: data.interestedService,
        projectBudget: data.projectBudget,
        projectDeadline: data.projectDeadline,
        projectPhase: data.projectPhase,
        takeoffDeadline: data.takeoffDeadline,
        pricingDeadline: data.pricingDeadline,
        qaDeadline: data.qaDeadline,
        projectPayments: data.projectPayments,
        assignedTo: isOther ? undefined : data.assignedTo,
        projectSource: isOther ? data.projectSource : "",
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      setWorkbenchProject((prev) => (prev?.id === lead.id ? { ...prev, ...lead } : prev));
      toast.success("Project updated");
    } catch {
      toast.error("Failed to save project");
    } finally {
      setWorkbenchSaving(false);
    }
  };

  const deleteWorkbenchProject = async () => {
    if (!workbenchProject) return;
    try {
      await API.delete(`/admin/lead/${workbenchProject.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== workbenchProject.id));
      setStats((s) => ({ ...s, total: Math.max(0, s.total - 1) }));
      setWorkbenchProject(null);
      toast.success("Project deleted");
      void fetchProjects();
    } catch {
      toast.error("Failed to delete project");
      throw new Error("delete failed");
    }
  };

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
      const params: Record<string, string> = {
        lite: "1",
        page: String(page),
        limit: "50",
      };
      if (filterCSR !== "all") params.csrId = filterCSR;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (search.trim()) params.search = search.trim();
      const res = await API.get("/admin/projects", { params });
      setProjects(res.data.leads ?? []);
      setStats(res.data.stats   ?? { total: 0, withBudget: 0, thisMonth: 0 });
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [filterCSR, dateFrom, dateTo, page, search]);

  useEffect(() => {
    API.get("/admin/csrs")
      .then(res => setAllCsrs(res.data.csrs ?? []))
      .catch(() => {});
  }, []);
//
  useEffect(() => {
    void fetchProjects();
  }, [filterCSR, dateFrom, dateTo, page, search, fetchProjects]);

  const csrList: [string, string][] = allCsrs.length > 0
    ? allCsrs.map((c): [string, string] => [c.id, c.name])
    : Array.from(
        new Map<string, string>(
          projects
            .filter((p): p is Project & { csr: NonNullable<Project["csr"]> } => !!p.csr?.id)
            .map((p): [string, string] => [p.csr.id, p.csr.name ?? "Unknown"]),
        ),
      );

  const baseFiltered = projects.filter((p) => {
    const q = search.toLowerCase();
    const csrName = projectAssigneeLabel(p);
    const matchSearch =
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.projectTitle ?? "").toLowerCase().includes(q) ||
      (p.company ?? "").toLowerCase().includes(q) ||
      (p.interestedService ?? "").toLowerCase().includes(q) ||
      csrName.toLowerCase().includes(q) ||
      (p.projectSource ?? "").toLowerCase().includes(q) ||
      (p.uploadFile?.companyName ?? "").toLowerCase().includes(q);
    const matchState = matchesStateLocationFilter(p.state, p.phone, stateFilter);
    const matchPhone = matchesPhoneAreaCodeFilter(p.phone, phoneFilter);
    return matchSearch && matchState && matchPhone && (filterCSR === "all" || p.csr?.id === filterCSR);
  });

  const allProjects    = baseFiltered;
  const activeProjects = baseFiltered.filter(isProjectActive);
  const displayedProjects = projectTab === "all" ? allProjects : activeProjects;

  const phasePieData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      const key = p.projectPhase ?? "not_started";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, value]) => ({ name: phaseLabel(key), value, key }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [projects]);

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster
        position="top-right"
        toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }}
      />
      <StaffSidebar />

      {/* ─── MAIN ─── */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        {/* HEADER */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
              Project DB
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              {hideClientFinanceCols
                ? "Active projects — filter by date, view all or active only."
                : "All CSR projects — filter by date, view all or active only."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!hideClientFinanceCols && (
              <button
                type="button"
                onClick={openAddModal}
                className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] transition-colors"
              >
                <Plus size={14} /> Add New Project
              </button>
            )}
            <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold w-fit">
              <div className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
              Live Data
            </div>
          </div>
        </div>

        {/* PROJECTS OVERVIEW */}
        <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <ProjectOverviewCharts loading={loading} stats={stats} phasePieData={phasePieData} />
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-5">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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

            {!hideClientFinanceCols && (
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
            )}

            <StateFilterDropdown value={stateFilter} onChange={v => { setStateFilter(v); setPage(1); }} />
            <PhoneAreaCodeFilterInput value={phoneFilter} onChange={v => { setPhoneFilter(v); setPage(1); }} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
            <div className="flex items-center gap-2 flex-1 sm:max-w-md">
              <Calendar size={15} className="text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="flex-1 h-10 sm:h-11 bg-white border border-gray-200 rounded-xl px-3 text-sm outline-none focus:border-[#B8112D]"
              />
              <span className="text-xs text-gray-400 shrink-0">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="flex-1 h-10 sm:h-11 bg-white border border-gray-200 rounded-xl px-3 text-sm outline-none focus:border-[#B8112D]"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                className="h-10 px-4 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-all"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* ALL / ACTIVE TABS */}
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-5">
          {([
            { key: "all" as const,    label: "All Projects",    count: allProjects.length,    sub: "New, old, completed & in-progress" },
            { key: "active" as const, label: "Active Projects", count: activeProjects.length, sub: "Currently in progress only" },
          ]).map(tab => {
            const active = projectTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setProjectTab(tab.key); setPage(1); }}
                className={`flex flex-col items-start px-4 py-3 rounded-xl sm:rounded-2xl border-2 transition-all text-left min-w-[140px] sm:min-w-[180px] ${
                  active
                    ? "border-[#B8112D] bg-[#FFF1F3] shadow-sm"
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className={`text-sm font-bold ${active ? "text-[#B8112D]" : "text-gray-800"}`}>
                    {tab.label}
                  </span>
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-lg ${
                    active ? "bg-[#B8112D] text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                    {tab.count}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1 leading-snug">{tab.sub}</p>
              </button>
            );
          })}
        </div>

        <ProjectsSection
          projects={displayedProjects}
          page={page}
          setPage={setPage}
          loading={loading}
          search={search}
          onView={setWorkbenchProject}
          onReassign={openReassign}
          onAddNote={addAdminNote}
          hideClientFinanceCols={hideClientFinanceCols}
        />

        <ProjectWorkbenchModal
          open={!!workbenchProject}
          onClose={() => setWorkbenchProject(null)}
          initial={workbenchProject ? projectToWorkbench(workbenchProject) : emptyWorkbench()}
          mode="admin"
          csrs={allCsrs}
          saving={workbenchSaving}
          onSave={saveWorkbench}
          onDelete={deleteWorkbenchProject}
          noteHistory={workbenchProject ? notesToHistory(workbenchProject.notes) : undefined}
          onAddNote={workbenchProject ? async (text) => { await addAdminNote(workbenchProject.id, text); } : undefined}
          hideClientFinanceSections={hideClientFinanceCols}
        />

        <ProjectWorkbenchModal
          open={showAddModal && !!addDraft}
          onClose={resetAddModal}
          initial={addDraft ?? emptyWorkbench()}
          mode="admin"
          createMode
          csrs={allCsrs}
          saving={addSaving}
          onSave={saveNewProject}
          hideClientFinanceSections={hideClientFinanceCols}
          phoneLookup={{
            phoneLookupLoading,
            returningClient,
            onPhoneValueChange,
            onPhoneBlur,
            onPhonePaste,
          }}
        />

      {/* ══ REASSIGN CSR MODAL ══ */}
      {showReassign && reassignProj && !hideClientFinanceCols && (
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