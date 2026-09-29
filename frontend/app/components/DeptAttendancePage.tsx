"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import AttendanceFrame from "@/app/components/AttendanceFrame";

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
  department: "dev" | "office_boy" | "hr" | "bim_modeler";
  title: string;
  personKey?: string;
  personName?: string;
}) {
  const [day, setDay] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [blocked, setBlocked] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get("/attendance/day", { params: { department } });
      setDay(res.data.day);
      const list = (res.data.people ?? []) as Person[];
      setPeople(personKey ? list.filter((p) => p.key === personKey) : list);
      setRows(res.data.rows ?? []);
      setBlocked("");
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
    let cancelled = false;
    API.get("/attendance/day", { params: { department } })
      .then((res) => {
        if (cancelled) return;
        setDay(res.data.day);
        const list = (res.data.people ?? []) as Person[];
        setPeople(personKey ? list.filter((p) => p.key === personKey) : list);
        setRows(res.data.rows ?? []);
        setBlocked("");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
        if (code?.code === "IP_NOT_ALLOWED") {
          setBlocked(code.message || "This page is only available from the company network.");
        } else {
          toast.error(apiErrorMessage(err, "Could not load attendance."));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [department, personKey]);

  const punch = async (key: string, action: "in" | "out") => {
    setBusyKey(`${key}:${action}`);
    try {
      const res = await API.post("/attendance/punch", { department, personKey: key, action });
      const saved = res.data.row as Row | undefined;
      if (saved?.personKey) {
        setRows((prev) => [...prev.filter((r) => r.personKey !== saved.personKey), saved]);
      }
      toast.success(res.data.message || "Saved.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setBusyKey("");
    }
  };

  const shown = personKey
    ? people.filter((p) => p.key === personKey)
    : people;
  const heading = personName || title;

  return (
    <AttendanceFrame
      title={heading}
      subtitle={`${title}${day ? ` · ${day}` : ""}. Check in when you arrive and check out when you leave.`}
    >
      {blocked ? (
        <div className="rounded-3xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">{blocked}</div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-56 rounded-3xl bg-white border border-white shadow-sm animate-pulse" />
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 ${shown.length > 1 ? "md:grid-cols-2" : "lg:max-w-2xl"}`}>
          {shown.map((person) => {
            const row = rows.find((r) => r.personKey === person.key);
            const busy = busyKey.startsWith(`${person.key}:`);
            return (
              <section
                key={person.key}
                className="rounded-3xl bg-white border border-white shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)] p-5 sm:p-7 space-y-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B8112D]">{title}</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">{person.name}</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#F4F6FB] px-3 py-1 text-[11px] font-semibold text-black">
                    Today
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#F3FBF8] px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#0F766E]">In</p>
                    <p className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">{row?.checkIn || "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#FFF5F6] px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#B8112D]">Out</p>
                    <p className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">{row?.checkOut || "—"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    disabled={busy || Boolean(row?.checkIn)}
                    onClick={() => void punch(person.key, "in")}
                    className="h-14 rounded-2xl bg-[#0F766E] text-white text-base font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:bg-[#0c645d] disabled:opacity-60 touch-manipulation"
                  >
                    <LogIn size={18} /> {row?.checkIn ? "Checked in" : "Check in"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !row?.checkIn || Boolean(row?.checkOut)}
                    onClick={() => void punch(person.key, "out")}
                    className="h-14 rounded-2xl bg-[#B8112D] text-white text-base font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:bg-[#9d0e26] disabled:opacity-60 touch-manipulation"
                  >
                    <LogOut size={18} /> {row?.checkOut ? "Checked out" : "Check out"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AttendanceFrame>
  );
}
