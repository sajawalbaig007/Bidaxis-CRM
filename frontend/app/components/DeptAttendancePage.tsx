"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

type Row = {
  personKey: string;
  personName: string;
  day: string;
  checkIn: string | null;
  checkOut: string | null;
};

type Person = { key: string; name: string };

export default function DeptAttendancePage({
  department,
  title,
  personKey,
  personName,
}: {
  department: "dev" | "office_boy" | "hr";
  title: string;
  personKey?: string;
  personName?: string;
}) {
  const [day, setDay] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [blocked, setBlocked] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (nextDay?: string) => {
    setLoading(true);
    try {
      const res = await API.get("/attendance/day", {
        params: { department, day: nextDay || undefined },
      });
      setDay(res.data.day);
      setPeople(res.data.people ?? []);
      setRows(res.data.rows ?? []);
      setBlocked("");
      setSelected((cur) => personKey || cur || res.data.people?.[0]?.key || "");
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      if (code?.code === "IP_NOT_ALLOWED") {
        setBlocked(code.message || "This page is only available from the company network.");
      } else {
        toast.error(apiErrorMessage(err, "Could not load attendance."));
      }
    } finally {
      setLoading(false);
    }
  }, [department, personKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.personKey === selected),
    [rows, selected],
  );

  useEffect(() => {
    setCheckIn(selectedRow?.checkIn ?? "");
    setCheckOut(selectedRow?.checkOut ?? "");
  }, [selectedRow?.personKey, selectedRow?.checkIn, selectedRow?.checkOut]);

  const punch = async (action: "in" | "out") => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await API.post("/attendance/punch", { department, personKey: selected, action });
      toast.success(res.data.message || "Saved.");
      await load(day);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setBusy(false);
    }
  };

  const saveTimes = async () => {
    if (!selected || !day) return;
    setBusy(true);
    try {
      const res = await API.post("/attendance/times", {
        department,
        personKey: selected,
        day,
        checkIn,
        checkOut,
      });
      toast.success(res.data.message || "Saved.");
      await load(day);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF1F7] text-[#0F172A]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#B8112D]">Attendance</p>
          <h1 className="text-2xl font-bold mt-1">{personName || title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {personName ? `${title} · check in and check out. Pakistan time.` : "Check in, check out, and the daily report. Times are Pakistan time."}
          </p>
        </header>

        {blocked ? (
          <div className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-700">{blocked}</div>
        ) : (
          <>
            <section className="rounded-2xl bg-white border border-gray-100 p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3">
                {personKey ? (
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500">Person</p>
                    <p className="mt-1 h-11 flex items-center text-sm font-bold">{personName}</p>
                  </div>
                ) : (
                <label className="flex-1 text-xs font-semibold text-gray-500">
                  Person
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#0F172A]"
                  >
                    {people.map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </select>
                </label>
                )}
                <label className="text-xs font-semibold text-gray-500">
                  Date
                  <input
                    type="date"
                    value={day}
                    onChange={(e) => {
                      setDay(e.target.value);
                      void load(e.target.value);
                    }}
                    className="mt-1 h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !selected}
                  onClick={() => void punch("in")}
                  className="h-11 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  <LogIn size={16} /> Check in
                </button>
                <button
                  type="button"
                  disabled={busy || !selected}
                  onClick={() => void punch("out")}
                  className="h-11 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  <LogOut size={16} /> Check out
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <label className="text-xs font-semibold text-gray-500">
                  Check-in time
                  <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm" />
                </label>
                <label className="text-xs font-semibold text-gray-500">
                  Check-out time
                  <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm" />
                </label>
                <button
                  type="button"
                  disabled={busy || !checkIn}
                  onClick={() => void saveTimes()}
                  className="h-11 rounded-xl border border-gray-200 text-sm font-semibold hover:border-[#B8112D] hover:text-[#B8112D] disabled:opacity-60"
                >
                  Save daily time
                </button>
              </div>
            </section>

            <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-bold text-sm">Daily report · {day || "today"}</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-2 font-semibold">Name</th>
                    <th className="px-4 py-2 font-semibold">Check in</th>
                    <th className="px-4 py-2 font-semibold">Check out</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-gray-400">Loading…</td></tr>
                  ) : people.map((p) => {
                    const row = rows.find((r) => r.personKey === p.key);
                    return (
                      <tr key={p.key} className="border-t border-gray-50">
                        <td className="px-4 py-3 font-semibold">{p.name}</td>
                        <td className="px-4 py-3 tabular-nums">{row?.checkIn || "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{row?.checkOut || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
