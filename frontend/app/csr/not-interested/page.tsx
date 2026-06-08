"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ThumbsDown, PhoneOff, Search, Filter, Users, X,
  Phone, Briefcase, Clock3, ArrowRightLeft, CircleAlert,
  RefreshCw,
} from "lucide-react";

import CSRNavbar  from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";
import API from "@/lib/api";

/* ─── LIMITS ─── */
const NOT_INTERESTED_LIMIT = 7;
const NOT_PICKED_LIMIT     = 3;

type Lead = {
  id: string;
  client: string;
  company: string;
  phone: string;
  status: string;
  notInterestedCount: number;
  notPickedCount: number;
  comments?: string;
  interestedService?: string;
};

/* Progress bar color based on how close to limit */
function TriesBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-semibold text-gray-500">{used} / {limit} tries</span>
        <span className={`text-[11px] font-bold ${used >= limit ? "text-red-600" : "text-gray-400"}`}>
          {used >= limit ? "Redistributed" : `${limit - used} left`}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function NotInterestedPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [leads,  setLeads]  = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"notinterested" | "notpicked">("notinterested");

  /* search + date filter */
  const [search,     setSearch]     = useState("");
  const [filterDate, setFilterDate] = useState("");

  /* selected lead for detail panel */
  const [selected, setSelected] = useState<Lead | null>(null);

  /* toast state */
  const [toast, setToast] = useState<{ msg: string; type: "success"|"warn" } | null>(null);
  const showToast = (msg: string, type: "success"|"warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  /* ─── FETCH ─── */
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/not-interested");
      const formatted: Lead[] = (res.data.leads ?? []).map((l: {
        id: string; name?: string; company?: string; uploadFile?: { companyName?: string };
        phone?: string; status?: string; notInterestedCount?: number;
        notPickedCount?: number; comments?: string; interestedService?: string;
      }) => ({
        id:                 l.id,
        client:             l.name    ?? "Unknown",
        company:            l.uploadFile?.companyName ?? l.company ?? "N/A",
        phone:              l.phone   ?? "N/A",
        status:             l.status  ?? "",
        notInterestedCount: l.notInterestedCount ?? 0,
        notPickedCount:     l.notPickedCount     ?? 0,
        comments:           l.comments ?? "",
        interestedService:  l.interestedService ?? "",
      }));
      setLeads(formatted);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchLeads(); }, []);

  /* ─── DERIVED LISTS ─── */
  const notInterested = useMemo(() =>
    leads.filter(l => l.status === "Not Interested" || l.status === "completed"),
  [leads]);

  const notPicked = useMemo(() =>
    leads.filter(l => l.status === "not picked" || l.status === "not completed"),
  [leads]);

  const currentList = activeTab === "notinterested" ? notInterested : notPicked;
  const limit       = activeTab === "notinterested" ? NOT_INTERESTED_LIMIT : NOT_PICKED_LIMIT;
  const countKey    = activeTab === "notinterested" ? "notInterestedCount" : "notPickedCount";

  /* filtered */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currentList.filter(l =>
      (!q || l.client.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.phone.includes(q))
    );
  }, [currentList, search]);

  const activeLead = selected ?? filtered[0] ?? null;

  /* ─── RE-TRY (increment count, may redistribute) ─── */
  const handleRetry = async (lead: Lead) => {
    const newStatus = activeTab === "notinterested" ? "Not Interested" : "not picked";
    try {
      const res = await API.put(`/csr/lead/${lead.id}`, { status: newStatus });
      if (res.data.redistributed) {
        showToast(`${lead.client} has been reassigned to another CSR after reaching the limit.`, "warn");
        setLeads(prev => prev.filter(l => l.id !== lead.id));
        if (selected?.id === lead.id) setSelected(null);
      } else {
        const triesLeft = res.data.triesLeft ?? 0;
        showToast(`Retried. ${triesLeft} attempt${triesLeft !== 1 ? "s" : ""} left.`);
        setLeads(prev => prev.map(l =>
          l.id === lead.id
            ? { ...l, [countKey]: (l[countKey as keyof Lead] as number) + 1 }
            : l
        ));
        if (selected?.id === lead.id) {
          setSelected(prev => prev ? { ...prev, [countKey]: (prev[countKey as keyof Lead] as number) + 1 } : prev);
        }
      }
    } catch (err) { console.log(err); }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <CSRSidebar isOpen={isOpen} setIsOpen={setIsOpen}/>
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">
        <CSRNavbar setIsOpen={setIsOpen}/>

        {/* TOAST */}
        {toast && (
          <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all ${
            toast.type === "warn" ? "bg-amber-50 border border-amber-300 text-amber-800" : "bg-green-50 border border-green-300 text-green-800"
          }`}>
            {toast.type === "warn" ? <ArrowRightLeft size={16}/> : <RefreshCw size={16}/>}
            {toast.msg}
            <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X size={14}/></button>
          </div>
        )}

        {/* HEADER */}
        <div className="mt-7 mb-6">
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#0F172A]">Leads Follow-up</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Track Not Interested & Not Picked leads with automatic redistribution.</p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[
            { label:"Not Interested", value: notInterested.length,  sub:`limit ${NOT_INTERESTED_LIMIT} tries`, color:"bg-[#FFF1F3] text-[#B8112D]", Icon: ThumbsDown  },
            { label:"Not Picked",     value: notPicked.length,      sub:`limit ${NOT_PICKED_LIMIT} tries`,     color:"bg-[#FFF7E6] text-[#B54708]", Icon: PhoneOff    },
            { label:"Near Limit (NI)",value: notInterested.filter(l => l.notInterestedCount >= NOT_INTERESTED_LIMIT - 1).length, sub:"1 try left",  color:"bg-[#FEF3C7] text-[#92400E]", Icon: CircleAlert },
            { label:"Near Limit (NP)",value: notPicked.filter(l => l.notPickedCount >= NOT_PICKED_LIMIT - 1).length,             sub:"1 try left",  color:"bg-[#FEF3C7] text-[#92400E]", Icon: CircleAlert },
          ].map(card => (
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
          <button onClick={() => { setActiveTab("notinterested"); setSelected(null); }}
            className={`h-11 px-5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all ${activeTab==="notinterested" ? "bg-[#B8112D] text-white" : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"}`}>
            <ThumbsDown size={16}/>Not Interested
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${activeTab==="notinterested" ? "bg-white/20" : "bg-[#FFF1F3]"}`}>{notInterested.length}</span>
          </button>
          <button onClick={() => { setActiveTab("notpicked"); setSelected(null); }}
            className={`h-11 px-5 rounded-2xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all ${activeTab==="notpicked" ? "bg-[#B8112D] text-white" : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"}`}>
            <PhoneOff size={16}/>Not Picked
            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${activeTab==="notpicked" ? "bg-white/20" : "bg-[#FFF1F3]"}`}>{notPicked.length}</span>
          </button>
        </div>

        {/* SEARCH + DATE */}
        <div className="bg-white rounded-[26px] shadow-sm px-5 py-4 mb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-[380px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search by client, company or phone..."
              value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
              className="w-full h-[46px] rounded-2xl border border-gray-200 bg-[#FAFAFA] pl-10 pr-4 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
          <div className="flex items-center gap-2 text-[#B8112D] text-sm font-semibold shrink-0">
            <Filter size={15}/>
            <span>{filtered.length} record{filtered.length!==1?"s":""}</span>
          </div>
        </div>

        {/* TWO-PANEL */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          {/* LEFT — lead list */}
          <div className="xl:col-span-5 bg-white rounded-[30px] border border-gray-100 shadow-sm flex flex-col"
            style={{ maxHeight:"calc(100vh - 380px)", minHeight:"380px" }}>
            <div className="p-5 pb-4 border-b border-[#F3F3F3] shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[18px] font-bold text-[#0F172A]">
                    {activeTab === "notinterested" ? "Not Interested" : "Not Picked"} Leads
                  </h3>
                  <p className="text-gray-500 text-sm mt-0.5">
                    Limit: <span className="font-semibold text-[#B8112D]">{limit} tries</span> then auto-redistributed
                  </p>
                </div>
                <button onClick={() => void fetchLeads()}
                  className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" title="Refresh">
                  <RefreshCw size={15} className="text-gray-500"/>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {loading ? (
                [1,2,3].map(i => (
                  <div key={i} className="rounded-[22px] border border-gray-100 p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0"/>
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-100 rounded w-32"/>
                        <div className="h-3 bg-gray-100 rounded w-20"/>
                        <div className="h-2 bg-gray-100 rounded w-full mt-1"/>
                      </div>
                    </div>
                  </div>
                ))
              ) : filtered.length > 0 ? filtered.map(lead => {
                const tries = lead[countKey as keyof Lead] as number;
                const isNearLimit = tries >= limit - 1;
                const isAtLimit   = tries >= limit;
                return (
                  <button key={lead.id} onClick={() => setSelected(lead)}
                    className={`w-full text-left rounded-[22px] border p-4 transition-all ${
                      activeLead?.id === lead.id
                        ? "border-[#B8112D] bg-[#FFF8F9]"
                        : "border-gray-100 bg-white hover:border-[#B8112D]/30"
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white ${isAtLimit ? "bg-gray-400" : isNearLimit ? "bg-amber-500" : "bg-[#B8112D]"}`}>
                        {lead.client.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-[#0F172A] text-[13px] truncate">{lead.client}</h4>
                          {isAtLimit ? (
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg shrink-0">Redistributed</span>
                          ) : isNearLimit ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg shrink-0">⚠ Last try</span>
                          ) : null}
                        </div>
                        <p className="text-gray-500 text-[11px] mt-0.5 truncate">{lead.company}</p>
                        <div className="mt-2">
                          <TriesBar
                            used={tries}
                            limit={limit}
                            color={isAtLimit ? "bg-gray-300" : isNearLimit ? "bg-amber-400" : "bg-[#B8112D]"}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <div className="text-center py-10">
                  {activeTab === "notinterested" ? <ThumbsDown size={28} className="text-gray-200 mx-auto mb-3"/> : <PhoneOff size={28} className="text-gray-200 mx-auto mb-3"/>}
                  <p className="text-gray-400 text-sm">No leads in this category.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — detail panel */}
          {activeLead ? (
            <div className="xl:col-span-7 bg-white rounded-[30px] border border-gray-100 shadow-sm flex flex-col"
              style={{ maxHeight:"calc(100vh - 380px)", minHeight:"380px" }}>

              {/* header */}
              <div className="p-5 pb-4 border-b border-[#F3F3F3] shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-[20px] font-bold text-[#0F172A]">{activeLead.client}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{activeLead.company}</p>
                  </div>
                  {/* Retry button */}
                  {(activeLead[countKey as keyof Lead] as number) < limit && (
                    <button onClick={() => handleRetry(activeLead)}
                      className="h-10 px-4 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-[#a30f27] transition-colors shrink-0">
                      <RefreshCw size={14}/>
                      {activeTab === "notinterested" ? "Mark Not Interested Again" : "Mark Not Picked Again"}
                    </button>
                  )}
                </div>
              </div>

              {/* body */}
              <div className="overflow-y-auto flex-1 p-5">

                {/* big try counter */}
                <div className={`rounded-2xl p-5 mb-4 ${
                  activeTab === "notinterested" ? "bg-[#FFF1F3]" : "bg-[#FFF7E6]"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-sm font-bold ${activeTab==="notinterested" ? "text-[#B8112D]" : "text-[#B54708]"}`}>
                      {activeTab === "notinterested" ? "Not Interested" : "Not Picked"} Attempts
                    </p>
                    <span className={`text-2xl font-black ${activeTab==="notinterested" ? "text-[#B8112D]" : "text-[#B54708]"}`}>
                      {activeLead[countKey as keyof Lead] as number} / {limit}
                    </span>
                  </div>
                  <TriesBar
                    used={activeLead[countKey as keyof Lead] as number}
                    limit={limit}
                    color={activeTab === "notinterested" ? "bg-[#B8112D]" : "bg-amber-500"}
                  />
                  {(activeLead[countKey as keyof Lead] as number) >= limit ? (
                    <p className="text-[12px] text-gray-500 mt-2 flex items-center gap-1.5">
                      <ArrowRightLeft size={12}/>Lead has been redistributed to another CSR.
                    </p>
                  ) : (
                    <p className="text-[12px] text-gray-500 mt-2">
                      {limit - (activeLead[countKey as keyof Lead] as number)} more attempt{limit - (activeLead[countKey as keyof Lead] as number) !== 1 ? "s" : ""} before auto-redistribution.
                    </p>
                  )}
                </div>

                {/* info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:"Phone",   value: activeLead.phone,                Icon: Phone    },
                    { label:"Service", value: activeLead.interestedService||"N/A", Icon: Briefcase },
                    { label:"Status",  value: activeLead.status,               Icon: Clock3   },
                    { label:"Tries",   value: `${activeLead[countKey as keyof Lead]} / ${limit}`, Icon: Users },
                  ].map(({ label, value, Icon }) => (
                    <div key={label} className="bg-[#FAFAFA] rounded-2xl p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                          <Icon size={14}/>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[11px]">{label}</p>
                          <h4 className="font-semibold text-[#0F172A] text-[13px] mt-0.5">{value as string}</h4>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {activeLead.comments && (
                  <div className="mt-4 bg-[#FAFAFA] rounded-2xl p-4">
                    <p className="text-gray-400 text-[11px] mb-1.5">Comments</p>
                    <p className="text-[#0F172A] text-[13px] leading-relaxed">{activeLead.comments}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="xl:col-span-7 bg-white rounded-[30px] border border-gray-100 shadow-sm flex items-center justify-center" style={{ minHeight:"380px" }}>
              <div className="text-center">
                <ThumbsDown size={36} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-gray-400 text-sm">Select a lead to view details</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}