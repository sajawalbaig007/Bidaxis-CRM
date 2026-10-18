"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import API, { apiErrorMessage } from "@/lib/api";
import type { StaffRequestItem } from "@/app/components/StaffRequestButton";

type RequestRow = StaffRequestItem & { createdAt?: string };

function endDayFromSummary(summary: string, fallback: string) {
  const match = summary.match(/(\d{4}-\d{2}-\d{2})\s*[–-]\s*(\d{4}-\d{2}-\d{2})/);
  return match?.[2] ?? fallback;
}

function amountFromSummary(summary: string) {
  const amount = summary.split("·")[0]?.trim() ?? "";
  return /^\d/.test(amount) ? amount : "";
}

export default function RequestDecisionDialog({
  row,
  canApprove,
  onClose,
  onChanged,
}: {
  row: RequestRow;
  canApprove: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const pending = row.status === "pending";
  const editable = canApprove;
  const attendance = row.kind === "attendance_correction";
  const leaveLike = row.kind === "leave" || row.kind === "wfh";
  const [day, setDay] = useState(row.day);
  const [checkIn, setCheckIn] = useState(row.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(row.checkOut ?? "");
  const [stillIn, setStillIn] = useState(false);
  const [fromDay, setFromDay] = useState(row.day);
  const [toDay, setToDay] = useState(endDayFromSummary(row.summary, row.day));
  const [amount, setAmount] = useState(amountFromSummary(row.summary));
  const [remarks, setRemarks] = useState(row.reviewNote ?? "");
  const [nextStatus, setNextStatus] = useState(row.status);
  const [busy, setBusy] = useState<"approve" | "decline" | "update" | "reopen" | "">("");
  const [error, setError] = useState("");

  const actionFor = (status: string): "approve" | "decline" | "reopen" | "update" => {
    if (status === row.status) return status === "pending" ? "reopen" : "update";
    if (status === "approved") return "approve";
    if (status === "declined") return "decline";
    return "reopen";
  };

  const submit = async (action: "approve" | "decline" | "update" | "reopen") => {
    setBusy(action);
    setError("");
    try {
      await API.post(`/attendance/requests/${row.id}/review`, {
        action,
        remarks,
        timesEdited: attendance,
        rangeEdited: leaveLike,
        day,
        checkIn,
        checkOut: stillIn ? "" : checkOut,
        stillIn,
        fromDay,
        toDay,
        amount,
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save this decision."));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[1.5rem] border border-gray-100/90 bg-white shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] dark:border-crm-border dark:bg-crm-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#B8112D]/80">{row.kindLabel}</p>
            <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white">{row.personName}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {attendance ? (
            <>
              <label className="block text-xs font-medium text-gray-500">
                Date
                <input type="date" value={day} onChange={(event) => setDay(event.target.value)} disabled={!editable} className="mt-1 h-10 w-full rounded-2xl border border-gray-200 outline-none focus:border-[#B8112D] px-3 text-sm text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-gray-500">
                  Check in
                  <input type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} disabled={!editable} className="mt-1 h-10 w-full rounded-2xl border border-gray-200 outline-none focus:border-[#B8112D] px-3 text-sm text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white" />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Check out
                  <input type="time" value={stillIn ? "" : checkOut} onChange={(event) => setCheckOut(event.target.value)} disabled={!editable || stillIn} className="mt-1 h-10 w-full rounded-2xl border border-gray-200 outline-none focus:border-[#B8112D] px-3 text-sm text-[#0F172A] disabled:opacity-50 dark:border-crm-border dark:bg-transparent dark:text-white" />
                </label>
              </div>
              {row.detail ? (
                <p className="rounded-2xl bg-[#F8FAFC] px-3 py-2 text-sm text-gray-600 break-words dark:bg-white/5 dark:text-gray-300">{row.detail}</p>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-[#0F172A] dark:text-white">
                <input
                  type="checkbox"
                  checked={stillIn}
                  disabled={!editable}
                  onChange={(event) => setStillIn(event.target.checked)}
                />
                Still checked in
              </label>
            </>
          ) : null}

          {leaveLike ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">{row.detail || row.summary}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-gray-500">
                  From
                  <input type="date" value={fromDay} onChange={(event) => setFromDay(event.target.value)} disabled={!editable} className="mt-1 h-10 w-full rounded-2xl border border-gray-200 outline-none focus:border-[#B8112D] px-3 text-sm text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white" />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  To
                  <input type="date" value={toDay} onChange={(event) => setToDay(event.target.value)} disabled={!editable} className="mt-1 h-10 w-full rounded-2xl border border-gray-200 outline-none focus:border-[#B8112D] px-3 text-sm text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white" />
                </label>
              </div>
              <p className="text-xs text-gray-500">These dates are saved as paid leave, so those days are not deducted.</p>
            </>
          ) : null}

          {row.kind === "reimbursement" ? (
            <>
              <label className="block text-xs font-medium text-gray-500">
                Amount
                <input value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!editable} className="mt-1 h-10 w-full rounded-2xl border border-gray-200 outline-none focus:border-[#B8112D] px-3 text-sm text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white" />
              </label>
              {row.detail ? <p className="text-sm text-gray-600 dark:text-gray-300">{row.detail}</p> : null}
            </>
          ) : null}

          {row.kind === "asset" || row.kind === "custom" ? (
            <div className="rounded-2xl bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] dark:bg-white/5 dark:text-white">
              <p className="font-medium">{row.summary}</p>
              {row.detail && row.detail !== row.summary ? <p className="mt-1 text-gray-500 dark:text-gray-400">{row.detail}</p> : null}
            </div>
          ) : null}

          {editable ? (
            <label className="block text-xs font-medium text-gray-500">
              Status
              <select
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
                className="mt-1 h-10 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[#0F172A] outline-none focus:border-[#B8112D] dark:border-crm-border dark:bg-transparent dark:text-white"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Rejected</option>
              </select>
            </label>
          ) : null}

          {editable ? (
            <label className="block text-xs font-medium text-gray-500">
              Remarks
              <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} className="mt-1 w-full rounded-2xl border border-gray-200 outline-none focus:border-[#B8112D] px-3 py-2 text-sm text-[#0F172A] dark:border-crm-border dark:bg-transparent dark:text-white" />
            </label>
          ) : (
            <p className="text-sm text-gray-500">
              {row.status === "declined" ? "Rejected" : row.status === "approved" ? "Approved" : "Pending"}
              {row.reviewNote ? ` · ${row.reviewNote}` : ""}
            </p>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        {editable ? (
          <div className="flex justify-end gap-2 px-5 pb-5">
            {pending && nextStatus === "pending" ? (
              <>
                <button type="button" disabled={!!busy} onClick={() => void submit("decline")} className="inline-flex h-10 items-center rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 disabled:opacity-50 dark:border-crm-border dark:bg-transparent dark:text-gray-300">
                  {busy === "decline" ? <Loader2 size={14} className="animate-spin" /> : "Reject"}
                </button>
                <button type="button" disabled={!!busy} onClick={() => void submit("approve")} className="inline-flex h-10 items-center rounded-2xl bg-[#B8112D] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                  {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : "Approve"}
                </button>
              </>
            ) : (
              <button type="button" disabled={!!busy} onClick={() => void submit(actionFor(nextStatus))} className="inline-flex h-10 items-center rounded-2xl bg-[#B8112D] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : "Save"}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
