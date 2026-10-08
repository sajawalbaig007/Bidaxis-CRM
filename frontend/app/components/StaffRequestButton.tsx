"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ClipboardList, X } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage, officeProxy } from "@/lib/api";

export type StaffRequestItem = {
  id: string;
  personKey: string;
  personName: string;
  department: string;
  kind: string;
  kindLabel: string;
  day: string;
  summary: string;
  detail: string;
  status: string;
  reviewedBy: string | null;
  reviewNote?: string;
  checkIn?: string | null;
  checkOut?: string | null;
};

const KINDS = [
  { key: "attendance_correction", label: "Attendance Correction" },
  { key: "leave", label: "Leave Request" },
  { key: "reimbursement", label: "Reimbursement" },
  { key: "wfh", label: "Work From Home" },
  { key: "asset", label: "Asset Issue" },
  { key: "custom", label: "Custom Request" },
] as const;

type Kind = (typeof KINDS)[number]["key"];
type DayMode = "pkt" | "evening" | "est";

function ymd(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDay(mode: DayMode): string {
  if (mode === "est") return ymd("America/New_York");
  const day = ymd("Asia/Karachi");
  if (mode !== "evening") return day;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  if (time >= "17:00") return day;
  const [y, m, d] = day.split("-").map(Number);
  const prev = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 text-sm text-[#0B1220] outline-none focus:border-[#B8112D]";

export default function StaffRequestButton({
  compact = false,
  large = false,
  mode = "pkt",
  department,
  personKey,
  personName,
  publicPunch = false,
  dashboard,
  office = false,
}: {
  compact?: boolean;
  large?: boolean;
  mode?: DayMode;
  department?: string;
  personKey?: string;
  personName?: string;
  publicPunch?: boolean;
  dashboard?: "chief";
  office?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | "">("");
  const [day, setDay] = useState(() => shiftDay(mode));
  const [endDay, setEndDay] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<{ label: string; requests: StaffRequestItem[] }[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const label = useMemo(() => KINDS.find((item) => item.key === kind)?.label ?? "", [kind]);

  const reset = () => {
    setKind("");
    setDay(shiftDay(mode));
    setEndDay("");
    setCheckIn("");
    setCheckOut("");
    setAmount("");
    setTitle("");
    setDetail("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const missing = (): string => {
    if (!day) return "Choose a date.";
    if (kind === "attendance_correction") {
      if (!checkIn) return "Enter a check-in time.";
      if (!checkOut) return "Enter a check-out time.";
      if (!detail.trim()) return "Add a note.";
    }
    if (kind === "leave" || kind === "wfh") {
      if (!endDay) return "Enter an end date.";
      if (endDay < day) return "End date cannot be before the start date.";
      if (!detail.trim()) return "Add a short reason.";
    }
    if (kind === "reimbursement") {
      if (!amount.trim()) return "Enter an amount.";
      if (!detail.trim()) return "Add the details.";
    }
    if (kind === "asset" || kind === "custom") {
      if (!title.trim()) return kind === "asset" ? "Enter the item." : "Enter a title.";
      if (!detail.trim()) return "Add the details.";
    }
    return "";
  };

  const submit = async () => {
    const problem = missing();
    if (!kind || problem) {
      if (problem) toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await API.post(publicPunch ? "/attendance/requests/public" : "/attendance/requests", {
        kind,
        day,
        endDay: endDay || undefined,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        amount: amount || undefined,
        title: title || undefined,
        detail,
        ...(publicPunch ? { department, personKey, personName } : {}),
        ...(dashboard ? { dashboard } : {}),
      }, office ? officeProxy : undefined);
      toast.success("Request sent.");
      close();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send the request."));
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryBusy(true);
    try {
      const res = publicPunch
        ? await API.get("/attendance/requests/history", { params: { department, personKey }, ...(office ? officeProxy : {}) })
        : await API.get("/attendance/requests/mine", office ? officeProxy : undefined);
      setHistory([
        { label: res.data.current?.label || "This month", requests: res.data.current?.requests ?? [] },
        { label: res.data.previous?.label || "Previous month", requests: res.data.previous?.requests ?? [] },
      ]);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load request history."));
      setHistoryOpen(false);
    } finally {
      setHistoryBusy(false);
    }
  };

  const height = large ? "h-14 text-base" : compact ? "h-9 text-xs" : "h-10 text-sm";

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => { reset(); setOpen(true); }}
          className={`${height} px-3 rounded-xl bg-[#EEF2FF] text-[#3730A3] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#E0E7FF] touch-manipulation`}
        >
          <ClipboardList size={large ? 18 : 14} />
          Request
        </button>
        <button
          type="button"
          onClick={() => void openHistory()}
          className={`${height} px-3 rounded-xl bg-white border border-[#C7D2FE] text-[#3730A3] font-semibold inline-flex items-center justify-center hover:bg-[#EEF2FF] touch-manipulation`}
        >
          History
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-[140] bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#111827]">Create a request</h3>
                <p className="text-xs text-gray-400 mt-0.5">{label || "Choose a type"}</p>
              </div>
              <button type="button" onClick={close} className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!kind ? (
                <div className="grid grid-cols-2 gap-3">
                  {KINDS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setKind(item.key)}
                      className="rounded-2xl border border-gray-100 bg-[#F8FAFC] px-3 py-4 text-left text-sm font-semibold text-[#111827] hover:border-[#B8112D]/40 hover:bg-[#FFF1F3]"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <Field label="Date *">
                    <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} />
                  </Field>
                  {kind === "attendance_correction" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Check in *">
                        <input type="time" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Check out *">
                        <input type="time" required value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} />
                      </Field>
                    </div>
                  ) : null}
                  {kind === "leave" || kind === "wfh" ? (
                    <Field label="End date *">
                      <input type="date" required min={day} value={endDay} onChange={(e) => setEndDay(e.target.value)} className={inputClass} />
                    </Field>
                  ) : null}
                  {kind === "reimbursement" ? (
                    <Field label="Amount *">
                      <input required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1500" className={inputClass} />
                    </Field>
                  ) : null}
                  {kind === "asset" || kind === "custom" ? (
                    <Field label={kind === "asset" ? "Item *" : "Title *"}>
                      <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                    </Field>
                  ) : null}
                  <Field label={kind === "attendance_correction" ? "Note *" : kind === "leave" || kind === "wfh" ? "Reason *" : "Details *"}>
                    <textarea required value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className={`${inputClass} h-auto py-2`} />
                  </Field>
                  <p className="text-[11px] text-gray-400">Every field is required before this request can be sent.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setKind("")} className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm">Back</button>
                    <button type="button" disabled={busy || !!missing()} onClick={() => void submit()} className="flex-1 h-11 rounded-xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-50">
                      {busy ? "Sending…" : "Send"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {historyOpen ? (
        <div className="fixed inset-0 z-[140] bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#111827]">Request history</h3>
                <p className="text-xs text-gray-400 mt-0.5">This month and the previous month</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {historyBusy ? (
                <p className="text-sm text-gray-400">Loading history…</p>
              ) : history.map((group) => (
                <section key={group.label}>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">{group.label}</h4>
                  {group.requests.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-400">No requests.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {group.requests.map((item) => (
                        <HistoryRow key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "declined") return "Rejected";
  return "Pending";
}

function HistoryRow({ item }: { item: StaffRequestItem }) {
  const tone = item.status === "approved" ? "text-green-700" : item.status === "declined" ? "text-red-600" : "text-amber-600";
  return (
    <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#111827]">{item.kindLabel}</p>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${tone}`}>{statusLabel(item.status)}</p>
      </div>
      <p className="text-xs text-gray-600 mt-0.5">{item.summary}</p>
      {item.detail ? <p className="text-[11px] text-gray-400 mt-0.5 whitespace-pre-wrap">{item.detail}</p> : null}
      {item.reviewNote ? <p className="text-[11px] text-[#3730A3] mt-1 whitespace-pre-wrap">{item.reviewedBy || "Note"}: {item.reviewNote}</p> : null}
    </div>
  );
}

export function StaffRequestCell({
  items,
  canApprove,
  onChanged,
  onOpen,
}: {
  items: StaffRequestItem[];
  canApprove: boolean;
  onChanged: () => void;
  onOpen?: (item: StaffRequestItem) => void;
}) {
  const [busyId, setBusyId] = useState("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  if (!items.length) return <span className="text-xs text-gray-300">—</span>;

  const review = async (id: string, action: "approve" | "decline") => {
    setBusyId(id);
    try {
      const res = await API.post(`/attendance/requests/${id}/review`, { action, remarks: remarks[id] ?? "" });
      toast.success(res.data?.message || (action === "approve" ? "Approved." : "Rejected."));
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not review the request."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-2 min-w-[180px]">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl bg-[#F8FAFC] px-2.5 py-2">
          <p className="text-[11px] font-bold text-[#111827]">{item.kindLabel}</p>
          <p className="text-[11px] text-gray-600 whitespace-pre-wrap">{item.summary}</p>
          {item.detail ? <p className="text-[10px] text-gray-400 whitespace-pre-wrap">{item.detail}</p> : null}
          <p className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${
            item.status === "approved" ? "text-green-700" : item.status === "declined" ? "text-red-600" : "text-amber-600"
          }`}>
            {statusLabel(item.status)}{item.reviewedBy ? ` · ${item.reviewedBy}` : ""}
          </p>
          {item.reviewNote ? <p className="mt-1 text-[10px] text-[#3730A3] whitespace-pre-wrap">{item.reviewNote}</p> : null}
          {canApprove && item.status === "pending" && onOpen ? (
            <button type="button" onClick={() => onOpen(item)} className="mt-1.5 h-7 px-2 rounded-lg bg-[#B8112D] text-white text-[10px] font-bold">Review</button>
          ) : null}
          {canApprove && item.status === "pending" && !onOpen ? (
            <div className="mt-1.5 space-y-1.5">
              <textarea
                value={remarks[item.id] ?? ""}
                onChange={(e) => setRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))}
                rows={2}
                placeholder="Remarks"
                className="w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-[#111827] outline-none focus:border-[#B8112D]"
              />
              <div className="flex gap-1.5">
                <button type="button" disabled={busyId === item.id} onClick={() => void review(item.id, "approve")} className="h-7 px-2 rounded-lg bg-green-600 text-white text-[10px] font-bold disabled:opacity-50">Approve</button>
                <button type="button" disabled={busyId === item.id} onClick={() => void review(item.id, "decline")} className="h-7 px-2 rounded-lg bg-red-600 text-white text-[10px] font-bold disabled:opacity-50">Reject</button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
