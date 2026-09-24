"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

const TOKEN = "r7k2m9qx4p8w3n6";

type Person = { key: string; name: string };
type Row = {
  personKey: string;
  personName: string;
  department: string;
  checkIn: string | null;
  checkOut: string | null;
};

export default function ReviseAttendancePage() {
  const params = useParams<{ token: string }>();
  const token = String(params.token ?? "");
  const [day, setDay] = useState("");
  const [dev, setDev] = useState<Person[]>([]);
  const [chiefs, setChiefs] = useState<Person[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async (nextDay?: string) => {
    if (token !== TOKEN) return;
    const res = await API.get(`/attendance/revise/${token}`, { params: { day: nextDay || undefined } });
    setDay(res.data.day);
    setDev(res.data.dev ?? []);
    setChiefs(res.data.chiefs ?? []);
    setRows(res.data.rows ?? []);
  }, [token]);

  useEffect(() => {
    if (token !== TOKEN) return;
    let cancelled = false;
    API.get(`/attendance/revise/${token}`)
      .then((res) => {
        if (cancelled) return;
        setDay(res.data.day);
        setDev(res.data.dev ?? []);
        setChiefs(res.data.chiefs ?? []);
        setRows(res.data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load times.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (token !== TOKEN) {
    return (
      <div className="min-h-screen bg-[#EEF1F7] grid place-items-center text-sm text-gray-500">
        Page not found.
      </div>
    );
  }

  const save = async (department: "dev" | "chief_estimator", person: Person, checkIn: string, checkOut: string) => {
    setBusyKey(person.key);
    try {
      await API.post(`/attendance/revise/${token}`, {
        department,
        personKey: person.key,
        personName: person.name,
        day,
        checkIn,
        checkOut,
      });
      toast.success("Saved.");
      await load(day);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setBusyKey("");
    }
  };

  const groups: { title: string; department: "dev" | "chief_estimator"; people: Person[] }[] = [
    { title: "Dev", department: "dev", people: dev },
    { title: "Chief Estimator", department: "chief_estimator", people: chiefs },
  ];

  return (
    <div className="min-h-screen bg-[#EEF1F7] text-[#0F172A]">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Times</h1>
            <p className="text-sm text-gray-500">Dev and Chief Estimator. Pakistan time.</p>
          </div>
          <input
            type="date"
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              void load(e.target.value);
            }}
            className="h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white"
          />
        </header>
        {groups.map((group) => (
          <section key={group.department} className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
            <h2 className="px-4 py-3 font-bold text-sm border-b border-gray-100">{group.title}</h2>
            {group.people.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">No one in this list.</p>
            ) : group.people.map((person) => {
              const row = rows.find((r) => r.personKey === person.key && r.department === group.department);
              return (
              <PersonRow
                key={`${person.key}:${row?.checkIn ?? ""}:${row?.checkOut ?? ""}`}
                person={person}
                row={row}
                busy={busyKey === person.key}
                onSave={(checkIn, checkOut) => void save(group.department, person, checkIn, checkOut)}
              />
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  row,
  busy,
  onSave,
}: {
  person: Person;
  row?: Row;
  busy: boolean;
  onSave: (checkIn: string, checkOut: string) => void;
}) {
  const [checkIn, setCheckIn] = useState(row?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(row?.checkOut ?? "");

  return (
    <div className="px-4 py-3 border-t border-gray-50 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
      <p className="text-sm font-semibold">{person.name}</p>
      <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-2 text-sm" />
      <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-10 rounded-xl border border-gray-200 px-2 text-sm" />
      <button
        type="button"
        disabled={busy || !checkIn}
        onClick={() => onSave(checkIn, checkOut)}
        className="h-10 px-3 rounded-xl bg-[#0F172A] text-white text-sm font-semibold disabled:opacity-60"
      >
        Save
      </button>
    </div>
  );
}
