"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

type PersonCut = { name: string; department: string; perDay?: number; day: number; month: number; range?: number };

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
type Report = { date: string; month: string; through: string; rangeFrom?: string; rangeTo?: string; people: PersonCut[] };

function personId(person: PersonCut) {
  return `${person.department}::${person.name}`;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string; hint?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shown = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const summary = selected.length === 0 ? label : `${label} · ${selected.length}`;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`h-10 min-w-[10rem] rounded-2xl border px-3 text-left text-xs font-semibold ${
          selected.length
            ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
            : "border-gray-200 bg-white text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white"
        }`}
      >
        {summary}
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-72 rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_12px_40px_rgba(15,23,42,0.12)] dark:border-crm-border dark:bg-crm-surface">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="h-10 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-[#0B1220] dark:text-white"
          />
          <div className="mt-2 flex items-center justify-between px-1">
            <button type="button" onClick={() => onChange(options.map((option) => option.id))} className="text-[11px] font-semibold text-[#B8112D]">
              Select all
            </button>
            <button type="button" onClick={() => onChange([])} className="text-[11px] font-semibold text-gray-500">
              Clear
            </button>
          </div>
          <div className="mt-1 max-h-56 overflow-auto">
            {shown.length === 0 ? (
              <p className="px-2 py-3 text-xs text-gray-400">No matches.</p>
            ) : shown.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#F8FAFC] dark:hover:bg-white/5">
                <input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-[#0F172A] dark:text-white">{option.label}</span>
                  {option.hint ? <span className="block text-[11px] text-gray-400">{option.hint}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const ceo = pathname.startsWith("/admin") || pathname.startsWith("/manager");
  const today = pktToday();
  const [date, setDate] = useState(today);
  const [rangeFrom, setRangeFrom] = useState(`${today.slice(0, 7)}-01`);
  const [rangeTo, setRangeTo] = useState(today);
  const [pickedPeople, setPickedPeople] = useState<string[]>([]);
  const [pickedDepartments, setPickedDepartments] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [leaveName, setLeaveName] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveBusy, setLeaveBusy] = useState("");

  const load = useCallback(async (day: string, from: string, to: string) => {
    setLoading(true);
    try {
      const res = await API.get("/attendance/late-daily", { params: { date: day, from, to } });
      setReport({
        date: res.data.date,
        month: res.data.month,
        through: res.data.through,
        rangeFrom: res.data.rangeFrom,
        rangeTo: res.data.rangeTo,
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
    void load(date, rangeFrom, rangeTo);
  }, [ceo, date, rangeFrom, rangeTo, load]);

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
      await load(date, rangeFrom, rangeTo);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update paid leave."));
    } finally {
      setLeaveBusy("");
    }
  }

  if (!ceo) return null;

  const dayLabel = date === today ? "Current date" : date;
  const people = withAttendanceRoster(report?.people ?? []);
  const employeeOptions = people.map((person) => ({ id: personId(person), label: person.name, hint: person.department }));
  const departmentOptions = [...new Set(people.map((person) => person.department))].sort().map((department) => ({ id: department, label: department }));
  const visible = useMemo(
    () => people.filter((person) => {
      const personOk = pickedPeople.length === 0 || pickedPeople.includes(personId(person));
      const departmentOk = pickedDepartments.length === 0 || pickedDepartments.includes(person.department);
      return personOk && departmentOk;
    }),
    [people, pickedPeople, pickedDepartments],
  );
  const rangeLabel = report?.rangeFrom && report?.rangeTo ? `${report.rangeFrom} – ${report.rangeTo}` : "Pick dates";
  const filtersOn = pickedPeople.length > 0 || pickedDepartments.length > 0;

  return (
    <section className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#B8112D]/80">Deductions</p>
          <h2 className="mt-1 font-bold text-[#0F172A] dark:text-white text-base sm:text-lg tracking-tight">Late time deduction</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Per day is the checked salary parts divided by 30. A late check-in multiplies that day by the number you set, so 0.2 on Rs 1,500 is Rs 300. Saturday, Sunday, and approved paid leave are not deducted. The date range column totals only those days. Employee and department filters apply together. Send to accounts copies the month total into each person’s late deduction cell.
            {report ? ` Month total runs through ${report.through}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => setLeaveOpen((open) => !open)}
            className="h-10 rounded-2xl border border-gray-200 bg-white px-4 text-xs font-semibold text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white"
          >
            Paid leave
          </button>
          <button
            type="button"
            disabled={sending || !report}
            onClick={() => void sendToAccounts()}
            className="h-10 rounded-2xl bg-[#B8112D] px-4 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send to accounts"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <MultiSelect label="Employees" options={employeeOptions} selected={pickedPeople} onChange={setPickedPeople} />
        <MultiSelect label="Department" options={departmentOptions} selected={pickedDepartments} onChange={setPickedDepartments} />
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Specific date
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-[#0B1220] dark:text-white"
          />
        </label>
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Range from
          <input
            type="date"
            value={rangeFrom}
            max={rangeTo || today}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="mt-1 block h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-[#0B1220] dark:text-white"
          />
        </label>
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Range to
          <input
            type="date"
            value={rangeTo}
            min={rangeFrom}
            max={today}
            onChange={(e) => setRangeTo(e.target.value)}
            className="mt-1 block h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-[#0B1220] dark:text-white"
          />
        </label>
        {filtersOn ? (
          <button
            type="button"
            onClick={() => {
              setPickedPeople([]);
              setPickedDepartments([]);
            }}
            className="h-10 rounded-2xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-600 dark:border-crm-border dark:bg-transparent dark:text-gray-300"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {pickedPeople.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {people.filter((person) => pickedPeople.includes(personId(person))).map((person) => (
            <button
              key={personId(person)}
              type="button"
              onClick={() => setPickedPeople((current) => current.filter((id) => id !== personId(person)))}
              className="rounded-full bg-[#FFF1F3] px-2.5 py-1 text-[11px] font-semibold text-[#B8112D]"
            >
              {person.name} ×
            </button>
          ))}
        </div>
      ) : null}

      {leaveOpen ? (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-[#F8FAFC] p-4 dark:border-crm-border dark:bg-[#0B1220]">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Add each paid leave on its own. One month can hold several. Approve a range and those days are not deducted.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-gray-500 dark:text-gray-400">
              Employee
              <select
                value={leaveName}
                onChange={(e) => setLeaveName(e.target.value)}
                className="mt-1 block h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-transparent dark:text-white"
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
                className="mt-1 block h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-transparent dark:text-white"
              />
            </label>
            <label className="text-[11px] text-gray-500 dark:text-gray-400">
              To
              <input
                type="date"
                value={leaveTo}
                onChange={(e) => setLeaveTo(e.target.value)}
                className="mt-1 block h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-transparent dark:text-white"
              />
            </label>
            <button
              type="button"
              disabled={leaveBusy === "add"}
              onClick={() => void addLeave()}
              className="h-10 rounded-2xl bg-[#B8112D] px-4 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {leaveBusy === "add" ? "Saving…" : "Add leave"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {leaves.length === 0 ? (
              <p className="text-xs text-gray-400">No paid leave in this month yet.</p>
            ) : leaves.map((leave) => (
              <div key={leave.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2 dark:border-crm-border dark:bg-crm-surface">
                <div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-white">{leave.personName}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{leave.fromDay} to {leave.toDay} · {leave.status}</p>
                </div>
                {leave.status === "pending" ? (
                  <button
                    type="button"
                    disabled={leaveBusy === leave.id}
                    onClick={() => void reviewLeave(leave.id, "approved")}
                    className="h-9 rounded-2xl bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
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
        <div className="mt-4 overflow-hidden rounded-2xl sm:rounded-[28px] border border-slate-200/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-crm-border">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead className="bg-[#B8112D]">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/90">Employee</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/90">Per day</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/90">{dayLabel}</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/90">
                  <span className="block">Date range</span>
                  <span className="mt-0.5 block font-medium normal-case tracking-normal text-white/70">{rangeLabel}</span>
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/90">So far this month</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No employees match these filters.</td>
                </tr>
              ) : null}
              {visible.map((person) => (
                <tr
                  key={`${person.department}:${person.name}`}
                  className="border-b border-slate-100/90 last:border-0 even:bg-slate-50/50 hover:bg-[#F8FBFF] hover:shadow-[inset_3px_0_0_#B8112D] transition-colors dark:border-white/5 dark:even:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-right tabular-nums text-[#0F172A] dark:text-white">{money(person.perDay ?? 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex min-w-[4.5rem] justify-end tabular-nums font-semibold ${person.day > 0 ? "text-[#B8112D]" : "text-slate-400"}`}>
                      {money(person.day)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex min-w-[4.5rem] justify-end tabular-nums font-semibold ${(person.range ?? 0) > 0 ? "text-[#B8112D]" : "text-slate-400"}`}>
                      {money(person.range ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#0F172A] dark:text-white">{money(person.month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </section>
  );
}
