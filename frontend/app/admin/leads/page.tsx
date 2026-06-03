"use client";

import { useEffect, useState } from "react";
import API from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";

import {
  Search, Plus, Building2, Phone, Mail, CheckCircle2,
  MoreVertical, Eye, Pencil, Trash2, ChevronDown,
  LayoutGrid, HeartHandshake, BadgeCheck, Users,
  ChevronUp, MessageSquare, X,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar  from "../components/Navbar";

/* ================= TYPES ================= */

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
  csr: string;
};

/* ================= PAGE ================= */

export default function ClientsPage() {

  const [clients,         setClients]         = useState<Client[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [statusFilter,    setStatusFilter]    = useState<"all" | "interested" | "closed">("all");
  const [csrFilter,       setCsrFilter]       = useState("all");
  const [search,          setSearch]          = useState("");
  const [openMenu,        setOpenMenu]        = useState<number | null>(null);
  const [selectedClient,  setSelectedClient]  = useState<Client | null>(null);
  const [showCompanies,   setShowCompanies]   = useState(false);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [isEditing,       setIsEditing]       = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete,  setClientToDelete]  = useState<string | null>(null);

  const emptyClient: Client = {
    id: "", clientName: "", email: "", contact: "", company: "",
    parentCompany: "", scope: "", lastEmail: "", lastCall: "",
    lastComment: "", status: "Active", csr: "",
  };

  const [newClient, setNewClient] = useState<Client>(emptyClient);

  /* ================= FETCH ================= */

  const fetchClients = async () => {
    try {
      const res = await API.get("/admin/clients");
      const formatted = res.data.leads.map((lead: {
        id: string; name?: string; email?: string; phone?: string;
        company?: string; interestedService?: string; comments?: string;
        updatedAt?: string; status?: string;
        uploadFile?: { companyName?: string };
        csr?: { name?: string };
      }) => ({
        id:            lead.id,
        clientName:    lead.name             || "Unknown",
        email:         lead.email            || "N/A",
        contact:       lead.phone            || "N/A",
        company:       lead.company          || lead.uploadFile?.companyName || "N/A",
        parentCompany: lead.uploadFile?.companyName || lead.company || "N/A",
        scope:         lead.interestedService || "N/A",
        lastEmail:     "",
        lastCall:      lead.updatedAt?.split("T")[0] || "",
        lastComment:   lead.comments         || "No comments",
        status:
          lead.status === "interested"  ? "Interested" :
          ["closed","completed","project won"].includes(lead.status ?? "") ? "Closed" :
          lead.status === "pending"     ? "Pending" : "Active",
        csr: lead.csr?.name || "Unassigned",
      }));
      setClients(formatted);
    } catch (error) {
      console.log(error);
      toast.error("Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  let mounted = true;

  const load = async () => {
    try {
      const res = await API.get("/admin/clients");
      if (!mounted) return;

      const formatted = res.data.leads.map((lead: {
        id: string; name?: string; email?: string; phone?: string;
        company?: string; interestedService?: string; comments?: string;
        updatedAt?: string; status?: string;
        uploadFile?: { companyName?: string };
        csr?: { name?: string };
      }) => ({
        id:            lead.id,
        clientName:    lead.name              || "Unknown",
        email:         lead.email             || "N/A",
        contact:       lead.phone             || "N/A",
        company:       lead.company           || lead.uploadFile?.companyName || "N/A",
        parentCompany: lead.uploadFile?.companyName || lead.company || "N/A",
        scope:         lead.interestedService || "N/A",
        lastEmail:     "",
        lastCall:      lead.updatedAt?.split("T")[0] || "",
        lastComment:   lead.comments          || "No comments",
        status:
          lead.status === "interested" ? "Interested" :
          ["closed","completed","project won"].includes(lead.status ?? "") ? "Closed" :
          lead.status === "pending"    ? "Pending" : "Active",
        csr: lead.csr?.name || "Unassigned",
      }));

      setClients(formatted);
    } catch (error) {
      console.log(error);
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

  const csrOptions = Array.from(new Set(clients.map(c => c.csr)));

  /* ================= FILTER ================= */

  const filteredClients = clients.filter(client => {
    const q = search.toLowerCase();
    const matchesSearch =
      client.clientName.toLowerCase().includes(q) ||
      client.company.toLowerCase().includes(q)    ||
      client.scope.toLowerCase().includes(q)      ||
      client.csr.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all"        ? true :
      statusFilter === "interested" ? client.status === "Interested" :
      client.status === "Closed";
    const matchesCSR = csrFilter === "all" ? true : client.csr === csrFilter;
    return matchesSearch && matchesStatus && matchesCSR;
  });

  /* ================= SAVE ================= */

  const handleSaveClient = () => {
    if (!newClient.clientName || !newClient.email || !newClient.company) {
      toast.error("Please fill all required fields."); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) {
      toast.error("Please enter valid email."); return;
    }
    if (isEditing) {
      setClients(prev => prev.map(c => c.id === newClient.id ? newClient : c));
      toast.success("Client updated successfully.");
    } else {
      setClients(prev => [{ ...newClient, id: Date.now().toString() }, ...prev]);
      toast.success("Client added successfully.");
    }
    setShowAddModal(false);
    setIsEditing(false);
    setNewClient(emptyClient);
  };

  /* ================= DELETE ================= */

  const handleDeleteClient = () => {
    if (!clientToDelete) return;
    setClients(prev => prev.filter(c => c.id !== clientToDelete));
    toast.success("Client deleted successfully.");
    setShowDeleteModal(false);
    setClientToDelete(null);
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F5F6FA]">
        <DashboardSidebar />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
          <DashboardNavbar />
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-[#B8112D] border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
              <p className="text-gray-500">Loading clients...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      <Toaster position="top-right" reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: { background:"#fff", color:"#111827", borderRadius:"16px", padding:"14px 16px", border:"1px solid #E5E7EB", boxShadow:"0 10px 25px rgba(0,0,0,0.08)", fontSize:"14px", fontWeight:"500" },
          success: { iconTheme: { primary:"#16A34A", secondary:"#fff" } },
          error:   { iconTheme: { primary:"#DC2626", secondary:"#fff" } },
        }}
      />

      <DashboardSidebar />

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar />

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800">Client Management</h1>
          <p className="text-sm text-gray-400 mt-1">Manage clients, conversations, and company records.</p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Clients</p>
                <h2 className="text-3xl font-semibold text-gray-800 mt-2">{clients.length}</h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#F8ECEF] flex items-center justify-center">
                <Building2 size={26} className="text-[#B8112D]"/>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Clients</p>
                <h2 className="text-3xl font-semibold text-gray-800 mt-2">{clients.filter(c => c.status === "Active").length}</h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={26} className="text-green-600"/>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Follow Ups</p>
                <h2 className="text-3xl font-semibold text-gray-800 mt-2">14</h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Phone size={26} className="text-blue-600"/>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Emails Sent</p>
                <h2 className="text-3xl font-semibold text-gray-800 mt-2">42</h2>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center">
                <Mail size={26} className="text-yellow-600"/>
              </div>
            </div>
          </div>
        </div>

        {/* PARENT COMPANIES */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-6">
          <button onClick={() => setShowCompanies(!showCompanies)} className="w-full flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 text-left">Parent Companies</h2>
              <p className="text-sm text-gray-400 mt-1 text-left">Company groups and associated clients.</p>
            </div>
            {showCompanies ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
          </button>
          <div className={`overflow-hidden transition-all duration-300 ${showCompanies ? "max-h-[500px] mt-6" : "max-h-0"}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {["BEM DESIGN STUDIO","GPS","BEM SOLUTIONS","PS-ESTIMATING","DEVCON-ESTIMATING"].map((company, i) => (
                <div key={i} className="bg-[#FAFAFB] border border-gray-100 rounded-2xl p-4">
                  <h3 className="font-semibold text-gray-700">{company}</h3>
                  <p className="text-sm text-gray-400 mt-2">Active Projects & Clients</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* ALL */}
          <button onClick={() => setStatusFilter("all")}
            className={`group rounded-3xl border p-5 text-left transition-all duration-300 hover:-translate-y-1 ${statusFilter === "all" ? "bg-[#B8112D] text-white border-[#B8112D] shadow-lg shadow-red-200" : "bg-white border-gray-100 hover:border-[#B8112D]/20"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${statusFilter === "all" ? "text-white/70" : "text-gray-400"}`}>Filter</p>
                <h3 className="font-semibold text-lg mt-2">All</h3>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${statusFilter === "all" ? "bg-white/20" : "bg-red-50"}`}>
                <LayoutGrid size={22}/>
              </div>
            </div>
            <span className={`inline-flex mt-4 px-3 py-1 rounded-full text-xs font-medium ${statusFilter === "all" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>All Records</span>
          </button>

          {/* INTERESTED */}
          <button onClick={() => setStatusFilter("interested")}
            className={`group rounded-3xl border p-5 text-left transition-all duration-300 hover:-translate-y-1 ${statusFilter === "interested" ? "bg-[#B8112D] text-white border-[#B8112D] shadow-lg shadow-red-200" : "bg-white border-gray-100 hover:border-[#B8112D]/20"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${statusFilter === "interested" ? "text-white/70" : "text-gray-400"}`}>Clients</p>
                <h3 className="font-semibold text-lg mt-2">Interested</h3>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${statusFilter === "interested" ? "bg-white/20" : "bg-orange-50 text-orange-600"}`}>
                <HeartHandshake size={22}/>
              </div>
            </div>
            <span className={`inline-flex mt-4 px-3 py-1 rounded-full text-xs font-medium ${statusFilter === "interested" ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700"}`}>Warm Leads</span>
          </button>

          {/* CLOSED */}
          <button onClick={() => setStatusFilter("closed")}
            className={`group rounded-3xl border p-5 text-left transition-all duration-300 hover:-translate-y-1 ${statusFilter === "closed" ? "bg-[#B8112D] text-white border-[#B8112D] shadow-lg shadow-red-200" : "bg-white border-gray-100 hover:border-[#B8112D]/20"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${statusFilter === "closed" ? "text-white/70" : "text-gray-400"}`}>Clients</p>
                <h3 className="font-semibold text-lg mt-2">Closed</h3>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${statusFilter === "closed" ? "bg-white/20" : "bg-green-50 text-green-600"}`}>
                <BadgeCheck size={22}/>
              </div>
            </div>
            <span className={`inline-flex mt-4 px-3 py-1 rounded-full text-xs font-medium ${statusFilter === "closed" ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}>Converted</span>
          </button>

          {/* CSR FILTER */}
          <div className="bg-white rounded-3xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400">CSR</p>
                <h3 className="font-semibold text-lg text-gray-800 mt-2">{csrFilter === "all" ? "All CSR" : csrFilter}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={22}/>
              </div>
            </div>
            <select value={csrFilter} onChange={e => setCsrFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#B8112D]">
              <option value="all">All CSR</option>
              {csrOptions.map(csr => <option key={csr} value={csr}>{csr}</option>)}
            </select>
          </div>
        </div>

        {/* SEARCH + ADD */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="relative w-full sm:w-[320px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search clients..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
          <button onClick={() => { setShowAddModal(true); setIsEditing(false); setNewClient(emptyClient); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all">
            <Plus size={16}/>Add Client
          </button>
        </div>

        {/* ================= TABLE ================= */}
        {/* Columns: Client, Company, Scope, Contact, CSR, Status, Actions */}
        {/* Non-required (Last Email, Last Call, Comments) → moved to View modal */}

        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto overflow-y-auto max-h-[700px]">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[#FAFAFB] border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left text-sm text-gray-400">
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium">Company</th>
                  <th className="px-6 py-4 font-medium">Scope</th>
                  <th className="px-6 py-4 font-medium">Contact</th>
                  <th className="px-6 py-4 font-medium">CSR</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-4">
                          <Building2 size={32} className="text-[#B8112D]"/>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700">No Clients Found</h3>
                        <p className="text-sm text-gray-400 mt-2">Try adding a new client or changing your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredClients.map((client, i) => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-[#FAFAFB]">

                    {/* CLIENT */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] font-semibold shrink-0">
                          {client.clientName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700">{client.clientName}</h3>
                          <p className="text-xs text-gray-400">{client.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* COMPANY */}
                    <td className="px-6 py-5 text-sm text-gray-600">{client.company}</td>

                    {/* SCOPE */}
                    <td className="px-6 py-5 text-sm text-gray-600">{client.scope}</td>

                    {/* CONTACT */}
                    <td className="px-6 py-5 text-sm text-gray-500">{client.contact}</td>

                    {/* CSR */}
                    <td className="px-6 py-5 text-sm text-gray-600">{client.csr}</td>

                    {/* STATUS */}
                    <td className="px-6 py-5">
                      <span className={`px-4 py-2 rounded-full text-xs font-medium ${
                        client.status === "Active"     ? "bg-green-100 text-green-700"  :
                        client.status === "Pending"    ? "bg-yellow-100 text-yellow-700":
                        client.status === "Interested" ? "bg-blue-100 text-blue-700"   :
                        "bg-gray-100 text-gray-600"
                      }`}>{client.status}</span>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-5">
                      {/* Desktop */}
                      <div className="hidden md:flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedClient(client)}
                          className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
                          title="View details">
                          <Eye size={16}/>
                        </button>
                        <button onClick={() => { setShowAddModal(true); setIsEditing(true); setNewClient(client); }}
                          className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all"
                          title="Edit client">
                          <Pencil size={16}/>
                        </button>
                        <button onClick={() => { setClientToDelete(client.id); setShowDeleteModal(true); }}
                          className="w-10 h-10 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                          title="Delete client">
                          <Trash2 size={16}/>
                        </button>
                      </div>

                      {/* Mobile */}
                      <div className="relative md:hidden flex justify-end">
                        <button onClick={() => setOpenMenu(openMenu === i ? null : i)}
                          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center bg-white">
                          <MoreVertical size={18}/>
                        </button>
                        {openMenu === i && (
                          <div className="absolute right-0 top-12 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                            <button onClick={() => { setSelectedClient(client); setOpenMenu(null); }}
                              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                              <Eye size={15}/>View
                            </button>
                            <button onClick={() => { setShowAddModal(true); setIsEditing(true); setNewClient(client); setOpenMenu(null); }}
                              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                              <Pencil size={15}/>Edit
                            </button>
                            <button onClick={() => { setClientToDelete(client.id); setShowDeleteModal(true); setOpenMenu(null); }}
                              className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2">
                              <Trash2 size={15}/>Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= VIEW MODAL ================= */}
        {/* Shows ALL fields including Last Email, Last Call, Comments */}

        {selectedClient && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">Client Details</h2>
                  <p className="text-sm text-gray-400 mt-1">Complete client information.</p>
                </div>
                <button onClick={() => setSelectedClient(null)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <X size={18}/>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">Client Name</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.clientName}</h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">Email</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.email}</h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">Contact</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.contact}</h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">Company</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.company}</h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">CSR</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.csr}</h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">Status</p>
                  <span className={`inline-flex mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                    selectedClient.status === "Active"     ? "bg-green-100 text-green-700"  :
                    selectedClient.status === "Pending"    ? "bg-yellow-100 text-yellow-700":
                    selectedClient.status === "Interested" ? "bg-blue-100 text-blue-700"   :
                    "bg-gray-100 text-gray-600"
                  }`}>{selectedClient.status}</span>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl md:col-span-2">
                  <p className="text-xs text-gray-400">Scope of Work</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.scope}</h3>
                </div>

                {/* ── Non-required fields shown only here ── */}

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">Last Email Date</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.lastEmail || "—"}</h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">Last Call Date</p>
                  <h3 className="font-medium text-gray-700 mt-1">{selectedClient.lastCall || "—"}</h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl md:col-span-2">
                  <div className="flex items-start gap-3">
                    <MessageSquare size={18} className="text-[#B8112D] mt-1 shrink-0"/>
                    <div>
                      <p className="text-xs text-gray-400">Last Call Comments</p>
                      <h3 className="font-medium text-gray-700 mt-1">{selectedClient.lastComment}</h3>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ================= DELETE MODAL ================= */}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">Delete Client</h2>
                  <p className="text-sm text-gray-400 mt-1">This action cannot be undone.</p>
                </div>
                <button onClick={() => { setShowDeleteModal(false); setClientToDelete(null); }}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <X size={18}/>
                </button>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-sm text-red-600">Are you sure you want to delete this client permanently?</p>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button onClick={() => { setShowDeleteModal(false); setClientToDelete(null); }}
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button onClick={handleDeleteClient}
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700 transition-all">
                  Delete Client
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ADD / EDIT MODAL ================= */}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">{isEditing ? "Edit Client" : "Add New Client"}</h2>
                  <p className="text-sm text-gray-400 mt-1">Create and manage client records.</p>
                </div>
                <button onClick={() => setShowAddModal(false)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <X size={18}/>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Client Name <span className="text-[#B8112D]">*</span></label>
                  <input type="text" value={newClient.clientName} placeholder="John Smith"
                    onChange={e => setNewClient({ ...newClient, clientName: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"/>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Email Address <span className="text-[#B8112D]">*</span></label>
                  <input type="email" value={newClient.email} placeholder="john@email.com"
                    onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"/>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Contact Number</label>
                  <input type="text" value={newClient.contact} placeholder="+1 234 567 890"
                    onChange={e => setNewClient({ ...newClient, contact: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"/>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Company Name <span className="text-[#B8112D]">*</span></label>
                  <select value={newClient.company}
                    onChange={e => setNewClient({ ...newClient, company: e.target.value, parentCompany: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]">
                    <option value="">Select Company</option>
                    <option value="BEM DESIGN STUDIO">BEM DESIGN STUDIO</option>
                    <option value="GPS">GPS</option>
                    <option value="BEM SOLUTIONS">BEM SOLUTIONS</option>
                    <option value="PS-ESTIMATING">PS-ESTIMATING</option>
                    <option value="DEVCON-ESTIMATING">DEVCON-ESTIMATING</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">CSR</label>
                  <input type="text" value={newClient.csr} placeholder="Customer Service Representative"
                    onChange={e => setNewClient({ ...newClient, csr: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"/>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Status</label>
                  <select value={newClient.status}
                    onChange={e => setNewClient({ ...newClient, status: e.target.value as Client["status"] })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]">
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Closed">Closed</option>
                    <option value="Interested">Interested</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500 mb-2 block">Scope of Work</label>
                  <textarea rows={3} value={newClient.scope} placeholder="Write project scope..."
                    onChange={e => setNewClient({ ...newClient, scope: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none focus:border-[#B8112D]"/>
                </div>

                {/* Non-required extras */}
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Last Email Date</label>
                  <input type="date" value={newClient.lastEmail}
                    onChange={e => setNewClient({ ...newClient, lastEmail: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"/>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">Last Call Date</label>
                  <input type="date" value={newClient.lastCall}
                    onChange={e => setNewClient({ ...newClient, lastCall: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"/>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500 mb-2 block">Last Call Comments</label>
                  <textarea rows={4} value={newClient.lastComment} placeholder="Write discussion notes..."
                    onChange={e => setNewClient({ ...newClient, lastComment: e.target.value })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none focus:border-[#B8112D]"/>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)}
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button onClick={handleSaveClient}
                  className="px-6 py-3 rounded-2xl bg-[#B8112D] text-white hover:bg-[#a30f27] transition-all">
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