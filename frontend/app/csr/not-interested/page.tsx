"use client";

import { useMemo, useState, Fragment } from "react";
import {
  ThumbsDown, PhoneOff, Search,
  X, ArrowRightLeft, RefreshCw,
  ChevronDown, ChevronUp, Eye, Users,
  Phone, Briefcase, Check,
  History, UserX, Ban, Home,
} from "lucide-react";

import TopNavbar from "../components/navigation/TopNavbar";
import LeadDetailModal from "../components/LeadDetailModal";
import CommentCell from "../components/shared/CommentCell";
import ImportantCallModal from "../components/modals/ImportantCallModal";
import InterestedModal from "../components/modals/InterestedModal";
import ClientNameCell from "../components/shared/ClientNameCell";
import PhoneWithTzCell from "../components/shared/PhoneWithTzCell";
import { ourCompany } from "../utils/leadFieldLabels";
import { parsePhones, collectLeadPhones } from "../utils/parsePhones";
import StackedHorizontalBarChart, { StackedBarRow } from "../components/shared/StackedHorizontalBarChart";
import TriesBar from "../components/shared/TriesBar";
import Pagination from "../components/shared/Pagination";
import { CsrColGroup, CSR_TABLE_CLASS, CSR_THEAD, CSR_TH, CSR_TD, CSR_TD_POPOVER, COL_9_FOLLOWUP, CSR_TABLE_CARD, CSR_TABLE_WRAP, matchesLeadSearch } from "../components/shared/csrTableStyles";
import StateFilterDropdown from "../components/shared/StateFilterDropdown";
import PhoneAreaCodeFilterInput from "../components/shared/PhoneAreaCodeFilterInput";
import { matchesStateLocationFilter, matchesPhoneAreaCodeFilter } from "@/lib/stateLocationFilter";
import ProjectDetailsForm from "../components/shared/ProjectDetailsForm";
import EmailField from "../components/shared/EmailField";
import SubContactsCell from "@/app/components/clients/SubContactsCell";

import { useNotInterested, NiLead } from "../hooks/useNotInterested";
import { useCsrMiscStatusLeads } from "../hooks/useCsrMiscStatusLeads";
import { useOpenLeadFromQuery } from "../hooks/useOpenLeadFromQuery";
import API from "@/lib/api";
import StatusWithTimestamp from "../components/shared/StatusWithTimestamp";
import {
  STATUS_NO_OWNER,
  STATUS_NOT_IN_SERVICE,
  STATUS_IN_HOUSE,
  isNotInterestedStatus,
  isNotPickedStatus,
  statusDisplayLabel,
} from "../constants/leadStatuses";
import type { Lead } from "../types/lead";

const NOT_INTERESTED_LIMIT = 3;
const NOT_PICKED_LIMIT     = 7;
const PAGE_SIZE            = 30;

type FollowUpTab = "notinterested" | "notpicked" | "noowner" | "notinservice" | "inhouse";

function leadToNiLead(l: Lead): NiLead {
  return {
    ...l,
    notInterestedCount: 0,
    notPickedCount: 0,
  };
}

export default function NotInterestedPage() {
  const { leads, setLeads, loading, refetch } = useNotInterested();
  const { leads: dashboardLeads, loading: dashLoading } = useCsrMiscStatusLeads();

  const [activeTab, setActiveTab] = useState<FollowUpTab>("notinterested");
  const [search,       setSearch]       = useState("");
  const [stateFilter,  setStateFilter]  = useState("");
  const [phoneFilter,  setPhoneFilter]  = useState("");
  const [page,      setPage]      = useState(1);

  const [expandedRow,  setExpandedRow]  = useState<string | null>(null);
  const [editingNote,  setEditingNote]  = useState<{ leadId: string; index: number; value: string } | null>(null);
  const [savingNote,   setSavingNote]   = useState(false);


  const [viewingLead, setViewingLead] = useState<NiLead | null>(null);

  useOpenLeadFromQuery(leads, setViewingLead, !loading);

  /* ── Manual CSR assign (when retry limit reached) ── */
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignLead,      setAssignLead]      = useState<NiLead | null>(null);
  const [csrList,         setCsrList]         = useState<{ id: string; name: string; csrCode: string | null }[]>([]);
  const [selectedCsrId,   setSelectedCsrId]   = useState("");
  const [isAssigning,     setIsAssigning]     = useState(false);

  const [statusLead,          setStatusLead]          = useState<NiLead | null>(null);
  const [showImportantModal,  setShowImportantModal]  = useState(false);
  const [showInterestedModal, setShowInterestedModal] = useState(false);
  const [showCloseModal,      setShowCloseModal]      = useState(false);
  const [scheduleDate,        setScheduleDate]        = useState("");
  const [scheduleTime,        setScheduleTime]        = useState("");
  const [selectedTimezone,    setSelectedTimezone]    = useState("America/New_York");
  const [selectedService,     setSelectedService]     = useState("");
  const [serviceSubtype,      setServiceSubtype]      = useState("");
  const [projectTitle,        setProjectTitle]        = useState("");
  const [projectDeadline,     setProjectDeadline]     = useState("");
  const [projectBudget,       setProjectBudget]       = useState("");
  const [projectNotes,        setProjectNotes]        = useState("");
  const [projectService,      setProjectService]      = useState("");
  const [projectCode,         setProjectCode]         = useState("");
  const [paidAmount,          setPaidAmount]          = useState("");
  const [email,               setEmail]               = useState("");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "warn" } | null>(null);
  const showToast = (msg: string, type: "success" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Derived lists ── */
  const notInterested = useMemo(() => leads.filter(l => isNotInterestedStatus(l.status)), [leads]);
  const notPicked     = useMemo(() => leads.filter(l => isNotPickedStatus(l.status)), [leads]);
  const noOwner       = useMemo(() => dashboardLeads.filter(l => l.status === STATUS_NO_OWNER).map(leadToNiLead), [dashboardLeads]);
  const notInService  = useMemo(() => dashboardLeads.filter(l => l.status === STATUS_NOT_IN_SERVICE).map(leadToNiLead), [dashboardLeads]);
  const inHouse       = useMemo(() => dashboardLeads.filter(l => l.status === STATUS_IN_HOUSE).map(leadToNiLead), [dashboardLeads]);

  const isRetryTab = activeTab === "notinterested" || activeTab === "notpicked";
  const currentList = activeTab === "notinterested" ? notInterested
    : activeTab === "notpicked" ? notPicked
    : activeTab === "noowner" ? noOwner
    : activeTab === "notinservice" ? notInService
    : inHouse;
  const limit         = activeTab === "notinterested" ? NOT_INTERESTED_LIMIT : NOT_PICKED_LIMIT;
  const countKey      = activeTab === "notinterested" ? "notInterestedCount" : "notPickedCount";
  const pageLoading   = isRetryTab ? loading : dashLoading;

  const searchFiltered = useMemo(() => {
    return currentList.filter(l =>
      matchesLeadSearch(search, {
        name: l.client,
        company: l.company,
        phone: l.phone,
        service: l.interestedService,
        state: l.state,
      }) &&
      matchesStateLocationFilter(l.state, l.phone, stateFilter) &&
      matchesPhoneAreaCodeFilter(l.phone, phoneFilter)
    );
  }, [currentList, search, stateFilter, phoneFilter]);

  const totalPages = Math.max(1, Math.ceil(searchFiltered.length / PAGE_SIZE));
  const paginated  = searchFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Chart rows ── */
  const chartRows = useMemo<StackedBarRow[]>(() => {
    const nearNI = notInterested.filter(l => l.notInterestedCount >= NOT_INTERESTED_LIMIT - 1).length;
    const nearNP = notPicked.filter(l => l.notPickedCount     >= NOT_PICKED_LIMIT     - 1).length;
    return [
      {
        label: "Not Interested",
        segments: [
          { label: "Near Limit",  value: nearNI,                         color: "#EF4444" },
          { label: "Active NI",   value: notInterested.length - nearNI,  color: "#B8112D" },
        ],
      },
      {
        label: "Not Picked",
        segments: [
          { label: "Near Limit",  value: nearNP,                   color: "#F97316" },
          { label: "Safe NP",     value: notPicked.length - nearNP, color: "#15803D" },
        ],
      },
    ];
  }, [notInterested, notPicked]);

  /* ── Handlers ── */
  const handleRetry = async (lead: NiLead) => {
    const newStatus = activeTab === "notinterested" ? "Not Interested" : "not picked";
    try {
      const res = await API.put(`/csr/lead/${lead.id}`, { status: newStatus });
      if (res.data.needsManualAssign) {
        setCsrList(res.data.csrs ?? []);
        setAssignLead(lead);
        setSelectedCsrId("");
        setShowAssignModal(true);
        setLeads(prev => prev.filter(l => l.id !== lead.id));
      } else {
        const triesLeft    = res.data.triesLeft ?? 0;
        const updatedNotes = res.data.lead?.followUpNotes ?? lead.followUpNotes ?? "";
        showToast(`Retried. ${triesLeft} attempt${triesLeft !== 1 ? "s" : ""} left.`);
        setLeads(prev => prev.map(l =>
          l.id === lead.id
            ? { ...l, [countKey]: (l[countKey as keyof NiLead] as number) + 1, followUpNotes: updatedNotes }
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

  const handleSaveNote = async (lead: NiLead) => {
    if (!editingNote) return;
    setSavingNote(true);
    try {
      const lines   = (lead.followUpNotes ?? "").split("\n").filter(Boolean);
      lines[editingNote.index] = editingNote.value;
      const updated = lines.join("\n");
      await API.put(`/csr/lead/${lead.id}`, { followUpNotes: updated });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, followUpNotes: updated } : l));
      setEditingNote(null);
    } catch { showToast("Failed to save note.", "warn"); }
    finally { setSavingNote(false); }
  };

  const handleUpdateStatus = async (lead: NiLead, status: string) => {
    if (status === "") return;
    if (status === "important") {
      setStatusLead(lead); setScheduleDate(""); setScheduleTime("");
      setSelectedTimezone("America/New_York"); setShowImportantModal(true); return;
    }
    if (status === "interested") {
      setStatusLead(lead); setSelectedService(""); setServiceSubtype(""); setShowInterestedModal(true); return;
    }
    if (status === "Close Client") {
      setStatusLead(lead); setProjectTitle(lead.client); setProjectDeadline("");
      setProjectBudget(""); setProjectNotes(""); setProjectService("");
      setProjectCode(""); setPaidAmount(""); setEmail(lead.email); setShowCloseModal(true); return;
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
    const sub = serviceSubtype.trim();
    const interestedService = sub ? `${selectedService}-${sub}` : selectedService;
    await API.put(`/csr/lead/${statusLead.id}`, { status: "interested", interestedService });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowInterestedModal(false);
    setSelectedService("");
    setServiceSubtype("");
    showToast("Marked as Interested.");
  };

  const saveCloseClient = async () => {
    if (!statusLead || !projectTitle || !projectDeadline || !projectService || !paidAmount) return;
    await API.put(`/csr/lead/${statusLead.id}`, {
      status: "Close Client", projectTitle, projectDeadline, projectCode,
      projectBudget, projectNotes, interestedService: projectService, paidAmount, email,
    });
    setLeads(prev => prev.filter(l => l.id !== statusLead.id));
    setShowCloseModal(false);
    showToast("Client closed & moved to Projects.");
  };

  const addNote = async (id: string, text: string) => {
    const res = await API.post(`/csr/lead/${id}/notes`, { text });
    const note = res.data.note
      ? { id: res.data.note.id, text: res.data.note.text, createdAt: res.data.note.createdAt }
      : { id: Date.now().toString(), text, createdAt: new Date().toISOString() };
    setLeads(prev => prev.map(l =>
      l.id === id
        ? {
            ...l,
            noteCount: (l.noteCount ?? 0) + 1,
            noteHistory: [note, ...(l.noteHistory ?? [])],
          }
        : l
    ));
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <TopNavbar />
      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">

        {/* ── TOAST ── */}
        {toast && (
          <div className={`fixed top-4 sm:top-5 right-3 sm:right-5 z-[200] flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-xl text-xs sm:text-sm font-semibold transition-all max-w-[90vw] sm:max-w-none ${
            toast.type === "warn"
              ? "bg-amber-50 border border-amber-300 text-amber-800"
              : "bg-green-50 border border-green-300 text-green-800"
          }`}>
            {toast.type === "warn"
              ? <ArrowRightLeft size={14} className="shrink-0 sm:w-4 sm:h-4" />
              : <RefreshCw size={14} className="shrink-0 sm:w-4 sm:h-4" />}
            <span className="truncate">{toast.msg}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 shrink-0">
              <X size={12} className="sm:w-[14px] sm:h-[14px]" />
            </button>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="mt-1">
          <h1 className="text-2xl sm:text-[28px] lg:text-[34px] font-bold text-[#0F172A] leading-tight">
            Leads Follow-up
          </h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-sm">
            Track Not Interested, Not Picked, No Owner, Not In Service &amp; In House leads.
          </p>
        </div>

        {/* ── STATS CHART ── */}
        <div className="mt-4 sm:mt-7">
          <StackedHorizontalBarChart
            title="Pipeline by stage and try count"
            subtitle="Breakdown of not-interested and not-picked leads — near-limit segments highlighted."
            rows={chartRows}
            loading={loading}
          />
        </div>

        {/* ── TAB BUTTONS ── */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7 overflow-x-auto pb-0.5">
          {[
            { key: "notinterested" as const, label: "Not Interested", count: notInterested.length, Icon: ThumbsDown },
            { key: "notpicked" as const,     label: "Not Picked",     count: notPicked.length,     Icon: PhoneOff   },
            { key: "noowner" as const,       label: "No Owner",       count: noOwner.length,       Icon: UserX      },
            { key: "notinservice" as const,  label: "Not In Service", count: notInService.length,  Icon: Ban        },
            { key: "inhouse" as const,       label: "In House",       count: inHouse.length,       Icon: Home       },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); setPage(1); }}
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
        <div className={CSR_TABLE_CARD}>
          {/* Card header */}
          <div className="p-4 sm:p-5 lg:p-6 border-b border-[#F3F3F3]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">
                  {activeTab === "notinterested" ? "Not Interested"
                    : activeTab === "notpicked" ? "Not Picked"
                    : activeTab === "noowner" ? "No Owner Available"
                    : activeTab === "notinservice" ? "Not In Service"
                    : "In House"} Leads
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
                  {isRetryTab ? (
                    <>Auto-redistributed after <span className="font-semibold text-[#B8112D]">{limit} tries</span>.</>
                  ) : (
                    <>Leads marked from the main call dashboard.</>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[150px] sm:flex-none sm:w-[220px] lg:w-[260px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                  <input
                    type="text"
                    placeholder="Search name, phone, company..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="w-full h-9 sm:h-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-8 sm:pl-9 pr-3 text-xs sm:text-[13px] outline-none focus:border-[#B8112D]"
                  />
                </div>
                <StateFilterDropdown value={stateFilter} onChange={v => { setStateFilter(v); setPage(1); }} />
                <PhoneAreaCodeFilterInput value={phoneFilter} onChange={v => { setPhoneFilter(v); setPage(1); }} />
                <button
                  onClick={() => void refetch()}
                  className="h-9 sm:h-[40px] w-9 sm:w-[40px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] flex items-center justify-center hover:border-[#B8112D] hover:text-[#B8112D] transition-colors text-gray-500"
                  title="Refresh"
                >
                  <RefreshCw size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className={`text-[11px] sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl whitespace-nowrap ${
                  activeTab === "notinterested" ? "bg-[#FFF1F3] text-[#B8112D]" : "bg-[#FFF7E6] text-[#B54708]"
                }`}>
                  {searchFiltered.length} Leads
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className={CSR_TABLE_WRAP}>
            <table className={CSR_TABLE_CLASS}>
              <CsrColGroup widths={COL_9_FOLLOWUP} />
              <thead className={CSR_THEAD}>
                <tr className="border-b border-[#F1F1F1]">
                  <th className={CSR_TH}>Client Name</th>
                  <th className={CSR_TH}>Our Company</th>
                  <th className={CSR_TH}>Phone</th>
                  <th className={`hidden lg:table-cell ${CSR_TH}`}>Sub Contacts</th>
                  <th className={CSR_TH}>Service</th>
                  <th className={CSR_TH}>Notes</th>
                  <th className={CSR_TH}>Tries</th>
                  <th className={CSR_TH}>Status</th>
                  <th className={CSR_TH}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageLoading ? (
                  [1,2,3,4].map(i => (
                    <tr key={i} className="border-b border-[#F7F7F7]">
                      {[1,2,3,4,5,6,7,8,9].map(j => (
                        <td key={j} className={CSR_TD}>
                          <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-14 sm:w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : searchFiltered.length > 0 ? paginated.map(lead => {
                  const tries       = isRetryTab ? (lead[countKey as keyof NiLead] as number) : 0;
                  const isNearLimit = isRetryTab && tries >= limit - 1;
                  const isAtLimit   = isRetryTab && tries >= limit;
                  const barColor    = isAtLimit
                    ? "bg-gray-300"
                    : isNearLimit
                    ? "bg-amber-400"
                    : activeTab === "notinterested" ? "bg-[#B8112D]" : "bg-amber-500";

                  return (
                    <Fragment key={lead.id}>
                      <tr
                        className={`border-b border-[#F7F7F7] transition-all ${isAtLimit ? "opacity-60 bg-gray-50" : "hover:bg-[#FFF8F9]"}`}
                      >
                        {/* Client */}
                        <td className={CSR_TD_POPOVER}>
                          <ClientNameCell
                            lead={lead}
                            subtitle={statusDisplayLabel(lead.status)}
                            hideOurCompany
                          />
                        </td>

                        {/* Our Company */}
                        <td className={CSR_TD}>
                          <span className="text-[11px] sm:text-[12px] font-medium text-[#0F172A] dark:text-crm-text truncate block">
                            {ourCompany(lead)}
                          </span>
                        </td>

                        {/* Phone — number + area-code TZ */}
                        <td className={CSR_TD_POPOVER}>
                          {(() => {
                            const phones = collectLeadPhones(lead.phone, lead.subContacts);
                            return (
                              <PhoneWithTzCell
                                phone={phones[0] ?? lead.phone}
                                allPhones={phones}
                                variant="pill"
                                className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[12px]"
                              />
                            );
                          })()}
                        </td>

                        <td className={`hidden lg:table-cell ${CSR_TD}`}>
                          <SubContactsCell contacts={lead.subContacts} />
                        </td>

                        {/* Service */}
                        <td className={CSR_TD}>
                          {lead.interestedService ? (
                            <p className="text-[10px] sm:text-[11px] font-semibold text-[#D97706] truncate">{lead.interestedService}</p>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Sticky Note */}
                        <td className={CSR_TD}>
                          <CommentCell id={lead.id} noteHistory={lead.noteHistory} noteCount={lead.noteCount} onAddNote={addNote} />
                        </td>

                        {/* Tries bar */}
                        <td className={CSR_TD}>
                          {isRetryTab ? (
                            <TriesBar used={tries} limit={limit} color={barColor} />
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className={CSR_TD}>
                          {isRetryTab && isAtLimit ? (
                            <span className="block text-[9px] sm:text-[10px] font-semibold text-gray-500 truncate">Redistributed</span>
                          ) : (
                            <StatusWithTimestamp
                              status={lead.status}
                              statusUpdatedAt={lead.statusUpdatedAt}
                              badgeClassName={`px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-semibold w-fit ${
                                activeTab === "notinterested" ? "bg-[#FFF1F3] text-[#B8112D]"
                                  : activeTab === "notpicked" ? "bg-[#FFF7ED] text-[#B54708]"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            />
                          )}
                        </td>

                        {/* Action */}
                        <td className={CSR_TD}>
                          <div className="flex items-center gap-1 min-w-0">
                            <button
                              onClick={() => setViewingLead(lead)}
                              title="View details"
                              className="h-7 w-7 rounded-lg bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 shrink-0"
                            >
                              <Eye size={12} />
                            </button>
                            {isRetryTab && !isAtLimit && (
                              <button
                                onClick={() => handleRetry(lead)}
                                title="Retry"
                                className="h-7 w-7 rounded-lg bg-[#F5F6FA] text-gray-700 flex items-center justify-center hover:bg-[#B8112D] hover:text-white shrink-0"
                              >
                                <RefreshCw size={11} />
                              </button>
                            )}
                            {lead.followUpNotes && (
                              <button
                                onClick={() => setExpandedRow(expandedRow === lead.id ? null : lead.id)}
                                title="View history"
                                className="h-7 w-7 rounded-lg bg-[#F5F6FA] text-gray-500 flex items-center justify-center shrink-0"
                              >
                                {expandedRow === lead.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                            )}
                            <select
                              defaultValue=""
                              onChange={e => { handleUpdateStatus(lead, e.target.value); e.currentTarget.value = ""; }}
                              className="appearance-none h-7 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-1 text-[9px] sm:text-[10px] font-semibold text-[#0F172A] outline-none truncate"
                            >
                              <option value="">Status</option>
                              <option value="pending">Pending</option>
                              <option value="important">Important</option>
                              <option value="interested">Interested</option>
                              <option value="Close Client">Close Client</option>
                              <option value={STATUS_IN_HOUSE}>In House</option>
                            </select>
                          </div>
                        </td>
                      </tr>

                      {/* ── History row ── */}
                      {expandedRow === lead.id && lead.followUpNotes && (
                        <tr key={`${lead.id}-hist`} className="bg-[#F8FAFF]">
                          <td colSpan={9} className="px-4 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <div className="mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                <History size={12} className="sm:w-[14px] sm:h-[14px]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] sm:text-[12px] font-semibold text-gray-500 mb-1.5 sm:mb-2 uppercase tracking-wide">Try History</p>
                                <div className="space-y-1.5 sm:space-y-2">
                                  {lead.followUpNotes.trim().split("\n").filter(Boolean).map((line, i) => {
                                    const isLimit        = line.includes("LIMIT REACHED");
                                    const isEditingThis  = editingNote?.leadId === lead.id && editingNote.index === i;
                                    const bracketEnd     = line.indexOf("]");
                                    const prefix         = bracketEnd !== -1 ? line.slice(0, bracketEnd + 1) : "";
                                    const rest           = bracketEnd !== -1 ? line.slice(bracketEnd + 1).trim() : line;

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
                    </Fragment>
                  );
                }) : (
                  <tr>
                    <td colSpan={9} className="py-16 sm:py-20 text-center">
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

            <Pagination
              page={page}
              totalPages={totalPages}
              total={searchFiltered.length}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        </div>

        {/* ══ IMPORTANT MODAL (shared) ══ */}
        {showImportantModal && (
          <ImportantCallModal
            date={scheduleDate}       onDateChange={setScheduleDate}
            time={scheduleTime}       onTimeChange={setScheduleTime}
            timezone={selectedTimezone} onTimezoneChange={setSelectedTimezone}
            onClose={() => setShowImportantModal(false)}
            onSave={saveImportant}
          />
        )}

        {/* ══ INTERESTED MODAL (shared) ══ */}
        {showInterestedModal && (
          <InterestedModal
            service={selectedService} onServiceChange={setSelectedService}
            serviceSubtype={serviceSubtype} onServiceSubtypeChange={setServiceSubtype}
            onClose={() => { setShowInterestedModal(false); setSelectedService(""); setServiceSubtype(""); }}
            onSave={saveInterested}
          />
        )}

        {/* ══ CLOSE CLIENT MODAL ══ */}
        {showCloseModal && statusLead && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="w-full sm:max-w-[520px] lg:max-w-[540px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
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

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">
                  {/* EMAIL */}
                  <EmailField email={email} onEmailChange={setEmail} />

                  <ProjectDetailsForm
                    projectCode={projectCode} onProjectCodeChange={setProjectCode}
                    title={projectTitle} onTitleChange={setProjectTitle}
                    service={projectService} onServiceChange={setProjectService}
                    deadline={projectDeadline} onDeadlineChange={setProjectDeadline}
                    budget={projectBudget} onBudgetChange={setProjectBudget}
                    paidAmount={paidAmount} onPaidAmountChange={setPaidAmount}
                    notes={projectNotes} onNotesChange={setProjectNotes}
                  />

                  <div className="flex gap-2 sm:gap-3 pb-1">
                    <button onClick={() => setShowCloseModal(false)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={saveCloseClient}
                      disabled={!projectTitle || !projectDeadline || !projectService || !paidAmount}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all ${
                        projectTitle && projectDeadline && projectService && paidAmount
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

        {/* ══ ASSIGN CSR MODAL ══ */}
        {showAssignModal && assignLead && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden">
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
              <div className="px-5 sm:px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
                {csrList.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No other active CSRs available.</p>
                ) : csrList.map(csr => (
                  <button
                    key={csr.id}
                    onClick={() => setSelectedCsrId(csr.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                      selectedCsrId === csr.id ? "border-[#B8112D] bg-[#FFF1F3]" : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${selectedCsrId === csr.id ? "bg-[#B8112D]" : "bg-gray-400"}`}>
                      {csr.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${selectedCsrId === csr.id ? "text-[#B8112D]" : "text-[#0F172A]"}`}>{csr.name}</p>
                      {csr.csrCode && <p className="text-xs text-gray-400">{csr.csrCode}</p>}
                    </div>
                    {selectedCsrId === csr.id && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm">Cancel</button>
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
              id:                viewingLead.id,
              name:              viewingLead.client,
              company:           viewingLead.company !== "N/A" ? viewingLead.company : undefined,
              rawCompany:        viewingLead.rawCompany || viewingLead.company,
              phone:             viewingLead.phone   !== "N/A" ? viewingLead.phone   : undefined,
              email:             viewingLead.email   !== "N/A" ? viewingLead.email   : undefined,
              website:           viewingLead.website || undefined,
              state:             viewingLead.state   || undefined,
              status:            viewingLead.status,
              interestedService: viewingLead.interestedService,
              followUpNotes:     viewingLead.followUpNotes,
              subContacts:       viewingLead.subContacts,
            }}
            onClose={() => setViewingLead(null)}
            onSaved={(id, updates) => {
              const merged: Partial<NiLead> = {};
              if (updates.name          !== undefined) merged.client = updates.name.trim()  || "Unknown";
              if (updates.company       !== undefined) merged.company = updates.company.trim() || "N/A";
              if (updates.phone         !== undefined) merged.phone  = updates.phone.trim() || "N/A";
              if (updates.email         !== undefined) merged.email  = updates.email.trim();
              if (updates.website       !== undefined) merged.website = updates.website.trim();
              if (updates.state         !== undefined) merged.state  = updates.state.trim();
              if (updates.followUpNotes !== undefined) merged.followUpNotes = updates.followUpNotes;
              setLeads(prev => prev.map(l => l.id === id ? { ...l, ...merged } : l));
              setViewingLead(prev => prev ? { ...prev, ...merged } : prev);
            }}
            onSubContactAdded={(id, sub) => {
              setLeads(prev => prev.map(l => l.id === id ? { ...l, subContacts: [...l.subContacts, sub] } : l));
            }}
            onSubContactDeleted={(id, subId) => {
              setLeads(prev => prev.map(l => l.id === id ? { ...l, subContacts: l.subContacts.filter(s => s.id !== subId) } : l));
            }}
          />
        )}
      </main>

    </div>
  );
}
