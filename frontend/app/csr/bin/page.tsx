"use client";

import { useMemo, useState } from "react";
import {
  Search, RefreshCw, Phone, Briefcase,
  Trash2, X, ArrowUpCircle, Star, ThumbsDown, PhoneOff,
} from "lucide-react";

import TopNavbar from "../components/navigation/TopNavbar";
import StackedHorizontalBarChart, { StackedBarRow } from "../components/shared/StackedHorizontalBarChart";
import Pagination from "../components/shared/Pagination";
import { CSR_TABLE_CARD, CSR_TABLE_WRAP, CSR_THEAD, CSR_TABLE_CLASS, CsrColGroup, COL_9_BIN } from "../components/shared/csrTableStyles";
import { getTimezoneAbbr, tzBadgeClass, getTimezoneAbbrFromPhone } from "../constants/timezoneAbbr";

import { useBinData, binCategory, binReasonLabel } from "../hooks/useBinData";
import SubContactsCell from "@/app/components/clients/SubContactsCell";
import API from "@/lib/api";

const PAGE_SIZE = 30;
type TabKey = "all" | "notpicked" | "notinterested" | "deleted" | "inhouse" | "noowner" | "notinservice";

export default function CSRBinPage() {
  const { leads, setLeads, loading, refetch } = useBinData();

  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [tab,    setTab]    = useState<TabKey>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "warn" } | null>(null);
  const showToast = (msg: string, type: "success" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const sourceOptions = useMemo(() => {
    const set = new Set(leads.map(l => l.source).filter(s => s && s !== "—"));
    return [...set].sort();
  }, [leads]);

  const cat = (l: typeof leads[0]) => binCategory(l.binReason, l.status, l.binPreviousStatus);

  const byTab = useMemo(() => ({
    notpicked:     leads.filter(l => cat(l) === "notpicked"),
    notinterested: leads.filter(l => cat(l) === "notinterested"),
    deleted:       leads.filter(l => cat(l) === "deleted"),
    inhouse:       leads.filter(l => cat(l) === "inhouse"),
    noowner:       leads.filter(l => cat(l) === "noowner"),
    notinservice:  leads.filter(l => cat(l) === "notinservice"),
  }), [leads]);

  const currentList = tab === "all" ? leads : (byTab[tab] ?? leads);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currentList.filter(l => {
      if (statusFilter !== "all" && cat(l) !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      return !q || l.client.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.source.toLowerCase().includes(q) ||
        binReasonLabel(l.binReason).toLowerCase().includes(q);
    });
  }, [currentList, search, statusFilter, sourceFilter, leads]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const chartRows = useMemo<StackedBarRow[]>(() => [
    {
      label: "Bin",
      segments: [
        { label: "Not Picked",     value: byTab.notpicked.length,     color: "#F59E0B" },
        { label: "Not Interested", value: byTab.notinterested.length, color: "#B8112D" },
        { label: "Deleted",        value: byTab.deleted.length,       color: "#6366F1" },
      ],
    },
  ], [byTab]);

  const handleRestore = async (id: string, name: string) => {
    setRestoringId(id);
    try {
      await API.put(`/csr/lead/${id}`, { inBin: false });
      setLeads(prev => prev.filter(l => l.id !== id));
      showToast(`${name} restored.`);
    } catch { showToast("Failed to restore lead.", "warn"); }
    finally { setRestoringId(null); }
  };

  const tabs: { key: TabKey; label: string; count: number; Icon: typeof Trash2 }[] = [
    { key: "all",           label: "All",            count: leads.length,              Icon: Trash2     },
    { key: "notpicked",     label: "Not Picked",     count: byTab.notpicked.length,     Icon: PhoneOff   },
    { key: "notinterested", label: "Not Interested", count: byTab.notinterested.length, Icon: ThumbsDown },
    { key: "inhouse",       label: "In House",       count: byTab.inhouse.length,       Icon: Briefcase  },
    { key: "noowner",       label: "No Owner",       count: byTab.noowner.length,       Icon: PhoneOff   },
    { key: "notinservice",  label: "Not In Service", count: byTab.notinservice.length,  Icon: ThumbsDown },
    { key: "deleted",       label: "Deleted",        count: byTab.deleted.length,       Icon: Star       },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <TopNavbar />
      <main className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-5 lg:p-6">

        {toast && (
          <div className={`fixed top-4 sm:top-5 right-3 sm:right-5 z-[200] flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold max-w-[90vw] ${
            toast.type === "warn"
              ? "bg-amber-50 border border-amber-300 text-amber-800"
              : "bg-green-50 border border-green-300 text-green-800"
          }`}>
            <span className="truncate">{toast.msg}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 shrink-0">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="mt-1 flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#FFF7E6] flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-[#B54708] sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-[28px] lg:text-[34px] font-bold text-[#0F172A] leading-tight">My Bin</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Limit-reached leads and deleted important/interested clients.
            </p>
          </div>
        </div>

        <div className="mt-4 sm:mt-7">
          <StackedHorizontalBarChart
            title="Bin overview"
            subtitle="Only final tries and deleted clients appear here."
            rows={chartRows}
            loading={loading}
          />
        </div>

        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6 overflow-x-auto pb-0.5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(""); setPage(1); }}
              className={`h-10 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap ${
                tab === t.key
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"
              }`}
            >
              <t.Icon size={14} />
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${tab === t.key ? "bg-white/20" : "bg-[#FFF1F3]"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className={CSR_TABLE_CARD}>
          <div className="p-4 sm:p-5 border-b border-[#F3F3F3]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A]">Bin Leads</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="h-9 sm:h-[40px] rounded-xl border border-gray-200 bg-white px-3 text-xs outline-none focus:border-[#B8112D]">
                  <option value="all">All Status</option>
                  <option value="notpicked">Not Picked</option>
                  <option value="notinterested">Not Interested</option>
                  <option value="inhouse">In House</option>
                  <option value="noowner">No Owner</option>
                  <option value="notinservice">Not In Service</option>
                  <option value="deleted">Deleted</option>
                </select>
                <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
                  className="h-9 sm:h-[40px] rounded-xl border border-gray-200 bg-white px-3 text-xs outline-none focus:border-[#B8112D]">
                  <option value="all">All Sources</option>
                  {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="relative flex-1 min-w-[150px] sm:w-[220px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" placeholder="Search..."
                    value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="w-full h-9 sm:h-[40px] rounded-xl border border-gray-200 bg-[#FAFAFA] pl-8 pr-3 text-xs outline-none focus:border-[#B8112D]"
                  />
                </div>
                <button onClick={() => void refetch(true)}
                  className="h-9 sm:h-[40px] w-9 sm:w-[40px] rounded-xl border border-gray-200 bg-[#FAFAFA] flex items-center justify-center hover:border-[#B8112D] hover:text-[#B8112D] text-gray-500 transition-colors"
                  title="Refresh">
                  <RefreshCw size={13} />
                </button>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FFF7E6] text-[#B54708] whitespace-nowrap">
                  {filtered.length} Leads
                </span>
              </div>
            </div>
          </div>

          <div className={CSR_TABLE_WRAP}>
            <table className={CSR_TABLE_CLASS}>
              <CsrColGroup widths={COL_9_BIN} />
              <thead className={CSR_THEAD}>
                <tr className="border-b border-[#F1F1F1]">
                  {["#","Client","Company","Phone","Sub Contacts","Service","Reason","Updated","Action"].map(h => (
                    <th key={h} className={`text-left py-3 px-2 text-[11px] sm:text-[12px] font-semibold text-gray-500 whitespace-nowrap ${h === "Sub Contacts" ? "hidden lg:table-cell" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3].map(i => (
                    <tr key={i} className="border-b border-[#F7F7F7]">
                      {[1,2,3,4,5,6,7,8,9].map(j => (
                        <td key={j} className="py-4 px-2"><div className="h-3.5 bg-gray-100 rounded animate-pulse w-16"/></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? paginated.map((lead, idx) => (
                  <tr key={lead.id} className="border-b border-[#F7F7F7] hover:bg-[#FFFBF2]">
                    <td className="py-4 px-2 text-xs text-gray-400">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 bg-[#B54708]">
                          {lead.client.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-[#0F172A] text-[13px]">{lead.client}</span>
                          {(() => {
                            const tz = getTimezoneAbbr(lead.state);
                            return tz ? (
                              <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${tzBadgeClass(tz)}`}>{tz}</span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-[13px] font-medium text-[#0F172A] max-w-[100px] truncate block">{lead.company}</span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-1 bg-[#FFF7E6] text-[#B54708] px-2.5 py-1.5 rounded-xl text-[11px] font-medium w-fit whitespace-nowrap">
                        <Phone size={10}/>{lead.phone}
                      </div>
                    </td>
                    <td className={`hidden lg:table-cell py-4 px-2`}>
                      <SubContactsCell contacts={lead.subContacts} />
                    </td>
                    <td className="py-4 px-2">
                      {lead.interestedService ? (
                        <div className="flex items-center gap-1 bg-[#FFF4E5] text-[#D97706] px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap">
                          <Briefcase size={10}/>{lead.interestedService}
                        </div>
                      ) : <span className="text-gray-300 text-sm">—</span>}
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap">
                        {binReasonLabel(lead.binReason)}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-xs text-gray-400">
                        {lead.updatedAt
                          ? new Date(lead.updatedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })
                          : "—"}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <button
                        onClick={() => handleRestore(lead.id, lead.client)}
                        disabled={restoringId === lead.id}
                        className="h-8 px-3 rounded-xl bg-[#F0FFF4] text-green-700 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-green-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {restoringId === lead.id
                          ? <><RefreshCw size={11} className="animate-spin"/>Restoring…</>
                          : <><ArrowUpCircle size={11}/>Restore</>
                        }
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <Trash2 size={28} className="text-gray-200 mx-auto mb-3"/>
                      <p className="text-gray-400 text-sm">{search ? "No leads match your search." : "Your bin is empty."}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        </div>
      </main>
    </div>
  );
}
