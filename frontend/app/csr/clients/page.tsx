"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Users, UserPlus, Search, Filter, Phone, Briefcase,
  Clock3, Building2, AlignLeft, RefreshCw, Eye, Plus, X,
  Pencil, User2, Mail, MapPin, StickyNote, History,
  CheckCircle2, Trash2, Loader2, DollarSign, Link2,
} from "lucide-react";

import TopNavbar from "../components/navigation/TopNavbar";
import ServicePicker from "../components/shared/ServicePicker";
import StackedHorizontalBarChart, { StackedBarRow } from "../components/shared/StackedHorizontalBarChart";
import Pagination from "../components/shared/Pagination";
import { CLIENT_GRID_HEAD, CRM_GRID_HEAD_ROW, CLIENT_GRID_ROW } from "../components/shared/csrTableStyles";
import { PROJECT_TABLE_HEAD } from "@/app/components/projects/ProjectTableCells";

import { isWonClientStatus } from "../constants/leadStatuses";
import { useLeadsData, mapClientLead, ClientLead, SubContact, NoteEntry, type RawClientLead, clientIdentityKey, splitWonClientsByIdentity } from "../hooks/useLeadsData";
import { useClientPhoneLookup } from "../hooks/useClientPhoneLookup";
import API from "@/lib/api";
import { invalidateAllCsrListCaches } from "@/lib/csrApiCache";
import PhoneWithTzCell from "../components/shared/PhoneWithTzCell";
import EmailWithExtraCell from "../components/shared/EmailWithExtraCell";
import ClientSortControls from "../components/shared/ClientSortControls";
import { parseEmails, collectLeadEmails } from "../utils/parseEmails";
import { parsePhones, collectLeadPhones } from "../utils/parsePhones";
import { sortClientRows, type ClientListSortBy, type SortDir } from "../utils/clientListSort";
import { getCompanyTimezoneAbbr, tzBadgeClass } from "../constants/timezoneAbbr";
import toast, { Toaster } from "react-hot-toast";
import ClientHistoryModal from "@/app/components/clients/ClientHistoryModal";
import SubContactsCell from "@/app/components/clients/SubContactsCell";
import PaymentStatusCircle from "../components/shared/PaymentStatusCircle";
import { apiErrorMessage } from "@/lib/api";
import { formatQuotedAmount, parseMoney } from "@/lib/projectFields";
import StateFilterDropdown from "../components/shared/StateFilterDropdown";
import PhoneAreaCodeFilterInput from "../components/shared/PhoneAreaCodeFilterInput";
import { matchesStateLocationFilter, matchesPhoneAreaCodeFilter } from "@/lib/stateLocationFilter";
import { websiteHref } from "../components/LeadDetailModal";

/* ─── Constants ─────────────────────────────────────────── */
const EDIT_STATUSES = ["pending", "important", "interested", "Close Client", "completed"];
const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-gray-100 text-gray-600",
  important:        "bg-amber-50 text-amber-700",
  interested:       "bg-green-50 text-green-700",
  "Not Interested": "bg-red-50 text-red-600",
  "not picked":     "bg-orange-50 text-orange-600",
  "not completed":  "bg-orange-50 text-orange-600",
  "Close Client":   "bg-blue-50 text-blue-700",
  completed:        "bg-emerald-50 text-emerald-700",
};
const PAGE_SIZE = 30;
const emptyAdd  = { name: "", phone: "", email: "", company: "", website: "", state: "", service: "", comments: "", quotation: "", upfront: "" };
const emptyContact = { name: "", designation: "", phone: "", email: "" };

/* ─── Helpers ────────────────────────────────────────────── */
function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)   return "Just now";
    if (diffMin < 60)  return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7)     return `${diffD}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function fmtFull(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

/* ─── Page ──────────────────────────────────────────────── */
export default function LeadsPage() {
  const { leads, setLeads, stats, loading, refetch } = useLeadsData();

  /* tabs / search / pagination */
  const [activeTab, setActiveTab] = useState<"new" | "old">("new");
  const [search,       setSearch]       = useState("");
  const [stateFilter,  setStateFilter]  = useState("");
  const [phoneFilter,  setPhoneFilter]  = useState("");
  const [page,      setPage]      = useState(1);
  const [sortBy,    setSortBy]    = useState<ClientListSortBy>("clientCode");
  const [sortDir,   setSortDir]   = useState<SortDir>("asc");

  /* ── detail / edit modal ── */
  const [viewing,      setViewing]      = useState<ClientLead | null>(null);
  const [isEditing,    setIsEditing]    = useState(false);
  const [editName,     setEditName]     = useState("");
  const [editPhone,    setEditPhone]    = useState("");
  const [editEmail,    setEditEmail]    = useState("");
  const [editCompany,  setEditCompany]  = useState("");
  const [editWebsite,  setEditWebsite]  = useState("");
  const [editState,    setEditState]    = useState("");
  const [editService,  setEditService]  = useState("");
  const [editStatus,   setEditStatus]   = useState("");
  const [editComments, setEditComments] = useState("");
  const [editQuotation, setEditQuotation] = useState("");
  const [editUpfront,   setEditUpfront]   = useState("");
  const [saving,       setSaving]       = useState(false);

  /* ── add modal ── */
  const [showAdd,   setShowAdd]   = useState(false);
  const [addForm,   setAddForm]   = useState(emptyAdd);
  const [addSaving, setAddSaving] = useState(false);
  const [addError,  setAddError]  = useState("");

  const applyClientLookup = useCallback((client: { name: string; company: string; email: string; state: string; interestedService: string }) => {
    setAddForm(f => ({
      ...f,
      name:    client.name    || f.name,
      company: client.company || f.company,
      email:   client.email   || f.email,
      state:   client.state   || f.state,
      service: f.service || client.interestedService || "",
    }));
  }, []);

  const { phoneLookupLoading, returningClient, resetLookup, onPhoneValueChange, onPhoneBlur, onPhonePaste } =
    useClientPhoneLookup(applyClientLookup);

  const openAddModal = useCallback(() => {
    setAddForm(emptyAdd);
    setAddError("");
    resetLookup();
    setShowAdd(true);
  }, [resetLookup]);

  const closeAddModal = useCallback(() => {
    setShowAdd(false);
    setAddForm(emptyAdd);
    setAddError("");
    resetLookup();
  }, [resetLookup]);

  /* ── note history modal ── */
  const [noteLeadId,  setNoteLeadId]  = useState<string | null>(null);
  const [noteNewText, setNoteNewText] = useState("");
  const [noteSaving,  setNoteSaving]  = useState(false);

  /* ── sub-contacts (inside detail modal) ── */
  const [showContactForm, setShowContactForm]   = useState(false);
  const [newContact,      setNewContact]        = useState(emptyContact);
  const [contactSaving,   setContactSaving]     = useState(false);
  const [removingContactId, setRemovingContactId] = useState<string | null>(null);
  const [historyLead, setHistoryLead] = useState<ClientLead | null>(null);

  /* ─── Derived ──────────────────────────────────────────── */
  const wonLeads = useMemo(() => leads.filter(l => isWonClientStatus(l.status)), [leads]);
  const { newLeads, oldLeads, repeatKeys } = useMemo(
    () => splitWonClientsByIdentity(wonLeads),
    [wonLeads],
  );
  const isRepeatClient = useCallback(
    (lead: ClientLead) => repeatKeys.has(clientIdentityKey(lead)),
    [repeatKeys],
  );
  const baseList = activeTab === "new" ? newLeads : oldLeads;

  const importantCount  = stats.importantCount;
  const interestedCount = stats.interestedCount;
  const pendingCount    = stats.pendingCount;
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = baseList.filter(l =>
      matchesStateLocationFilter(l.state, l.phone, stateFilter) &&
      matchesPhoneAreaCodeFilter(l.phone, phoneFilter) &&
      (!q || (
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        (l.clientCode ?? "").toLowerCase().includes(q) ||
        collectLeadPhones(l.phone, l.contacts).some(p => p.includes(q)) ||
        collectLeadEmails(l.email, l.contacts).some(e => e.toLowerCase().includes(q)) ||
        l.email.toLowerCase().includes(q)
      ))
    );
    return sortClientRows(list, sortBy, sortDir);
  }, [baseList, search, stateFilter, phoneFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ─── Stacked chart data ───────────────────────────────── */
  const chartRows = useMemo<StackedBarRow[]>(() => [
    {
      label: "Won Clients",
      segments: [
        { label: "New (first-time)", value: newLeads.length, color: "#15803D" },
        { label: "Old (repeat)",     value: oldLeads.length, color: "#B45309" },
      ],
    },
    {
      label: "Active Pipeline",
      segments: [
        { label: "Important",  value: importantCount,  color: "#B8112D" },
        { label: "Interested", value: interestedCount, color: "#D97706" },
        { label: "Pending",    value: pendingCount,    color: "#94A3B8" },
      ],
    },
    {
      label: "All Assigned",
      segments: [{ label: "Total Leads", value: stats.totalAssigned, color: "#1D4ED8" }],
    },
  ], [newLeads, oldLeads, importantCount, interestedCount, pendingCount, stats.totalAssigned]);

  /* ─── Note helpers ─────────────────────────────────────── */
  const getLatestNote = (lead: ClientLead): NoteEntry | null =>
    lead.noteHistory.length > 0 ? lead.noteHistory[0] : null;

  const noteHistoryLead = useMemo(
    () => leads.find(l => l.id === noteLeadId) ?? null,
    [leads, noteLeadId],
  );

  /* ─── Actions ──────────────────────────────────────────── */
  const openDetail = (lead: ClientLead) => {
    setViewing(lead); setIsEditing(false);
    setShowContactForm(false); setNewContact(emptyContact);
  };

  const startEdit = () => {
    if (!viewing) return;
    setEditName(viewing.name);
    setEditPhone(viewing.phone === "N/A" ? "" : viewing.phone);
    setEditEmail(viewing.email);
    setEditCompany(viewing.company === "N/A" ? "" : viewing.company);
    setEditWebsite(viewing.website || "");
    setEditState(viewing.state);
    setEditService(viewing.interestedService);
    setEditStatus(viewing.status);
    setEditComments(viewing.comments);
    setEditQuotation(viewing.projectBudget);
    setEditUpfront(viewing.paidAmount);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!viewing) return;
    setSaving(true);
    try {
      await API.put(`/csr/lead/${viewing.id}`, {
        name:              editName.trim()    || undefined,
        phone:             editPhone.trim()   || undefined,
        email:             editEmail.trim()   || undefined,
        company:           editCompany.trim() || undefined,
        website:           editWebsite.trim(),
        state:             editState.trim()   || undefined,
        interestedService: editService        || undefined,
        status:            editStatus         || undefined,
        comments:          editComments       || undefined,
        projectBudget:     editQuotation.trim() || undefined,
        paidAmount:        editUpfront.trim()   || undefined,
      });
      const updated: ClientLead = {
        ...viewing,
        name:              editName.trim()    || viewing.name,
        phone:             editPhone.trim()   || viewing.phone,
        email:             editEmail.trim(),
        company:           editCompany.trim() || viewing.company,
        website:           editWebsite.trim(),
        state:             editState.trim(),
        interestedService: editService,
        status:            editStatus,
        comments:          editComments,
        projectBudget:     editQuotation.trim(),
        paidAmount:        editUpfront.trim(),
      };
      setLeads(prev => prev.map(l => l.id === viewing.id ? updated : l));
      setViewing(updated);
      setIsEditing(false);
      toast.success("Lead updated");
    } catch { toast.error("Failed to save changes"); }
    setSaving(false);
  };

  /* ─── Add Lead ─────────────────────────────────────────── */
  const handleAdd = async () => {
    if (!addForm.name.trim()) { setAddError("Client name is required."); return; }
    setAddSaving(true); setAddError("");
    try {
      const res = await API.post("/csr/lead", {
        name:              addForm.name.trim()    || undefined,
        phone:             addForm.phone.trim()   || undefined,
        email:             addForm.email.trim()   || undefined,
        company:           addForm.company.trim() || undefined,
        website:           addForm.website.trim() || undefined,
        state:             addForm.state.trim()   || undefined,
        interestedService: addForm.service        || undefined,
        comments:          addForm.comments.trim() || undefined,
        projectBudget:     addForm.quotation.trim() || undefined,
        paidAmount:        addForm.upfront.trim()   || undefined,
        asWonClient:       true,
      });
      const promoted = !!res.data.promoted;

      invalidateAllCsrListCaches();
      closeAddModal();
      await refetch(true);
      toast.success(
        promoted || returningClient
          ? "Returning client added — moved to Old Clients"
          : "Client added to New Clients",
      );
    } catch (err) {
      setAddError(apiErrorMessage(err, "Failed to add lead. Please try again."));
    }
    setAddSaving(false);
  };

  /* ─── Notes ────────────────────────────────────────────── */
  const openNoteHistory = async (leadId: string) => {
    setNoteLeadId(leadId);
    setNoteNewText("");
    try {
      const res = await API.get(`/csr/lead/${leadId}`);
      const raw = res.data.lead;
      if (!raw) return;
      const mapped = mapClientLead(raw as RawClientLead);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, noteHistory: mapped.noteHistory } : l));
    } catch {
      /* keep preloaded notes */
    }
  };

  const addNote = async () => {
    if (!noteNewText.trim() || !noteLeadId) return;
    setNoteSaving(true);
    try {
      const res = await API.post(`/csr/lead/${noteLeadId}/notes`, { text: noteNewText.trim() });
      const saved: NoteEntry = res.data.note
        ? { id: res.data.note.id, text: res.data.note.text, createdAt: res.data.note.createdAt }
        : { id: String(Date.now()), text: noteNewText.trim(), createdAt: new Date().toISOString() };
      setLeads(prev => prev.map(l =>
        l.id === noteLeadId
          ? { ...l, noteHistory: [saved, ...l.noteHistory.filter(n => n.id !== saved.id)] }
          : l
      ));
      setNoteNewText("");
      invalidateAllCsrListCaches();
      toast.success("Note added");
    } catch { toast.error("Failed to save note"); }
    setNoteSaving(false);
  };

  /* ─── Sub-contacts ─────────────────────────────────────── */
  const addContact = async () => {
    if (!viewing || !newContact.name.trim()) return;
    setContactSaving(true);
    try {
      const res = await API.post(`/csr/lead/${viewing.id}/subcontacts`, newContact);
      const saved: SubContact = res.data.subContact ?? {
        id: String(Date.now()),
        ...newContact,
      };
      const updated: ClientLead = { ...viewing, contacts: [...viewing.contacts, saved] };
      setLeads(prev => prev.map(l => l.id === viewing.id ? updated : l));
      setViewing(updated);
      setNewContact(emptyContact); setShowContactForm(false);
      toast.success("Contact added");
    } catch { toast.error("Failed to add contact"); }
    setContactSaving(false);
  };

  const removeContact = async (contactId: string) => {
    if (!viewing) return;
    setRemovingContactId(contactId);
    try {
      await API.delete(`/csr/lead/${viewing.id}/subcontacts/${contactId}`);
      const updated: ClientLead = { ...viewing, contacts: viewing.contacts.filter(c => c.id !== contactId) };
      setLeads(prev => prev.map(l => l.id === viewing.id ? updated : l));
      setViewing(updated);
    } catch { toast.error("Failed to remove contact"); }
    setRemovingContactId(null);
  };

  /* ─── JSX ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }} />
      <TopNavbar />
      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">

        {/* HEADER */}
        <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-[28px] lg:text-[34px] font-bold text-[#0F172A] leading-tight">My Clients</h1>
            <p className="text-gray-500 mt-1 text-xs sm:text-sm">New = first-time · Old = repeat business.</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] transition-colors w-full sm:w-auto shrink-0"
          >
            <Plus size={14} />Add New Lead
          </button>
        </div>

        {/* STACKED CHART */}
        <div className="mt-4 sm:mt-7">
          <StackedHorizontalBarChart
            title="Pipeline value by stage and type"
            subtitle="Client distribution across won deals, active pipeline, and all assigned leads."
            rows={chartRows}
            loading={loading}
          />
        </div>

        {/* TABS */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7 overflow-x-auto pb-0.5">
          {([
            { key: "new", label: "New Clients", count: newLeads.length, Icon: UserPlus },
            { key: "old", label: "Old Clients", count: oldLeads.length, Icon: User2   },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); setSearch(""); }}
              className={`h-10 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"
              }`}
            >
              <tab.Icon size={14} className="sm:w-4 sm:h-4" />
              {tab.label}
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold ${activeTab === tab.key ? "bg-white/20" : "bg-[#FFF1F3]"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* TABLE CARD */}
        <div className="bg-white rounded-2xl sm:rounded-[28px] border border-white shadow-sm mt-4 sm:mt-7">
          {/* Card header */}
          <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-b border-[#F3F3F3]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A]">
                  {activeTab === "new" ? "New Clients" : "Old Clients"}
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                  {activeTab === "new" ? "First-time clients — won deals." : "Returning clients — repeat business."}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                <div className="relative flex-1 min-w-[150px] sm:w-[220px]">
                  <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" placeholder="Name, code, phone, email..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="w-full h-10 sm:h-[44px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-9 pr-4 text-xs sm:text-sm outline-none focus:border-[#B8112D] transition-colors"
                  />
                </div>
                <StateFilterDropdown value={stateFilter} onChange={v => { setStateFilter(v); setPage(1); }} />
                <PhoneAreaCodeFilterInput value={phoneFilter} onChange={v => { setPhoneFilter(v); setPage(1); }} />
                <ClientSortControls
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortBy={v => { setSortBy(v); setPage(1); }}
                  onSortDir={v => { setSortDir(v); setPage(1); }}
                />
                <button onClick={() => void refetch()}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  title="Refresh">
                  <RefreshCw size={13} className="text-gray-500" />
                </button>
                <div className="flex items-center gap-1.5 text-[#B8112D] text-xs sm:text-sm font-semibold whitespace-nowrap">
                  <Filter size={13} />
                  <span>{filtered.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 grid grid-cols-4 gap-3 sm:gap-4">
                    {[1,2,3,4].map(j => <div key={j} className="h-3.5 bg-gray-100 rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <>
              <div className="overflow-x-hidden">
              {/* Desktop header */}
              <div className={`hidden lg:grid gap-2 px-4 lg:px-5 py-2.5 w-full ${CRM_GRID_HEAD_ROW} ${CLIENT_GRID_HEAD}`}>
                {["Code", "Client", "Company", "Phone", "Sub Contacts", "Email", "Service", "Latest Note", ""].map(h => (
                  <span key={h} className={PROJECT_TABLE_HEAD}>{h}</span>
                ))}
              </div>

              <div className="divide-y divide-[#F3F3F3] w-full">
                {paginated.map(lead => {
                  const latestNote = getLatestNote(lead);
                  const displayName = lead.name;
                  const repeat = isRepeatClient(lead);
                  const displaySub  = repeat && lead.rawCompany && lead.rawCompany !== lead.name ? lead.rawCompany : null;
                  return (
                    <div
                      key={lead.id}
                      className={`grid gap-3 px-3 sm:px-4 lg:px-5 xl:px-6 py-3 sm:py-4 items-center hover:bg-[#FAFAFA] transition-colors grid-cols-[1fr_auto] ${CLIENT_GRID_ROW}`}
                    >
                      {/* Code column */}
                      <div className="hidden lg:block">
                        {lead.clientCode
                          ? <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-2 py-1 rounded-lg truncate block">{lead.clientCode}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </div>

                      {/* Client */}
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 text-white ${repeat ? "bg-amber-500" : "bg-[#15803D]"}`}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* show code badge inline on mobile */}
                            {lead.clientCode && (
                              <span className="lg:hidden bg-[#B8112D]/10 text-[#B8112D] text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">{lead.clientCode}</span>
                            )}
                            <p className="text-xs sm:text-sm font-semibold text-[#0F172A] truncate">{displayName}</p>
                            {(() => {
                              const tz = getCompanyTimezoneAbbr(lead);
                              return tz ? (
                                <span
                                  title={`Company location · ${lead.state || "state"}`}
                                  className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}
                                >
                                  {tz}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          {displaySub && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{displaySub}</p>
                          )}
                          <span className={`inline-block text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg mt-0.5 ${repeat ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                            {repeat ? "Old Client" : "New Client"}
                          </span>
                        </div>
                      </div>

                      {/* Company */}
                      <p className="hidden lg:block text-xs lg:text-sm text-[#0F172A] truncate">{lead.company}</p>

                      {/* Phone — number + area-code TZ */}
                      <div className="hidden lg:flex items-center gap-1.5 min-w-0 overflow-visible">
                        {(() => {
                          const phones = collectLeadPhones(lead.phone, lead.contacts);
                          if (phones.length === 0) {
                            return <span className="text-gray-300 text-xs">—</span>;
                          }
                          return (
                            <PhoneWithTzCell
                              phone={phones[0]}
                              allPhones={phones}
                              variant="pill"
                              className="px-2 py-1 text-xs lg:text-sm"
                            />
                          );
                        })()}
                      </div>

                      <div className="hidden lg:block min-w-0">
                        <SubContactsCell contacts={lead.contacts} />
                      </div>

                      {/* Email */}
                      <div className="hidden lg:block min-w-0 overflow-visible">
                        <EmailWithExtraCell
                          email={lead.email}
                          allEmails={collectLeadEmails(lead.email, lead.contacts)}
                          variant="pill"
                          className="px-2 py-1 text-xs lg:text-sm"
                        />
                      </div>

                      {/* Service */}
                      <p className={`hidden lg:block text-xs lg:text-sm truncate ${lead.interestedService ? "text-[#0F172A]" : "text-gray-300"}`}>
                        {lead.interestedService || "—"}
                      </p>

                      {/* Latest Note (sticky note style) */}
                      <div className="hidden lg:block">
                        {latestNote ? (
                          <button
                            onClick={() => void openNoteHistory(lead.id)}
                            className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-left hover:bg-amber-100 transition-colors w-full max-w-[200px] group"
                          >
                            <p className="text-[10px] text-amber-900 leading-snug line-clamp-2 whitespace-pre-wrap">{latestNote.text}</p>
                            <p className="text-[9px] text-amber-400 mt-1 flex items-center gap-1">
                              <Clock3 size={8} />{fmtTime(latestNote.createdAt)}
                            </p>
                          </button>
                        ) : (
                          <button
                            onClick={() => void openNoteHistory(lead.id)}
                            className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-2 text-left hover:bg-gray-100 transition-colors w-full max-w-[200px]"
                          >
                            <p className="text-[10px] text-gray-400 italic">No notes yet</p>
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end lg:justify-center gap-1.5">
                        <button onClick={() => void openNoteHistory(lead.id)}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          title="Notes history">
                          <StickyNote size={13} />
                        </button>
                        <button
                          onClick={() => lead.phone && lead.phone !== "N/A"
                            ? setHistoryLead(lead)
                            : openDetail(lead)}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                          title={repeat ? "All projects history" : "Client history"}
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              <div className="px-4 sm:px-6">
                <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
              </div>
            </>
          ) : (
            <div className="p-10 sm:p-12 lg:p-16 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="sm:w-7 sm:h-7" />
              </div>
              <h2 className="text-lg sm:text-[22px] font-bold text-[#0F172A]">No Clients Found</h2>
              <p className="text-gray-500 mt-1.5 text-xs sm:text-sm">
                {search ? "No clients match your search." : "No won leads yet."}
              </p>
            </div>
          )}
        </div>

        {/* ══ NOTE HISTORY MODAL ══ */}
        {noteLeadId && noteHistoryLead && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[110] p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col" style={{ maxHeight: "86vh" }}>
              {/* Header */}
              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <History size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">Note History</h2>
                    <p className="text-[11px] text-gray-400">{noteHistoryLead.name}</p>
                  </div>
                </div>
                <button onClick={() => setNoteLeadId(null)}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all">
                  <X size={14} />
                </button>
              </div>

              {/* Add note */}
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 shrink-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Add New Note</p>
                <textarea
                  value={noteNewText}
                  onChange={e => setNoteNewText(e.target.value)}
                  placeholder="Write your note here..."
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-3 py-2.5 text-xs sm:text-sm outline-none focus:border-[#B8112D] resize-none transition-colors"
                />
                <button
                  onClick={addNote}
                  disabled={noteSaving || !noteNewText.trim()}
                  className="mt-2 w-full h-9 rounded-xl bg-[#B8112D] text-white text-xs font-semibold hover:bg-[#a30f27] disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                >
                  {noteSaving ? "Saving…" : "Add Note"}
                </button>
              </div>

              {/* History timeline */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
                {noteHistoryLead.noteHistory.length === 0 ? (
                  <div className="py-8 text-center">
                    <StickyNote size={28} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No notes yet. Add the first one above.</p>
                  </div>
                ) : (
                  noteHistoryLead.noteHistory.map((note, idx) => (
                    <div key={note.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-2 ${idx === 0 ? "bg-amber-500" : "bg-gray-300"}`} />
                        {idx < noteHistoryLead.noteHistory.length - 1 && (
                          <div className="w-px flex-1 bg-gray-100 mt-1" />
                        )}
                      </div>
                      <div className={`flex-1 rounded-xl p-3 mb-1 ${idx === 0 ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-100"}`}>
                        <p className={`text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap ${idx === 0 ? "text-amber-900" : "text-gray-700"}`}>
                          {note.text}
                        </p>
                        <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${idx === 0 ? "text-amber-400" : "text-gray-400"}`}>
                          <Clock3 size={8} />{fmtFull(note.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ ADD NEW LEAD MODAL ══ */}
        {showAdd && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-[520px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <button onClick={closeAddModal}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
                  <X size={13} />
                </button>
                <div className="flex items-center gap-2.5 pr-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Plus size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">Add New Lead</h2>
                    <p className="text-white/65 text-[10px] sm:text-xs mt-0.5">Manually add a potential client</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-3 sm:space-y-4">
                  {addError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-xl">{addError}</div>
                  )}

                  {/* Contact Info */}
                  <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User2 size={11} className="text-[#B8112D]" />Client Information
                    </p>

                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                        Phone <span className="text-gray-300 normal-case font-normal">(paste or type to auto-fill)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={addForm.phone}
                          placeholder="Phone number"
                          autoComplete="tel"
                          onChange={e => {
                            const value = e.target.value;
                            setAddForm(f => ({ ...f, phone: value }));
                            onPhoneValueChange(value);
                          }}
                          onBlur={e => onPhoneBlur(e.target.value)}
                          onPaste={onPhonePaste}
                          className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 pr-9 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                        />
                        {phoneLookupLoading && (
                          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8112D] animate-spin" />
                        )}
                      </div>
                    </div>

                    {returningClient && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] sm:text-xs px-3 py-2 rounded-xl">
                        <User2 size={12} className="shrink-0" />
                        Returning client — details auto-filled from previous record
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Client Name <span className="text-[#B8112D]">*</span></label>
                        <input type="text" value={addForm.name} placeholder="Client name"
                          onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Company Name</label>
                        <input type="text" value={addForm.company} placeholder="Company name"
                          onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}
                          className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Email Address</label>
                        <input type="email" value={addForm.email} placeholder="Email address"
                          autoComplete="email"
                          onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">State</label>
                        <input type="text" value={addForm.state} placeholder="e.g. California"
                          onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))}
                          className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Website Link</label>
                      <input type="url" value={addForm.website} placeholder="https://example.com"
                        onChange={e => setAddForm(f => ({ ...f, website: e.target.value }))}
                        className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <Briefcase size={10} className="text-[#B8112D]" />Service Interested In
                    </label>
                    <ServicePicker value={addForm.service} onChange={v => setAddForm(f => ({ ...f, service: f.service === v ? "" : v }))} />
                  </div>

                  <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={11} className="text-[#B8112D]" />Quotation &amp; Upfront
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Quotation</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="text"
                            placeholder="0.00"
                            value={addForm.quotation.replace(/^\$/, "")}
                            onChange={e => setAddForm(f => ({ ...f, quotation: e.target.value.replace(/[^0-9.]/g, "") }))}
                            className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white pl-6 pr-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Upfront Amount</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="text"
                            placeholder="0.00"
                            value={addForm.upfront.replace(/^\$/, "")}
                            onChange={e => setAddForm(f => ({ ...f, upfront: e.target.value.replace(/[^0-9.]/g, "") }))}
                            className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white pl-6 pr-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                          />
                        </div>
                      </div>
                    </div>
                    {(parseMoney(addForm.quotation) > 0 || parseMoney(addForm.upfront) > 0) && (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <PaymentStatusCircle
                          percent={parseMoney(addForm.quotation) > 0
                            ? (parseMoney(addForm.upfront) / parseMoney(addForm.quotation)) * 100
                            : 0}
                        />
                        <p className="text-[10px] sm:text-[11px] text-gray-500">
                          {parseMoney(addForm.quotation) > 0
                            ? `${Math.round((parseMoney(addForm.upfront) / parseMoney(addForm.quotation)) * 100)}% of ${formatQuotedAmount(addForm.quotation)} upfront`
                            : `Upfront: ${formatQuotedAmount(addForm.upfront)}`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                      <AlignLeft size={10} className="text-[#B8112D]" />Initial Note
                    </label>
                    <textarea value={addForm.comments} placeholder="Any initial notes..." rows={3}
                      onChange={e => setAddForm(f => ({ ...f, comments: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 bg-[#FAFAFA] px-3 py-2.5 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"
                    />
                  </div>

                  <div className="flex gap-2 sm:gap-3 pb-1">
                    <button onClick={closeAddModal}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleAdd} disabled={addSaving}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                        !addSaving ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"
                      }`}>
                      {addSaving
                        ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
                        : <><Plus size={14} />Add Lead</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ DETAIL / EDIT MODAL ══ */}
        {viewing && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full sm:max-w-[560px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>
              {/* Gradient header */}
              <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
                <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
                <button
                  onClick={() => { setViewing(null); setIsEditing(false); }}
                  className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white z-10">
                  <X size={13} />
                </button>
                <div className="flex items-center gap-2.5 pr-10">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base sm:text-lg shrink-0 ${viewing && isRepeatClient(viewing) ? "bg-amber-500/40" : "bg-white/20"}`}>
                    {viewing.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate">
                      {isEditing ? "Edit Client" : viewing.name}
                    </h2>
                    <p className="text-white/65 text-[10px] sm:text-xs mt-0.5 truncate">{viewing.company}</p>
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5">
                  {viewing.clientCode && (
                    <span className="inline-flex items-center bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {viewing.clientCode}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${viewing && isRepeatClient(viewing) ? "bg-amber-400/25 text-amber-100" : "bg-green-500/25 text-green-100"}`}>
                    {viewing && isRepeatClient(viewing) ? "Old Client" : "New Client"}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[viewing.status] ? "bg-white/15 text-white" : "bg-white/10 text-white/70"}`}>
                    {viewing.status}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4 sm:space-y-5">

                  {/* ── VIEW MODE ── */}
                  {!isEditing && (
                    <>
                      <button onClick={startEdit}
                        className="w-full h-9 sm:h-10 rounded-xl border border-[#f5c5ce] bg-[#FFF1F3] text-[#B8112D] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#fce8ec] transition-colors">
                        <Pencil size={12} /> Edit All Fields
                      </button>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {[
                          { Icon: Phone,     label: "Phone",   value: viewing.phone                      },
                          { Icon: Mail,      label: "Email",   value: viewing.email   || "Not provided"  },
                          { Icon: Building2, label: "Company", value: viewing.company                    },
                          { Icon: MapPin,    label: "State",   value: viewing.state   || "Not provided"  },
                          { Icon: Link2,     label: "Website", value: viewing.website || "Not provided", href: viewing.website ? websiteHref(viewing.website) : undefined },
                          { Icon: Briefcase, label: "Service", value: viewing.interestedService || "N/A" },
                          { Icon: Clock3,    label: "Status",  value: viewing.status                     },
                          { Icon: DollarSign, label: "Quotation", value: formatQuotedAmount(viewing.projectBudget) },
                          { Icon: DollarSign, label: "Upfront",   value: formatQuotedAmount(viewing.paidAmount) },
                        ].map(({ Icon, label, value, href }) => (
                          <div key={label} className="bg-[#F8F9FC] rounded-xl p-3">
                            <div className="flex items-center gap-1 mb-1">
                              <Icon size={11} className="text-[#B8112D]" />
                              <p className="text-gray-400 text-[10px]">{label}</p>
                            </div>
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#B8112D] text-[12px] sm:text-[13px] break-words hover:underline">
                                {value}
                              </a>
                            ) : (
                              <h4 className="font-semibold text-[#0F172A] text-[12px] sm:text-[13px] break-words">{value}</h4>
                            )}
                          </div>
                        ))}
                      </div>

                      {(parseMoney(viewing.projectBudget) > 0 || parseMoney(viewing.paidAmount) > 0) && (
                        <div className="flex items-center gap-3 bg-[#F8F9FC] rounded-xl p-3">
                          <PaymentStatusCircle
                            percent={parseMoney(viewing.projectBudget) > 0
                              ? (parseMoney(viewing.paidAmount) / parseMoney(viewing.projectBudget)) * 100
                              : 0}
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Payment progress</p>
                            <p className="text-[12px] sm:text-[13px] font-semibold text-[#0F172A] mt-0.5">
                              {formatQuotedAmount(viewing.paidAmount)} of {formatQuotedAmount(viewing.projectBudget)} upfront
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Latest note */}
                      {viewing.noteHistory.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <div className="flex items-center gap-1 mb-1.5">
                            <StickyNote size={11} className="text-amber-600" />
                            <p className="text-amber-600 text-[10px] font-semibold">Latest Note</p>
                          </div>
                          <p className="text-[#0F172A] text-[12px] sm:text-[13px] leading-relaxed whitespace-pre-wrap">
                            {viewing.noteHistory[0].text}
                          </p>
                          <p className="text-amber-400 text-[10px] mt-1.5">{fmtFull(viewing.noteHistory[0].createdAt)}</p>
                        </div>
                      )}

                      {/* Sub-contacts */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={11} className="text-[#B8112D]" />Sub-Contacts
                          </p>
                          <button
                            onClick={() => setShowContactForm(v => !v)}
                            className="h-7 px-2.5 rounded-lg bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-semibold flex items-center gap-1 hover:bg-[#B8112D]/20 transition-colors"
                          >
                            <Plus size={10} />{showContactForm ? "Cancel" : "Add Contact"}
                          </button>
                        </div>

                        {/* Add contact form */}
                        {showContactForm && (
                          <div className="bg-[#F8F9FC] rounded-xl p-3 mb-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">Name *</label>
                                <input type="text" value={newContact.name} placeholder="John Smith"
                                  onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))}
                                  className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-[#B8112D] transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">Designation</label>
                                <input type="text" value={newContact.designation} placeholder="Manager"
                                  onChange={e => setNewContact(c => ({ ...c, designation: e.target.value }))}
                                  className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-[#B8112D] transition-colors"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">Contact</label>
                                <input type="text" value={newContact.phone} placeholder="+1 234 567"
                                  onChange={e => setNewContact(c => ({ ...c, phone: e.target.value }))}
                                  className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-[#B8112D] transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">Email</label>
                                <input type="email" value={newContact.email} placeholder="email@co.com"
                                  onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))}
                                  className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-[#B8112D] transition-colors"
                                />
                              </div>
                            </div>
                            <button
                              onClick={addContact}
                              disabled={contactSaving || !newContact.name.trim()}
                              className="w-full h-8 rounded-lg bg-[#B8112D] text-white text-xs font-semibold hover:bg-[#a30f27] disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                            >
                              {contactSaving ? "Saving…" : "Add Contact"}
                            </button>
                          </div>
                        )}

                        {/* Contacts list */}
                        {viewing.contacts.length > 0 ? (
                          <div className="space-y-1.5">
                            {viewing.contacts.map(c => (
                              <div key={c.id} className="flex items-center gap-2 bg-[#F8F9FC] rounded-xl px-3 py-2.5">
                                <div className="w-7 h-7 rounded-full bg-[#B8112D]/10 text-[#B8112D] flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {c.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[12px] font-semibold text-[#0F172A] truncate">{c.name}</span>
                                    {c.designation && (
                                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{c.designation}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {c.phone && <span className="text-[10px] text-gray-500">{c.phone}</span>}
                                    {c.email && <span className="text-[10px] text-gray-500">{c.email}</span>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeContact(c.id)}
                                  disabled={removingContactId === c.id}
                                  className="w-6 h-6 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : !showContactForm ? (
                          <p className="text-[11px] text-gray-400 italic py-2">No sub-contacts yet. Click + to add one.</p>
                        ) : null}
                      </div>
                    </>
                  )}

                  {/* ── EDIT MODE ── */}
                  {isEditing && (
                    <>
                      {/* All editable fields */}
                      <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <User2 size={11} className="text-[#B8112D]" />Contact Information
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Client Name</label>
                            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                              className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Company Name</label>
                            <input type="text" value={editCompany} onChange={e => setEditCompany(e.target.value)}
                              placeholder="Company name"
                              className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Phone</label>
                            <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                              placeholder="+1 234 567 890"
                              className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
                            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                              placeholder="email@company.com"
                              className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">State</label>
                            <input type="text" value={editState} onChange={e => setEditState(e.target.value)}
                              placeholder="e.g. California"
                              className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Website Link</label>
                            <input type="url" value={editWebsite} onChange={e => setEditWebsite(e.target.value)}
                              placeholder="https://example.com"
                              className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D] transition-colors placeholder:text-gray-300"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Briefcase size={10} className="text-[#B8112D]" />Service Type
                        </label>
                        <ServicePicker value={editService} onChange={v => setEditService(s => s === v ? "" : v)} />
                      </div>

                      <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <DollarSign size={10} className="text-[#B8112D]" />Quotation &amp; Upfront
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Quotation</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                              <input
                                type="text"
                                value={editQuotation.replace(/^\$/, "")}
                                placeholder="0.00"
                                onChange={e => setEditQuotation(e.target.value.replace(/[^0-9.]/g, ""))}
                                className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white pl-6 pr-3 text-sm outline-none focus:border-[#B8112D] transition-colors"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Upfront Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                              <input
                                type="text"
                                value={editUpfront.replace(/^\$/, "")}
                                placeholder="0.00"
                                onChange={e => setEditUpfront(e.target.value.replace(/[^0-9.]/g, ""))}
                                className="w-full h-10 rounded-xl border-2 border-gray-200 bg-white pl-6 pr-3 text-sm outline-none focus:border-[#B8112D] transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <Clock3 size={10} className="text-[#B8112D]" />Status
                        </label>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {EDIT_STATUSES.map(s => (
                            <button key={s} onClick={() => setEditStatus(s)}
                              className={`h-8 sm:h-9 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-[12px] font-semibold transition-all border ${
                                editStatus === s
                                  ? "bg-[#B8112D] text-white border-[#B8112D]"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-[#B8112D]/40"
                              }`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                          <AlignLeft size={10} className="text-[#B8112D]" />Comments
                        </label>
                        <textarea value={editComments} onChange={e => setEditComments(e.target.value)} rows={3}
                          placeholder="Add comments..."
                          className="w-full rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300"
                        />
                      </div>

                      <div className="flex gap-2 sm:gap-3 pb-1">
                        <button onClick={() => setIsEditing(false)}
                          className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                          Cancel
                        </button>
                        <button onClick={saveEdit} disabled={saving}
                          className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                            !saving ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"
                          }`}>
                          {saving
                            ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving...</>
                            : <><CheckCircle2 size={14} />Save Changes</>}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {historyLead && historyLead.phone && historyLead.phone !== "N/A" && (
          <ClientHistoryModal
            phone={historyLead.phone}
            clientName={historyLead.name}
            editable
            onClose={() => setHistoryLead(null)}
            onProjectSaved={() => { void refetch(); }}
          />
        )}
      </main>
    </div>
  );
}
