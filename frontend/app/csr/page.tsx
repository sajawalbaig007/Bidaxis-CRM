"use client";

import { useState, useEffect } from "react";

import {
  ShieldCheck,
  Activity,
  PhoneCall,
  CircleCheckBig,
  AlertTriangle,
  Clock3,
  Phone,
  Users,
  UserCheck,
  Bell,
  ChevronDown,
  X,
  Globe,
  Calendar,
  Briefcase,
} from "lucide-react";

import CSRNavbar from "./components/CSRNavbar";
import CSRSidebar from "./components/CSRSidebar";
import WelcomeHeader from "./components/WelcomeHeader";
import API from "@/lib/api";

// US Timezones array
const usTimezones = [
  {
    value: "America/Adak",
    label: "Hawaii-Aleutian (UTC-10:00)",
    abbreviation: "HAST",
  },
  {
    value: "America/Anchorage",
    label: "Alaska (UTC-09:00)",
    abbreviation: "AKST",
  },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time (UTC-08:00)",
    abbreviation: "PT",
  },
  {
    value: "America/Denver",
    label: "Mountain Time (UTC-07:00)",
    abbreviation: "MT",
  },
  {
    value: "America/Chicago",
    label: "Central Time (UTC-06:00)",
    abbreviation: "CT",
  },
  {
    value: "America/New_York",
    label: "Eastern Time (UTC-05:00)",
    abbreviation: "ET",
  },
  {
    value: "America/Phoenix",
    label: "Arizona (UTC-07:00) - No DST",
    abbreviation: "MST",
  },
  {
    value: "America/Indiana/Indianapolis",
    label: "Indiana (UTC-05:00)",
    abbreviation: "EST",
  },
  {
    value: "Pacific/Honolulu",
    label: "Hawaii (UTC-10:00) - No DST",
    abbreviation: "HST",
  },
];

// Services list for Interested modal
const serviceOptions = [
  { value: "Estimating", label: "Estimating", icon: "📊" },
  { value: "Scheduling", label: "Scheduling", icon: "📅" },
  { value: "Shop Drawing", label: "Shop Drawing", icon: "📐" },
  { value: "Drafting", label: "Drafting", icon: "✏️" },
  { value: "BIM", label: "BIM", icon: "🏗️" },
  { value: "IT", label: "IT", icon: "💻" },
];

// Helper function
const getCurrentTimeInTimezone = (timezone: string): string => {
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };
    return new Intl.DateTimeFormat("en-US", options).format(now);
  } catch {
    return "--:-- --";
  }
};

export default function CSRPage() {
  /* MOBILE SIDEBAR */
  const [isOpen, setIsOpen] = useState(false);

  type LeadType = {
    id: string;
    client: string;
    company: string;
    phone: string;
    email: string;
    status: string;
    nextSchedule: string;
    nextTime: string;
    timezone: string;
    followUpNotes?: string;
    interestedService?: string;
  };

  // Stats state — fetched from backend per CSR
  const [stats, setStats] = useState({
    totalCalls: 0,
    activeLeads: 0,
    availableStaff: 0,
    notifications: 0,
  });

  const [links, setLinks] = useState<LeadType[]>([]);

  /* ================= FETCH REAL LEADS & STATS ================= */
  const fetchDashboard = async () => {
    try {
      const res = await API.get("/csr/dashboard");

      // Stats from backend (per-CSR real data)
      if (res.data.stats) {
        setStats({
          totalCalls: res.data.stats.totalCalls ?? 0,
          activeLeads: res.data.stats.activeLeads ?? 0,
          availableStaff: res.data.stats.availableStaff ?? 0,
          notifications: res.data.stats.notifications ?? 0,
        });
      }

      interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  status: string;
  nextSchedule: string;
  nextTime: string;
  timezone: string;
  followUpNotes: string;
  interestedService: string;
}

const formatted = res.data.leads.map((lead: Lead) => ({
  id: lead.id,
  client: lead.name || "Unknown",
  company: lead.company || "N/A",
  phone: lead.phone || "N/A",
  email: lead.email || "N/A",
  status: lead.status || "pending",
  nextSchedule: lead.nextSchedule || "",
  nextTime: lead.nextTime || "",
  timezone: lead.timezone || "",
  followUpNotes: lead.followUpNotes || "",
  interestedService: lead.interestedService || "",
}));

      setLinks(formatted);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchDashboard();
    };
    loadData();
  }, []);

  /* ACTIVE TAB */
  const [activeTab, setActiveTab] = useState("today");

  /* IMPORTANT MODAL */
  const [showImportantModal, setShowImportantModal] = useState(false);
  const [selectedImportantId, setSelectedImportantId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("America/New_York");

  /* INTERESTED MODAL */
  const [showInterestedModal, setShowInterestedModal] = useState(false);
  const [selectedInterestedId, setSelectedInterestedId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>("");

  /* FILTERED LINKS */
  const filteredLinks = links.filter((item) => {
    if (activeTab === "today") return item.status === "pending";
    if (activeTab === "completed")
      return (
        item.status === "completed" ||
        item.status === "important" ||
        item.status === "interested" ||
        item.status === "project won"
      );
    if (activeTab === "pending") return item.status === "pending";
    if (activeTab === "notcompleted") return item.status === "not completed";
    if (activeTab === "important") return item.status === "important";
    if (activeTab === "interested") return item.status === "interested";
    if (activeTab === "projectwon") return item.status === "project won";
    return true;
  });

  /* COUNTS */
  const completedCount = links.filter(
    (item) =>
      item.status === "completed" ||
      item.status === "important" ||
      item.status === "interested" ||
      item.status === "project won"
  ).length;

  const importantCount = links.filter((item) => item.status === "important").length;
  const interestedCount = links.filter((item) => item.status === "interested").length;
  const projectWonCount = links.filter((item) => item.status === "project won").length;
  const pendingCount = links.filter((item) => item.status === "pending").length;
  const notCompletedCount = links.filter((item) => item.status === "not completed").length;

  /* UPDATE STATUS */
  const updateStatus = async (id: string, status: string) => {
    const selectedLink = links.find((item) => item.id === id);
    if (!selectedLink) return;

    /* IMPORTANT — open scheduling modal */
    if (status === "important") {
      setSelectedImportantId(selectedLink.id);
      const existingLink = links.find((l) => l.id === selectedLink.id);
      if (existingLink?.timezone) {
        setSelectedTimezone(existingLink.timezone);
      } else {
        setSelectedTimezone("America/New_York");
      }
      setShowImportantModal(true);
      return;
    }

    /* INTERESTED — open service selection modal */
    if (status === "interested") {
      setSelectedInterestedId(selectedLink.id);
      setSelectedService("");
      setShowInterestedModal(true);
      return;
    }

    /* ALL OTHER STATUSES — update directly */
    try {
      await API.put(`/csr/lead/${id}`, { status });
      setLinks((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
    } catch (error) {
      console.log(error);
    }
  };

  /* SAVE IMPORTANT */
  const saveImportantCall = async () => {
    if (!scheduleDate || !scheduleTime) return;

    try {
      await API.put(`/csr/lead/${selectedImportantId}`, {
        status: "important",
        nextSchedule: scheduleDate,
        nextTime: scheduleTime,
        timezone: selectedTimezone,
      });

      setLinks((prev) =>
        prev.map((item) =>
          item.id === selectedImportantId
            ? {
                ...item,
                status: "important",
                nextSchedule: scheduleDate,
                nextTime: scheduleTime,
                timezone: selectedTimezone,
              }
            : item
        )
      );
    } catch (error) {
      console.log(error);
    }

    setShowImportantModal(false);
    setScheduleDate("");
    setScheduleTime("");
    setSelectedTimezone("America/New_York");
  };

  /* SAVE INTERESTED */
  const saveInterestedCall = async () => {
    if (!selectedService) return;

    try {
      await API.put(`/csr/lead/${selectedInterestedId}`, {
        status: "interested",
        interestedService: selectedService,
      });

      setLinks((prev) =>
        prev.map((item) =>
          item.id === selectedInterestedId
            ? { ...item, status: "interested", interestedService: selectedService }
            : item
        )
      );
    } catch (error) {
      console.log(error);
    }

    setShowInterestedModal(false);
    setSelectedService("");
    setSelectedInterestedId(null);
  };

  // Helper to display scheduled time with timezone
  const getFormattedSchedule = (link: (typeof links)[0]) => {
    if (!link.nextSchedule || !link.nextTime) return null;

    const timezoneInfo = usTimezones.find((tz) => tz.value === link.timezone);
    const timezoneDisplay = timezoneInfo
      ? timezoneInfo.abbreviation
      : link.timezone?.split("/").pop();

    return (
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-[#0F172A]">
          {link.nextSchedule} at {link.nextTime}
        </span>
        <span className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
          <Globe size={10} />
          {timezoneDisplay || link.timezone || "No TZ"}
        </span>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      {/* SIDEBAR */}
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      {/* MAIN */}
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        {/* NAVBAR */}
        <CSRNavbar setIsOpen={setIsOpen} />

        {/* HEADER */}
        <div className="mt-7">
          <div className="flex items-start gap-4">
            {/* AVATAR */}
            <div className="w-12 h-12 rounded-full bg-[#B8112D] text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
              C
            </div>

            {/* TEXT */}
            <div>
              <WelcomeHeader />

              {/* BADGES */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {/* ROLE */}
                <div className="flex items-center gap-2 bg-[#FFF1F3] text-[#B8112D] px-3 py-1 rounded-xl border border-white shadow-sm">
                  <ShieldCheck size={13} />
                  <span className="text-[12px] font-semibold">CSR Executive</span>
                </div>

                {/* ACTIVE */}
                <div className="flex items-center gap-2 bg-[#ECFDF3] text-[#027A48] px-3 py-1 rounded-xl border border-white shadow-sm">
                  <Activity size={13} />
                  <span className="text-[12px] font-semibold">Active</span>
                </div>
              </div>

              <p className="text-gray-500 mt-3 text-[13px] sm:text-[14px]">
                Manage assigned client calls and update statuses.
              </p>
            </div>
          </div>
        </div>

        {/* STATS — real data from backend per CSR */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {/* CARD */}
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-white shadow-sm flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-[12px] sm:text-[13px] font-medium">
                Total Calls
              </p>
              <h2 className="text-[24px] font-bold text-[#0F172A] mt-2">
                {stats.totalCalls.toLocaleString()}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#F4ECFF] text-[#7A3FFD] flex items-center justify-center shrink-0">
              <Phone size={22} />
            </div>
          </div>

          {/* CARD */}
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-white shadow-sm flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-[12px] sm:text-[13px] font-medium">
                Active Leads
              </p>
              <h2 className="text-[24px] font-bold text-[#0F172A] mt-2">
                {stats.activeLeads.toLocaleString()}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center shrink-0">
              <Users size={22} />
            </div>
          </div>

          {/* CARD */}
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-white shadow-sm flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-[12px] sm:text-[13px] font-medium">
                Available Staff
              </p>
              <h2 className="text-[24px] font-bold text-[#0F172A] mt-2">
                {stats.availableStaff.toLocaleString()}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FFF3E8] text-[#FF7A00] flex items-center justify-center shrink-0">
              <UserCheck size={22} />
            </div>
          </div>

          {/* CARD */}
          <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-white shadow-sm flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-[12px] sm:text-[13px] font-medium">
                Notifications
              </p>
              <h2 className="text-[24px] font-bold text-[#0F172A] mt-2">
                {stats.notifications.toLocaleString()}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FFEAF5] text-[#FF4DA6] flex items-center justify-center shrink-0">
              <Bell size={22} />
            </div>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="bg-white rounded-[28px] p-4 sm:p-6 shadow-sm mt-7 border border-white">
          {/* TOP */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <h3 className="text-[22px] font-bold text-[#0F172A]">Client Calls</h3>
              <p className="text-gray-500 mt-1 text-[13px]">
                Manage assigned client calls.
              </p>
            </div>

            <div className="bg-[#ECFDF3] text-[#027A48] px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-2 w-fit">
              <div className="w-2 h-2 rounded-full bg-[#12B76A]" />
              Live Tracking
            </div>
          </div>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-3 mt-7 mb-7">
            {/* TODAY */}
            <button
              onClick={() => setActiveTab("today")}
              className={`h-[48px] px-5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === "today"
                  ? "bg-[#B8112D] text-white shadow-sm"
                  : "bg-[#F8F8F8] text-gray-700"
              }`}
            >
              <PhoneCall size={17} />
              Today Links
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">
                {pendingCount}
              </span>
            </button>

            {/* COMPLETED */}
            <button
              onClick={() => setActiveTab("completed")}
              className={`h-[48px] px-5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === "completed"
                  ? "bg-[#027A48] text-white"
                  : "bg-[#ECFDF3] text-[#027A48]"
              }`}
            >
              <CircleCheckBig size={17} />
              Completed
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">
                {completedCount}
              </span>
            </button>

            {/* PENDING */}
            <button
              onClick={() => setActiveTab("pending")}
              className={`h-[48px] px-5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === "pending"
                  ? "bg-[#B54708] text-white"
                  : "bg-[#FFF7E6] text-[#B54708]"
              }`}
            >
              <Clock3 size={17} />
              Pending
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">
                {pendingCount}
              </span>
            </button>

            {/* NOT COMPLETED */}
            <button
              onClick={() => setActiveTab("notcompleted")}
              className={`h-[48px] px-5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === "notcompleted"
                  ? "bg-[#F97316] text-white"
                  : "bg-[#FFF1E8] text-[#F97316]"
              }`}
            >
              <Clock3 size={17} />
              Not Completed
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">
                {notCompletedCount}
              </span>
            </button>

            {/* IMPORTANT */}
            <button
              onClick={() => setActiveTab("important")}
              className={`h-[48px] px-5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === "important"
                  ? "bg-[#B42318] text-white"
                  : "bg-[#FFF1F3] text-[#B42318]"
              }`}
            >
              <AlertTriangle size={17} />
              Important
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">
                {importantCount}
              </span>
            </button>

            {/* INTERESTED */}
            <button
              onClick={() => setActiveTab("interested")}
              className={`h-[48px] px-5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === "interested"
                  ? "bg-[#B8112D] text-white"
                  : "bg-[#FFF1F3] text-[#B42318]"
              }`}
            >
              <Users size={17} />
              Interested
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">
                {interestedCount}
              </span>
            </button>

            {/* PROJECT WON */}
            <button
              onClick={() => setActiveTab("projectwon")}
              className={`h-[48px] px-5 rounded-2xl flex items-center gap-3 text-sm font-semibold transition-all ${
                activeTab === "projectwon"
                  ? "bg-[#065F46] text-white"
                  : "bg-[#ECFDF5] text-[#065F46]"
              }`}
            >
              <CircleCheckBig size={17} />
              Project Won
              <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">
                {projectWonCount}
              </span>
            </button>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full min-w-[850px]">
              {/* HEAD */}
              <thead className="bg-[#FAFAFA]">
                <tr>
                  <th className="text-left py-4 px-5 text-[13px] font-semibold text-gray-500">
                    Client
                  </th>
                  <th className="text-left py-4 px-5 text-[13px] font-semibold text-gray-500">
                    Company
                  </th>
                  <th className="text-left py-4 px-5 text-[13px] font-semibold text-gray-500">
                    Phone
                  </th>
                  <th className="text-left py-4 px-5 text-[13px] font-semibold text-gray-500">
                    Next Schedule
                  </th>
                  <th className="text-left py-4 px-5 text-[13px] font-semibold text-gray-500">
                    Status
                  </th>
                  <th className="text-left py-4 px-5 text-[13px] font-semibold text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((currentLink) => (
                    <tr
                      key={currentLink.id}
                      className="border-t border-gray-100 bg-white"
                    >
                      {/* CLIENT */}
                      <td className="py-5 px-5">
                        <div className="flex items-center gap-3">
                          {/* INDEX NUMBER */}
                          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#0F172A] flex items-center justify-center text-xs font-bold shrink-0">
                            {links
                              .filter((item) => {
                                if (activeTab === "today")
                                  return item.status === "pending";
                                if (activeTab === "completed")
                                  return item.status === "completed";
                                if (activeTab === "notcompleted")
                                  return item.status === "not completed";
                                if (activeTab === "important")
                                  return item.status === "important";
                                if (activeTab === "interested")
                                  return item.status === "interested";
                                if (activeTab === "projectwon")
                                  return item.status === "project won";
                                return item.status === "pending";
                              })
                              .findIndex((item) => item.id === currentLink.id) + 1}
                          </div>

                          <div className="w-11 h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {currentLink.client.charAt(0)}
                          </div>

                          <div>
                            <h4 className="text-[14px] font-semibold text-[#0F172A]">
                              {currentLink.client}
                            </h4>
                            <p className="text-[11px] text-gray-500 mt-1">
                              {currentLink.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* COMPANY */}
                      <td className="py-5 px-5 text-[14px] font-medium text-[#0F172A]">
                        {currentLink.company}
                      </td>

                      {/* PHONE */}
                      <td className="py-5 px-5 text-[14px] font-medium text-[#0F172A]">
                        {currentLink.phone}
                      </td>

                      {/* SCHEDULE — shows service if interested, date if important */}
                      <td className="py-5 px-5">
                        {currentLink.status === "interested" &&
                        currentLink.interestedService ? (
                          <div className="flex flex-col">
                            <span className="text-[11px] text-gray-400 mb-1">
                              Interested In
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF4E5] text-[#D97706] rounded-xl text-[13px] font-semibold w-fit">
                              <Briefcase size={12} />
                              {currentLink.interestedService}
                            </span>
                          </div>
                        ) : currentLink.nextSchedule && currentLink.nextTime ? (
                          getFormattedSchedule(currentLink)
                        ) : (
                          <span className="text-gray-400 text-[13px]">
                            Not scheduled
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-5 px-5">
                        <div
                          className={`
                            px-4 py-2 rounded-xl text-sm font-semibold w-fit
                            ${
                              currentLink.status === "completed"
                                ? "bg-[#ECFDF3] text-[#027A48]"
                                : currentLink.status === "important"
                                ? "bg-[#FFF1F3] text-[#B8112D]"
                                : currentLink.status === "interested"
                                ? "bg-[#FFF4E5] text-[#D97706]"
                                : currentLink.status === "project won"
                                ? "bg-[#ECFDF5] text-[#065F46]"
                                : currentLink.status === "not completed"
                                ? "bg-[#FFF7E6] text-[#B54708]"
                                : "bg-[#F4F4F5] text-[#52525B]"
                            }
                          `}
                        >
                          {currentLink.status}
                        </div>
                      </td>

                      {/* ACTION */}
                      <td className="py-5 px-5">
                        <div className="relative w-full max-w-[230px]">
                          <select
                            onChange={(e) =>
                              updateStatus(currentLink.id, e.target.value)
                            }
                            className="
                              appearance-none
                              h-[46px]
                              w-full
                              rounded-2xl
                              border
                              border-gray-200
                              bg-white
                              px-4
                              pr-11
                              text-[14px]
                              font-semibold
                              text-[#0F172A]
                              outline-none
                            "
                          >
                            <option value="">Update Status</option>
                            <option value="completed">Completed</option>
                            <option value="not completed">Not Completed</option>
                            <option value="pending">Pending</option>
                            <option value="important">Important</option>
                            <option value="interested">Interested</option>
                            <option value="project won">Project Won</option>
                          </select>

                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <h2 className="text-2xl font-bold text-[#0F172A]">
                        No Data Found 🎉
                      </h2>
                      <p className="text-gray-500 mt-3 text-sm">
                        No calls available in this category.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================== IMPORTANT MODAL ===================== */}
        {showImportantModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl">
              {/* TOP */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[26px] font-bold text-[#0F172A]">
                    Important Call
                  </h2>
                  <p className="text-gray-500 text-sm mt-2">
                    Schedule next follow-up call with timezone.
                  </p>
                </div>

                <button
                  onClick={() => setShowImportantModal(false)}
                  className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              {/* DATE */}
              <div className="mt-7">
                <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                  <Calendar size={16} />
                  Next Schedule Date
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"
                />
              </div>

              {/* TIME */}
              <div className="mt-5">
                <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                  <Clock3 size={16} />
                  Next Call Time
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"
                />
              </div>

              {/* TIMEZONE SELECTOR */}
              <div className="mt-5 relative">
                <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                  <Globe size={16} />
                  Client Timezone (US)
                </label>

                <select
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 pr-10 outline-none appearance-none bg-white cursor-pointer focus:border-[#B8112D] text-[14px]"
                >
                  {usTimezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>

                <div className="absolute right-4 top-[42px] pointer-events-none text-gray-400">
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* REAL TIME PREVIEW */}
              {scheduleDate && scheduleTime && selectedTimezone && (
                <div className="mt-5 p-4 bg-[#F5F6FA] rounded-2xl">
                  <p className="text-[12px] font-medium text-gray-500 mb-2">
                    Scheduled Meeting (Client Local Time)
                  </p>
                  <p className="text-[15px] font-semibold text-[#0F172A]">
                    {scheduleDate} at {scheduleTime}{" "}
                    {usTimezones.find((tz) => tz.value === selectedTimezone)?.abbreviation}
                  </p>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Globe size={11} />
                      Current time in{" "}
                      {usTimezones.find((tz) => tz.value === selectedTimezone)?.label.split(" ")[0]}:
                      <span className="font-mono font-medium text-gray-600 ml-1">
                        {getCurrentTimeInTimezone(selectedTimezone)}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* BUTTONS */}
              <div className="flex gap-3 mt-7">
                <button
                  onClick={() => setShowImportantModal(false)}
                  className="flex-1 h-[52px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={saveImportantCall}
                  className="flex-1 h-[52px] rounded-2xl bg-[#B8112D] text-white font-semibold shadow-sm"
                >
                  Schedule Call
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== INTERESTED MODAL ===================== */}
        {showInterestedModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl">
              {/* TOP */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[26px] font-bold text-[#0F172A]">
                    Client Interested In
                  </h2>
                  <p className="text-gray-500 text-sm mt-2">
                    Select the service the client is interested in.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowInterestedModal(false);
                    setSelectedService("");
                  }}
                  className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              {/* SERVICE OPTIONS — card grid */}
              <div className="mt-7 grid grid-cols-2 gap-3">
                {serviceOptions.map((service) => (
                  <button
                    key={service.value}
                    onClick={() => setSelectedService(service.value)}
                    className={`
                      h-[72px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all font-semibold text-[14px]
                      ${
                        selectedService === service.value
                          ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D] shadow-sm"
                          : "border-gray-100 bg-[#FAFAFA] text-[#0F172A] hover:border-gray-300"
                      }
                    `}
                  >
                    <span className="text-[22px]">{service.icon}</span>
                    <span>{service.label}</span>
                  </button>
                ))}
              </div>

              {/* SELECTED PREVIEW */}
              {selectedService && (
                <div className="mt-5 p-4 bg-[#FFF4E5] rounded-2xl flex items-center gap-3">
                  <Briefcase size={18} className="text-[#D97706] shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-gray-500">
                      Selected Service
                    </p>
                    <p className="text-[15px] font-bold text-[#D97706]">
                      {selectedService}
                    </p>
                  </div>
                </div>
              )}

              {/* BUTTONS */}
              <div className="flex gap-3 mt-7">
                <button
                  onClick={() => {
                    setShowInterestedModal(false);
                    setSelectedService("");
                  }}
                  className="flex-1 h-[52px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={saveInterestedCall}
                  disabled={!selectedService}
                  className={`
                    flex-1 h-[52px] rounded-2xl font-semibold shadow-sm text-white transition-all
                    ${
                      selectedService
                        ? "bg-[#B8112D] cursor-pointer"
                        : "bg-gray-300 cursor-not-allowed"
                    }
                  `}
                >
                  Save Interest
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}