"use client";

import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage, officeProxy } from "@/lib/api";
import AttendanceFrame from "@/app/components/AttendanceFrame";
import ShiftHistoryButton from "@/app/components/ShiftHistoryButton";
import StaffRequestButton from "@/app/components/StaffRequestButton";
import CheckoutCommentDialog from "@/app/components/CheckoutCommentDialog";

type Row = {
  personKey: string;
  personName: string;
  day: string;
  checkIn: string | null;
  checkOut: string | null;
  comment?: string | null;
};

type Person = { key: string; name: string };

const ROSTER: Record<"dev" | "office_boy" | "hr" | "bim_modeler", Person[]> = {
  dev: [
    { key: "ahmer-shah", name: "Ahmer Shah" },
    { key: "sajawal", name: "Sajawal" },
  ],
  office_boy: [
    { key: "khalil", name: "Khalil" },
    { key: "ismail", name: "Ismail" },
  ],
  hr: [{ key: "mahnoor-imran", name: "Mahnoor Imran" }],
  bim_modeler: [{ key: "ahmad-nadeem", name: "Ahmad Nadeem" }],
};

function rosterFor(
  department: keyof typeof ROSTER,
  personKey?: string,
  personName?: string,
): Person[] {
  const all = ROSTER[department] ?? [];
  if (!personKey) return all;
  const hit = all.find((person) => person.key === personKey);
  return [{ key: personKey, name: personName || hit?.name || personKey }];
}

function readDayPayload(data: unknown): { day?: string; people?: Person[]; rows?: Row[] } | null {
  let body = data;
  if (typeof body === "string") {
    const text = body.trim();
    if (!text) return null;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
  if (!body || typeof body !== "object") return null;
  return body as { day?: string; people?: Person[]; rows?: Row[] };
}

function formatClock(time: string | null | undefined): string {
  if (!time) return "—";
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

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
  const [people, setPeople] = useState<Person[]>(() => rosterFor(department, personKey, personName));
  const [rows, setRows] = useState<Row[]>([]);
  const [blocked, setBlocked] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [checkoutFor, setCheckoutFor] = useState<string | null>(null);

  const applyDay = useCallback((data: unknown) => {
    const payload = readDayPayload(data);
    if (!payload) return;
    if (payload.day) setDay(payload.day);
    if (Array.isArray(payload.rows)) setRows(payload.rows);
    if (!Array.isArray(payload.people) || payload.people.length === 0) return;
    const next = personKey ? payload.people.filter((person) => person.key === personKey) : payload.people;
    if (next.length > 0) setPeople(next);
  }, [personKey]);

  useEffect(() => {
    let cancelled = false;
    API.get("/attendance/day", { ...officeProxy, params: { department } })
      .then((res) => {
        if (cancelled) return;
        applyDay(res.data);
        setBlocked("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
        if (code?.code === "IP_NOT_ALLOWED") {
          setBlocked(code.message || "This page is only available from the company network.");
        } else {
          toast.error(apiErrorMessage(err, "Could not load attendance."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyDay, department]);

  const applyRow = (saved: Row | undefined) => {
    if (!saved?.personKey) return;
    setRows((prev) => {
      const rest = prev.filter((r) => r.personKey !== saved.personKey);
      if (saved.checkOut && saved.day !== day) return rest;
      return [...rest, saved];
    });
  };

  const punch = async (key: string, action: "in" | "out", overtimeComment?: string) => {
    setBusyKey(`${key}:${action}`);
    try {
      const res = await API.post("/attendance/punch", {
        department,
        personKey: key,
        action,
        ...(overtimeComment ? { overtimeComment } : {}),
      }, officeProxy);
      applyRow(res.data.row as Row | undefined);
      toast.success(res.data.message || "Saved.");
      setCheckoutFor(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save time."));
    } finally {
      setBusyKey("");
    }
  };

  const saveComment = async (key: string, comment: string) => {
    try {
      const res = await API.post("/attendance/note", { department, personKey: key, comment }, officeProxy);
      applyRow(res.data.row as Row | undefined);
      toast.success("Comment saved.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save comment."));
    }
  };

  const shown = personKey
    ? people.filter((p) => p.key === personKey)
    : people;
  const heading = personName || title;

  return (
    <AttendanceFrame
      title={heading}
      subtitle={`${title}${day ? ` · ${day}` : ""}. ${
        department === "hr" || department === "bim_modeler"
          ? "One day runs from 5:00 PM to the next day at 5:00 PM, Pakistan time."
          : "Check in when you arrive and check out when you leave."
      }`}
    >
      {blocked ? (
        <div className="rounded-3xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">{blocked}</div>
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
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F398A]">{title}</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight">{person.name}</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#F4F6FB] px-3 py-1 text-[11px] font-semibold text-black">
                    Today
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#F3FBF8] px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#0F766E]">In</p>
                    <p className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-[#0B1220]" style={{ color: "#0B1220" }}>{formatClock(row?.checkIn)}</p>
                  </div>
                  <div className="rounded-2xl bg-[#FFF5F6] px-4 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#0F398A]">Out</p>
                    <p className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-[#0B1220]" style={{ color: "#0B1220" }}>{formatClock(row?.checkOut)}</p>
                    {row?.checkIn && row.checkOut && row.checkOut < row.checkIn ? (
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#0F398A]">Next day</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                    onClick={() => {
                      if (department === "dev" || department === "bim_modeler") setCheckoutFor(person.key);
                      else void punch(person.key, "out");
                    }}
                    className="h-14 rounded-2xl bg-[#0F398A] text-white text-base font-semibold inline-flex items-center justify-center gap-2 shadow-sm hover:bg-[#9d0e26] disabled:opacity-60 touch-manipulation"
                  >
                    <LogOut size={18} /> {row?.checkOut ? "Checked out" : "Check out"}
                  </button>
                  <ShiftHistoryButton
                    url="/attendance/history"
                    params={{ department, personKey: person.key }}
                    large
                    office
                  />
                  <StaffRequestButton
                    large
                    office
                    publicPunch
                    department={department}
                    personKey={person.key}
                    personName={person.name}
                    mode={department === "hr" || department === "bim_modeler" ? "evening" : "pkt"}
                  />
                </div>
                <CommentBox
                  key={`${person.key}:${row?.day ?? ""}:${row?.comment ?? ""}`}
                  initial={row?.comment ?? ""}
                  onSave={(text) => saveComment(person.key, text)}
                />
              </section>
            );
          })}
        </div>
      )}
      <CheckoutCommentDialog
        open={(department === "dev" || department === "bim_modeler") && !!checkoutFor}
        busy={!!checkoutFor && busyKey.startsWith(`${checkoutFor}:`)}
        onCancel={() => setCheckoutFor(null)}
        onConfirm={(comment) => {
          if (checkoutFor) void punch(checkoutFor, "out", comment);
        }}
      />
    </AttendanceFrame>
  );
}

function CommentBox({ initial, onSave }: { initial: string; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500">
        Comment
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Optional note for the report"
          className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-[#F8FAFC] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#0B1220] outline-none focus:border-[#0F398A]/40"
          style={{ color: "#0B1220" }}
        />
      </label>
      <button
        type="button"
        disabled={busy || text.trim() === initial.trim()}
        onClick={() => {
          setBusy(true);
          void onSave(text).finally(() => setBusy(false));
        }}
        className="mt-2 h-10 px-4 rounded-xl bg-[#0F172A] text-white text-xs font-semibold disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save comment"}
      </button>
    </div>
  );
}
