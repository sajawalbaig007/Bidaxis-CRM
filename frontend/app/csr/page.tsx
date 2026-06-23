"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  PhoneCall, CircleCheckBig, AlertTriangle,
  Clock3, Phone, Users, Bell, X, Eye, ChevronDown, CalendarDays,
} from "lucide-react";

import TopNavbar from "./components/navigation/TopNavbar";
import UsaTimezoneClocks from "./components/shared/UsaTimezoneClocks";
import LeadDetailModal from "./components/LeadDetailModal";
import StateFilterDropdown from "./components/shared/StateFilterDropdown";
import TimezoneFilterDropdown from "./components/shared/TimezoneFilterDropdown";
import CommentCell from "./components/shared/CommentCell";
import { CsrColGroup, CSR_TABLE_CLASS, CSR_TH, CSR_TD, COL_6_DASHBOARD } from "./components/shared/csrTableStyles";
import LeadStatusDonut from "./components/shared/LeadStatusDonut";
import ImportantCallModal from "./components/modals/ImportantCallModal";
import InterestedModal from "./components/modals/InterestedModal";
import ProjectWonModal from "./components/modals/ProjectWonModal";

import { useCsrDashboard } from "./hooks/useCsrDashboard";
import { useLeadActions } from "./hooks/useLeadActions";
import { useOpenLeadFromQuery } from "./hooks/useOpenLeadFromQuery";
import { STATE_AREA_CODES, stateMatches } from "./constants/locations";
import { PAGE_SIZE, TODAY_STR } from "./constants";
import { getTimezoneAbbr, tzBadgeClass, getTimezoneAbbrFromPhone, leadMatchesTimezoneFilter } from "./constants/timezoneAbbr";
import { Lead } from "./types/lead";
import { isImportantOnly, isScheduledCall } from "./utils/potentialClientBuckets";

const statusLabel = (s: string) => {
  if (s === "Not Interested" || s === "completed")     return "Not Interested";
  if (s === "not picked"     || s === "not completed") return "Not Picked";
  return s;
};

const statusBadgeClass = (s: string) => {
  if (s === "not picked" || s === "not completed") return "bg-[#FFF7E6] text-[#B54708]";
  if (s === "Not Interested" || s === "completed") return "bg-[#F1F5F9] text-[#475569]";
  if (s === "important")    return "bg-[#FFF1F3] text-[#B8112D]";
  if (s === "interested")   return "bg-[#FFF4E5] text-[#D97706]";
  if (s === "Close Client") return "bg-[#ECFDF5] text-[#065F46]";
  return "bg-[#F4F4F5] text-[#52525B]";
};

export default function CSRPage() {
  const router = useRouter();
  const { leads, setLeads, loading } = useCsrDashboard();
  const { updateLead, addNote } = useLeadActions(setLeads);

  const [activeTab, setActiveTab] = useState("today");
  const [page, setPage] = useState(1);

  const [stateFilter, setStateFilter] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");

  const [dismissedNotification, setDismissedNotification] = useState(false);

  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  useOpenLeadFromQuery(leads, setViewingLead, !loading);

  const [showImportantModal,  setShowImportantModal]  = useState(false);
  const [selectedImportantId, setSelectedImportantId] = useState<string | null>(null);
  const [scheduleDate,        setScheduleDate]        = useState("");
  const [scheduleTime,        setScheduleTime]        = useState("");
  const [selectedTimezone,    setSelectedTimezone]    = useState("America/New_York");
  const [importantNote,       setImportantNote]       = useState("");

  const [showInterestedModal,  setShowInterestedModal]  = useState(false);
  const [selectedInterestedId, setSelectedInterestedId] = useState<string | null>(null);
  const [selectedService,      setSelectedService]      = useState("");
  const [interestedNote,       setInterestedNote]       = useState("");

  const [showNiModal,     setShowNiModal]     = useState(false);
  const [showNpModal,     setShowNpModal]     = useState(false);
  const [showImpOnlyModal, setShowImpOnlyModal] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [pendingNote,     setPendingNote]     = useState("");

  const [showProjectWonModal, setShowProjectWonModal] = useState(false);
  const [selectedProjectLead, setSelectedProjectLead] = useState<Lead | null>(null);
  const [projectTitle,    setProjectTitle]    = useState("");
  const [projectDeadline, setProjectDeadline] = useState("");
  const [projectBudget,   setProjectBudget]   = useState("");
  const [projectNotes,    setProjectNotes]    = useState("");
  const [projectService,  setProjectService]  = useState("");
  const [projectCode,     setProjectCode]     = useState("");
  const [paidAmount,      setPaidAmount]      = useState("");
  const [email,           setEmail]           = useState("");

  /* Exclude leads hidden after a Reset — they live on their dedicated pages */
  const mainLeads = useMemo(() => leads.filter(l => !l.hiddenOnMain), [leads]);

  const todayImportantCalls = useMemo(
    () => mainLeads.filter(l => l.status === "important" && l.nextSchedule === TODAY_STR),
    [mainLeads]
  );

  const stats = useMemo(() => ({
    totalLeads:         mainLeads.length,
    pendingCount:       mainLeads.filter(i => i.status === "pending").length,
    importantOnlyCount: mainLeads.filter(i => isImportantOnly(i)).length,
    scheduledCount:     mainLeads.filter(i => isScheduledCall(i)).length,
    interestedCount:    mainLeads.filter(i => i.status === "interested").length,
    projectWonCount:    mainLeads.filter(i => i.status === "Close Client").length,
    notInterestedCount: mainLeads.filter(i => i.status === "Not Interested" || i.status === "completed").length,
    notPickedCount:     mainLeads.filter(i => i.status === "not picked" || i.status === "not completed").length,
  }), [mainLeads]);

  const filteredLinks = useMemo(() => {
    return mainLeads.filter(item => {
      const matchesTab =
        activeTab === "today"           ? item.status === "pending"
        : activeTab === "notinterested" ? item.status === "Not Interested"
        : activeTab === "pending"       ? item.status === "pending"
        : activeTab === "notpicked"     ? (item.status === "not picked" || item.status === "not completed")
        : activeTab === "important"     ? isImportantOnly(item)
        : activeTab === "schedule"      ? isScheduledCall(item)
        : activeTab === "interested"    ? item.status === "interested"
        : activeTab === "projectwon"    ? item.status === "Close Client"
        : true;
      const matchesState = stateFilter
        ? stateMatches(item.state, stateFilter) ||
          (() => {
            const codes = STATE_AREA_CODES[stateFilter] ?? [];
            if (codes.length === 0) return false;
            const digits      = (item.phone ?? "").replace(/\D/g, "");
            const afterCountry = digits.length > 10 ? digits.slice(1) : digits;
            return codes.some(c => afterCountry.startsWith(c));
          })()
        : true;
      const matchesPhone = phoneFilter
        ? (() => {
            const digits = item.phone.replace(/\D/g, "");
            const typed  = phoneFilter.replace(/\D/g, "");
            const afterCountry = digits.length > 10 ? digits.slice(1) : digits;
            return afterCountry.startsWith(typed);
          })()
        : true;
      const matchesTimezone = leadMatchesTimezoneFilter(item, timezoneFilter);
      return matchesTab && matchesState && matchesPhone && matchesTimezone;
    });
  }, [mainLeads, activeTab, stateFilter, timezoneFilter, phoneFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / PAGE_SIZE));
  const paginated  = filteredLinks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateStatus = async (id: string, status: string) => {
    if (!status) return;
    const lead = leads.find(i => i.id === id);
    if (!lead) return;

    if (status === "important") {
      setPendingStatusId(id);
      setPendingNote("");
      setShowImpOnlyModal(true);
      return;
    }
    if (status === "schedule call") {
      setSelectedImportantId(id); setSelectedTimezone(lead.timezone || "America/New_York");
      setShowImportantModal(true); return;
    }
    if (status === "interested") {
      setSelectedInterestedId(id); setSelectedService(""); setShowInterestedModal(true); return;
    }
    if (status === "Close Client") {
      setSelectedProjectLead(lead);
      setProjectTitle(lead.company !== "N/A" ? lead.company : lead.client);
      setProjectDeadline(""); setProjectBudget(""); setProjectNotes(""); setProjectService("");
      setProjectCode(""); setPaidAmount(""); setEmail(lead.email !== "N/A" ? lead.email : "");
      setShowProjectWonModal(true); return;
    }
    if (status === "Not Interested") {
      setPendingStatusId(id); setPendingNote(""); setShowNiModal(true); return;
    }
    if (status === "not picked") {
      setPendingStatusId(id); setPendingNote(""); setShowNpModal(true); return;
    }
    try {
      const res = await updateLead(id, { status });
      if (res?.redistributed) toast.success("Lead limit reached — reassigned to another CSR.");
    } catch (err) { console.log(err); }
  };

  const saveImportantCall = async () => {
    if (!scheduleDate || !scheduleTime || !selectedImportantId) return;
    try {
      await updateLead(selectedImportantId, {
        status: "important", nextSchedule: scheduleDate,
        nextTime: scheduleTime, timezone: selectedTimezone,
      });
      if (importantNote.trim()) await addNote(selectedImportantId, importantNote.trim());
    } catch (err) { console.log(err); }
    setShowImportantModal(false);
    setScheduleDate(""); setScheduleTime(""); setSelectedTimezone("America/New_York"); setImportantNote("");
  };

  const saveInterestedCall = async () => {
    if (!selectedService || !selectedInterestedId) return;
    try {
      await updateLead(selectedInterestedId, { status: "interested", interestedService: selectedService });
      if (interestedNote.trim()) await addNote(selectedInterestedId, interestedNote.trim());
    } catch (err) { console.log(err); }
    setShowInterestedModal(false); setSelectedService(""); setSelectedInterestedId(null); setInterestedNote("");
  };

  const saveImpOnlyStatus = async () => {
    if (!pendingStatusId) return;
    try {
      const res = await updateLead(pendingStatusId, {
        status: "important",
        nextSchedule: "",
        nextTime: "",
      });
      if (res?.redistributed) toast.success("Lead limit reached — reassigned to another CSR.");
      else toast.success("Marked as Important.");
      if (pendingNote.trim()) await addNote(pendingStatusId, pendingNote.trim());
    } catch (err) { console.log(err); }
    setShowImpOnlyModal(false);
    setPendingStatusId(null);
    setPendingNote("");
  };

  const saveNiStatus = async () => {
    if (!pendingStatusId) return;
    try {
      const res = await updateLead(pendingStatusId, { status: "Not Interested" });
      if (res?.redistributed) toast.success("Lead limit reached — reassigned to another CSR.");
      if (pendingNote.trim()) await addNote(pendingStatusId, pendingNote.trim());
    } catch (err) { console.log(err); }
    setShowNiModal(false); setPendingStatusId(null); setPendingNote("");
  };

  const saveNpStatus = async () => {
    if (!pendingStatusId) return;
    try {
      const res = await updateLead(pendingStatusId, { status: "not picked" });
      if (res?.redistributed) toast.success("Lead limit reached — reassigned to another CSR.");
      if (pendingNote.trim()) await addNote(pendingStatusId, pendingNote.trim());
    } catch (err) { console.log(err); }
    setShowNpModal(false); setPendingStatusId(null); setPendingNote("");
  };

  const saveProjectWon = async () => {
    if (!projectTitle || !projectDeadline || !paidAmount || !selectedProjectLead) return;
    try {
      await updateLead(selectedProjectLead.id, {
        status: "Close Client", projectTitle, projectDeadline, projectCode,
        projectBudget, projectNotes, interestedService: projectService, paidAmount, email,
      });
      setShowProjectWonModal(false);
      router.push("/csr/active-projects");
    } catch (err) { console.log(err); }
  };

  const projectWonValid = projectTitle.trim() !== "" && projectDeadline !== "" && projectService !== "" && paidAmount.trim() !== "";

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <TopNavbar />
      <UsaTimezoneClocks />

      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">

        {/* ── TODAY IMPORTANT NOTIFICATION ── */}
        {!dismissedNotification && todayImportantCalls.length > 0 && (
          <div className="mt-3 sm:mt-5 bg-[#FFF7E6] border border-[#F59E0B]/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-3 sm:gap-4 shadow-sm">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#F59E0B]/15 text-[#B45309] flex items-center justify-center shrink-0 mt-0.5">
              <Bell size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-[#92400E] text-[13px] sm:text-[15px]">
                You have {todayImportantCalls.length} important call{todayImportantCalls.length > 1 ? "s" : ""} scheduled for today!
              </h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                {todayImportantCalls.map(call => (
                  <button
                    key={call.id}
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams({ leadId: call.id, tab: "schedule" });
                      router.push(`/csr/potential-clients?${params.toString()}`);
                    }}
                    className="inline-flex items-center gap-1 sm:gap-1.5 bg-white border border-[#F59E0B]/30 text-[#92400E] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl text-[11px] sm:text-[12px] font-semibold hover:bg-[#FFFBEB] transition-colors"
                  >
                    <Phone size={10} className="sm:w-[11px] sm:h-[11px]" />{call.client}
                    {call.nextTime && <span className="opacity-70">· {call.nextTime}</span>}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setDismissedNotification(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#F59E0B]/10 text-[#B45309] flex items-center justify-center hover:bg-[#F59E0B]/20 transition-all shrink-0">
              <X size={13} className="sm:w-[15px] sm:h-[15px]" />
            </button>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        <div className="mt-4 sm:mt-7">
          <LeadStatusDonut leads={leads} loading={loading} />
        </div>

        {/* ── TABLE SECTION ── */}
        <div className="bg-white rounded-2xl sm:rounded-[28px] p-4 sm:p-5 lg:p-6 shadow-sm mt-4 sm:mt-7 border border-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div>
              <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Client Calls</h3>
              <p className="text-gray-500 mt-0.5 sm:mt-1 text-xs sm:text-[13px]">Manage assigned client calls.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <StateFilterDropdown
                value={stateFilter}
                onChange={v => { setStateFilter(v); setPage(1); }}
              />

              <TimezoneFilterDropdown
                value={timezoneFilter}
                onChange={v => { setTimezoneFilter(v); setPage(1); }}
              />

              {/* ── PHONE CODE FILTER ── */}
              <div className="relative">
                <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[14px] sm:h-[14px]" />
                <input
                  type="text"
                  value={phoneFilter}
                  onChange={e => { setPhoneFilter(e.target.value); setPage(1); }}
                  placeholder="Phone code..."
                  className={`h-10 sm:h-[42px] pl-8 sm:pl-9 pr-8 sm:pr-9 rounded-xl sm:rounded-2xl border text-xs sm:text-sm outline-none transition-colors min-w-[130px] sm:min-w-[160px] ${
                    phoneFilter
                      ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
                      : "border-gray-200 bg-[#FAFAFA] text-gray-600 focus:border-gray-300"
                  }`}
                />
                {phoneFilter && (
                  <button
                    onClick={() => { setPhoneFilter(""); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8112D] hover:text-[#8b0d22]"
                  >
                    <X size={12} className="sm:w-[13px] sm:h-[13px]" />
                  </button>
                )}
              </div>

              <div className="bg-[#ECFDF3] text-[#027A48] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#12B76A]" />Live Tracking
              </div>
            </div>
          </div>

          {/* ── TABS ── */}
          <div className="relative mt-4 sm:mt-7 mb-4 sm:mb-7">
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { tab:"today",          label:"Today Leads",    count: stats.pendingCount,       icon:<PhoneCall      size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#B8112D] text-white shadow-sm",  inactive:"bg-[#F8F8F8] text-gray-700"   },
                { tab:"notinterested",  label:"Not Interested", count: stats.notInterestedCount, icon:<CircleCheckBig size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#475569] text-white",            inactive:"bg-[#F1F5F9] text-[#475569]"  },
                { tab:"pending",        label:"Pending",        count: stats.pendingCount,       icon:<Clock3         size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#B54708] text-white",            inactive:"bg-[#FFF7E6] text-[#B54708]"  },
                { tab:"notpicked",      label:"Not Picked",     count: stats.notPickedCount,     icon:<Clock3         size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#F97316] text-white",            inactive:"bg-[#FFF1E8] text-[#F97316]"  },
                { tab:"important",      label:"Important",      count: stats.importantOnlyCount, icon:<AlertTriangle  size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#B42318] text-white",            inactive:"bg-[#FFF1F3] text-[#B42318]"  },
                { tab:"schedule",       label:"Schedule",       count: stats.scheduledCount,     icon:<CalendarDays   size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#0B84F3] text-white",            inactive:"bg-[#EAF5FF] text-[#0B84F3]"  },
                { tab:"interested",     label:"Interested",     count: stats.interestedCount,    icon:<Users          size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#B8112D] text-white",            inactive:"bg-[#FFF1F3] text-[#B42318]"  },
                { tab:"projectwon",     label:"Close Client",   count: stats.projectWonCount,    icon:<CircleCheckBig size={12} className="sm:w-3.5 sm:h-3.5"/>, active:"bg-[#065F46] text-white",            inactive:"bg-[#ECFDF5] text-[#065F46]"  },
              ].map(btn => (
                <button key={btn.tab} onClick={() => { setActiveTab(btn.tab); setPage(1); setPhoneFilter(""); }}
                  className={`h-8 sm:h-10 px-2.5 sm:px-4 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-[12.5px] font-semibold transition-all whitespace-nowrap shrink-0 ${activeTab === btn.tab ? btn.active : btn.inactive}`}>
                  {btn.icon}
                  <span className="hidden sm:inline">{btn.label}</span>
                  <span className="sm:hidden">{btn.label.split(" ")[0]}</span>
                  <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px]">{btn.count}</span>
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-linear-to-l from-white to-transparent" />
          </div>

          {/* ── TABLE ── */}
          <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-gray-100">
            <table className={CSR_TABLE_CLASS} style={{ minWidth: "1100px" }}>
              <CsrColGroup widths={COL_6_DASHBOARD} />
              <thead className="bg-[#FAFAFA]">
                <tr>
                  {["Client","Company","Phone","Status","Notes","Action"].map(h => (
                    <th key={h} className={CSR_TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="border-t border-gray-100">
                      {[1,2,3,4,5,6].map(j => (
                        <td key={j} className="py-4 sm:py-5 px-3 sm:px-5">
                          <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredLinks.length > 0 ? paginated.map((currentLink, idx) => (
                  <tr key={currentLink.id} className="border-t border-gray-100 bg-white hover:bg-[#FAFAFA] transition-colors">

                    {/* CLIENT */}
                    <td className={CSR_TD}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#F3F4F6] text-[#0F172A] flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </div>
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                          {currentLink.client.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h4 className="text-[13px] sm:text-[14px] font-semibold text-[#0F172A] leading-tight truncate">
                              {currentLink.client}
                            </h4>
                            {(() => {
                              const tz = getTimezoneAbbr(currentLink.state);
                              return tz ? (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}>
                                  {tz}
                                </span>
                              ) : null;
                            })()}
                            <button
                              onClick={() => setViewingLead(currentLink)}
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                              title="View details"
                            >
                              <Eye size={10} className="sm:w-3 sm:h-3" />
                            </button>
                          </div>
                          {currentLink.rawCompany && currentLink.rawCompany !== currentLink.company && (
                            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 max-w-[120px] sm:max-w-[180px] truncate">
                              {currentLink.rawCompany}
                            </p>
                          )}
                          <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 truncate max-w-[120px] sm:max-w-none">
                            {currentLink.email !== "N/A" ? currentLink.email : (currentLink.state || "—")}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* COMPANY */}
                    <td className={`${CSR_TD} text-[12px] sm:text-[14px] font-medium text-[#0F172A]`}>
                      <span className="truncate block">{currentLink.company}</span>
                    </td>

                    {/* PHONE */}
                    <td className={`${CSR_TD} text-[12px] sm:text-[14px] font-medium text-[#0F172A] whitespace-nowrap`}>
                      <div className="flex items-center gap-1.5">
                        {currentLink.phone}
                        {(() => { const t = getTimezoneAbbrFromPhone(currentLink.phone); return t ? <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border ${tzBadgeClass(t)}`}>{t}</span> : null; })()}
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className={CSR_TD}>
                      {activeTab === "schedule" && currentLink.nextSchedule ? (
                        <div>
                          <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-semibold w-fit whitespace-nowrap bg-[#EAF5FF] text-[#0B84F3]">
                            Scheduled
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1">
                            {currentLink.nextSchedule}{currentLink.nextTime ? ` · ${currentLink.nextTime}` : ""}
                          </p>
                        </div>
                      ) : (
                      <div className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-semibold w-fit whitespace-nowrap ${statusBadgeClass(currentLink.status)}`}>
                        {statusLabel(currentLink.status)}
                      </div>
                      )}
                    </td>

                    {/* NOTES */}
                    <td className={CSR_TD}>
                      <CommentCell
                        id={currentLink.id}
                        noteHistory={currentLink.noteHistory}
                        onAddNote={addNote}
                        onNoteUpdated={(leadId, noteId, text) => {
                          setLeads(prev => prev.map(l => l.id === leadId
                            ? { ...l, noteHistory: l.noteHistory.map(n => n.id === noteId ? { ...n, text } : n) }
                            : l
                          ));
                        }}
                        onNoteDeleted={(leadId, _noteId) => {
                          setLeads(prev => prev.map(l => l.id === leadId
                            ? { ...l, noteCount: Math.max(0, (l.noteCount ?? 0) - 1) }
                            : l
                          ));
                        }}
                      />
                    </td>

                    {/* ACTION */}
                    <td className={CSR_TD}>
                      <div className="relative w-full min-w-[160px]">
                        <select
                          key={`${currentLink.id}-${currentLink.status}`}
                          onChange={e => updateStatus(currentLink.id, e.target.value)}
                          defaultValue=""
                          className="appearance-none h-10 sm:h-[46px] w-full rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 sm:px-4 pr-9 sm:pr-11 text-[12px] sm:text-[14px] font-semibold text-[#0F172A] outline-none"
                        >
                          <option value="">Update Status</option>
                          <option value="Not Interested">Not Interested</option>
                          <option value="not picked">Not Picked</option>
                          <option value="pending">Pending</option>
                          <option value="important">Important</option>
                          <option value="schedule call">Schedule Call</option>
                          <option value="interested">Interested</option>
                          <option value="Close Client">Close Client</option>
                        </select>
                        <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <ChevronDown size={14} className="sm:w-[18px] sm:h-[18px]" />
                        </div>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="py-14 sm:py-20 text-center">
                      <h2 className="text-lg sm:text-2xl font-bold text-[#0F172A]">No Data Found</h2>
                      <p className="text-gray-500 mt-2 sm:mt-3 text-xs sm:text-sm">
                        {stateFilter && timezoneFilter
                          ? `No leads in "${stateFilter}" (${timezoneFilter}).`
                          : stateFilter
                          ? `No leads in "${stateFilter}".`
                          : timezoneFilter
                          ? `No leads in ${timezoneFilter} timezone.`
                          : "No calls available in this category."}
                      </p>
                      {(stateFilter || timezoneFilter || phoneFilter) && (
                        <button
                          onClick={() => { setStateFilter(""); setTimezoneFilter(""); setPhoneFilter(""); setPage(1); }}
                          className="mt-3 sm:mt-4 h-9 sm:h-10 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#FFF1F3] text-[#B8112D] text-xs sm:text-sm font-semibold hover:bg-[#fce8ec] transition-colors"
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

          {/* PAGINATION */}
          <div className="flex items-center justify-between px-1 pt-4 mt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {filteredLinks.length === 0 ? "0" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredLinks.length)}`} of {filteredLinks.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
              <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
            </div>
          </div>
        </div>

        {/* ══ IMPORTANT MODAL ══ */}
        {showImportantModal && (
          <ImportantCallModal
            date={scheduleDate} onDateChange={setScheduleDate}
            time={scheduleTime} onTimeChange={setScheduleTime}
            timezone={selectedTimezone} onTimezoneChange={setSelectedTimezone}
            note={importantNote} onNoteChange={setImportantNote}
            onClose={() => { setShowImportantModal(false); setImportantNote(""); }}
            onSave={saveImportantCall}
          />
        )}

        {/* ══ INTERESTED MODAL ══ */}
        {showInterestedModal && (
          <InterestedModal
            service={selectedService} onServiceChange={setSelectedService}
            note={interestedNote} onNoteChange={setInterestedNote}
            onClose={() => { setShowInterestedModal(false); setSelectedService(""); setInterestedNote(""); }}
            onSave={saveInterestedCall}
          />
        )}

        {/* ══ IMPORTANT QUICK-NOTE MODAL (no schedule) ══ */}
        {showImpOnlyModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-[28px] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">Important</h2>
                  <p className="text-gray-500 text-xs mt-1">Add a note (optional) before confirming.</p>
                </div>
                <button onClick={() => { setShowImpOnlyModal(false); setPendingStatusId(null); setPendingNote(""); }}
                  className="w-8 h-8 rounded-xl bg-[#F5F6FA] flex items-center justify-center text-gray-500">
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={pendingNote} onChange={e => setPendingNote(e.target.value)} rows={3}
                placeholder="Why is this client important?"
                className="w-full rounded-2xl border border-gray-200 bg-[#F5F6FA] px-4 py-3 text-sm outline-none resize-none text-[#0F172A] placeholder:text-gray-400 focus:border-[#B8112D] transition-colors"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setShowImpOnlyModal(false); setPendingStatusId(null); setPendingNote(""); }}
                  className="flex-1 h-11 rounded-xl bg-[#F5F6FA] font-semibold text-gray-600 text-sm">Cancel</button>
                <button onClick={saveImpOnlyStatus}
                  className="flex-1 h-11 rounded-xl bg-[#B8112D] text-white font-semibold text-sm">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ NOT INTERESTED QUICK-NOTE MODAL ══ */}
        {showNiModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-[28px] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">Not Interested</h2>
                  <p className="text-gray-500 text-xs mt-1">Add a note (optional) before confirming.</p>
                </div>
                <button onClick={() => { setShowNiModal(false); setPendingStatusId(null); setPendingNote(""); }}
                  className="w-8 h-8 rounded-xl bg-[#F5F6FA] flex items-center justify-center text-gray-500">
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={pendingNote} onChange={e => setPendingNote(e.target.value)} rows={3}
                placeholder="Reason or note..."
                className="w-full rounded-2xl border border-gray-200 bg-[#F5F6FA] px-4 py-3 text-sm outline-none resize-none text-[#0F172A] placeholder:text-gray-400 focus:border-[#475569] transition-colors"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setShowNiModal(false); setPendingStatusId(null); setPendingNote(""); }}
                  className="flex-1 h-11 rounded-xl bg-[#F5F6FA] font-semibold text-gray-600 text-sm">Cancel</button>
                <button onClick={saveNiStatus}
                  className="flex-1 h-11 rounded-xl bg-[#475569] text-white font-semibold text-sm">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ NOT PICKED QUICK-NOTE MODAL ══ */}
        {showNpModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-[28px] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">Not Picked</h2>
                  <p className="text-gray-500 text-xs mt-1">Add a note (optional) before confirming.</p>
                </div>
                <button onClick={() => { setShowNpModal(false); setPendingStatusId(null); setPendingNote(""); }}
                  className="w-8 h-8 rounded-xl bg-[#F5F6FA] flex items-center justify-center text-gray-500">
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={pendingNote} onChange={e => setPendingNote(e.target.value)} rows={3}
                placeholder="Reason or note..."
                className="w-full rounded-2xl border border-gray-200 bg-[#F5F6FA] px-4 py-3 text-sm outline-none resize-none text-[#0F172A] placeholder:text-gray-400 focus:border-[#F97316] transition-colors"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setShowNpModal(false); setPendingStatusId(null); setPendingNote(""); }}
                  className="flex-1 h-11 rounded-xl bg-[#F5F6FA] font-semibold text-gray-600 text-sm">Cancel</button>
                <button onClick={saveNpStatus}
                  className="flex-1 h-11 rounded-xl bg-[#F97316] text-white font-semibold text-sm">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ CLOSE CLIENT MODAL ══ */}
        {showProjectWonModal && selectedProjectLead && (
          <ProjectWonModal
            lead={selectedProjectLead}
            email={email} onEmailChange={setEmail}
            projectCode={projectCode} onProjectCodeChange={setProjectCode}
            title={projectTitle} onTitleChange={setProjectTitle}
            service={projectService} onServiceChange={setProjectService}
            deadline={projectDeadline} onDeadlineChange={setProjectDeadline}
            budget={projectBudget} onBudgetChange={setProjectBudget}
            paidAmount={paidAmount} onPaidAmountChange={setPaidAmount}
            notes={projectNotes} onNotesChange={setProjectNotes}
            isValid={projectWonValid}
            onClose={() => setShowProjectWonModal(false)}
            onSave={saveProjectWon}
          />
        )}

        {/* ══ LEAD DETAIL MODAL ══ */}
        {viewingLead && (
          <LeadDetailModal
            lead={{
              id: viewingLead.id,
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
              noteHistory:       viewingLead.noteHistory,
              subContacts:       viewingLead.subContacts,
              rawCompany:        viewingLead.rawCompany   || undefined,
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
            onNoteAdded={(id, note) => {
              setLeads(prev => prev.map(i => i.id === id ? { ...i, noteHistory: [...i.noteHistory, note] } : i));
            }}
            onSubContactAdded={(id, sub) => {
              setLeads(prev => prev.map(i => i.id === id ? { ...i, subContacts: [...i.subContacts, sub] } : i));
            }}
            onSubContactDeleted={(id, subId) => {
              setLeads(prev => prev.map(i => i.id === id ? { ...i, subContacts: i.subContacts.filter(s => s.id !== subId) } : i));
            }}
          />
        )}
      </main>
    </div>
  );
}
