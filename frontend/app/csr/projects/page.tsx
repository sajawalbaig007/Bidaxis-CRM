"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FolderKanban, CalendarDays, DollarSign, TrendingUp, Clock3,
  Search, Filter, Activity, Phone, AlignLeft, Briefcase,
  X, FileText, BarChart2, PenTool, Pencil, Building2, Monitor, Eye,
} from "lucide-react";

import CSRNavbar from "../components/CSRNavbar";
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
};

const parseBudget = (raw: string | number | null | undefined): number => {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function CSRProjectsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectType[]>([]);

  /* DETAIL + EDIT MODAL */
  const [viewingProject, setViewingProject] = useState<ProjectType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editService, setEditService] = useState("");
  const [saving, setSaving] = useState(false);

  /* FETCH */
  const fetchProjects = async () => {
    try {
      const res = await API.get("/csr/dashboard");
      const formatted = res.data.leads
        .filter((lead: LeadType) => lead.status === "project won")
        .map((lead: LeadType) => {
          const projectTitle = lead.projectTitle ?? lead.project_title ?? lead.ProjectTitle ?? lead.title ?? lead.projectName ?? lead.project_name ?? lead.name ?? "Untitled Project";
          const deadline = lead.projectDeadline ?? lead.project_deadline ?? lead.ProjectDeadline ?? lead.deadline ?? lead.nextSchedule ?? "N/A";
          const budget = lead.projectBudget ?? lead.project_budget ?? lead.ProjectBudget ?? lead.budget ?? "";
          const notes = lead.projectNotes ?? lead.project_notes ?? lead.ProjectNotes ?? lead.notes ?? lead.followUpNotes ?? "";
          const service = lead.interestedService ?? lead.interested_service ?? lead.service ?? lead.serviceInterested ?? lead.serviceName ?? lead.services ?? "N/A";
          return {
            id: String(lead.id),
            projectTitle: String(projectTitle),
            client: String(lead.name || "Unknown"),
            company: String(lead.company || "N/A"),
            status: "In Progress",
            deadline: String(deadline),
            budget: String(budget),
            budgetNum: parseBudget(budget),
            notes: String(notes),
            service: String(service),
            timezone: String(lead.timezone || "N/A"),
            phone: String(lead.phone || "N/A"),
          };
        });
      setProjects(formatted);
    } catch (error) { console.log(error); }
  };

  useEffect(() => { fetchProjects(); }, []);

  /* FILTER */
  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => {
      const matchesDate = selectedDate ? p.deadline === selectedDate : true;
      const matchesSearch =
        (p.projectTitle ?? "").toLowerCase().includes(q) ||
        (p.client ?? "").toLowerCase().includes(q) ||
        (p.company ?? "").toLowerCase().includes(q);
      return matchesDate && matchesSearch;
    });
  }, [selectedDate, search, projects]);

  /* STATS */
  const totalProjects = projects.length;
  const allTimeSales = projects.reduce((acc, p) => acc + p.budgetNum, 0);
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = projects.filter(p => p.deadline === todayStr).reduce((acc, p) => acc + p.budgetNum, 0);
  const inProgressCount = projects.filter(p => p.status === "In Progress").length;

  /* OPEN DETAIL */
  const openDetail = (project: ProjectType) => {
    setViewingProject(project);
    setIsEditing(false);
  };

  /* START EDITING */
  const startEdit = () => {
    if (!viewingProject) return;
    setEditTitle(viewingProject.projectTitle);
    setEditDeadline(viewingProject.deadline);
    setEditBudget(viewingProject.budget);
    setEditNotes(viewingProject.notes !== "undefined" ? viewingProject.notes : "");
    setEditService(viewingProject.service !== "N/A" ? viewingProject.service : "");
    setIsEditing(true);
  };

  /* SAVE EDIT */
  const saveEdit = async () => {
    if (!viewingProject || !editTitle || !editDeadline) return;
    setSaving(true);
    try {
      await API.put(`/csr/lead/${viewingProject.id}`, {
        projectTitle: editTitle,
        projectDeadline: editDeadline,
        projectBudget: editBudget,
        projectNotes: editNotes,
        interestedService: editService,
      });
      const updated: ProjectType = {
        ...viewingProject,
        projectTitle: editTitle,
        deadline: editDeadline,
        budget: editBudget,
        budgetNum: parseBudget(editBudget),
        notes: editNotes,
        service: editService,
      };
      setProjects(prev => prev.map(p => p.id === viewingProject.id ? updated : p));
      setViewingProject(updated);
      setIsEditing(false);
    } catch (error) { console.log(error); }
    setSaving(false);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* HEADER */}
        <div className="mt-7">
          <h1 className="text-[30px] sm:text-[36px] font-bold text-[#0F172A]">Projects Dashboard</h1>
          <p className="text-gray-500 mt-2 text-sm">Manage and track your won projects.</p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {[
            { label:"Total Projects", value: String(totalProjects), icon:<FolderKanban size={24}/> },
            { label:"All Time Sales", value: allTimeSales > 0 ? `$${allTimeSales.toLocaleString()}` : "N/A", icon:<DollarSign size={24}/> },
            { label:"In Progress",    value: String(inProgressCount), icon:<Activity size={24}/> },
            { label:"Today Sales",    value: todaySales > 0 ? `$${todaySales.toLocaleString()}` : "N/A", icon:<TrendingUp size={24}/> },
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

        {/* PROJECTS GRID */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-7">
            {filteredProjects.map(project => (
              <div key={project.id} className="bg-white rounded-[30px] shadow-sm p-6 border border-white">
                {/* TOP */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                    <FolderKanban size={24}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[17px] font-bold text-[#0F172A] leading-snug truncate">{project.projectTitle}</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      {project.client}{project.company !== "N/A" && project.company !== project.client ? ` · ${project.company}` : ""}
                    </p>
                  </div>
                </div>

                {/* QUICK INFO ROW */}
                <div className="flex flex-wrap gap-3 mt-5">
                  {project.service && project.service !== "N/A" && (
                    <div className="flex items-center gap-1.5 bg-[#FFF4E5] text-[#D97706] px-3 py-1.5 rounded-xl text-[12px] font-semibold">
                      <Briefcase size={12}/>{project.service}
                    </div>
                  )}
                  {project.deadline && project.deadline !== "N/A" && (
                    <div className="flex items-center gap-1.5 bg-[#EAF5FF] text-[#0B84F3] px-3 py-1.5 rounded-xl text-[12px] font-semibold">
                      <Clock3 size={12}/>{project.deadline}
                    </div>
                  )}
                  {project.budget && project.budget !== "" && project.budget !== "undefined" && (
                    <div className="flex items-center gap-1.5 bg-[#ECFDF5] text-[#027A48] px-3 py-1.5 rounded-xl text-[12px] font-semibold">
                      <DollarSign size={12}/>{project.budget}
                    </div>
                  )}
                  {project.phone && project.phone !== "N/A" && (
                    <div className="flex items-center gap-1.5 bg-[#F4F4F5] text-[#52525B] px-3 py-1.5 rounded-xl text-[12px] font-medium">
                      <Phone size={12}/>{project.phone}
                    </div>
                  )}
                </div>

                {/* NOTES PREVIEW */}
                {project.notes && project.notes !== "undefined" && project.notes !== "" && (
                  <div className="mt-4 bg-[#FAFAFA] rounded-2xl px-4 py-3">
                    <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-2">{project.notes}</p>
                  </div>
                )}

                {/* FOOTER */}
                <div className="flex items-center justify-between mt-5 pt-5 border-t border-[#F3F3F3]">
                  <div className="flex items-center gap-2">
                    <div className="bg-[#FFF7E6] text-[#B54708] px-3 py-1.5 rounded-xl text-[12px] font-semibold">In Progress</div>
                    {project.timezone && project.timezone !== "N/A" && (
                      <span className="text-gray-400 text-[12px]">· {project.timezone}</span>
                    )}
                  </div>
                  <button
                    onClick={() => openDetail(project)}
                    className="h-[42px] px-5 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm">
                    <Eye size={15}/>View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[30px] shadow-sm p-16 mt-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-5"><FolderKanban size={28}/></div>
            <h2 className="text-[22px] font-bold text-[#0F172A]">No Projects Yet</h2>
            <p className="text-gray-500 mt-2 text-sm">Projects will appear here once a client is marked as &quot;Project Won&quot;.</p>
          </div>
        )}

        {/* ===================== DETAIL / EDIT MODAL ===================== */}
        {viewingProject && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl max-h-[90vh] overflow-y-auto">

              {/* MODAL HEADER */}
              <div className="sticky top-0 bg-white rounded-t-[32px] p-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4 z-10">
                <div>
                  <h2 className="text-[22px] font-bold text-[#0F172A] leading-snug">
                    {isEditing ? "Edit Project" : viewingProject.projectTitle}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {viewingProject.client}
                    {viewingProject.company !== "N/A" && viewingProject.company !== viewingProject.client
                      ? ` · ${viewingProject.company}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isEditing && (
                    <button onClick={startEdit}
                      className="h-10 px-4 rounded-2xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold flex items-center gap-1.5">
                      <Pencil size={14}/>Edit
                    </button>
                  )}
                  <button onClick={() => { setViewingProject(null); setIsEditing(false); }}
                    className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500"><X size={18}/></button>
                </div>
              </div>

              <div className="p-6">
                {/* ---- VIEW MODE ---- */}
                {!isEditing && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#FAFAFA] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><Briefcase size={14} className="text-[#B8112D]"/><p className="text-gray-500 text-sm">Service</p></div>
                        <h4 className="font-semibold text-[#0F172A] text-[14px]">{viewingProject.service || "N/A"}</h4>
                      </div>
                      <div className="bg-[#FAFAFA] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><Clock3 size={14} className="text-[#B8112D]"/><p className="text-gray-500 text-sm">Deadline</p></div>
                        <h4 className="font-semibold text-[#0F172A] text-[14px]">{viewingProject.deadline || "N/A"}</h4>
                      </div>
                      <div className="bg-[#FAFAFA] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><Phone size={14} className="text-[#B8112D]"/><p className="text-gray-500 text-sm">Contact</p></div>
                        <h4 className="font-semibold text-[#0F172A] text-[14px]">{viewingProject.phone || "N/A"}</h4>
                      </div>
                      <div className="bg-[#FAFAFA] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><DollarSign size={14} className="text-[#B8112D]"/><p className="text-gray-500 text-sm">Budget</p></div>
                        <h4 className="font-semibold text-[#0F172A] text-[14px]">{viewingProject.budget || "Not set"}</h4>
                      </div>
                      <div className="bg-[#FAFAFA] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><CalendarDays size={14} className="text-[#B8112D]"/><p className="text-gray-500 text-sm">Timezone</p></div>
                        <h4 className="font-semibold text-[#0F172A] text-[14px]">{viewingProject.timezone || "N/A"}</h4>
                      </div>
                      <div className="bg-[#FAFAFA] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><Activity size={14} className="text-[#B8112D]"/><p className="text-gray-500 text-sm">Status</p></div>
                        <div className="bg-[#FFF7E6] text-[#B54708] px-3 py-1 rounded-xl text-[12px] font-semibold w-fit">{viewingProject.status}</div>
                      </div>
                    </div>

                    {viewingProject.notes && viewingProject.notes !== "undefined" && viewingProject.notes !== "" && (
                      <div className="mt-4 bg-[#FAFAFA] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2"><AlignLeft size={14} className="text-[#B8112D]"/><p className="text-gray-500 text-sm">Project Notes</p></div>
                        <p className="text-[#0F172A] text-[14px] leading-relaxed">{viewingProject.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {/* ---- EDIT MODE ---- */}
                {isEditing && (
                  <>
                    {/* TITLE */}
                    <div>
                      <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><FileText size={15}/>Project Title</label>
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D] text-[14px]"/>
                    </div>

                    {/* SERVICE GRID */}
                    <div className="mt-5">
                      <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-3"><Briefcase size={15}/>Service</label>
                      <div className="grid grid-cols-3 gap-2">
                        {serviceOptions.map(({ value, label, Icon }) => {
                          const isSelected = editService === value;
                          return (
                            <button key={value} onClick={() => setEditService(value)}
                              className={`h-[68px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-[12px] font-semibold ${
                                isSelected ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D] shadow-sm" : "border-gray-100 bg-[#FAFAFA] text-[#0F172A] hover:border-gray-300"
                              }`}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}>
                                <Icon size={15} className={isSelected ? "text-[#B8112D]" : "text-gray-500"}/>
                              </div>
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DEADLINE */}
                    <div className="mt-5">
                      <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><Clock3 size={15}/>Deadline</label>
                      <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                        className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"/>
                    </div>

                    {/* BUDGET */}
                    <div className="mt-5">
                      <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><DollarSign size={15}/>Budget</label>
                      <input type="text" placeholder="e.g. $5,000" value={editBudget} onChange={e => setEditBudget(e.target.value)}
                        className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D] text-[14px]"/>
                    </div>

                    {/* NOTES */}
                    <div className="mt-5">
                      <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><AlignLeft size={15}/>Notes</label>
                      <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Project notes..."
                        className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-[#B8112D] text-[14px] resize-none"/>
                    </div>

                    {/* EDIT BUTTONS */}
                    <div className="flex gap-3 mt-7">
                      <button onClick={() => setIsEditing(false)} className="flex-1 h-[52px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Cancel</button>
                      <button onClick={saveEdit} disabled={!editTitle || !editDeadline || saving}
                        className={`flex-1 h-[52px] rounded-2xl font-semibold text-white transition-all ${editTitle && editDeadline && !saving ? "bg-[#B8112D]" : "bg-gray-300 cursor-not-allowed"}`}>
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}