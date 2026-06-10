"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users, UserPlus, Search, Filter, TrendingUp,
  Phone, Briefcase, Clock3, Building2, AlignLeft,
  RefreshCw, Eye, Plus, X, Pencil, User2,
  BarChart2, CalendarDays, PenTool, Monitor,
  CheckCircle2,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";

/* ─── service options (same as projects page) ─── */
const serviceOptions = [
  { value: "Estimating",   label: "Estimating",   Icon: BarChart2   },
  { value: "Scheduling",   label: "Scheduling",   Icon: CalendarDays },
  { value: "Shop Drawing", label: "Shop Drawing", Icon: PenTool     },
  { value: "Drafting",     label: "Drafting",     Icon: Pencil      },
  { value: "BIM",          label: "BIM",          Icon: Building2   },
  { value: "IT",           label: "IT",           Icon: Monitor     },
];

/* ─── safe statuses for manual edit (no redistribution side-effects) ─── */
const EDIT_STATUSES = ["pending", "important", "interested", "Close Client", "completed"];

const STATUS_COLORS: Record<string, string> = {
  "pending":        "bg-gray-100 text-gray-600",
  "important":      "bg-amber-50 text-amber-700",
  "interested":     "bg-green-50 text-green-700",
  "Not Interested": "bg-red-50 text-red-600",
  "not picked":     "bg-orange-50 text-orange-600",
  "not completed":  "bg-orange-50 text-orange-600",
  "Close Client":   "bg-blue-50 text-blue-700",
  "completed":      "bg-emerald-50 text-emerald-700",
};

type Lead = {
  id:                string;
  name:              string;
  company:           string;
  phone:             string;
  status:            string;
  interestedService: string;
  comments:          string;
  isOldClient:       boolean;
  createdAt:         string;
};

const emptyAdd = { name: "", phone: "", company: "", service: "", comments: "" };

export default function LeadsPage() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<"new" | "old">("new");
  const [search,    setSearch]    = useState("");

  /* ── detail / edit modal ── */
  const [viewing,      setViewing]      = useState<Lead | null>(null);
  const [isEditing,    setIsEditing]    = useState(false);
  const [editService,  setEditService]  = useState("");
  const [editStatus,   setEditStatus]   = useState("");
  const [editComments, setEditComments] = useState("");
  const [saving,       setSaving]       = useState(false);

  /* ── add new modal ── */
  const [showAdd,   setShowAdd]   = useState(false);
  const [addForm,   setAddForm]   = useState(emptyAdd);
  const [addSaving, setAddSaving] = useState(false);
  const [addError,  setAddError]  = useState("");

  /* ── notepad ── */
  const [noteModal,  setNoteModal]  = useState<{ id: string; name: string; mode: "view" | "edit" } | null>(null);
  const [noteDraft,  setNoteDraft]  = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const openNote = (lead: Lead, mode: "view" | "edit") => {
    setNoteModal({ id: lead.id, name: lead.name, mode });
    setNoteDraft(lead.comments ?? "");
  };

  const saveNote = async () => {
    if (!noteModal) return;
    setNoteSaving(true);
    try {
      await API.patch(`/csr/lead/${noteModal.id}/note`, { comments: noteDraft });
      setLeads(prev => prev.map(l => l.id === noteModal.id ? { ...l, comments: noteDraft } : l));
      setNoteModal(null);
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  };

  /* ─── FETCH ─── */
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/leads");
      const formatted: Lead[] = (res.data.leads ?? []).map((l: {
        id: string; name?: string; company?: string;
        uploadFile?: { companyName?: string }; phone?: string;
        status?: string; interestedService?: string;
        comments?: string; isOldClient?: boolean; createdAt?: string;
      }) => ({
        id:                l.id,
        name:              l.name              ?? "Unknown",
        company:           l.uploadFile?.companyName ?? l.company ?? "N/A",
        phone:             l.phone             ?? "N/A",
        status:            l.status            ?? "pending",
        interestedService: l.interestedService ?? "",
        comments:          l.comments          ?? "",
        isOldClient:       l.isOldClient       ?? false,
        createdAt:         l.createdAt         ?? "",
      }));
      setLeads(formatted);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  /// Fetch leads on mount with a slight delay to ensure smooth initial render
  useEffect(() => {
    const t = window.setTimeout(() => { void fetchLeads(); }, 0);
    return () => window.clearTimeout(t);
  }, []);

  /* ─── DERIVED ─── */
  const newLeads    = useMemo(() => leads.filter(l => !l.isOldClient), [leads]);
  const oldLeads    = useMemo(() => leads.filter(l =>  l.isOldClient), [leads]);
  const closedLeads = useMemo(() =>
    leads.filter(l => l.status === "Close Client" || l.status === "completed"),
  [leads]);

  const baseList = activeTab === "new" ? newLeads : oldLeads;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? baseList : baseList.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) ||
      l.phone.includes(q)
    );
  }, [baseList, search]);

  /* ─── OPEN DETAIL ─── */
  const openDetail = (lead: Lead) => {
    setViewing(lead);
    setIsEditing(false);
  };

  /* ─── START EDIT ─── */
  const startEdit = () => {
    if (!viewing) return;
    setEditService(viewing.interestedService);
    setEditStatus(viewing.status);
    setEditComments(viewing.comments);
    setIsEditing(true);
  };

  /* ─── SAVE EDIT ─── */
  const saveEdit = async () => {
    if (!viewing) return;
    setSaving(true);
    try {
      await API.put(`/csr/lead/${viewing.id}`, {
        interestedService: editService  || undefined,
        status:            editStatus   || undefined,
        comments:          editComments || undefined,
      });
      const updated: Lead = {
        ...viewing,
        interestedService: editService,
        status:            editStatus,
        comments:          editComments,
      };
      setLeads(prev => prev.map(l => l.id === viewing.id ? updated : l));
      setViewing(updated);
      setIsEditing(false);
    } catch (err) {
      console.log(err);
    }
    setSaving(false);
  };

  /* ─── ADD NEW LEAD ─── */
  const handleAdd = async () => {
    if (!addForm.name.trim()) { setAddError("Client name is required."); return; }
    setAddSaving(true);
    setAddError("");
    try {
      const res = await API.post("/csr/lead", {
        name:              addForm.name.trim(),
        phone:             addForm.phone.trim()    || undefined,
        company:           addForm.company.trim()  || undefined,
        interestedService: addForm.service         || undefined,
        comments:          addForm.comments.trim() || undefined,
      });
      const nl = res.data.lead;
      const fresh: Lead = {
        id:                String(nl?.id ?? Date.now()),
        name:              addForm.name.trim(),
        company:           addForm.company.trim() || "N/A",
        phone:             addForm.phone.trim()   || "N/A",
        status:            "pending",
        interestedService: addForm.service,
        comments:          addForm.comments.trim(),
        isOldClient:       false,
        createdAt:         new Date().toISOString(),
      };
      setLeads(prev => [fresh, ...prev]);
      setShowAdd(false);
      setAddForm(emptyAdd);
    } catch (err) {
      console.log(err);
      setAddError("Failed to add lead. Please try again.");
    }
    setAddSaving(false);
  };

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }}/>
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* HEADER */}
        <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[30px] sm:text-[36px] font-bold text-[#0F172A]">My Leads</h1>
            <p className="text-gray-500 mt-1 text-sm">New = first-time clients · Old = repeat business (more than 1 lead).</p>
          </div>
          <button
            onClick={() => { setAddForm(emptyAdd); setAddError(""); setShowAdd(true); }}
            className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] transition-colors shrink-0"
          >
            <Plus size={16}/>Add New Lead
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {([
            { label:"Total Leads", value: leads.length,       sub:"all assigned",       color:"bg-[#EFF6FF] text-[#1D4ED8]", Icon: Users      },
            { label:"New Clients", value: newLeads.length,    sub:"first-time clients", color:"bg-[#F0FDF4] text-[#15803D]", Icon: UserPlus   },
            { label:"Old Clients", value: oldLeads.length,    sub:"repeat business",    color:"bg-[#FFFBEB] text-[#B45309]", Icon: User2      },
            { label:"Closed",      value: closedLeads.length, sub:"projects done",      color:"bg-[#F0FDF4] text-[#15803D]", Icon: TrendingUp },
          ] as const).map(card => (
            <div key={card.label} className="bg-white rounded-[22px] p-4 border border-white shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[12px] font-medium">{card.label}</p>
                  <h2 className="text-[28px] font-bold text-[#0F172A] mt-1">{card.value}</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
                </div>
                <div className={`w-11 h-11 rounded-2xl ${card.color} flex items-center justify-center shrink-0`}>
                  <card.Icon size={20}/>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-3 mb-5">
          {([
            { key:"new", label:"New Clients", count: newLeads.length },
            { key:"old", label:"Old Clients", count: oldLeads.length },
          ] as const).map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`h-11 px-5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all ${
                activeTab === tab.key
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"
              }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${activeTab === tab.key ? "bg-white/20" : "bg-[#FFF1F3]"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* SEARCH BAR */}
        <div className="bg-white rounded-[26px] shadow-sm px-5 py-4 mb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-[400px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder="Live search by name, company or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-[46px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-10 pr-4 text-sm outline-none focus:border-[#B8112D] transition-colors"
            />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => void fetchLeads()}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" title="Refresh">
              <RefreshCw size={15} className="text-gray-500"/>
            </button>
            <div className="flex items-center gap-2 text-[#B8112D] text-sm font-semibold">
              <Filter size={15}/>
              <span>{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* ─── TABLE ─── */}
        {loading ? (
          <div className="bg-white rounded-[30px] shadow-sm p-6 space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0"/>
                <div className="flex-1 grid grid-cols-5 gap-4">
                  {[1,2,3,4,5].map(j => <div key={j} className="h-4 bg-gray-100 rounded"/>)}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="bg-white rounded-[30px] shadow-sm overflow-hidden">
            {/* Header row — desktop */}
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_56px] gap-4 px-6 py-4 border-b border-[#F3F3F3] bg-[#FAFAFA]">
              {["Client / Type","Company","Phone","Service","Status",""].map(h => (
                <span key={h} className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {/* Data rows */}
            <div className="divide-y divide-[#F3F3F3]">
              {filtered.map(lead => (
                <div key={lead.id}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_56px] gap-3 md:gap-4 px-4 md:px-6 py-4 items-center hover:bg-[#FAFAFA] transition-colors"
                >
                  {/* Client + Type */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white ${
                      lead.isOldClient ? "bg-amber-500" : "bg-[#15803D]"
                    }`}>
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{lead.name}</p>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg mt-0.5 ${
                        lead.isOldClient ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                      }`}>
                        {lead.isOldClient ? "Old Client" : "New Client"}
                      </span>
                    </div>
                  </div>

                  {/* Company — hidden on mobile */}
                  <p className="hidden md:block text-sm text-[#0F172A] truncate">{lead.company}</p>

                  {/* Phone — hidden on mobile */}
                  <p className="hidden md:block text-sm text-[#0F172A]">{lead.phone}</p>

                  {/* Service — hidden on mobile */}
                  <p className={`hidden md:block text-sm truncate ${lead.interestedService ? "text-[#0F172A]" : "text-gray-400"}`}>
                    {lead.interestedService || "N/A"}
                  </p>

                  {/* Status — hidden on mobile */}
                  <div className="hidden md:flex items-center">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap ${
                      STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"
                    }`}>
                      {lead.status}
                    </span>
                  </div>

                  {/* Action icons */}
                  <div className="flex justify-end md:justify-center gap-2">
                    <button
                      onClick={() => openNote(lead, "view")}
                      className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                      title="View note"
                    >
                      <AlignLeft size={15}/>
                    </button>
                    <button
                      onClick={() => openNote(lead, "edit")}
                      className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                      title="Edit note"
                    >
                      <Pencil size={15}/>
                    </button>
                    <button
                      onClick={() => openDetail(lead)}
                      className="w-9 h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                      title="View details"
                    >
                      <Eye size={15}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[30px] shadow-sm p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center mx-auto mb-5">
              <Users size={28}/>
            </div>
            <h2 className="text-[22px] font-bold text-[#0F172A]">No Leads Found</h2>
            <p className="text-gray-500 mt-2 text-sm">
              {search ? "No leads match your search." : "No leads assigned yet."}
            </p>
            {!search && (
              <button
                onClick={() => { setAddForm(emptyAdd); setAddError(""); setShowAdd(true); }}
                className="mt-5 inline-flex items-center gap-2 h-11 px-6 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold hover:bg-[#a30f27] transition-colors"
              >
                <Plus size={15}/>Add New Lead
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            NOTE MODAL
        ══════════════════════════════════════ */}
        {noteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlignLeft size={18}/>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">Note</h2>
                    <p className="text-xs text-gray-400">{noteModal.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {noteModal.mode === "view" ? (
                    <button onClick={() => setNoteModal(m => m ? { ...m, mode: "edit" } : m)}
                      className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-all" title="Edit note">
                      <Pencil size={15}/>
                    </button>
                  ) : (
                    <button onClick={() => setNoteModal(m => m ? { ...m, mode: "view" } : m)}
                      className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-all" title="View note">
                      <Eye size={15}/>
                    </button>
                  )}
                  <button onClick={() => setNoteModal(null)}
                    className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
                    <X size={15}/>
                  </button>
                </div>
              </div>

              {noteModal.mode === "view" ? (
                <div className="min-h-[160px] bg-[#FAFAFA] rounded-2xl border border-gray-100 p-4">
                  {noteDraft ? (
                    <p className="text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap">{noteDraft}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No note written yet. Click the pen icon to add one.</p>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    placeholder="Write your note here..."
                    rows={6}
                    className="w-full rounded-2xl border border-gray-200 bg-[#FAFAFA] p-4 text-sm outline-none focus:border-[#B8112D] resize-none transition-colors"
                    autoFocus
                  />
                  <div className="flex justify-end gap-3 mt-4">
                    <button onClick={() => setNoteModal(null)}
                      className="px-5 py-2.5 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm transition-all">
                      Cancel
                    </button>
                    <button onClick={saveNote} disabled={noteSaving}
                      className="px-6 py-2.5 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold hover:bg-[#a30f27] disabled:opacity-60 transition-all">
                      {noteSaving ? "Saving…" : "Save Note"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            ADD NEW LEAD MODAL
        ══════════════════════════════════════ */}
        {showAdd && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-[520px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight:"92vh" }}>

              {/* Header */}
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none"/>
                <button onClick={() => setShowAdd(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={15}/>
                </button>
                <div className="flex items-center gap-3 pr-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Plus size={22} className="text-white"/>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">Add New Lead</h2>
                    <p className="text-white/65 text-xs mt-0.5">Manually add a potential client</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-5 sm:px-6 py-5 space-y-5">

                  {addError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl">{addError}</div>
                  )}

                  {/* Client info */}
                  <div className="bg-[#F8F9FC] rounded-2xl p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <User2 size={14} className="text-[#B8112D]"/>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Client Information</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Client Name <span className="text-[#B8112D]">*</span>
                      </label>
                      <input type="text" value={addForm.name} placeholder="e.g. John Smith"
                        onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Company</label>
                        <input type="text" value={addForm.company} placeholder="Company name"
                          onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}
                          className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"/>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Phone</label>
                        <input type="text" value={addForm.phone} placeholder="+1 234 567 890"
                          onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full h-11 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"/>
                      </div>
                    </div>
                  </div>

                  {/* Service */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Briefcase size={11} className="text-[#B8112D]"/>Service Interested In
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {serviceOptions.map(({ value, label, Icon }) => {
                        const isSel = addForm.service === value;
                        return (
                          <button key={value}
                            onClick={() => setAddForm(f => ({ ...f, service: f.service === value ? "" : value }))}
                            className={`relative py-3 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-[11px] font-semibold ${
                              isSel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"
                            }`}
                          >
                            {isSel && (
                              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-[#B8112D] rounded-full flex items-center justify-center">
                                <CheckCircle2 size={9} className="text-white"/>
                              </span>
                            )}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}>
                              <Icon size={15} className={isSel ? "text-[#B8112D]" : "text-gray-400"}/>
                            </div>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <AlignLeft size={11} className="text-[#B8112D]"/>Comments
                    </label>
                    <textarea value={addForm.comments} placeholder="Any notes about this lead..." rows={3}
                      onChange={e => setAddForm(f => ({ ...f, comments: e.target.value }))}
                      className="w-full rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"/>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pb-2">
                    <button onClick={() => setShowAdd(false)}
                      className="flex-1 h-12 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleAdd} disabled={addSaving}
                      className={`flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                        !addSaving
                          ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200"
                          : "bg-gray-200 cursor-not-allowed text-gray-400"
                      }`}>
                      {addSaving
                        ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Saving...</>
                        : <><Plus size={15}/>Add Lead</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            DETAIL / EDIT MODAL
        ══════════════════════════════════════ */}
        {viewing && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-[540px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight:"92vh" }}>

              {/* Header */}
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none"/>
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none"/>
                <button onClick={() => { setViewing(null); setIsEditing(false); }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={15}/>
                </button>
                <div className="flex items-center gap-3 pr-10">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg shrink-0 ${
                    viewing.isOldClient ? "bg-amber-500/40" : "bg-white/20"
                  }`}>
                    {viewing.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate">
                      {isEditing ? "Edit Lead" : viewing.name}
                    </h2>
                    <p className="text-white/65 text-xs mt-0.5 truncate">{viewing.company}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    viewing.isOldClient
                      ? "bg-amber-400/25 text-amber-100 border border-amber-300/30"
                      : "bg-green-500/25 text-green-100 border border-green-400/30"
                  }`}>
                    {viewing.isOldClient ? "Old Client" : "New Client"}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-white/15 text-white/80 px-2.5 py-1 rounded-full text-[11px]">
                    {viewing.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-5 sm:px-6 py-5 space-y-4">

                  {/* VIEW MODE */}
                  {!isEditing && (
                    <>
                      <button onClick={startEdit}
                        className="w-full h-10 rounded-2xl bg-[#FFF1F3] border border-[#f5c5ce] text-[#B8112D] text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#fce8ec] transition-colors">
                        <Pencil size={13}/> Edit Lead
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { Icon: Phone,    label:"Phone",   value: viewing.phone                      },
                          { Icon: Building2,label:"Company", value: viewing.company                    },
                          { Icon: Briefcase,label:"Service", value: viewing.interestedService || "N/A" },
                          { Icon: Clock3,   label:"Status",  value: viewing.status                     },
                        ].map(({ Icon, label, value }) => (
                          <div key={label} className="bg-[#F8F9FC] rounded-2xl p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Icon size={12} className="text-[#B8112D]"/>
                              <p className="text-gray-400 text-[11px]">{label}</p>
                            </div>
                            <h4 className="font-semibold text-[#0F172A] text-[13px] break-words">{value}</h4>
                          </div>
                        ))}
                      </div>

                      {viewing.comments && (
                        <div className="bg-[#F8F9FC] rounded-2xl p-3.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <AlignLeft size={12} className="text-[#B8112D]"/>
                            <p className="text-gray-400 text-[11px]">Comments</p>
                          </div>
                          <p className="text-[#0F172A] text-[13px] leading-relaxed">{viewing.comments}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* EDIT MODE */}
                  {isEditing && (
                    <>
                      {/* Service selector */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <Briefcase size={11} className="text-[#B8112D]"/>Service Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {serviceOptions.map(({ value, label, Icon }) => {
                            const isSel = editService === value;
                            return (
                              <button key={value}
                                onClick={() => setEditService(s => s === value ? "" : value)}
                                className={`relative py-3 px-1 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-[11px] font-semibold ${
                                  isSel ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-100 bg-[#FAFAFA] text-gray-500 hover:border-gray-200"
                                }`}
                              >
                                {isSel && (
                                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-[#B8112D] rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={9} className="text-white"/>
                                  </span>
                                )}
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSel ? "bg-[#B8112D]/10" : "bg-white shadow-sm"}`}>
                                  <Icon size={15} className={isSel ? "text-[#B8112D]" : "text-gray-400"}/>
                                </div>
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Status selector */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <Clock3 size={11} className="text-[#B8112D]"/>Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {EDIT_STATUSES.map(s => (
                            <button key={s}
                              onClick={() => setEditStatus(s)}
                              className={`h-9 px-4 rounded-xl text-[12px] font-semibold transition-all border ${
                                editStatus === s
                                  ? "bg-[#B8112D] text-white border-[#B8112D]"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-[#B8112D]/40"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Comments */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                          <AlignLeft size={11} className="text-[#B8112D]"/>Comments
                        </label>
                        <textarea value={editComments} onChange={e => setEditComments(e.target.value)} rows={4}
                          placeholder="Add comments about this lead..."
                          className="w-full rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"/>
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-3 pb-1">
                        <button onClick={() => setIsEditing(false)}
                          className="flex-1 h-12 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                          Cancel
                        </button>
                        <button onClick={saveEdit} disabled={saving}
                          className={`flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                            !saving
                              ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200"
                              : "bg-gray-200 cursor-not-allowed text-gray-400"
                          }`}>
                          {saving
                            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Saving...</>
                            : "Save Changes"
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
