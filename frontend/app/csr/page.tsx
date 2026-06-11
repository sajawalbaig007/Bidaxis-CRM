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

import CSRNavbar    from "./components/CSRNavbar";
import CSRSidebar   from "./components/CSRSidebar";
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
  { value: "Estimating",   label: "Estimating",   Icon: BarChart2   },
  { value: "Scheduling",   label: "Scheduling",   Icon: CalendarDays },
  { value: "Shop Drawing", label: "Shop Drawing", Icon: PenTool     },
  { value: "Drafting",     label: "Drafting",     Icon: Pencil      },
  { value: "BIM",          label: "BIM",          Icon: Building2   },
  { value: "IT",           label: "IT",           Icon: Monitor     },
];

/* ─── US STATES ─── */
const US_STATES = [
  { code:"AL", name:"Alabama"             }, { code:"AK", name:"Alaska"              },
  { code:"AZ", name:"Arizona"             }, { code:"AR", name:"Arkansas"            },
  { code:"CA", name:"California"          }, { code:"CO", name:"Colorado"            },
  { code:"CT", name:"Connecticut"         }, { code:"DE", name:"Delaware"            },
  { code:"FL", name:"Florida"             }, { code:"GA", name:"Georgia"             },
  { code:"HI", name:"Hawaii"              }, { code:"ID", name:"Idaho"               },
  { code:"IL", name:"Illinois"            }, { code:"IN", name:"Indiana"             },
  { code:"IA", name:"Iowa"                }, { code:"KS", name:"Kansas"              },
  { code:"KY", name:"Kentucky"            }, { code:"LA", name:"Louisiana"           },
  { code:"ME", name:"Maine"               }, { code:"MD", name:"Maryland"            },
  { code:"MA", name:"Massachusetts"       }, { code:"MI", name:"Michigan"            },
  { code:"MN", name:"Minnesota"           }, { code:"MS", name:"Mississippi"         },
  { code:"MO", name:"Missouri"            }, { code:"MT", name:"Montana"             },
  { code:"NE", name:"Nebraska"            }, { code:"NV", name:"Nevada"              },
  { code:"NH", name:"New Hampshire"       }, { code:"NJ", name:"New Jersey"          },
  { code:"NM", name:"New Mexico"          }, { code:"NY", name:"New York"            },
  { code:"NC", name:"North Carolina"      }, { code:"ND", name:"North Dakota"        },
  { code:"OH", name:"Ohio"                }, { code:"OK", name:"Oklahoma"            },
  { code:"OR", name:"Oregon"              }, { code:"PA", name:"Pennsylvania"        },
  { code:"RI", name:"Rhode Island"        }, { code:"SC", name:"South Carolina"      },
  { code:"SD", name:"South Dakota"        }, { code:"TN", name:"Tennessee"           },
  { code:"TX", name:"Texas"               }, { code:"UT", name:"Utah"                },
  { code:"VT", name:"Vermont"             }, { code:"VA", name:"Virginia"            },
  { code:"WA", name:"Washington"          }, { code:"WV", name:"West Virginia"       },
  { code:"WI", name:"Wisconsin"           }, { code:"WY", name:"Wyoming"             },
  { code:"DC", name:"Washington D.C."     },
];

/* ─── CANADIAN PROVINCES ─── */
const CA_PROVINCES = [
  { code:"AB", name:"Alberta"                    }, { code:"BC", name:"British Columbia"       },
  { code:"MB", name:"Manitoba"                   }, { code:"NB", name:"New Brunswick"          },
  { code:"NL", name:"Newfoundland and Labrador"  }, { code:"NS", name:"Nova Scotia"            },
  { code:"NT", name:"Northwest Territories"      }, { code:"NU", name:"Nunavut"                },
  { code:"ON", name:"Ontario"                    }, { code:"PE", name:"Prince Edward Island"   },
  { code:"QC", name:"Quebec"                     }, { code:"SK", name:"Saskatchewan"           },
  { code:"YT", name:"Yukon"                      },
];

/* match lead.state (code or name) against selected filter name */
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
  rawInfo: string;   /* lead.company from Excel (address / individual company) */
  state:   string;   /* lead.state from Excel */
};

const todayStr = new Date().toISOString().split("T")[0];

export default function CSRPage() {
  const router = useRouter();

  const [isOpen,  setIsOpen]  = useState(false);
  const [links,   setLinks]   = useState<LeadType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");

  /* state / province filter */
  const [stateFilter,  setStateFilter]  = useState("");
  const [stateSearch,  setStateSearch]  = useState("");
  const [showStateDD,  setShowStateDD]  = useState(false);
  const stateDDRef = useRef<HTMLDivElement>(null);

  const [showNotification,    setShowNotification]    = useState(false);
  const [todayImportantCalls, setTodayImportantCalls] = useState<LeadType[]>([]);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft,     setCommentDraft]     = useState("");
  const [savingCommentId,  setSavingCommentId]  = useState<string | null>(null);

  const [viewingLead, setViewingLead] = useState<LeadType | null>(null);

  const [showImportantModal,   setShowImportantModal]   = useState(false);
  const [selectedImportantId,  setSelectedImportantId]  = useState<string | null>(null);
  const [scheduleDate,    setScheduleDate]    = useState("");
  const [scheduleTime,    setScheduleTime]    = useState("");
  const [selectedTimezone,setSelectedTimezone]= useState("America/New_York");

  const [showInterestedModal,   setShowInterestedModal]   = useState(false);
  const [selectedInterestedId,  setSelectedInterestedId]  = useState<string | null>(null);
  const [selectedService,       setSelectedService]       = useState("");

  const [showProjectWonModal,  setShowProjectWonModal]  = useState(false);
  const [selectedProjectLead,  setSelectedProjectLead]  = useState<LeadType | null>(null);
  const [projectTitle,   setProjectTitle]   = useState("");
  const [projectDeadline,setProjectDeadline]= useState("");
  const [projectBudget,  setProjectBudget]  = useState("");
  const [projectNotes,   setProjectNotes]   = useState("");
  const [projectService, setProjectService] = useState("");

  /* close state dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stateDDRef.current && !stateDDRef.current.contains(e.target as Node))
        setShowStateDD(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ─── FETCH ─── */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await API.get("/csr/dashboard");

        const formatted: LeadType[] = (res.data.leads ?? []).map((lead: BackendLead) => ({
          id:               lead.id,
          client:           lead.name             ?? "Unknown",
          company:          lead.uploadFile?.companyName ?? lead.company ?? "N/A",
          rawInfo:          lead.company           ?? "",
          phone:            lead.phone             ?? "N/A",
          email:            lead.email             ?? "N/A",
          status:           lead.status            ?? "pending",
          nextSchedule:     lead.nextSchedule      ?? "",
          nextTime:         lead.nextTime          ?? "",
          timezone:         lead.timezone          ?? "",
          followUpNotes:    lead.followUpNotes      ?? "",
          interestedService:lead.interestedService  ?? "",
          comments:         lead.comments          ?? "",
          state:            lead.state             ?? "",
        }));

        setLinks(formatted);

        const todayCalls = formatted.filter(
          l => l.status === "important" && l.nextSchedule === todayStr
        );
        if (todayCalls.length > 0) {
          setTodayImportantCalls(todayCalls);
          setShowNotification(true);
        }
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ─── HEARTBEAT ─── */
  useEffect(() => {
    let tabId = sessionStorage.getItem("crm_tab_id");
    if (!tabId) {
      tabId = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("crm_tab_id", tabId);
    }
    const openedAt = sessionStorage.getItem("crm_tab_opened") ?? new Date().toISOString();
    sessionStorage.setItem("crm_tab_opened", openedAt);

    let hiddenAt: string | null = null;

    const sendHeartbeat = (forceVisible?: boolean) => {
      const visible = forceVisible ?? document.visibilityState === "visible";
      if (!visible && hiddenAt === null) { hiddenAt = new Date().toISOString(); }
      if (visible) { hiddenAt = null; }
      API.post("/csr/heartbeat", { userAgent: navigator.userAgent, tabId, openedAt, tabVisible: visible, hiddenAt }).catch(() => {});
    };

    const markOffline = () => {
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api"}/csr/offline`,
        {
          method: "POST", credentials: "include", keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabId }),
        }
      ).catch(() => {});
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

  /* ─── COUNTS ─── */
  const totalLeads      = links.length;
  const pendingCount    = links.filter(i => i.status === "pending").length;
  const importantCount  = links.filter(i => i.status === "important").length;
  const interestedCount = links.filter(i => i.status === "interested").length;
  const projectWonCount = links.filter(i => i.status === "Close Client").length;
  const todayImportant  = links.filter(i => i.status === "important" && i.nextSchedule === todayStr).length;

  const notInterestedCount = links.filter(i =>
    i.status === "Not Interested" || i.status === "completed"
  ).length;
  const notPickedCount = links.filter(i =>
    i.status === "not picked" || i.status === "not completed"
  ).length;

  /* ─── FILTERED STATE DROPDOWN OPTIONS ─── */
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

  /* ─── TABLE FILTER ─── */
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
    return matchesTab && matchesState;
  });

  /* ─── SAVE COMMENT ─── */
  const saveComment = async (id: string, comment: string) => {
    setSavingCommentId(id);
    try {
      await API.put(`/csr/lead/${id}`, { comments: comment });
      setLinks(prev => prev.map(i => i.id === id ? { ...i, comments: comment } : i));
    } catch (err) { console.log(err); }
    setEditingCommentId(null);
    setSavingCommentId(null);
  };

  /* ─── UPDATE STATUS ─── */
  const updateStatus = async (id: string, status: string) => {
    if (!status) return;
    const link = links.find(i => i.id === id);
    if (!link) return;

    if (status === "important") {
      setSelectedImportantId(id);
      setSelectedTimezone(link.timezone || "America/New_York");
      setShowImportantModal(true);
      return;
    }
    if (status === "interested") {
      setSelectedInterestedId(id);
      setSelectedService("");
      setShowInterestedModal(true);
      return;
    }
    if (status === "Close Client") {
      setSelectedProjectLead(link);
      setProjectTitle(link.company !== "N/A" ? link.company : link.client);
      setProjectDeadline(""); setProjectBudget(""); setProjectNotes(""); setProjectService("");
      setShowProjectWonModal(true);
      return;
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

  /* ─── SAVE IMPORTANT CALL ─── */
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

  /* ─── SAVE INTERESTED ─── */
  const saveInterestedCall = async () => {
    if (!selectedService) return;
    try {
      await API.put(`/csr/lead/${selectedInterestedId}`, {
        status: "interested", interestedService: selectedService,
      });
      setLinks(prev => prev.map(i =>
        i.id === selectedInterestedId
          ? { ...i, status:"interested", interestedService:selectedService }
          : i
      ));
    } catch (err) { console.log(err); }
    setShowInterestedModal(false);
    setSelectedService(""); setSelectedInterestedId(null);
  };

  /* ─── SAVE PROJECT WON ─── */
  const saveProjectWon = async () => {
    if (!projectTitle || !projectDeadline || !selectedProjectLead) return;
    try {
      await API.put(`/csr/lead/${selectedProjectLead.id}`, {
        status: "Close Client",
        projectTitle, projectDeadline, projectBudget, projectNotes,
        interestedService: projectService,
      });
      setLinks(prev => prev.map(i =>
        i.id === selectedProjectLead.id ? { ...i, status:"Close Client" } : i
      ));
      setShowProjectWonModal(false);
      router.push("/csr/projects");
    } catch (err) { console.log(err); }
  };

  const projectWonValid = projectTitle.trim() !== "" && projectDeadline !== "" && projectService !== "";

  const statCards = [
    { label:"Total Leads",    value: totalLeads,     bg:"bg-[#F4ECFF]", color:"text-[#7A3FFD]", icon:<Phone size={22}/> },
    { label:"Pending",        value: pendingCount,   bg:"bg-[#EAF5FF]", color:"text-[#0B84F3]", icon:<Users size={22}/> },
    { label:"Calls Today 🔔", value: todayImportant, bg:"bg-[#FFF3E8]", color:"text-[#FF7A00]", icon:<UserCheck size={22}/> },
    { label:"Notifications",  value: importantCount + interestedCount, bg:"bg-[#FFEAF5]", color:"text-[#FF4DA6]", icon:<Bell size={22}/> },
  ];

  const statusLabel = (s: string) => {
    if (s === "Not Interested" || s === "completed")     return "Not Interested";
    if (s === "not picked"     || s === "not completed") return "Not Picked";
    return s;
  };

  const statusBadgeClass = (s: string) => {
    if (s === "not picked" || s === "not completed") return "bg-[#FFF7E6] text-[#B54708]";
    if (s === "Not Interested" || s === "completed") return "bg-[#F1F5F9] text-[#475569]";
    if (s === "important")   return "bg-[#FFF1F3] text-[#B8112D]";
    if (s === "interested")  return "bg-[#FFF4E5] text-[#D97706]";
    if (s === "Close Client") return "bg-[#ECFDF5] text-[#065F46]";
    return "bg-[#F4F4F5] text-[#52525B]";
  };

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* TODAY IMPORTANT NOTIFICATION */}
        {showNotification && todayImportantCalls.length > 0 && (
          <div className="mt-5 bg-[#FFF7E6] border border-[#F59E0B]/30 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 text-[#B45309] flex items-center justify-center shrink-0 mt-0.5"><Bell size={20}/></div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-[#92400E] text-[15px]">
                You have {todayImportantCalls.length} important call{todayImportantCalls.length > 1 ? "s" : ""} scheduled for today!
              </h4>
              <div className="flex flex-wrap gap-2 mt-2">
                {todayImportantCalls.map(call => (
                  <span key={call.id} className="inline-flex items-center gap-1.5 bg-white border border-[#F59E0B]/30 text-[#92400E] px-3 py-1 rounded-xl text-[12px] font-semibold">
                    <Phone size={11}/>{call.client}
                    {call.nextTime && <span className="opacity-70">· {call.nextTime}</span>}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => setShowNotification(false)}
              className="w-8 h-8 rounded-xl bg-[#F59E0B]/10 text-[#B45309] flex items-center justify-center hover:bg-[#F59E0B]/20 transition-all">
              <X size={15}/>
            </button>
          </div>
        )}

        {/* WELCOME */}
        <div className="mt-7">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#B8112D] text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">C</div>
            <div>
              <WelcomeHeader/>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="flex items-center gap-2 bg-[#FFF1F3] text-[#B8112D] px-3 py-1 rounded-xl shadow-sm">
                  <ShieldCheck size={13}/><span className="text-[12px] font-semibold">CSR Executive</span>
                </div>
                <div className="flex items-center gap-2 bg-[#ECFDF3] text-[#027A48] px-3 py-1 rounded-xl shadow-sm">
                  <Activity size={13}/><span className="text-[12px] font-semibold">Active</span>
                </div>
              </div>
              <p className="text-gray-500 mt-3 text-[13px] sm:text-[14px]">Manage assigned client calls and update statuses.</p>
            </div>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {statCards.map((c, i) => (
            <div key={i} className="bg-white rounded-[24px] p-4 sm:p-5 border border-white shadow-sm flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-[12px] sm:text-[13px] font-medium">{c.label}</p>
                {loading
                  ? <div className="h-8 w-12 bg-gray-100 rounded-lg mt-2 animate-pulse"/>
                  : <h2 className="text-[24px] font-bold text-[#0F172A] mt-2">{c.value.toLocaleString()}</h2>
                }
              </div>
              <div className={`w-12 h-12 rounded-2xl ${c.bg} ${c.color} flex items-center justify-center shrink-0`}>{c.icon}</div>
            </div>
          ))}
        </div>

        {/* TABLE SECTION */}
        <div className="bg-white rounded-[28px] p-4 sm:p-4 shadow-sm mt-7 border border-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h3 className="text-[22px] font-bold text-[#0F172A]">Client Calls</h3>
              <p className="text-gray-500 mt-1 text-[13px]">Manage assigned client calls.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* ── STATE / PROVINCE FILTER ── */}
              <div className="relative" ref={stateDDRef}>
                <button
                  onClick={() => setShowStateDD(v => !v)}
                  className={`h-[42px] px-4 rounded-2xl border flex items-center gap-2 text-sm font-medium transition-colors min-w-[160px] ${
                    stateFilter
                      ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
                      : "border-gray-200 bg-[#FAFAFA] text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <MapPin size={14} className={stateFilter ? "text-[#B8112D]" : "text-gray-400"} />
                  <span className="flex-1 text-left truncate text-[13px]">
                    {stateFilter || "Filter by State / Province"}
                  </span>
                  {stateFilter ? (
                    <span
                      role="button"
                      onClick={e => { e.stopPropagation(); setStateFilter(""); setStateSearch(""); }}
                      className="ml-1 text-[#B8112D] hover:text-[#8b0d22]"
                    >
                      <X size={13}/>
                    </span>
                  ) : (
                    <ChevronDown size={13} className="text-gray-400 shrink-0"/>
                  )}
                </button>

                {showStateDD && (
                  <div className="absolute top-12 right-0 z-50 w-[250px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                    {/* search */}
                    <div className="p-3 border-b border-gray-100">
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input
                          type="text"
                          value={stateSearch}
                          onChange={e => setStateSearch(e.target.value)}
                          placeholder="Search states / provinces..."
                          autoFocus
                          className="w-full h-9 rounded-xl border border-gray-200 bg-[#FAFAFA] pl-8 pr-3 text-[13px] outline-none focus:border-[#B8112D]"
                        />
                      </div>
                    </div>

                    {/* options */}
                    <div className="overflow-y-auto" style={{ maxHeight: "280px" }}>
                      {/* US States */}
                      {filteredUSStates.length > 0 && (
                        <>
                          <div className="sticky top-0 px-3 py-1.5 bg-[#F8F9FC] border-b border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">United States</p>
                          </div>
                          {filteredUSStates.map(s => (
                            <button key={s.code}
                              onClick={() => { setStateFilter(s.name); setShowStateDD(false); setStateSearch(""); }}
                              className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center justify-between transition-colors hover:bg-[#FFF1F3] ${
                                stateFilter === s.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                              }`}
                            >
                              <span>{s.name}</span>
                              <span className="text-[11px] text-gray-400 font-mono">{s.code}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {/* Canadian Provinces */}
                      {filteredCAProvinces.length > 0 && (
                        <>
                          <div className="sticky top-0 px-3 py-1.5 bg-[#F8F9FC] border-b border-t border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Canada</p>
                          </div>
                          {filteredCAProvinces.map(p => (
                            <button key={p.code}
                              onClick={() => { setStateFilter(p.name); setShowStateDD(false); setStateSearch(""); }}
                              className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center justify-between transition-colors hover:bg-[#FFF1F3] ${
                                stateFilter === p.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                              }`}
                            >
                              <span>{p.name}</span>
                              <span className="text-[11px] text-gray-400 font-mono">{p.code}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {filteredUSStates.length === 0 && filteredCAProvinces.length === 0 && (
                        <div className="py-8 text-center text-gray-400 text-sm">No results found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#ECFDF3] text-[#027A48] px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#12B76A]"/>Live Tracking
              </div>
            </div>
          </div>

          {/* TABS */}
          <div className="flex flex-wrap gap-2 mt-7 mb-7">
            {[
              { tab:"today",         label:"Today Leads",    count: pendingCount,       icon:<PhoneCall size={17}/>,      active:"bg-[#B8112D] text-white shadow-sm", inactive:"bg-[#F8F8F8] text-gray-700"    },
              { tab:"notinterested", label:"Not Interested", count: notInterestedCount, icon:<CircleCheckBig size={17}/>, active:"bg-[#475569] text-white",           inactive:"bg-[#F1F5F9] text-[#475569]"   },
              { tab:"pending",       label:"Pending",        count: pendingCount,       icon:<Clock3 size={17}/>,         active:"bg-[#B54708] text-white",           inactive:"bg-[#FFF7E6] text-[#B54708]"   },
              { tab:"notpicked",     label:"Not Picked",     count: notPickedCount,     icon:<Clock3 size={17}/>,         active:"bg-[#F97316] text-white",           inactive:"bg-[#FFF1E8] text-[#F97316]"   },
              { tab:"important",     label:"Important",      count: importantCount,     icon:<AlertTriangle size={17}/>,  active:"bg-[#B42318] text-white",           inactive:"bg-[#FFF1F3] text-[#B42318]"   },
              { tab:"interested",    label:"Interested",     count: interestedCount,    icon:<Users size={17}/>,          active:"bg-[#B8112D] text-white",           inactive:"bg-[#FFF1F3] text-[#B42318]"   },
              { tab:"projectwon",    label:"Close Client",   count: projectWonCount,    icon:<CircleCheckBig size={17}/>, active:"bg-[#065F46] text-white",           inactive:"bg-[#ECFDF5] text-[#065F46]"   },
            ].map(btn => (
              <button key={btn.tab} onClick={() => setActiveTab(btn.tab)}
                className={`h-[44px] px-4 rounded-2xl flex items-center gap-2 text-[13px] font-semibold transition-all ${activeTab === btn.tab ? btn.active : btn.inactive}`}>
                {btn.icon}{btn.label}
                <span className="bg-white/20 px-2 py-1 rounded-lg text-[11px]">{btn.count}</span>
              </button>
            ))}
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full min-w-[920px]">
              <thead className="bg-[#FAFAFA]">
                <tr>
                  {["Client","Company","Phone","State","Comments","Status","Action"].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-[12px] font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="border-t border-gray-100">
                      {[1,2,3,4,5,6,7].map(j => (
                        <td key={j} className="py-4 px-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-24"/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredLinks.length > 0 ? filteredLinks.map(currentLink => (
                  <tr key={currentLink.id} className="border-t border-gray-100 bg-white hover:bg-[#FAFAFA] transition-colors">

                    {/* CLIENT */}
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#F3F4F6] text-[#0F172A] flex items-center justify-center text-xs font-bold shrink-0">
                          {filteredLinks.findIndex(i => i.id === currentLink.id) + 1}
                        </div>
                        <div className="w-9 h-9 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {currentLink.client.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-semibold text-[#0F172A] leading-tight truncate">{currentLink.client}</h4>
                            <button
                              onClick={() => setViewingLead(currentLink)}
                              className="w-6 h-6 rounded-lg bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                              title="View details"
                            >
                              <Eye size={12}/>
                            </button>
                          </div>
                          {/* show raw Excel address/company if available */}
                          {currentLink.rawInfo && currentLink.rawInfo !== currentLink.company && (
                            <p className="text-[11px] text-gray-400 mt-0.5 max-w-[120px] truncate">{currentLink.rawInfo}</p>
                          )}
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {currentLink.email !== "N/A" ? currentLink.email : (currentLink.state || "—")}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* COMPANY */}
                    <td className="py-4 px-3 text-[13px] font-medium text-[#0F172A]">{currentLink.company}</td>

                    {/* PHONE */}
                    <td className="py-4 px-3 text-[13px] font-medium text-[#0F172A]">{currentLink.phone}</td>

                    {/* STATE */}
                    <td className="py-4 px-3">
                      {currentLink.state ? (
                        <span className="inline-flex items-center gap-1.5 bg-[#EFF6FF] text-[#1D4ED8] px-2.5 py-1 rounded-xl text-[11px] font-semibold">
                          <MapPin size={11}/>{currentLink.state}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[13px]">—</span>
                      )}
                    </td>

                    {/* COMMENTS */}
                    <td className="py-4 px-3">
                      {editingCommentId === currentLink.id ? (
                        <div className="flex flex-col gap-2 w-full max-w-[170px]">
                          <textarea autoFocus value={commentDraft} onChange={e => setCommentDraft(e.target.value)} rows={2}
                            placeholder="Type your comment..."
                            className="w-full rounded-xl border border-[#B8112D] px-3 py-2 text-[13px] outline-none resize-none text-[#0F172A]"/>
                          <div className="flex gap-2">
                            <button onClick={() => saveComment(currentLink.id, commentDraft)} disabled={savingCommentId === currentLink.id}
                              className="flex-1 h-[34px] rounded-xl bg-[#B8112D] text-white text-[12px] font-semibold flex items-center justify-center gap-1">
                              <Check size={13}/>{savingCommentId === currentLink.id ? "Saving..." : "Save"}
                            </button>
                            <button onClick={() => setEditingCommentId(null)}
                              className="flex-1 h-[34px] rounded-xl bg-[#F5F6FA] text-gray-500 text-[12px] font-semibold">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditingCommentId(currentLink.id); setCommentDraft(currentLink.comments || ""); }}
                          className="group cursor-pointer flex items-start gap-2 max-w-[150px]"
                        >
                          {currentLink.comments ? (
                            <div className="bg-[#F5F6FA] rounded-xl px-3 py-2 w-full">
                              <p className="text-[13px] text-[#0F172A] leading-snug line-clamp-2">{currentLink.comments}</p>
                              <p className="text-[11px] text-[#B8112D] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-gray-400 hover:text-[#B8112D] transition-colors">
                              <MessageSquare size={14}/><span className="text-[13px]">Comment</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="py-4 px-3">
                      <div className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold w-fit ${statusBadgeClass(currentLink.status)}`}>
                        {statusLabel(currentLink.status)}
                      </div>
                    </td>

                    {/* ACTION */}
                    <td className="py-4 px-3">
                      <div className="relative w-full max-w-[170px]">
                        <select onChange={e => updateStatus(currentLink.id, e.target.value)} defaultValue=""
                          className="appearance-none h-[42px] w-full rounded-2xl border border-gray-200 bg-white px-3 pr-10 text-[13px] font-semibold text-[#0F172A] outline-none">
                          <option value="">Update Status</option>
                          <option value="Not Interested">Not Interested</option>
                          <option value="not picked">Not Picked</option>
                          <option value="pending">Pending</option>
                          <option value="important">Important</option>
                          <option value="interested">Interested</option>
                          <option value="Close Client">Close Client</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <ChevronDown size={18}/>
                        </div>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <h2 className="text-2xl font-bold text-[#0F172A]">No Data Found</h2>
                      <p className="text-gray-500 mt-3 text-sm">
                        {stateFilter ? `No leads in "${stateFilter}".` : "No calls available in this category."}
                      </p>
                      {stateFilter && (
                        <button onClick={() => setStateFilter("")}
                          className="mt-4 h-10 px-5 rounded-2xl bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold hover:bg-[#fce8ec] transition-colors">
                          Clear state filter
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
        {showImportantModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-[26px] font-bold text-[#0F172A]">Important Call</h2><p className="text-gray-500 text-sm mt-2">Schedule next follow-up call with timezone.</p></div>
                <button onClick={() => setShowImportantModal(false)} className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500"><X size={18}/></button>
              </div>
              <div className="mt-7">
                <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><Calendar size={16}/>Next Schedule Date</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"/>
              </div>
              <div className="mt-5">
                <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><Clock3 size={16}/>Next Call Time</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D]"/>
              </div>
              <div className="mt-5 relative">
                <label className="text-sm font-semibold text-[#0F172A] flex items-center gap-2"><Globe size={16}/>Client Timezone (US)</label>
                <select value={selectedTimezone} onChange={e => setSelectedTimezone(e.target.value)}
                  className="mt-3 w-full h-[52px] rounded-2xl border border-gray-200 px-4 pr-10 outline-none appearance-none bg-white focus:border-[#B8112D] text-[14px]">
                  {usTimezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
                <div className="absolute right-4 top-[46px] pointer-events-none text-gray-400"><ChevronDown size={18}/></div>
              </div>
              {scheduleDate && scheduleTime && (
                <div className="mt-5 p-4 bg-[#F5F6FA] rounded-2xl">
                  <p className="text-[12px] font-medium text-gray-500 mb-2">Scheduled (Client Local Time)</p>
                  <p className="text-[15px] font-semibold text-[#0F172A]">{scheduleDate} at {scheduleTime} {usTimezones.find(tz => tz.value === selectedTimezone)?.abbreviation}</p>
                  <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1"><Globe size={11}/>Current: <span className="font-mono font-medium text-gray-600 ml-1">{getCurrentTimeInTimezone(selectedTimezone)}</span></p>
                </div>
              )}
              <div className="flex gap-3 mt-7">
                <button onClick={() => setShowImportantModal(false)} className="flex-1 h-[52px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Cancel</button>
                <button onClick={saveImportantCall} className="flex-1 h-[52px] rounded-2xl bg-[#B8112D] text-white font-semibold shadow-sm">Schedule Call</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ INTERESTED MODAL ══ */}
        {showInterestedModal && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-[26px] font-bold text-[#0F172A]">Client Interested In</h2><p className="text-gray-500 text-sm mt-2">Select the service the client is interested in.</p></div>
                <button onClick={() => { setShowInterestedModal(false); setSelectedService(""); }} className="w-10 h-10 rounded-2xl bg-[#F5F6FA] flex items-center justify-center text-gray-500"><X size={18}/></button>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {serviceOptions.map(({ value, label, Icon }) => {
                  const sel = selectedService === value;
                  return (
                    <button key={value} onClick={() => setSelectedService(value)}
                      className={`h-[84px] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all font-semibold text-[14px] ${sel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D] shadow-sm" : "border-gray-100 bg-[#FAFAFA] text-[#0F172A] hover:border-gray-300"}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}><Icon size={18} className={sel ? "text-[#B8112D]" : "text-gray-500"}/></div>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedService && (
                <div className="mt-5 p-4 bg-[#FFF4E5] rounded-2xl flex items-center gap-3">
                  <Briefcase size={18} className="text-[#D97706] shrink-0"/>
                  <div><p className="text-[12px] font-medium text-gray-500">Selected Service</p><p className="text-[15px] font-bold text-[#D97706]">{selectedService}</p></div>
                </div>
              )}
              <div className="flex gap-3 mt-7">
                <button onClick={() => { setShowInterestedModal(false); setSelectedService(""); }} className="flex-1 h-[52px] rounded-2xl bg-[#F5F6FA] font-semibold text-gray-600">Cancel</button>
                <button onClick={saveInterestedCall} disabled={!selectedService}
                  className={`flex-1 h-[52px] rounded-2xl font-semibold text-white transition-all ${selectedService ? "bg-[#B8112D]" : "bg-gray-300 cursor-not-allowed"}`}>Save Interest</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ CLOSE CLIENT MODAL ══ */}
        {showProjectWonModal && selectedProjectLead && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-[540px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight:"92vh" }}>

              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none"/>
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none"/>
                <button onClick={() => setShowProjectWonModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={15}/>
                </button>
                <div className="flex items-center gap-3 pr-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-bold shrink-0">
                    {selectedProjectLead.client.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate">Close Client</h2>
                    <p className="text-white/65 text-xs mt-0.5 truncate">
                      {selectedProjectLead.client}
                      {selectedProjectLead.company && selectedProjectLead.company !== selectedProjectLead.client ? ` · ${selectedProjectLead.company}` : ""}
                      {selectedProjectLead.phone ? ` · ${selectedProjectLead.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-green-500/25 text-green-100 border border-green-400/30 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                    <CircleCheckBig size={10}/> Fill in project details to confirm
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-5 sm:px-6 py-5 space-y-5">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><FileText size={11} className="text-[#B8112D]"/>Project Title <span className="text-[#B8112D] normal-case">*required</span></label>
                    <input type="text" placeholder="e.g. BIM Modeling Phase 1" value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
                      className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"/>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Briefcase size={11} className="text-[#B8112D]"/>Service to Provide <span className="text-[#B8112D] normal-case">*required</span></label>
                    <div className="grid grid-cols-3 gap-2">
                      {serviceOptions.map(({ value, label, Icon }) => {
                        const sel = projectService === value;
                        return (
                          <button key={value} onClick={() => setProjectService(value)}
                            className={`relative py-3 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-[11px] font-semibold ${sel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"}`}>
                            {sel && <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-[#B8112D] rounded-full flex items-center justify-center"><CircleCheckBig size={9} className="text-white"/></span>}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${sel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}><Icon size={15} className={sel ? "text-[#B8112D]" : "text-gray-400"}/></div>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><CalendarDays size={11} className="text-[#B8112D]"/>Deadline <span className="text-[#B8112D] normal-case">*required</span></label>
                      <input type="date" value={projectDeadline} onChange={e => setProjectDeadline(e.target.value)}
                        className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors"/>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><DollarSign size={11} className="text-[#B8112D]"/>Budget <span className="text-gray-300 normal-case">(optional)</span></label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="text" placeholder="0.00" value={projectBudget.replace(/^\$/, "")} onChange={e => setProjectBudget(e.target.value)}
                          className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] pl-7 pr-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300"/>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2"><AlignLeft size={11} className="text-[#B8112D]"/>Notes <span className="text-gray-300 normal-case">(optional)</span></label>
                    <textarea placeholder="Any additional notes..." value={projectNotes} onChange={e => setProjectNotes(e.target.value)} rows={3}
                      className="w-full rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"/>
                  </div>

                  <div className="flex gap-3 pb-1">
                    <button onClick={() => setShowProjectWonModal(false)} className="flex-1 h-12 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Cancel</button>
                    <button onClick={saveProjectWon} disabled={!projectWonValid}
                      className={`flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${projectWonValid ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"}`}>
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
              name: viewingLead.client,
              company: viewingLead.company !== "N/A" ? viewingLead.company : undefined,
              phone: viewingLead.phone !== "N/A" ? viewingLead.phone : undefined,
              email: viewingLead.email !== "N/A" ? viewingLead.email : undefined,
              state: viewingLead.state || undefined,
              status: viewingLead.status,
              interestedService: viewingLead.interestedService,
              followUpNotes: viewingLead.followUpNotes,
              nextSchedule: viewingLead.nextSchedule || undefined,
              nextTime: viewingLead.nextTime || undefined,
              timezone: viewingLead.timezone || undefined,
            }}
            onClose={() => setViewingLead(null)}
            onSaved={(id, updates) => {
              const merged: Partial<LeadType> = {};
              if (updates.name  !== undefined) merged.client = updates.name.trim()  || "Unknown";
              if (updates.phone !== undefined) merged.phone  = updates.phone.trim() || "N/A";
              if (updates.email !== undefined) merged.email  = updates.email.trim() || "N/A";
              if (updates.state !== undefined) merged.state  = updates.state.trim();
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
