"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

function pktToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Person = { personKey: string; personName: string };
type Dept = { department: string; label: string; employees: Person[] };

export default function CeoPastDayCard() {
  const pathname = usePathname();
  const ceo = pathname.startsWith("/admin");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [department, setDepartment] = useState("");
  const [personKey, setPersonKey] = useState("");
  const [day, setDay] = useState(pktToday);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const month = pktToday().slice(0, 7);
      const res = await API.get("/attendance/shift-schedules", { params: { month } });
      const rows = (res.data.departments ?? []) as Dept[];
      setDepartments(rows);
      setDepartment((current) => current || rows[0]?.department || "");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load employees."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ceo) return;
    void load();
  }, [ceo, load]);

  if (!ceo) return null;

  const people = departments.find((dept) => dept.department === department)?.employees ?? [];
  const person = people.find((row) => row.personKey === personKey) ?? people[0];

  async function save() {
    if (!department || !person) {
      toast.error("Choose an employee.");
      return;
    }
    if (!day || !checkIn) {
      toast.error("Pick a date and a check-in time.");
      return;
    }
    setSaving(true);
    try {
      await API.post("/attendance/ceo-day", {
        department,
        personKey: person.personKey,
        personName: person.personName,
        day,
        checkIn,
        checkOut,
      });
      toast.success("Time saved.");
      setCheckIn("");
      setCheckOut("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5">
      <h2 className="font-bold text-[#0F172A] dark:text-white text-base sm:text-lg tracking-tight">
        Check in or edit a past day
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
        Pick any employee and a date from the calendar. Saving writes that day’s check-in and check-out. Leave check-out empty if they are still checked in. Times are Pakistan time.
      </p>
      {loading && departments.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading employees…
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-gray-500 dark:text-gray-400">
            Department
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPersonKey("");
              }}
              className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
            >
              {departments.map((dept) => (
                <option key={dept.department} value={dept.department}>{dept.label}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-gray-500 dark:text-gray-400">
            Employee
            <select
              value={person?.personKey ?? ""}
              onChange={(e) => setPersonKey(e.target.value)}
              className="mt-1 block min-w-[10rem] rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
            >
              {people.length === 0 ? <option value="">No employees</option> : null}
              {people.map((row) => (
                <option key={row.personKey} value={row.personKey}>{row.personName}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-gray-500 dark:text-gray-400">
            Date
            <input
              type="date"
              max={pktToday()}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
            />
          </label>
          <label className="text-[11px] text-gray-500 dark:text-gray-400">
            Check in
            <input
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
            />
          </label>
          <label className="text-[11px] text-gray-500 dark:text-gray-400">
            Check out
            <input
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save day"}
          </button>
        </div>
      )}
    </div>
  );
}
