"use client";

import { useState, useEffect } from "react";
import {
  User2, Mail, Phone, MapPin, CalendarDays, FolderKanban,
  CircleCheckBig, Clock3, DollarSign, Activity,
  BadgeCheck, AlertTriangle, Briefcase,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";

/* ── Types ── */
interface BackendLead {
  id: string;
  name?: string;
  company?: string;
  status?: string;
  projectTitle?: string;
  project_title?: string;
  projectBudget?: string | number;
  project_budget?: string | number;
  interestedService?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface UserProfile {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  createdAt?: string;
  isActive?: boolean;
}

type ProjectLead = {
  id: string;
  title: string;
  client: string;
  budget: string;
  service: string;
};

type ActivityItem = {
  id: string;
  title: string;
  sub: string;
  time: string;
  type: string;
};

/* ── Helpers ── */
const formatTimeAgo = (date: Date): string => {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60) return `${mins} min${mins  !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days  < 7)  return `${days} day${days  !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
};

const formatDate = (iso?: string): string => {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const activityIcon = (type: string) => {
  if (type === "completed")   return <CircleCheckBig size={18}/>;
  if (type === "important")   return <AlertTriangle  size={18}/>;
  if (type === "Close Client") return <FolderKanban   size={18}/>;
  if (type === "interested")  return <Briefcase      size={18}/>;
  return <Clock3 size={18}/>;
};

const activityColor = (type: string): string => {
  if (type === "completed")   return "bg-[#ECFDF3] text-[#027A48]";
  if (type === "important")   return "bg-[#FFF1F3] text-[#B8112D]";
  if (type === "Close Client") return "bg-[#ECFDF5] text-[#065F46]";
  if (type === "interested")  return "bg-[#FFF4E5] text-[#D97706]";
  return "bg-[#FFF1F3] text-[#B8112D]";
};

const statusLabel: Record<string, string> = {
  completed:       "Marked as Completed",
  pending:         "Link is Pending",
  important:       "Marked as Important",
  interested:      "Client Interested",
  "Close Client":   "Close Client 🎉",
  "not completed": "Marked Not Completed",
  closed:          "Client Closed",
};
function Skeleton({
  w = "w-24",
}: {
  w?: string;
}) {
  return (
    <div
      className={`h-4 ${w} bg-gray-100 rounded animate-pulse`}
    />
  );
}

export default function CSRProfilePage() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading,   setLoading]   = useState(true);

  const [profile,        setProfile]        = useState<UserProfile | null>(null);
  const [totalLeads,     setTotalLeads]     = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount,   setPendingCount]   = useState(0);
  const [importantCount, setImportantCount] = useState(0);
  const [projectWonCount,setProjectWonCount]= useState(0);
  const [projects,       setProjects]       = useState<ProjectLead[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        /* Profile */
        try {
          const r = await API.get("/user/profile");
          setProfile(r.data.user ?? r.data);
        } catch {
          try {
            const r = await API.get("/auth/me");
            setProfile(r.data.user ?? r.data);
          } catch { /* no profile endpoint */ }
        }

        /* Leads */
        const dash = await API.get("/csr/dashboard");
        const leads: BackendLead[] = dash.data.leads ?? [];

        setTotalLeads(leads.length);
        setCompletedCount(leads.filter(l => l.status === "completed").length);
        setPendingCount(leads.filter(l => l.status === "pending").length);
        setImportantCount(leads.filter(l => l.status === "important").length);
        setProjectWonCount(leads.filter(l => l.status === "Close Client").length);

        setProjects(
          leads.filter(l => l.status === "Close Client").map(l => ({
            id:      l.id,
            title:   l.projectTitle ?? l.project_title ?? l.company ?? "Untitled",
            client:  l.name ?? "Unknown",
            budget:  String(l.projectBudget ?? l.project_budget ?? "N/A"),
            service: l.interestedService ?? "N/A",
          }))
        );

        setRecentActivity(
          [...leads]
            .sort((a, b) =>
              new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
              new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
            )
            .slice(0, 5)
            .map(l => ({
              id:    l.id,
              title: `${l.name ?? "Client"} — ${statusLabel[l.status ?? ""] ?? l.status ?? "Updated"}`,
              sub:   l.company ?? "N/A",
              time:  l.updatedAt ?? l.createdAt
                ? formatTimeAgo(new Date(l.updatedAt ?? l.createdAt ?? ""))
                : "Recently",
              type:  l.status ?? "pending",
            }))
        );
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const nameInitial = profile?.name?.charAt(0)?.toUpperCase() ?? "C";

  const statCards = [
    { label:"Total Leads",             value: totalLeads,                    bg:"bg-[#FFF1F3]", color:"text-[#B8112D]", icon:<FolderKanban   size={24}/> },
    { label:"Completed",               value: completedCount,                bg:"bg-[#ECFDF3]", color:"text-[#027A48]", icon:<CircleCheckBig size={24}/> },
    { label:"Close Client",             value: projectWonCount,               bg:"bg-[#ECFDF5]", color:"text-[#065F46]", icon:<DollarSign     size={24}/> },
    { label:"Active (Pending + Imp.)", value: pendingCount + importantCount, bg:"bg-[#FFF7E6]", color:"text-[#B54708]", icon:<Activity       size={24}/> },
  ];

  const breakdownItems = [
    { label:"Completed",   value: completedCount,  color:"bg-[#027A48]" },
    { label:"Pending",     value: pendingCount,    color:"bg-[#B54708]" },
    { label:"Important",   value: importantCount,  color:"bg-[#B8112D]" },
    { label:"Close Client", value: projectWonCount, color:"bg-[#065F46]" },
  ];

  const personalDetails = [
    { label:"Full Name",   value: profile?.name,             Icon: User2       },
    { label:"Email",       value: profile?.email,            Icon: Mail        },
    { label:"Phone",       value: profile?.phone,            Icon: Phone       },
    { label:"Location",    value: profile?.location,         Icon: MapPin      },
    { label:"Joined Date", value: formatDate(profile?.createdAt), Icon: CalendarDays },
  ].filter(item => item.value && item.value !== "N/A");


  

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>

      <main className="flex-1 p-4 sm:p-5 pt-23.75 overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* ── PROFILE HEADER ── */}
        <div className="mt-7 bg-white rounded-4xl overflow-hidden shadow-sm border border-white">
          {/* Cover */}
          <div className="h-37.5 bg-linear-to-r from-[#B8112D] via-[#8D1028] to-[#650B1C]"/>

          {/* Content */}
          <div className="px-6 sm:px-8 pb-8 relative">
            {/* Avatar */}
            <div className="absolute -top-13.75 w-27.5 h-27.5 rounded-[30px] bg-white p-2 shadow-xl">
              <div className="w-full h-full rounded-3xl bg-[#B8112D] text-white flex items-center justify-center text-[38px] font-bold">
                {loading ? "…" : nameInitial}
              </div>
            </div>

            {/* Info */}
            <div className="pt-[70px]">
              <div className="flex flex-wrap items-center gap-3">
                {loading ? <Skeleton w="w-48" /> : <h1>Profile</h1>}
                <div className="px-4 py-2 rounded-2xl bg-[#ECFDF3] text-[#027A48] text-sm font-semibold flex items-center gap-2">
                  <BadgeCheck size={16}/>
                  {profile?.isActive === false ? "Inactive" : "Active"}
                </div>
              </div>
              <p className="text-gray-500 mt-2">CSR Executive</p>

              <div className="flex flex-wrap items-center gap-5 mt-5">
                {profile?.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={16}/>{profile.email}
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={16}/>{profile.phone}
                  </div>
                )}
                {profile?.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={16}/>{profile.location}
                  </div>
                )}
                {profile?.createdAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarDays size={16}/>Joined {formatDate(profile.createdAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          {statCards.map((c, i) => (
            <div key={i} className="bg-white rounded-[28px] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[12px] font-medium">{c.label}</p>
                  {loading
                    ? <div className="h-8 w-12 bg-gray-100 rounded-lg mt-2 animate-pulse"/>
                    : <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">{c.value}</h2>
                  }
                </div>
                <div className={`w-14 h-14 rounded-2xl ${c.bg} ${c.color} flex items-center justify-center`}>
                  {c.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div className="flex flex-wrap gap-3 mt-7">
          {["overview", "projects", "activity"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`h-12 px-5 rounded-2xl text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20"
              }`}>
              {tab}
              {tab === "projects" && projectWonCount > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-lg text-[11px]">{projectWonCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-7">
            {/* Left */}
            <div className="xl:col-span-4 space-y-5">
              {/* Personal details */}
              <div className="bg-white rounded-[30px] shadow-sm p-6">
                <h3 className="text-[22px] font-bold text-[#0F172A]">Personal Details</h3>
                <div className="space-y-5 mt-6">
                  {loading ? (
                    [1,2,3].map(i => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-gray-100 animate-pulse shrink-0"/>
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-100 rounded w-20 animate-pulse"/>
                          <div className="h-4 bg-gray-100 rounded w-36 animate-pulse"/>
                        </div>
                      </div>
                    ))
                  ) : personalDetails.length > 0 ? personalDetails.map(({ label, value, Icon }) => (
                    <div key={label} className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                        <Icon size={18}/>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">{label}</p>
                        <h4 className="font-semibold text-[#0F172A] mt-0.5">{value}</h4>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-400 text-sm">No profile data available.</p>
                  )}
                </div>
              </div>

              {/* Breakdown bars */}
              <div className="bg-white rounded-[30px] shadow-sm p-6">
                <h3 className="text-[22px] font-bold text-[#0F172A]">Lead Breakdown</h3>
                <div className="space-y-4 mt-6">
                  {breakdownItems.map(({ label, value, color }) => {
                    const pct = totalLeads > 0 ? Math.round((value / totalLeads) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-[#0F172A]">{label}</span>
                          <span className="text-sm font-bold text-gray-500">
                            {loading ? "–" : `${value} (${pct}%)`}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#F1F1F1] overflow-hidden">
                          <div className={`h-full rounded-full ${color} transition-all duration-700`}
                            style={{ width: loading ? "0%" : `${pct}%` }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right — recent activity */}
            <div className="xl:col-span-8 bg-white rounded-[30px] shadow-sm p-6">
              <h3 className="text-[24px] font-bold text-[#0F172A]">Recent Activity</h3>
              <p className="text-gray-500 text-sm mt-1">Latest lead updates.</p>
              <div className="space-y-4 mt-7">
                {loading ? (
                  [1,2,3,4].map(i => (
                    <div key={i} className="bg-[#FAFAFA] rounded-3xl p-5 flex items-center gap-4 animate-pulse">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 shrink-0"/>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-52"/>
                        <div className="h-3 bg-gray-100 rounded w-28"/>
                      </div>
                    </div>
                  ))
                ) : recentActivity.length > 0 ? recentActivity.map(item => (
                  <div key={item.id} className="flex items-start gap-4 bg-[#FAFAFA] rounded-3xl p-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${activityColor(item.type)}`}>
                      {activityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[#0F172A] text-[14px] truncate">{item.title}</h4>
                      <p className="text-gray-500 text-sm mt-1">{item.sub}</p>
                    </div>
                    <span className="text-[12px] text-gray-400 shrink-0 mt-1">{item.time}</span>
                  </div>
                )) : (
                  <div className="text-center py-12 text-gray-400">
                    <Clock3 size={32} className="mx-auto mb-3 text-gray-200"/>
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PROJECTS TAB ── */}
        {activeTab === "projects" && (
          <div className="mt-7">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white rounded-[30px] shadow-sm p-6 animate-pulse">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 mb-5"/>
                    <div className="h-5 bg-gray-100 rounded w-40 mb-3"/>
                    <div className="h-4 bg-gray-100 rounded w-24"/>
                  </div>
                ))}
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {projects.map(project => (
                  <div key={project.id} className="bg-white rounded-[30px] shadow-sm p-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <FolderKanban size={24}/>
                    </div>
                    <h3 className="text-[20px] font-bold text-[#0F172A] mt-5 leading-snug">{project.title}</h3>
                    <p className="text-gray-500 text-sm mt-1">{project.client}</p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {project.service !== "N/A" && (
                        <span className="bg-[#FFF4E5] text-[#D97706] px-3 py-1 rounded-xl text-[12px] font-semibold">{project.service}</span>
                      )}
                      {project.budget !== "N/A" && (
                        <span className="bg-[#ECFDF5] text-[#065F46] px-3 py-1 rounded-xl text-[12px] font-semibold">{project.budget}</span>
                      )}
                      <span className="bg-[#ECFDF3] text-[#027A48] px-3 py-1 rounded-xl text-[12px] font-semibold">Won ✓</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[30px] shadow-sm p-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-5">
                  <FolderKanban size={28}/>
                </div>
                <h2 className="text-[22px] font-bold text-[#0F172A]">No Projects Yet</h2>
                <p className="text-gray-500 mt-2 text-sm">Projects appear once a client is marked as &quot;Close Client&quot;.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === "activity" && (
          <div className="bg-white rounded-[30px] shadow-sm p-6 mt-7">
            <h3 className="text-[26px] font-bold text-[#0F172A]">All Recent Activity</h3>
            <p className="text-gray-500 text-sm mt-1">Last 5 lead updates.</p>
            <div className="space-y-4 mt-7">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-start gap-4 bg-[#FAFAFA] rounded-3xl p-5 animate-pulse">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 shrink-0"/>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-56"/>
                      <div className="h-3 bg-gray-100 rounded w-32"/>
                    </div>
                  </div>
                ))
              ) : recentActivity.length > 0 ? recentActivity.map(item => (
                <div key={item.id} className="flex items-start gap-4 bg-[#FAFAFA] rounded-3xl p-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${activityColor(item.type)}`}>
                    {activityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#0F172A] text-[14px]">{item.title}</h4>
                    <p className="text-gray-500 text-sm mt-1">{item.sub}</p>
                  </div>
                  <span className="text-[12px] text-gray-400 shrink-0 mt-1">{item.time}</span>
                </div>
              )) : (
                <div className="text-center py-12 text-gray-400">
                  <Clock3 size={32} className="mx-auto mb-3 text-gray-200"/>
                  <p>No activity found</p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}