"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

type PersonAmount = { name: string; amount: number };
type Box = { total: number; people: PersonAmount[] };
type Report = {
  date: string;
  month: string;
  through: string;
  day: Box;
  monthToDate: Box;
};

function pktToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function money(amount: number) {
  return `Rs ${Math.round(amount).toLocaleString("en-PK")}`;
}

export default function DailyLateCard() {
  const pathname = usePathname();
  const ceo = pathname.startsWith("/admin");
  const [date, setDate] = useState(pktToday);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const res = await API.get("/attendance/late-daily", { params: { date: day } });
      setReport(res.data as Report);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load daily deductions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ceo) return;
    void load(date);
  }, [ceo, date, load]);

  if (!ceo) return null;

  return (
    <section className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-bold text-[#0F172A] dark:text-white text-base sm:text-lg">Late deduction</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
            A day with no check-in and no check-out takes that day’s set pay. A saved check-in or check-out uses the time ranges.
            The month box is the total so far.
          </p>
        </div>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Date
          <input
            type="date"
            value={date}
            max={pktToday()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
          />
        </label>
      </div>

      {loading && !report ? (
        <p className="mt-4 text-sm text-gray-400 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading deductions…
        </p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <DeductionBox
            title="This day"
            hint={report?.date || date}
            box={report?.day}
          />
          <DeductionBox
            title="This month so far"
            hint={report ? `${report.month} through ${report.through}` : ""}
            box={report?.monthToDate}
          />
        </div>
      )}
    </section>
  );
}

function DeductionBox({ title, hint, box }: { title: string; hint: string; box?: Box }) {
  const people = box?.people ?? [];
  return (
    <div className="rounded-xl border border-gray-100 dark:border-crm-border p-3 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0F172A] dark:text-white">{title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
        <p className="text-sm font-bold text-[#B8112D] tabular-nums">{money(box?.total || 0)}</p>
      </div>
      {people.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">No deduction for this period.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
          {people.map((person) => (
            <li key={person.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-[#0F172A] dark:text-white">{person.name}</span>
              <span className="shrink-0 tabular-nums font-semibold text-[#0F172A] dark:text-white">{money(person.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
