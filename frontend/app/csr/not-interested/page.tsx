"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ThumbsDown, PhoneOff, Search, Users, X,
  Phone, Briefcase, ArrowRightLeft, CircleAlert,
  RefreshCw, History, ChevronDown, ChevronUp, Eye,
  Calendar, Clock, Globe, BarChart2, CalendarDays,
  PenTool, Pencil, Building2, Monitor, FileText,
  DollarSign, AlignLeft, MessageSquare, Check,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import LeadDetailModal from "../components/LeadDetailModal";
import API from "@/lib/api";

const NOT_INTERESTED_LIMIT = 3;
const NOT_PICKED_LIMIT     = 7;

const usTimezones = [
  { value: "America/Los_Angeles",           label: "Pacific Time (UTC-08:00)",    abbreviation: "PT"   },
  { value: "America/Denver",               label: "Mountain Time (UTC-07:00)",   abbreviation: "MT"   },
  { value: "America/Chicago",              label: "Central Time (UTC-06:00)",    abbreviation: "CT"   },
  { value: "America/New_York",             label: "Eastern Time (UTC-05:00)",    abbreviation: "ET"   },
  { value: "America/Phoenix",              label: "Arizona (UTC-07:00) No DST",  abbreviation: "MST"  },
  { value: "America/Anchorage",            label: "Alaska (UTC-09:00)",          abbreviation: "AKST" },
  { value: "Pacific/Honolulu",             label: "Hawaii (UTC-10:00) No DST",   abbreviation: "HST"  },
];

const serviceOptions = [
  { value: "Estimating",   label: "Estimating",   Icon: BarChart2    },
  { value: "Scheduling",   label: "Scheduling",   Icon: CalendarDays  },
  { value: "Shop Drawing", label: "Shop Drawing", Icon: PenTool      },
  { value: "Drafting",     label: "Drafting",     Icon: Pencil       },
  { value: "BIM",          label: "BIM",          Icon: Building2    },
  { value: "IT",           label: "IT",           Icon: Monitor      },
];

const getCurrentTimeInTimezone = (tz: string): string => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(new Date());
  } catch { return "--:-- --"; }
};

type Lead = {
  id: string; client: string; company: string; phone: string;
  email?: string; state?: string; status: string;
  notInterestedCount: number; notPickedCount: number;
  interestedService?: string; followUpNotes?: string; comments?: string;
};

function TriesBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500">{used} / {limit}</span>
        <span className={`text-[10px] sm:text-[11px] font-bold ${used >= limit ? "text-red-600" : "text-gray-400"}`}>
          {used >= limit ? "Redistributed" : `${limit - used} left`}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function NotInterestedPage() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<"notinterested" | "notpicked">("notinterested");
  const [search,    setSearch]    = useState("");

  const [expandedRow,  setExpandedRow]  = useState<string | null>(null);
  const [editingNote,  setEditingNote]  = useState<{ leadId: string; index: number; value: string } | null>(null);
  const [savingNote,   setSavingNote]   = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft,     setCommentDraft]     = useState("");
  const [savingCommentId,  setSavingCommentId]  = useState<string | null>(null);

  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  /* ── Manual CSR assign (when retry limit reached) ── */
  const [showAssignModal,   setShowAssignModal]   = useState(false);
  const [assignLead,        setAssignLead]        = useState<Lead | null>(null);
  const [csrList,           setCsrList]           = useState<{ id: string; name: string; csrCode: string | null }[]>([]);
  const [selectedCsrId,     setSelectedCsrId]     = useState("");
  const [isAssigning,       setIsAssigning]       = useState(false);

  const [statusLead,          setStatusLead]          = useState<Lead | null>(null);
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

  const [toast, setToast] = useState<{ msg: string; type: "success" | "warn" } | null>(null);
  const showToast = (msg: string, type: "success" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/not-interested");
      const formatted: Lead[] = (res.data.leads ?? []).map((l: {
        id: string; name?: string; company?: string;
        uploadFile?: { companyName?: string }; phone?: string;
        email?: string; state?: string; status?: string;
        notInterestedCount?: number; notPickedCount?: number;
        interestedService?: string; followUpNotes?: string; comments?: string;
      }) => ({
        id: l.id,
        client:  l.name    ?? "Unknown",
        company: l.uploadFile?.companyName ?? l.company ?? "N/A",
        phone:   l.phone   ?? "N/A",
        email:   l.email   ?? "",
        state:   l.state   ?? "",
        status:  l.status  ?? "",
        notInterestedCount: l.notInterestedCount ?? 0,
        notPickedCount:     l.notPickedCount     ?? 0,
        interestedService:  l.interestedService  ?? "",
        followUpNotes:      l.followUpNotes      ?? "",
        comments:           l.comments           ?? "",
      }));
      setLeads(formatted);
    } catch (err) { console.log(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchLeads(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notInterested = useMemo(() => leads.filter(l => l.status === "Not Interested"), [leads]);
  const notPicked     = useMemo(() => leads.filter(l => l.status === "not picked" || l.status === "not completed"), [leads]);
  const currentList   = activeTab === "notinterested" ? notInterested : notPicked;
  const limit         = activeTab === "notinterested" ? NOT_INTERESTED_LIMIT : NOT_PICKED_LIMIT;
  const countKey      = activeTab === "notinterested" ? "notInterestedCount" : "notPickedCount";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currentList.filter(l =>
      !q || l.client.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.phone.includes(q)
    );
  }, [currentList, search]);

  const handleRetry = async (lead: Lead) => {
    const newStatus = activeTab === "notinterested" ? "Not Interested" : "not picked";
    try {
      const res = await API.put(`/csr/lead/${lead.id}`, { status: newStatus });
      if (res.data.needsManualAssign) {
        setCsrList(res.data.csrs ?? []);
        setAssignLead(lead);
        setSelectedCsrId("");
        setShowAssignModal(true);
        setLeads(prev => prev.map(l =>
          l.id === lead.id
            ? { ...l, [countKey]: (l[countKey as keyof Lead] as number) + 1 }
            : l
        ));
      } else {
        const triesLeft    = res.data.triesLeft ?? 0;
        const updatedNotes = res.data.lead?.followUpNotes ?? lead.followUpNotes ?? "";
        showToast(`Retried. ${triesLeft} attempt${triesLeft !== 1 ? "s" : ""} left.`);
        setLeads(prev => prev.map(l =>
          l.id === lead.id
            ? { ...l, [countKey]: (l[countKey as keyof Lead] as number) + 1, followUpNotes: updatedNotes }
            : l
        ));
      }
    } catch (err) { console.log(err); }
  };

  const handleAssignToCSR = async () => {
    if (!assignLead || !selectedCsrId) return;
    setIsAssigning(true);
    try {
      await API.put(`/csr/lead/${assignLead.id}/assign`, { csrId: selectedCsrId });
      const csrName = csrList.find(c => c.id === selectedCsrId)?.name ?? "another CSR";
      showToast(`Lead assigned to ${csrName}.`, "warn");
      setLeads(prev => prev.filter(l => l.id !== assignLead.id));
      setShowAssignModal(false);
      setAssignLead(null);
    } catch { showToast("Failed to assign lead.", "warn"); }
    finally { setIsAssigning(false); }
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
      status: "important", nextSchedule: scheduleDate,
      nextTime: scheduleTime, timezone: selectedTimezone,
    });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowImportantModal(false);
    showToast("Scheduled as Important Call.");
  };

  const saveInterested = async () => {
    if (!statusLead || !selectedService) return;
    await API.put(`/csr/lead/${statusLead.id}`, { status: "interested", interestedService: selectedService });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowInterestedModal(false);
    showToast("Marked as Interested.");
  };

  const saveCloseClient = async () => {
    if (!statusLead || !projectTitle || !projectDeadline || !projectService) return;
    await API.put(`/csr/lead/${statusLead.id}`, {
      status: "Close Client", projectTitle, projectDeadline,
      projectBudget, projectNotes, interestedService: projectService,
    });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowCloseModal(false);
    showToast("Client closed & moved to Projects.");
  };

  const saveComment = async (id: string, comment: string) => {
    setSavingCommentId(id);
    try {
      await API.put(`/csr/lead/${id}`, { comments: comment });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, comments: comment } : l));
    } catch (err) { console.log(err); }
    setEditingCommentId(null);
    setSavingCommentId(null);
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 pt-[88px] sm:pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen} />

        {/* ── TOAST ── */}
        {toast && (
          <div className={`fixed top-4 sm:top-5 right-3 sm:right-5 z-[200] flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-xl text-xs sm:text-sm font-semibold transition-all max-w-[90vw] sm:max-w-none ${
            toast.type === "warn"
              ? "bg-amber-50 border border-amber-300 text-amber-800"
              : "bg-green-50 border border-green-300 text-green-800"
          }`}>
            {toast.type === "warn" ? <ArrowRightLeft size={14} className="shrink-0 sm:w-4 sm:h-4" /> : <RefreshCw size={14} className="shrink-0 sm:w-4 sm:h-4" />}
            <span className="truncate">{toast.msg}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 shrink-0">
              <X size={12} className="sm:w-[14px] sm:h-[14px]" />
            </button>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="mt-4 sm:mt-7 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-[28px] lg:text-[32px] font-bold text-[#0F172A]">Leads Follow-up</h1>
          <p className="text-gray-500 mt-1 sm:mt-1.5 text-xs sm:text-sm">
            Track Not Interested &amp; Not Picked leads with automatic redistribution.
          </p>
        </div>

        {/* ── STAT CARDS ── */}
        {/* 2-col mobile → 2-col sm → 4-col xl */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {[
            { label: "Not Interested",  value: notInterested.length, sub: `limit ${NOT_INTERESTED_LIMIT} tries`, color: "bg-[#FFF1F3] text-[#B8112D]", Icon: ThumbsDown  },
            { label: "Not Picked",      value: notPicked.length,     sub: `limit ${NOT_PICKED_LIMIT} tries`,     color: "bg-[#FFF7E6] text-[#B54708]", Icon: PhoneOff    },
            { label: "Near Limit (NI)", value: notInterested.filter(l => l.notInterestedCount >= NOT_INTERESTED_LIMIT - 1).length, sub: "1 try left", color: "bg-[#FEF3C7] text-[#92400E]", Icon: CircleAlert },
            { label: "Near Limit (NP)", value: notPicked.filter(l => l.notPickedCount >= NOT_PICKED_LIMIT - 1).length,             sub: "1 try left", color: "bg-[#FEF3C7] text-[#92400E]", Icon: CircleAlert },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl sm:rounded-[22px] p-3 sm:p-4 border border-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] sm:text-[12px] font-medium truncate">{card.label}</p>
                  <h2 className="text-2xl sm:text-[28px] font-bold text-[#0F172A] mt-0.5 sm:mt-1">{card.value}</h2>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">{card.sub}</p>
                </div>
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${card.color} flex items-center justify-center shrink-0`}>
                  <card.Icon size={16} className="sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── TAB BUTTONS ── */}
        <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-5 overflow-x-auto pb-0.5">
          {[
            { key: "notinterested", label: "Not Interested", count: notInterested.length, Icon: ThumbsDown },
            { key: "notpicked",     label: "Not Picked",     count: notPicked.length,     Icon: PhoneOff   },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as "notinterested" | "notpicked"); setSearch(""); }}
              className={`h-10 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"
              }`}
            >
              <tab.Icon size={14} className="sm:w-4 sm:h-4" />
              {tab.label}
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold ${activeTab === tab.key ? "bg-white/20" : "bg-[#FFF1F3]"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── TABLE CARD ── */}
        <div
          className="bg-white rounded-2xl sm:rounded-[30px] border border-white shadow-sm flex flex-col"
          style={{ maxHeight: "calc(100vh - 300px)", minHeight: "340px" }}
        >
          {/* Card header */}
          <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3] shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">
                  {activeTab === "notinterested" ? "Not Interested" : "Not Picked"} Leads
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
                  Auto-redistributed after{" "}
                  <span className="font-semibold text-[#B8112D]">{limit} tries</span>.
                </p>
              </div>

              {/* Search + refresh + count badge */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[150px] sm:flex-none sm:w-[220px] lg:w-[260px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-8 sm:pl-9 pr-3 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                  />
                </div>
                <button
                  onClick={() => void fetchLeads()}
                  className="h-9 sm:h-[40px] w-9 sm:w-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] flex items-center justify-center hover:border-[#B8112D] hover:text-[#B8112D] transition-colors text-gray-500"
                  title="Refresh"
                >
                  <RefreshCw size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className={`text-[11px] sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl whitespace-nowrap ${
                  activeTab === "notinterested" ? "bg-[#FFF1F3] text-[#B8112D]" : "bg-[#FFF7E6] text-[#B54708]"
                }`}>
                  {filtered.length} Leads
                </div>
              </div>
            </div>
          </div>

          {/* Horizontally scrollable table */}
          <div className="overflow-auto flex-1 px-3 sm:px-5 lg:px-6 pb-4 sm:pb-5">
            <table className="w-full" style={{ minWidth: "960px" }}>
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[#F1F1F1]">
                  {["Client","Company","Contact","Service","Comments","Tries","Status","Action"].map(h => (
                    <th key={h} className="text-left py-3 sm:py-4 px-2 text-[11px] sm:text-[13px] font-semibold text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map(i => (
                    <tr key={i} className="border-b border-[#F7F7F7]">
                      {[1,2,3,4,5,6,7,8].map(j => (
                        <td key={j} className="py-4 sm:py-5 px-2">
                          <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-14 sm:w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? filtered.map(lead => {
                  const tries       = lead[countKey as keyof Lead] as number;
                  const isNearLimit = tries >= limit - 1;
                  const isAtLimit   = tries >= limit;
                  const barColor    = isAtLimit
                    ? "bg-gray-300"
                    : isNearLimit
                    ? "bg-amber-400"
                    : activeTab === "notinterested" ? "bg-[#B8112D]" : "bg-amber-500";

                  return (
                    <>
                      <tr
                        key={lead.id}
                        className={`border-b border-[#F7F7F7] transition-all ${isAtLimit ? "opacity-60 bg-gray-50" : "hover:bg-[#FFF8F9]"}`}
                      >
                        {/* Client */}
                        <td className="py-4 sm:py-5 px-2">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 text-white ${
                              isAtLimit ? "bg-gray-400" : isNearLimit ? "bg-amber-500" : "bg-[#B8112D]"
                            }`}>
                              {lead.client.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px]">{lead.client}</h4>
                              <p className="text-gray-500 text-[10px] sm:text-[12px] mt-0.5">
                                {activeTab === "notinterested" ? "Not Interested" : "Not Picked"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Company */}
                        <td className="py-4 sm:py-5 px-2">
                          <h4 className="font-medium text-[#0F172A] text-[12px] sm:text-[14px] max-w-[110px] truncate">{lead.company}</h4>
                        </td>

                        {/* Contact */}
                        <td className="py-4 sm:py-5 px-2">
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-[13px] font-medium w-fit whitespace-nowrap">
                            <Phone size={11} className="sm:w-3 sm:h-3" />{lead.phone}
                          </div>
                        </td>

                        {/* Service */}
                        <td className="py-4 sm:py-5 px-2">
                          {lead.interestedService ? (
                            <div className="flex items-center gap-1 sm:gap-1.5 bg-[#FFF4E5] text-[#D97706] px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-[13px] font-semibold whitespace-nowrap">
                              <Briefcase size={11} className="sm:w-3 sm:h-3" />{lead.interestedService}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>

                        {/* Comments */}
                        <td className="py-4 sm:py-5 px-2">
                          {editingCommentId === lead.id ? (
                            <div className="flex flex-col gap-1.5 w-full max-w-[180px] sm:max-w-[220px]">
                              <textarea
                                autoFocus
                                value={commentDraft}
                                onChange={e => setCommentDraft(e.target.value)}
                                rows={2}
                                placeholder="Type your comment..."
                                className="w-full rounded-xl border border-[#B8112D] px-2.5 py-2 text-[12px] outline-none resize-none text-[#0F172A]"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => saveComment(lead.id, commentDraft)}
                                  disabled={savingCommentId === lead.id}
                                  className="flex-1 h-8 rounded-xl bg-[#B8112D] text-white text-[11px] font-semibold flex items-center justify-center gap-1"
                                >
                                  <Check size={11} />{savingCommentId === lead.id ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => setEditingCommentId(null)}
                                  className="flex-1 h-8 rounded-xl bg-[#F5F6FA] text-gray-500 text-[11px] font-semibold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => { setEditingCommentId(lead.id); setCommentDraft(lead.comments || ""); }}
                              className="group cursor-pointer flex items-start gap-2 max-w-[160px] sm:max-w-[200px]"
                            >
                              {lead.comments ? (
                                <div className="bg-[#F5F6FA] rounded-xl px-2.5 py-2 w-full">
                                  <p className="text-[12px] text-[#0F172A] leading-snug line-clamp-2">{lead.comments}</p>
                                  <p className="text-[10px] sm:text-[11px] text-[#B8112D] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Click to edit
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-gray-400 hover:text-[#B8112D] transition-colors">
                                  <MessageSquare size={13} /><span className="text-[12px]">Add comment</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Tries bar */}
                        <td className="py-4 sm:py-5 px-2 w-[130px] sm:w-[160px]">
                          <TriesBar used={tries} limit={limit} color={barColor} />
                          {isNearLimit && !isAtLimit && (
                            <span className="text-[10px] font-bold text-amber-600 mt-0.5 block">⚠ Last try</span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="py-4 sm:py-5 px-2">
                          {isAtLimit ? (
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 bg-gray-100 text-gray-500 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold whitespace-nowrap">
                              <ArrowRightLeft size={11} className="sm:w-3 sm:h-3" />Redistributed
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold whitespace-nowrap ${
                              activeTab === "notinterested"
                                ? "bg-[#FFF1F3] text-[#B8112D]"
                                : "bg-[#FFF7E6] text-[#B54708]"
                            }`}>
                              {activeTab === "notinterested"
                                ? <><ThumbsDown size={11} className="sm:w-3 sm:h-3" />Not Interested</>
                                : <><PhoneOff size={11} className="sm:w-3 sm:h-3" />Not Picked</>
                              }
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 sm:py-4 px-2">
                          <div className="flex flex-col gap-1.5 sm:gap-2 min-w-[170px] sm:min-w-[200px]">
                            {/* Eye + Retry + History */}
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <button
                                onClick={() => setViewingLead(lead)}
                                title="View details"
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                              >
                                <Eye size={12} className="sm:w-[13px] sm:h-[13px]" />
                              </button>
                              {!isAtLimit ? (
                                <button
                                  onClick={() => handleRetry(lead)}
                                  className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-[#F5F6FA] text-gray-700 text-[11px] sm:text-[12px] font-semibold flex items-center gap-1 sm:gap-1.5 hover:bg-[#B8112D] hover:text-white transition-all whitespace-nowrap"
                                >
                                  <RefreshCw size={11} className="sm:w-3 sm:h-3" />Retry
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 text-gray-400 text-[11px] sm:text-[12px]">
                                  <Users size={12} className="sm:w-[13px] sm:h-[13px]" />Reassigned
                                </div>
                              )}
                              {lead.followUpNotes && (
                                <button
                                  onClick={() => setExpandedRow(expandedRow === lead.id ? null : lead.id)}
                                  title="View history"
                                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-[#F5F6FA] text-gray-500 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all shrink-0"
                                >
                                  {expandedRow === lead.id
                                    ? <ChevronUp size={12} className="sm:w-[13px] sm:h-[13px]" />
                                    : <ChevronDown size={12} className="sm:w-[13px] sm:h-[13px]" />
                                  }
                                </button>
                              )}
                            </div>

                            {/* Status dropdown */}
                            <div className="relative w-full max-w-[200px] sm:max-w-[230px]">
                              <select
                                defaultValue=""
                                onChange={e => { handleUpdateStatus(lead, e.target.value); e.currentTarget.value = ""; }}
                                className="appearance-none h-9 sm:h-[46px] w-full rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 sm:px-4 pr-9 sm:pr-11 text-[12px] sm:text-[14px] font-semibold text-[#0F172A] outline-none"
                              >
                                <option value="">Update Status</option>
                                <option value="pending">Pending</option>
                                <option value="important">Important</option>
                                <option value="interested">Interested</option>
                                <option value="Close Client">Close Client</option>
                              </select>
                              <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <ChevronDown size={15} className="sm:w-[18px] sm:h-[18px]" />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* ── History row ── */}
                      {expandedRow === lead.id && lead.followUpNotes && (
                        <tr className="bg-[#F8FAFF]">
                          <td colSpan={8} className="px-4 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className="mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                <History size={12} className="sm:w-[14px] sm:h-[14px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] sm:text-[12px] font-semibold text-gray-500 mb-1.5 sm:mb-2 uppercase tracking-wide">Try History</p>
                                <div className="space-y-1.5 sm:space-y-2">
                                  {lead.followUpNotes.trim().split("\n").filter(Boolean).map((line, i) => {
                                    const isLimit   = line.includes("LIMIT REACHED");
                                    const isEditingThis = editingNote?.leadId === lead.id && editingNote.index === i;
                                    const bracketEnd = line.indexOf("]");
                                    const prefix  = bracketEnd !== -1 ? line.slice(0, bracketEnd + 1) : "";
                                    const rest    = bracketEnd !== -1 ? line.slice(bracketEnd + 1).trim() : line;

                                    return (
                                      <div key={i} className={`rounded-xl border text-[11px] sm:text-[12px] ${isLimit ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
                                        {isEditingThis ? (
                                          <div className="p-2 space-y-1.5 sm:space-y-2">
                                            <p className="text-[10px] sm:text-[11px] font-mono text-gray-400 px-1">{prefix}</p>
                                            <textarea
                                              autoFocus
                                              rows={2}
                                              value={editingNote.value.slice(bracketEnd + 1).trim()}
                                              onChange={e => setEditingNote({ ...editingNote, value: `${prefix} ${e.target.value}` })}
                                              placeholder="Add your note here..."
                                              className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] sm:text-[12px] text-gray-700 outline-none resize-none focus:border-blue-400"
                                            />
                                            <div className="flex gap-2 justify-end">
                                              <button onClick={() => setEditingNote(null)}
                                                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all">
                                                Cancel
                                              </button>
                                              <button onClick={() => handleSaveNote(lead)} disabled={savingNote}
                                                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50">
                                                {savingNote ? "Saving..." : "Save"}
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-start gap-2 px-2.5 sm:px-3 py-2">
                                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold shrink-0 mt-0.5 ${isLimit ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                                              {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <span className={`font-mono text-[10px] sm:text-[11px] ${isLimit ? "text-red-600" : "text-gray-400"}`}>{prefix} </span>
                                              <span className={isLimit ? "text-red-700 font-medium" : "text-gray-700"}>{rest}</span>
                                            </div>
                                            <button
                                              onClick={() => setEditingNote({ leadId: lead.id, index: i, value: line })}
                                              className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-500 flex items-center justify-center transition-all"
                                            >
                                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                              </svg>
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
                    <td colSpan={8} className="py-16 sm:py-20 text-center">
                      {activeTab === "notinterested"
                        ? <ThumbsDown size={24} className="text-gray-200 mx-auto mb-2 sm:mb-3 sm:w-7 sm:h-7" />
                        : <PhoneOff   size={24} className="text-gray-200 mx-auto mb-2 sm:mb-3 sm:w-7 sm:h-7" />
                      }
                      <p className="text-gray-400 text-xs sm:text-sm">
                        {search ? "No leads match your search." : "No leads in this category."}
                      </p>
                      {search && (
                        <button onClick={() => setSearch("")} className="mt-2 sm:mt-3 text-[#B8112D] text-xs sm:text-sm font-semibold hover:underline">
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
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Important Call</h2>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
                    Schedule follow-up for <span className="font-semibold text-[#0F172A]">{statusLead.client}</span>
                  </p>
                </div>
                <button onClick={() => setShowImportantModal(false)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500 shrink-0">
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {[
                  { label: "Date", inputType: "date", value: scheduleDate, onChange: setScheduleDate, Icon: Calendar },
                  { label: "Time", inputType: "time", value: scheduleTime, onChange: setScheduleTime, Icon: Clock    },
                ].map(({ label, inputType, value, onChange, Icon }) => (
                  <div key={label}>
                    <label className="text-xs sm:text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-1.5 sm:mb-2">
                      <Icon size={13} className="sm:w-[15px] sm:h-[15px]" />{label}
                    </label>
                    <input
                      type={inputType}
                      value={value}
                      onChange={e => onChange(e.target.value)}
                      className="w-full h-11 sm:h-[50px] rounded-xl sm:rounded-2xl border border-gray-200 px-3 sm:px-4 outline-none focus:border-[#B8112D] text-sm"
                    />
                  </div>
                ))}
                <div className="relative">
                  <label className="text-xs sm:text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-1.5 sm:mb-2">
                    <Globe size={13} className="sm:w-[15px] sm:h-[15px]" />Timezone
                  </label>
                  <select
                    value={selectedTimezone}
                    onChange={e => setSelectedTimezone(e.target.value)}
                    className="w-full h-11 sm:h-[50px] rounded-xl sm:rounded-2xl border border-gray-200 px-3 sm:px-4 pr-9 sm:pr-10 outline-none appearance-none bg-white focus:border-[#B8112D] text-xs sm:text-[13px]"
                  >
                    {usTimezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 sm:right-4 top-[38px] sm:top-[42px] pointer-events-none text-gray-400 sm:w-4 sm:h-4" />
                </div>
                {scheduleDate && scheduleTime && (
                  <div className="p-3 bg-[#F5F6FA] rounded-xl sm:rounded-2xl text-sm">
                    <p className="text-gray-500 text-[10px] sm:text-[11px] mb-1">Scheduled at</p>
                    <p className="font-semibold text-[#0F172A] text-xs sm:text-sm">
                      {scheduleDate} · {scheduleTime} {usTimezones.find(t => t.value === selectedTimezone)?.abbreviation}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1">
                      Current time: {getCurrentTimeInTimezone(selectedTimezone)}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button onClick={() => setShowImportantModal(false)} className="flex-1 h-10 sm:h-[50px] rounded-xl sm:rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600 text-sm">Cancel</button>
                <button onClick={saveImportant} disabled={!scheduleDate || !scheduleTime}
                  className="flex-1 h-10 sm:h-[50px] rounded-xl sm:rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40">
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ INTERESTED MODAL ══ */}
        {showInterestedModal && statusLead && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Client Interested In</h2>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
                    <span className="font-semibold text-[#0F172A]">{statusLead.client}</span> is interested in:
                  </p>
                </div>
                <button onClick={() => setShowInterestedModal(false)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500 shrink-0">
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
                {serviceOptions.map(({ value, label, Icon }) => {
                  const sel = selectedService === value;
                  return (
                    <button key={value} onClick={() => setSelectedService(value)}
                      className={`h-[70px] sm:h-[80px] rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all text-[12px] sm:text-[13px] font-semibold ${
                        sel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-[#0F172A] hover:border-gray-300"
                      }`}>
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center ${sel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}>
                        <Icon size={15} className={`sm:w-[17px] sm:h-[17px] ${sel ? "text-[#B8112D]" : "text-gray-500"}`} />
                      </div>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button onClick={() => setShowInterestedModal(false)} className="flex-1 h-10 sm:h-[50px] rounded-xl sm:rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600 text-sm">Cancel</button>
                <button onClick={saveInterested} disabled={!selectedService}
                  className="flex-1 h-10 sm:h-[50px] rounded-xl sm:rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40">
                  Save Interest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ CLOSE CLIENT MODAL ══ */}
        {showCloseModal && statusLead && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="w-full sm:max-w-[520px] lg:max-w-[540px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
              {/* Gradient header */}
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <button onClick={() => setShowCloseModal(false)}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className="flex items-center gap-2.5 sm:gap-3 pr-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-base sm:text-xl font-bold shrink-0">
                    {statusLead.client.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight">Close Client</h2>
                    <p className="text-white/65 text-[10px] sm:text-xs mt-0.5 truncate">
                      {statusLead.client}{statusLead.phone ? ` · ${statusLead.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-green-500/25 text-green-100 border border-green-400/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold">
                    <Check size={9} className="sm:w-[10px] sm:h-[10px]" /> Fill in project details to confirm
                  </span>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">
                  {/* Project Title */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <FileText size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                      Project Title <span className="text-[#B8112D] normal-case ml-1">*required</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BIM Modeling Phase 1"
                      value={projectTitle}
                      onChange={e => setProjectTitle(e.target.value)}
                      className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"
                    />
                  </div>

                  {/* Service picker */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <Briefcase size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                      Service to Provide <span className="text-[#B8112D] normal-case ml-1">*required</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {serviceOptions.map(({ value, label, Icon }) => {
                        const sel = projectService === value;
                        return (
                          <button key={value} onClick={() => setProjectService(value)}
                            className={`relative py-2.5 sm:py-3 px-1 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition-all text-[10px] sm:text-[11px] font-semibold ${sel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"}`}>
                            {sel && (
                              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-[#B8112D] rounded-full flex items-center justify-center">
                                <Check size={8} className="text-white sm:w-[9px] sm:h-[9px]" />
                              </span>
                            )}
                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center ${sel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}>
                              <Icon size={13} className={`sm:w-[15px] sm:h-[15px] ${sel ? "text-[#B8112D]" : "text-gray-400"}`} />
                            </div>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Deadline + Budget */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                        <CalendarDays size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                        Deadline <span className="text-[#B8112D] normal-case">*</span>
                      </label>
                      <input
                        type="date"
                        value={projectDeadline}
                        onChange={e => setProjectDeadline(e.target.value)}
                        className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-2 sm:px-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                        <DollarSign size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                        Budget <span className="text-gray-300 normal-case">(opt)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="text"
                          placeholder="0.00"
                          value={projectBudget.replace(/^\$/, "")}
                          onChange={e => setProjectBudget(e.target.value)}
                          className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] pl-6 sm:pl-7 pr-2 sm:pr-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <AlignLeft size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                      Notes <span className="text-gray-300 normal-case">(optional)</span>
                    </label>
                    <textarea
                      placeholder="Any additional notes..."
                      value={projectNotes}
                      onChange={e => setProjectNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"
                    />
                  </div>

                  <div className="flex gap-2 sm:gap-3 pb-1">
                    <button onClick={() => setShowCloseModal(false)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={saveCloseClient}
                      disabled={!projectTitle || !projectDeadline || !projectService}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all ${
                        projectTitle && projectDeadline && projectService
                          ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200"
                          : "bg-gray-200 cursor-not-allowed text-gray-400"
                      }`}
                    >
                      Confirm &amp; Move to Projects
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ASSIGN CSR MODAL (shown when retry limit reached) ══ */}
        {showAssignModal && assignLead && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden">
              {/* header */}
              <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">Assign to CSR</h2>
                    <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                      Limit reached for <span className="font-semibold text-white">{assignLead.client}</span>. Pick a CSR:
                    </p>
                  </div>
                  <button onClick={() => setShowAssignModal(false)}
                    className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0">
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* CSR list */}
              <div className="px-5 sm:px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
                {csrList.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No other active CSRs available.</p>
                ) : csrList.map(csr => (
                  <button
                    key={csr.id}
                    onClick={() => setSelectedCsrId(csr.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                      selectedCsrId === csr.id
                        ? "border-[#B8112D] bg-[#FFF1F3]"
                        : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                      selectedCsrId === csr.id ? "bg-[#B8112D]" : "bg-gray-400"
                    }`}>
                      {csr.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${selectedCsrId === csr.id ? "text-[#B8112D]" : "text-[#0F172A]"}`}>
                        {csr.name}
                      </p>
                      {csr.csrCode && (
                        <p className="text-xs text-gray-400">{csr.csrCode}</p>
                      )}
                    </div>
                    {selectedCsrId === csr.id && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* actions */}
              <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2">
                <button onClick={() => setShowAssignModal(false)}
                  className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleAssignToCSR}
                  disabled={!selectedCsrId || isAssigning}
                  className="flex-1 h-11 rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Users size={14} />
                  {isAssigning ? "Assigning…" : "Assign Lead"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ LEAD DETAIL MODAL ══ */}
        {viewingLead && (
          <LeadDetailModal
            lead={{
              id: viewingLead.id,
              name: viewingLead.client,
              company:   viewingLead.company !== "N/A" ? viewingLead.company : undefined,
              phone:     viewingLead.phone   !== "N/A" ? viewingLead.phone   : undefined,
              email:     viewingLead.email,
              state:     viewingLead.state   || undefined,
              status:    viewingLead.status,
              interestedService: viewingLead.interestedService,
              followUpNotes:     viewingLead.followUpNotes,
            }}
            onClose={() => setViewingLead(null)}
            onSaved={(id, updates) => {
              const merged: Partial<Lead> = {};
              if (updates.name         !== undefined) merged.client = updates.name.trim()  || "Unknown";
              if (updates.phone        !== undefined) merged.phone  = updates.phone.trim() || "N/A";
              if (updates.email        !== undefined) merged.email  = updates.email.trim();
              if (updates.state        !== undefined) merged.state  = updates.state.trim();
              if (updates.followUpNotes !== undefined) merged.followUpNotes = updates.followUpNotes;
              setLeads(prev => prev.map(l => l.id === id ? { ...l, ...merged } : l));
              setViewingLead(prev => prev ? { ...prev, ...merged } : prev);
            }}
          />
        )}
      </main>
    </div>
  );
}