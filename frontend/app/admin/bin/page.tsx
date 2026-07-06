"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Trash2, Search, RefreshCw, Phone, Briefcase,
  ThumbsDown, PhoneOff, X, Check, ArrowRightLeft, Star, User2, ChevronDown,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import StaffPageShell from "@/app/components/staff/StaffPageShell";
import Pagination from "@/app/csr/components/shared/Pagination";
import API from "@/lib/api";
import { binCategory, binReasonLabel } from "@/app/csr/hooks/useBinData";
import { CSR_THEAD } from "@/app/csr/components/shared/csrTableStyles";

const BinStatsChart = dynamic(() => import("./BinStatsChart"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[120px] bg-gray-50 dark:bg-gray-800 rounded-2xl animate-pulse" />,
});

type BinLead = {
  id:                 string;
  client:             string;
  company:            string;
  phone:              string;
  status:             string;
  notPickedCount:     number;
  notInterestedCount: number;
  interestedService?: string;
  binReason:          string | null;
  updatedAt?:         string;
  csr:                { id: string; name: string; csrCode: string | null };
};

type CSR = { id: string; name: string; csrCode: string | null };
type TabKey = "all" | "notpicked" | "notinterested" | "deleted";

const PAGE_SIZE = 30;

function BinLeadCard({
  lead,
  idx,
  onReassign,
}: {
  lead: BinLead;
  idx: number;
  onReassign: (l: BinLead) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 font-medium">#{idx}</p>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{lead.client}</p>
          <p className="text-xs text-gray-500 truncate">{lead.company}</p>
        </div>
        <button
          type="button"
          onClick={() => onReassign(lead)}
          className="shrink-0 h-9 px-3 rounded-xl bg-[#EAF5FF] text-[#0B84F3] text-[11px] font-semibold flex items-center gap-1.5"
        >
          <ArrowRightLeft size={11} />
          Reassign
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-xl font-medium text-gray-700 dark:text-gray-300">
          <User2 size={10} />
          {lead.csr.csrCode ? `${lead.csr.csrCode} · ` : ""}{lead.csr.name}
        </span>
        <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-xl font-medium text-gray-600">
          <Phone size={10} />
          {lead.phone}
        </span>
        {lead.interestedService && (
          <span className="inline-flex items-center gap-1 bg-[#FFF4E5] text-[#D97706] px-2.5 py-1.5 rounded-xl font-semibold">
            <Briefcase size={10} />
            {lead.interestedService}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
          {binReasonLabel(lead.binReason)}
        </span>
        <span className="text-[11px] text-gray-400">
          {lead.updatedAt
            ? new Date(lead.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
            : "—"}
        </span>
      </div>
    </div>
  );
}

export default function AdminBinPage() {
  const [leads,      setLeads]      = useState<BinLead[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [tab,        setTab]        = useState<TabKey>("all");
  const [page,       setPage]       = useState(1);
  const [filterCSR,  setFilterCSR]  = useState("all");
  const [allCsrs,    setAllCsrs]    = useState<CSR[]>([]);

  const [showReassign,  setShowReassign]  = useState(false);
  const [reassignLead,  setReassignLead]  = useState<BinLead | null>(null);
  const [csrOptions,    setCsrOptions]    = useState<CSR[]>([]);
  const [selectedCsrId, setSelectedCsrId] = useState("");
  const [isReassigning, setIsReassigning] = useState(false);

  const mapLeads = (raw: unknown[]): BinLead[] =>
    (raw as Array<Record<string, unknown>>).map(l => ({
      id:                 String(l.id ?? ""),
      client:             String(l.name ?? "Unknown"),
      company:            String((l.uploadFile as { companyName?: string })?.companyName ?? l.company ?? "N/A"),
      phone:              String(l.phone ?? "N/A"),
      status:             String(l.status ?? ""),
      notPickedCount:     Number(l.notPickedCount ?? 0),
      notInterestedCount: Number(l.notInterestedCount ?? 0),
      interestedService:  String(l.interestedService ?? ""),
      binReason:          (l.binReason as string | null) ?? null,
      updatedAt:          String(l.updatedAt ?? ""),
      csr: {
        id:      String((l.csr as { id?: string })?.id ?? ""),
        name:    String((l.csr as { name?: string })?.name ?? "—"),
        csrCode: ((l.csr as { csrCode?: string | null })?.csrCode) ?? null,
      },
    }));

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page: 1, limit: 500 };
      if (filterCSR !== "all") params.csrId = filterCSR;
      const res = await API.get("/admin/bin", { params });
      setLeads(mapLeads(res.data.leads ?? []));
    } catch {
      toast.error("Failed to load bin.");
    } finally {
      setLoading(false);
    }
  }, [filterCSR]);

  useEffect(() => {
    API.get("/admin/csrs").then(res => setAllCsrs(res.data.csrs ?? [])).catch(() => {});
  }, []);

  useEffect(() => { void fetchLeads(); }, [fetchLeads]);

  const openReassign = (lead: BinLead) => {
    setReassignLead(lead);
    setSelectedCsrId("");
    setShowReassign(true);
    if (csrOptions.length === 0) {
      API.get("/admin/csrs").then(res => setCsrOptions(res.data.csrs ?? [])).catch(() => toast.error("Failed to load CSRs."));
    }
  };

  const confirmReassign = async () => {
    if (!reassignLead || !selectedCsrId) return;
    setIsReassigning(true);
    try {
      await API.put(`/admin/lead/${reassignLead.id}/reassign`, { csrId: selectedCsrId });
      const name = csrOptions.find(c => c.id === selectedCsrId)?.name ?? "another CSR";
      toast.success(`Lead reassigned to ${name}.`);
      setLeads(prev => prev.filter(l => l.id !== reassignLead.id));
      setShowReassign(false);
      setReassignLead(null);
    } catch { toast.error("Failed to reassign lead."); }
    finally { setIsReassigning(false); }
  };

  const byTab = useMemo(() => ({
    notpicked:     leads.filter(l => binCategory(l.binReason) === "notpicked"),
    notinterested: leads.filter(l => binCategory(l.binReason) === "notinterested"),
    deleted:       leads.filter(l => binCategory(l.binReason) === "deleted"),
  }), [leads]);

  const currentList = tab === "all" ? leads : byTab[tab];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currentList.filter(l =>
      !q || l.client.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.csr.name.toLowerCase().includes(q) ||
      binReasonLabel(l.binReason).toLowerCase().includes(q)
    );
  }, [currentList, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabs: { key: TabKey; label: string; count: number; Icon: typeof Trash2 }[] = [
    { key: "all",           label: "All",            count: leads.length,              Icon: Trash2     },
    { key: "notpicked",     label: "Not Picked",     count: byTab.notpicked.length,     Icon: PhoneOff   },
    { key: "notinterested", label: "Not Interested", count: byTab.notinterested.length, Icon: ThumbsDown },
    { key: "deleted",       label: "Deleted",        count: byTab.deleted.length,       Icon: Star       },
  ];

  return (
    <StaffPageShell>
      <Toaster position="top-center" containerClassName="!top-16 sm:!top-4" />

      <div className="flex items-center gap-3 mt-2 sm:mt-4 mb-4 sm:mb-6">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
          <Trash2 size={18} className="text-amber-600 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100">Bin</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Limit-reached and deleted leads — all CSRs or filter individually.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl lg:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-3 sm:p-5 mb-4 sm:mb-6">
        <div className="h-[120px] sm:h-[140px] lg:h-[150px]">
          <BinStatsChart
            loading={loading}
            data={[
              { name: "Not Picked", value: byTab.notpicked.length },
              { name: "Not Interested", value: byTab.notinterested.length },
              { name: "Deleted", value: byTab.deleted.length },
              { name: "Total", value: leads.length },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setSearch(""); setPage(1); }}
              className={`h-10 px-3 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all whitespace-nowrap shrink-0 ${
                tab === t.key ? "bg-[#B8112D] text-white" : "bg-white dark:bg-gray-900 text-[#B8112D] border border-[#B8112D]/20"
              }`}
            >
              <t.Icon size={14} />
              <span className="sm:hidden">{t.label.split(" ")[0]}</span>
              <span className="hidden sm:inline">{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${tab === t.key ? "bg-white/20" : "bg-[#FFF1F3]"}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <User2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={filterCSR}
            onChange={e => { setFilterCSR(e.target.value); setPage(1); }}
            className="appearance-none w-full h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-9 text-sm outline-none focus:border-[#B8112D]"
          >
            <option value="all">All CSRs</option>
            {allCsrs.map(c => (
              <option key={c.id} value={c.id}>{c.csrCode ? `${c.csrCode} — ${c.name}` : c.name}</option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl lg:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-base sm:text-lg">Bin Leads</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-gray-800 pl-8 pr-3 text-xs sm:text-sm outline-none focus:border-[#B8112D]"
                />
              </div>
              <button
                type="button"
                onClick={() => void fetchLeads()}
                className="h-10 w-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-gray-800 flex items-center justify-center hover:border-[#B8112D] text-gray-500 shrink-0"
              >
                <RefreshCw size={14} />
              </button>
              <span className="text-xs font-semibold px-3 py-2 rounded-xl bg-[#FFF1F3] text-[#B8112D] whitespace-nowrap">
                {filtered.length} Leads
              </span>
            </div>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden p-3 sm:p-4 space-y-3">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))
          ) : paginated.length > 0 ? (
            paginated.map((lead, idx) => (
              <BinLeadCard
                key={lead.id}
                lead={lead}
                idx={(page - 1) * PAGE_SIZE + idx + 1}
                onReassign={openReassign}
              />
            ))
          ) : (
            <div className="py-16 text-center">
              <Trash2 size={28} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{search ? "No leads match your search." : "Bin is empty."}</p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto px-4 sm:px-5 pb-4">
          <table className="w-full min-w-[720px]">
            <thead className={CSR_THEAD}>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {["#", "CSR", "Client", "Company", "Phone", "Service", "Reason", "Updated", "Action"].map(h => (
                  <th key={h} className="text-left py-3 px-2 text-[11px] sm:text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="border-b border-gray-50">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => (
                      <td key={j} className="py-4 px-2"><div className="h-3.5 bg-gray-100 rounded animate-pulse w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length > 0 ? paginated.map((lead, idx) => (
                <tr key={lead.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3.5 px-2 text-xs text-gray-400">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="py-3.5 px-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">{lead.csr.name}</p>
                      {lead.csr.csrCode && <p className="text-[10px] text-gray-400">{lead.csr.csrCode}</p>}
                    </div>
                  </td>
                  <td className="py-3.5 px-2"><span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{lead.client}</span></td>
                  <td className="py-3.5 px-2"><span className="text-sm text-gray-700 dark:text-gray-300 truncate block max-w-[120px]">{lead.company}</span></td>
                  <td className="py-3.5 px-2">
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-600 px-2.5 py-1.5 rounded-xl text-[11px] font-medium w-fit">
                      <Phone size={10} />{lead.phone}
                    </div>
                  </td>
                  <td className="py-3.5 px-2">
                    {lead.interestedService ? (
                      <div className="flex items-center gap-1 bg-[#FFF4E5] text-[#D97706] px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap">
                        <Briefcase size={10} />{lead.interestedService}
                      </div>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="py-3.5 px-2">
                    <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg whitespace-nowrap">
                      {binReasonLabel(lead.binReason)}
                    </span>
                  </td>
                  <td className="py-3.5 px-2">
                    <span className="text-xs text-gray-400">
                      {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                    </span>
                  </td>
                  <td className="py-3.5 px-2">
                    <button
                      type="button"
                      onClick={() => openReassign(lead)}
                      className="h-8 px-3 rounded-xl bg-[#EAF5FF] text-[#0B84F3] text-[11px] font-semibold flex items-center gap-1.5 hover:bg-blue-100 whitespace-nowrap"
                    >
                      <ArrowRightLeft size={11} />Reassign
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <Trash2 size={28} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">{search ? "No leads match your search." : "Bin is empty."}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 sm:px-5 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        )}
      </div>

      {showReassign && reassignLead && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white">Reassign Lead</h2>
                  <p className="text-white/70 text-xs sm:text-sm mt-0.5 truncate">
                    Assigning <span className="font-semibold text-white">{reassignLead.client}</span>
                  </p>
                </div>
                <button type="button" onClick={() => setShowReassign(false)} className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="px-5 sm:px-6 py-4 space-y-2 overflow-y-auto flex-1">
              {csrOptions.map(csr => (
                <button
                  key={csr.id}
                  type="button"
                  onClick={() => setSelectedCsrId(csr.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                    selectedCsrId === csr.id ? "border-[#B8112D] bg-[#FFF1F3]" : "border-gray-100 dark:border-gray-700 bg-[#FAFAFA] dark:bg-gray-800"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${selectedCsrId === csr.id ? "bg-[#B8112D]" : "bg-gray-400"}`}>
                    {csr.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${selectedCsrId === csr.id ? "text-[#B8112D]" : "text-[#0F172A] dark:text-gray-100"}`}>{csr.name}</p>
                    {csr.csrCode && <p className="text-xs text-gray-400">{csr.csrCode}</p>}
                  </div>
                  {selectedCsrId === csr.id && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2 shrink-0 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setShowReassign(false)} className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReassign}
                disabled={!selectedCsrId || isReassigning}
                className="flex-1 h-11 rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft size={14} />
                {isReassigning ? "Reassigning…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </StaffPageShell>
  );
}
