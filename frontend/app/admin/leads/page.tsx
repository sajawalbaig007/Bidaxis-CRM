"use client";

import { useEffect, useState, useMemo } from "react";
import API from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";

import {
  Search,
  Plus,
  Building2,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  LayoutGrid,
  HeartHandshake,
  BadgeCheck,
  Users,
  ChevronUp,
  MessageSquare,
  X,
  CircleAlert,
  PhoneCall,
  Trophy,
  Briefcase,
  Clock3,
  Globe,
  User2,
  CalendarDays,
  Filter,
  Phone,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

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
  status: "Active" | "Pending" | "Closed" | "Interested";
  rawStatus: string;
  csr: string;
  csrCode?: string | null;
  nextFollowup: string;
  time: string;
  timezone: string;
};

const PAGE_SIZE = 30;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  const [view, setView] = useState<"all" | "important" | "interested" | "closed">("all");
  const [csrFilter, setCsrFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [showCompanies, setShowCompanies] = useState(false);

  const [impSearch, setImpSearch] = useState("");
  const [impFilterDate, setImpFilterDate] = useState("");
  const [selectedImp, setSelectedImp] = useState<Client | null>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  /* ── notepad ── */
  const [noteModal, setNoteModal] = useState<{
    id: string;
    name: string;
    note: string;
    mode: "view" | "edit";
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const openNote = (client: Client, mode: "view" | "edit") => {
    setNoteModal({
      id: client.id,
      name: client.clientName,
      note: client.lastComment === "No comments" ? "" : client.lastComment,
      mode,
    });
    setNoteDraft(client.lastComment === "No comments" ? "" : client.lastComment);
  };

  const saveNote = async () => {
    if (!noteModal) return;
    setNoteSaving(true);
    try {
      await API.patch(`/admin/lead/${noteModal.id}/note`, { comments: noteDraft });
      setClients((prev) =>
        prev.map((c) =>
          c.id === noteModal.id
            ? { ...c, lastComment: noteDraft || "No comments" }
            : c
        )
      );
      setNoteModal(null);
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setNoteSaving(false);
    }
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
  };

  const [newClient, setNewClient] = useState<Client>(emptyClient);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await API.get("/admin/clients");
        if (!mounted) return;

        const formatted: Client[] = res.data.leads.map(
          (lead: {
            id: string;
            name?: string;
            email?: string;
            phone?: string;
            company?: string;
            interestedService?: string;
            comments?: string;
            updatedAt?: string;
            status?: string;
            nextSchedule?: string;
            nextTime?: string;
            timezone?: string;
            uploadFile?: { companyName?: string };
            csr?: { name?: string; csrCode?: string | null };
          }) => {
            const raw = (lead.status || "active").toLowerCase();
            return {
              id: lead.id,
              clientName: lead.name || "Unknown",
              email: lead.email || "N/A",
              contact: lead.phone || "N/A",
              company: lead.company || lead.uploadFile?.companyName || "N/A",
              parentCompany: lead.uploadFile?.companyName || lead.company || "N/A",
              scope: lead.interestedService || "N/A",
              lastEmail: "",
              lastCall: lead.updatedAt?.split("T")[0] || "",
              lastComment: lead.comments || "No comments",
              rawStatus: raw,
              status:
                raw === "interested"
                  ? "Interested"
                  : ["closed", "completed", "Close Client"].includes(raw)
                  ? "Closed"
                  : raw === "pending"
                  ? "Pending"
                  : "Active",
              csr: lead.csr?.name || "Unassigned",
              csrCode: lead.csr?.csrCode ?? null,
              nextFollowup: lead.nextSchedule || "",
              time: lead.nextTime || "N/A",
              timezone: lead.timezone || "N/A",
            };
          }
        );

        setClients(formatted);
      } catch (err) {
        console.log(err);
        if (mounted) toast.error("Failed to fetch clients");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];

  const csrOptions = useMemo(
    () => Array.from(new Set(clients.map((c) => c.csr))),
    [clients]
  );

  const filteredByCSR = useMemo(() => {
    return csrFilter === "all"
      ? clients
      : clients.filter((c) => c.csr === csrFilter);
  }, [clients, csrFilter]);

  const importantClients = useMemo(
    () => filteredByCSR.filter((c) => c.rawStatus === "important"),
    [filteredByCSR]
  );

  const interestedClients = useMemo(
    () => filteredByCSR.filter((c) => c.rawStatus === "interested"),
    [filteredByCSR]
  );

  const closedClients = useMemo(
    () => filteredByCSR.filter((c) => c.status === "Closed"),
    [filteredByCSR]
  );

  const projectWonCount = useMemo(
    () => filteredByCSR.filter((c) => c.rawStatus === "Close Client").length,
    [filteredByCSR]
  );

  const impTodayCount = useMemo(
    () => importantClients.filter((c) => c.nextFollowup === todayStr).length,
    [importantClients, todayStr]
  );

  const filteredImportant = useMemo(() => {
    const q = impSearch.toLowerCase();
    return importantClients.filter((c) => {
      const ms =
        !q ||
        c.clientName.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q);
      const md = !impFilterDate || c.nextFollowup === impFilterDate;
      return ms && md;
    });
  }, [importantClients, impSearch, impFilterDate]);

  const activeImp = selectedImp ?? filteredImportant[0] ?? null;

  const filteredClients = useMemo(
    () =>
      filteredByCSR.filter((client) => {
        const q = search.toLowerCase();
        const ms =
          client.clientName.toLowerCase().includes(q) ||
          client.company.toLowerCase().includes(q) ||
          client.scope.toLowerCase().includes(q) ||
          client.csr.toLowerCase().includes(q);
        const mst =
          view === "interested"
            ? client.status === "Interested"
            : view === "closed"
            ? client.status === "Closed"
            : true;
        return ms && mst;
      }),
    [filteredByCSR, search, view]
  );

  const totalPagesClients = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const paginatedClients  = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F5F6FA]">
        <DashboardSidebar />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
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
      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[72px] lg:mt-0">
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

        {/* ─── STAT CARDS ─── */}
        {/* 2 cols on mobile, 2 on sm, 4 on lg+ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5 lg:mb-6">
          {[
            {
              label: "Important Calls",
              value: importantClients.length,
              sub: "total flagged",
              color: "bg-[#FFF1F3] text-[#B8112D]",
              Icon: CircleAlert,
            },
            {
              label: "Important Today",
              value: impTodayCount,
              sub: "scheduled for today",
              color: "bg-[#EAF5FF] text-[#0B84F3]",
              Icon: PhoneCall,
            },
            {
              label: "Interested",
              value: interestedClients.length,
              sub: "service interest",
              color: "bg-[#ECFDF3] text-[#027A48]",
              Icon: Briefcase,
            },
            {
              label: "Close Client",
              value: projectWonCount,
              sub: "closed deals",
              color: "bg-[#ECFDF5] text-[#065F46]",
              Icon: Trophy,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 border border-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] sm:text-[11px] lg:text-[12px] font-medium truncate">
                    {card.label}
                  </p>
                  <h2 className="text-2xl sm:text-[26px] lg:text-[28px] font-bold text-[#0F172A] mt-0.5">
                    {card.value}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 truncate">
                    {card.sub}
                  </p>
                </div>
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-2xl ${card.color} flex items-center justify-center shrink-0`}
                >
                  <card.Icon size={16} className="sm:w-[18px] sm:h-[18px] lg:w-5 lg:h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── TAB BAR ─── */}
        {/* Horizontally scrollable on mobile, wraps on md+ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-2 sm:px-3 py-2 sm:py-2.5 mb-4 sm:mb-5 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
            {[
              {
                key: "all",
                label: "All Clients",
                count: filteredByCSR.length,
                Icon: LayoutGrid,
              },
              {
                key: "important",
                label: "Important",
                count: importantClients.length,
                Icon: CircleAlert,
              },
              {
                key: "interested",
                label: "Interested",
                count: interestedClients.length,
                Icon: HeartHandshake,
              },
              {
                key: "closed",
                label: "Closed",
                count: closedClients.length,
                Icon: BadgeCheck,
              },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key as typeof view);
                  setPage(1);
                  if (item.key === "important") setSelectedImp(null);
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
                  setSelectedImp(null);
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

        {/* ─── ALL / INTERESTED / CLOSED VIEW ─── */}
        {(view === "all" || view === "interested" || view === "closed") && (
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

            {/* Search + Add button row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
              <div className="relative w-full sm:w-[280px] md:w-[320px] lg:w-[360px]">
                <Search
                  size={15}
                  className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D]"
                />
              </div>

              <button
                onClick={() => {
                  setShowAddModal(true);
                  setIsEditing(false);
                  setNewClient(emptyClient);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all"
              >
                <Plus size={15} />
                Add Client
              </button>
            </div>

            {/* ─── TABLE ─── */}
            <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">
                  {view === "interested"
                    ? "Interested Clients"
                    : view === "closed"
                    ? "Closed Clients"
                    : "All Clients"}
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                  {filteredClients.length} records
                </p>
              </div>

              {/* Horizontally scrollable table wrapper */}
              <div className="overflow-x-auto overflow-y-auto max-h-[480px] sm:max-h-[560px] lg:max-h-[620px] xl:max-h-[700px]">
                <table className="w-full" style={{ minWidth: "760px" }}>
                  <thead className="bg-[#FAFAFB] border-b border-gray-100 sticky top-0 z-10">
                    <tr className="text-left text-xs sm:text-sm text-gray-400">
                      {["Client", "Company", "Scope", "Contact", "CSR", "Status", ""].map(
                        (h, i) => (
                          <th
                            key={i}
                            className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 font-medium ${
                              i === 6 ? "text-right" : ""
                            }`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 sm:py-20 text-center">
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
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] font-semibold shrink-0 text-xs sm:text-sm">
                                {client.clientName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-700 truncate max-w-[120px] sm:max-w-[160px] lg:max-w-none">
                                  {client.clientName}
                                </h3>
                                <p className="text-[10px] sm:text-xs text-gray-400 truncate max-w-[120px] sm:max-w-[160px] lg:max-w-none">
                                  {client.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 max-w-[120px]">
                            <span className="truncate block">{client.company}</span>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 max-w-[140px]">
                            <span className="truncate block">{client.scope}</span>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                            {client.contact}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {client.csrCode && (
                                <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-1.5 py-0.5 rounded-md">{client.csrCode}</span>
                              )}
                              <span className="text-xs sm:text-sm text-gray-600">{client.csr}</span>
                            </div>
                          </td>

                          {/* Status badge */}
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                            <span
                              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                                client.status === "Active"
                                  ? "bg-green-100 text-green-700"
                                  : client.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : client.status === "Interested"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {client.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
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
                                onClick={() => openNote(client, "view")}
                                className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-all"
                                title="View note"
                              >
                                <MessageSquare size={13} className="lg:w-[15px] lg:h-[15px]" />
                              </button>
                              <button
                                onClick={() => openNote(client, "edit")}
                                className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-all"
                                title="Edit note"
                              >
                                <Pencil size={13} className="lg:w-[15px] lg:h-[15px]" />
                              </button>
                              <button
                                onClick={() => {
                                  setShowAddModal(true);
                                  setIsEditing(true);
                                  setNewClient(client);
                                }}
                                className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all"
                                title="Edit lead"
                              >
                                <Pencil size={13} className="lg:w-[15px] lg:h-[15px]" />
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
                                      openNote(client, "view");
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-amber-50 text-amber-700 flex items-center gap-2"
                                  >
                                    <MessageSquare size={14} /> View Note
                                  </button>
                                  <button
                                    onClick={() => {
                                      openNote(client, "edit");
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-emerald-50 text-emerald-700 flex items-center gap-2"
                                  >
                                    <Pencil size={14} /> Edit Note
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowAddModal(true);
                                      setIsEditing(true);
                                      setNewClient(client);
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Pencil size={14} /> Edit Lead
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
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredClients.length)} of {filteredClients.length}
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
        )}

        {/* ─── IMPORTANT VIEW ─── */}
        {view === "important" && (
          <>
            {/* Filter bar */}
            <div className="bg-white rounded-2xl sm:rounded-[26px] shadow-sm px-4 sm:px-5 py-3 sm:py-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="relative w-full sm:max-w-[380px]">
                <Search
                  size={15}
                  className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by client, company or phone..."
                  value={impSearch}
                  onChange={(e) => {
                    setImpSearch(e.target.value);
                    setSelectedImp(null);
                  }}
                  className="w-full h-10 sm:h-[46px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-9 sm:pl-10 pr-4 text-sm outline-none focus:border-[#B8112D]"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 text-[#B8112D] font-semibold text-xs sm:text-sm whitespace-nowrap">
                  <Filter size={14} />
                  Filter by Schedule
                </div>
                <input
                  type="date"
                  value={impFilterDate}
                  onChange={(e) => {
                    setImpFilterDate(e.target.value);
                    setSelectedImp(null);
                  }}
                  className="h-10 sm:h-[46px] rounded-xl sm:rounded-2xl border border-gray-200 px-3 sm:px-4 bg-[#FAFAFA] text-sm outline-none focus:border-[#B8112D]"
                />
                {impFilterDate && (
                  <button
                    onClick={() => {
                      setImpFilterDate("");
                      setSelectedImp(null);
                    }}
                    className="h-10 sm:h-[46px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] text-sm text-gray-500 hover:text-[#B8112D] transition-all whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Split panel: list + detail
                Mobile/tablet: stacked (col)
                Desktop (xl+): side by side (row) */}
            <div className="flex flex-col xl:grid xl:grid-cols-12 gap-4 sm:gap-5">

              {/* LEFT: client list */}
              <div className="xl:col-span-5 bg-white rounded-2xl sm:rounded-[30px] border border-gray-100 shadow-sm flex flex-col"
                style={{ maxHeight: "calc(100vh - 380px)", minHeight: "320px" }}>
                <div className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-[#F3F3F3] shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-[19px] font-bold text-[#0F172A]">
                        Important Clients
                      </h3>
                      <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                        Scheduled follow-up meetings.
                      </p>
                    </div>
                    <div className="bg-[#FFF1F3] text-[#B8112D] text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl">
                      {importantClients.length} Total
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2 sm:space-y-3">
                  {filteredImportant.length > 0 ? (
                    filteredImportant.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => setSelectedImp(client)}
                        className={`w-full text-left rounded-2xl sm:rounded-[22px] border p-3 sm:p-4 transition-all ${
                          activeImp?.id === client.id
                            ? "border-[#B8112D] bg-[#FFF8F9]"
                            : "border-gray-100 bg-white hover:border-[#B8112D]/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 sm:gap-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                              {client.clientName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-[#0F172A] text-xs sm:text-[13px]">
                                {client.clientName}
                              </h4>
                              <p className="text-gray-500 text-[11px] sm:text-[12px] mt-0.5">
                                {client.company}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-[11px] font-semibold shrink-0 bg-[#FFF7E6] text-[#B54708]">
                            High
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 sm:py-10">
                      <CircleAlert size={24} className="text-gray-200 mx-auto mb-2 sm:mb-3 sm:w-7 sm:h-7" />
                      <p className="text-gray-400 text-xs sm:text-sm">
                        No important clients found.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: detail panel */}
              {activeImp ? (
                <div
                  className="xl:col-span-7 bg-white rounded-2xl sm:rounded-[30px] border border-gray-100 shadow-sm flex flex-col"
                  style={{ maxHeight: "calc(100vh - 380px)", minHeight: "320px" }}
                >
                  <div className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-[#F3F3F3] shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                      <div>
                        <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A]">
                          {activeImp.clientName}
                        </h3>
                        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                          Follow-up details.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSelectedClient(activeImp)}
                          className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-gray-100 text-gray-600 text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 hover:bg-gray-200 transition-colors"
                        >
                          <Eye size={13} className="sm:w-[14px] sm:h-[14px]" />
                          View
                        </button>
                        <button
                          onClick={() => {
                            setShowAddModal(true);
                            setIsEditing(true);
                            setNewClient(activeImp);
                          }}
                          className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 shadow-sm hover:bg-[#a30f27] transition-colors"
                        >
                          <Pencil size={13} className="sm:w-[14px] sm:h-[14px]" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 p-4 sm:p-5">
                    {/* 1 col mobile, 2 col sm+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {[
                        { label: "Contact Number", value: activeImp.contact, Icon: Phone },
                        { label: "Next Schedule", value: activeImp.nextFollowup || "N/A", Icon: CalendarDays },
                        { label: "Call Time", value: activeImp.time || "N/A", Icon: Clock3 },
                        { label: "Timezone", value: activeImp.timezone || "N/A", Icon: Globe },
                        { label: "CSR Assigned", value: activeImp.csrCode ? `${activeImp.csrCode} · ${activeImp.csr}` : activeImp.csr, Icon: Users },
                        { label: "Scope", value: activeImp.scope, Icon: Briefcase },
                      ].map(({ label, value, Icon }) => (
                        <div key={label} className="bg-[#FAFAFA] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                              <Icon size={14} className="sm:w-4 sm:h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-gray-500 text-[10px] sm:text-xs">{label}</p>
                              <h4 className="font-semibold text-[#0F172A] mt-0.5 text-xs sm:text-[13px] truncate">
                                {value}
                              </h4>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 sm:mt-4">
                      <h4 className="text-sm sm:text-[16px] font-bold text-[#0F172A]">
                        Follow-up Notes
                      </h4>
                      <div className="bg-[#FAFAFA] rounded-xl sm:rounded-2xl p-3 sm:p-4 mt-2 sm:mt-3">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                            <User2 size={12} className="sm:w-[14px] sm:h-[14px]" />
                          </div>
                          <p className="text-gray-600 leading-6 text-xs sm:text-[13px]">
                            {activeImp.lastComment}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="xl:col-span-7 bg-white rounded-2xl sm:rounded-[30px] border border-gray-100 shadow-sm flex items-center justify-center"
                  style={{ minHeight: "320px" }}
                >
                  <div className="text-center">
                    <CircleAlert size={32} className="text-gray-200 mx-auto mb-2 sm:mb-3 sm:w-9 sm:h-9" />
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Select a client to view details
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── MODALS ─── */}

        {/* View Client Modal */}
        {selectedClient && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg lg:max-w-2xl rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">
                    Client Details
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                    Complete client information.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {[
                  { label: "Client Name", value: selectedClient.clientName },
                  { label: "Email", value: selectedClient.email },
                  { label: "Contact", value: selectedClient.contact },
                  { label: "Company", value: selectedClient.company },
                  { label: "CSR", value: selectedClient.csr },
                ].map((f) => (
                  <div key={f.label} className="bg-[#F8F9FC] p-3 sm:p-4 rounded-xl sm:rounded-2xl">
                    <p className="text-[10px] sm:text-xs text-gray-400">{f.label}</p>
                    <h3 className="font-medium text-gray-700 mt-0.5 sm:mt-1 text-sm">
                      {f.value}
                    </h3>
                  </div>
                ))}
                <div className="bg-[#F8F9FC] p-3 sm:p-4 rounded-xl sm:rounded-2xl sm:col-span-2">
                  <p className="text-[10px] sm:text-xs text-gray-400">Scope of Work</p>
                  <h3 className="font-medium text-gray-700 mt-0.5 sm:mt-1 text-sm">
                    {selectedClient.scope}
                  </h3>
                </div>
                <div className="bg-[#F8F9FC] p-3 sm:p-4 rounded-xl sm:rounded-2xl sm:col-span-2">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <MessageSquare size={15} className="text-[#B8112D] mt-0.5 shrink-0 sm:w-[18px] sm:h-[18px]" />
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-400">Last Call Comments</p>
                      <h3 className="font-medium text-gray-700 mt-0.5 sm:mt-1 text-sm">
                        {selectedClient.lastComment}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Note Modal */}
        {noteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <MessageSquare size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Note</h2>
                    <p className="text-[10px] sm:text-xs text-gray-400">{noteModal.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {noteModal.mode === "view" ? (
                    <button
                      onClick={() => setNoteModal((m) => m ? { ...m, mode: "edit" } : m)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center"
                      title="Edit note"
                    >
                      <Pencil size={13} className="sm:w-[15px] sm:h-[15px]" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setNoteModal((m) => m ? { ...m, mode: "view" } : m)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center"
                      title="View note"
                    >
                      <Eye size={13} className="sm:w-[15px] sm:h-[15px]" />
                    </button>
                  )}
                  <button
                    onClick={() => setNoteModal(null)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  >
                    <X size={13} className="sm:w-[15px] sm:h-[15px]" />
                  </button>
                </div>
              </div>

              {noteModal.mode === "view" ? (
                <div className="min-h-[120px] sm:min-h-[160px] bg-[#FAFAFA] rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-4">
                  {noteDraft ? (
                    <p className="text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap">
                      {noteDraft}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      No note written yet. Click the pen icon to add one.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Write your note here..."
                    rows={5}
                    className="w-full rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] p-3 sm:p-4 text-sm outline-none focus:border-[#B8112D] resize-none transition-colors"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 sm:gap-3 mt-3 sm:mt-4">
                    <button
                      onClick={() => setNoteModal(null)}
                      className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveNote}
                      disabled={noteSaving}
                      className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-sm font-semibold hover:bg-[#a30f27] disabled:opacity-60 transition-all"
                    >
                      {noteSaving ? "Saving…" : "Save Note"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
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
      </main>
    </div>
  );
}