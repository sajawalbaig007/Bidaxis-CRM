"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  PhoneCall, CalendarDays, Clock3, CircleAlert, Phone, User2,
  X, Globe, ChevronDown, Pencil, Trophy, UserX, CalendarClock,
  Briefcase, FileText, DollarSign, AlignLeft,
  BarChart2, PenTool, Building2, Monitor,
} from "lucide-react";

import CSRNavbar from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";

const usTimezones = [
  { value: "America/Adak", label: "Hawaii-Aleutian (UTC-10:00)", abbreviation: "HAST" },
  { value: "America/Anchorage", label: "Alaska (UTC-09:00)", abbreviation: "AKST" },
  { value: "America/Los_Angeles", label: "Pacific Time (UTC-08:00)", abbreviation: "PT" },
  { value: "America/Denver", label: "Mountain Time (UTC-07:00)", abbreviation: "MT" },
  { value: "America/Chicago", label: "Central Time (UTC-06:00)", abbreviation: "CT" },
  { value: "America/New_York", label: "Eastern Time (UTC-05:00)", abbreviation: "ET" },
  { value: "America/Phoenix", label: "Arizona (UTC-07:00) - No DST", abbreviation: "MST" },
  { value: "America/Indiana/Indianapolis", label: "Indiana (UTC-05:00)", abbreviation: "EST" },
  { value: "Pacific/Honolulu", label: "Hawaii (UTC-10:00) - No DST", abbreviation: "HST" },
];

const serviceOptions = [
  { value: "Estimating",   label: "Estimating",   Icon: BarChart2   },
  { value: "Scheduling",   label: "Scheduling",   Icon: CalendarDays },
  { value: "Shop Drawing", label: "Shop Drawing", Icon: PenTool     },
  { value: "Drafting",     label: "Drafting",     Icon: Pencil      },
  { value: "BIM",          label: "BIM",          Icon: Building2   },
  { value: "IT",           label: "IT",           Icon: Monitor     },
];

type LeadType = {
  id: string; status?: string; name?: string; company?: string; phone?: string;
  nextSchedule?: string; nextTime?: string; timezone?: string; followUpNotes?: string;
  interestedService?: string; interested_service?: string; service?: string;
  serviceInterested?: string; serviceName?: string;
};

type CallType = {
  id: string; type: string; client: string; company: string; phone: string;
  priority: string; nextFollowup?: string; time?: string; timezone?: string;
  notes?: string; status?: string; interestedService?: string;
};

type EditAction = "reschedule" | "projectwon" | "closeclient" | null;

// Today's date in YYYY-MM-DD format
const todayStr = new Date().toISOString().split("T")[0];

export default function ImportantCallsPage() {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [importantCalls, setImportantCalls] = useState<CallType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("important");
  const [selectedCall, setSelectedCall] = useState<CallType | null>(null);

  /* EDIT MODAL */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCall, setEditingCall] = useState<CallType | null>(null);
  const [editAction, setEditAction] = useState<EditAction>(null);

  /* RESCHEDULE */
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");

  /* PROJECT WON */
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDeadline, setProjectDeadline] = useState("");
  const [projectBudget, setProjectBudget] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [projectService, setProjectService] = useState("");

  /* ================= FETCH — ESLint-safe: async defined inside effect ================= */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await API.get("/csr/dashboard");

        const formatted: CallType[] = res.data.leads
          .filter((lead: LeadType) =>
            lead.status === "important" ||
            lead.status === "interested" ||
            lead.status === "project won"
          )
          .map((lead: LeadType) => ({
            id: lead.id,
            type: lead.status === "important" ? "important" : "interested",
            client: lead.name || "Unknown",
            company: lead.company || "N/A",
            phone: lead.phone || "N/A",
            priority: lead.status === "important" ? "High" : "Medium",
            nextFollowup: lead.nextSchedule || "",
            time: lead.nextTime || "N/A",
            timezone: lead.timezone || "N/A",
            notes: lead.followUpNotes || "No notes added",
            status: lead.status,
            interestedService:
              lead.interestedService || lead.interested_service ||
              lead.service || lead.serviceInterested || lead.serviceName || "",
          }));

        setImportantCalls(formatted);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  /* FILTERED */
  const filteredCalls = importantCalls.filter(call =>
    activeTab === "important"
      ? call.status === "important" || call.status === "project won"
      : call.status === "interested"
  );

  const activeSelectedCall = selectedCall ?? filteredCalls[0] ?? null;

  /* ================= REAL-TIME STATS from fetched data ================= */
  const totalImportantCount  = importantCalls.filter(c => c.status === "important").length;
  const interestedCount      = importantCalls.filter(c => c.status === "interested").length;
  const projectWonCount      = importantCalls.filter(c => c.status === "project won").length;

  // Calls Today = important leads whose nextFollowup == today
  const callsTodayCount = importantCalls.filter(
    c => c.status === "important" && c.nextFollowup === todayStr
  ).length;

  // Rescheduled = important leads that have any nextFollowup set
  const rescheduledCount = importantCalls.filter(
    c => c.status === "important" && c.nextFollowup && c.nextFollowup !== ""
  ).length;

  /* OPEN EDIT MODAL */
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
    setProjectTitle(""); setProjectDeadline(""); setProjectBudget("");
    setProjectNotes(""); setProjectService("");
  };

  /* SAVE RESCHEDULE */
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
      if (selectedCall?.id === editingCall.id) {
        setSelectedCall(prev => prev
          ? { ...prev, nextFollowup: scheduleDate, time: scheduleTime, timezone: selectedTimezone, status: "important" }
          : prev
        );
      }
      closeEditModal();
    } catch (error) { console.log(error); }
  };

  /* SAVE PROJECT WON */
  const saveProjectWon = async () => {
    if (!projectTitle || !projectDeadline || !projectService || !editingCall) return;
    try {
      await API.put(`/csr/lead/${editingCall.id}`, {
        status: "project won",
        projectTitle, projectDeadline, projectBudget, projectNotes,
        interestedService: projectService,
      });
      closeEditModal();
      router.push("/csr/projects");
    } catch (error) { console.log(error); }
  };

  /* CLOSE CLIENT */
  const saveCloseClient = async () => {
    if (!editingCall) return;
    try {
      await API.put(`/csr/lead/${editingCall.id}`, { status: "closed" });
      setImportantCalls(prev => prev.filter(c => c.id !== editingCall.id));
      if (selectedCall?.id === editingCall.id) setSelectedCall(null);
      closeEditModal();
    } catch (error) { console.log(error); }
  };

  const getTzAbbr = (tzValue: string) => {
    const found = usTimezones.find(tz => tz.value === tzValue);
    return found ? found.abbreviation : tzValue?.split("/").pop() ?? tzValue;
  };

  const projectWonValid = projectTitle.trim() !== "" && projectDeadline !== "" && projectService !== "";

  /* STAT CARDS CONFIG */
  const statCards = [
    { label: "Important Calls", value: totalImportantCount, sub: "total flagged", color: "bg-[#FFF1F3] text-[#B8112D]", Icon: CircleAlert },
    { label: "Important Calls Today",     value: callsTodayCount,     sub: "scheduled for today", color: "bg-[#EAF5FF] text-[#0B84F3]", Icon: PhoneCall },
  
    { label: "Interested",      value: interestedCount,     sub: "service interest", color: "bg-[#ECFDF3] text-[#027A48]", Icon: Briefcase },
    { label: "Project Won",     value: projectWonCount,     sub: "closed deals", color: "bg-[#ECFDF5] text-[#065F46]", Icon: Trophy },
  ];

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* HEADER */}
        <div className="mt-7">
          <h1 className="text-[28px] sm:text-[34px] font-bold text-[#0F172A] leading-tight">Important Calls</h1>
          <p className="text-gray-500 mt-2 text-sm">Manage important and interested clients.</p>
        </div>

        {/* STATS — 5 cards, real-time from fetched data */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-[24px] p-5 border border-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[12px] font-medium">{card.label}</p>
                  {loading ? (
                    <div className="h-8 w-10 bg-gray-100 rounded-lg mt-2 animate-pulse"/>
                  ) : (
                    <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">{card.value}</h2>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">{card.sub}</p>
                </div>
                <div className={`w-11 h-11 rounded-2xl ${card.color} flex items-center justify-center shrink-0`}>
                  <card.Icon size={20}/>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTER BUTTONS */}
        <div className="flex flex-wrap gap-3 mt-7">
          <button
            onClick={() => { setActiveTab("important"); setSelectedCall(importantCalls.find(c => c.status==="important") ?? null); }}
            className={`h-12 px-5 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm ${activeTab==="important" ? "bg-[#B8112D] text-white" : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"}`}>
            <CircleAlert size={17}/>Important Calls
            <span className={`px-2 py-0.5 rounded-lg text-[11px] ${activeTab==="important" ? "bg-white/20" : "bg-[#FFF1F3]"}`}>{totalImportantCount}</span>
          </button>
          <button
            onClick={() => { setActiveTab("interested"); setSelectedCall(importantCalls.find(c => c.status==="interested") ?? null); }}
            className={`h-12 px-5 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm ${activeTab==="interested" ? "bg-[#B8112D] text-white" : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"}`}>
            <PhoneCall size={17}/>Interested Clients
            <span className={`px-2 py-0.5 rounded-lg text-[11px] ${activeTab==="interested" ? "bg-white/20" : "bg-[#FFF1F3]"}`}>{interestedCount}</span>
          </button>
        </div>

        {/* ==================== IMPORTANT UI ==================== */}
        {activeTab === "important" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-7">
            {/* LEFT */}
            <div className="xl:col-span-5 bg-white rounded-[30px] border border-white shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[22px] font-bold text-[#0F172A]">Important Clients</h3>
                  <p className="text-gray-500 text-sm mt-1">Scheduled follow-up meetings.</p>
                </div>
                <div className="bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold px-4 py-2 rounded-2xl">Live</div>
              </div>

              <div className="space-y-4 mt-7">
                {loading ? (
                  // SKELETON
                  [1,2,3].map(i => (
                    <div key={i} className="rounded-[24px] border border-gray-100 p-5 animate-pulse">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0"/>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-100 rounded w-32 mb-2"/>
                          <div className="h-3 bg-gray-100 rounded w-20"/>
                        </div>
                      </div>
                    </div>
                  ))
                ) : filteredCalls.length > 0 ? filteredCalls.map(call => (
                  <button key={call.id} onClick={() => setSelectedCall(call)}
                    className={`w-full text-left rounded-[24px] border p-5 transition-all ${selectedCall?.id===call.id ? "border-[#B8112D] bg-[#FFF8F9]" : "border-gray-100 bg-white hover:border-[#B8112D]/30"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold shrink-0">{call.client.charAt(0)}</div>
                        <div>
                          <h4 className="font-semibold text-[#0F172A] text-[15px]">{call.client}</h4>
                          <p className="text-gray-500 text-sm mt-1">{call.company}</p>
                          {call.nextFollowup && call.nextFollowup === todayStr && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-[#EAF5FF] text-[#0B84F3] text-[10px] font-semibold rounded-lg">📅 Today</span>
                          )}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 ${call.priority==="Urgent" ? "bg-[#FFF1F3] text-[#B42318]" : call.priority==="High" ? "bg-[#FFF7E6] text-[#B54708]" : "bg-[#ECFDF3] text-[#027A48]"}`}>
                        {call.priority}
                      </div>
                    </div>
                  </button>
                )) : (
                  <div className="text-center py-10">
                    <CircleAlert size={32} className="text-gray-200 mx-auto mb-3"/>
                    <p className="text-gray-400 text-sm">No important clients found.</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT */}
            {activeSelectedCall ? (
              <div className="xl:col-span-7 bg-white rounded-[30px] border border-white shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                  <div>
                    <h3 className="text-[26px] font-bold text-[#0F172A]">{activeSelectedCall.client}</h3>
                    <p className="text-gray-500 mt-1">Detailed follow-up information.</p>
                  </div>
                  <button onClick={() => openEditModal(activeSelectedCall)}
                    className="h-12 px-5 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold shadow-sm flex items-center gap-2">
                    <Pencil size={16}/>Edit
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
                  {[
                    { label:"Contact Number", value: activeSelectedCall.phone,       Icon: Phone },
                    { label:"Next Schedule",  value: activeSelectedCall.nextFollowup || "Not set", Icon: CalendarDays },
                    { label:"Time",           value: activeSelectedCall.time,        Icon: Clock3 },
                  ].map(({ label, value, Icon }) => (
                    <div key={label} className="bg-[#FAFAFA] rounded-2xl p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center"><Icon size={20}/></div>
                        <div><p className="text-gray-500 text-sm">{label}</p><h4 className="font-semibold text-[#0F172A] mt-1">{value}</h4></div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-[#FAFAFA] rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center"><Globe size={20}/></div>
                      <div>
                        <p className="text-gray-500 text-sm">Timezone</p>
                        <h4 className="font-semibold text-[#0F172A] mt-1">
                          {getTzAbbr(activeSelectedCall.timezone ?? "")} ({activeSelectedCall.timezone})
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-7">
                  <h4 className="text-[18px] font-bold text-[#0F172A]">Follow-up Notes</h4>
                  <div className="bg-[#FAFAFA] rounded-2xl p-5 mt-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0"><User2 size={18}/></div>
                      <p className="text-gray-600 leading-7 text-[15px]">{activeSelectedCall.notes}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : !loading && (
              <div className="xl:col-span-7 bg-white rounded-[30px] border border-white shadow-sm p-5 flex items-center justify-center">
                <div className="text-center">
                  <CircleAlert size={40} className="text-gray-200 mx-auto mb-3"/>
                  <p className="text-gray-400 text-sm">Select a client to view details</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== INTERESTED TABLE ==================== */}
        {activeTab === "interested" && (
          <div className="bg-white rounded-[30px] border border-white shadow-sm p-5 sm:p-6 mt-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-[26px] font-bold text-[#0F172A]">Interested Clients</h3>
                <p className="text-gray-500 text-sm mt-1">Clients who have shown interest in our services.</p>
              </div>
              <div className="bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold px-4 py-2 rounded-2xl w-fit">{filteredCalls.length} Interested Leads</div>
            </div>

            <div className="overflow-x-auto mt-7">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#F1F1F1]">
                    {["Client","Company","Contact","Interested In","Status","Action"].map(h => (
                      <th key={h} className="text-left py-4 px-2 text-[13px] font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3].map(i => (
                      <tr key={i} className="border-b border-[#F7F7F7]">
                        {[1,2,3,4,5,6].map(j => (
                          <td key={j} className="py-5 px-2"><div className="h-4 bg-gray-100 rounded animate-pulse w-20"/></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCalls.length > 0 ? filteredCalls.map(call => (
                    <tr key={call.id} className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all">
                      <td className="py-5 px-2">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-sm">{call.client.charAt(0)}</div>
                          <div><h4 className="font-semibold text-[#0F172A] text-[14px]">{call.client}</h4><p className="text-gray-500 text-[12px] mt-1">Interested Lead</p></div>
                        </div>
                      </td>
                      <td className="py-5 px-2"><h4 className="font-medium text-[#0F172A] text-[14px]">{call.company}</h4></td>
                      <td className="py-5 px-2"><div className="bg-[#FFF6F7] text-[#B8112D] px-4 py-2 rounded-xl text-sm font-medium w-fit">{call.phone}</div></td>
                      <td className="py-5 px-2">
                        {call.interestedService ? (
                          <div className="flex items-center gap-1.5 bg-[#FFF4E5] text-[#D97706] px-4 py-2 rounded-xl text-sm font-semibold w-fit">
                            <Briefcase size={13}/>{call.interestedService}
                          </div>
                        ) : <span className="text-gray-400 text-sm">Not specified</span>}
                      </td>
                      <td className="py-5 px-2"><div className="bg-[#FFF1F3] text-[#B8112D] px-4 py-2 rounded-xl text-sm font-semibold w-fit">Interested</div></td>
                      <td className="py-5 px-2">
                        <button onClick={() => openEditModal(call)}
                          className="h-10 px-4 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold flex items-center gap-2 hover:bg-[#B8112D] hover:text-white transition-all">
                          <Pencil size={14}/>Edit
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="py-20 text-center text-gray-400 text-sm">No interested clients found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== EDIT MODAL ===================== */}
        {showEditModal && editingCall && (
          <div className="fixed inset-0 z-100 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-4xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-bold text-[#0F172A]">Edit Client</h2>
                  <p className="text-gray-500 text-sm mt-1">{editingCall.client} — {editingCall.company}</p>
                </div>
                <button onClick={closeEditModal} className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500 shrink-0"><X size={18}/></button>
              </div>

              {/* ACTION CARDS */}
              {!editAction && (
                <div className="mt-7 space-y-3">
                  <p className="text-sm font-semibold text-gray-500 mb-4">What would you like to do?</p>
                  <button onClick={() => setEditAction("reschedule")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-[#B8112D] hover:bg-[#FFF8F9] transition-all text-left">
                    <div className="w-12 h-12 rounded-2xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center shrink-0"><CalendarClock size={22}/></div>
                    <div><h4 className="font-semibold text-[#0F172A] text-[15px]">Reschedule</h4><p className="text-gray-500 text-sm mt-0.5">Pick a new date, time &amp; timezone</p></div>
                  </button>
                  <button onClick={() => setEditAction("projectwon")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-[#065F46] hover:bg-[#ECFDF5] transition-all text-left">
                    <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] text-[#065F46] flex items-center justify-center shrink-0"><Trophy size={22}/></div>
                    <div><h4 className="font-semibold text-[#0F172A] text-[15px]">Project Won</h4><p className="text-gray-500 text-sm mt-0.5">Fill project details &amp; move to Projects</p></div>
                  </button>
                  <button onClick={() => setEditAction("closeclient")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-[#B42318] hover:bg-[#FFF1F3] transition-all text-left">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFF1F3] text-[#B42318] flex items-center justify-center shrink-0"><UserX size={22}/></div>
                    <div><h4 className="font-semibold text-[#0F172A] text-[15px]">Close Client</h4><p className="text-gray-500 text-sm mt-0.5">Remove this client from the list</p></div>
                  </button>
                </div>
              )}

              {/* RESCHEDULE FORM */}
              {editAction === "reschedule" && (
                <div className="mt-7">
                  <div>
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><CalendarDays size={16}/>New Schedule Date</label>
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="mt-3 w-full h-13 rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"/>
                  </div>
                  <div className="mt-5">
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><Clock3 size={16}/>New Call Time</label>
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="mt-3 w-full h-13 rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"/>
                  </div>
                  <div className="mt-5 relative">
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><Globe size={16}/>Client Timezone (US)</label>
                    <select value={selectedTimezone} onChange={e => setSelectedTimezone(e.target.value)}
                      className="mt-3 w-full h-13 rounded-2xl border border-gray-200 px-4 pr-10 outline-none appearance-none bg-white cursor-pointer focus:border-[#B8112D] text-[14px]">
                      {usTimezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                    <div className="absolute right-4 top-11.5 pointer-events-none text-gray-400"><ChevronDown size={18}/></div>
                  </div>
                  {scheduleDate && scheduleTime && (
                    <div className="mt-5 p-4 bg-[#F5F6FA] rounded-2xl">
                      <p className="text-[12px] font-medium text-gray-500 mb-1">New Schedule Preview</p>
                      <p className="text-[15px] font-semibold text-[#0F172A]">
                        {scheduleDate} at {scheduleTime} {usTimezones.find(tz => tz.value===selectedTimezone)?.abbreviation}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-3 mt-7">
                    <button onClick={() => setEditAction(null)} className="flex-1 h-13 rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Back</button>
                    <button onClick={saveReschedule} disabled={!scheduleDate || !scheduleTime}
                      className={`flex-1 h-13 rounded-2xl font-semibold text-white transition-all ${scheduleDate && scheduleTime ? "bg-[#B8112D]" : "bg-gray-300 cursor-not-allowed"}`}>
                      Save Schedule
                    </button>
                  </div>
                </div>
              )}

              {/* PROJECT WON FORM */}
              {editAction === "projectwon" && (
                <div className="mt-7">
                  <div className="bg-[#ECFDF5] rounded-2xl p-4 flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#065F46] flex items-center justify-center shrink-0 shadow-sm"><Trophy size={20}/></div>
                    <div>
                      <h4 className="font-bold text-[#065F46] text-[15px]">Project Won 🎉</h4>
                      <p className="text-[#065F46]/70 text-[12px] mt-0.5">Fill in the project details for <strong>{editingCall.client}</strong></p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <FileText size={15}/>Project Title <span className="text-[#B8112D] text-xs">*required</span>
                    </label>
                    <input type="text" placeholder="e.g. BIM Modeling Phase 1" value={projectTitle}
                      onChange={e => setProjectTitle(e.target.value)}
                      className="mt-3 w-full h-13 rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#065F46] text-[14px]"/>
                  </div>
                  <div className="mt-6">
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2 mb-3">
                      <Briefcase size={15}/>Service to Provide <span className="text-[#B8112D] text-xs">*required</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {serviceOptions.map(({ value, label, Icon }) => {
                        const isSelected = projectService === value;
                        return (
                          <button key={value} onClick={() => setProjectService(value)}
                            className={`h-18 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-[12px] font-semibold ${
                              isSelected ? "border-[#065F46] bg-[#ECFDF5] text-[#065F46] shadow-sm" : "border-gray-100 bg-[#FAFAFA] text-[#0F172A] hover:border-gray-300"
                            }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-[#065F46]/10" : "bg-white shadow-sm"}`}>
                              <Icon size={15} className={isSelected ? "text-[#065F46]" : "text-gray-500"}/>
                            </div>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-5">
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <CalendarDays size={15}/>Project Deadline <span className="text-[#B8112D] text-xs">*required</span>
                    </label>
                    <input type="date" value={projectDeadline} onChange={e => setProjectDeadline(e.target.value)}
                      className="mt-3 w-full h-13 rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#065F46]"/>
                  </div>
                  <div className="mt-5">
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <DollarSign size={15}/>Project Budget <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </label>
                    <input type="text" placeholder="e.g. $5,000" value={projectBudget}
                      onChange={e => setProjectBudget(e.target.value)}
                      className="mt-3 w-full h-13 rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#065F46] text-[14px]"/>
                  </div>
                  <div className="mt-5">
                    <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <AlignLeft size={15}/>Project Notes <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </label>
                    <textarea placeholder="Any additional notes about the project..." value={projectNotes}
                      onChange={e => setProjectNotes(e.target.value)} rows={3}
                      className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-[#065F46] text-[14px] resize-none"/>
                  </div>
                  <div className="flex gap-3 mt-7">
                    <button onClick={() => setEditAction(null)} className="flex-1 h-13 rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Back</button>
                    <button onClick={saveProjectWon} disabled={!projectWonValid}
                      className={`flex-1 h-13 rounded-2xl font-semibold text-white transition-all ${projectWonValid ? "bg-[#065F46]" : "bg-gray-300 cursor-not-allowed"}`}>
                      Confirm &amp; Move
                    </button>
                  </div>
                </div>
              )}

              {/* CLOSE CLIENT */}
              {editAction === "closeclient" && (
                <div className="mt-7">
                  <div className="bg-[#FFF1F3] rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white text-[#B42318] flex items-center justify-center shrink-0 shadow-sm"><UserX size={22}/></div>
                    <div>
                      <h4 className="font-bold text-[#B42318] text-[16px]">Confirm Close Client</h4>
                      <p className="text-[#B42318]/70 text-sm mt-1"><strong>{editingCall.client}</strong> will be removed from your list permanently.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-7">
                    <button onClick={() => setEditAction(null)} className="flex-1 h-13 rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Back</button>
                    <button onClick={saveCloseClient} className="flex-1 h-13 rounded-2xl bg-[#B42318] text-white font-semibold shadow-sm">Close Client</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}