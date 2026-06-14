"use client";

import { useMemo, useState } from "react";
import {
  PhoneCall, CalendarDays, CircleAlert, Eye, Pencil, Briefcase, Search,
} from "lucide-react";

import TopNavbar from "../components/navigation/TopNavbar";
import LeadDetailModal from "../components/LeadDetailModal";
import CommentCell from "../components/shared/CommentCell";
import StackedHorizontalBarChart, { StackedBarRow } from "../components/shared/StackedHorizontalBarChart";
import Pagination from "../components/shared/Pagination";
import EditClientModal, { EditAction } from "../components/modals/EditClientModal";

import { useCsrDashboard } from "../hooks/useCsrDashboard";
import { useLeadActions } from "../hooks/useLeadActions";
import { usTimezones } from "../constants/timezones";
import { PAGE_SIZE, TODAY_STR } from "../constants";
import { getTimezoneAbbr, tzBadgeClass, getTimezoneAbbrFromPhone } from "../constants/timezoneAbbr";
import { Lead, getPriority } from "../types/lead";

const getTzAbbr = (tzValue: string) => {
  const found = usTimezones.find(tz => tz.value === tzValue);
  return found ? found.abbreviation : (tzValue.split("/").pop() ?? tzValue);
};

export default function ImportantCallsPage() {
  const { leads, setLeads, loading } = useCsrDashboard();
  const { saveComment, updateLead } = useLeadActions(setLeads);

  const [activeTab, setActiveTab] = useState("important");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate,  setFilterDate]  = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLead,   setEditingLead]   = useState<Lead | null>(null);
  const [editAction,    setEditAction]    = useState<EditAction>(null);

  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  const [scheduleDate,     setScheduleDate]     = useState("");
  const [scheduleTime,     setScheduleTime]     = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");
  const [projectCode,      setProjectCode]      = useState("");
  const [projectTitle,     setProjectTitle]     = useState("");
  const [projectDeadline,  setProjectDeadline]  = useState("");
  const [projectBudget,    setProjectBudget]    = useState("");
  const [paidAmount,       setPaidAmount]       = useState("");
  const [projectNotes,     setProjectNotes]     = useState("");
  const [projectService,   setProjectService]   = useState("");
  const [email,            setEmail]            = useState("");

  /* ── Derived ── */
  const stats = useMemo(() => ({
    totalImportantCount: leads.filter(l => l.status === "important").length,
    interestedCount:     leads.filter(l => l.status === "interested").length,
    projectWonCount:     leads.filter(l => l.status === "Close Client").length,
    callsTodayCount:     leads.filter(l => l.status === "important" && l.nextSchedule === TODAY_STR).length,
  }), [leads]);

  const interestedWithService = useMemo(
    () => leads.filter(l => l.status === "interested" && l.interestedService).length,
    [leads],
  );

  const chartRows = useMemo<StackedBarRow[]>(() => [
    {
      label: "Important",
      segments: [
        { label: "Today",  value: stats.callsTodayCount,                            color: "#B8112D" },
        { label: "Later",  value: stats.totalImportantCount - stats.callsTodayCount, color: "#F59E0B" },
      ],
    },
    {
      label: "Interested",
      segments: [
        { label: "With Service", value: interestedWithService,                        color: "#15803D" },
        { label: "No Service",   value: stats.interestedCount - interestedWithService, color: "#94A3B8" },
      ],
    },
    {
      label: "Close Client",
      segments: [
        { label: "Won Deals", value: stats.projectWonCount, color: "#1D4ED8" },
      ],
    },
  ], [stats, interestedWithService]);

  const filteredCalls = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return leads.filter(lead => {
      const matchesTab    = activeTab === "important" ? lead.status === "important" : lead.status === "interested";
      const matchesSearch = !q || lead.client.toLowerCase().includes(q) || lead.company.toLowerCase().includes(q) || lead.phone.toLowerCase().includes(q);
      const matchesDate   = !filterDate || lead.nextSchedule === filterDate;
      return matchesTab && matchesSearch && matchesDate;
    });
  }, [leads, activeTab, searchQuery, filterDate]);

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / PAGE_SIZE));
  const paginated  = filteredCalls.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Edit modal helpers ── */
  const openEditModal = (lead: Lead) => {
    setEditingLead(lead); setEditAction(null);
    setScheduleDate(""); setScheduleTime("");
    setSelectedTimezone(lead.timezone || "America/New_York");
    setProjectCode(""); setProjectTitle(lead.company !== "N/A" ? lead.company : lead.client);
    setProjectDeadline(""); setProjectBudget(""); setPaidAmount(""); setProjectNotes(""); setProjectService("");
    setEmail(lead.email !== "N/A" ? lead.email : "");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false); setEditingLead(null); setEditAction(null);
    setScheduleDate(""); setScheduleTime("");
    setProjectCode(""); setProjectTitle(""); setProjectDeadline(""); setProjectBudget(""); setPaidAmount(""); setProjectNotes(""); setProjectService("");
    setEmail("");
  };

  const saveReschedule = async () => {
    if (!scheduleDate || !scheduleTime || !editingLead) return;
    try {
      await updateLead(editingLead.id, { status: "important", nextSchedule: scheduleDate, nextTime: scheduleTime, timezone: selectedTimezone, email });
      closeEditModal();
    } catch (err) { console.log(err); }
  };

  const saveProjectWon = async () => {
    if (!projectTitle || !projectDeadline || !projectService || !paidAmount || !editingLead) return;
    try {
      await updateLead(editingLead.id, { status: "Close Client", projectCode, projectTitle, projectDeadline, projectBudget, paidAmount, projectNotes, interestedService: projectService, email });
      closeEditModal();
    } catch (err) { console.log(err); }
  };

  const saveCloseClient = async () => {
    if (!editingLead) return;
    try { await updateLead(editingLead.id, { status: "closed", email }); closeEditModal(); }
    catch (err) { console.log(err); }
  };

  const projectWonValid = projectTitle.trim() !== "" && projectDeadline !== "" && projectService !== "" && paidAmount.trim() !== "";

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <TopNavbar />
      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">

        {/* ── HEADER ── */}
        <div className="mt-1">
          <h1 className="text-2xl sm:text-[28px] lg:text-[34px] font-bold text-[#0F172A] leading-tight">
            Potential Clients
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-sm">
            Manage important and interested clients.
          </p>
        </div>

        {/* ── VERTICAL BAR CHART ── */}
        <div className="mt-4 sm:mt-7">
          <StackedHorizontalBarChart
            title="Pipeline by stage and type"
            subtitle="Important calls (today vs later), interested clients, and closed deals."
            rows={chartRows}
            loading={loading}
          />
        </div>

        {/* ── TAB BUTTONS ── */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7 overflow-x-auto pb-1">
          {[
            { key: "important",  label: "Important Calls",    count: stats.totalImportantCount, Icon: CircleAlert },
            { key: "interested", label: "Interested Clients", count: stats.interestedCount,     Icon: PhoneCall   },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(""); setFilterDate(""); setPage(1); }}
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

        {/* ══ IMPORTANT TABLE ══ */}
        {activeTab === "important" && (
          <div
            className="bg-white rounded-2xl sm:rounded-[30px] border border-white shadow-sm mt-4 sm:mt-7 flex flex-col"
            style={{ maxHeight: "calc(100vh - 300px)", minHeight: "360px" }}
          >
            <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3] shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Important Clients</h3>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Scheduled follow-up meetings.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-[220px] lg:w-[260px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                    <input
                      type="text" placeholder="Search..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                      className="w-full h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-8 sm:pl-9 pr-3 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                    />
                  </div>
                  <input
                    type="date" value={filterDate}
                    onChange={e => { setFilterDate(e.target.value); setPage(1); }}
                    className="h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] px-2.5 sm:px-4 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                  />
                  {filterDate && (
                    <button onClick={() => setFilterDate("")}
                      className="h-9 sm:h-[40px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] text-xs sm:text-[13px] text-gray-500 hover:text-[#B8112D] transition-all">
                      Clear
                    </button>
                  )}
                  <div className="bg-[#FFF1F3] text-[#B8112D] text-[11px] sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl whitespace-nowrap">
                    {filteredCalls.length} Leads
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-auto flex-1 px-4 sm:px-5 lg:px-6 pb-4 sm:pb-5">
              <table className="w-full" style={{ minWidth: "960px" }}>
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-[#F1F1F1]">
                    {["Client","Company","Contact","Next Schedule","Time & Timezone","Note","Status","Action"].map(h => (
                      <th key={h} className="text-left py-3 sm:py-4 px-2 text-[12px] sm:text-[13px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6,7,8].map(j => (
                          <td key={j} className="py-4 sm:py-5 px-2">
                            <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? paginated.map(lead => (
                    <tr key={lead.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                            {lead.client.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px]">{lead.client}</h4>
                              {(() => {
                                const tz = getTimezoneAbbr(lead.state);
                                return tz ? (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>
                                    {tz}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-gray-500 text-[11px] sm:text-[12px] mt-0.5">Important Lead</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <h4 className="font-medium text-[#0F172A] text-[13px] sm:text-[14px] max-w-[120px] truncate">{lead.company}</h4>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap">
                          {lead.phone}
                          {(() => { const t = getTimezoneAbbrFromPhone(lead.phone); return t ? <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border ${tzBadgeClass(t)}`}>{t}</span> : null; })()}
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        {lead.nextSchedule ? (
                          <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold whitespace-nowrap ${
                            lead.nextSchedule === TODAY_STR ? "bg-[#EAF5FF] text-[#0B84F3]" : "bg-[#F5F6FA] text-gray-600"
                          }`}>
                            <CalendarDays size={11} className="sm:w-[12px] sm:h-[12px]" />
                            {lead.nextSchedule === TODAY_STR ? "Today" : lead.nextSchedule}
                          </span>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <p className="text-[13px] sm:text-[14px] font-semibold text-[#0F172A] whitespace-nowrap">
                          {lead.nextTime || "—"}
                        </p>
                        {lead.timezone && (
                          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 max-w-[140px] truncate">
                            {getTzAbbr(lead.timezone)}
                          </p>
                        )}
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <CommentCell id={lead.id} comment={lead.comments} onSave={saveComment} />
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold w-fit whitespace-nowrap ${
                          getPriority(lead.status) === "High" ? "bg-[#FFF7E6] text-[#B54708]" : "bg-[#FFF1F3] text-[#B42318]"
                        }`}>
                          {getPriority(lead.status)}
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            onClick={() => setViewingLead(lead)}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          >
                            <Eye size={13} className="sm:w-[15px] sm:h-[15px]" />
                          </button>
                          <button
                            onClick={() => openEditModal(lead)}
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
                          <button onClick={() => { setSearchQuery(""); setFilterDate(""); }}
                            className="mt-2 sm:mt-3 text-[#B8112D] text-xs sm:text-sm font-semibold hover:underline">
                            Clear filters
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredCalls.length}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </div>
          </div>
        )}

        {/* ══ INTERESTED TABLE ══ */}
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
                    {["Client","Company","Contact","Interested In","Note","Status","Action"].map(h => (
                      <th key={h} className="text-left py-3 sm:py-4 px-2 text-[12px] sm:text-[13px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6,7].map(j => (
                          <td key={j} className="py-4 sm:py-5 px-2">
                            <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? paginated.map(lead => (
                    <tr key={lead.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                            {lead.client.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px]">{lead.client}</h4>
                              {(() => {
                                const tz = getTimezoneAbbr(lead.state);
                                return tz ? (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>
                                    {tz}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-gray-500 text-[11px] sm:text-[12px] mt-0.5 sm:mt-1">Interested Lead</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <h4 className="font-medium text-[#0F172A] text-[13px] sm:text-[14px] max-w-[120px] truncate">{lead.company}</h4>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap">
                          {lead.phone}
                          {(() => { const t = getTimezoneAbbrFromPhone(lead.phone); return t ? <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border ${tzBadgeClass(t)}`}>{t}</span> : null; })()}
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        {lead.interestedService ? (
                          <div className="flex items-center gap-1 sm:gap-1.5 bg-[#FFF4E5] text-[#D97706] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap">
                            <Briefcase size={11} className="sm:w-[13px] sm:h-[13px]" />{lead.interestedService}
                          </div>
                        ) : <span className="text-gray-400 text-xs sm:text-sm">Not specified</span>}
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <CommentCell id={lead.id} comment={lead.comments} onSave={saveComment} />
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="bg-[#FFF1F3] text-[#B8112D] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold w-fit whitespace-nowrap">
                          Interested
                        </div>
                      </td>
                      <td className="py-4 sm:py-5 px-2">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            onClick={() => setViewingLead(lead)}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          >
                            <Eye size={13} className="sm:w-[15px] sm:h-[15px]" />
                          </button>
                          <button
                            onClick={() => openEditModal(lead)}
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

              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredCalls.length}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            </div>
          </div>
        )}

        {/* ── EDIT MODAL ── */}
        {showEditModal && editingLead && (
          <EditClientModal
            client={editingLead.client}
            company={editingLead.company}
            email={email} onEmailChange={setEmail}
            editAction={editAction}
            onSelectAction={setEditAction}
            onClose={closeEditModal}
            scheduleDate={scheduleDate}    onScheduleDateChange={setScheduleDate}
            scheduleTime={scheduleTime}    onScheduleTimeChange={setScheduleTime}
            timezone={selectedTimezone}    onTimezoneChange={setSelectedTimezone}
            onSaveReschedule={saveReschedule}
            projectCode={projectCode}      onProjectCodeChange={setProjectCode}
            projectTitle={projectTitle}    onProjectTitleChange={setProjectTitle}
            projectService={projectService} onProjectServiceChange={setProjectService}
            projectDeadline={projectDeadline} onProjectDeadlineChange={setProjectDeadline}
            projectBudget={projectBudget}  onProjectBudgetChange={setProjectBudget}
            paidAmount={paidAmount}        onPaidAmountChange={setPaidAmount}
            projectNotes={projectNotes}    onProjectNotesChange={setProjectNotes}
            projectWonValid={projectWonValid}
            onSaveProjectWon={saveProjectWon}
            onDeleteClient={saveCloseClient}
          />
        )}

        {/* ── LEAD DETAIL MODAL ── */}
        {viewingLead && (
          <LeadDetailModal
            lead={{
              id:      viewingLead.id,
              name:    viewingLead.client,
              company: viewingLead.company !== "N/A" ? viewingLead.company : undefined,
              phone:   viewingLead.phone   !== "N/A" ? viewingLead.phone   : undefined,
              email:   viewingLead.email   !== "N/A" ? viewingLead.email   : undefined,
              state:   viewingLead.state   || undefined,
              status:  viewingLead.status,
              interestedService: viewingLead.interestedService,
              followUpNotes:     viewingLead.followUpNotes,
              nextSchedule:      viewingLead.nextSchedule || undefined,
              nextTime:          viewingLead.nextTime     || undefined,
              timezone:          viewingLead.timezone     || undefined,
            }}
            onClose={() => setViewingLead(null)}
            onSaved={(id, updates) => {
              const merged: Partial<Lead> = {};
              if (updates.name          !== undefined) merged.client = updates.name.trim()  || "Unknown";
              if (updates.phone         !== undefined) merged.phone  = updates.phone.trim() || "N/A";
              if (updates.email         !== undefined) merged.email  = updates.email.trim() || "N/A";
              if (updates.state         !== undefined) merged.state  = updates.state.trim();
              if (updates.followUpNotes !== undefined) merged.followUpNotes = updates.followUpNotes;
              setLeads(prev => prev.map(i => i.id === id ? { ...i, ...merged } : i));
              setViewingLead(prev => prev ? { ...prev, ...merged } : prev);
            }}
          />
        )}
      </main>
    </div>
  );
}
