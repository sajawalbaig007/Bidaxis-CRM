"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

type PersonCut = { name: string; department: string; perDay?: number; day: number; month: number };

const ATTENDANCE_ROWS: PersonCut[] = [
  { name: "Ahmer Shah", department: "Dev", perDay: 0, day: 0, month: 0 },
  { name: "Sajawal", department: "Dev", perDay: 0, day: 0, month: 0 },
  { name: "Khalil", department: "Administration", perDay: 0, day: 0, month: 0 },
  { name: "Ismail", department: "Administration", perDay: 0, day: 0, month: 0 },
  { name: "Mahnoor Imran", department: "Administration", perDay: 0, day: 0, month: 0 },
  { name: "Ahmad Nadeem", department: "BIM Modeler", perDay: 0, day: 0, month: 0 },
];

function nameTokens(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token !== "mr" && token !== "mrs" && token !== "ms");
}

function samePerson(a: string, b: string) {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (!left.length || !right.length) return false;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return short.every((token, index) => long[index] === token);
}

function withAttendanceRoster(people: PersonCut[]) {
  const next = [...people];
  for (const person of ATTENDANCE_ROWS) {
    if (next.some((row) => samePerson(row.name, person.name))) continue;
    next.push(person);
  }
  return next.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
}
type Report = { date: string; month: string; through: string; people: PersonCut[] };

type LeaveRow = {
  id: string;
  personName: string;
  fromDay: string;
  toDay: string;
  status: string;
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

function initials(name: string) {
  const parts = name.replace(/^(mr|mrs|ms)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}

export default function DailyLateCard() {
  const pathname = usePathname();
  const ceo = pathname.startsWith("/admin");
  const today = pktToday();
  const [date, setDate] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [leaveName, setLeaveName] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveBusy, setLeaveBusy] = useState("");

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const res = await API.get("/attendance/late-daily", { params: { date: day } });
      setReport({
        date: res.data.date,
        month: res.data.month,
        through: res.data.through,
        people: res.data.people ?? [],
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load daily deductions."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaves = useCallback(async (month: string) => {
    try {
      const res = await API.get("/attendance/paid-leave", { params: { month } });
      setLeaves(res.data.leaves ?? []);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load paid leave."));
    }
  }, []);

  useEffect(() => {
    if (!ceo) return;
    void load(date);
  }, [ceo, date, load]);

  useEffect(() => {
    if (!ceo || !leaveOpen || !report?.month) return;
    void loadLeaves(report.month);
  }, [ceo, leaveOpen, report?.month, loadLeaves]);

  async function sendToAccounts() {
    if (!report?.month || sending) return;
    setSending(true);
    try {
      const res = await API.post("/attendance/late-to-accounts", { month: report.month });
      toast.success(res.data.message || "Sent to accounts.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send deductions to accounts."));
    } finally {
      setSending(false);
    }
  }

  async function addLeave() {
    if (!leaveName || !leaveFrom || !leaveTo) {
      toast.error("Pick a name and both dates.");
      return;
    }
    setLeaveBusy("add");
    try {
      await API.post("/attendance/paid-leave", { personName: leaveName, fromDay: leaveFrom, toDay: leaveTo });
      setLeaveFrom("");
      setLeaveTo("");
      if (report?.month) await loadLeaves(report.month);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save paid leave."));
    } finally {
      setLeaveBusy("");
    }
  }

  async function reviewLeave(id: string, status: "approved" | "declined") {
    setLeaveBusy(id);
    try {
      await API.post(`/attendance/paid-leave/${id}/review`, { status });
      if (report?.month) await loadLeaves(report.month);
      await load(date);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update paid leave."));
    } finally {
      setLeaveBusy("");
    }
  }

  if (!ceo) return null;

  const dayLabel = date === today ? "Current date" : date;
  const people = withAttendanceRoster(report?.people ?? []);

  return (
    <section className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-bold text-[#0F172A] dark:text-white text-base sm:text-lg">Late time deduction</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Per day is the checked salary parts divided by 30. A late check-in multiplies that day by the number you set, so 0.2 on Rs 1,500 is Rs 300. Saturday, Sunday, and approved paid leave are not deducted. Send to accounts copies the month total into each person’s late deduction cell.
            {report ? ` Month total runs through ${report.through}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => setLeaveOpen((open) => !open)}
            className="rounded-lg border border-gray-200 dark:border-crm-border px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:text-white"
          >
            Paid leave
          </button>
          <button
            type="button"
            disabled={sending || !report}
            onClick={() => void sendToAccounts()}
            className="rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send to accounts"}
          </button>
          <label className="text-xs text-gray-500 dark:text-gray-400">
          Specific date
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
          />
          </label>
        </div>
      </div>

      {leaveOpen ? (
        <div className="mt-4 rounded-2xl border border-gray-100 dark:border-crm-border p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Add each paid leave on its own. One month can hold several. Approve a range and those days are not deducted.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-gray-500 dark:text-gray-400">
              Employee
              <select
                value={leaveName}
                onChange={(e) => setLeaveName(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
              >
                <option value="">Select</option>
                {people.map((person) => (
                  <option key={`${person.department}:${person.name}`} value={person.name}>{person.name}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-gray-500 dark:text-gray-400">
              From
              <input
                type="date"
                value={leaveFrom}
                onChange={(e) => setLeaveFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
              />
            </label>
            <label className="text-[11px] text-gray-500 dark:text-gray-400">
              To
              <input
                type="date"
                value={leaveTo}
                onChange={(e) => setLeaveTo(e.target.value)}
                className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
              />
            </label>
            <button
              type="button"
              disabled={leaveBusy === "add"}
              onClick={() => void addLeave()}
              className="rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {leaveBusy === "add" ? "Saving…" : "Add leave"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {leaves.length === 0 ? (
              <p className="text-xs text-gray-400">No paid leave in this month yet.</p>
            ) : leaves.map((leave) => (
              <div key={leave.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-crm-border px-2 py-2">
                <div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-white">{leave.personName}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{leave.fromDay} to {leave.toDay} · {leave.status}</p>
                </div>
                {leave.status === "pending" ? (
                  <button
                    type="button"
                    disabled={leaveBusy === leave.id}
                    onClick={() => void reviewLeave(leave.id, "approved")}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {leaveBusy === leave.id ? "Saving…" : "Approve"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {loading && people.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading deductions…
        </p>
      ) : people.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No employees for this month.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100 dark:border-crm-border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] dark:bg-[#0B1220] text-left text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-3 py-3 font-semibold">Employee</th>
                <th className="px-3 py-3 font-semibold text-right">Per day</th>
                <th className="px-3 py-3 font-semibold text-right">{dayLabel}</th>
                <th className="px-3 py-3 font-semibold text-right">So far this month</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={`${person.department}:${person.name}`} className="border-t border-gray-100 dark:border-crm-border">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF1F3] text-[11px] font-bold text-[#B8112D]">
                        {initials(person.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#0F172A] dark:text-white truncate">{person.name}</p>
                        <p className="text-[11px] text-gray-400">{person.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#0F172A] dark:text-white">{money(person.perDay ?? 0)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#B8112D]">{money(person.day)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#0F172A] dark:text-white">{money(person.month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
