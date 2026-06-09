"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ThumbsDown, PhoneOff, Search, Users, X,
  Phone, Briefcase, ArrowRightLeft, CircleAlert,
  RefreshCw, History, ChevronDown, ChevronUp,
  Calendar, Clock, Globe, BarChart2, CalendarDays,
  PenTool, Pencil, Building2, Monitor, FileText,
  DollarSign, AlignLeft,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";

const NOT_INTERESTED_LIMIT = 3;
const NOT_PICKED_LIMIT     = 7;

const usTimezones = [
  { value:"America/Los_Angeles",           label:"Pacific Time (UTC-08:00)",    abbreviation:"PT"  },
  { value:"America/Denver",               label:"Mountain Time (UTC-07:00)",   abbreviation:"MT"  },
  { value:"America/Chicago",              label:"Central Time (UTC-06:00)",    abbreviation:"CT"  },
  { value:"America/New_York",             label:"Eastern Time (UTC-05:00)",    abbreviation:"ET"  },
  { value:"America/Phoenix",              label:"Arizona (UTC-07:00) No DST",  abbreviation:"MST" },
  { value:"America/Anchorage",            label:"Alaska (UTC-09:00)",          abbreviation:"AKST"},
  { value:"Pacific/Honolulu",             label:"Hawaii (UTC-10:00) No DST",   abbreviation:"HST" },
];

const serviceOptions = [
  { value:"Estimating",   label:"Estimating",   Icon: BarChart2   },
  { value:"Scheduling",   label:"Scheduling",   Icon: CalendarDays },
  { value:"Shop Drawing", label:"Shop Drawing", Icon: PenTool     },
  { value:"Drafting",     label:"Drafting",     Icon: Pencil      },
  { value:"BIM",          label:"BIM",          Icon: Building2   },
  { value:"IT",           label:"IT",           Icon: Monitor     },
];

const getCurrentTimeInTimezone = (tz: string): string => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone:tz, hour:"2-digit", minute:"2-digit", hour12:true,
    }).format(new Date());
  } catch { return "--:-- --"; }
};

type Lead = {
  id: string;
  client: string;
  company: string;
  phone: string;
  status: string;
  notInterestedCount: number;
  notPickedCount: number;
  comments?: string;
  interestedService?: string;
  followUpNotes?: string;
};

function TriesBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="w-full min-w-[120px]">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-semibold text-gray-500">{used} / {limit}</span>
        <span className={`text-[11px] font-bold ${used >= limit ? "text-red-600" : "text-gray-400"}`}>
          {used >= limit ? "Redistributed" : `${limit - used} left`}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  );
}

export default function NotInterestedPage() {
  const [isOpen,    setIsOpen]   = useState(false);
  const [leads,     setLeads]    = useState<Lead[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [activeTab, setActiveTab]= useState<"notinterested" | "notpicked">("notinterested");
  const [search,    setSearch]   = useState("");

  const [expandedRow,  setExpandedRow]  = useState<string | null>(null);
  const [editingNote,  setEditingNote]  = useState<{ leadId: string; index: number; value: string } | null>(null);
  const [savingNote,   setSavingNote]   = useState(false);

  /* ── Status-update modals ── */
  const [statusLead,          setStatusLead]         = useState<Lead | null>(null);
  const [showImportantModal,  setShowImportantModal]  = useState(false);
  const [showInterestedModal, setShowInterestedModal] = useState(false);
  const [showCloseModal,      setShowCloseModal]      = useState(false);
  const [scheduleDate,        setScheduleDate]        = useState("");
  const [scheduleTime,        setScheduleTime]        = useState("");
  const [selectedTimezone,    setSelectedTimezone]    = useState("America/New_York");
  const [selectedService,     setSelectedService]     = useState("");
  const [projectTitle,        setProjectTitle]        = useState("");
  const [projectDeadline,     setProjectDeadline]     = useState("");
  const [projectBudget,       setProjectBudget]       = useState("");
  const [projectNotes,        setProjectNotes]        = useState("");
  const [projectService,      setProjectService]      = useState("");

  const [toast, setToast] = useState<{ msg: string; type: "success"|"warn" } | null>(null);
  const showToast = (msg: string, type: "success"|"warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ─── FETCH ─── */
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/not-interested");
      const formatted: Lead[] = (res.data.leads ?? []).map((l: {
        id: string; name?: string; company?: string; uploadFile?: { companyName?: string };
        phone?: string; status?: string; notInterestedCount?: number;
        notPickedCount?: number; comments?: string; interestedService?: string;
        followUpNotes?: string;
      }) => ({
        id:                 l.id,
        client:             l.name    ?? "Unknown",
        company:            l.uploadFile?.companyName ?? l.company ?? "N/A",
        phone:              l.phone   ?? "N/A",
        status:             l.status  ?? "",
        notInterestedCount: l.notInterestedCount ?? 0,
        notPickedCount:     l.notPickedCount     ?? 0,
        comments:           l.comments ?? "",
        interestedService:  l.interestedService ?? "",
        followUpNotes:      l.followUpNotes ?? "",
      }));
      setLeads(formatted);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchLeads(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notInterested = useMemo(() => leads.filter(l => l.status === "Not Interested"), [leads]);
  const notPicked     = useMemo(() => leads.filter(l => l.status === "not picked" || l.status === "not completed"), [leads]);

  const currentList = activeTab === "notinterested" ? notInterested : notPicked;
  const limit       = activeTab === "notinterested" ? NOT_INTERESTED_LIMIT : NOT_PICKED_LIMIT;
  const countKey    = activeTab === "notinterested" ? "notInterestedCount" : "notPickedCount";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currentList.filter(l =>
      !q || l.client.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.phone.includes(q)
    );
  }, [currentList, search]);

  /* ─── RE-TRY ─── */
  const handleRetry = async (lead: Lead) => {
    const newStatus = activeTab === "notinterested" ? "Not Interested" : "not picked";
    try {
      const res = await API.put(`/csr/lead/${lead.id}`, { status: newStatus });
      if (res.data.redistributed) {
        showToast(`${lead.client} has been reassigned to another CSR after reaching the limit.`, "warn");
        setLeads(prev => prev.filter(l => l.id !== lead.id));
      } else {
        const triesLeft     = res.data.triesLeft ?? 0;
        const updatedNotes  = res.data.lead?.followUpNotes ?? lead.followUpNotes ?? "";
        showToast(`Retried. ${triesLeft} attempt${triesLeft !== 1 ? "s" : ""} left.`);
        setLeads(prev => prev.map(l =>
          l.id === lead.id
            ? { ...l, [countKey]: (l[countKey as keyof Lead] as number) + 1, followUpNotes: updatedNotes }
            : l
        ));
      }
    } catch (err) { console.log(err); }
  };

  const handleSaveNote = async (lead: Lead) => {
    if (!editingNote) return;
    setSavingNote(true);
    try {
      const lines = (lead.followUpNotes ?? "").split("\n").filter(Boolean);
      lines[editingNote.index] = editingNote.value;
      const updated = lines.join("\n");
      await API.put(`/csr/lead/${lead.id}`, { followUpNotes: updated });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, followUpNotes: updated } : l));
      setEditingNote(null);
    } catch { showToast("Failed to save note.", "warn"); }
    finally { setSavingNote(false); }
  };

  /* ─── UPDATE STATUS (from this page) ─── */
  const handleUpdateStatus = async (lead: Lead, status: string) => {
    if (status === "") return;
    if (status === "important") {
      setStatusLead(lead); setScheduleDate(""); setScheduleTime("");
      setSelectedTimezone("America/New_York"); setShowImportantModal(true); return;
    }
    if (status === "interested") {
      setStatusLead(lead); setSelectedService(""); setShowInterestedModal(true); return;
    }
    if (status === "Close Client") {
      setStatusLead(lead); setProjectTitle(lead.client); setProjectDeadline("");
      setProjectBudget(""); setProjectNotes(""); setProjectService(""); setShowCloseModal(true); return;
    }
    try {
      await API.put(`/csr/lead/${lead.id}`, { status });
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      showToast(`Status updated to "${status}".`);
    } catch { showToast("Failed to update status.", "warn"); }
  };

  const saveImportant = async () => {
    if (!statusLead || !scheduleDate || !scheduleTime) return;
    await API.put(`/csr/lead/${statusLead.id}`, {
      status:"important", nextSchedule:scheduleDate, nextTime:scheduleTime, timezone:selectedTimezone,
    });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowImportantModal(false);
    showToast("Scheduled as Important Call.");
  };

  const saveInterested = async () => {
    if (!statusLead || !selectedService) return;
    await API.put(`/csr/lead/${statusLead.id}`, { status:"interested", interestedService:selectedService });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowInterestedModal(false);
    showToast("Marked as Interested.");
  };

  const saveCloseClient = async () => {
    if (!statusLead || !projectTitle || !projectDeadline || !projectService) return;
    await API.put(`/csr/lead/${statusLead.id}`, {
      status:"Close Client", projectTitle, projectDeadline,
      projectBudget, projectNotes, interestedService:projectService,
    });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowCloseModal(false);
    showToast("Client closed & moved to Projects.");
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* TOAST */}
        {toast && (
          <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all ${
            toast.type === "warn"
              ? "bg-amber-50 border border-amber-300 text-amber-800"
              : "bg-green-50 border border-green-300 text-green-800"
          }`}>
            {toast.type === "warn" ? <ArrowRightLeft size={16}/> : <RefreshCw size={16}/>}
            {toast.msg}
            <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X size={14}/></button>
          </div>
        )}

        {/* HEADER */}
        <div className="mt-7 mb-6">
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#0F172A]">Leads Follow-up</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Track Not Interested &amp; Not Picked leads with automatic redistribution.</p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label:"Not Interested",    value: notInterested.length, sub:`limit ${NOT_INTERESTED_LIMIT} tries`, color:"bg-[#FFF1F3] text-[#B8112D]", Icon: ThumbsDown  },
            { label:"Not Picked",        value: notPicked.length,     sub:`limit ${NOT_PICKED_LIMIT} tries`,     color:"bg-[#FFF7E6] text-[#B54708]", Icon: PhoneOff    },
            { label:"Near Limit (NI)",   value: notInterested.filter(l => l.notInterestedCount >= NOT_INTERESTED_LIMIT - 1).length, sub:"1 try left", color:"bg-[#FEF3C7] text-[#92400E]", Icon: CircleAlert },
            { label:"Near Limit (NP)",   value: notPicked.filter(l => l.notPickedCount >= NOT_PICKED_LIMIT - 1).length,             sub:"1 try left", color:"bg-[#FEF3C7] text-[#92400E]", Icon: CircleAlert },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-[22px] p-4 border border-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[12px] font-medium">{card.label}</p>
                  <h2 className="text-[28px] font-bold text-[#0F172A] mt-1">{card.value}</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
                </div>
                <div className={`w-11 h-11 rounded-2xl ${card.color} flex items-center justify-center shrink-0`}>
                  <card.Icon size={20}/>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-3 mb-5">
          <button onClick={() => { setActiveTab("notinterested"); setSearch(""); }}
            className={`h-11 px-5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all ${activeTab==="notinterested" ? "bg-[#B8112D] text-white" : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"}`}>
            <ThumbsDown size={16}/>Not Interested
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${activeTab==="notinterested" ? "bg-white/20" : "bg-[#FFF1F3]"}`}>{notInterested.length}</span>
          </button>
          <button onClick={() => { setActiveTab("notpicked"); setSearch(""); }}
            className={`h-11 px-5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all ${activeTab==="notpicked" ? "bg-[#B8112D] text-white" : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"}`}>
            <PhoneOff size={16}/>Not Picked
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${activeTab==="notpicked" ? "bg-white/20" : "bg-[#FFF1F3]"}`}>{notPicked.length}</span>
          </button>
        </div>

        {/* TABLE CARD */}
        <div className="bg-white rounded-[30px] border border-white shadow-sm flex flex-col" style={{ maxHeight: "calc(100vh - 300px)", minHeight: "380px" }}>

          {/* Table header */}
          <div className="p-5 sm:p-6 border-b border-[#F3F3F3] shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-[22px] font-bold text-[#0F172A]">
                  {activeTab === "notinterested" ? "Not Interested" : "Not Picked"} Leads
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  Auto-redistributed after <span className="font-semibold text-[#B8112D]">{limit} tries</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input
                    type="text"
                    placeholder="Search client, company, phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-[40px] w-[260px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-9 pr-4 text-[13px] outline-none focus:border-[#B8112D]"
                  />
                </div>
                {/* refresh */}
                <button onClick={() => void fetchLeads()}
                  className="h-[40px] w-[40px] rounded-2xl border border-gray-200 bg-[#FAFAFA] flex items-center justify-center hover:border-[#B8112D] hover:text-[#B8112D] transition-colors text-gray-500"
                  title="Refresh">
                  <RefreshCw size={15}/>
                </button>
                <div className={`text-sm font-semibold px-4 py-2 rounded-2xl w-fit whitespace-nowrap ${
                  activeTab === "notinterested" ? "bg-[#FFF1F3] text-[#B8112D]" : "bg-[#FFF7E6] text-[#B54708]"
                }`}>
                  {filtered.length} {activeTab === "notinterested" ? "Not Interested" : "Not Picked"} Leads
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-auto flex-1 px-5 sm:px-6 pb-5">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[#F1F1F1]">
                  {["Client","Company","Contact","Service","Tries","Status","Action"].map(h => (
                    <th key={h} className="text-left py-4 px-2 text-[13px] font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4].map(i => (
                    <tr key={i} className="border-b border-[#F7F7F7]">
                      {[1,2,3,4,5,6,7].map(j => (
                        <td key={j} className="py-5 px-2">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-20"/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? filtered.map(lead => {
                  const tries      = lead[countKey as keyof Lead] as number;
                  const isNearLimit = tries >= limit - 1;
                  const isAtLimit   = tries >= limit;
                  const barColor    = isAtLimit
                    ? "bg-gray-300"
                    : isNearLimit
                    ? "bg-amber-400"
                    : activeTab === "notinterested" ? "bg-[#B8112D]" : "bg-amber-500";

                  return (
                    <>
                    <tr key={lead.id} className={`border-b border-[#F7F7F7] transition-all ${
                      isAtLimit ? "opacity-60 bg-gray-50" : "hover:bg-[#FFF8F9]"
                    }`}>
                      {/* Client */}
                      <td className="py-5 px-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white ${
                            isAtLimit ? "bg-gray-400" : isNearLimit ? "bg-amber-500" : "bg-[#B8112D]"
                          }`}>
                            {lead.client.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#0F172A] text-[14px]">{lead.client}</h4>
                            <p className="text-gray-500 text-[12px] mt-0.5">
                              {activeTab === "notinterested" ? "Not Interested" : "Not Picked"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-5 px-2">
                        <h4 className="font-medium text-[#0F172A] text-[14px]">{lead.company}</h4>
                      </td>

                      {/* Contact */}
                      <td className="py-5 px-2">
                        <div className="flex items-center gap-1.5 bg-[#FFF6F7] text-[#B8112D] px-3 py-1.5 rounded-xl text-[13px] font-medium w-fit">
                          <Phone size={12}/>{lead.phone}
                        </div>
                      </td>

                      {/* Service */}
                      <td className="py-5 px-2">
                        {lead.interestedService ? (
                          <div className="flex items-center gap-1.5 bg-[#FFF4E5] text-[#D97706] px-3 py-1.5 rounded-xl text-[13px] font-semibold w-fit">
                            <Briefcase size={12}/>{lead.interestedService}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Tries bar */}
                      <td className="py-5 px-2 w-[160px]">
                        <TriesBar used={tries} limit={limit} color={barColor}/>
                        {isNearLimit && !isAtLimit && (
                          <span className="text-[10px] font-bold text-amber-600 mt-1 block">⚠ Last try</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="py-5 px-2">
                        {isAtLimit ? (
                          <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 px-3 py-1.5 rounded-xl text-[12px] font-semibold">
                            <ArrowRightLeft size={12}/>Redistributed
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold ${
                            activeTab === "notinterested"
                              ? "bg-[#FFF1F3] text-[#B8112D]"
                              : "bg-[#FFF7E6] text-[#B54708]"
                          }`}>
                            {activeTab === "notinterested"
                              ? <><ThumbsDown size={12}/>Not Interested</>
                              : <><PhoneOff size={12}/>Not Picked</>
                            }
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-2">
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          {/* Retry + History */}
                          <div className="flex items-center gap-2">
                            {!isAtLimit ? (
                              <button onClick={() => handleRetry(lead)}
                                className="h-9 px-3 rounded-xl bg-[#F5F6FA] text-gray-700 text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#B8112D] hover:text-white transition-all whitespace-nowrap">
                                <RefreshCw size={12}/>Retry
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 text-gray-400 text-[12px]">
                                <Users size={13}/>Reassigned
                              </div>
                            )}
                            {lead.followUpNotes && (
                              <button onClick={() => setExpandedRow(expandedRow === lead.id ? null : lead.id)}
                                title="View history"
                                className="h-9 w-9 rounded-xl bg-[#F5F6FA] text-gray-500 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all shrink-0">
                                {expandedRow === lead.id ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                              </button>
                            )}
                          </div>
                          {/* Status dropdown — same style as My Links */}
                          <div className="relative w-full max-w-[230px]">
                            <select
                              defaultValue=""
                              onChange={e => { handleUpdateStatus(lead, e.target.value); e.currentTarget.value = ""; }}
                              className="appearance-none h-[46px] w-full rounded-2xl border border-gray-200 bg-white px-4 pr-11 text-[14px] font-semibold text-[#0F172A] outline-none">
                              <option value="">Update Status</option>
                              <option value="pending">Pending</option>
                              <option value="important">Important</option>
                              <option value="interested">Interested</option>
                              <option value="Close Client">Close Client</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                              <ChevronDown size={18}/>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {/* ── History row ── */}
                    {expandedRow === lead.id && lead.followUpNotes && (
                      <tr className="bg-[#F8FAFF]">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                              <History size={14}/>
                            </div>
                            <div className="flex-1">
                              <p className="text-[12px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Try History</p>
                              <div className="space-y-2">
                                {lead.followUpNotes.trim().split("\n").filter(Boolean).map((line, i) => {
                                  const isLimit   = line.includes("LIMIT REACHED");
                                  const isEditing = editingNote?.leadId === lead.id && editingNote.index === i;
                                  /* split timestamp prefix from user note */
                                  const bracketEnd = line.indexOf("]");
                                  const prefix     = bracketEnd !== -1 ? line.slice(0, bracketEnd + 1) : "";
                                  const rest       = bracketEnd !== -1 ? line.slice(bracketEnd + 1).trim() : line;

                                  return (
                                    <div key={i} className={`rounded-xl border text-[12px] ${
                                      isLimit ? "bg-red-50 border-red-100" : "bg-white border-gray-100"
                                    }`}>
                                      {isEditing ? (
                                        <div className="p-2 space-y-2">
                                          <p className="text-[11px] font-mono text-gray-400 px-1">{prefix}</p>
                                          <textarea
                                            autoFocus
                                            rows={2}
                                            value={editingNote.value.slice(bracketEnd + 1).trim()}
                                            onChange={e => setEditingNote({ ...editingNote, value: `${prefix} ${e.target.value}` })}
                                            placeholder="Add your note here..."
                                            className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-gray-700 outline-none resize-none focus:border-blue-400"
                                          />
                                          <div className="flex gap-2 justify-end">
                                            <button onClick={() => setEditingNote(null)}
                                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">
                                              Cancel
                                            </button>
                                            <button onClick={() => handleSaveNote(lead)} disabled={savingNote}
                                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50">
                                              {savingNote ? "Saving..." : "Save"}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-2 px-3 py-2">
                                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                            isLimit ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
                                          }`}>{i + 1}</span>
                                          <div className="flex-1 min-w-0">
                                            <span className={`font-mono text-[11px] ${isLimit ? "text-red-600" : "text-gray-400"}`}>{prefix} </span>
                                            <span className={isLimit ? "text-red-700 font-medium" : "text-gray-700"}>{rest}</span>
                                          </div>
                                          <button
                                            onClick={() => setEditingNote({ leadId: lead.id, index: i, value: line })}
                                            className="shrink-0 w-6 h-6 rounded-lg bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-500 flex items-center justify-center transition-all">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      {activeTab === "notinterested"
                        ? <ThumbsDown size={28} className="text-gray-200 mx-auto mb-3"/>
                        : <PhoneOff size={28} className="text-gray-200 mx-auto mb-3"/>
                      }
                      <p className="text-gray-400 text-sm">
                        {search ? "No leads match your search." : "No leads in this category."}
                      </p>
                      {search && (
                        <button onClick={() => setSearch("")} className="mt-3 text-[#B8112D] text-sm font-semibold hover:underline">
                          Clear search
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ IMPORTANT MODAL ══ */}
        {showImportantModal && statusLead && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-[22px] font-bold text-[#0F172A]">Important Call</h2>
                  <p className="text-gray-500 text-sm mt-1">Schedule next follow-up for <span className="font-semibold text-[#0F172A]">{statusLead.client}</span></p>
                </div>
                <button onClick={() => setShowImportantModal(false)} className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500"><X size={18}/></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><Calendar size={15}/>Date</label>
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    className="w-full h-[50px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"/>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><Clock size={15}/>Time</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full h-[50px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"/>
                </div>
                <div className="relative">
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><Globe size={15}/>Timezone</label>
                  <select value={selectedTimezone} onChange={e => setSelectedTimezone(e.target.value)}
                    className="w-full h-[50px] rounded-2xl border border-gray-200 px-4 pr-10 outline-none appearance-none bg-white focus:border-[#B8112D] text-[13px]">
                    {usTimezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-[42px] pointer-events-none text-gray-400"/>
                </div>
                {scheduleDate && scheduleTime && (
                  <div className="p-3 bg-[#F5F6FA] rounded-2xl text-sm">
                    <p className="text-gray-500 text-[11px] mb-1">Scheduled at</p>
                    <p className="font-semibold text-[#0F172A]">{scheduleDate} · {scheduleTime} {usTimezones.find(t => t.value === selectedTimezone)?.abbreviation}</p>
                    <p className="text-[11px] text-gray-400 mt-1">Current time: {getCurrentTimeInTimezone(selectedTimezone)}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowImportantModal(false)} className="flex-1 h-[50px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Cancel</button>
                <button onClick={saveImportant} disabled={!scheduleDate || !scheduleTime}
                  className="flex-1 h-[50px] rounded-2xl bg-[#B8112D] text-white font-semibold disabled:opacity-40">Schedule</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ INTERESTED MODAL ══ */}
        {showInterestedModal && statusLead && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-[22px] font-bold text-[#0F172A]">Client Interested In</h2>
                  <p className="text-gray-500 text-sm mt-1"><span className="font-semibold text-[#0F172A]">{statusLead.client}</span> is interested in:</p>
                </div>
                <button onClick={() => setShowInterestedModal(false)} className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500"><X size={18}/></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {serviceOptions.map(({ value, label, Icon }) => {
                  const sel = selectedService === value;
                  return (
                    <button key={value} onClick={() => setSelectedService(value)}
                      className={`h-[80px] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all text-[13px] font-semibold ${
                        sel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-[#0F172A] hover:border-gray-300"
                      }`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}>
                        <Icon size={17} className={sel ? "text-[#B8112D]" : "text-gray-500"}/>
                      </div>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowInterestedModal(false)} className="flex-1 h-[50px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Cancel</button>
                <button onClick={saveInterested} disabled={!selectedService}
                  className="flex-1 h-[50px] rounded-2xl bg-[#B8112D] text-white font-semibold disabled:opacity-40">Save Interest</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ CLOSE CLIENT MODAL ══ */}
        {showCloseModal && statusLead && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-[22px] font-bold text-[#0F172A]">Close Client</h2>
                  <p className="text-gray-500 text-sm mt-1">Fill project details to confirm.</p>
                </div>
                <button onClick={() => setShowCloseModal(false)} className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500 shrink-0"><X size={18}/></button>
              </div>
              <div className="bg-[#ECFDF5] rounded-2xl p-3 flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-[#065F46] text-white flex items-center justify-center font-bold text-sm shrink-0">{statusLead.client.charAt(0)}</div>
                <div><p className="font-bold text-[#065F46] text-[14px]">{statusLead.client}</p><p className="text-[#065F46]/70 text-[11px]">{statusLead.phone}</p></div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><FileText size={14}/>Project Title <span className="text-[#B8112D] text-[11px]">*</span></label>
                  <input type="text" placeholder="e.g. BIM Modeling Phase 1" value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
                    className="w-full h-[50px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#065F46] text-[13px]"/>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><Briefcase size={14}/>Service <span className="text-[#B8112D] text-[11px]">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {serviceOptions.map(({ value, label, Icon }) => {
                      const sel = projectService === value;
                      return (
                        <button key={value} onClick={() => setProjectService(value)}
                          className={`h-[64px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all text-[11px] font-semibold ${
                            sel ? "border-[#065F46] bg-[#ECFDF5] text-[#065F46]" : "border-gray-100 bg-[#FAFAFA] text-[#0F172A] hover:border-gray-300"
                          }`}>
                          <Icon size={14} className={sel ? "text-[#065F46]" : "text-gray-500"}/>{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><CalendarDays size={14}/>Deadline <span className="text-[#B8112D] text-[11px]">*</span></label>
                  <input type="date" value={projectDeadline} onChange={e => setProjectDeadline(e.target.value)}
                    className="w-full h-[50px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#065F46]"/>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><DollarSign size={14}/>Budget <span className="text-gray-400 text-[11px] font-normal">(optional)</span></label>
                  <input type="text" placeholder="e.g. $5,000" value={projectBudget} onChange={e => setProjectBudget(e.target.value)}
                    className="w-full h-[50px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#065F46] text-[13px]"/>
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-2"><AlignLeft size={14}/>Notes <span className="text-gray-400 text-[11px] font-normal">(optional)</span></label>
                  <textarea placeholder="Any additional notes..." value={projectNotes} onChange={e => setProjectNotes(e.target.value)}
                    rows={3} className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-[#065F46] text-[13px] resize-none"/>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCloseModal(false)} className="flex-1 h-[50px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Cancel</button>
                <button onClick={saveCloseClient} disabled={!projectTitle || !projectDeadline || !projectService}
                  className="flex-1 h-[50px] rounded-2xl bg-[#065F46] text-white font-semibold disabled:opacity-40">Confirm</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
