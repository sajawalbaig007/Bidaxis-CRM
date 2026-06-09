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
  nextFollowup: string;
  time: string;
  timezone: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

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
            csr?: { name?: string };
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

  /* ─── CSR BASED COUNTS FIX ─── */
  const filteredByCSR = useMemo(() => {
    return csrFilter === "all"
      ? clients
      : clients.filter((c) => c.csr === csrFilter);
  }, [clients, csrFilter]);

  const importantClients = useMemo(() => {
    return filteredByCSR.filter((c) => c.rawStatus === "important");
  }, [filteredByCSR]);

  const interestedClients = useMemo(() => {
    return filteredByCSR.filter((c) => c.rawStatus === "interested");
  }, [filteredByCSR]);

  const closedClients = useMemo(() => {
    return filteredByCSR.filter((c) => c.status === "Closed");
  }, [filteredByCSR]);

  const projectWonCount = useMemo(() => {
    return filteredByCSR.filter((c) => c.rawStatus === "Close Client").length;
  }, [filteredByCSR]);

  const impTodayCount = useMemo(() => {
    return importantClients.filter((c) => c.nextFollowup === todayStr).length;
  }, [importantClients, todayStr]);

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

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar />

        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-gray-800">
            Client Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage clients, conversations, and company records.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          {[
            {
              label: "Important Calls",
              value: importantClients.length,
              sub: "total flagged",
              color: "bg-[#FFF1F3] text-[#B8112D]",
              Icon: CircleAlert,
            },
            {
              label: "Important Calls Today",
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
              className="bg-white rounded-[24px] p-4 border border-white shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[12px] font-medium">
                    {card.label}
                  </p>
                  <h2 className="text-[28px] font-bold text-[#0F172A] mt-1">
                    {card.value}
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {card.sub}
                  </p>
                </div>
                <div
                  className={`w-11 h-11 rounded-2xl ${card.color} flex items-center justify-center shrink-0`}
                >
                  <card.Icon size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2.5 mb-5 flex flex-wrap items-center gap-2">
          {[
            {
              key: "all",
              label: "All Clients",
              count: filteredByCSR.length,
              Icon: LayoutGrid,
            },
            {
              key: "important",
              label: "Important Calls",
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
                if (item.key === "important") setSelectedImp(null);
              }}
              className={`h-10 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                view === item.key
                  ? "bg-[#B8112D] text-white shadow-md shadow-red-200"
                  : "text-gray-600 hover:bg-[#FFF6F7] hover:text-[#B8112D]"
              }`}
            >
              <item.Icon size={15} />
              {item.label}
              <span
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                  view === item.key ? "bg-white/20" : "bg-gray-100 text-gray-500"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <div className="flex items-center gap-2 h-10">
            <Users size={15} className="text-gray-400 shrink-0" />
            <select
              value={csrFilter}
              onChange={(e) => {
                setCsrFilter(e.target.value);
                setSelectedImp(null);
              }}
              className="h-10 border border-gray-200 rounded-xl px-3 text-sm outline-none focus:border-[#B8112D] bg-white text-gray-700 font-medium"
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

        {(view === "all" || view === "interested" || view === "closed") && (
          <>
            {view === "all" && (
              <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-5">
                <button
                  onClick={() => setShowCompanies(!showCompanies)}
                  className="w-full flex items-center justify-between"
                >
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 text-left">
                      Parent Companies
                    </h2>
                    <p className="text-sm text-gray-400 mt-1 text-left">
                      Company groups and associated clients.
                    </p>
                  </div>
                  {showCompanies ? (
                    <ChevronUp size={20} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-500" />
                  )}
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    showCompanies ? "max-h-[500px] mt-6" : "max-h-0"
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                    {[
                      "BEM DESIGN STUDIO",
                      "GPS",
                      "BEM SOLUTIONS",
                      "PS-ESTIMATING",
                      "DEVCON-ESTIMATING",
                    ].map((company) => (
                      <div
                        key={company}
                        className="bg-[#FAFAFB] border border-gray-100 rounded-2xl p-4"
                      >
                        <h3 className="font-semibold text-gray-700">
                          {company}
                        </h3>
                        <p className="text-sm text-gray-400 mt-2">
                          Active Projects & Clients
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div className="relative w-full sm:w-[320px]">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"
                />
              </div>

              <button
                onClick={() => {
                  setShowAddModal(true);
                  setIsEditing(false);
                  setNewClient(emptyClient);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all"
              >
                <Plus size={16} />
                Add Client
              </button>
            </div>

            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">
                  {view === "interested"
                    ? "Interested Clients"
                    : view === "closed"
                    ? "Closed Clients"
                    : "All Clients"}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {filteredClients.length} records
                </p>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[700px]">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-[#FAFAFB] border-b border-gray-100 sticky top-0 z-10">
                    <tr className="text-left text-sm text-gray-400">
                      {["Client", "Company", "Scope", "Contact", "CSR", "Status", ""].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={`px-6 py-4 font-medium ${
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
                        <td colSpan={7} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-4">
                              <Building2 size={32} className="text-[#B8112D]" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700">
                              No Clients Found
                            </h3>
                            <p className="text-sm text-gray-400 mt-2">
                              Try adding a new client or changing your search.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client, i) => (
                        <tr
                          key={client.id}
                          className="border-b border-gray-100 hover:bg-[#FAFAFB]"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] font-semibold shrink-0 text-sm">
                                {client.clientName.charAt(0)}
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-gray-700">
                                  {client.clientName}
                                </h3>
                                <p className="text-xs text-gray-400">
                                  {client.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {client.company}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {client.scope}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {client.contact}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {client.csr}
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
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

                          <td className="px-6 py-4">
                            <div className="hidden md:flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedClient(client)}
                                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  setShowAddModal(true);
                                  setIsEditing(true);
                                  setNewClient(client);
                                }}
                                className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  setClientToDelete(client.id);
                                  setShowDeleteModal(true);
                                }}
                                className="w-9 h-9 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            <div className="relative md:hidden flex justify-end">
                              <button
                                onClick={() => setOpenMenu(openMenu === i ? null : i)}
                                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center bg-white"
                              >
                                <MoreVertical size={18} />
                              </button>

                              {openMenu === i && (
                                <div className="absolute right-0 top-12 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                                  <button
                                    onClick={() => {
                                      setSelectedClient(client);
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Eye size={15} />
                                    View
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
                                    <Pencil size={15} />
                                    Edit
                                  </button>

                                  <button
                                    onClick={() => {
                                      setClientToDelete(client.id);
                                      setShowDeleteModal(true);
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                  >
                                    <Trash2 size={15} />
                                    Delete
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
            </div>
          </>
        )}

        {view === "important" && (
          <>
            <div className="bg-white rounded-[26px] shadow-sm px-5 py-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-[380px]">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by client, company or phone..."
                  value={impSearch}
                  onChange={(e) => {
                    setImpSearch(e.target.value);
                    setSelectedImp(null);
                  }}
                  className="w-full h-[46px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-10 pr-4 text-sm outline-none focus:border-[#B8112D]"
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 text-[#B8112D] font-semibold text-sm whitespace-nowrap">
                  <Filter size={15} />
                  Filter by Schedule
                </div>
                <input
                  type="date"
                  value={impFilterDate}
                  onChange={(e) => {
                    setImpFilterDate(e.target.value);
                    setSelectedImp(null);
                  }}
                  className="h-[46px] rounded-2xl border border-gray-200 px-4 bg-[#FAFAFA] text-sm outline-none focus:border-[#B8112D]"
                />
                {impFilterDate && (
                  <button
                    onClick={() => {
                      setImpFilterDate("");
                      setSelectedImp(null);
                    }}
                    className="h-[46px] px-4 rounded-2xl border border-gray-200 bg-[#FAFAFA] text-sm text-gray-500 hover:text-[#B8112D] transition-all whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div
                className="xl:col-span-5 bg-white rounded-[30px] border border-gray-100 shadow-sm flex flex-col"
                style={{ maxHeight: "calc(100vh - 360px)", minHeight: "380px" }}
              >
                <div className="p-5 pb-4 border-b border-[#F3F3F3] shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[19px] font-bold text-[#0F172A]">
                        Important Clients
                      </h3>
                      <p className="text-gray-500 text-sm mt-0.5">
                        Scheduled follow-up meetings.
                      </p>
                    </div>
                    <div className="bg-[#FFF1F3] text-[#B8112D] text-xs font-semibold px-3 py-1.5 rounded-xl">
                      {importantClients.length} Total
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                  {filteredImportant.length > 0 ? (
                    filteredImportant.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => setSelectedImp(client)}
                        className={`w-full text-left rounded-[22px] border p-4 transition-all ${
                          activeImp?.id === client.id
                            ? "border-[#B8112D] bg-[#FFF8F9]"
                            : "border-gray-100 bg-white hover:border-[#B8112D]/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-sm shrink-0">
                              {client.clientName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-[#0F172A] text-[13px]">
                                {client.clientName}
                              </h4>
                              <p className="text-gray-500 text-[12px] mt-0.5">
                                {client.company}
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold shrink-0 bg-[#FFF7E6] text-[#B54708]">
                            High
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <CircleAlert size={28} className="text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">
                        No important clients found.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {activeImp ? (
                <div
                  className="xl:col-span-7 bg-white rounded-[30px] border border-gray-100 shadow-sm flex flex-col"
                  style={{ maxHeight: "calc(100vh - 360px)", minHeight: "380px" }}
                >
                  <div className="p-5 pb-4 border-b border-[#F3F3F3] shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="text-[20px] font-bold text-[#0F172A]">
                          {activeImp.clientName}
                        </h3>
                        <p className="text-gray-500 text-sm mt-0.5">
                          Follow-up details.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSelectedClient(activeImp)}
                          className="h-10 px-4 rounded-2xl bg-gray-100 text-gray-600 text-sm font-semibold flex items-center gap-2 hover:bg-gray-200 transition-colors"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          onClick={() => {
                            setShowAddModal(true);
                            setIsEditing(true);
                            setNewClient(activeImp);
                          }}
                          className="h-10 px-4 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-[#a30f27] transition-colors"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Contact Number", value: activeImp.contact, Icon: Phone },
                        {
                          label: "Next Schedule",
                          value: activeImp.nextFollowup || "N/A",
                          Icon: CalendarDays,
                        },
                        { label: "Call Time", value: activeImp.time || "N/A", Icon: Clock3 },
                        {
                          label: "Timezone",
                          value: activeImp.timezone || "N/A",
                          Icon: Globe,
                        },
                        { label: "CSR Assigned", value: activeImp.csr, Icon: Users },
                        { label: "Scope", value: activeImp.scope, Icon: Briefcase },
                      ].map(({ label, value, Icon }) => (
                        <div key={label} className="bg-[#FAFAFA] rounded-2xl p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                              <Icon size={16} />
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">{label}</p>
                              <h4 className="font-semibold text-[#0F172A] mt-0.5 text-[13px]">
                                {value}
                              </h4>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <h4 className="text-[16px] font-bold text-[#0F172A]">
                        Follow-up Notes
                      </h4>
                      <div className="bg-[#FAFAFA] rounded-2xl p-4 mt-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                            <User2 size={14} />
                          </div>
                          <p className="text-gray-600 leading-6 text-[13px]">
                            {activeImp.lastComment}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="xl:col-span-7 bg-white rounded-[30px] border border-gray-100 shadow-sm flex items-center justify-center"
                  style={{ minHeight: "380px" }}
                >
                  <div className="text-center">
                    <CircleAlert size={36} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      Select a client to view details
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {selectedClient && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Client Details
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Complete client information.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Client Name", value: selectedClient.clientName },
                  { label: "Email", value: selectedClient.email },
                  { label: "Contact", value: selectedClient.contact },
                  { label: "Company", value: selectedClient.company },
                  { label: "CSR", value: selectedClient.csr },
                ].map((f) => (
                  <div key={f.label} className="bg-[#F8F9FC] p-4 rounded-2xl">
                    <p className="text-xs text-gray-400">{f.label}</p>
                    <h3 className="font-medium text-gray-700 mt-1">
                      {f.value}
                    </h3>
                  </div>
                ))}

                <div className="bg-[#F8F9FC] p-4 rounded-2xl md:col-span-2">
                  <p className="text-xs text-gray-400">Scope of Work</p>
                  <h3 className="font-medium text-gray-700 mt-1">
                    {selectedClient.scope}
                  </h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl md:col-span-2">
                  <div className="flex items-start gap-3">
                    <MessageSquare
                      size={18}
                      className="text-[#B8112D] mt-1 shrink-0"
                    />
                    <div>
                      <p className="text-xs text-gray-400">Last Call Comments</p>
                      <h3 className="font-medium text-gray-700 mt-1">
                        {selectedClient.lastComment}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Delete Client
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                This action cannot be undone.
              </p>

              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mt-4">
                <p className="text-sm text-red-600">
                  Are you sure you want to delete this client permanently?
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setClientToDelete(null);
                  }}
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteClient}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700 transition-all"
                >
                  Delete Client
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    {isEditing ? "Edit Client" : "Add New Client"}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Create and manage client records.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    label: "Client Name",
                    key: "clientName",
                    type: "text",
                    placeholder: "John Smith",
                    req: true,
                  },
                  {
                    label: "Email Address",
                    key: "email",
                    type: "email",
                    placeholder: "john@email.com",
                    req: true,
                  },
                  {
                    label: "Contact Number",
                    key: "contact",
                    type: "text",
                    placeholder: "+1 234 567 890",
                    req: false,
                  },
                  {
                    label: "CSR",
                    key: "csr",
                    type: "text",
                    placeholder: "Customer Service Representative",
                    req: false,
                  },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-sm text-gray-500 mb-2 block">
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
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                    />
                  </div>
                ))}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
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
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  >
                    <option value="">Select Company</option>
                    {[
                      "BEM DESIGN STUDIO",
                      "GPS",
                      "BEM SOLUTIONS",
                      "PS-ESTIMATING",
                      "DEVCON-ESTIMATING",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Status
                  </label>
                  <select
                    value={newClient.status}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        status: e.target.value as Client["status"],
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  >
                    {["Active", "Pending", "Closed", "Interested"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500 mb-2 block">
                    Scope of Work
                  </label>
                  <textarea
                    rows={3}
                    value={newClient.scope}
                    placeholder="Write project scope..."
                    onChange={(e) =>
                      setNewClient({ ...newClient, scope: e.target.value })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none focus:border-[#B8112D]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500 mb-2 block">
                    Last Call Comments
                  </label>
                  <textarea
                    rows={4}
                    value={newClient.lastComment}
                    placeholder="Write discussion notes..."
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        lastComment: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none focus:border-[#B8112D]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveClient}
                  className="px-6 py-3 rounded-2xl bg-[#B8112D] text-white hover:bg-[#a30f27] transition-all"
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