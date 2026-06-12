"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, Phone, Briefcase,
  Trash2, X, ArrowUpCircle,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";

const NOT_PICKED_LIMIT = 7;

type Lead = {
  id:              string;
  client:          string;
  company:         string;
  phone:           string;
  status:          string;
  notPickedCount:  number;
  interestedService?: string;
  updatedAt?:      string;
};

export default function CSRBinPage() {
  const [isOpen,  setIsOpen]  = useState(false);
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "warn" } | null>(null);
  const showToast = (msg: string, type: "success" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Restore to pending ── */
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/bin");
      const formatted: Lead[] = (res.data.leads ?? []).map((l: {
        id: string; name?: string; company?: string;
        uploadFile?: { companyName?: string }; phone?: string;
        status?: string; notPickedCount?: number;
        interestedService?: string; updatedAt?: string;
      }) => ({
        id:               l.id,
        client:           l.name                      ?? "Unknown",
        company:          l.uploadFile?.companyName   ?? l.company ?? "N/A",
        phone:            l.phone                     ?? "N/A",
        status:           l.status                    ?? "",
        notPickedCount:   l.notPickedCount             ?? 0,
        interestedService: l.interestedService         ?? "",
        updatedAt:        l.updatedAt                 ?? "",
      }));
      setLeads(formatted);
    } catch (err) { console.log(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = window.setTimeout(() => { void fetchLeads(); }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter(l =>
      !q || l.client.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q)       ||
      l.phone.includes(q)
    );
  }, [leads, search]);

  const handleRestore = async (lead: Lead) => {
    setRestoringId(lead.id);
    try {
      await API.put(`/csr/lead/${lead.id}`, { status: "pending" });
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      showToast(`${lead.client} restored to active.`);
    } catch { showToast("Failed to restore lead.", "warn"); }
    finally { setRestoringId(null); }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 pt-[88px] sm:pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen} />

        {/* ── TOAST ── */}
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

        {/* ── HEADER ── */}
        <div className="mt-4 sm:mt-7 mb-4 sm:mb-6 flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#FFF7E6] flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-[#B54708] sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-[#0F172A]">My Bin</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Leads you haven&apos;t picked up yet.</p>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {[
            { label: "Total Not Picked", value: leads.length, color: "text-[#0F172A]" },
            { label: "Near Limit (≥6)",  value: leads.filter(l => l.notPickedCount >= NOT_PICKED_LIMIT - 1).length, color: "text-amber-600" },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl p-4 border border-white shadow-sm">
              <p className="text-xs text-gray-400 font-medium">{card.label}</p>
              <h2 className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</h2>
            </div>
          ))}
        </div>

        {/* ── TABLE CARD ── */}
        <div
          className="bg-white rounded-[22px] sm:rounded-[30px] border border-white shadow-sm flex flex-col"
          style={{ maxHeight: "calc(100vh - 300px)", minHeight: "340px" }}
        >
          {/* card header */}
          <div className="p-4 sm:p-5 border-b border-[#F3F3F3] shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg sm:text-[20px] font-bold text-[#0F172A]">Not Picked Leads</h3>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-[150px] sm:w-[220px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" placeholder="Search..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full h-9 sm:h-[40px] rounded-xl border border-gray-200 bg-[#FAFAFA] pl-8 pr-3 text-xs outline-none focus:border-[#B8112D]"
                  />
                </div>
                <button onClick={() => void fetchLeads()}
                  className="h-9 sm:h-[40px] w-9 sm:w-[40px] rounded-xl border border-gray-200 bg-[#FAFAFA] flex items-center justify-center hover:border-[#B8112D] hover:text-[#B8112D] text-gray-500 transition-colors">
                  <RefreshCw size={13} />
                </button>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FFF7E6] text-[#B54708] whitespace-nowrap">
                  {filtered.length} Leads
                </span>
              </div>
            </div>
          </div>

          {/* table */}
          <div className="overflow-auto flex-1 px-3 sm:px-5 pb-4">
            <table className="w-full" style={{ minWidth: "680px" }}>
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[#F1F1F1]">
                  {["#","Client","Company","Phone","Service","Tries","Updated","Action"].map(h => (
                    <th key={h} className="text-left py-3 px-2 text-[11px] sm:text-[12px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3].map(i => (
                    <tr key={i} className="border-b border-[#F7F7F7]">
                      {[1,2,3,4,5,6,7,8].map(j => (
                        <td key={j} className="py-4 px-2"><div className="h-3.5 bg-gray-100 rounded animate-pulse w-16"/></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? filtered.map((lead, idx) => {
                  const isNear = lead.notPickedCount >= NOT_PICKED_LIMIT - 1;
                  return (
                    <tr key={lead.id} className={`border-b border-[#F7F7F7] ${isNear ? "bg-amber-50/60" : "hover:bg-[#FFFBF2]"}`}>
                      <td className="py-4 px-2 text-xs text-gray-400">{idx + 1}</td>

                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${isNear ? "bg-amber-500" : "bg-[#B54708]"}`}>
                            {lead.client.charAt(0)}
                          </div>
                          <span className="font-semibold text-[#0F172A] text-[13px]">{lead.client}</span>
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

                      <td className="py-4 px-2">
                        {lead.interestedService ? (
                          <div className="flex items-center gap-1 bg-[#FFF4E5] text-[#D97706] px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap">
                            <Briefcase size={10}/>{lead.interestedService}
                          </div>
                        ) : <span className="text-gray-300 text-sm">—</span>}
                      </td>

                      <td className="py-4 px-2">
                        <span className={`text-xs font-bold ${isNear ? "text-amber-600" : "text-gray-500"}`}>
                          {lead.notPickedCount}/{NOT_PICKED_LIMIT}
                          {isNear && <span className="ml-1 text-[10px] text-amber-500">⚠</span>}
                        </span>
                      </td>

                      <td className="py-4 px-2">
                        <span className="text-xs text-gray-400">
                          {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short" }) : "—"}
                        </span>
                      </td>

                      <td className="py-4 px-2">
                        <button
                          onClick={() => handleRestore(lead)}
                          disabled={restoringId === lead.id}
                          title="Restore to active"
                          className="h-8 px-3 rounded-xl bg-[#F0FFF4] text-green-700 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-green-100 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {restoringId === lead.id
                            ? <><RefreshCw size={11} className="animate-spin"/>Restoring…</>
                            : <><ArrowUpCircle size={11}/>Restore</>
                          }
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <Trash2 size={28} className="text-gray-200 mx-auto mb-3"/>
                      <p className="text-gray-400 text-sm">{search ? "No leads match your search." : "Your bin is empty."}</p>
                      {search && (
                        <button onClick={() => setSearch("")} className="mt-2 text-[#B8112D] text-xs font-semibold hover:underline">
                          Clear search
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
