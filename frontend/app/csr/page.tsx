"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import {
  ShieldCheck, Activity, PhoneCall, CircleCheckBig, AlertTriangle,
  Clock3, Phone, Users, UserCheck, Bell, ChevronDown, X, Globe,
  Calendar, Briefcase, FileText, DollarSign, AlignLeft, CalendarDays,
  BarChart2, PenTool, Pencil, Building2, Monitor, MessageSquare,
  Check, MapPin, Search, Eye,
} from "lucide-react";

import CSRNavbar     from "./components/CSRNavbar";
import CSRSidebar    from "./components/CSRSidebar";
import WelcomeHeader from "./components/WelcomeHeader";
import LeadDetailModal from "./components/LeadDetailModal";
import API from "@/lib/api";

/* ─── TIMEZONE OPTIONS ─── */
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

/* ─── SERVICE OPTIONS ─── */
const serviceOptions = [
  { value: "Estimating",   label: "Estimating",   Icon: BarChart2    },
  { value: "Scheduling",   label: "Scheduling",   Icon: CalendarDays  },
  { value: "Shop Drawing", label: "Shop Drawing", Icon: PenTool      },
  { value: "Drafting",     label: "Drafting",     Icon: Pencil       },
  { value: "BIM",          label: "BIM",          Icon: Building2    },
  { value: "IT",           label: "IT",           Icon: Monitor      },
];

/* ─── US STATES ─── */
const US_STATES = [
  { code:"AL",name:"Alabama"              },{ code:"AK",name:"Alaska"               },
  { code:"AZ",name:"Arizona"              },{ code:"AR",name:"Arkansas"             },
  { code:"CA",name:"California"           },{ code:"CO",name:"Colorado"             },
  { code:"CT",name:"Connecticut"          },{ code:"DE",name:"Delaware"             },
  { code:"FL",name:"Florida"              },{ code:"GA",name:"Georgia"              },
  { code:"HI",name:"Hawaii"               },{ code:"ID",name:"Idaho"                },
  { code:"IL",name:"Illinois"             },{ code:"IN",name:"Indiana"              },
  { code:"IA",name:"Iowa"                 },{ code:"KS",name:"Kansas"               },
  { code:"KY",name:"Kentucky"             },{ code:"LA",name:"Louisiana"            },
  { code:"ME",name:"Maine"                },{ code:"MD",name:"Maryland"             },
  { code:"MA",name:"Massachusetts"        },{ code:"MI",name:"Michigan"             },
  { code:"MN",name:"Minnesota"            },{ code:"MS",name:"Mississippi"          },
  { code:"MO",name:"Missouri"             },{ code:"MT",name:"Montana"              },
  { code:"NE",name:"Nebraska"             },{ code:"NV",name:"Nevada"               },
  { code:"NH",name:"New Hampshire"        },{ code:"NJ",name:"New Jersey"           },
  { code:"NM",name:"New Mexico"           },{ code:"NY",name:"New York"             },
  { code:"NC",name:"North Carolina"       },{ code:"ND",name:"North Dakota"         },
  { code:"OH",name:"Ohio"                 },{ code:"OK",name:"Oklahoma"             },
  { code:"OR",name:"Oregon"               },{ code:"PA",name:"Pennsylvania"         },
  { code:"RI",name:"Rhode Island"         },{ code:"SC",name:"South Carolina"       },
  { code:"SD",name:"South Dakota"         },{ code:"TN",name:"Tennessee"            },
  { code:"TX",name:"Texas"                },{ code:"UT",name:"Utah"                 },
  { code:"VT",name:"Vermont"              },{ code:"VA",name:"Virginia"             },
  { code:"WA",name:"Washington"           },{ code:"WV",name:"West Virginia"        },
  { code:"WI",name:"Wisconsin"            },{ code:"WY",name:"Wyoming"              },
  { code:"DC",name:"Washington D.C."      },
];

/* ─── CANADIAN PROVINCES ─── */
const CA_PROVINCES = [
  { code:"AB",name:"Alberta"                   },{ code:"BC",name:"British Columbia"      },
  { code:"MB",name:"Manitoba"                  },{ code:"NB",name:"New Brunswick"         },
  { code:"NL",name:"Newfoundland and Labrador" },{ code:"NS",name:"Nova Scotia"           },
  { code:"NT",name:"Northwest Territories"     },{ code:"NU",name:"Nunavut"               },
  { code:"ON",name:"Ontario"                   },{ code:"PE",name:"Prince Edward Island"  },
  { code:"QC",name:"Quebec"                    },{ code:"SK",name:"Saskatchewan"          },
  { code:"YT",name:"Yukon"                     },
];

const stateMatches = (itemState: string, filterName: string): boolean => {
  const s = (itemState ?? "").trim().toLowerCase();
  if (!s) return false;
  const f = filterName.trim().toLowerCase();
  if (s === f) return true;
  const byName = [...US_STATES, ...CA_PROVINCES].find(l => l.name.toLowerCase() === f);
  if (byName && s === byName.code.toLowerCase()) return true;
  const byCode = [...US_STATES, ...CA_PROVINCES].find(l => l.code.toLowerCase() === f);
  if (byCode && s === byCode.name.toLowerCase()) return true;
  return false;
};

const getCurrentTimeInTimezone = (tz: string): string => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(new Date());
  } catch { return "--:-- --"; }
};

interface BackendLead {
  id: string; name?: string; company?: string; phone?: string; email?: string;
  status?: string; nextSchedule?: string; nextTime?: string; timezone?: string;
  followUpNotes?: string; interestedService?: string; comments?: string; state?: string;
  uploadFile?: { companyName?: string };
}

type LeadType = {
  id: string; client: string; company: string; phone: string; email: string;
  status: string; nextSchedule: string; nextTime: string; timezone: string;
  followUpNotes?: string; interestedService?: string; comments?: string;
  rawInfo: string; state: string;
};

const todayStr = new Date().toISOString().split("T")[0];
const PAGE_SIZE = 30;

function ServicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {serviceOptions.map(({ value: v, label, Icon }) => {
        const sel = value === v;
        return (
          <button key={v} onClick={() => onChange(v)}
            className={`relative py-2.5 sm:py-3 px-1 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition-all text-[10px] sm:text-[11px] font-semibold ${
              sel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"
            }`}>
            {sel && (
              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-[#B8112D] rounded-full flex items-center justify-center">
                <CircleCheckBig size={8} className="text-white sm:w-[9px] sm:h-[9px]" />
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
  );
}

export default function CSRPage() {
  const router = useRouter();

  const [isOpen,  setIsOpen]  = useState(false);
  const [links,   setLinks]   = useState<LeadType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");
  const [page,      setPage]      = useState(1);

  const [stateFilter, setStateFilter] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [showStateDD, setShowStateDD] = useState(false);
  const stateDDRef = useRef<HTMLDivElement>(null);

  const [showNotification,    setShowNotification]    = useState(false);
  const [todayImportantCalls, setTodayImportantCalls] = useState<LeadType[]>([]);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft,     setCommentDraft]     = useState("");
  const [savingCommentId,  setSavingCommentId]  = useState<string | null>(null);

  const [viewingLead, setViewingLead] = useState<LeadType | null>(null);

  const [showImportantModal,   setShowImportantModal]   = useState(false);
  const [selectedImportantId,  setSelectedImportantId]  = useState<string | null>(null);
  const [scheduleDate,         setScheduleDate]         = useState("");
  const [scheduleTime,         setScheduleTime]         = useState("");
  const [selectedTimezone,     setSelectedTimezone]     = useState("America/New_York");

  const [showInterestedModal,  setShowInterestedModal]  = useState(false);
  const [selectedInterestedId, setSelectedInterestedId] = useState<string | null>(null);
  const [selectedService,      setSelectedService]      = useState("");

  const [showProjectWonModal,  setShowProjectWonModal]  = useState(false);
  const [selectedProjectLead,  setSelectedProjectLead]  = useState<LeadType | null>(null);
  const [projectTitle,    setProjectTitle]    = useState("");
  const [projectDeadline, setProjectDeadline] = useState("");
  const [projectBudget,   setProjectBudget]   = useState("");
  const [projectNotes,    setProjectNotes]    = useState("");
  const [projectService,  setProjectService]  = useState("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stateDDRef.current && !stateDDRef.current.contains(e.target as Node))
        setShowStateDD(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await API.get("/csr/dashboard");
        const formatted: LeadType[] = (res.data.leads ?? []).map((lead: BackendLead) => ({
          id:                lead.id,
          client:            lead.name              ?? "Unknown",
          company:           lead.uploadFile?.companyName ?? lead.company ?? "N/A",
          rawInfo:           lead.company            ?? "",
          phone:             lead.phone              ?? "N/A",
          email:             lead.email              ?? "N/A",
          status:            lead.status             ?? "pending",
          nextSchedule:      lead.nextSchedule       ?? "",
          nextTime:          lead.nextTime           ?? "",
          timezone:          lead.timezone           ?? "",
          followUpNotes:     lead.followUpNotes       ?? "",
          interestedService: lead.interestedService   ?? "",
          comments:          lead.comments           ?? "",
          state:             lead.state              ?? "",
        }));
        setLinks(formatted);
        const todayCalls = formatted.filter(l => l.status === "important" && l.nextSchedule === todayStr);
        if (todayCalls.length > 0) { setTodayImportantCalls(todayCalls); setShowNotification(true); }
      } catch (err) { console.log(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    let tabId = sessionStorage.getItem("crm_tab_id");
    if (!tabId) { tabId = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("crm_tab_id", tabId); }
    const openedAt = sessionStorage.getItem("crm_tab_opened") ?? new Date().toISOString();
    sessionStorage.setItem("crm_tab_opened", openedAt);
    let hiddenAt: string | null = null;

    const sendHeartbeat = (forceVisible?: boolean) => {
      const visible = forceVisible ?? document.visibilityState === "visible";
      if (!visible && hiddenAt === null) hiddenAt = new Date().toISOString();
      if (visible) hiddenAt = null;
      API.post("/csr/heartbeat", { userAgent: navigator.userAgent, tabId, openedAt, tabVisible: visible, hiddenAt }).catch(() => {});
    };
    const markOffline = () => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"}/csr/offline`, {
        method: "POST", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId }),
      }).catch(() => {});
    };

    const handleVisibility = () => sendHeartbeat(document.visibilityState === "visible");
    const handleBlur  = () => sendHeartbeat(false);
    const handleFocus = () => sendHeartbeat(true);

    sendHeartbeat(true);
    const interval = setInterval(sendHeartbeat, 3_000);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur",         handleBlur);
    window.addEventListener("focus",        handleFocus);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur",         handleBlur);
      window.removeEventListener("focus",        handleFocus);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, []);

  const totalLeads      = links.length;
  const pendingCount    = links.filter(i => i.status === "pending").length;
  const importantCount  = links.filter(i => i.status === "important").length;
  const interestedCount = links.filter(i => i.status === "interested").length;
  const projectWonCount = links.filter(i => i.status === "Close Client").length;
  const todayImportant  = links.filter(i => i.status === "important" && i.nextSchedule === todayStr).length;
  const notInterestedCount = links.filter(i => i.status === "Not Interested" || i.status === "completed").length;
  const notPickedCount     = links.filter(i => i.status === "not picked"     || i.status === "not completed").length;

  const filteredUSStates = useMemo(() => {
    const q = stateSearch.toLowerCase();
    return !q ? US_STATES : US_STATES.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [stateSearch]);

  const filteredCAProvinces = useMemo(() => {
    const q = stateSearch.toLowerCase();
    return !q ? CA_PROVINCES : CA_PROVINCES.filter(p =>
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }, [stateSearch]);

  const filteredLinks = links.filter(item => {
    const matchesTab =
      activeTab === "today"         ? item.status === "pending"
      : activeTab === "notinterested" ? item.status === "Not Interested"
      : activeTab === "pending"       ? item.status === "pending"
      : activeTab === "notpicked"     ? (item.status === "not picked" || item.status === "not completed")
      : activeTab === "important"     ? item.status === "important"
      : activeTab === "interested"    ? item.status === "interested"
      : activeTab === "projectwon"    ? item.status === "Close Client"
      : true;
    const matchesState = stateFilter ? stateMatches(item.state, stateFilter) : true;
    const matchesPhone = phoneFilter
      ? (() => {
          const digits = item.phone.replace(/\D/g, "");
          const typed  = phoneFilter.replace(/\D/g, "");
          const afterCountry = digits.length > 10 ? digits.slice(1) : digits;
          return afterCountry.startsWith(typed);
        })()
      : true;
    return matchesTab && matchesState && matchesPhone;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / PAGE_SIZE));
  const paginated  = filteredLinks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const saveComment = async (id: string, comment: string) => {
    setSavingCommentId(id);
    try {
      await API.put(`/csr/lead/${id}`, { comments: comment });
      setLinks(prev => prev.map(i => i.id === id ? { ...i, comments: comment } : i));
    } catch (err) { console.log(err); }
    setEditingCommentId(null); setSavingCommentId(null);
  };

  const updateStatus = async (id: string, status: string) => {
    if (!status) return;
    const link = links.find(i => i.id === id);
    if (!link) return;

    if (status === "important") {
      setSelectedImportantId(id); setSelectedTimezone(link.timezone || "America/New_York");
      setShowImportantModal(true); return;
    }
    if (status === "interested") {
      setSelectedInterestedId(id); setSelectedService(""); setShowInterestedModal(true); return;
    }
    if (status === "Close Client") {
      setSelectedProjectLead(link);
      setProjectTitle(link.company !== "N/A" ? link.company : link.client);
      setProjectDeadline(""); setProjectBudget(""); setProjectNotes(""); setProjectService("");
      setShowProjectWonModal(true); return;
    }
    try {
      const res = await API.put(`/csr/lead/${id}`, { status });
      if (res.data.redistributed) {
        setLinks(prev => prev.filter(i => i.id !== id));
        toast.success("Lead limit reached — reassigned to another CSR.");
      } else {
        setLinks(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      }
    } catch (err) { console.log(err); }
  };

  const saveImportantCall = async () => {
    if (!scheduleDate || !scheduleTime) return;
    try {
      await API.put(`/csr/lead/${selectedImportantId}`, {
        status: "important", nextSchedule: scheduleDate,
        nextTime: scheduleTime, timezone: selectedTimezone,
      });
      setLinks(prev => prev.map(i =>
        i.id === selectedImportantId
          ? { ...i, status:"important", nextSchedule:scheduleDate, nextTime:scheduleTime, timezone:selectedTimezone }
          : i
      ));
    } catch (err) { console.log(err); }
    setShowImportantModal(false);
    setScheduleDate(""); setScheduleTime(""); setSelectedTimezone("America/New_York");
  };

  const saveInterestedCall = async () => {
    if (!selectedService) return;
    try {
      await API.put(`/csr/lead/${selectedInterestedId}`, { status:"interested", interestedService:selectedService });
      setLinks(prev => prev.map(i =>
        i.id === selectedInterestedId ? { ...i, status:"interested", interestedService:selectedService } : i
      ));
    } catch (err) { console.log(err); }
    setShowInterestedModal(false); setSelectedService(""); setSelectedInterestedId(null);
  };

  const saveProjectWon = async () => {
    if (!projectTitle || !projectDeadline || !selectedProjectLead) return;
    try {
      await API.put(`/csr/lead/${selectedProjectLead.id}`, {
        status:"Close Client", projectTitle, projectDeadline,
        projectBudget, projectNotes, interestedService:projectService,
      });
      setLinks(prev => prev.map(i => i.id === selectedProjectLead.id ? { ...i, status:"Close Client" } : i));
      setShowProjectWonModal(false);
      router.push("/csr/projects");
    } catch (err) { console.log(err); }
  };

  const projectWonValid = projectTitle.trim() !== "" && projectDeadline !== "" && projectService !== "";

  const statCards = [
    { label:"Total Leads",   value: totalLeads,     bg:"bg-[#F4ECFF]", color:"text-[#7A3FFD]", icon:<Phone    size={20} className="sm:w-[22px] sm:h-[22px]"/> },
    { label:"Pending",       value: pendingCount,   bg:"bg-[#EAF5FF]", color:"text-[#0B84F3]", icon:<Users    size={20} className="sm:w-[22px] sm:h-[22px]"/> },
    { label:"Calls Today",   value: todayImportant, bg:"bg-[#FFF3E8]", color:"text-[#FF7A00]", icon:<UserCheck size={20} className="sm:w-[22px] sm:h-[22px]"/> },
    { label:"Notifications", value: importantCount + interestedCount, bg:"bg-[#FFEAF5]", color:"text-[#FF4DA6]", icon:<Bell size={20} className="sm:w-[22px] sm:h-[22px]"/> },
  ];

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

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 pt-[88px] sm:pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen} />

        {/* ── TODAY IMPORTANT NOTIFICATION ── */}
        {showNotification && todayImportantCalls.length > 0 && (
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
                  <span key={call.id} className="inline-flex items-center gap-1 sm:gap-1.5 bg-white border border-[#F59E0B]/30 text-[#92400E] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl text-[11px] sm:text-[12px] font-semibold">
                    <Phone size={10} className="sm:w-[11px] sm:h-[11px]" />{call.client}
                    {call.nextTime && <span className="opacity-70">· {call.nextTime}</span>}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => setShowNotification(false)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#F59E0B]/10 text-[#B45309] flex items-center justify-center hover:bg-[#F59E0B]/20 transition-all shrink-0">
              <X size={13} className="sm:w-[15px] sm:h-[15px]" />
            </button>
          </div>
        )}

        {/* ── WELCOME ── */}
        <div className="mt-4 sm:mt-7">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#B8112D] text-white flex items-center justify-center text-base sm:text-lg font-bold shadow-sm shrink-0">C</div>
            <div>
              <WelcomeHeader />
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
                <div className="flex items-center gap-1.5 sm:gap-2 bg-[#FFF1F3] text-[#B8112D] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl shadow-sm">
                  <ShieldCheck size={11} className="sm:w-[13px] sm:h-[13px]" />
                  <span className="text-[11px] sm:text-[12px] font-semibold">CSR Executive</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 bg-[#ECFDF3] text-[#027A48] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl shadow-sm">
                  <Activity size={11} className="sm:w-[13px] sm:h-[13px]" />
                  <span className="text-[11px] sm:text-[12px] font-semibold">Active</span>
                </div>
              </div>
              <p className="text-gray-500 mt-2 sm:mt-3 text-xs sm:text-[13px] lg:text-[14px]">
                Manage assigned client calls and update statuses.
              </p>
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        {/* 2-col mobile → 2-col sm → 4-col xl */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-7">
          {statCards.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl sm:rounded-[24px] p-3 sm:p-4 lg:p-5 border border-white shadow-sm flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-gray-500 text-[10px] sm:text-[12px] lg:text-[13px] font-medium truncate">{c.label}</p>
                {loading ? (
                  <div className="h-7 sm:h-8 w-10 sm:w-12 bg-gray-100 rounded-lg mt-1.5 sm:mt-2 animate-pulse" />
                ) : (
                  <h2 className="text-xl sm:text-[24px] font-bold text-[#0F172A] mt-1 sm:mt-2">{c.value.toLocaleString()}</h2>
                )}
              </div>
              <div className={`w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl ${c.bg} ${c.color} flex items-center justify-center shrink-0`}>
                {c.icon}
              </div>
            </div>
          ))}
        </div>

        {/* ── TABLE SECTION ── */}
        <div className="bg-white rounded-2xl sm:rounded-[28px] p-4 sm:p-5 lg:p-6 shadow-sm mt-4 sm:mt-7 border border-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div>
              <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Client Calls</h3>
              <p className="text-gray-500 mt-0.5 sm:mt-1 text-xs sm:text-[13px]">Manage assigned client calls.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* ── STATE / PROVINCE FILTER ── */}
              <div className="relative" ref={stateDDRef}>
                <button
                  onClick={() => setShowStateDD(v => !v)}
                  className={`h-10 sm:h-[42px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors min-w-[160px] sm:min-w-[190px] ${
                    stateFilter
                      ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
                      : "border-gray-200 bg-[#FAFAFA] text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <MapPin size={12} className={`shrink-0 sm:w-[14px] sm:h-[14px] ${stateFilter ? "text-[#B8112D]" : "text-gray-400"}`} />
                  <span className="flex-1 text-left truncate text-[12px] sm:text-[13px]">
                    {stateFilter || "Filter by State / Province"}
                  </span>
                  {stateFilter ? (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); setStateFilter(""); setStateSearch(""); setPage(1); }}
                      className="ml-1 text-[#B8112D] hover:text-[#8b0d22] shrink-0"
                    >
                      <X size={12} className="sm:w-[13px] sm:h-[13px]" />
                    </span>
                  ) : (
                    <ChevronDown size={12} className="text-gray-400 shrink-0 sm:w-[13px] sm:h-[13px]" />
                  )}
                </button>

                {showStateDD && (
                  <div className="absolute top-11 sm:top-12 right-0 z-50 w-[240px] sm:w-[270px] bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                    <div className="p-2.5 sm:p-3 border-b border-gray-100">
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[13px] sm:h-[13px]" />
                        <input
                          type="text"
                          value={stateSearch}
                          onChange={e => setStateSearch(e.target.value)}
                          placeholder="Search states / provinces..."
                          autoFocus
                          className="w-full h-8 sm:h-9 rounded-lg sm:rounded-xl border border-gray-200 bg-[#FAFAFA] pl-7 sm:pl-8 pr-3 text-[12px] sm:text-[13px] outline-none focus:border-[#B8112D]"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
                      {filteredUSStates.length > 0 && (
                        <>
                          <div className="sticky top-0 px-3 py-1.5 bg-[#F8F9FC] border-b border-gray-100">
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">United States</p>
                          </div>
                          {filteredUSStates.map(s => (
                            <button key={s.code}
                              onClick={() => { setStateFilter(s.name); setShowStateDD(false); setStateSearch(""); setPage(1); }}
                              className={`w-full text-left px-3 sm:px-4 py-2 text-[12px] sm:text-[13px] flex items-center justify-between transition-colors hover:bg-[#FFF1F3] ${
                                stateFilter === s.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                              }`}
                            >
                              <span>{s.name}</span>
                              <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono">{s.code}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {filteredCAProvinces.length > 0 && (
                        <>
                          <div className="sticky top-0 px-3 py-1.5 bg-[#F8F9FC] border-b border-t border-gray-100">
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">Canada</p>
                          </div>
                          {filteredCAProvinces.map(p => (
                            <button key={p.code}
                              onClick={() => { setStateFilter(p.name); setShowStateDD(false); setStateSearch(""); setPage(1); }}
                              className={`w-full text-left px-3 sm:px-4 py-2 text-[12px] sm:text-[13px] flex items-center justify-between transition-colors hover:bg-[#FFF1F3] ${
                                stateFilter === p.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                              }`}
                            >
                              <span>{p.name}</span>
                              <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono">{p.code}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {filteredUSStates.length === 0 && filteredCAProvinces.length === 0 && (
                        <div className="py-6 sm:py-8 text-center text-gray-400 text-xs sm:text-sm">No results found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
          {/* Horizontally scrollable on mobile/tablet */}
          <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7 mb-4 sm:mb-7 overflow-x-auto pb-1">
            {[
              { tab:"today",          label:"Today Links",    count: pendingCount,       icon:<PhoneCall      size={13} className="sm:w-[17px] sm:h-[17px]"/>, active:"bg-[#B8112D] text-white shadow-sm",  inactive:"bg-[#F8F8F8] text-gray-700"   },
              { tab:"notinterested",  label:"Not Interested", count: notInterestedCount, icon:<CircleCheckBig size={13} className="sm:w-[17px] sm:h-[17px]"/>, active:"bg-[#475569] text-white",            inactive:"bg-[#F1F5F9] text-[#475569]"  },
              { tab:"pending",        label:"Pending",        count: pendingCount,       icon:<Clock3         size={13} className="sm:w-[17px] sm:h-[17px]"/>, active:"bg-[#B54708] text-white",            inactive:"bg-[#FFF7E6] text-[#B54708]"  },
              { tab:"notpicked",      label:"Not Picked",     count: notPickedCount,     icon:<Clock3         size={13} className="sm:w-[17px] sm:h-[17px]"/>, active:"bg-[#F97316] text-white",            inactive:"bg-[#FFF1E8] text-[#F97316]"  },
              { tab:"important",      label:"Important",      count: importantCount,     icon:<AlertTriangle  size={13} className="sm:w-[17px] sm:h-[17px]"/>, active:"bg-[#B42318] text-white",            inactive:"bg-[#FFF1F3] text-[#B42318]"  },
              { tab:"interested",     label:"Interested",     count: interestedCount,    icon:<Users          size={13} className="sm:w-[17px] sm:h-[17px]"/>, active:"bg-[#B8112D] text-white",            inactive:"bg-[#FFF1F3] text-[#B42318]"  },
              { tab:"projectwon",     label:"Close Client",   count: projectWonCount,    icon:<CircleCheckBig size={13} className="sm:w-[17px] sm:h-[17px]"/>, active:"bg-[#065F46] text-white",            inactive:"bg-[#ECFDF5] text-[#065F46]"  },
            ].map(btn => (
              <button key={btn.tab} onClick={() => { setActiveTab(btn.tab); setPage(1); setPhoneFilter(""); }}
                className={`h-10 sm:h-[48px] px-3 sm:px-5 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 text-[11px] sm:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === btn.tab ? btn.active : btn.inactive}`}>
                {btn.icon}
                <span className="hidden sm:inline">{btn.label}</span>
                <span className="sm:hidden">{btn.label.split(" ")[0]}</span>
                <span className="bg-white/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px]">{btn.count}</span>
              </button>
            ))}
          </div>

          {/* ── TABLE ── */}
          <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-gray-100">
            <table className="w-full" style={{ minWidth: "1000px" }}>
              <thead className="bg-[#FAFAFA]">
                <tr>
                  {["Client","Company","Phone","State","Comments","Status","Action"].map(h => (
                    <th key={h} className="text-left py-3 sm:py-4 px-3 sm:px-5 text-[11px] sm:text-[13px] font-semibold text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="border-t border-gray-100">
                      {[1,2,3,4,5,6,7].map(j => (
                        <td key={j} className="py-4 sm:py-5 px-3 sm:px-5">
                          <div className="h-3.5 sm:h-4 bg-gray-100 rounded animate-pulse w-16 sm:w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredLinks.length > 0 ? paginated.map((currentLink, idx) => (
                  <tr key={currentLink.id} className="border-t border-gray-100 bg-white hover:bg-[#FAFAFA] transition-colors">

                    {/* CLIENT */}
                    <td className="py-3 sm:py-5 px-3 sm:px-5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#F3F4F6] text-[#0F172A] flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </div>
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                          {currentLink.client.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <h4 className="text-[13px] sm:text-[14px] font-semibold text-[#0F172A] leading-tight truncate max-w-[100px] sm:max-w-[160px]">
                              {currentLink.client}
                            </h4>
                            <button
                              onClick={() => setViewingLead(currentLink)}
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                              title="View details"
                            >
                              <Eye size={10} className="sm:w-3 sm:h-3" />
                            </button>
                          </div>
                          {currentLink.rawInfo && currentLink.rawInfo !== currentLink.company && (
                            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 max-w-[120px] sm:max-w-[180px] truncate">
                              {currentLink.rawInfo}
                            </p>
                          )}
                          <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 truncate max-w-[120px] sm:max-w-none">
                            {currentLink.email !== "N/A" ? currentLink.email : (currentLink.state || "—")}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* COMPANY */}
                    <td className="py-3 sm:py-5 px-3 sm:px-5 text-[12px] sm:text-[14px] font-medium text-[#0F172A] max-w-[120px]">
                      <span className="truncate block">{currentLink.company}</span>
                    </td>

                    {/* PHONE */}
                    <td className="py-3 sm:py-5 px-3 sm:px-5 text-[12px] sm:text-[14px] font-medium text-[#0F172A] whitespace-nowrap">
                      {currentLink.phone}
                    </td>

                    {/* STATE */}
                    <td className="py-3 sm:py-5 px-3 sm:px-5">
                      {currentLink.state ? (
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 bg-[#EFF6FF] text-[#1D4ED8] px-2 sm:px-3 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-[12px] font-semibold whitespace-nowrap">
                          <MapPin size={10} className="sm:w-[11px] sm:h-[11px]" />{currentLink.state}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[12px] sm:text-[13px]">—</span>
                      )}
                    </td>

                    {/* COMMENTS */}
                    <td className="py-3 sm:py-5 px-3 sm:px-5">
                      {editingCommentId === currentLink.id ? (
                        <div className="flex flex-col gap-1.5 sm:gap-2 w-full max-w-[180px] sm:max-w-[240px]">
                          <textarea
                            autoFocus value={commentDraft}
                            onChange={e => setCommentDraft(e.target.value)} rows={2}
                            placeholder="Type your comment..."
                            className="w-full rounded-xl border border-[#B8112D] px-2.5 sm:px-3 py-2 text-[12px] sm:text-[13px] outline-none resize-none text-[#0F172A]"
                          />
                          <div className="flex gap-1.5 sm:gap-2">
                            <button
                              onClick={() => saveComment(currentLink.id, commentDraft)}
                              disabled={savingCommentId === currentLink.id}
                              className="flex-1 h-8 rounded-xl bg-[#B8112D] text-white text-[11px] sm:text-[12px] font-semibold flex items-center justify-center gap-1"
                            >
                              <Check size={11} />{savingCommentId === currentLink.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="flex-1 h-8 rounded-xl bg-[#F5F6FA] text-gray-500 text-[11px] sm:text-[12px] font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditingCommentId(currentLink.id); setCommentDraft(currentLink.comments || ""); }}
                          className="group cursor-pointer flex items-start gap-2 max-w-[160px] sm:max-w-[220px]"
                        >
                          {currentLink.comments ? (
                            <div className="bg-[#F5F6FA] rounded-xl px-2.5 sm:px-3 py-2 w-full">
                              <p className="text-[12px] sm:text-[13px] text-[#0F172A] leading-snug line-clamp-2">{currentLink.comments}</p>
                              <p className="text-[10px] sm:text-[11px] text-[#B8112D] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400 hover:text-[#B8112D] transition-colors">
                              <MessageSquare size={12} className="sm:w-[14px] sm:h-[14px]" />
                              <span className="text-[12px] sm:text-[13px]">Add comment</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="py-3 sm:py-5 px-3 sm:px-5">
                      <div className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-semibold w-fit whitespace-nowrap ${statusBadgeClass(currentLink.status)}`}>
                        {statusLabel(currentLink.status)}
                      </div>
                    </td>

                    {/* ACTION */}
                    <td className="py-3 sm:py-5 px-3 sm:px-5">
                      <div className="relative w-full max-w-[180px] sm:max-w-[230px]">
                        <select
                          onChange={e => updateStatus(currentLink.id, e.target.value)}
                          defaultValue=""
                          className="appearance-none h-10 sm:h-[46px] w-full rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 sm:px-4 pr-9 sm:pr-11 text-[12px] sm:text-[14px] font-semibold text-[#0F172A] outline-none"
                        >
                          <option value="">Update Status</option>
                          <option value="Not Interested">Not Interested</option>
                          <option value="not picked">Not Picked</option>
                          <option value="pending">Pending</option>
                          <option value="important">Important</option>
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
                    <td colSpan={7} className="py-14 sm:py-20 text-center">
                      <h2 className="text-lg sm:text-2xl font-bold text-[#0F172A]">No Data Found</h2>
                      <p className="text-gray-500 mt-2 sm:mt-3 text-xs sm:text-sm">
                        {stateFilter ? `No leads in "${stateFilter}".` : "No calls available in this category."}
                      </p>
                      {stateFilter && (
                        <button
                          onClick={() => setStateFilter("")}
                          className="mt-3 sm:mt-4 h-9 sm:h-10 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#FFF1F3] text-[#B8112D] text-xs sm:text-sm font-semibold hover:bg-[#fce8ec] transition-colors"
                        >
                          Clear state filter
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
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-0">
                <div>
                  <h2 className="text-xl sm:text-[26px] font-bold text-[#0F172A]">Important Call</h2>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">Schedule next follow-up call with timezone.</p>
                </div>
                <button onClick={() => setShowImportantModal(false)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500 shrink-0">
                  <X size={15} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
              <div className="mt-4 sm:mt-7 space-y-3 sm:space-y-5">
                {[
                  { label:"Next Schedule Date", inputType:"date", value:scheduleDate,  onChange:setScheduleDate,  Icon:Calendar },
                  { label:"Next Call Time",      inputType:"time", value:scheduleTime,  onChange:setScheduleTime,  Icon:Clock3   },
                ].map(({ label, inputType, value, onChange, Icon }) => (
                  <div key={label}>
                    <label className="text-xs sm:text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <Icon size={13} className="sm:w-4 sm:h-4" />{label}
                    </label>
                    <input
                      type={inputType} value={value} onChange={e => onChange(e.target.value)}
                      className="mt-2 sm:mt-3 w-full h-11 sm:h-[52px] rounded-xl sm:rounded-2xl border border-gray-200 px-3 sm:px-4 outline-none focus:border-[#B8112D] text-sm"
                    />
                  </div>
                ))}
                <div className="relative">
                  <label className="text-xs sm:text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                    <Globe size={13} className="sm:w-4 sm:h-4" />Client Timezone (US)
                  </label>
                  <select
                    value={selectedTimezone} onChange={e => setSelectedTimezone(e.target.value)}
                    className="mt-2 sm:mt-3 w-full h-11 sm:h-[52px] rounded-xl sm:rounded-2xl border border-gray-200 px-3 sm:px-4 pr-9 sm:pr-10 outline-none appearance-none bg-white focus:border-[#B8112D] text-[12px] sm:text-[14px]"
                  >
                    {usTimezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                  <div className="absolute right-3 sm:right-4 bottom-3.5 sm:bottom-4 pointer-events-none text-gray-400">
                    <ChevronDown size={15} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                </div>
              </div>
              {scheduleDate && scheduleTime && (
                <div className="mt-4 sm:mt-5 p-3 sm:p-4 bg-[#F5F6FA] rounded-xl sm:rounded-2xl">
                  <p className="text-[11px] sm:text-[12px] font-medium text-gray-500 mb-1.5 sm:mb-2">Scheduled (Client Local Time)</p>
                  <p className="text-[13px] sm:text-[15px] font-semibold text-[#0F172A]">
                    {scheduleDate} at {scheduleTime} {usTimezones.find(tz => tz.value === selectedTimezone)?.abbreviation}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1.5 sm:mt-2 flex items-center gap-1">
                    <Globe size={10} />Current: <span className="font-mono font-medium text-gray-600 ml-1">{getCurrentTimeInTimezone(selectedTimezone)}</span>
                  </p>
                </div>
              )}
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7">
                <button onClick={() => setShowImportantModal(false)} className="flex-1 h-11 sm:h-[52px] rounded-xl sm:rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600 text-sm">Cancel</button>
                <button onClick={saveImportantCall} className="flex-1 h-11 sm:h-[52px] rounded-xl sm:rounded-2xl bg-[#B8112D] text-white font-semibold shadow-sm text-sm">Schedule Call</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ INTERESTED MODAL ══ */}
        {showInterestedModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] p-5 sm:p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-0">
                <div>
                  <h2 className="text-xl sm:text-[26px] font-bold text-[#0F172A]">Client Interested In</h2>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">Select the service the client is interested in.</p>
                </div>
                <button onClick={() => { setShowInterestedModal(false); setSelectedService(""); }}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500 shrink-0">
                  <X size={15} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
              <div className="mt-4 sm:mt-7">
                <ServicePicker value={selectedService} onChange={setSelectedService} />
              </div>
              {selectedService && (
                <div className="mt-3 sm:mt-5 p-3 sm:p-4 bg-[#FFF4E5] rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3">
                  <Briefcase size={15} className="text-[#D97706] shrink-0 sm:w-[18px] sm:h-[18px]" />
                  <div>
                    <p className="text-[11px] sm:text-[12px] font-medium text-gray-500">Selected Service</p>
                    <p className="text-[13px] sm:text-[15px] font-bold text-[#D97706]">{selectedService}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7">
                <button onClick={() => { setShowInterestedModal(false); setSelectedService(""); }}
                  className="flex-1 h-11 sm:h-[52px] rounded-xl sm:rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600 text-sm">Cancel</button>
                <button onClick={saveInterestedCall} disabled={!selectedService}
                  className={`flex-1 h-11 sm:h-[52px] rounded-xl sm:rounded-2xl font-semibold text-white text-sm transition-all ${selectedService ? "bg-[#B8112D]" : "bg-gray-300 cursor-not-allowed"}`}>
                  Save Interest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ CLOSE CLIENT MODAL ══ */}
        {showProjectWonModal && selectedProjectLead && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className="w-full sm:max-w-[520px] lg:max-w-[540px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <button onClick={() => setShowProjectWonModal(false)}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
                <div className="flex items-center gap-2.5 sm:gap-3 pr-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-base sm:text-xl font-bold shrink-0">
                    {selectedProjectLead.client.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight truncate">Close Client</h2>
                    <p className="text-white/65 text-[10px] sm:text-xs mt-0.5 truncate">
                      {selectedProjectLead.client}
                      {selectedProjectLead.company && selectedProjectLead.company !== selectedProjectLead.client ? ` · ${selectedProjectLead.company}` : ""}
                      {selectedProjectLead.phone ? ` · ${selectedProjectLead.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-green-500/25 text-green-100 border border-green-400/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold">
                    <CircleCheckBig size={9} className="sm:w-[10px] sm:h-[10px]" /> Fill in project details to confirm
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">
                  {/* Project Title */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                      <FileText size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                      Project Title <span className="text-[#B8112D] normal-case ml-1">*required</span>
                    </label>
                    <input
                      type="text" placeholder="e.g. BIM Modeling Phase 1" value={projectTitle}
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
                    <ServicePicker value={projectService} onChange={setProjectService} />
                  </div>

                  {/* Deadline + Budget */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5 sm:mb-2">
                        <CalendarDays size={10} className="text-[#B8112D] sm:w-[11px] sm:h-[11px]" />
                        Deadline <span className="text-[#B8112D] normal-case">*</span>
                      </label>
                      <input
                        type="date" value={projectDeadline} onChange={e => setProjectDeadline(e.target.value)}
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
                          type="text" placeholder="0.00" value={projectBudget.replace(/^\$/, "")}
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
                      placeholder="Any additional notes..." value={projectNotes}
                      onChange={e => setProjectNotes(e.target.value)} rows={3}
                      className="w-full rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"
                    />
                  </div>

                  <div className="flex gap-2 sm:gap-3 pb-1">
                    <button onClick={() => setShowProjectWonModal(false)}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button onClick={saveProjectWon} disabled={!projectWonValid}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all ${
                        projectWonValid ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"
                      }`}>
                      Confirm &amp; Move to Projects
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            }}
            onClose={() => setViewingLead(null)}
            onSaved={(id, updates) => {
              const merged: Partial<LeadType> = {};
              if (updates.name         !== undefined) merged.client = updates.name.trim()  || "Unknown";
              if (updates.phone        !== undefined) merged.phone  = updates.phone.trim() || "N/A";
              if (updates.email        !== undefined) merged.email  = updates.email.trim() || "N/A";
              if (updates.state        !== undefined) merged.state  = updates.state.trim();
              if (updates.followUpNotes !== undefined) merged.followUpNotes = updates.followUpNotes;
              setLinks(prev => prev.map(i => i.id === id ? { ...i, ...merged } : i));
              setViewingLead(prev => prev ? { ...prev, ...merged } : prev);
            }}
          />
        )}
      </main>
    </div>
  );
}