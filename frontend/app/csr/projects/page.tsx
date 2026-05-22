"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FolderKanban,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Clock3,
  Search,
  Filter,
  Activity,
  Phone,
  AlignLeft,
  Briefcase,
} from "lucide-react";

import CSRNavbar from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";

type ProjectType = {
  id: string;
  projectTitle: string;
  client: string;
  company: string;
  status: string;
  deadline: string;
  budget: string;
  budgetNum: number;
  notes: string;
  service: string;
  timezone: string;
  phone: string;
  liveStatus: string;
};
type LeadType = {
  id?: string | number;

  status: string;

  name?: string;
  customerName?: string;

  company?: string;

  projectTitle?: string;
  project_title?: string;
  ProjectTitle?: string;
  title?: string;

  projectName?: string;
  project_name?: string;

  projectDeadline?: string;
  project_deadline?: string;
  ProjectDeadline?: string;
  deadline?: string;
  nextSchedule?: string;

  projectBudget?: string | number;
  project_budget?: string | number;
  ProjectBudget?: string | number;
  budget?: string | number;

  projectNotes?: string;
  project_notes?: string;
  ProjectNotes?: string;
  notes?: string;
  followUpNotes?: string;

  interestedService?: string;
  interested_service?: string;
  service?: string;
  serviceInterested?: string;
  serviceName?: string;
  services?: string;

  timezone?: string;
  phone?: string;

  createdAt?: string;
};
// Parse budget string like "$5,000" → 5000
const parseBudget = (raw: string | number | null | undefined): number => {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export default function CSRProjectsPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectType[]>([]);

  /* ================= FETCH ================= */
  const fetchProjects = async () => {
    try {
      const res = await API.get("/csr/dashboard");

      // Uncomment to find the exact field names your backend sends:
      // const sample = res.data.leads.find((l: any) => l.status === "project won");
      // console.log("PROJECT WON SAMPLE:", JSON.stringify(sample, null, 2));

      const formatted = res.data.leads
       .filter((lead: LeadType) => lead.status === "project won")
        .map((lead: LeadType, index: number) => {

          // ── Project Title ──────────────────────────────────────────
          // Try every name the backend might use
          const projectTitle =
            lead.projectTitle ??
            lead.project_title ??
            lead.ProjectTitle ??
            lead.title ??
            lead.projectName ??
            lead.project_name ??
            lead.name ??
            "Untitled Project";

          // ── Deadline ───────────────────────────────────────────────
          const deadline =
            lead.projectDeadline ??
            lead.project_deadline ??
            lead.ProjectDeadline ??
            lead.deadline ??
            lead.nextSchedule ??
            "N/A";

          // ── Budget ─────────────────────────────────────────────────
          const budget =
            lead.projectBudget ??
            lead.project_budget ??
            lead.ProjectBudget ??
            lead.budget ??
            "";

          // ── Notes ──────────────────────────────────────────────────
          const notes =
            lead.projectNotes ??
            lead.project_notes ??
            lead.ProjectNotes ??
            lead.notes ??
            lead.followUpNotes ??
            "";

          // ── Service ────────────────────────────────────────────────
          const service =
            lead.interestedService ??
            lead.interested_service ??
            lead.service ??
            lead.serviceInterested ??
            lead.serviceName ??
            lead.services ??
            "N/A";

          return {
            id: String(lead.id),
            projectTitle: String(projectTitle),
            client: String(lead.name || "Unknown"),
            company: String(lead.company || "N/A"),
            status: "In Progress",
            deadline: String(deadline),
            budget: String(budget),
            budgetNum: parseBudget(budget),
            notes: String(notes),
            service: String(service),
            timezone: String(lead.timezone || "N/A"),
            phone: String(lead.phone || "N/A"),
            liveStatus: index % 2 === 0 ? "Running" : "Idle",
          };
        });

      setProjects(formatted);
    } catch (error) {
      console.log(error);
    }
  };

  /* ================= REAL TIME liveStatus toggle only ================= */
  useEffect(() => {
  const loadProjects = async () => {
    await fetchProjects();
  };

  loadProjects();

  const interval = setInterval(() => {
      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          liveStatus: Math.random() > 0.5 ? "Running" : "Idle",
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  /* ================= FILTER ================= */
  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((project) => {
      const matchesDate = selectedDate
        ? project.deadline === selectedDate
        : true;
      const matchesSearch =
        (project.projectTitle ?? "").toLowerCase().includes(q) ||
        (project.client ?? "").toLowerCase().includes(q) ||
        (project.company ?? "").toLowerCase().includes(q);
      return matchesDate && matchesSearch;
    });
  }, [selectedDate, search, projects]);

  /* ================= STATS ================= */
  const totalProjects = projects.length;
  const runningCount = projects.filter((p) => p.liveStatus === "Running").length;
  const allTimeSales = projects.reduce((acc, p) => acc + p.budgetNum, 0);
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = projects
    .filter((p) => p.deadline === todayStr)
    .reduce((acc, p) => acc + p.budgetNum, 0);

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen} />

        {/* HEADER */}
        <div className="mt-7">
          <h1 className="text-[30px] sm:text-[36px] font-bold text-[#0F172A]">
            Projects Dashboard
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Real-time CSR project tracking.</p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-7">
          <div className="bg-white rounded-[28px] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Projects</p>
                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">{totalProjects}</h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <FolderKanban size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[28px] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">All Time Sales</p>
                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  {allTimeSales > 0 ? `$${allTimeSales.toLocaleString()}` : "N/A"}
                </h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <DollarSign size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[28px] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Running</p>
                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">{runningCount}</h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <Activity size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[28px] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Today Sales</p>
                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  {todaySales > 0 ? `$${todaySales.toLocaleString()}` : "N/A"}
                </h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white rounded-[30px] shadow-sm p-5 mt-7">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="relative w-full xl:max-w-[380px]">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by project title or client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-[52px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-11 pr-4 text-sm outline-none focus:border-[#B8112D]"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[#B8112D] font-semibold text-sm">
                <Filter size={16} />
                Filter by Deadline
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-[50px] rounded-2xl border border-gray-200 px-4 bg-[#FAFAFA] text-sm outline-none focus:border-[#B8112D]"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate("")}
                  className="h-[50px] px-4 rounded-2xl border border-gray-200 bg-[#FAFAFA] text-sm text-gray-500 hover:text-[#B8112D] transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PROJECTS GRID */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-7">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-[30px] shadow-sm p-6 border border-white"
              >
                {/* TOP */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                      <FolderKanban size={24} />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-[#0F172A] leading-snug">
                        {project.projectTitle}
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">
                        {project.client}
                        {project.company !== "N/A" && project.company !== project.client
                          ? ` · ${project.company}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {/* LIVE STATUS badge — no progress bar */}
                  <div
                    className={`px-4 py-2 rounded-2xl text-xs font-semibold shrink-0 ${
                      project.liveStatus === "Running"
                        ? "bg-[#ECFDF3] text-[#027A48]"
                        : "bg-[#F4F4F5] text-[#52525B]"
                    }`}
                  >
                    {project.liveStatus === "Running" ? "🟢 Running" : "⏸ Idle"}
                  </div>
                </div>

                {/* DETAILS GRID */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  {/* SERVICE */}
                  <div className="bg-[#FAFAFA] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase size={14} className="text-[#B8112D]" />
                      <p className="text-gray-500 text-sm">Service</p>
                    </div>
                    <h4 className="font-semibold text-[#0F172A] text-[14px]">
                      {project.service}
                    </h4>
                  </div>

                  {/* DEADLINE */}
                  <div className="bg-[#FAFAFA] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock3 size={14} className="text-[#B8112D]" />
                      <p className="text-gray-500 text-sm">Deadline</p>
                    </div>
                    <h4 className="font-semibold text-[#0F172A] text-[14px]">
                      {project.deadline}
                    </h4>
                  </div>

                  {/* CONTACT */}
                  <div className="bg-[#FAFAFA] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone size={14} className="text-[#B8112D]" />
                      <p className="text-gray-500 text-sm">Contact</p>
                    </div>
                    <h4 className="font-semibold text-[#0F172A] text-[14px]">
                      {project.phone}
                    </h4>
                  </div>

                  {/* BUDGET */}
                  <div className="bg-[#FAFAFA] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign size={14} className="text-[#B8112D]" />
                      <p className="text-gray-500 text-sm">Budget</p>
                    </div>
                    <h4 className="font-semibold text-[#0F172A] text-[14px]">
                      {project.budget || "Not set"}
                    </h4>
                  </div>
                </div>

                {/* NOTES — only if present */}
                {project.notes && project.notes !== "undefined" && (
                  <div className="mt-4 bg-[#FAFAFA] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlignLeft size={14} className="text-[#B8112D]" />
                      <p className="text-gray-500 text-sm">Project Notes</p>
                    </div>
                    <p className="text-[#0F172A] text-[14px] leading-relaxed">
                      {project.notes}
                    </p>
                  </div>
                )}

                {/* FOOTER */}
                <div className="flex items-center justify-between mt-5 pt-5 border-t border-[#F3F3F3]">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-gray-400" />
                    <span className="text-gray-500 text-sm">
                      Timezone:{" "}
                      <strong className="text-[#0F172A]">{project.timezone}</strong>
                    </span>
                  </div>

                  <div className="bg-[#FFF7E6] text-[#B54708] px-4 py-2 rounded-2xl text-xs font-semibold">
                    In Progress
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[30px] shadow-sm p-16 mt-7 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center mx-auto mb-5">
              <FolderKanban size={28} />
            </div>
            <h2 className="text-[22px] font-bold text-[#0F172A]">No Projects Yet</h2>
            <p className="text-gray-500 mt-2 text-sm">
              Projects will appear here once a client is marked as &quot;Project Won&quot;.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}