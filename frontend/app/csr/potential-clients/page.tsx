"use client";

import { useMemo, useState } from "react";
import {
  PhoneCall, CalendarDays, CircleAlert, Eye, Pencil, Briefcase, Search, Plus,
} from "lucide-react";

import TopNavbar from "../components/navigation/TopNavbar";
import LeadDetailModal from "../components/LeadDetailModal";
import CommentCell from "../components/shared/CommentCell";
import StackedHorizontalBarChart, { StackedBarRow } from "../components/shared/StackedHorizontalBarChart";
import Pagination from "../components/shared/Pagination";
import { CsrColGroup, CSR_TABLE_CLASS, CSR_THEAD, CSR_TH, CSR_TD, COL_7_IMPORTANT_SUB, COL_9_SCHEDULE, COL_8_INTERESTED_SUB, CSR_TABLE_CARD, CSR_TABLE_WRAP, matchesLeadSearch } from "../components/shared/csrTableStyles";
import EditClientModal, { EditAction } from "../components/modals/EditClientModal";
import AddLeadModal from "../components/modals/AddLeadModal";
import SubContactsCell from "@/app/components/clients/SubContactsCell";

import { useCsrDashboard } from "../hooks/useCsrDashboard";
import { useLeadActions } from "../hooks/useLeadActions";
import { useOpenLeadFromQuery } from "../hooks/useOpenLeadFromQuery";
import { useQueryTab } from "../hooks/useQueryTab";
import { invalidateAllCsrListCaches } from "@/lib/csrApiCache";
import API from "@/lib/api";
import { usTimezones } from "../constants/timezones";
import { PAGE_SIZE, TODAY_STR } from "../constants";
import { getTimezoneAbbr, tzBadgeClass, getTimezoneAbbrFromPhone } from "../constants/timezoneAbbr";
import { Lead, getPriority } from "../types/lead";
import { isInterestedLeadStatus, isWonClientStatus } from "../constants/leadStatuses";
import {
  isImportantOnly,
  isScheduledCall,
  isInterestedLead,
  matchesPotentialTab,
  type PotentialTab,
} from "../utils/potentialClientBuckets";

const POTENTIAL_TABS = ["important", "schedule", "interested"] as const;

const getTzAbbr = (tzValue: string) => {
  const found = usTimezones.find(tz => tz.value === tzValue);
  return found ? found.abbreviation : (tzValue.split("/").pop() ?? tzValue);
};

function parsePhones(raw: string): string[] {
  const matches = raw.match(/[\+\d][\d\s.()\-]{5,}/g);
  if (!matches || matches.length <= 1) return [raw.trim()];
  return matches.map(p => p.trim()).filter(p => p.replace(/\D/g, "").length >= 7);
}

export default function ImportantCallsPage() {
  const { leads, setLeads, loading, refetch } = useCsrDashboard();
  const { saveComment, updateLead, addNote } = useLeadActions(setLeads);

  const [activeTab, setActiveTab] = useState("important");
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate,  setFilterDate]  = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLead,   setEditingLead]   = useState<Lead | null>(null);
  const [editAction,    setEditAction]    = useState<EditAction>(null);

  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);

  useQueryTab(POTENTIAL_TABS, "important", setActiveTab, !loading);
  useOpenLeadFromQuery(leads, setViewingLead, !loading);

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
    importantOnlyCount: leads.filter(l => isImportantOnly(l)).length,
    scheduledCount:     leads.filter(l => isScheduledCall(l)).length,
    interestedCount:    leads.filter(l => isInterestedLead(l)).length,
    projectWonCount:    leads.filter(l => isWonClientStatus(l.status)).length,
    callsTodayCount:    leads.filter(l => isScheduledCall(l) && l.nextSchedule === TODAY_STR).length,
  }), [leads]);

  const interestedWithService = useMemo(
    () => leads.filter(l => isInterestedLead(l) && l.interestedService).length,
    [leads],
  );

  const chartRows = useMemo<StackedBarRow[]>(() => [
    {
      label: "Schedule Call",
      segments: [
        { label: "Today",  value: stats.callsTodayCount,                         color: "#B8112D" },
        { label: "Later",  value: stats.scheduledCount - stats.callsTodayCount, color: "#F59E0B" },
      ],
    },
    {
      label: "Important",
      segments: [
        { label: "Flagged", value: stats.importantOnlyCount, color: "#DC2626" },
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
    return leads.filter(lead => {
      const matchesTab    = matchesPotentialTab(lead, activeTab as PotentialTab);
      const matchesSearch = matchesLeadSearch(searchQuery, {
        name: lead.client,
        company: lead.company,
        phone: lead.phone,
        email: lead.email,
        service: lead.interestedService,
        state: lead.state,
      });
      const matchesDate   = activeTab !== "schedule" || !filterDate || lead.nextSchedule === filterDate;
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

  const moveToBin = async () => {
    if (!editingLead) return;
    try {
      await API.put(`/csr/lead/${editingLead.id}`, { moveToBin: true });
      invalidateAllCsrListCaches();
      setLeads(prev => prev.filter(l => l.id !== editingLead.id));
      closeEditModal();
    } catch (err) { console.log(err); }
  };

  const projectWonValid = projectTitle.trim() !== "" && projectDeadline !== "" && projectService !== "" && paidAmount.trim() !== "";

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <TopNavbar />
      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">

        {/* ── HEADER ── */}
        <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-[28px] lg:text-[34px] font-bold text-[#0F172A] leading-tight">
              Potential Clients
            </h1>
            <p className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-sm">
              Manage important, scheduled, and interested clients.
            </p>
          </div>
          <button
            onClick={() => setShowAddLead(true)}
            className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] w-full sm:w-auto shrink-0"
          >
            <Plus size={16} /> Add Lead
          </button>
        </div>

        {/* ── VERTICAL BAR CHART ── */}
        <div className="mt-4 sm:mt-7">
          <StackedHorizontalBarChart
            title="Pipeline by stage and type"
            subtitle="Schedule calls (today vs later), important-only clients, interested clients, and closed deals."
            rows={chartRows}
            loading={loading}
          />
        </div>

        {/* ── TAB BUTTONS ── */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7 overflow-x-auto pb-1">
          {[
            { key: "important",  label: "Important Calls",    count: stats.importantOnlyCount, Icon: CircleAlert },
            { key: "schedule",   label: "Schedule Call",      count: stats.scheduledCount,     Icon: CalendarDays },
            { key: "interested", label: "Interested Clients", count: stats.interestedCount,    Icon: PhoneCall   },
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

        {/* ══ IMPORTANT-ONLY TABLE ══ */}
        {activeTab === "important" && (
          <div className={CSR_TABLE_CARD}>
            <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Important Calls</h3>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Clients marked important without a scheduled meeting.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-[220px] lg:w-[260px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                    <input
                      type="text" placeholder="Search name, phone, company..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                      className="w-full h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-8 sm:pl-9 pr-3 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                    />
                  </div>
                  <div className="bg-[#FFF1F3] text-[#B8112D] text-[11px] sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl whitespace-nowrap">
                    {filteredCalls.length} Leads
                  </div>
                </div>
              </div>
            </div>

            <div className={CSR_TABLE_WRAP}>
              <table className={CSR_TABLE_CLASS}>
                <CsrColGroup widths={COL_7_IMPORTANT_SUB} />
                <thead className={CSR_THEAD}>
                  <tr className="border-b border-[#F1F1F1]">
                    <th className={CSR_TH}>Client</th>
                    <th className={CSR_TH}>Company</th>
                    <th className={CSR_TH}>Contact</th>
                    <th className={CSR_TH}>Sub Contacts</th>
                    <th className={CSR_TH}>Note</th>
                    <th className={CSR_TH}>Status</th>
                    <th className={CSR_TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6,7].map(j => (
                          <td key={j} className={CSR_TD}>
                            <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? paginated.map(lead => (
                    <tr key={lead.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      <td className={CSR_TD}>
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                            {lead.client.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px] truncate">{lead.client}</h4>
                            <p className="text-gray-400 text-[10px] sm:text-[11px] mt-0.5 truncate">Important Lead</p>
                          </div>
                        </div>
                      </td>
                      <td className={CSR_TD}>
                        <p className="font-medium text-[#0F172A] text-[13px] sm:text-[14px] truncate">{lead.company}</p>
                      </td>
                      <td className={CSR_TD}>
                        <div className="inline-flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-medium max-w-full min-w-0">
                          <span className="truncate">{lead.phone}</span>
                        </div>
                      </td>
                      <td className={CSR_TD}>
                        <SubContactsCell contacts={lead.subContacts} />
                      </td>
                      <td className={CSR_TD}>
                        <CommentCell id={lead.id} noteHistory={lead.noteHistory} onAddNote={addNote} />
                      </td>
                      <td className={CSR_TD}>
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#FFF1F3] text-[#B8112D] whitespace-nowrap">Important</span>
                      </td>
                      <td className={CSR_TD}>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button onClick={() => setViewingLead(lead)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center" title="View">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => openEditModal(lead)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#B8112D] text-white hover:bg-[#a30f27] flex items-center justify-center" title="Edit">
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-16 sm:py-20 text-center">
                        <Search size={24} className="text-gray-200 mx-auto mb-2 sm:mb-3 sm:w-7 sm:h-7" />
                        <p className="text-gray-400 text-xs sm:text-sm">No important clients found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} total={filteredCalls.length} pageSize={PAGE_SIZE} onPage={setPage} />
            </div>
          </div>
        )}

        {/* ══ SCHEDULE CALL TABLE ══ */}
        {activeTab === "schedule" && (
          <div className={CSR_TABLE_CARD}>
            <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Schedule Call</h3>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Clients with scheduled follow-up meetings.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-[220px] lg:w-[260px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                    <input
                      type="text" placeholder="Search name, phone, company..."
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

            <div className={CSR_TABLE_WRAP}>
              <table className={CSR_TABLE_CLASS}>
                <CsrColGroup widths={COL_9_SCHEDULE} />
                <thead className={CSR_THEAD}>
                  <tr className="border-b border-[#F1F1F1]">
                    {["Client","Company","Contact","Sub Contacts","Next Schedule","Time & Timezone","Note","Status","Action"].map(h => (
                      <th key={h} className={CSR_TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6,7,8,9].map(j => (
                          <td key={j} className={CSR_TD}>
                            <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? paginated.map(lead => (
                    <tr key={lead.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      <td className={CSR_TD}>
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                            {lead.client.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px] truncate">{lead.client}</h4>
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
                      <td className={CSR_TD}>
                        <h4 className="font-medium text-[#0F172A] text-[13px] sm:text-[14px] truncate">{lead.company}</h4>
                      </td>
                      <td className={CSR_TD}>
                        {(() => {
                          const phones = parsePhones(lead.phone);
                          const tz = getTimezoneAbbrFromPhone(phones[0]);
                          if (phones.length <= 1) return (
                            <div className="inline-flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap">
                              {lead.phone}
                              {tz && <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>{tz}</span>}
                            </div>
                          );
                          return (
                            <div className="inline-flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap">
                              <span className="max-w-[100px] truncate">{phones[0]}</span>
                              {tz && <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>{tz}</span>}
                              <span className="bg-[#B8112D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">+{phones.length - 1}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className={CSR_TD}>
                        <SubContactsCell contacts={lead.subContacts} />
                      </td>
                      <td className={CSR_TD}>
                        {lead.nextSchedule ? (
                          <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold whitespace-nowrap ${
                            lead.nextSchedule === TODAY_STR ? "bg-[#EAF5FF] text-[#0B84F3]" : "bg-[#F5F6FA] text-gray-600"
                          }`}>
                            <CalendarDays size={11} className="sm:w-[12px] sm:h-[12px]" />
                            {lead.nextSchedule === TODAY_STR ? "Today" : lead.nextSchedule}
                          </span>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </td>
                      <td className={CSR_TD}>
                        <p className="text-[13px] sm:text-[14px] font-semibold text-[#0F172A] whitespace-nowrap truncate">
                          {lead.nextTime || "—"}
                        </p>
                        {lead.timezone && (
                          <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
                            {getTzAbbr(lead.timezone)}
                          </p>
                        )}
                      </td>
                      <td className={CSR_TD}>
                        <CommentCell id={lead.id} noteHistory={lead.noteHistory} onAddNote={addNote} />
                      </td>
                      <td className={CSR_TD}>
                        <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-[12px] font-semibold w-fit whitespace-nowrap ${
                          getPriority(lead.status) === "High" ? "bg-[#FFF7E6] text-[#B54708]" : "bg-[#FFF1F3] text-[#B42318]"
                        }`}>
                          {getPriority(lead.status)}
                        </div>
                      </td>
                      <td className={CSR_TD}>
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <button
                            onClick={() => setViewingLead(lead)}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          >
                            <Eye size={13} className="sm:w-[15px] sm:h-[15px]" />
                          </button>
                          <button
                            onClick={() => openEditModal(lead)}
                            className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-xs font-semibold flex items-center gap-1 hover:bg-[#B8112D] hover:text-white transition-all whitespace-nowrap shrink-0"
                          >
                            <Pencil size={12} className="sm:w-[14px] sm:h-[14px]" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={9} className="py-16 sm:py-20 text-center">
                        <Search size={24} className="text-gray-200 mx-auto mb-2 sm:mb-3 sm:w-7 sm:h-7" />
                        <p className="text-gray-400 text-xs sm:text-sm">No scheduled calls found.</p>
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
          <div className={CSR_TABLE_CARD}>
            <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Interested Clients</h3>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Clients who have shown interest in our services.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-[220px] lg:w-[260px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                    <input
                      type="text"
                      placeholder="Search name, phone, company..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                      className="w-full h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-8 sm:pl-9 pr-3 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                    />
                  </div>
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setPage(1); }}
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

            <div className={CSR_TABLE_WRAP}>
              <table className={CSR_TABLE_CLASS}>
                <CsrColGroup widths={COL_8_INTERESTED_SUB} />
                <thead className={CSR_THEAD}>
                  <tr className="border-b border-[#F1F1F1]">
                    <th className={CSR_TH}>Client</th>
                    <th className={CSR_TH}>Company</th>
                    <th className={CSR_TH}>Contact</th>
                    <th className={CSR_TH}>Sub Contacts</th>
                    <th className={CSR_TH}>Interested In</th>
                    <th className={CSR_TH}>Note</th>
                    <th className={CSR_TH}>Status</th>
                    <th className={CSR_TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6,7,8].map(j => (
                          <td key={j} className={CSR_TD}>
                            <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? paginated.map(lead => (
                    <tr key={lead.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      <td className={CSR_TD}>
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                            {lead.client.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap min-w-0">
                              <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px] truncate">{lead.client}</h4>
                              {(() => {
                                const tz = getTimezoneAbbr(lead.state);
                                return tz ? (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>{tz}</span>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-gray-400 text-[10px] sm:text-[11px] mt-0.5 truncate">Interested Lead</p>
                          </div>
                        </div>
                      </td>
                      <td className={CSR_TD}>
                        <p className="font-medium text-[#0F172A] text-[13px] sm:text-[14px] truncate">{lead.company}</p>
                      </td>
                      <td className={CSR_TD}>
                        {(() => {
                          const phones = parsePhones(lead.phone);
                          const tz = getTimezoneAbbrFromPhone(phones[0]);
                          if (phones.length <= 1) return (
                            <div className="inline-flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-medium min-w-0 max-w-full">
                              <span className="truncate">{lead.phone}</span>
                              {tz && <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>{tz}</span>}
                            </div>
                          );
                          return (
                            <div className="inline-flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap">
                              <span className="truncate">{phones[0]}</span>
                              {tz && <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>{tz}</span>}
                              <span className="bg-[#B8112D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">+{phones.length - 1}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className={CSR_TD}>
                        <SubContactsCell contacts={lead.subContacts} />
                      </td>
                      <td className={CSR_TD}>
                        {lead.interestedService ? (
                          <div className="inline-flex items-center gap-1 bg-[#FFF4E5] text-[#D97706] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold min-w-0 max-w-full">
                            <Briefcase size={11} className="shrink-0" />
                            <span className="truncate">{lead.interestedService}</span>
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className={CSR_TD}>
                        <CommentCell id={lead.id} noteHistory={lead.noteHistory} onAddNote={addNote} />
                      </td>
                      <td className={CSR_TD}>
                        <div className="bg-[#FFF1F3] text-[#B8112D] px-2.5 py-1 rounded-xl text-[11px] font-semibold w-fit whitespace-nowrap">
                          Interested
                        </div>
                      </td>
                      <td className={CSR_TD}>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setViewingLead(lead)}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => openEditModal(lead)}
                            className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-xs font-semibold flex items-center gap-1 hover:bg-[#B8112D] hover:text-white transition-all whitespace-nowrap shrink-0"
                          >
                            <Pencil size={12} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="py-16 sm:py-20 text-center text-gray-400 text-xs sm:text-sm">
                        {searchQuery ? "No leads match your search." : "No interested clients found."}
                        {searchQuery && (
                          <button onClick={() => setSearchQuery("")}
                            className="block mx-auto mt-2 text-[#B8112D] font-semibold hover:underline">
                            Clear search
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
            onDeleteClient={moveToBin}
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
              subContacts:       viewingLead.subContacts,
              rawCompany:        viewingLead.rawCompany   || undefined,
            }}
            onClose={() => setViewingLead(null)}
            onSaved={(id, updates) => {
              const merged: Partial<Lead> = {};
              if (updates.name          !== undefined) merged.client = updates.name.trim()  || "Unknown";
              if (updates.company       !== undefined) merged.company = updates.company.trim() || "N/A";
              if (updates.phone         !== undefined) merged.phone  = updates.phone.trim() || "N/A";
              if (updates.email         !== undefined) merged.email  = updates.email.trim() || "N/A";
              if (updates.state         !== undefined) merged.state  = updates.state.trim();
              if (updates.followUpNotes !== undefined) merged.followUpNotes = updates.followUpNotes;
              setLeads(prev => prev.map(i => i.id === id ? { ...i, ...merged } : i));
              setViewingLead(prev => prev ? { ...prev, ...merged } : prev);
            }}
            onSubContactAdded={(id, sub) => {
              setLeads(prev => prev.map(i => i.id === id ? { ...i, subContacts: [...i.subContacts, sub] } : i));
            }}
            onSubContactDeleted={(id, subId) => {
              setLeads(prev => prev.map(i => i.id === id ? { ...i, subContacts: i.subContacts.filter(s => s.id !== subId) } : i));
            }}
            onSubContactUpdated={(id, sub) => {
              setLeads(prev => prev.map(i => i.id === id ? { ...i, subContacts: i.subContacts.map(s => s.id === sub.id ? sub : s) } : i));
            }}
          />
        )}

        <AddLeadModal
          open={showAddLead}
          onClose={() => setShowAddLead(false)}
          onAdded={() => { void refetch(true); }}
        />
      </main>
    </div>
  );
}
