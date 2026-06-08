"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderKanban, CalendarDays, DollarSign, TrendingUp,
  Search, Filter, Activity, Phone, AlignLeft, Briefcase,
  X, FileText, BarChart2, PenTool, Pencil, Building2, Monitor, Eye,
  CheckCircle2, Clock3, ChevronDown, Plus, User2,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";

const serviceOptions = [
  { value: "Estimating",   label: "Estimating",   Icon: BarChart2   },
  { value: "Scheduling",   label: "Scheduling",   Icon: CalendarDays },
  { value: "Shop Drawing", label: "Shop Drawing", Icon: PenTool     },
  { value: "Drafting",     label: "Drafting",     Icon: Pencil      },
  { value: "BIM",          label: "BIM",          Icon: Building2   },
  { value: "IT",           label: "IT",           Icon: Monitor     },
];

type ProjectType = {
  id: string; projectTitle: string; client: string; company: string;
  status: string; deadline: string; budget: string; budgetNum: number;
  notes: string; service: string; timezone: string; phone: string;
  closedAt: string;
};

type LeadType = {
  id?: string | number; status: string; name?: string; company?: string;
  projectTitle?: string; project_title?: string; ProjectTitle?: string; title?: string;
  projectName?: string; project_name?: string; projectDeadline?: string;
  project_deadline?: string; ProjectDeadline?: string; deadline?: string; nextSchedule?: string;
  projectBudget?: string | number; project_budget?: string | number;
  ProjectBudget?: string | number; budget?: string | number;
  projectNotes?: string; project_notes?: string; ProjectNotes?: string;
  notes?: string; followUpNotes?: string; interestedService?: string;
  interested_service?: string; service?: string; serviceInterested?: string;
  serviceName?: string; services?: string; timezone?: string; phone?: string;
  updatedAt?: string;
};

const parseBudget = (raw: string | number | null | undefined): number => {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const isDeadlinePast = (deadline: string): boolean => {
  if (!deadline || deadline === "N/A") return false;
  return deadline < new Date().toISOString().split("T")[0];
};

/* ── Empty form state ── */
const emptyForm = {
  clientName:    "",
  clientCompany: "",
  clientPhone:   "",
  projectTitle:  "",
  service:       "",
  deadline:      "",
  budget:        "",
  notes:         "",
};

export default function CSRProjectsPage() {
  const [isOpen,       setIsOpen]       = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [search,       setSearch]       = useState("");
  const [projects,     setProjects]     = useState<ProjectType[]>([]);

  /* DETAIL + EDIT MODAL */
  const [viewingProject, setViewingProject] = useState<ProjectType | null>(null);
  const [isEditing,      setIsEditing]      = useState(false);
  const [editTitle,      setEditTitle]      = useState("");
  const [editDeadline,   setEditDeadline]   = useState("");
  const [editBudget,     setEditBudget]     = useState("");
  const [editNotes,      setEditNotes]      = useState("");
  const [editService,    setEditService]    = useState("");
  const [saving,         setSaving]         = useState(false);

  /* ACTION DROPDOWN */
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── ADD NEW PROJECT MODAL ── */
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [addForm,       setAddForm]       = useState(emptyForm);
  const [addSaving,     setAddSaving]     = useState(false);
  const [addError,      setAddError]      = useState("");

  /* Close action menu on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpenActionMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* FETCH */
  const fetchProjects = async () => {
    try {
      const res = await API.get("/csr/projects");
      const formatted = (res.data.leads ?? [])
        .map((lead: LeadType) => {
          const projectTitle = lead.projectTitle ?? lead.project_title ?? lead.ProjectTitle
            ?? lead.title ?? lead.projectName ?? lead.project_name ?? lead.name ?? "Untitled Project";
          const deadline = lead.projectDeadline ?? lead.project_deadline ?? lead.ProjectDeadline
            ?? lead.deadline ?? lead.nextSchedule ?? "N/A";
          const budget  = lead.projectBudget ?? lead.project_budget ?? lead.ProjectBudget ?? lead.budget ?? "";
          const notes   = lead.projectNotes  ?? lead.project_notes  ?? lead.ProjectNotes
            ?? lead.notes ?? lead.followUpNotes ?? "";
          const service = lead.interestedService ?? lead.interested_service ?? lead.service
            ?? lead.serviceInterested ?? lead.serviceName ?? lead.services ?? "N/A";

          const deadlineStr      = String(deadline);
          const backendCompleted = lead.status === "completed";
          const pastDeadline     = isDeadlinePast(deadlineStr);
          const derivedStatus    = backendCompleted || pastDeadline ? "Completed" : "In Progress";

          return {
            id:           String(lead.id),
            projectTitle: String(projectTitle),
            client:       String(lead.name    || "Unknown"),
            company:      String(lead.company || "N/A"),
            status:       derivedStatus,
            deadline:     deadlineStr,
            budget:       String(budget),
            budgetNum:    parseBudget(budget),
            notes:        String(notes),
            service:      String(service),
            timezone:     String(lead.timezone || "N/A"),
            phone:        String(lead.phone    || "N/A"),
            closedAt:     lead.updatedAt ? String(lead.updatedAt).split("T")[0] : "N/A",
          };
        });
      setProjects(formatted);
    } catch (error) { console.log(error); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchProjects(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  /* FILTER */
  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => {
      const matchesDate   = selectedDate ? p.deadline === selectedDate : true;
      const matchesSearch =
        (p.projectTitle ?? "").toLowerCase().includes(q) ||
        (p.client       ?? "").toLowerCase().includes(q) ||
        (p.company      ?? "").toLowerCase().includes(q);
      return matchesDate && matchesSearch;
    });
  }, [selectedDate, search, projects]);

  /* STATS */
  const totalProjects   = projects.length;
  const allTimeSales    = projects.reduce((acc, p) => acc + p.budgetNum, 0);
  const todayStr        = new Date().toISOString().split("T")[0];
  const todaySales      = projects.filter(p => p.closedAt === todayStr).reduce((acc, p) => acc + p.budgetNum, 0);
  const inProgressCount = projects.filter(p => p.status === "In Progress").length;

  /* OPEN DETAIL */
  const openDetail = (project: ProjectType) => {
    setViewingProject(project);
    setIsEditing(false);
  };

  /* START EDITING */
  const startEdit = (project?: ProjectType) => {
    const target = project ?? viewingProject;
    if (!target) return;
    if (!viewingProject || viewingProject.id !== target.id) setViewingProject(target);
    setEditTitle(target.projectTitle);
    setEditDeadline(target.deadline === "N/A" ? "" : target.deadline);
    setEditBudget(target.budget);
    setEditNotes(target.notes !== "undefined" ? target.notes : "");
    setEditService(target.service !== "N/A" ? target.service : "");
    setIsEditing(true);
    setOpenActionMenu(null);
  };

  /* MARK COMPLETE */
  const markComplete = async (project: ProjectType) => {
    setOpenActionMenu(null);
    try {
      await API.put(`/csr/lead/${project.id}`, { status: "completed" });
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: "Completed" } : p));
      if (viewingProject?.id === project.id)
        setViewingProject(prev => prev ? { ...prev, status: "Completed" } : prev);
    } catch (error) { console.log(error); }
  };

  /* SAVE EDIT */
  const saveEdit = async () => {
    if (!viewingProject || !editTitle || !editDeadline) return;
    setSaving(true);
    const autoComplete  = isDeadlinePast(editDeadline);
    const newStatus     = autoComplete ? "completed" : "Close Client";
    const displayStatus = autoComplete ? "Completed" : "In Progress";
    try {
      await API.put(`/csr/lead/${viewingProject.id}`, {
        projectTitle: editTitle, projectDeadline: editDeadline,
        projectBudget: editBudget, projectNotes: editNotes,
        interestedService: editService, status: newStatus,
      });
      const updated: ProjectType = {
        ...viewingProject, projectTitle: editTitle, deadline: editDeadline,
        budget: editBudget, budgetNum: parseBudget(editBudget),
        notes: editNotes, service: editService, status: displayStatus,
      };
      setProjects(prev => prev.map(p => p.id === viewingProject.id ? updated : p));
      setViewingProject(updated);
      setIsEditing(false);
    } catch (error) { console.log(error); }
    setSaving(false);
  };

  /* ── ADD NEW PROJECT ── */
  const handleAddProject = async () => {
    const { clientName, projectTitle, service, deadline } = addForm;
    if (!clientName.trim())   { setAddError("Client name is required.");   return; }
    if (!projectTitle.trim()) { setAddError("Project title is required.");  return; }
    if (!service)             { setAddError("Please select a service.");    return; }
    if (!deadline)            { setAddError("Deadline is required.");       return; }

    setAddSaving(true);
    setAddError("");
    try {
      const res = await API.post("/csr/project", {
        name:             addForm.clientName.trim(),
        company:          addForm.clientCompany.trim() || undefined,
        phone:            addForm.clientPhone.trim()   || undefined,
        projectTitle:     addForm.projectTitle.trim(),
        interestedService:addForm.service,
        projectDeadline:  addForm.deadline,
        projectBudget:    addForm.budget.trim() || undefined,
        projectNotes:     addForm.notes.trim()  || undefined,
        status:           "Close Client",
      });

      /* Add to local state immediately */
      const newLead = res.data.lead;
      const autoCompleted = isDeadlinePast(addForm.deadline);

      const newProject: ProjectType = {
        id:           String(newLead?.id ?? Date.now()),
        projectTitle: addForm.projectTitle.trim(),
        client:       addForm.clientName.trim(),
        company:      addForm.clientCompany.trim() || "N/A",
        status:       autoCompleted ? "Completed" : "In Progress",
        deadline:     addForm.deadline,
        budget:       addForm.budget.trim(),
        budgetNum:    parseBudget(addForm.budget),
        notes:        addForm.notes.trim(),
        service:      addForm.service,
        timezone:     "N/A",
        phone:        addForm.clientPhone.trim() || "N/A",
        closedAt:     new Date().toISOString().split("T")[0],
      };

      setProjects(prev => [newProject, ...prev]);
      setShowAddModal(false);
      setAddForm(emptyForm);
    } catch (error) {
      console.log(error);
      setAddError("Failed to save project. Please try again.");
    }
    setAddSaving(false);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* HEADER */}
        <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[30px] sm:text-[36px] font-bold text-[#0F172A]">Projects Dashboard</h1>
            <p className="text-gray-500 mt-1 text-sm">Manage and track your won projects.</p>
          </div>
          {/* ── ADD NEW PROJECT BUTTON ── */}
          <button
            onClick={() => { setAddForm(emptyForm); setAddError(""); setShowAddModal(true); }}
            className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] transition-colors shrink-0"
          >
            <Plus size={16}/>Add New Project
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {[
            { label:"Total Projects", value: String(totalProjects),                                                icon:<FolderKanban size={24}/> },
            { label:"All Time Sales", value: allTimeSales > 0 ? `$${allTimeSales.toLocaleString()}` : "N/A",      icon:<DollarSign   size={24}/> },
            { label:"In Progress",    value: String(inProgressCount),                                             icon:<Activity     size={24}/> },
            { label:"Today Sales",    value: todaySales    > 0 ? `$${todaySales.toLocaleString()}`    : "N/A",    icon:<TrendingUp   size={24}/> },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-[28px] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div><p className="text-gray-500 text-sm">{c.label}</p><h2 className="text-[28px] font-bold text-[#0F172A] mt-2">{c.value}</h2></div>
                <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">{c.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className="bg-white rounded-[30px] shadow-sm p-5 mt-7">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="relative w-full xl:max-w-[380px]">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input type="text" placeholder="Search by project title or client..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-[52px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-11 pr-4 text-sm outline-none focus:border-[#B8112D]"/>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[#B8112D] font-semibold text-sm"><Filter size={16}/>Filter by Deadline</div>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="h-[50px] rounded-2xl border border-gray-200 px-4 bg-[#FAFAFA] text-sm outline-none focus:border-[#B8112D]"/>
              {selectedDate && (
                <button onClick={() => setSelectedDate("")}
                  className="h-[50px] px-4 rounded-2xl border border-gray-200 bg-[#FAFAFA] text-sm text-gray-500 hover:text-[#B8112D] transition-all">Clear</button>
              )}
            </div>
          </div>
        </div>

        {/* TABLE */}
        {filteredProjects.length > 0 ? (
          <div className="bg-white rounded-[30px] shadow-sm mt-7 overflow-hidden">
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-[#F3F3F3] bg-[#FAFAFA] rounded-t-[30px]">
              {["Project / Client","Company","Scope","Contact","Deadline","Status","Actions"].map(h => (
                <span key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-[#F3F3F3]" ref={menuRef}>
              {filteredProjects.map(project => (
                <div key={project.id}
                  className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-[#FAFAFA] transition-colors">

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">{project.projectTitle.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{project.projectTitle}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{project.client}</p>
                    </div>
                  </div>

                  <div><p className="text-sm text-[#0F172A] truncate">{project.company !== "N/A" ? project.company : <span className="text-gray-400">N/A</span>}</p></div>

                  <div>{project.service && project.service !== "N/A" ? <span className="text-sm text-[#0F172A]">{project.service}</span> : <span className="text-sm text-gray-400">N/A</span>}</div>

                  <div>{project.phone && project.phone !== "N/A" ? <span className="text-sm text-[#0F172A]">{project.phone}</span> : <span className="text-sm text-gray-400">N/A</span>}</div>

                  <div>
                    {project.deadline && project.deadline !== "N/A" ? (
                      <span className={`text-sm font-medium ${isDeadlinePast(project.deadline) ? "text-red-500" : "text-[#0F172A]"}`}>{project.deadline}</span>
                    ) : <span className="text-sm text-gray-400">N/A</span>}
                  </div>

                  <div>
                    {project.status === "Completed" ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-xl text-[12px] font-semibold whitespace-nowrap">
                        <CheckCircle2 size={11}/> Completed
                      </span>
                    ) : (
                      <span className="inline-block bg-[#FFF7E6] text-[#B54708] px-3 py-1 rounded-xl text-[12px] font-semibold whitespace-nowrap">In Progress</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => openDetail(project)}
                      className="w-9 h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity">
                      <Eye size={15}/>
                    </button>
                    <div className="relative">
                      <button onClick={() => setOpenActionMenu(openActionMenu === project.id ? null : project.id)}
                        className="h-9 px-3 rounded-xl bg-[#EFF6FF] text-[#3B82F6] flex items-center gap-1 hover:opacity-80 transition-opacity text-xs font-semibold">
                        <Pencil size={13}/><ChevronDown size={12}/>
                      </button>
                      {openActionMenu === project.id && (
                        <div className="absolute right-0 top-11 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                          <button onClick={() => markComplete(project)} disabled={project.status === "Completed"}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-green-50 flex items-center gap-2 text-green-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            <CheckCircle2 size={15} className="text-green-600"/>Mark Completed
                          </button>
                          <button onClick={() => { openDetail(project); setTimeout(() => startEdit(project), 30); }}
                            className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 flex items-center gap-2 text-blue-700 font-medium transition-colors">
                            <Pencil size={15} className="text-blue-500"/>Edit Project
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[30px] shadow-sm p-16 mt-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-5"><FolderKanban size={28}/></div>
            <h2 className="text-[22px] font-bold text-[#0F172A]">No Projects Yet</h2>
            <p className="text-gray-500 mt-2 text-sm">Projects appear when a client is marked &ldquo;Close Client&rdquo; — or add one manually.</p>
            <button onClick={() => { setAddForm(emptyForm); setAddError(""); setShowAddModal(true); }}
              className="mt-5 inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold hover:bg-[#a30f27] transition-colors">
              <Plus size={15}/>Add New Project
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════
            ADD NEW PROJECT MODAL
        ══════════════════════════════════════ */}
        {showAddModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-[560px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight:"92vh" }}>

              {/* Header */}
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none"/>
                <button onClick={() => setShowAddModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={15}/>
                </button>
                <div className="flex items-center gap-3 pr-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Plus size={22} className="text-white"/>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">Add New Project</h2>
                    <p className="text-white/65 text-xs mt-0.5">Manually add a project for any client</p>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-5 sm:px-6 py-5 space-y-5">

                  {/* Error */}
                  {addError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl">
                      {addError}
                    </div>
                  )}

                  {/* ── CLIENT INFO ── */}
                  <div className="bg-[#F8F9FC] rounded-2xl p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <User2 size={14} className="text-[#B8112D]"/>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Client Information</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Client Name <span className="text-[#B8112D]">*</span>
                      </label>
                      <input type="text" value={addForm.clientName} placeholder="e.g. John Smith"
                        onChange={e => setAddForm(f => ({ ...f, clientName: e.target.value }))}
                        className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"/>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Company</label>
                        <input type="text" value={addForm.clientCompany} placeholder="Company name"
                          onChange={e => setAddForm(f => ({ ...f, clientCompany: e.target.value }))}
                          className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"/>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Phone</label>
                        <input type="text" value={addForm.clientPhone} placeholder="+1 234 567 890"
                          onChange={e => setAddForm(f => ({ ...f, clientPhone: e.target.value }))}
                          className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"/>
                      </div>
                    </div>
                  </div>

                  {/* ── PROJECT TITLE ── */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <FileText size={11} className="text-[#B8112D]"/>Project Title <span className="text-[#B8112D]">*</span>
                    </label>
                    <input type="text" value={addForm.projectTitle} placeholder="e.g. BIM Modeling Phase 1"
                      onChange={e => setAddForm(f => ({ ...f, projectTitle: e.target.value }))}
                      className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"/>
                  </div>

                  {/* ── SERVICE ── */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Briefcase size={11} className="text-[#B8112D]"/>Service Type <span className="text-[#B8112D]">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {serviceOptions.map(({ value, label, Icon }) => {
                        const isSel = addForm.service === value;
                        return (
                          <button key={value} onClick={() => setAddForm(f => ({ ...f, service: value }))}
                            className={`relative py-3 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-[11px] font-semibold ${
                              isSel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"
                            }`}>
                            {isSel && (
                              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-[#B8112D] rounded-full flex items-center justify-center">
                                <CheckCircle2 size={9} className="text-white"/>
                              </span>
                            )}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}>
                              <Icon size={15} className={isSel ? "text-[#B8112D]" : "text-gray-400"}/>
                            </div>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── DEADLINE + BUDGET ── */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Clock3 size={11} className="text-[#B8112D]"/>Deadline <span className="text-[#B8112D]">*</span>
                      </label>
                      <input type="date" value={addForm.deadline}
                        onChange={e => setAddForm(f => ({ ...f, deadline: e.target.value }))}
                        className={`w-full h-11 rounded-2xl border-2 px-3 text-sm outline-none transition-colors ${
                          addForm.deadline && isDeadlinePast(addForm.deadline)
                            ? "border-green-400 bg-green-50 text-green-800"
                            : "border-gray-200 bg-[#FAFAFA] focus:border-[#B8112D] focus:bg-white"
                        }`}/>
                      {addForm.deadline && (
                        <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-xl ${
                          isDeadlinePast(addForm.deadline)
                            ? "bg-green-50 border border-green-200 text-green-700"
                            : "bg-blue-50 border border-blue-200 text-blue-600"
                        }`}>
                          {isDeadlinePast(addForm.deadline)
                            ? <><CheckCircle2 size={10}/> Status: Completed</>
                            : <><Clock3 size={10}/> Status: In Progress</>}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <DollarSign size={11} className="text-[#B8112D]"/>Budget
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="text" placeholder="0.00" value={addForm.budget.replace(/^\$/, "")}
                          onChange={e => setAddForm(f => ({ ...f, budget: e.target.value }))}
                          className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] pl-7 pr-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"/>
                      </div>
                    </div>
                  </div>

                  {/* ── NOTES ── */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <AlignLeft size={11} className="text-[#B8112D]"/>Notes
                    </label>
                    <textarea value={addForm.notes} placeholder="Any project notes..." rows={3}
                      onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"/>
                  </div>

                  {/* ── BUTTONS ── */}
                  <div className="flex gap-3 pb-2">
                    <button onClick={() => setShowAddModal(false)}
                      className="flex-1 h-12 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleAddProject} disabled={addSaving}
                      className={`flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                        !addSaving
                          ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200"
                          : "bg-gray-200 cursor-not-allowed text-gray-400"
                      }`}>
                      {addSaving ? (
                        <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Saving...</>
                      ) : <><Plus size={15}/>Add Project</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== DETAIL / EDIT MODAL ===================== */}
        {viewingProject && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-[540px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight:"92vh" }}>

              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none"/>
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none"/>
                <button onClick={() => { setViewingProject(null); setIsEditing(false); }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={15}/>
                </button>
                <div className="flex items-center gap-3 pr-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {viewingProject.projectTitle.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate">
                      {isEditing ? "Edit Project" : viewingProject.projectTitle}
                    </h2>
                    <p className="text-white/65 text-xs mt-0.5 truncate">
                      {viewingProject.client}
                      {viewingProject.company !== "N/A" && viewingProject.company !== viewingProject.client ? ` · ${viewingProject.company}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {viewingProject.status === "Completed" ? (
                    <span className="inline-flex items-center gap-1 bg-green-500/25 text-green-100 border border-green-400/30 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                      <CheckCircle2 size={10}/> Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-400/25 text-amber-100 border border-amber-300/30 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                      <Clock3 size={10}/> In Progress
                    </span>
                  )}
                  {viewingProject.deadline && viewingProject.deadline !== "N/A" && (
                    isDeadlinePast(viewingProject.deadline) ? (
                      <span className="inline-flex items-center gap-1 bg-red-500/25 text-red-100 border border-red-400/30 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                        <Clock3 size={10}/> Overdue · {viewingProject.deadline}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-white/15 text-white/75 px-2.5 py-1 rounded-full text-[11px]">
                        <CalendarDays size={10}/> {viewingProject.deadline}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-5 sm:px-6 py-5 space-y-5">

                  {!isEditing && (
                    <div className="flex gap-3">
                      {viewingProject.status !== "Completed" && (
                        <button onClick={() => markComplete(viewingProject)}
                          className="flex-1 h-10 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-green-100 transition-colors">
                          <CheckCircle2 size={14}/> Mark Completed
                        </button>
                      )}
                      <button onClick={() => startEdit()}
                        className="flex-1 h-10 rounded-2xl bg-[#FFF1F3] border border-[#f5c5ce] text-[#B8112D] text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#fce8ec] transition-colors">
                        <Pencil size={13}/> Edit Project
                      </button>
                    </div>
                  )}

                  {!isEditing && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { icon: <Briefcase    size={12} className="text-[#B8112D]"/>, label:"Service",  value: viewingProject.service                },
                          { icon: <Phone        size={12} className="text-[#B8112D]"/>, label:"Contact",  value: viewingProject.phone                  },
                          { icon: <DollarSign   size={12} className="text-[#B8112D]"/>, label:"Budget",   value: viewingProject.budget || "Not set"    },
                          { icon: <CalendarDays size={12} className="text-[#B8112D]"/>, label:"Timezone", value: viewingProject.timezone               },
                        ].map(({ icon, label, value }) => (
                          <div key={label} className="bg-[#F8F9FC] rounded-2xl p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">{icon}<p className="text-gray-400 text-[11px]">{label}</p></div>
                            <h4 className="font-semibold text-[#0F172A] text-[13px] break-words">{value || "N/A"}</h4>
                          </div>
                        ))}
                      </div>
                      {viewingProject.notes && viewingProject.notes !== "undefined" && viewingProject.notes !== "" && (
                        <div className="bg-[#F8F9FC] rounded-2xl p-3.5">
                          <div className="flex items-center gap-1.5 mb-1.5"><AlignLeft size={12} className="text-[#B8112D]"/><p className="text-gray-400 text-[11px]">Notes</p></div>
                          <p className="text-[#0F172A] text-[13px] leading-relaxed">{viewingProject.notes}</p>
                        </div>
                      )}
                    </>
                  )}

                  {isEditing && (
                    <>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><FileText size={11} className="text-[#B8112D]"/>Project Title</label>
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Enter project title"
                          className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"/>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Briefcase size={11} className="text-[#B8112D]"/>Service Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {serviceOptions.map(({ value, label, Icon }) => {
                            const isSel = editService === value;
                            return (
                              <button key={value} onClick={() => setEditService(value)}
                                className={`relative py-3 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-[11px] font-semibold ${isSel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"}`}>
                                {isSel && <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-[#B8112D] rounded-full flex items-center justify-center"><CheckCircle2 size={9} className="text-white"/></span>}
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}><Icon size={15} className={isSel ? "text-[#B8112D]" : "text-gray-400"}/></div>
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Clock3 size={11} className="text-[#B8112D]"/>Deadline</label>
                          <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                            className={`w-full h-11 rounded-2xl border-2 px-3 text-sm outline-none transition-colors ${editDeadline && isDeadlinePast(editDeadline) ? "border-green-400 bg-green-50 text-green-800" : "border-gray-200 bg-[#FAFAFA] focus:border-[#B8112D] focus:bg-white"}`}/>
                          {editDeadline && (
                            <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-xl ${isDeadlinePast(editDeadline) ? "bg-green-50 border border-green-200 text-green-700" : "bg-blue-50 border border-blue-200 text-blue-600"}`}>
                              {isDeadlinePast(editDeadline) ? <><CheckCircle2 size={10}/> → Completed</> : <><Clock3 size={10}/> → In Progress</>}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><DollarSign size={11} className="text-[#B8112D]"/>Budget</label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input type="text" placeholder="0.00" value={editBudget.replace(/^\$/, "")} onChange={e => setEditBudget(e.target.value)}
                              className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] pl-7 pr-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"/>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><AlignLeft size={11} className="text-[#B8112D]"/>Notes</label>
                        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Add project notes..."
                          className="w-full rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"/>
                      </div>
                      <div className="flex gap-3 pb-1">
                        <button onClick={() => setIsEditing(false)} className="flex-1 h-12 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Cancel</button>
                        <button onClick={saveEdit} disabled={!editTitle || !editDeadline || saving}
                          className={`flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${editTitle && editDeadline && !saving ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"}`}>
                          {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Saving...</> : "Save Changes"}
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