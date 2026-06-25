"use client";

import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, X, Eye,
  Calendar, Building2, User2,
  Phone, Mail, ChevronDown, ArrowRightLeft, Check, RefreshCw,
  Plus, Hash, FileText, Briefcase, Clock3, DollarSign, AlignLeft, Loader2,
} from "lucide-react";

import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import ProjectWorkbenchModal from "@/app/components/projects/ProjectWorkbenchModal";
import CommentCell from "@/app/csr/components/shared/CommentCell";
import ServicePicker from "@/app/csr/components/shared/ServicePicker";
import { NoteEntry } from "@/app/csr/hooks/useLeadsData";
import { useClientPhoneLookup } from "@/app/csr/hooks/useClientPhoneLookup";
import { ADMIN_PROJECT_COLS, CsrColGroup } from "@/app/csr/components/shared/csrTableStyles";
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
} from "@/lib/projectFields";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

type Project = {
  id:                string;
  name:              string | null;
  company:           string | null;
  phone:             string | null;
  email:             string | null;
  status:            string;
  state:             string | null;
  ownerName:         string | null;
  interestedService: string | null;
  projectTitle:      string | null;
  projectCode:       string | null;
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
  return {
    id: p.id,
    name: p.name ?? "",
    company: p.company ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    ownerName: p.ownerName ?? "",
    state: p.state ?? "",
    projectCode: p.projectCode ?? "",
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
    assignedTo: p.csr.id,
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
    ownerName: p.ownerName,
    phone: p.phone,
    email: p.email,
    projectCode: p.projectCode,
    projectTitle: p.projectTitle,
    projectScope: p.projectScope,
    interestedService: p.interestedService,
    projectBudget: p.projectBudget,
    projectDeadline: p.projectDeadline,
    projectPhase: p.projectPhase,
    projectPayments: p.projectPayments,
  };
}

/* ── Projects Card (mobile / tablet) ── */
function ProjectCard({
  p,
  onView,
  onReassign,
  onAddNote,
}: {
  p: Project;
  onView: () => void;
  onReassign: () => void;
  onAddNote: (id: string, text: string) => Promise<unknown>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><ClientDetailCell p={projectAsRow(p)} /></div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onReassign}
            className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100">
            <ArrowRightLeft size={13} />
          </button>
          <button onClick={onView}
            className="w-8 h-8 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80">
            <Eye size={13} />
          </button>
        </div>
      </div>

      <ProjectDetailCell p={projectAsRow(p)} />

      <div className="grid grid-cols-2 gap-3">
        <QuotedAmountCell p={projectAsRow(p)} />
        <PaymentDetailCell p={projectAsRow(p)} />
      </div>
      <FulfillmentCell p={projectAsRow(p)} />

      <div className="pt-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</p>
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

      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
        <span className="font-medium text-[#065F46] truncate flex items-center gap-1.5">
          {p.csr?.csrCode && !p.projectSource && (
            <span className="bg-[#B8112D]/10 text-[#B8112D] text-[9px] font-bold px-1.5 py-0.5 rounded-md">{p.csr.csrCode}</span>
          )}
          {projectAssigneeLabel(p)}
        </span>
        {p.email && <span className="text-gray-400 truncate max-w-[140px]">{p.email}</span>}
      </div>
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
}: {
  projects: Project[];
  page: number;
  setPage: (p: number) => void;
  loading: boolean;
  search: string;
  onView: (p: Project) => void;
  onReassign: (p: Project) => void;
  onAddNote: (id: string, text: string) => Promise<unknown>;
}) {
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const paginated  = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          <table className="w-full table-fixed border-collapse" style={{ minWidth: "1280px" }}>
            <CsrColGroup widths={ADMIN_PROJECT_COLS} />
            <thead className="bg-[#FAFAFA] border-b border-[#F3F3F3]">
              <tr className="text-left">
                {[
                  "Client Detail",
                  "Project Detail",
                  "Quoted",
                  "Payment Detail",
                  "Fulfillment",
                  "CSR",
                  "Email",
                  "Notes",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 xl:px-4 py-3 xl:py-4 whitespace-nowrap ${PROJECT_TABLE_HEAD} ${
                      i === 8 ? "text-right" : ""
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
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => (
                      <td key={j} className="px-3 xl:px-4 py-4 xl:py-5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-16 xl:w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : projects.length > 0 ? (
                paginated.map((p) => (
                  <tr key={p.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-all align-top">
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><ClientDetailCell p={projectAsRow(p)} /></td>
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><ProjectDetailCell p={projectAsRow(p)} /></td>
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><QuotedAmountCell p={projectAsRow(p)} /></td>
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><PaymentDetailCell p={projectAsRow(p)} /></td>
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><FulfillmentCell p={projectAsRow(p)} /></td>
                    <td className="px-3 xl:px-4 py-3 xl:py-4">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {p.csr?.csrCode && !p.projectSource && (
                          <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">{p.csr.csrCode}</span>
                        )}
                        <span className="text-xs xl:text-sm font-semibold text-[#065F46] truncate">{projectAssigneeLabel(p)}</span>
                      </div>
                    </td>
                    <td className="px-3 xl:px-4 py-3 xl:py-4 overflow-hidden">
                      <span className="text-xs text-gray-700 truncate block" title={p.email ?? undefined}>
                        {p.email ?? "—"}
                      </span>
                    </td>
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
                        <button
                          onClick={() => void onReassign(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-[10px] xl:text-xs font-medium hover:bg-blue-200 flex items-center gap-1 shrink-0"
                        >
                          <ArrowRightLeft size={11} />
                          <span className="hidden xl:inline">Reassign</span>
                        </button>
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
                  <td colSpan={9} className="py-16 xl:py-20 text-center">
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
const CSR_OTHER = "__other__";

function projectAssigneeLabel(p: Project): string {
  if (p.projectSource?.trim()) return p.projectSource.trim();
  if (p.csr?.csrCode) return p.csr.name ?? "—";
  return p.csr?.name ?? "Unassigned";
}

const emptyAddForm = {
  csrId:         "",
  projectSource: "",
  clientName:    "",
  clientCompany: "",
  clientPhone:   "",
  projectCode:   "",
  projectTitle:  "",
  service:       "",
  deadline:      "",
  budget:        "",
  notes:         "",
};

function isDeadlinePast(deadline: string) {
  if (!deadline) return false;
  return deadline.split("T")[0] < new Date().toISOString().split("T")[0];
}

export default function AdminProjectsPage() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [stats,     setStats]     = useState<Stats>({ total: 0, withBudget: 0, thisMonth: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
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
  const [addForm,      setAddForm]      = useState(emptyAddForm);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addError,     setAddError]     = useState("");

  const applyClientLookup = useCallback((client: { name: string; company: string; interestedService: string }) => {
    setAddForm(f => ({
      ...f,
      clientName:    client.name    || f.clientName,
      clientCompany: client.company || f.clientCompany,
      service:       f.service || client.interestedService || "",
    }));
  }, []);

  const { phoneLookupLoading, returningClient, resetLookup, onPhoneValueChange, onPhoneBlur, onPhonePaste } =
    useClientPhoneLookup(applyClientLookup, "/admin/lookup-by-phone");

  const resetAddModal = useCallback(() => {
    setShowAddModal(false);
    setAddForm(emptyAddForm);
    setAddError("");
    resetLookup();
  }, [resetLookup]);

  const openAddModal = useCallback(() => {
    setAddForm(f => ({ ...emptyAddForm, csrId: filterCSR !== "all" ? filterCSR : f.csrId }));
    setAddError("");
    resetLookup();
    setShowAddModal(true);
  }, [filterCSR, resetLookup]);

  const handleAddProject = async () => {
    const { csrId, clientName, projectTitle, service, deadline, projectSource } = addForm;
    if (csrId === CSR_OTHER && !projectSource.trim()) {
      setAddError("Enter the external resource name for Other.");
      return;
    }
    if (!clientName.trim())   { setAddError("Client name is required."); return; }
    if (!projectTitle.trim()) { setAddError("Project title is required."); return; }
    if (!service)             { setAddError("Please select a service."); return; }
    if (!deadline)            { setAddError("Deadline is required."); return; }
    setAddSaving(true);
    setAddError("");
    try {
      const res = await API.post("/admin/project", {
        csrId:             csrId || undefined,
        projectSource:     projectSource.trim() || undefined,
        name:              addForm.clientName.trim(),
        company:           addForm.clientCompany.trim() || undefined,
        phone:             addForm.clientPhone.trim()   || undefined,
        projectTitle:      addForm.projectTitle.trim(),
        projectCode:       addForm.projectCode.trim()  || undefined,
        interestedService: addForm.service,
        projectDeadline:   addForm.deadline,
        projectBudget:     addForm.budget.trim()  || undefined,
        projectNotes:      addForm.notes.trim()   || undefined,
        status:            "Close Client",
      });
      const lead = res.data.lead as Project;
      setProjects(prev => [lead, ...prev]);
      setStats(s => ({ ...s, total: s.total + 1 }));
      toast.success("Project added");
      resetAddModal();
      void fetchProjects();
    } catch {
      setAddError("Failed to save project. Please try again.");
    }
    setAddSaving(false);
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
        assignedTo: data.assignedTo,
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
      const params: Record<string, string> = {};
      if (filterCSR !== "all") params.csrId = filterCSR;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await API.get("/admin/projects", { params });
      setProjects(res.data.leads ?? []);
      setStats(res.data.stats   ?? { total: 0, withBudget: 0, thisMonth: 0 });
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [filterCSR, dateFrom, dateTo]);

  useEffect(() => {
    API.get("/admin/csrs")
      .then(res => setAllCsrs(res.data.csrs ?? []))
      .catch(() => {});
  }, []);
//
  useEffect(() => {
    void fetchProjects();
  }, [filterCSR, fetchProjects]);

  const csrList: [string, string][] = allCsrs.length > 0
    ? allCsrs.map((c): [string, string] => [c.id, c.name])
    : Array.from(
        new Map<string, string>(
          projects.map((p): [string, string] => [p.csr.id, p.csr.name ?? "Unknown"]),
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
    return matchSearch && (filterCSR === "all" || p.csr?.id === filterCSR);
  });

  const allProjects    = baseFiltered;
  const activeProjects = baseFiltered.filter(isProjectActive);
  const displayedProjects = projectTab === "all" ? allProjects : activeProjects;

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster
        position="top-right"
        toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }}
      />
      <DashboardSidebar />

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
              All CSR projects — filter by date, view all or active only.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] transition-colors"
            >
              <Plus size={14} /> Add New Project
            </button>
            <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold w-fit">
              <div className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
              Live Data
            </div>
          </div>
        </div>

        {/* PROJECTS OVERVIEW — DONUT CHART */}
        <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Donut */}
            <div className="shrink-0 h-[180px] w-full sm:w-[200px]">
              {loading ? (
                <div className="h-full bg-gray-50 rounded-2xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Total Projects", value: Math.max(stats.total,     0.001) },
                        { name: "This Month",     value: Math.max(stats.thisMonth, 0.001) },
                        { name: "With Budget",    value: Math.max(stats.withBudget,0.001) },
                      ]}
                      cx="50%" cy="50%"
                      innerRadius={52} outerRadius={80}
                      paddingAngle={4} dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill="#B8112D" />
                      <Cell fill="#3B82F6" />
                      <Cell fill="#10B981" />
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      formatter={(_, name) => [
                        name === "Total Projects" ? stats.total :
                        name === "This Month"     ? stats.thisMonth :
                        stats.withBudget,
                        String(name),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend + numbers */}
            <div className="flex-1 grid grid-cols-1 gap-3">
              {[
                { label: "Total Projects", value: stats.total,      color: "bg-[#B8112D]", text: "text-[#B8112D]" },
                { label: "This Month",     value: stats.thisMonth,  color: "bg-blue-500",  text: "text-blue-600"  },
                { label: "With Budget",    value: stats.withBudget, color: "bg-emerald-500",text:"text-emerald-600"},
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl px-4 py-3">
                  <div className={`w-3 h-3 rounded-full ${s.color} shrink-0`} />
                  <p className="flex-1 text-sm font-medium text-gray-600">{s.label}</p>
                  {loading
                    ? <div className="h-6 w-8 bg-gray-100 rounded animate-pulse" />
                    : <span className={`text-xl font-bold ${s.text}`}>{s.value}</span>
                  }
                </div>
              ))}
            </div>
          </div>
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
        />

        <ProjectWorkbenchModal
          open={!!workbenchProject}
          onClose={() => setWorkbenchProject(null)}
          initial={workbenchProject ? projectToWorkbench(workbenchProject) : emptyWorkbench()}
          mode="admin"
          csrs={allCsrs}
          saving={workbenchSaving}
          onSave={saveWorkbench}
          noteHistory={workbenchProject ? notesToHistory(workbenchProject.notes) : undefined}
          onAddNote={workbenchProject ? async (text) => { await addAdminNote(workbenchProject.id, text); } : undefined}
        />

      {/* ══ ADD NEW PROJECT MODAL ══ */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="w-full sm:max-w-[540px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: "92vh" }}
          >
            <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 pt-5 pb-5 shrink-0">
              <button type="button" onClick={resetAddModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                <X size={15} />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Plus size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Add New Project</h2>
                  <p className="text-white/65 text-xs mt-0.5">Assign a project to any CSR</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{addError}</div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Assign to CSR <span className="text-gray-300 normal-case font-normal">(optional)</span>
                </label>
                <select
                  value={addForm.csrId}
                  onChange={e => setAddForm(f => ({
                    ...f,
                    csrId: e.target.value,
                    projectSource: e.target.value === CSR_OTHER ? f.projectSource : "",
                  }))}
                  className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"
                >
                  <option value="">— No CSR —</option>
                  <option value={CSR_OTHER}>Other / External resource…</option>
                  {allCsrs.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.csrCode ? ` (${c.csrCode})` : ""}</option>
                  ))}
                </select>
              </div>

              {(addForm.csrId === CSR_OTHER) && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Resource name <span className="text-[#B8112D]">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.projectSource}
                    placeholder="e.g. Freelancer, Partner agency, Direct client…"
                    onChange={e => setAddForm(f => ({ ...f, projectSource: e.target.value }))}
                    className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"
                  />
                </div>
              )}

              <div className="bg-[#F8F9FC] rounded-2xl p-4 space-y-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User2 size={12} className="text-[#B8112D]" /> Client Information
                </p>

                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Phone <span className="text-gray-300 normal-case font-normal">(paste or type to auto-fill)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={addForm.clientPhone}
                      placeholder="+1 234 567 890"
                      onChange={e => {
                        const value = e.target.value;
                        setAddForm(f => ({ ...f, clientPhone: value }));
                        onPhoneValueChange(value);
                      }}
                      onBlur={e => onPhoneBlur(e.target.value)}
                      onPaste={onPhonePaste}
                      className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 pr-10 text-sm outline-none focus:border-[#B8112D]"
                    />
                    {phoneLookupLoading && (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8112D] animate-spin" />
                    )}
                  </div>
                </div>

                {returningClient && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl">
                    <User2 size={12} className="shrink-0" />
                    Returning client — name &amp; company auto-filled
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Client Name <span className="text-[#B8112D]">*</span>
                  </label>
                  <input type="text" value={addForm.clientName} placeholder="e.g. John Smith"
                    onChange={e => setAddForm(f => ({ ...f, clientName: e.target.value }))}
                    className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Company</label>
                  <input type="text" value={addForm.clientCompany} placeholder="Company name"
                    onChange={e => setAddForm(f => ({ ...f, clientCompany: e.target.value }))}
                    className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Hash size={10} className="text-[#B8112D]" /> Project Code <span className="text-gray-300 normal-case">(optional)</span>
                </label>
                <input type="text" value={addForm.projectCode} placeholder="e.g. BIM-2024-001"
                  onChange={e => setAddForm(f => ({ ...f, projectCode: e.target.value }))}
                  className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <FileText size={10} className="text-[#B8112D]" /> Project Title <span className="text-[#B8112D]">*</span>
                </label>
                <input type="text" value={addForm.projectTitle} placeholder="e.g. BIM Modeling Phase 1"
                  onChange={e => setAddForm(f => ({ ...f, projectTitle: e.target.value }))}
                  className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Briefcase size={10} className="text-[#B8112D]" /> Service Type <span className="text-[#B8112D]">*</span>
                </label>
                <ServicePicker value={addForm.service} onChange={v => setAddForm(f => ({ ...f, service: v }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Clock3 size={10} className="text-[#B8112D]" /> Deadline <span className="text-[#B8112D]">*</span>
                  </label>
                  <input type="date" value={addForm.deadline}
                    onChange={e => setAddForm(f => ({ ...f, deadline: e.target.value }))}
                    className={`w-full h-11 rounded-2xl border-2 px-3 text-sm outline-none ${
                      addForm.deadline && isDeadlinePast(addForm.deadline)
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 bg-[#FAFAFA] focus:border-[#B8112D]"
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <DollarSign size={10} className="text-[#B8112D]" /> Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="text" placeholder="0.00" value={addForm.budget}
                      onChange={e => setAddForm(f => ({ ...f, budget: e.target.value }))}
                      className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] pl-7 pr-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <AlignLeft size={10} className="text-[#B8112D]" /> Notes
                </label>
                <textarea value={addForm.notes} placeholder="Any project notes…" rows={3}
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white resize-none"
                />
              </div>

              <div className="flex gap-3 pb-2">
                <button type="button" onClick={resetAddModal}
                  className="flex-1 h-12 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100">
                  Cancel
                </button>
                <button type="button" onClick={() => void handleAddProject()} disabled={addSaving}
                  className={`flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 ${
                    addSaving ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-[#B8112D] hover:bg-[#a30f27]"
                  }`}>
                  {addSaving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Plus size={14} /> Add Project</>}
                </button>
              </div>
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