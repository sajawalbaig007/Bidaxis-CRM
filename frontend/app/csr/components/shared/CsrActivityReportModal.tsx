"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Activity, CalendarDays, Loader2 } from "lucide-react";
import API from "@/lib/api";
import {
  formatNotificationStatus,
  statusBadgeColor,
} from "../../constants/notificationRoutes";

type Period = "day" | "week" | "month";

type ReportData = {
  period: Period;
  date: string;
  rangeLabel: string;
  total: number;
  byStatus: Record<string, number>;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "day",   label: "Day"   },
  { key: "week",  label: "Week"  },
  { key: "month", label: "Month" },
];

export default function CsrActivityReportModal({ open, onClose }: Props) {
  const [period, setPeriod]     = useState<Period>("day");
  const [date, setDate]         = useState(() => new Date().toISOString().split("T")[0]);
  const [report, setReport]     = useState<ReportData | null>(null);
  const [loading, setLoading]   = useState(false);

  const fetchReport = useCallback(async (p: Period, d: string) => {
    setLoading(true);
    try {
      const res = await API.get("/csr/activity-report", { params: { period: p, date: d } });
      setReport(res.data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchReport(period, date);
  }, [open, period, date, fetchReport]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
              <Activity size={17} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F172A]">My Activity Report</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Your status change counts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex gap-1.5 p-1 bg-[#F3F4F6] rounded-xl">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={`flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors ${
                  period === opt.key
                    ? "bg-white text-[#B8112D] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              <CalendarDays size={12} />
              {period === "day" ? "Select date" : period === "week" ? "Week containing" : "Select month"}
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm outline-none focus:border-[#B8112D]"
            />
          </div>

          {loading ? (
            <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-[12px]">Loading report…</p>
            </div>
          ) : report ? (
            <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4">
              <p className="text-[11px] text-gray-500 font-medium">{report.rangeLabel}</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1">
                {report.total}
                <span className="text-sm font-semibold text-gray-500 ml-1.5">
                  status change{report.total !== 1 ? "s" : ""}
                </span>
              </p>
              {report.total === 0 ? (
                <p className="text-[12px] text-gray-400 mt-3">No status updates in this period.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-4">
                  {Object.entries(report.byStatus).map(([status, count]) => (
                    <div
                      key={status}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl ${statusBadgeColor(status)}`}
                    >
                      <span className="text-[11px] font-semibold">{formatNotificationStatus(status)}</span>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-[12px] text-gray-400 py-6">Could not load report.</p>
          )}
        </div>
      </div>
    </div>
  );
}
