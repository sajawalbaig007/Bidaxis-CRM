"use client";

import { useMemo, useState } from "react";
import {
  FolderKanban, CalendarDays, DollarSign,
  Search, Filter, Phone, AlignLeft, Briefcase,
  X, FileText, Eye, Clock3, CheckCircle2,
  Plus, User2, Pencil, Hash, Mail, StickyNote,
} from "lucide-react";

import TopNavbar from "../components/navigation/TopNavbar";
import ServicePicker from "../components/shared/ServicePicker";
import StackedHorizontalBarChart, { StackedBarRow } from "../components/shared/StackedHorizontalBarChart";
import Pagination from "../components/shared/Pagination";
import PaymentStatusCircle from "../components/shared/PaymentStatusCircle";
import SendEmailButton from "../components/shared/SendEmailButton";
import EmailField from "../components/shared/EmailField";
import ProjectDetailsForm from "../components/shared/ProjectDetailsForm";
import CommentCell from "../components/shared/CommentCell";

import { useProjectsData, Project, parseBudget, isDeadlinePast } from "../hooks/useProjectsData";
import { NoteEntry } from "../hooks/useLeadsData";
import { getTimezoneAbbr, tzBadgeClass } from "../constants/timezoneAbbr";
import API from "@/lib/api";

const emptyForm = {
  clientName: "", clientCompany: "", clientPhone: "",
  projectCode: "", projectTitle: "", service: "", deadline: "", budget: "", notes: "",
};
const PAGE_SIZE = 30;

function DeadlineStatus({ deadline }: { deadline: string }) {
  if (!deadline) return null;
  const past = isDeadlinePast(deadline);
  return (
    <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-semibold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl ${
      past ? "bg-green-50 border border-green-200 text-green-700" : "bg-blue-50 border border-blue-200 text-blue-600"
    }`}>
      {past ? <><CheckCircle2 size={10} /> Status: Completed</> : <><Clock3 size={10} /> Status: In Progress</>}
    </div>
  );
}

export default function CSRProjectsPage() {
  const { projects, setProjects, loading } = useProjectsData();

  const [selectedDate, setSelectedDate] = useState("");
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);

  const [viewingProject,  setViewingProject]  = useState<Project | null>(null);
  const [isEditing,       setIsEditing]       = useState(false);
  const [editProjectCode, setEditProjectCode] = useState("");
  const [editEmail,       setEditEmail]       = useState("");
  const [editTitle,       setEditTitle]       = useState("");
  const [editDeadline,    setEditDeadline]    = useState("");
  const [editBudget,      setEditBudget]      = useState("");
  const [editPaidAmount,  setEditPaidAmount]  = useState("");
  const [editNotes,       setEditNotes]       = useState("");
  const [editService,     setEditService]     = useState("");
  const [saving,          setSaving]          = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm,      setAddForm]      = useState(emptyForm);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addError,     setAddError]     = useState("");

  /* ── Derived ── */
  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => {
      const matchesDate   = selectedDate ? p.deadline === selectedDate : true;
      const matchesSearch = !q || (p.projectTitle ?? "").toLowerCase().includes(q) ||
        (p.client ?? "").toLowerCase().includes(q) || (p.company ?? "").toLowerCase().includes(q);
      return matchesDate && matchesSearch;
    });
  }, [selectedDate, search, projects]);

  const totalPages     = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const paginated      = filteredProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allTimeSales   = useMemo(() => projects.reduce((s, p) => s + p.budgetNum, 0), [projects]);
  const todayStr       = new Date().toISOString().split("T")[0];
  const todaySales     = useMemo(() => projects.filter(p => p.closedAt === todayStr).reduce((s, p) => s + p.budgetNum, 0), [projects, todayStr]);
  const inProgressCnt  = useMemo(() => projects.filter(p => p.status === "In Progress").length, [projects]);
  const completedCnt   = useMemo(() => projects.filter(p => p.status === "Completed").length,   [projects]);

  const chartRows = useMemo<StackedBarRow[]>(() => [
    {
      label: "Project Status",
      segments: [
        { label: "Completed",  value: completedCnt,  color: "#15803D" },
        { label: "In Progress", value: inProgressCnt, color: "#F59E0B" },
      ],
    },
    {
      label: "Sales",
      segments: [
        { label: "Today",    value: todaySales,              color: "#B8112D" },
        { label: "Previous", value: allTimeSales - todaySales, color: "#94A3B8" },
      ],
    },
  ], [inProgressCnt, completedCnt, allTimeSales, todaySales]);

  /* ── Actions ── */
  const openDetail = (project: Project) => { setViewingProject(project); setIsEditing(false); };

  const startEdit = (project?: Project) => {
    const target = project ?? viewingProject;
    if (!target) return;
    if (!viewingProject || viewingProject.id !== target.id) setViewingProject(target);
    setEditProjectCode(target.projectCode);
    setEditEmail(target.email);
    setEditTitle(target.projectTitle);
    setEditDeadline(target.deadline === "N/A" ? "" : target.deadline);
    setEditBudget(target.budget);
    setEditPaidAmount(target.paidAmount);
    setEditNotes(target.notes !== "undefined" ? target.notes : "");
    setEditService(target.service !== "N/A" ? target.service : "");
    setIsEditing(true);
  };

  const markComplete = async (project: Project) => {
    try {
      await API.put(`/csr/lead/${project.id}`, { status: "completed" });
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: "Completed" } : p));
      if (viewingProject?.id === project.id)
        setViewingProject(prev => prev ? { ...prev, status: "Completed" } : prev);
    } catch (error) { console.log(error); }
  };

  const addNote = async (id: string, text: string) => {
    const res = await API.post(`/csr/lead/${id}/notes`, { text });
    const note: NoteEntry = res.data.note
      ? { id: res.data.note.id, text: res.data.note.text, createdAt: res.data.note.createdAt }
      : { id: Date.now().toString(), text, createdAt: new Date().toISOString() };
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, noteHistory: [...(p.noteHistory ?? []), note] } : p
    ));
    if (viewingProject?.id === id)
      setViewingProject(prev => prev ? { ...prev, noteHistory: [...(prev.noteHistory ?? []), note] } : prev);
  };

  const saveEdit = async () => {
    if (!viewingProject || !editTitle || !editDeadline) return;
    setSaving(true);
    const autoComplete  = isDeadlinePast(editDeadline);
    const newStatus     = autoComplete ? "completed" : "Close Client";
    const displayStatus = autoComplete ? "Completed" : "In Progress";
    const budgetNum     = parseBudget(editBudget);
    const paidAmountNum = parseBudget(editPaidAmount);
    const paidPercent   = budgetNum > 0 ? (paidAmountNum / budgetNum) * 100 : 0;
    try {
      await API.put(`/csr/lead/${viewingProject.id}`, {
        projectCode: editProjectCode, email: editEmail, projectTitle: editTitle, projectDeadline: editDeadline,
        projectBudget: editBudget, paidAmount: editPaidAmount, projectNotes: editNotes,
        interestedService: editService, status: newStatus,
      });
      const updated: Project = {
        ...viewingProject, projectCode: editProjectCode, email: editEmail, projectTitle: editTitle, deadline: editDeadline,
        budget: editBudget, budgetNum, paidAmount: editPaidAmount, paidAmountNum, paidPercent,
        notes: editNotes, service: editService, status: displayStatus,
      };
      setProjects(prev => prev.map(p => p.id === viewingProject.id ? updated : p));
      setViewingProject(updated); setIsEditing(false);
    } catch (error) { console.log(error); }
    setSaving(false);
  };

  const handleAddProject = async () => {
    const { clientName, projectTitle, service, deadline } = addForm;
    if (!clientName.trim())   { setAddError("Client name is required.");  return; }
    if (!projectTitle.trim()) { setAddError("Project title is required."); return; }
    if (!service)             { setAddError("Please select a service.");   return; }
    if (!deadline)            { setAddError("Deadline is required.");      return; }
    setAddSaving(true); setAddError("");
    try {
      const res = await API.post("/csr/project", {
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
      const nl = res.data.lead;
      const autoCompleted = isDeadlinePast(addForm.deadline);
      const newProject: Project = {
        id:            String(nl?.id ?? Date.now()),
        projectCode:   addForm.projectCode.trim(),
        projectTitle:  addForm.projectTitle.trim(),
        client:        addForm.clientName.trim(),
        company:       addForm.clientCompany.trim() || "N/A",
        email:         "",
        status:        autoCompleted ? "Completed" : "In Progress",
        state:         "N/A",
        deadline:      addForm.deadline,
        budget:        addForm.budget.trim(),
        budgetNum:     parseBudget(addForm.budget),
        paidAmount:    "",
        paidAmountNum: 0,
        paidPercent:   0,
        notes:         addForm.notes.trim(),
        service:       addForm.service,
        timezone:      "N/A",
        phone:         addForm.clientPhone.trim() || "N/A",
        closedAt:      new Date().toISOString().split("T")[0],
        clientCode:    null,
        noteHistory:   [],
      };
      setProjects(prev => [newProject, ...prev]);
      setShowAddModal(false); setAddForm(emptyForm);
    } catch (error) {
      console.log(error);
      setAddError("Failed to save project. Please try again.");
    }
    setAddSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <TopNavbar />
      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">

        {/* ── HEADER ── */}
        <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] lg:text-[34px] font-bold text-[#0F172A] leading-tight">Projects Dashboard</h1>
            <p className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-sm">Manage and track your won projects.</p>
          </div>
          <button
            onClick={() => { setAddForm(emptyForm); setAddError(""); setShowAddModal(true); }}
            className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] transition-colors shrink-0 w-full sm:w-auto"
          >
            <Plus size={14} className="sm:w-4 sm:h-4" />Add New Project
          </button>
        </div>

        {/* ── STATS CHART ── */}
        <div className="mt-4 sm:mt-7">
          <StackedHorizontalBarChart
            title="Pipeline by stage and type"
            subtitle="Project status breakdown and today's vs all-time sales."
            rows={chartRows}
            loading={loading}
          />
        </div>

        {/* ── FILTERS ── */}
        <div className="bg-white rounded-2xl sm:rounded-[28px] shadow-sm p-4 sm:p-5 mt-4 sm:mt-7 border border-white">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4">
            <div className="relative w-full xl:max-w-[380px]">
              <Search size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[18px] sm:h-[18px]" />
              <input
                type="text"
                placeholder="Search by project title or client..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full h-11 sm:h-[50px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-10 sm:pl-11 pr-4 text-xs sm:text-sm outline-none focus:border-[#B8112D]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[#B8112D] font-semibold text-xs sm:text-sm">
                <Filter size={13} className="sm:w-4 sm:h-4" />Filter by Deadline
              </div>
              <input
                type="date" value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setPage(1); }}
                className="h-10 sm:h-[50px] rounded-xl sm:rounded-2xl border border-gray-200 px-3 sm:px-4 bg-[#FAFAFA] text-xs sm:text-sm outline-none focus:border-[#B8112D]"
              />
              {selectedDate && (
                <button onClick={() => setSelectedDate("")}
                  className="h-10 sm:h-[50px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] text-xs sm:text-sm text-gray-500 hover:text-[#B8112D] transition-all">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        {loading ? (
          <div className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm mt-4 sm:mt-7 p-4 sm:p-6 space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                <div className="flex-1 grid grid-cols-4 gap-3">
                  {[1,2,3,4].map(j => <div key={j} className="h-4 bg-gray-100 rounded" />)}
                </div>
              </div>
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm mt-4 sm:mt-7 overflow-hidden border border-white">

            {/* ── MOBILE CARDS (< lg) ── */}
            <div className="lg:hidden divide-y divide-[#F3F3F3]">
              {paginated.map(project => (
                <div key={project.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0 font-bold text-sm">
                        {project.client.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{project.client}</p>
                        <p className="text-xs text-gray-400 truncate">{project.company !== "N/A" ? project.company : project.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => openDetail(project)}
                        className="w-8 h-8 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => { openDetail(project); setTimeout(() => startEdit(project), 30); }}
                        className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center">
                        <Pencil size={13} />
                      </button>
                      {project.status !== "Completed" && (
                        <button onClick={() => markComplete(project)}
                          className="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center">
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400 text-[10px]">Project</p>
                      <p className="font-semibold text-[#0F172A] truncate">{project.projectTitle || <span className="text-gray-400 font-normal">N/A</span>}</p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {project.deadline && project.deadline !== "N/A" && (
                          <span className={`text-[10px] font-medium ${isDeadlinePast(project.deadline) ? "text-red-500" : "text-gray-400"}`}>{project.deadline}</span>
                        )}
                        {project.status === "Completed" ? (
                          <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md text-[9px] font-semibold"><CheckCircle2 size={8} /> Completed</span>
                        ) : (
                          <span className="inline-block bg-[#FFF7E6] text-[#B54708] px-1.5 py-0.5 rounded-md text-[9px] font-semibold">In Progress</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div>
                        <p className="text-gray-400 text-[10px]">Payment</p>
                        <PaymentStatusCircle percent={project.paidPercent} size={32} strokeWidth={3} />
                      </div>
                      <div>
                        <p className="text-gray-400 text-[10px]">Quotation</p>
                        <p className="font-semibold text-[#0F172A]">{project.budgetNum > 0 ? `$${project.budgetNum.toLocaleString()}` : "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(project.clientCode || project.projectCode) && (
                      <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-2 py-0.5 rounded-lg">{project.clientCode || project.projectCode}</span>
                    )}
                    {project.service && project.service !== "N/A" && (
                      <span className="bg-gray-100 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded-lg">{project.service}</span>
                    )}
                    {project.email && (
                      <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-lg truncate max-w-[180px]">{project.email}</span>
                    )}
                  </div>

                  <div className="pt-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <StickyNote size={9} />Notes
                    </p>
                    <CommentCell id={project.id} noteHistory={project.noteHistory} onAddNote={addNote} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── DESKTOP TABLE (lg+) ── */}
            <div className="hidden lg:block overflow-x-auto">
              <div>
                <div className="grid grid-cols-[0.7fr_1.5fr_1.1fr_1.4fr_52px_0.8fr_0.7fr_1.1fr_auto] gap-3 xl:gap-4 px-5 xl:px-6 py-3 xl:py-4 border-b border-[#F3F3F3] bg-[#FAFAFA]">
                  {["Project Code","Client Detail","Email","Project Detail","Payment","Scope","Quotation","Notes","Actions"].map(h => (
                    <span key={h} className="text-[10px] xl:text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</span>
                  ))}
                </div>

                <div className="divide-y divide-[#F3F3F3]">
                  {paginated.map(project => (
                    <div
                      key={project.id}
                      className="grid grid-cols-[0.7fr_1.5fr_1.1fr_1.4fr_52px_0.8fr_0.7fr_1.1fr_auto] gap-3 xl:gap-4 px-5 xl:px-6 py-3 xl:py-4 items-start hover:bg-[#FAFAFA] transition-colors"
                    >
                      {/* Project Code */}
                      <div className="min-w-0">
                        {(project.clientCode || project.projectCode) ? (
                          <span className="inline-flex bg-[#B8112D]/10 text-[#B8112D] text-[10px] xl:text-[11px] font-bold px-2 py-1 rounded-lg truncate">{project.clientCode || project.projectCode}</span>
                        ) : <span className="text-xs text-gray-400">N/A</span>}
                      </div>

                      {/* Client Detail */}
                      <div className="flex items-center gap-2 xl:gap-3 min-w-0">
                        <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                          <span className="text-xs xl:text-sm font-bold">{project.client.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs xl:text-sm font-semibold text-[#0F172A] truncate">{project.client}</p>
                            {(() => {
                              const tz = getTimezoneAbbr(project.state !== "N/A" ? project.state : null);
                              return tz ? (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>
                                  {tz}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <p className="text-[10px] xl:text-xs text-gray-400 truncate mt-0.5">
                            {project.company !== "N/A" ? project.company : project.phone}
                          </p>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="min-w-0">
                        {project.email ? (
                          <span className="text-xs xl:text-sm text-[#0F172A] truncate block">{project.email}</span>
                        ) : <span className="text-xs text-gray-400">N/A</span>}
                      </div>

                      {/* Project Detail */}
                      <div className="min-w-0">
                        {project.projectTitle
                          ? <p className="text-xs xl:text-sm font-semibold text-[#0F172A] truncate">{project.projectTitle}</p>
                          : <span className="text-xs text-gray-400">N/A</span>
                        }
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {project.deadline && project.deadline !== "N/A" && (
                            <span className={`text-[10px] xl:text-[11px] font-medium whitespace-nowrap ${isDeadlinePast(project.deadline) ? "text-red-500" : "text-gray-400"}`}>
                              {project.deadline}
                            </span>
                          )}
                          {project.status === "Completed" ? (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-1.5 xl:px-2 py-0.5 rounded-md text-[9px] xl:text-[10px] font-semibold whitespace-nowrap">
                              <CheckCircle2 size={9} /> Completed
                            </span>
                          ) : (
                            <span className="inline-block bg-[#FFF7E6] text-[#B54708] px-1.5 xl:px-2 py-0.5 rounded-md text-[9px] xl:text-[10px] font-semibold whitespace-nowrap">
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Payment Status */}
                      <div className="flex items-center justify-center">
                        <PaymentStatusCircle percent={project.paidPercent} size={34} strokeWidth={3.5} />
                      </div>

                      {/* Scope */}
                      <div className="min-w-0">
                        {project.service && project.service !== "N/A" ? (
                          <span className="text-xs xl:text-sm text-[#0F172A] truncate block">{project.service}</span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </div>

                      {/* Quotation */}
                      <div className="min-w-0">
                        {project.budgetNum > 0 ? (
                          <span className="inline-flex bg-emerald-50 text-emerald-700 text-xs xl:text-sm font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap">${project.budgetNum.toLocaleString()}</span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </div>

                      {/* Notes */}
                      <div className="min-w-0 py-1">
                        <CommentCell
                          id={project.id}
                          noteHistory={project.noteHistory}
                          onAddNote={addNote}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 xl:gap-2">
                        <button onClick={() => openDetail(project)}
                          className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity">
                          <Eye size={13} className="xl:w-[15px] xl:h-[15px]" />
                        </button>
                        <button onClick={() => { openDetail(project); setTimeout(() => startEdit(project), 30); }}
                          className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center hover:opacity-80 transition-opacity">
                          <Pencil size={13} className="xl:w-[15px] xl:h-[15px]" />
                        </button>
                        {project.status !== "Completed" && (
                          <button onClick={() => markComplete(project)}
                            className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-green-50 text-green-700 flex items-center justify-center hover:opacity-80 transition-opacity">
                            <CheckCircle2 size={13} className="xl:w-[15px] xl:h-[15px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredProjects.length}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-10 sm:p-12 lg:p-16 mt-4 sm:mt-7 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-4 sm:mb-5">
              <FolderKanban size={24} className="sm:w-7 sm:h-7" />
            </div>
            <h2 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">No Projects Yet</h2>
            <p className="text-gray-500 mt-1.5 sm:mt-2 text-xs sm:text-sm">
              Projects appear when a client is marked &ldquo;Close Client&rdquo; — or add one manually.
            </p>
            <button
              onClick={() => { setAddForm(emptyForm); setAddError(""); setShowAddModal(true); }}
              className="mt-4 sm:mt-5 inline-flex items-center gap-2 h-10 sm:h-11 px-5 sm:px-6 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold hover:bg-[#a30f27] transition-colors"
            >
              <Plus size={13} className="sm:w-[15px] sm:h-[15px]" />Add New Project
            </button>
          </div>
        )}

        {/* ══ ADD NEW PROJECT MODAL ══ */}
        {showAddModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="w-full sm:max-w-[540px] lg:max-w-[560px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <button onClick={() => setShowAddModal(false)}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className="flex items-center gap-2.5 sm:gap-3 pr-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Plus size={18} className="text-white sm:w-[22px] sm:h-[22px]" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white">Add New Project</h2>
                    <p className="text-white/65 text-[10px] sm:text-xs mt-0.5">Manually add a project for any client</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">
                  {addError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl">
                      {addError}
                    </div>
                  )}

                  <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2">
                      <User2 size={12} className="text-[#B8112D] sm:w-[14px] sm:h-[14px]" />
                      <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Client Information</p>
                    </div>
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-1.5 block">
                        Client Name <span className="text-[#B8112D]">*</span>
                      </label>
                      <input type="text" value={addForm.clientName} placeholder="e.g. John Smith"
                        onChange={e => setAddForm(f => ({ ...f, clientName: e.target.value }))}
                        className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-white px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-1.5 block">Company</label>
                        <input type="text" value={addForm.clientCompany} placeholder="Company name"
                          onChange={e => setAddForm(f => ({ ...f, clientCompany: e.target.value }))}
                          className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-white px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-1.5 block">Phone</label>
                        <input type="text" value={addForm.clientPhone} placeholder="+1 234 567 890"
                          onChange={e => setAddForm(f => ({ ...f, clientPhone: e.target.value }))}
                          className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-white px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <Hash size={10} className="text-[#B8112D] sm:w-2.75 sm:h-2.75" />
                      Project Code <span className="text-gray-300 normal-case">(optional)</span>
                    </label>
                    <input type="text" value={addForm.projectCode} placeholder="e.g. BIM-2024-001"
                      onChange={e => setAddForm(f => ({ ...f, projectCode: e.target.value }))}
                      className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <FileText size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                      Project Title <span className="text-[#B8112D]">*</span>
                    </label>
                    <input type="text" value={addForm.projectTitle} placeholder="e.g. BIM Modeling Phase 1"
                      onChange={e => setAddForm(f => ({ ...f, projectTitle: e.target.value }))}
                      className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <Briefcase size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                      Service Type <span className="text-[#B8112D]">*</span>
                    </label>
                    <ServicePicker value={addForm.service} onChange={v => setAddForm(f => ({ ...f, service: v }))} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                        <Clock3 size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                        Deadline <span className="text-[#B8112D]">*</span>
                      </label>
                      <input type="date" value={addForm.deadline}
                        onChange={e => setAddForm(f => ({ ...f, deadline: e.target.value }))}
                        className={`w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 px-2 sm:px-3 text-xs sm:text-sm outline-none transition-colors ${
                          addForm.deadline && isDeadlinePast(addForm.deadline)
                            ? "border-green-400 bg-green-50 text-green-800"
                            : "border-gray-200 bg-[#FAFAFA] focus:border-[#B8112D] focus:bg-white"
                        }`}
                      />
                      {addForm.deadline && <DeadlineStatus deadline={addForm.deadline} />}
                    </div>
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                        <DollarSign size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />Budget
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="text" placeholder="0.00" value={addForm.budget.replace(/^\$/, "")}
                          onChange={e => setAddForm(f => ({ ...f, budget: e.target.value }))}
                          className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] pl-6 sm:pl-7 pr-2 sm:pr-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <AlignLeft size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />Notes
                    </label>
                    <textarea value={addForm.notes} placeholder="Any project notes..." rows={3}
                      onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"
                    />
                  </div>

                  <div className="flex gap-2 sm:gap-3 pb-1 sm:pb-2">
                    <button onClick={() => setShowAddModal(false)}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleAddProject} disabled={addSaving}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                        !addSaving ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"
                      }`}>
                      {addSaving
                        ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
                        : <><Plus size={14} />Add Project</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ DETAIL / EDIT MODAL ══ */}
        {viewingProject && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="w-full sm:max-w-[520px] lg:max-w-[540px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <button
                  onClick={() => { setViewingProject(null); setIsEditing(false); }}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10"
                >
                  <X size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className="flex items-center gap-2.5 sm:gap-3 pr-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-base sm:text-xl font-bold shrink-0">
                    {viewingProject.projectTitle.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight truncate">
                      {isEditing ? "Edit Project" : viewingProject.projectTitle}
                    </h2>
                    <p className="text-white/65 text-[10px] sm:text-xs mt-0.5 truncate">
                      {viewingProject.client}
                      {viewingProject.company !== "N/A" && viewingProject.company !== viewingProject.client
                        ? ` · ${viewingProject.company}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {viewingProject.projectCode && (
                    <span className="inline-flex items-center gap-1 bg-white/20 text-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold">
                      <Hash size={9} className="sm:w-[10px] sm:h-[10px]" /> {viewingProject.projectCode}
                    </span>
                  )}
                  {viewingProject.status === "Completed" ? (
                    <span className="inline-flex items-center gap-1 bg-green-500/25 text-green-100 border border-green-400/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold">
                      <CheckCircle2 size={9} className="sm:w-[10px] sm:h-[10px]" /> Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-400/25 text-amber-100 border border-amber-300/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold">
                      <Clock3 size={9} className="sm:w-[10px] sm:h-[10px]" /> In Progress
                    </span>
                  )}
                  {viewingProject.deadline && viewingProject.deadline !== "N/A" && (
                    isDeadlinePast(viewingProject.deadline) ? (
                      <span className="inline-flex items-center gap-1 bg-red-500/25 text-red-100 border border-red-400/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold">
                        <Clock3 size={9} /> Overdue · {viewingProject.deadline}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-white/15 text-white/75 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px]">
                        <CalendarDays size={9} /> {viewingProject.deadline}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">

                  {/* EMAIL */}
                  {isEditing ? (
                    <EmailField email={editEmail} onEmailChange={setEditEmail} />
                  ) : (
                    <div className="flex items-center justify-between gap-2 sm:gap-3 bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
                      <div className="min-w-0 flex items-center gap-2 sm:gap-2.5">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center shrink-0">
                          <Mail size={13} className="sm:w-3.75 sm:h-3.75" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-gray-400 text-[10px] sm:text-[11px]">Email</p>
                          <p className="text-[#0F172A] text-xs sm:text-[13px] font-semibold truncate">{viewingProject.email || "Not provided"}</p>
                        </div>
                      </div>
                      <SendEmailButton email={viewingProject.email} subject={`Regarding ${viewingProject.projectTitle}`} />
                    </div>
                  )}

                  {!isEditing && (
                    <>
                      <div className="flex gap-2 sm:gap-3">
                        {viewingProject.status !== "Completed" && (
                          <button onClick={() => markComplete(viewingProject)}
                            className="flex-1 h-9 sm:h-10 rounded-xl sm:rounded-2xl bg-green-50 border border-green-200 text-green-700 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-green-100 transition-colors">
                            <CheckCircle2 size={12} className="sm:w-[14px] sm:h-[14px]" /> Mark Completed
                          </button>
                        )}
                        <button onClick={() => startEdit()}
                          className="flex-1 h-9 sm:h-10 rounded-xl sm:rounded-2xl bg-[#FFF1F3] border border-[#f5c5ce] text-[#B8112D] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#fce8ec] transition-colors">
                          <Pencil size={11} className="sm:w-[13px] sm:h-[13px]" /> Edit Project
                        </button>
                      </div>

                      <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                            <DollarSign size={11} className="text-[#B8112D] sm:w-3 sm:h-3" />
                            <p className="text-gray-400 text-[10px] sm:text-[11px]">Payment Status</p>
                          </div>
                          <h4 className="font-semibold text-[#0F172A] text-[12px] sm:text-[13px] break-words">
                            {viewingProject.paidAmountNum > 0 ? `$${viewingProject.paidAmountNum.toLocaleString()} paid` : "Nothing paid yet"}
                            {viewingProject.budgetNum > 0 && ` of $${viewingProject.budgetNum.toLocaleString()} quotation`}
                          </h4>
                        </div>
                        <PaymentStatusCircle percent={viewingProject.paidPercent} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {[
                          { icon: <Briefcase    size={11} className="text-[#B8112D] sm:w-3 sm:h-3" />, label: "Service",   value: viewingProject.service              },
                          { icon: <Phone        size={11} className="text-[#B8112D] sm:w-3 sm:h-3" />, label: "Contact",   value: viewingProject.phone                },
                          { icon: <DollarSign   size={11} className="text-[#B8112D] sm:w-3 sm:h-3" />, label: "Quotation",  value: viewingProject.budget || "Not set"  },
                          { icon: <CalendarDays size={11} className="text-[#B8112D] sm:w-3 sm:h-3" />, label: "Timezone",  value: viewingProject.timezone             },
                          { icon: <FolderKanban size={11} className="text-[#B8112D] sm:w-3 sm:h-3" />, label: "State",     value: viewingProject.state                },
                        ].map(({ icon, label, value }) => (
                          <div key={label} className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
                            <div className="flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">{icon}<p className="text-gray-400 text-[10px] sm:text-[11px]">{label}</p></div>
                            <h4 className="font-semibold text-[#0F172A] text-[12px] sm:text-[13px] break-words">{value || "N/A"}</h4>
                          </div>
                        ))}
                      </div>

                      {viewingProject.notes && viewingProject.notes !== "undefined" && viewingProject.notes !== "" && (
                        <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                            <AlignLeft size={11} className="text-[#B8112D] sm:w-3 sm:h-3" />
                            <p className="text-gray-400 text-[10px] sm:text-[11px]">Project Notes</p>
                          </div>
                          <p className="text-[#0F172A] text-[12px] sm:text-[13px] leading-relaxed">{viewingProject.notes}</p>
                        </div>
                      )}

                      <div className="bg-[#FFFBF0] border border-amber-100 rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
                        <div className="flex items-center gap-1 sm:gap-1.5 mb-2">
                          <StickyNote size={11} className="text-amber-500 sm:w-3 sm:h-3" />
                          <p className="text-amber-700 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">Notes History</p>
                        </div>
                        <CommentCell
                          id={viewingProject.id}
                          noteHistory={viewingProject.noteHistory}
                          onAddNote={addNote}
                        />
                      </div>
                    </>
                  )}

                  {isEditing && (
                    <>
                      <ProjectDetailsForm
                        projectCode={editProjectCode} onProjectCodeChange={setEditProjectCode}
                        title={editTitle} onTitleChange={setEditTitle}
                        service={editService} onServiceChange={setEditService}
                        deadline={editDeadline} onDeadlineChange={setEditDeadline}
                        budget={editBudget} onBudgetChange={setEditBudget}
                        paidAmount={editPaidAmount} onPaidAmountChange={setEditPaidAmount}
                        notes={editNotes} onNotesChange={setEditNotes}
                      />

                      <div className="flex gap-2 sm:gap-3 pb-1">
                        <button onClick={() => setIsEditing(false)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Cancel</button>
                        <button onClick={saveEdit} disabled={!editTitle || !editDeadline || saving}
                          className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                            editTitle && editDeadline && !saving
                              ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200"
                              : "bg-gray-200 cursor-not-allowed text-gray-400"
                          }`}>
                          {saving
                            ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
                            : "Save Changes"
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
