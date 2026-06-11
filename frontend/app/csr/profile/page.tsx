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
  id: string; name?: string; company?: string; status?: string;
  projectTitle?: string; project_title?: string;
  projectBudget?: string | number; project_budget?: string | number;
  interestedService?: string; updatedAt?: string; createdAt?: string;
}

interface UserProfile {
  id?: string; name?: string; email?: string; phone?: string;
  location?: string; createdAt?: string; isActive?: boolean;
}

type ProjectLead = { id: string; title: string; client: string; budget: string; service: string; };
type ActivityItem = { id: string; title: string; sub: string; time: string; type: string; };

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
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const activityIcon = (type: string) => {
  if (type === "completed")    return <CircleCheckBig size={16} className="sm:w-[18px] sm:h-[18px]" />;
  if (type === "important")    return <AlertTriangle  size={16} className="sm:w-[18px] sm:h-[18px]" />;
  if (type === "Close Client") return <FolderKanban   size={16} className="sm:w-[18px] sm:h-[18px]" />;
  if (type === "interested")   return <Briefcase      size={16} className="sm:w-[18px] sm:h-[18px]" />;
  return <Clock3 size={16} className="sm:w-[18px] sm:h-[18px]" />;
};

const activityColor = (type: string): string => {
  if (type === "completed")    return "bg-[#ECFDF3] text-[#027A48]";
  if (type === "important")    return "bg-[#FFF1F3] text-[#B8112D]";
  if (type === "Close Client") return "bg-[#ECFDF5] text-[#065F46]";
  if (type === "interested")   return "bg-[#FFF4E5] text-[#D97706]";
  return "bg-[#FFF1F3] text-[#B8112D]";
};

const statusLabel: Record<string, string> = {
  completed:        "Marked as Completed",
  pending:          "Link is Pending",
  important:        "Marked as Important",
  interested:       "Client Interested",
  "Close Client":   "Close Client 🎉",
  "not completed":  "Marked Not Completed",
  closed:           "Client Closed",
};

function Skeleton({ w = "w-24" }: { w?: string }) {
  return <div className={`h-4 ${w} bg-gray-100 rounded animate-pulse`} />;
}

export default function CSRProfilePage() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading,   setLoading]   = useState(true);

  const [profile,         setProfile]         = useState<UserProfile | null>(null);
  const [totalLeads,      setTotalLeads]       = useState(0);
  const [completedCount,  setCompletedCount]   = useState(0);
  const [pendingCount,    setPendingCount]     = useState(0);
  const [importantCount,  setImportantCount]   = useState(0);
  const [projectWonCount, setProjectWonCount]  = useState(0);
  const [projects,        setProjects]         = useState<ProjectLead[]>([]);
  const [recentActivity,  setRecentActivity]   = useState<ActivityItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        try {
          const r = await API.get("/user/profile");
          setProfile(r.data.user ?? r.data);
        } catch {
          try {
            const r = await API.get("/auth/me");
            setProfile(r.data.user ?? r.data);
          } catch { /* no profile endpoint */ }
        }

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
    { label: "Total Leads",              value: totalLeads,                    bg: "bg-[#FFF1F3]", color: "text-[#B8112D]", icon: <FolderKanban   size={20} className="sm:w-6 sm:h-6" /> },
    { label: "Completed",                value: completedCount,                bg: "bg-[#ECFDF3]", color: "text-[#027A48]", icon: <CircleCheckBig size={20} className="sm:w-6 sm:h-6" /> },
    { label: "Close Client",             value: projectWonCount,               bg: "bg-[#ECFDF5]", color: "text-[#065F46]", icon: <DollarSign     size={20} className="sm:w-6 sm:h-6" /> },
    { label: "Active (Pending + Imp.)",  value: pendingCount + importantCount, bg: "bg-[#FFF7E6]", color: "text-[#B54708]", icon: <Activity       size={20} className="sm:w-6 sm:h-6" /> },
  ];

  const breakdownItems = [
    { label: "Completed",    value: completedCount,  color: "bg-[#027A48]" },
    { label: "Pending",      value: pendingCount,    color: "bg-[#B54708]" },
    { label: "Important",    value: importantCount,  color: "bg-[#B8112D]" },
    { label: "Close Client", value: projectWonCount, color: "bg-[#065F46]" },
  ];

  const personalDetails = [
    { label: "Full Name",   value: profile?.name,             Icon: User2       },
    { label: "Email",       value: profile?.email,            Icon: Mail        },
    { label: "Phone",       value: profile?.phone,            Icon: Phone       },
    { label: "Location",    value: profile?.location,         Icon: MapPin      },
    { label: "Joined Date", value: formatDate(profile?.createdAt), Icon: CalendarDays },
  ].filter(item => item.value && item.value !== "N/A");

  /* ── Shared activity list renderer ── */
  const ActivityList = ({ items, skeletonCount = 4 }: { items: ActivityItem[]; skeletonCount?: number }) => (
    <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-7">
      {loading ? (
        Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="bg-[#FAFAFA] rounded-2xl sm:rounded-3xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 animate-pulse">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-1.5 sm:space-y-2">
              <div className="h-3.5 sm:h-4 bg-gray-100 rounded w-48 sm:w-52" />
              <div className="h-3 bg-gray-100 rounded w-24 sm:w-28" />
            </div>
          </div>
        ))
      ) : items.length > 0 ? items.map(item => (
        <div key={item.id} className="flex items-start gap-3 sm:gap-4 bg-[#FAFAFA] rounded-2xl sm:rounded-3xl p-3 sm:p-5">
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${activityColor(item.type)}`}>
            {activityIcon(item.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[#0F172A] text-[13px] sm:text-[14px] truncate">{item.title}</h4>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{item.sub}</p>
          </div>
          <span className="text-[11px] sm:text-[12px] text-gray-400 shrink-0 mt-0.5 sm:mt-1 whitespace-nowrap">{item.time}</span>
        </div>
      )) : (
        <div className="text-center py-8 sm:py-12 text-gray-400">
          <Clock3 size={28} className="mx-auto mb-2 sm:mb-3 text-gray-200 sm:w-8 sm:h-8" />
          <p className="text-xs sm:text-sm">No recent activity</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 pt-[88px] sm:pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen} />

        {/* ── PROFILE HEADER CARD ── */}
        <div className="mt-4 sm:mt-7 bg-white rounded-2xl sm:rounded-3xl lg:rounded-[32px] overflow-hidden shadow-sm border border-white">
          {/* Cover gradient */}
          <div className="h-24 sm:h-28 lg:h-[150px] bg-gradient-to-r from-[#B8112D] via-[#8D1028] to-[#650B1C]" />

          {/* Content */}
          <div className="px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6 lg:pb-8 relative">
            {/* Avatar — overlaps the cover */}
            <div className="absolute -top-8 sm:-top-10 lg:-top-14 w-16 h-16 sm:w-20 sm:h-20 lg:w-[110px] lg:h-[110px] rounded-2xl sm:rounded-[24px] lg:rounded-[30px] bg-white p-1.5 sm:p-2 shadow-xl">
              <div className="w-full h-full rounded-xl sm:rounded-2xl lg:rounded-3xl bg-[#B8112D] text-white flex items-center justify-center text-2xl sm:text-3xl lg:text-[38px] font-bold">
                {loading ? "…" : nameInitial}
              </div>
            </div>

            {/* Name + status badge */}
            <div className="pt-10 sm:pt-12 lg:pt-[70px]">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {loading ? (
                  <Skeleton w="w-36 sm:w-48" />
                ) : (
                  <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A]">Profile</h1>
                )}
                <div className="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl bg-[#ECFDF3] text-[#027A48] text-[11px] sm:text-sm font-semibold flex items-center gap-1.5">
                  <BadgeCheck size={13} className="sm:w-4 sm:h-4" />
                  {profile?.isActive === false ? "Inactive" : "Active"}
                </div>
              </div>
              <p className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-sm">CSR Executive</p>

              {/* Contact info row — wraps on mobile */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-5 mt-3 sm:mt-5">
                {profile?.email && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <Mail size={13} className="sm:w-4 sm:h-4 shrink-0" /><span className="truncate max-w-[180px] sm:max-w-none">{profile.email}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <Phone size={13} className="sm:w-4 sm:h-4 shrink-0" />{profile.phone}
                  </div>
                )}
                {profile?.location && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <MapPin size={13} className="sm:w-4 sm:h-4 shrink-0" />{profile.location}
                  </div>
                )}
                {profile?.createdAt && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <CalendarDays size={13} className="sm:w-4 sm:h-4 shrink-0" />Joined {formatDate(profile.createdAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        {/* 2-col mobile → 2-col sm → 4-col xl */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-7">
          {statCards.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl sm:rounded-[28px] p-3 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] sm:text-[12px] font-medium truncate">{c.label}</p>
                  {loading ? (
                    <div className="h-7 sm:h-8 w-10 sm:w-12 bg-gray-100 rounded-lg mt-1.5 sm:mt-2 animate-pulse" />
                  ) : (
                    <h2 className="text-2xl sm:text-[28px] font-bold text-[#0F172A] mt-1 sm:mt-2">{c.value}</h2>
                  )}
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl ${c.bg} ${c.color} flex items-center justify-center shrink-0`}>
                  {c.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7 overflow-x-auto pb-0.5">
          {["overview", "projects", "activity"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-10 sm:h-12 px-3 sm:px-5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20"
              }`}
            >
              {tab}
              {tab === "projects" && projectWonCount > 0 && (
                <span className="ml-1.5 sm:ml-2 bg-white/20 px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px]">
                  {projectWonCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5 mt-4 sm:mt-7">

            {/* LEFT column — Personal details + Breakdown */}
            <div className="xl:col-span-4 space-y-4 sm:space-y-5">

              {/* Personal details */}
              <div className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-4 sm:p-6">
                <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Personal Details</h3>
                <div className="space-y-3 sm:space-y-5 mt-4 sm:mt-6">
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3 sm:gap-4">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gray-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-100 rounded w-16 sm:w-20 animate-pulse" />
                          <div className="h-4 bg-gray-100 rounded w-28 sm:w-36 animate-pulse" />
                        </div>
                      </div>
                    ))
                  ) : personalDetails.length > 0 ? personalDetails.map(({ label, value, Icon }) => (
                    <div key={label} className="flex items-center gap-3 sm:gap-4">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                        <Icon size={15} className="sm:w-[18px] sm:h-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-500 text-xs sm:text-sm">{label}</p>
                        <h4 className="font-semibold text-[#0F172A] mt-0.5 text-sm truncate">{value}</h4>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-400 text-xs sm:text-sm">No profile data available.</p>
                  )}
                </div>
              </div>

              {/* Lead Breakdown bars */}
              <div className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-4 sm:p-6">
                <h3 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">Lead Breakdown</h3>
                <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
                  {breakdownItems.map(({ label, value, color }) => {
                    const pct = totalLeads > 0 ? Math.round((value / totalLeads) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                          <span className="text-xs sm:text-sm font-medium text-[#0F172A]">{label}</span>
                          <span className="text-xs sm:text-sm font-bold text-gray-500">
                            {loading ? "–" : `${value} (${pct}%)`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#F1F1F1] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color} transition-all duration-700`}
                            style={{ width: loading ? "0%" : `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT column — Recent Activity */}
            <div className="xl:col-span-8 bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-4 sm:p-6">
              <h3 className="text-xl sm:text-[24px] font-bold text-[#0F172A]">Recent Activity</h3>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Latest lead updates.</p>
              <ActivityList items={recentActivity} skeletonCount={4} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            PROJECTS TAB
        ══════════════════════════════════════ */}
        {activeTab === "projects" && (
          <div className="mt-4 sm:mt-7">
            {loading ? (
              /* 1-col mobile → 2-col md → 3-col xl */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-4 sm:p-6 animate-pulse">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gray-100 mb-3 sm:mb-5" />
                    <div className="h-4 sm:h-5 bg-gray-100 rounded w-32 sm:w-40 mb-2 sm:mb-3" />
                    <div className="h-3 sm:h-4 bg-gray-100 rounded w-20 sm:w-24" />
                  </div>
                ))}
              </div>
            ) : projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {projects.map(project => (
                  <div key={project.id} className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-4 sm:p-6">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <FolderKanban size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <h3 className="text-base sm:text-[20px] font-bold text-[#0F172A] mt-3 sm:mt-5 leading-snug">
                      {project.title}
                    </h3>
                    <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{project.client}</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 sm:mt-4">
                      {project.service !== "N/A" && (
                        <span className="bg-[#FFF4E5] text-[#D97706] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl text-[11px] sm:text-[12px] font-semibold">
                          {project.service}
                        </span>
                      )}
                      {project.budget !== "N/A" && (
                        <span className="bg-[#ECFDF5] text-[#065F46] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl text-[11px] sm:text-[12px] font-semibold">
                          {project.budget}
                        </span>
                      )}
                      <span className="bg-[#ECFDF3] text-[#027A48] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-xl text-[11px] sm:text-[12px] font-semibold">
                        Won ✓
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-10 sm:p-12 lg:p-16 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-4 sm:mb-5">
                  <FolderKanban size={24} className="sm:w-7 sm:h-7" />
                </div>
                <h2 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">No Projects Yet</h2>
                <p className="text-gray-500 mt-1.5 sm:mt-2 text-xs sm:text-sm">
                  Projects appear once a client is marked as &quot;Close Client&quot;.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            ACTIVITY TAB
        ══════════════════════════════════════ */}
        {activeTab === "activity" && (
          <div className="bg-white rounded-2xl sm:rounded-[30px] shadow-sm p-4 sm:p-6 mt-4 sm:mt-7">
            <h3 className="text-xl sm:text-[26px] font-bold text-[#0F172A]">All Recent Activity</h3>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Last 5 lead updates.</p>
            <ActivityList items={recentActivity} skeletonCount={5} />
          </div>
        )}
      </main>
    </div>
  );
}