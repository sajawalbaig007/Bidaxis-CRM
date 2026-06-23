"use client";

import { useEffect, useState, useCallback } from "react";
import API from "@/lib/api";
import { CsrColGroup, CSR_TABLE_CLASS, CSR_TH, CSR_TD, COL_8_ADMIN, COL_9_CLOSED, COL_9_SCHEDULE_ADMIN } from "@/app/csr/components/shared/csrTableStyles";
import toast, { Toaster } from "react-hot-toast";
import { formatAdminLead } from "../utils/formatAdminLead";
import { adminLeadStatusBadgeClass, adminLeadStatusLabel } from "../utils/leadStatus";

import {
  Search,
  Plus,
  Building2,
  MoreVertical,
  Eye,
  Trash2,
  ChevronDown,
  LayoutGrid,
  HeartHandshake,
  BadgeCheck,
  Users,
  ChevronUp,
  X,
  CircleAlert,
  CalendarDays,
  ArrowRightLeft,
  Check,
} from "lucide-react";

import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import CommentCell from "../../csr/components/shared/CommentCell";
import LeadDetailModal from "../../csr/components/LeadDetailModal";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip } from "recharts";
import {
  canAdminReassign,
} from "@/app/csr/utils/potentialClientBuckets";

/* ─── TYPES ─── */
type Client = {
  id: string;
  clientName: string;
  email: string;
  contact: string;
  company: string;
  parentCompany: string;
  scope: string;
  lastEmail: string;
  lastCall: string;
  lastComment: string;
  status: string;
  rawStatus: string;
  csr: string;
  csrCode?: string | null;
  clientCode: string | null;
  nextFollowup: string;
  time: string;
  timezone: string;
  isOldClient: boolean;
};

const PAGE_SIZE = 30;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [page,    setPage]    = useState(1);

  const [view, setView] = useState<"all" | "important" | "schedule" | "interested" | "closed">("all");
  const [csrFilter, setCsrFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [showCompanies, setShowCompanies] = useState(false);

  const [impSearch, setImpSearch] = useState("");
  const [impFilterDate, setImpFilterDate] = useState("");

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  /* ── notepad (inline via CommentCell in table) ── */

  /* ── Reassign to CSR ── */
  type ReassignCSR = { id: string; name: string; csrCode: string | null };
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignClient,    setReassignClient]    = useState<Client | null>(null);
  const [reassignCsrList,   setReassignCsrList]   = useState<ReassignCSR[]>([]);
  const [reassignTargetId,  setReassignTargetId]  = useState("");
  const [isReassigning,     setIsReassigning]     = useState(false);
  const [reassignCsrLoaded, setReassignCsrLoaded] = useState(false);

  const openReassignModal = async (client: Client) => {
    setReassignClient(client);
    setReassignTargetId("");
    setShowReassignModal(true);
    if (!reassignCsrLoaded) {
      try {
        const res = await API.get("/admin/csrs");
        setReassignCsrList(res.data.csrs ?? []);
        setReassignCsrLoaded(true);
      } catch { toast.error("Failed to load CSRs."); }
    }
  };

  const confirmReassign = async () => {
    if (!reassignClient || !reassignTargetId) return;
    setIsReassigning(true);
    try {
      await API.put(`/admin/lead/${reassignClient.id}/reassign`, { csrId: reassignTargetId });
      const name = reassignCsrList.find(c => c.id === reassignTargetId)?.name ?? "another CSR";
      const code = reassignCsrList.find(c => c.id === reassignTargetId)?.csrCode ?? null;
      toast.success(`Lead reassigned to ${name}.`);
      setClients(prev => prev.map(c =>
        c.id === reassignClient.id ? { ...c, csr: name, csrCode: code } : c
      ));
      setShowReassignModal(false);
      setReassignClient(null);
      refreshTabCounts();
      void fetchClients();
    } catch { toast.error("Failed to reassign lead."); }
    finally { setIsReassigning(false); }
  };

  const emptyClient: Client = {
    id: "",
    clientName: "",
    email: "",
    contact: "",
    company: "",
    parentCompany: "",
    scope: "",
    lastEmail: "",
    lastCall: "",
    lastComment: "",
    status: "Active",
    rawStatus: "active",
    csr: "",
    nextFollowup: "",
    time: "",
    timezone: "",
    isOldClient: false,
    clientCode: null,
  };

  const [newClient, setNewClient] = useState<Client>(emptyClient);

  const [tabCounts, setTabCounts] = useState({
    all: 0, important: 0, schedule: 0, interested: 0, closed: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [csrOptions, setCsrOptions] = useState<string[]>([]);
  const [searchDebounced, setSearchDebounced] = useState("");
  const [impSearchDebounced, setImpSearchDebounced] = useState("");

  useEffect(() => {
    API.get("/admin/clients/summary")
      .then(res => { if (res.data?.tabCounts) setTabCounts(res.data.tabCounts); })
      .catch(() => {});
    API.get("/admin/csrs")
      .then(res => setCsrOptions((res.data.csrs ?? []).map((c: { name: string }) => c.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setImpSearchDebounced(impSearch), 400);
    return () => clearTimeout(t);
  }, [impSearch]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const q = view === "important" || view === "schedule" ? impSearchDebounced : searchDebounced;
      const params = new URLSearchParams({
        view,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (csrFilter !== "all") params.set("csr", csrFilter);
      if (q.trim()) params.set("search", q.trim());
      if (view === "schedule" && impFilterDate) params.set("scheduleDate", impFilterDate);

      const res = await API.get(`/admin/clients?${params}`);
      setClients((res.data.leads ?? []).map(formatAdminLead));
      setTotalRecords(res.data.total ?? 0);
    } catch {
      toast.error("Failed to fetch clients");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [view, page, csrFilter, searchDebounced, impSearchDebounced, impFilterDate]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const refreshTabCounts = useCallback(() => {
    API.get("/admin/clients/summary")
      .then(res => { if (res.data?.tabCounts) setTabCounts(res.data.tabCounts); })
      .catch(() => {});
  }, []);

  const totalPagesClients = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const paginatedClients  = clients;
  const filteredClients     = clients;

  const isScheduleView = view === "schedule";
  const isClosedView   = view === "closed";
  const tableMinWidth  = isScheduleView || isClosedView ? "1200px" : "1100px";
  const tableColWidths = isScheduleView ? COL_9_SCHEDULE_ADMIN : isClosedView ? COL_9_CLOSED : COL_8_ADMIN;

  const tableTitle =
    view === "interested" ? "Interested Clients"
    : view === "closed"   ? "Closed Clients"
    : view === "important"? "Important Clients"
    : view === "schedule" ? "Schedule Call"
    : "All Clients";

  const tableHeaders = isScheduleView
    ? ["Client", "Company", "Contact", "Next Schedule", "Time", "CSR", "Status", "Notes", ""]
    : isClosedView
    ? ["Client", "Company", "Type", "Scope", "Contact", "CSR", "Status", "Notes", ""]
    : ["Client", "Company", "Scope", "Contact", "CSR", "Status", "Notes", ""];

  const handleSaveClient = () => {
    if (!newClient.clientName || !newClient.email || !newClient.company) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) {
      toast.error("Please enter valid email.");
      return;
    }
    if (isEditing) {
      setClients((prev) =>
        prev.map((c) => (c.id === newClient.id ? newClient : c))
      );
      toast.success("Client updated successfully.");
    } else {
      setClients((prev) => [{ ...newClient, id: Date.now().toString() }, ...prev]);
      toast.success("Client added successfully.");
    }
    setShowAddModal(false);
    setIsEditing(false);
    setNewClient(emptyClient);
  };

  const handleDeleteClient = () => {
    if (!clientToDelete) return;
    setClients((prev) => prev.filter((c) => c.id !== clientToDelete));
    toast.success("Client deleted successfully.");
    setShowDeleteModal(false);
    setClientToDelete(null);
  };

  if (initialLoad) {
    return (
      <div className="flex min-h-screen bg-[#F5F6FA]">
        <DashboardSidebar />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[64px]">
          <DashboardNavbar />
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-[#B8112D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading clients...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" reverseOrder={false} />
      <DashboardSidebar />

      {/* ─── MAIN CONTENT ─── */}
      {/* mt-[72px] for mobile/tablet navbar, lg:mt-0 when sidebar is shown */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        {/* ─── PAGE HEADER ─── */}
        <div className="mb-4 sm:mb-5 lg:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-800">
            Client Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Manage clients, conversations, and company records.
          </p>
        </div>

        {/* ─── LEAD STATUS CHART ─── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4 sm:mb-5 lg:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="sm:w-[200px] shrink-0">
              <div className="h-[160px] sm:h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Important",  value: tabCounts.important  || 0.001 },
                        { name: "Schedule",   value: tabCounts.schedule   || 0.001 },
                        { name: "Interested", value: tabCounts.interested || 0.001 },
                        { name: "Closed",     value: tabCounts.closed     || 0.001 },
                      ]}
                      cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                      paddingAngle={3} dataKey="value"
                    >
                      <Cell fill="#B8112D"/>
                      <Cell fill="#0B84F3"/>
                      <Cell fill="#027A48"/>
                      <Cell fill="#065F46"/>
                    </Pie>
                    <RTooltip
                      contentStyle={{ borderRadius:"12px", border:"1px solid #eee", fontSize:"12px" }}
                      formatter={(_, n) => {
                        const total = tabCounts.important + tabCounts.schedule + tabCounts.interested + tabCounts.closed;
                        const val = total === 0 ? 0
                          : n === "Important"  ? tabCounts.important
                          : n === "Schedule"   ? tabCounts.schedule
                          : n === "Interested" ? tabCounts.interested
                          : tabCounts.closed;
                        return [val, String(n)];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              {[
                { label:"Important",      value: tabCounts.important, dot:"bg-[#B8112D]", sub:"flagged only"       },
                { label:"Schedule Call",  value: tabCounts.schedule,  dot:"bg-[#0B84F3]", sub:"meetings scheduled" },
                { label:"Interested",     value: tabCounts.interested, dot:"bg-[#027A48]", sub:"service interest"   },
                { label:"Closed",         value: tabCounts.closed,     dot:"bg-[#065F46]", sub:"closed deals"       },
              ].map(s => (
                <div key={s.label} className="bg-[#FAFAFA] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${s.dot} shrink-0`}/>
                    <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-[#0F172A]">{s.value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── TAB BAR ─── */}
        {/* Horizontally scrollable on mobile, wraps on md+ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-2 sm:px-3 py-2 sm:py-2.5 mb-4 sm:mb-5 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
            {[
              {
                key: "all",
                label: "All Clients",
                count: tabCounts.all,
                Icon: LayoutGrid,
              },
              {
                key: "important",
                label: "Important",
                count: tabCounts.important,
                Icon: CircleAlert,
              },
              {
                key: "schedule",
                label: "Schedule Call",
                count: tabCounts.schedule,
                Icon: CalendarDays,
              },
              {
                key: "interested",
                label: "Interested",
                count: tabCounts.interested,
                Icon: HeartHandshake,
              },
              {
                key: "closed",
                label: "Closed",
                count: tabCounts.closed,
                Icon: BadgeCheck,
              },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key as typeof view);
                  setPage(1);
                }}
                className={`h-9 sm:h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap ${
                  view === item.key
                    ? "bg-[#B8112D] text-white shadow-md shadow-red-200"
                    : "text-gray-600 hover:bg-[#FFF6F7] hover:text-[#B8112D]"
                }`}
              >
                <item.Icon size={13} className="sm:w-[15px] sm:h-[15px]" />
                {item.label}
                <span
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold ${
                    view === item.key
                      ? "bg-white/20"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            ))}

            <div className="w-px h-6 bg-gray-200 mx-0.5 sm:mx-1 shrink-0" />

            <div className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10">
              <Users size={13} className="text-gray-400 shrink-0 sm:w-[15px] sm:h-[15px]" />
              <select
                value={csrFilter}
                onChange={(e) => {
                  setCsrFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 sm:h-10 border border-gray-200 rounded-xl px-2 sm:px-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] bg-white text-gray-700 font-medium"
              >
                <option value="all">All CSR</option>
                {csrOptions.map((csr) => (
                  <option key={csr} value={csr}>
                    {csr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ─── TABLE VIEWS (all tabs — row layout) ─── */}
        <>
            {/* Parent Companies accordion — only in "all" view */}
            {view === "all" && (
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm mb-4 sm:mb-5">
                <button
                  onClick={() => setShowCompanies(!showCompanies)}
                  className="w-full flex items-center justify-between"
                >
                  <div>
                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-800 text-left">
                      Parent Companies
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 text-left">
                      Company groups and associated clients.
                    </p>
                  </div>
                  {showCompanies ? (
                    <ChevronUp size={18} className="text-gray-500 sm:w-5 sm:h-5" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-500 sm:w-5 sm:h-5" />
                  )}
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    showCompanies ? "max-h-[600px] mt-4 sm:mt-6" : "max-h-0"
                  }`}
                >
                  {/* 2 cols mobile → 3 cols md → 5 cols xl */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {[
                      "BEM DESIGN STUDIO",
                      "GPS",
                      "BEM SOLUTIONS",
                      "PS-ESTIMATING",
                      "DEVCON-ESTIMATING",
                    ].map((company) => (
                      <div
                        key={company}
                        className="bg-[#FAFAFB] border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4"
                      >
                        <h3 className="font-semibold text-gray-700 text-xs sm:text-sm">
                          {company}
                        </h3>
                        <p className="text-[11px] sm:text-sm text-gray-400 mt-1 sm:mt-2">
                          Active Projects & Clients
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Search + filters */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
              <div className="flex flex-col sm:flex-row flex-1 gap-2 sm:gap-3">
                <div className="relative w-full sm:max-w-[360px]">
                  <Search
                    size={15}
                    className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder={view === "important" || view === "schedule" ? "Search name, phone, company..." : "Search clients..."}
                    value={view === "important" || view === "schedule" ? impSearch : search}
                    onChange={(e) => {
                      if (view === "important" || view === "schedule") setImpSearch(e.target.value);
                      else setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D]"
                  />
                </div>
                {view === "schedule" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={impFilterDate}
                      onChange={(e) => { setImpFilterDate(e.target.value); setPage(1); }}
                      className="h-10 sm:h-11 rounded-xl sm:rounded-2xl border border-gray-200 px-3 bg-white text-sm outline-none focus:border-[#B8112D]"
                    />
                    {impFilterDate && (
                      <button
                        onClick={() => { setImpFilterDate(""); setPage(1); }}
                        className="h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:text-[#B8112D]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {view === "all" && (
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setIsEditing(false);
                  setNewClient(emptyClient);
                }}
                className="w-full lg:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all"
              >
                <Plus size={15} />
                Add Client
              </button>
              )}
            </div>

            {/* ─── TABLE ─── */}
            <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{tableTitle}</h3>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                  {totalRecords} records
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className={CSR_TABLE_CLASS} style={{ minWidth: tableMinWidth }}>
                  <CsrColGroup widths={tableColWidths} />
                  <thead className="bg-[#FAFAFB] border-b border-gray-100">
                    <tr className="text-left text-xs sm:text-sm text-gray-400">
                      {tableHeaders.map((h, i) => (
                          <th
                            key={i}
                            className={`${CSR_TH} ${i === tableHeaders.length - 1 ? "text-right" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={tableHeaders.length} className="px-6 py-16 sm:py-20 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-3 sm:mb-4">
                              <Building2 size={28} className="text-[#B8112D] sm:w-8 sm:h-8" />
                            </div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-700">
                              No Clients Found
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1 sm:mt-2">
                              Try adding a new client or changing your search.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedClients.map((client, i) => (
                        <tr
                          key={client.id}
                          className="border-b border-gray-100 hover:bg-[#FAFAFB] transition-colors"
                        >
                          {/* Client name + email */}
                          <td className={CSR_TD}>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] font-semibold shrink-0 text-xs sm:text-sm">
                                {client.clientName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {client.clientCode && (
                                    <span className="bg-[#B8112D]/10 text-[#B8112D] text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                      {client.clientCode}
                                    </span>
                                  )}
                                  <h3 className="text-xs sm:text-sm font-semibold text-gray-700 truncate max-w-[120px] sm:max-w-[160px] lg:max-w-none">
                                    {client.clientName}
                                  </h3>
                                </div>
                                {client.email !== "N/A" && (
                                  <p className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[120px] sm:max-w-[160px] lg:max-w-none">
                                    {client.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className={`${CSR_TD} text-xs sm:text-sm text-gray-600`}>
                            <span className="truncate block">{client.company}</span>
                          </td>

                          {isClosedView && (
                            <td className={CSR_TD}>
                              <span className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                                client.isOldClient
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}>
                                {client.isOldClient ? "Old Client" : "New Client"}
                              </span>
                            </td>
                          )}

                          {!isScheduleView && (
                            <td className={`${CSR_TD} text-xs sm:text-sm text-gray-600`}>
                              <span className="truncate block">{client.scope}</span>
                            </td>
                          )}

                          <td className={`${CSR_TD} text-xs sm:text-sm text-gray-500 whitespace-nowrap`}>
                            {client.contact}
                          </td>

                          {isScheduleView && (
                            <>
                              <td className={CSR_TD}>
                                <div className="inline-flex items-center gap-1.5 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-[#FAFAFA]">
                                  <CalendarDays size={12} className="text-[#B8112D] shrink-0" />
                                  {client.nextFollowup || "—"}
                                </div>
                              </td>
                              <td className={CSR_TD}>
                                <p className="text-xs sm:text-sm font-semibold text-[#0F172A]">{client.time !== "N/A" ? client.time : "—"}</p>
                                {client.timezone !== "N/A" && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">{client.timezone}</p>
                                )}
                              </td>
                            </>
                          )}

                          <td className={`${CSR_TD} whitespace-nowrap`}>
                            <div className="flex items-center gap-1.5">
                              {client.csrCode && (
                                <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-1.5 py-0.5 rounded-md">{client.csrCode}</span>
                              )}
                              <span className="text-xs sm:text-sm text-gray-600">{client.csr}</span>
                            </div>
                          </td>

                          {/* Status badge */}
                          <td className={CSR_TD}>
                            <span
                              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${adminLeadStatusBadgeClass(client.rawStatus, client.nextFollowup)}`}
                            >
                              {adminLeadStatusLabel(client.rawStatus, client.nextFollowup)}
                            </span>
                          </td>

                          {/* Notes */}
                          <td className={CSR_TD}>
                            <CommentCell
                              id={client.id}
                              comment={client.lastComment === "No comments" ? "" : client.lastComment}
                              onSave={async (id, text) => {
                                await API.patch(`/admin/lead/${id}/note`, { comments: text });
                                setClients(prev => prev.map(c => c.id === id ? { ...c, lastComment: text || "No comments" } : c));
                              }}
                            />
                          </td>

                          {/* Actions */}
                          <td className={CSR_TD}>
                            {/* Desktop: icon row (md+) */}
                            <div className="hidden md:flex items-center justify-end gap-1.5 lg:gap-2">
                              <button
                                onClick={() => setSelectedClient(client)}
                                className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
                                title="View details"
                              >
                                <Eye size={13} className="lg:w-[15px] lg:h-[15px]" />
                              </button>
                              <button
                                onClick={() => {
                                  setClientToDelete(client.id);
                                  setShowDeleteModal(true);
                                }}
                                className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                                title="Delete"
                              >
                                <Trash2 size={13} className="lg:w-[15px] lg:h-[15px]" />
                              </button>
                              {canAdminReassign(client) && (
                                <button
                                  onClick={() => void openReassignModal(client)}
                                  className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all"
                                  title="Reassign to CSR"
                                >
                                  <ArrowRightLeft size={13} className="lg:w-[15px] lg:h-[15px]" />
                                </button>
                              )}
                            </div>
                            {/* Mobile: three-dot dropdown */}
                            <div className="relative md:hidden flex justify-end">
                              <button
                                onClick={() =>
                                  setOpenMenu(openMenu === i ? null : i)
                                }
                                className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center bg-white"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {openMenu === i && (
                                <div className="absolute right-0 top-10 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                                  <button
                                    onClick={() => {
                                      setSelectedClient(client);
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Eye size={14} /> View
                                  </button>
                                  <button
                                    onClick={() => {
                                      setClientToDelete(client.id);
                                      setShowDeleteModal(true);
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                  {canAdminReassign(client) && (
                                    <button
                                      onClick={() => {
                                        void openReassignModal(client);
                                        setOpenMenu(null);
                                      }}
                                      className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2"
                                    >
                                      <ArrowRightLeft size={14} /> Reassign CSR
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalPagesClients > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalRecords)} of {totalRecords}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
                    <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPagesClients}</span>
                    <button onClick={() => setPage(p => Math.min(totalPagesClients, p + 1))} disabled={page === totalPagesClients}
                      className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
                  </div>
                </div>
              )}
            </div>
        </>

        {/* ─── MODALS ─── */}

        {/* View Client — CSR-style detail modal */}
        {selectedClient && (
          <LeadDetailModal
            apiPrefix="/admin"
            lead={{
              id: selectedClient.id,
              name:    selectedClient.clientName,
              company: selectedClient.company !== "N/A" ? selectedClient.company : undefined,
              phone:   selectedClient.contact !== "N/A" ? selectedClient.contact : undefined,
              email:   selectedClient.email !== "N/A" ? selectedClient.email : undefined,
              status:  selectedClient.rawStatus,
              interestedService: selectedClient.scope !== "N/A" ? selectedClient.scope : undefined,
              followUpNotes: selectedClient.lastComment !== "No comments" ? selectedClient.lastComment : undefined,
              nextSchedule: selectedClient.nextFollowup || undefined,
              nextTime:     selectedClient.time !== "N/A" ? selectedClient.time : undefined,
              timezone:     selectedClient.timezone !== "N/A" ? selectedClient.timezone : undefined,
            }}
            onClose={() => setSelectedClient(null)}
            onSaved={(id, updates) => {
              setClients(prev => prev.map(c => {
                if (c.id !== id) return c;
                return {
                  ...c,
                  clientName: updates.name?.trim() || c.clientName,
                  contact:    updates.phone?.trim() || c.contact,
                  email:      updates.email?.trim() || c.email,
                };
              }));
            }}
          />
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
              <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">
                Delete Client
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                This action cannot be undone.
              </p>
              <div className="bg-red-50 border border-red-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 mt-3 sm:mt-4">
                <p className="text-xs sm:text-sm text-red-600">
                  Are you sure you want to delete this client permanently?
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setClientToDelete(null);
                  }}
                  className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteClient}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-red-600 text-white text-sm hover:bg-red-700 transition-all"
                >
                  Delete Client
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-xl lg:max-w-3xl rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">
                    {isEditing ? "Edit Client" : "Add New Client"}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                    Create and manage client records.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {[
                  { label: "Client Name", key: "clientName", type: "text", placeholder: "John Smith", req: true },
                  { label: "Email Address", key: "email", type: "email", placeholder: "john@email.com", req: true },
                  { label: "Contact Number", key: "contact", type: "text", placeholder: "+1 234 567 890", req: false },
                  { label: "CSR", key: "csr", type: "text", placeholder: "Customer Service Representative", req: false },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2 block">
                      {f.label}{" "}
                      {f.req && <span className="text-[#B8112D]">*</span>}
                    </label>
                    <input
                      type={f.type}
                      value={(newClient as unknown as Record<string, string>)[f.key]}
                      placeholder={f.placeholder}
                      onChange={(e) =>
                        setNewClient({ ...newClient, [f.key]: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D]"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2 block">
                    Company Name <span className="text-[#B8112D]">*</span>
                  </label>
                  <select
                    value={newClient.company}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        company: e.target.value,
                        parentCompany: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D] bg-white"
                  >
                    <option value="">Select Company</option>
                    {["BEM DESIGN STUDIO", "GPS", "BEM SOLUTIONS", "PS-ESTIMATING", "DEVCON-ESTIMATING"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2 block">Status</label>
                  <select
                    value={newClient.status}
                    onChange={(e) =>
                      setNewClient({ ...newClient, status: e.target.value as Client["status"] })
                    }
                    className="w-full border border-gray-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D] bg-white"
                  >
                    {["Active", "Pending", "Closed", "Interested"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2 block">Scope of Work</label>
                  <textarea
                    rows={3}
                    value={newClient.scope}
                    placeholder="Write project scope..."
                    onChange={(e) => setNewClient({ ...newClient, scope: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none resize-none focus:border-[#B8112D]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2 block">Last Call Comments</label>
                  <textarea
                    rows={3}
                    value={newClient.lastComment}
                    placeholder="Write discussion notes..."
                    onChange={(e) => setNewClient({ ...newClient, lastComment: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none resize-none focus:border-[#B8112D]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveClient}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-sm hover:bg-[#a30f27] transition-all"
                >
                  {isEditing ? "Update Client" : "Save Client"}
                </button>
              </div>
            </div>
          </div>
        )}
      {/* ══ REASSIGN CSR MODAL ══ */}
      {showReassignModal && reassignClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Reassign Lead</h2>
                  <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                    Reassigning <span className="font-semibold text-white">{reassignClient.clientName}</span>
                  </p>
                </div>
                <button onClick={() => setShowReassignModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="px-5 sm:px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
              {!reassignCsrLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#B8112D] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : reassignCsrList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No CSRs available.</p>
              ) : reassignCsrList.map(csr => (
                <button key={csr.id} onClick={() => setReassignTargetId(csr.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                    reassignTargetId === csr.id ? "border-[#B8112D] bg-[#FFF1F3]" : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                    reassignTargetId === csr.id ? "bg-[#B8112D]" : "bg-gray-400"
                  }`}>
                    {csr.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${reassignTargetId === csr.id ? "text-[#B8112D]" : "text-[#0F172A]"}`}>
                      {csr.name}
                    </p>
                    {csr.csrCode && <p className="text-xs text-gray-400">{csr.csrCode}</p>}
                  </div>
                  {reassignTargetId === csr.id && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2">
              <button onClick={() => setShowReassignModal(false)}
                className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={confirmReassign} disabled={!reassignTargetId || isReassigning}
                className="flex-1 h-11 rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                <ArrowRightLeft size={14} />
                {isReassigning ? "Reassigning…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}