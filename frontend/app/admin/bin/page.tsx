"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trash2, Search, RefreshCw, Phone, Briefcase,
  ThumbsDown, PhoneOff, X, Check, ArrowRightLeft, Users,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import API from "@/lib/api";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

type BinLead = {
  id:               string;
  client:           string;
  company:          string;
  phone:            string;
  status:           string;
  notPickedCount:   number;
  notInterestedCount: number;
  interestedService?: string;
  updatedAt?:       string;
  csr:              { id: string; name: string; csrCode: string | null };
};

type CSR = { id: string; name: string; csrCode: string | null };

const NOT_INTERESTED_LIMIT = 3;
const NOT_PICKED_LIMIT     = 7;

export default function AdminBinPage() {
  const [leads,   setLeads]   = useState<BinLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [tab,     setTab]     = useState<"notpicked" | "notinterested">("notpicked");

  /* ── Reassign modal ── */
  const [showReassign,   setShowReassign]   = useState(false);
  const [reassignLead,   setReassignLead]   = useState<BinLead | null>(null);
  const [csrOptions,     setCsrOptions]     = useState<CSR[]>([]);
  const [selectedCsrId,  setSelectedCsrId]  = useState("");
  const [isReassigning,  setIsReassigning]  = useState(false);
  const [csrLoading,     setCsrLoading]     = useState(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/admin/bin");
      const formatted: BinLead[] = (res.data.leads ?? []).map((l: {
        id: string; name?: string; company?: string;
        uploadFile?: { companyName?: string }; phone?: string;
        status?: string; notPickedCount?: number; notInterestedCount?: number;
        interestedService?: string; updatedAt?: string;
        csr?: { id: string; name: string; csrCode?: string | null };
      }) => ({
        id:                 l.id,
        client:             l.name                    ?? "Unknown",
        company:            l.uploadFile?.companyName ?? l.company ?? "N/A",
        phone:              l.phone                   ?? "N/A",
        status:             l.status                  ?? "",
        notPickedCount:     l.notPickedCount           ?? 0,
        notInterestedCount: l.notInterestedCount       ?? 0,
        interestedService:  l.interestedService        ?? "",
        updatedAt:          l.updatedAt               ?? "",
        csr:                { id: l.csr?.id ?? "", name: l.csr?.name ?? "—", csrCode: l.csr?.csrCode ?? null },
      }));
      setLeads(formatted);
    } catch { toast.error("Failed to load bin."); }
    finally { setLoading(false); }
  };

  const fetchCSRs = async () => {
    setCsrLoading(true);
    try {
      const res = await API.get("/admin/csrs");
      setCsrOptions(res.data.csrs ?? []);
    } catch { toast.error("Failed to load CSRs."); }
    finally { setCsrLoading(false); }
  };

  useEffect(() => {
    const t = window.setTimeout(() => { void fetchLeads(); }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const openReassign = (lead: BinLead) => {
    setReassignLead(lead);
    setSelectedCsrId("");
    setShowReassign(true);
    if (csrOptions.length === 0) void fetchCSRs();
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

  const notPicked     = useMemo(() => leads.filter(l => l.status === "not picked" || l.status === "not completed"), [leads]);
  const notInterested = useMemo(() => leads.filter(l => l.status === "Not Interested"), [leads]);
  const currentList   = tab === "notpicked" ? notPicked : notInterested;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currentList.filter(l =>
      !q || l.client.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q)      ||
      l.phone.includes(q)                      ||
      l.csr.name.toLowerCase().includes(q)
    );
  }, [currentList, search]);

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" />
      <DashboardSidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <DashboardNavbar />

        <div className="p-4 sm:p-6 lg:p-8 pt-[64px]">

          {/* ── HEADER ── */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <Trash2 size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Bin</h1>
              <p className="text-sm text-gray-400 mt-0.5">All not-picked &amp; not-interested leads across all CSRs.</p>
            </div>
          </div>

          {/* ── BIN OVERVIEW CHART ── */}
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-[#111827] text-base">Bin Overview</h3>
                <p className="text-xs text-gray-400 mt-0.5">Not-picked & not-interested leads across all CSRs</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"/>Not Picked</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#B8112D] inline-block"/>Not Interested</span>
              </div>
            </div>
            <div className="h-[130px]">
              {loading ? (
                <div className="h-full bg-gray-50 rounded-2xl animate-pulse"/>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Not Picked",     value: notPicked.length,     fill: "#F59E0B" },
                      { name: "Not Interested", value: notInterested.length, fill: "#B8112D" },
                      { name: "Total",          value: leads.length,         fill: "#6B7280" },
                      { name: "CSRs Affected",  value: new Set(leads.map(l => l.csr.id)).size, fill: "#3B82F6" },
                    ]}
                    barSize={52}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"#6B7280", fontWeight:600 }}/>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"#9CA3AF" }} width={28}/>
                    <Tooltip contentStyle={{ borderRadius:"12px", border:"1px solid #e5e7eb", fontSize:"12px" }}/>
                    <Bar dataKey="value" radius={[7,7,0,0]} name="Count">
                      {[
                        { fill: "#F59E0B" },
                        { fill: "#B8112D" },
                        { fill: "#6B7280" },
                        { fill: "#3B82F6" },
                      ].map((e, i) => <Cell key={i} fill={e.fill}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
              {[
                { label:"Not Picked",    value: notPicked.length,     color:"text-amber-600"  },
                { label:"Not Interested",value: notInterested.length, color:"text-[#B8112D]"  },
                { label:"Total",         value: leads.length,          color:"text-gray-700"  },
                { label:"CSRs Affected", value: new Set(leads.map(l => l.csr.id)).size, color:"text-blue-600" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── TABS ── */}
          <div className="flex gap-2 sm:gap-3 mb-4 overflow-x-auto pb-0.5">
            {[
              { key: "notpicked",     label: "Not Picked",     count: notPicked.length,     Icon: PhoneOff   },
              { key: "notinterested", label: "Not Interested", count: notInterested.length, Icon: ThumbsDown },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key as typeof tab); setSearch(""); }}
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

          {/* ── TABLE CARD ── */}
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm flex flex-col"
               style={{ maxHeight: "calc(100vh - 380px)", minHeight: "340px" }}>

            {/* card header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="font-semibold text-gray-800 text-base sm:text-lg">
                  {tab === "notpicked" ? "Not Picked" : "Not Interested"} Leads
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-[150px] sm:w-[220px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text" placeholder="Search by name, company, CSR…"
                      value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full h-9 sm:h-[40px] rounded-xl border border-gray-200 bg-[#FAFAFA] pl-8 pr-3 text-xs outline-none focus:border-[#B8112D]"
                    />
                  </div>
                  <button onClick={() => void fetchLeads()}
                    className="h-9 sm:h-[40px] w-9 sm:w-[40px] rounded-xl border border-gray-200 bg-[#FAFAFA] flex items-center justify-center hover:border-[#B8112D] hover:text-[#B8112D] text-gray-500 transition-colors">
                    <RefreshCw size={13} />
                  </button>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FFF1F3] text-[#B8112D] whitespace-nowrap">
                    {filtered.length} Leads
                  </span>
                </div>
              </div>
            </div>

            {/* table */}
            <div className="overflow-auto flex-1 px-4 sm:px-5 pb-4">
              <table className="w-full" style={{ minWidth: "780px" }}>
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-100">
                    {["#","CSR","Client","Company","Phone","Service","Tries","Updated","Action"].map(h => (
                      <th key={h} className="text-left py-3 px-2 text-[11px] sm:text-[12px] font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1,2,3,4].map(i => (
                      <tr key={i} className="border-b border-gray-50">
                        {[1,2,3,4,5,6,7,8,9].map(j => (
                          <td key={j} className="py-4 px-2"><div className="h-3.5 bg-gray-100 rounded animate-pulse w-16"/></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length > 0 ? filtered.map((lead, idx) => {
                    const tries   = tab === "notpicked" ? lead.notPickedCount : lead.notInterestedCount;
                    const limit   = tab === "notpicked" ? NOT_PICKED_LIMIT   : NOT_INTERESTED_LIMIT;
                    const isNear  = tries >= limit - 1;

                    return (
                      <tr key={lead.id} className={`border-b border-gray-50 ${isNear ? "bg-red-50/40" : "hover:bg-gray-50"}`}>
                        <td className="py-3.5 px-2 text-xs text-gray-400">{idx + 1}</td>

                        {/* CSR badge */}
                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                              {lead.csr.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-gray-800 truncate max-w-[80px]">{lead.csr.name}</p>
                              {lead.csr.csrCode && <p className="text-[10px] text-gray-400">{lead.csr.csrCode}</p>}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${isNear ? "bg-red-500" : tab === "notpicked" ? "bg-amber-500" : "bg-[#B8112D]"}`}>
                              {lead.client.charAt(0)}
                            </div>
                            <span className="font-semibold text-[13px] text-gray-800">{lead.client}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-2">
                          <span className="text-[13px] font-medium text-gray-700 max-w-[100px] truncate block">{lead.company}</span>
                        </td>

                        <td className="py-3.5 px-2">
                          <div className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-xl text-[11px] font-medium w-fit whitespace-nowrap">
                            <Phone size={10}/>{lead.phone}
                          </div>
                        </td>

                        <td className="py-3.5 px-2">
                          {lead.interestedService ? (
                            <div className="flex items-center gap-1 bg-[#FFF4E5] text-[#D97706] px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap">
                              <Briefcase size={10}/>{lead.interestedService}
                            </div>
                          ) : <span className="text-gray-300 text-sm">—</span>}
                        </td>

                        <td className="py-3.5 px-2">
                          <span className={`text-xs font-bold ${isNear ? "text-red-600" : "text-gray-500"}`}>
                            {tries}/{limit}
                            {isNear && <span className="ml-1 text-[10px]">⚠</span>}
                          </span>
                        </td>

                        <td className="py-3.5 px-2">
                          <span className="text-xs text-gray-400">
                            {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" }) : "—"}
                          </span>
                        </td>

                        <td className="py-3.5 px-2">
                          <button
                            onClick={() => openReassign(lead)}
                            className="h-8 px-3 rounded-xl bg-[#EAF5FF] text-[#0B84F3] text-[11px] font-semibold flex items-center gap-1.5 hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            <ArrowRightLeft size={11}/>Reassign
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={9} className="py-20 text-center">
                        <Trash2 size={28} className="text-gray-200 mx-auto mb-3"/>
                        <p className="text-gray-400 text-sm">
                          {search ? "No leads match your search." : `No ${tab === "notpicked" ? "not-picked" : "not-interested"} leads.`}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ══ REASSIGN MODAL ══ */}
      {showReassign && reassignLead && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden">
            {/* header */}
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Reassign Lead</h2>
                  <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                    Assigning <span className="font-semibold text-white">{reassignLead.client}</span> to a new CSR
                  </p>
                </div>
                <button onClick={() => setShowReassign(false)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0">
                  <X size={15}/>
                </button>
              </div>
            </div>

            {/* CSR list */}
            <div className="px-5 sm:px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
              {csrLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw size={20} className="animate-spin text-gray-400"/>
                </div>
              ) : csrOptions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No CSRs available.</p>
              ) : csrOptions.map(csr => (
                <button
                  key={csr.id}
                  onClick={() => setSelectedCsrId(csr.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                    selectedCsrId === csr.id
                      ? "border-[#B8112D] bg-[#FFF1F3]"
                      : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                    selectedCsrId === csr.id ? "bg-[#B8112D]" : "bg-gray-400"
                  }`}>
                    {csr.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${selectedCsrId === csr.id ? "text-[#B8112D]" : "text-[#0F172A]"}`}>
                      {csr.name}
                    </p>
                    {csr.csrCode && <p className="text-xs text-gray-400">{csr.csrCode}</p>}
                  </div>
                  {selectedCsrId === csr.id && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white"/>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* actions */}
            <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2">
              <button onClick={() => setShowReassign(false)}
                className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm">
                Cancel
              </button>
              <button
                onClick={confirmReassign}
                disabled={!selectedCsrId || isReassigning}
                className="flex-1 h-11 rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft size={14}/>
                {isReassigning ? "Reassigning…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
