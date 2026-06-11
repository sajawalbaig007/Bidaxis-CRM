"use client";

import { useState, useEffect, useMemo } from "react";

import {
  PhoneCall, CalendarDays, Clock3, CircleAlert, Phone,
  X, Globe, ChevronDown, Pencil, Trophy, UserX, CalendarClock,
  Briefcase, FileText, DollarSign, AlignLeft, Eye,
  BarChart2, PenTool, Building2, Monitor, Search,
  MessageSquare, Check,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import LeadDetailModal from "../components/LeadDetailModal";
import API from "@/lib/api";

/* ── Timezones ── */
const usTimezones = [
  { value: "America/Adak",                  label: "Hawaii-Aleutian (UTC-10:00)", abbreviation: "HAST" },
  { value: "America/Anchorage",             label: "Alaska (UTC-09:00)",          abbreviation: "AKST" },
  { value: "America/Los_Angeles",           label: "Pacific Time (UTC-08:00)",    abbreviation: "PT"   },
  { value: "America/Denver",               label: "Mountain Time (UTC-07:00)",   abbreviation: "MT"   },
  { value: "America/Chicago",              label: "Central Time (UTC-06:00)",    abbreviation: "CT"   },
  { value: "America/New_York",             label: "Eastern Time (UTC-05:00)",    abbreviation: "ET"   },
  { value: "America/Phoenix",              label: "Arizona (UTC-07:00) - No DST",abbreviation: "MST"  },
  { value: "America/Indiana/Indianapolis", label: "Indiana (UTC-05:00)",          abbreviation: "EST"  },
  { value: "Pacific/Honolulu",             label: "Hawaii (UTC-10:00) - No DST", abbreviation: "HST"  },
];

const serviceOptions = [
  { value: "Estimating",   label: "Estimating",   Icon: BarChart2    },
  { value: "Scheduling",   label: "Scheduling",   Icon: CalendarDays  },
  { value: "Shop Drawing", label: "Shop Drawing", Icon: PenTool      },
  { value: "Drafting",     label: "Drafting",     Icon: Pencil       },
  { value: "BIM",          label: "BIM",          Icon: Building2    },
  { value: "IT",           label: "IT",           Icon: Monitor      },
];

/* ── Types ── */
interface BackendLead {
  id: string; status?: string; name?: string; company?: string;
  phone?: string; email?: string; state?: string;
  nextSchedule?: string; nextTime?: string; timezone?: string;
  followUpNotes?: string; interestedService?: string;
  interested_service?: string; service?: string;
  serviceInterested?: string; serviceName?: string; comments?: string;
}

type CallType = {
  id: string; type: string; client: string; company: string; phone: string;
  email?: string; state?: string; priority: string;
  nextFollowup?: string; time?: string; timezone?: string;
  notes?: string; status?: string; interestedService?: string; comments?: string;
};

type EditAction = "reschedule" | "closeclient" | "deleteclient" | null;

const todayStr = new Date().toISOString().split("T")[0];

export default function ImportantCallsPage() {
  const [isOpen,         setIsOpen]         = useState(false);
  const [importantCalls, setImportantCalls] = useState<CallType[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activeTab,      setActiveTab]      = useState("important");

  const [searchQuery,    setSearchQuery]    = useState("");
  const [filterDate,     setFilterDate]     = useState("");

  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editingCall,    setEditingCall]    = useState<CallType | null>(null);
  const [editAction,     setEditAction]     = useState<EditAction>(null);

  const [viewingCall,    setViewingCall]    = useState<CallType | null>(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft,     setCommentDraft]     = useState("");
  const [savingCommentId,  setSavingCommentId]  = useState<string | null>(null);

  const [scheduleDate,     setScheduleDate]     = useState("");
  const [scheduleTime,     setScheduleTime]     = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");

  const [projectTitle,    setProjectTitle]    = useState("");
  const [projectDeadline, setProjectDeadline] = useState("");
  const [projectBudget,   setProjectBudget]   = useState("");
  const [projectNotes,    setProjectNotes]    = useState("");
  const [projectService,  setProjectService]  = useState("");

  /* ── FETCH ── */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await API.get("/csr/dashboard");
        const formatted: CallType[] = (res.data.leads ?? [])
          .filter((lead: BackendLead) =>
            lead.status === "important" ||
            lead.status === "interested" ||
            lead.status === "Close Client"
          )
          .map((lead: BackendLead) => ({
            id: lead.id,
            type: lead.status === "important" ? "important" : "interested",
            client:  lead.name    ?? "Unknown",
            company: lead.company ?? "N/A",
            phone:   lead.phone   ?? "N/A",
            email:   lead.email   ?? "",
            state:   lead.state   ?? "",
            priority: lead.status === "important" ? "High" : "Medium",
            nextFollowup:     lead.nextSchedule  ?? "",
            time:             lead.nextTime      ?? "N/A",
            timezone:         lead.timezone      ?? "N/A",
            notes:            lead.followUpNotes ?? "No notes added",
            comments:         lead.comments      ?? "",
            status:           lead.status,
            interestedService:
              lead.interestedService  ??
              lead.interested_service ??
              lead.service            ??
              lead.serviceInterested  ??
              lead.serviceName        ??
              "",
          }));
        setImportantCalls(formatted);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── FILTERED ── */
  const filteredCalls = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return importantCalls.filter(call => {
      const matchesTab =
        activeTab === "important"
          ? call.status === "important"
          : call.status === "interested";
      const matchesSearch =
        !q ||
        call.client.toLowerCase().includes(q) ||
        call.company.toLowerCase().includes(q) ||
        call.phone.toLowerCase().includes(q);
      const matchesDate = !filterDate || call.nextFollowup === filterDate;
      return matchesTab && matchesSearch && matchesDate;
    });
  }, [importantCalls, activeTab, searchQuery, filterDate]);

  /* ── STATS ── */
  const totalImportantCount = importantCalls.filter(c => c.status === "important").length;
  const interestedCount     = importantCalls.filter(c => c.status === "interested").length;
  const projectWonCount     = importantCalls.filter(c => c.status === "Close Client").length;
  const callsTodayCount     = importantCalls.filter(c => c.status === "important" && c.nextFollowup === todayStr).length;

  const statCards = [
    { label: "Important Calls",       value: totalImportantCount, sub: "total flagged",       color: "bg-[#FFF1F3] text-[#B8112D]", Icon: CircleAlert },
    { label: "Important Calls Today", value: callsTodayCount,     sub: "scheduled for today", color: "bg-[#EAF5FF] text-[#0B84F3]", Icon: PhoneCall   },
    { label: "Interested",            value: interestedCount,     sub: "service interest",    color: "bg-[#ECFDF3] text-[#027A48]", Icon: Briefcase   },
    { label: "Close Client",          value: projectWonCount,     sub: "closed deals",        color: "bg-[#ECFDF5] text-[#065F46]", Icon: Trophy      },
  ];

  /* ── EDIT MODAL helpers ── */
  const openEditModal = (call: CallType) => {
    setEditingCall(call);
    setEditAction(null);
    setScheduleDate(""); setScheduleTime("");
    setSelectedTimezone(call.timezone && call.timezone !== "N/A" ? call.timezone : "America/New_York");
    setProjectTitle(call.company !== "N/A" ? call.company : call.client);
    setProjectDeadline(""); setProjectBudget(""); setProjectNotes(""); setProjectService("");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false); setEditingCall(null); setEditAction(null);
    setScheduleDate(""); setScheduleTime("");
    setProjectTitle(""); setProjectDeadline(""); setProjectBudget(""); setProjectNotes(""); setProjectService("");
  };

  const saveReschedule = async () => {
    if (!scheduleDate || !scheduleTime || !editingCall) return;
    try {
      await API.put(`/csr/lead/${editingCall.id}`, {
        status: "important", nextSchedule: scheduleDate,
        nextTime: scheduleTime, timezone: selectedTimezone,
      });
      setImportantCalls(prev => prev.map(c =>
        c.id === editingCall.id
          ? { ...c, nextFollowup: scheduleDate, time: scheduleTime, timezone: selectedTimezone, status: "important" }
          : c
      ));
      closeEditModal();
    } catch (err) { console.log(err); }
  };

  const saveProjectWon = async () => {
    if (!projectTitle || !projectDeadline || !projectService || !editingCall) return;
    try {
      await API.put(`/csr/lead/${editingCall.id}`, {
        status: "Close Client",
        projectTitle, projectDeadline, projectBudget, projectNotes,
        interestedService: projectService,
      });
      setImportantCalls(prev => prev.filter(c => c.id !== editingCall.id));
      closeEditModal();
    } catch (err) { console.log(err); }
  };

  const saveCloseClient = async () => {
    if (!editingCall) return;
    try {
      await API.put(`/csr/lead/${editingCall.id}`, { status: "closed" });
      setImportantCalls(prev => prev.filter(c => c.id !== editingCall.id));
      closeEditModal();
    } catch (err) { console.log(err); }
  };

  const saveComment = async (id: string, comment: string) => {
    setSavingCommentId(id);
    try {
      await API.put(`/csr/lead/${id}`, { comments: comment });
      setImportantCalls(prev => prev.map(c => c.id === id ? { ...c, comments: comment } : c));
    } catch (err) { console.log(err); }
    setEditingCommentId(null);
    setSavingCommentId(null);
  };

  const getTzAbbr = (tzValue: string) => {
    const found = usTimezones.find(tz => tz.value === tzValue);
    return found ? found.abbreviation : (tzValue?.split("/").pop() ?? tzValue);
  };

  const projectWonValid = projectTitle.trim() !== "" && projectDeadline !== "" && projectService !== "";

  /* ── Shared comment cell renderer ── */
  const CommentCell = ({ call }: { call: CallType }) => (
    editingCommentId === call.id ? (
      <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
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
            onClick={() => saveComment(call.id, commentDraft)}
            disabled={savingCommentId === call.id}
            className="flex-1 h-8 rounded-xl bg-[#B8112D] text-white text-[11px] font-semibold flex items-center justify-center gap-1"
          >
            <Check size={11} />{savingCommentId === call.id ? "Saving..." : "Save"}
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
        onClick={() => { setEditingCommentId(call.id); setCommentDraft(call.comments || ""); }}
        className="group cursor-pointer flex items-start gap-2 max-w-[180px]"
      >
        {call.comments ? (
          <div className="bg-[#F5F6FA] rounded-xl px-2.5 py-2 w-full">
            <p className="text-[12px] text-[#0F172A] leading-snug line-clamp-2">{call.comments}</p>
            <p className="text-[10px] text-[#B8112D] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</p>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-400 hover:text-[#B8112D] transition-colors">
            <MessageSquare size={13} /><span className="text-[12px]">Add comment</span>
          </div>
        )}
      </div>
    )
  );

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 pt-[88px] sm:pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen} />

        {/* ── HEADER ── */}
        <div className="mt-4 sm:mt-7">
          <h1 className="text-2xl sm:text-[28px] lg:text-[34px] font-bold text-[#0F172A] leading-tight">
            Important Calls
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-sm">
            Manage important and interested clients.
          </p>
        </div>

        {/* ── STAT CARDS ── */}
        {/* 2-col mobile → 2-col sm → 4-col xl */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-7">
          {statCards.map(card => (
            <div key={card.label} className="bg-white rounded-2xl sm:rounded-[24px] p-3 sm:p-5 border border-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] sm:text-[12px] font-medium truncate">{card.label}</p>
                  {loading ? (
                    <div className="h-7 sm:h-8 w-8 sm:w-10 bg-gray-100 rounded-lg mt-1.5 sm:mt-2 animate-pulse" />
                  ) : (
                    <h2 className="text-2xl sm:text-[28px] font-bold text-[#0F172A] mt-1 sm:mt-2">{card.value}</h2>
                  )}
                  <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1 truncate">{card.sub}</p>
                </div>
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${card.color} flex items-center justify-center shrink-0`}>
                  <card.Icon size={16} className="sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── TAB FILTER BUTTONS ── */}
        {/* Scrollable on very small screens */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7 overflow-x-auto pb-1">
          {[
            { key: "important", label: "Important Calls",    count: totalImportantCount, Icon: CircleAlert },
            { key: "interested",label: "Interested Clients", count: interestedCount,     Icon: PhoneCall   },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(""); setFilterDate(""); }}
              className={`h-10 sm:h-12 px-3 sm:px-5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"
              }`}
            >
              <tab.Icon size={14} className="sm:w-[17px] sm:h-[17px]" />
              {tab.label}
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] ${activeTab === tab.key ? "bg-white/20" : "bg-[#FFF1F3]"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════
            IMPORTANT TABLE
        ══════════════════════════════ */}
        {activeTab === "important" && (
          <div
            className="bg-white rounded-2xl sm:rounded-[30px] border border-white shadow-sm mt-4 sm:mt-7 flex flex-col"
            style={{ maxHeight: "calc(100vh - 300px)", minHeight: "360px" }}
          >
            {/* Table header */}
            <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3] shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Important Clients</h3>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Scheduled follow-up meetings.</p>
                </div>

                {/* Search + date filter — wraps on mobile */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-[220px] lg:w-[260px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-8 sm:pl-9 pr-3 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                    />
                  </div>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] px-2.5 sm:px-4 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate("")}
                      className="h-9 sm:h-[40px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] text-xs sm:text-[13px] text-gray-500 hover:text-[#B8112D] transition-all"
                    >
                      Clear
                    </button>
                  )}
                  <div className="bg-[#FFF1F3] text-[#B8112D] text-[11px] sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl whitespace-nowrap">
                    {filteredCalls.length} Leads
                  </div>
                </div>
              </div>
            </div>

            {/* Horizontally scrollable table */}
            <div className="overflow-auto flex-1 px-4 sm:px-5 lg:px-6 pb-4 sm:pb-5">
              <table className="w-full" style={{ minWidth: "960px" }}>
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-[#F1F1F1]">
                    {["Client","Company","Contact","Next Schedule","Time & Timezone","Comments","Status","Action"].map(h => (
                      <th key={h} className="text-left py-3 sm:py-4 px-2 text-[12px] sm:text-[13px] font-semibold text-gray-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6,7,8].map(j => (
                          <td key={j} className="py-4 sm:py-5 px-2">
                            <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? filteredCalls.map(call => (
                    <tr key={call.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      {/* Client */}
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                            {call.client.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px]">{call.client}</h4>
                            <p className="text-gray-500 text-[11px] sm:text-[12px] mt-0.5">Important Lead</p>
                          </div>
                        </div>
                      </td>
                      {/* Company */}
                      <td className="py-4 sm:py-5 px-2">
                        <h4 className="font-medium text-[#0F172A] text-[13px] sm:text-[14px] max-w-[120px] truncate">{call.company}</h4>
                      </td>
                      {/* Contact */}
                      <td className="py-4 sm:py-5 px-2">
                        <div className="bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap">
                          {call.phone}
                        </div>
                      </td>
                      {/* Next Schedule */}
                      <td className="py-4 sm:py-5 px-2">
                        {call.nextFollowup ? (
                          <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold whitespace-nowrap ${
                            call.nextFollowup === todayStr
                              ? "bg-[#EAF5FF] text-[#0B84F3]"
                              : "bg-[#F5F6FA] text-gray-600"
                          }`}>
                            <CalendarDays size={11} className="sm:w-[12px] sm:h-[12px]" />
                            {call.nextFollowup === todayStr ? "Today" : call.nextFollowup}
                          </span>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </td>
                      {/* Time & Timezone */}
                      <td className="py-4 sm:py-5 px-2">
                        <p className="text-[13px] sm:text-[14px] font-semibold text-[#0F172A] whitespace-nowrap">
                          {call.time && call.time !== "N/A" ? call.time : "—"}
                        </p>
                        {call.timezone && call.timezone !== "N/A" && (
                          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 max-w-[140px] truncate">
                            {getTzAbbr(call.timezone)}
                          </p>
                        )}
                      </td>
                      {/* Comments */}
                      <td className="py-4 sm:py-5 px-2">
                        <CommentCell call={call} />
                      </td>
                      {/* Status */}
                      <td className="py-4 sm:py-5 px-2">
                        <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold w-fit whitespace-nowrap ${
                          call.priority === "High" ? "bg-[#FFF7E6] text-[#B54708]" : "bg-[#FFF1F3] text-[#B42318]"
                        }`}>
                          {call.priority}
                        </div>
                      </td>
                      {/* Action */}
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            onClick={() => setViewingCall(call)}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          >
                            <Eye size={13} className="sm:w-[15px] sm:h-[15px]" />
                          </button>
                          <button
                            onClick={() => openEditModal(call)}
                            className="h-8 sm:h-10 px-2.5 sm:px-4 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 hover:bg-[#B8112D] hover:text-white transition-all whitespace-nowrap"
                          >
                            <Pencil size={12} className="sm:w-[14px] sm:h-[14px]" />Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="py-16 sm:py-20 text-center">
                        <Search size={24} className="text-gray-200 mx-auto mb-2 sm:mb-3 sm:w-7 sm:h-7" />
                        <p className="text-gray-400 text-xs sm:text-sm">No important clients found.</p>
                        {(searchQuery || filterDate) && (
                          <button
                            onClick={() => { setSearchQuery(""); setFilterDate(""); }}
                            className="mt-2 sm:mt-3 text-[#B8112D] text-xs sm:text-sm font-semibold hover:underline"
                          >
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            INTERESTED TABLE
        ══════════════════════════════ */}
        {activeTab === "interested" && (
          <div
            className="bg-white rounded-2xl sm:rounded-[30px] border border-white shadow-sm mt-4 sm:mt-7 flex flex-col"
            style={{ maxHeight: "calc(100vh - 300px)", minHeight: "360px" }}
          >
            <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3] shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Interested Clients</h3>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Clients who have shown interest in our services.</p>
                </div>
                <div className="bg-[#FFF1F3] text-[#B8112D] text-[11px] sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl w-fit">
                  {filteredCalls.length} Leads
                </div>
              </div>
            </div>

            <div className="overflow-auto flex-1 px-4 sm:px-5 lg:px-6 pb-4 sm:pb-5">
              <table className="w-full" style={{ minWidth: "820px" }}>
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-[#F1F1F1]">
                    {["Client","Company","Contact","Interested In","Comments","Status","Action"].map(h => (
                      <th key={h} className="text-left py-3 sm:py-4 px-2 text-[12px] sm:text-[13px] font-semibold text-gray-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6,7].map(j => (
                          <td key={j} className="py-4 sm:py-5 px-2">
                            <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? filteredCalls.map(call => (
                    <tr key={call.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                            {call.client.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px]">{call.client}</h4>
                            <p className="text-gray-500 text-[11px] sm:text-[12px] mt-0.5 sm:mt-1">Interested Lead</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <h4 className="font-medium text-[#0F172A] text-[13px] sm:text-[14px] max-w-[120px] truncate">{call.company}</h4>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap">
                          {call.phone}
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        {call.interestedService ? (
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-[#FFF4E5] text-[#D97706] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap">
                            <Briefcase size={11} className="sm:w-[13px] sm:h-[13px]" />{call.interestedService}
                          </div>
                        ) : <span className="text-gray-400 text-xs sm:text-sm">Not specified</span>}
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <CommentCell call={call} />
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="bg-[#FFF1F3] text-[#B8112D] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold w-fit whitespace-nowrap">
                          Interested
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            onClick={() => setViewingCall(call)}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          >
                            <Eye size={13} className="sm:w-[15px] sm:h-[15px]" />
                          </button>
                          <button
                            onClick={() => openEditModal(call)}
                            className="h-8 sm:h-10 px-2.5 sm:px-4 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:bg-[#B8112D] hover:text-white transition-all whitespace-nowrap"
                          >
                            <Pencil size={12} className="sm:w-[14px] sm:h-[14px]" />Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-16 sm:py-20 text-center text-gray-400 text-xs sm:text-sm">
                        No interested clients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            EDIT MODAL
        ══════════════════════════════ */}
        {showEditModal && editingCall && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="w-full sm:max-w-[520px] lg:max-w-[540px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
              {/* Gradient header */}
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <button
                  onClick={closeEditModal}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10"
                >
                  <X size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className="flex items-center gap-2.5 sm:gap-3 pr-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-lg sm:text-xl font-bold shrink-0">
                    {editingCall.client.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight">
                      {editAction === "reschedule"   ? "Reschedule Call"
                       : editAction === "closeclient"  ? "Close Client"
                       : editAction === "deleteclient" ? "Delete Client"
                       : "Edit Client"}
                    </h2>
                    <p className="text-white/65 text-[11px] sm:text-xs mt-0.5 truncate">
                      {editingCall.client}
                      {editingCall.company && editingCall.company !== "N/A" ? ` · ${editingCall.company}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">

                  {/* ACTION CHOOSER */}
                  {!editAction && (
                    <div className="space-y-2 sm:space-y-3">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        What would you like to do?
                      </p>
                      {[
                        { action: "reschedule" as EditAction,  Icon: CalendarClock, iconBg: "bg-[#EAF5FF] text-[#0B84F3]", title: "Reschedule",    sub: "Pick a new date, time & timezone" },
                        { action: "closeclient" as EditAction, Icon: Trophy,        iconBg: "bg-[#ECFDF5] text-[#065F46]", title: "Close Client",   sub: "Fill project details & move to Projects" },
                        { action: "deleteclient" as EditAction,Icon: UserX,         iconBg: "bg-[#FFF1F3] text-[#B42318]", title: "Delete Client",  sub: "Remove this client from the list" },
                      ].map(opt => (
                        <button
                          key={String(opt.action)}
                          onClick={() => setEditAction(opt.action)}
                          className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-gray-100 bg-[#FAFAFA] hover:border-[#B8112D] hover:bg-[#FFF1F3] transition-all text-left"
                        >
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${opt.iconBg} flex items-center justify-center shrink-0`}>
                            <opt.Icon size={18} className="sm:w-[22px] sm:h-[22px]" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#0F172A] text-sm sm:text-[15px]">{opt.title}</h4>
                            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{opt.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* RESCHEDULE */}
                  {editAction === "reschedule" && (
                    <>
                      {[
                        { label: "New Schedule Date", inputType: "date", value: scheduleDate, onChange: setScheduleDate, Icon: CalendarDays },
                        { label: "New Call Time",     inputType: "time", value: scheduleTime, onChange: setScheduleTime, Icon: Clock3       },
                      ].map(({ label, inputType, value, onChange, Icon }) => (
                        <div key={label}>
                          <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                            <Icon size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />{label}
                          </label>
                          <input
                            type={inputType}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors"
                          />
                        </div>
                      ))}
                      <div className="relative">
                        <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                          <Globe size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />Client Timezone (US)
                        </label>
                        <select
                          value={selectedTimezone}
                          onChange={e => setSelectedTimezone(e.target.value)}
                          className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 pr-9 sm:pr-10 text-sm outline-none appearance-none focus:border-[#B8112D] focus:bg-white transition-colors"
                        >
                          {usTimezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                        </select>
                        <div className="absolute right-3 sm:right-4 top-[34px] sm:top-[38px] pointer-events-none text-gray-400">
                          <ChevronDown size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </div>
                      </div>
                      {scheduleDate && scheduleTime && (
                        <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Clock3 size={11} className="text-[#B8112D]" />
                            <p className="text-gray-400 text-[10px] sm:text-[11px]">New Schedule Preview</p>
                          </div>
                          <h4 className="font-semibold text-[#0F172A] text-xs sm:text-[13px]">
                            {scheduleDate} at {scheduleTime} {usTimezones.find(tz => tz.value === selectedTimezone)?.abbreviation}
                          </h4>
                        </div>
                      )}
                      <div className="flex gap-2 sm:gap-3 pb-1">
                        <button onClick={() => setEditAction(null)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Back</button>
                        <button
                          onClick={saveReschedule}
                          disabled={!scheduleDate || !scheduleTime}
                          className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${scheduleDate && scheduleTime ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"}`}
                        >
                          Save Schedule
                        </button>
                      </div>
                    </>
                  )}

                  {/* CLOSE CLIENT */}
                  {editAction === "closeclient" && (
                    <>
                      <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ECFDF5] text-[#065F46] flex items-center justify-center shrink-0">
                          <Trophy size={15} className="sm:w-[18px] sm:h-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-[#0F172A] text-xs sm:text-[13px]">Close Client</h4>
                          <p className="text-gray-400 text-[10px] sm:text-[11px] mt-0.5 truncate">
                            Fill in project details for <strong className="text-gray-600">{editingCall.client}</strong>
                          </p>
                        </div>
                      </div>

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
                              <button
                                key={value}
                                onClick={() => setProjectService(value)}
                                className={`relative py-2.5 sm:py-3 px-1 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition-all text-[10px] sm:text-[11px] font-semibold ${sel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"}`}
                              >
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
                        <button onClick={() => setEditAction(null)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Back</button>
                        <button
                          onClick={saveProjectWon}
                          disabled={!projectWonValid}
                          className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${projectWonValid ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"}`}
                        >
                          Confirm &amp; Move
                        </button>
                      </div>
                    </>
                  )}

                  {/* DELETE CLIENT */}
                  {editAction === "deleteclient" && (
                    <>
                      <div className="bg-[#FFF1F3] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white text-[#B42318] flex items-center justify-center shrink-0 shadow-sm">
                          <UserX size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-[#B42318] text-xs sm:text-[14px]">Confirm Delete Client</h4>
                          <p className="text-[#B42318]/70 text-[11px] sm:text-[12px] mt-0.5">
                            <strong>{editingCall.client}</strong> will be removed permanently.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 sm:gap-3 pb-1">
                        <button onClick={() => setEditAction(null)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Back</button>
                        <button onClick={saveCloseClient} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#B42318] text-white font-semibold text-sm hover:bg-[#9c1d14] transition-colors">
                          Delete Client
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LEAD DETAIL MODAL ── */}
        {viewingCall && (
          <LeadDetailModal
            lead={{
              id: viewingCall.id,
              name: viewingCall.client,
              company:   viewingCall.company   !== "N/A"           ? viewingCall.company   : undefined,
              phone:     viewingCall.phone     !== "N/A"           ? viewingCall.phone     : undefined,
              email:     viewingCall.email,
              state:     viewingCall.state     || undefined,
              status:    viewingCall.status,
              interestedService: viewingCall.interestedService,
              followUpNotes:    viewingCall.notes !== "No notes added" ? viewingCall.notes : undefined,
              nextSchedule:     viewingCall.nextFollowup  || undefined,
              nextTime:         viewingCall.time && viewingCall.time !== "N/A" ? viewingCall.time : undefined,
              timezone:         viewingCall.timezone && viewingCall.timezone !== "N/A" ? viewingCall.timezone : undefined,
            }}
            onClose={() => setViewingCall(null)}
            onSaved={(id, updates) => {
              const merged: Partial<CallType> = {};
              if (updates.name         !== undefined) merged.client = updates.name.trim()  || "Unknown";
              if (updates.phone        !== undefined) merged.phone  = updates.phone.trim() || "N/A";
              if (updates.email        !== undefined) merged.email  = updates.email.trim();
              if (updates.state        !== undefined) merged.state  = updates.state.trim();
              if (updates.followUpNotes !== undefined) merged.notes = updates.followUpNotes || "No notes added";
              setImportantCalls(prev => prev.map(c => c.id === id ? { ...c, ...merged } : c));
              setViewingCall(prev => prev ? { ...prev, ...merged } : prev);
            }}
          />
        )}
      </main>
    </div>
  );
}