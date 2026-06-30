"use client";

import { useEffect, useState } from "react";
import { X, Briefcase, DollarSign, History, Loader2 } from "lucide-react";
import API from "@/lib/api";

type ProjectRow = {
  id: string;
  title: string;
  clientCode?: string | null;
  service?: string | null;
  status?: string | null;
  paidAmount: number;
  deadline?: string | null;
  closedAt?: string;
};

type HistoryData = {
  client?: { name: string; company: string; email: string };
  services?: string[];
  totalBusiness?: number;
  projects?: ProjectRow[];
  history?: { id: string; name?: string; company?: string; status?: string; service?: string; paidAmount?: number; updatedAt?: string }[];
};

interface ClientHistoryModalProps {
  phone: string;
  clientName?: string;
  onClose: () => void;
  lookupPath?: string;
}

export default function ClientHistoryModal({
  phone,
  clientName,
  onClose,
  lookupPath = "/csr/lookup-by-phone",
}: ClientHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState<HistoryData | null>(null);
  const [error, setError]     = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await API.get(lookupPath, { params: { phone } });
        if (!cancelled) {
          if (res.data?.found) setData(res.data);
          else setError("No history found for this client.");
        }
      } catch {
        if (!cancelled) setError("Failed to load client history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [phone, lookupPath]);

  const title = clientName || data?.client?.name || "Client History";
  const services = data?.services ?? [];
  const projects = data?.projects ?? [];
  const totalBusiness = data?.totalBusiness ?? 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[120] p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Services, projects & business history</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Loader2 size={28} className="animate-spin mb-3" />
              <p className="text-sm">Loading history…</p>
            </div>
          ) : error ? (
            <p className="text-sm text-gray-500 text-center py-8">{error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFF1F3] rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-[#B8112D] mb-1">
                    <DollarSign size={14} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide">Total Business</span>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">${totalBusiness.toLocaleString()}</p>
                </div>
                <div className="bg-[#EFF6FF] rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-[#0B84F3] mb-1">
                    <Briefcase size={14} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide">Projects</span>
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A]">{projects.length}</p>
                </div>
              </div>

              {services.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Services Used</h3>
                  <div className="flex flex-wrap gap-2">
                    {services.map(s => (
                      <span key={s} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#F8F9FC] text-gray-700 border border-gray-100">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {projects.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <History size={12} /> Project History
                  </h3>
                  <div className="space-y-2">
                    {projects.map(p => (
                      <div key={p.id} className="bg-[#FAFAFA] rounded-2xl p-3 border border-gray-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#0F172A] truncate">{p.title}</p>
                            {p.clientCode && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{p.clientCode}</p>}
                            {p.service && <p className="text-[11px] text-gray-500 mt-1">{p.service}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-green-600">${p.paidAmount.toLocaleString()}</p>
                            {p.status && <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{p.status}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
