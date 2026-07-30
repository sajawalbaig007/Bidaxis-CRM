"use client";

import { useCallback, useEffect } from "react";
import API from "@/lib/api";
import { computeSalary, emptySalaryDetail, type EmployeeSalaryDetail } from "../utils/payrollFormula";
import { currency } from "../types";

type Props = {
  name: string;
  value: EmployeeSalaryDetail;
  onChange: (next: EmployeeSalaryDetail) => void;
  teamHint?: string;
  /** Auto-lookup loan ledger by employee name */
  enableLoanLookup?: boolean;
};

function Num({
  label,
  value,
  onChange,
  step = "any",
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={e => onChange(Number(e.target.value || 0))}
        className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm tabular-nums outline-none focus:border-[#B8112D]"
      />
      {hint && <span className="block mt-0.5 text-[9px] font-normal normal-case tracking-normal text-gray-400">{hint}</span>}
    </label>
  );
}

function Read({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-[#F8FAFC] px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${accent ?? "text-gray-800"}`}>{value}</p>
    </div>
  );
}

export default function EmployeeSalaryEditor({
  name,
  value,
  onChange,
  teamHint,
  enableLoanLookup = true,
}: Props) {
  const d = value;
  const b = computeSalary(d);
  const set = <K extends keyof EmployeeSalaryDetail>(key: K, val: EmployeeSalaryDetail[K]) => {
    onChange({ ...d, [key]: val });
  };

  const lookupLoan = useCallback(async () => {
    if (!enableLoanLookup || !name.trim()) return;
    try {
      const res = await API.get(`/accounts/payroll-loans/lookup?name=${encodeURIComponent(name)}`);
      const loan = res.data.loan;
      if (loan) {
        onChange({
          ...d,
          loanTotal: Number(loan.totalAmount) || 0,
          loanPaid: Number(loan.paidAmount) || 0,
        });
      }
    } catch {
      /* ignore */
    }
  }, [enableLoanLookup, name, d, onChange]);

  useEffect(() => {
    void lookupLoan();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when name changes
  }, [name]);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-gray-800">{name || "Employee"}</p>
          {teamHint && <p className="text-[10px] text-gray-400">{teamHint}</p>}
        </div>
        <p className="text-xs font-extrabold text-[#B8112D] tabular-nums">Net: {currency(b.totalSalary)}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Num label="Basic Salary" value={d.basic} onChange={v => set("basic", v)} />
        <Num label="Allowance" value={d.allowance} onChange={v => set("allowance", v)} />
        <Read label="Monthly (Basic+Allow)" value={currency(b.monthlySalary)} />
        <Read label="1 Day Salary (/30)" value={currency(b.daySalary)} />
        <Read label="1 Hour Salary (/8)" value={currency(b.hourSalary)} />
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-700">Overtime</p>
        <p className="text-[10px] text-blue-600/80">Weekday OT = hours × hourly × 1.5 · Weekend OT = hours × hourly × 2</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Num label="Weekday OT Hours" value={d.weekdayOtHours} onChange={v => set("weekdayOtHours", v)} step="0.25" />
          <Num label="Weekend OT Hours" value={d.weekendOtHours} onChange={v => set("weekendOtHours", v)} step="0.25" />
          <Read label="Weekday OT Pay" value={currency(b.weekdayOtPay)} accent="text-blue-700" />
          <Read label="Weekend OT Pay" value={currency(b.weekendOtPay)} accent="text-blue-700" />
          <Read label="Total Overtime" value={currency(b.totalOvertime)} accent="text-blue-800" />
        </div>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-800">Late Arrival (Tech shift 7:00–16:00)</p>
        <p className="text-[10px] text-amber-700/80">
          Relief ≤07:30 · 07:30–08:00 = ¼ day · 08:00–09:00 = ⅓ day · 09:00+ = half day.
          If worked ≥9h after late check-in → waived.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Check In
            <input
              type="time"
              value={d.checkIn || "07:00"}
              onChange={e => set("checkIn", e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Check Out
            <input
              type="time"
              value={d.checkOut || "16:00"}
              onChange={e => set("checkOut", e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none"
            />
          </label>
          <Num
            label="Late Override (optional)"
            value={d.lateDeductionOverride ?? 0}
            onChange={v => set("lateDeductionOverride", v > 0 ? v : null)}
            hint="Leave 0 for auto formula"
          />
          <Read label="Late Deduction" value={currency(b.lateDeduction)} accent="text-amber-800" />
        </div>
        <p className="text-[10px] text-amber-700 font-medium">{b.lateRuleApplied}</p>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-violet-800">Leaves</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Num label="Paid Leave Days" value={d.paidLeaveDays} onChange={v => set("paidLeaveDays", v)} hint="No salary cut" />
          <Num label="Unpaid Leave Days" value={d.unpaidLeaveDays} onChange={v => set("unpaidLeaveDays", v)} hint="× 1-day salary" />
          <Read label="Unpaid Deduction" value={currency(b.unpaidLeaveDeduction)} accent="text-violet-800" />
          <Read label="Paid Leaves" value={`${b.paidLeaveDays} day(s)`} />
        </div>
      </div>

      <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-orange-800">Loan</p>
          {enableLoanLookup && (
            <button
              type="button"
              onClick={() => void lookupLoan()}
              className="text-[10px] font-bold text-orange-700 hover:underline"
            >
              Lookup by name
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Num label="Total Loan Amount" value={d.loanTotal} onChange={v => set("loanTotal", v)} />
          <Num label="Amount Already Paid" value={d.loanPaid} onChange={v => set("loanPaid", v)} />
          <Read label="Remaining" value={currency(b.loanRemaining)} accent="text-orange-800" />
          <Num label="This Month Deduction" value={d.loanThisMonth} onChange={v => set("loanThisMonth", v)} hint="Optional salary cut" />
        </div>
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-teal-800">PF & Tax</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <label className="flex items-center gap-2 text-xs text-gray-700 h-9 col-span-2 sm:col-span-1">
            <input
              type="checkbox"
              checked={d.pfAuto}
              onChange={e => set("pfAuto", e.target.checked)}
              className="rounded border-gray-300"
            />
            PF auto 8% of basic
          </label>
          {!d.pfAuto && (
            <Num label="PF Manual" value={d.pfOverride ?? 0} onChange={v => set("pfOverride", v)} />
          )}
          <Read label="PF Deduction" value={currency(b.pf)} accent="text-teal-800" />
          <Num label="Income Tax (manual)" value={d.incomeTax} onChange={v => set("incomeTax", v)} />
        </div>
      </div>

      <div className="rounded-xl border border-[#F3D7DC] bg-gradient-to-br from-[#FFF6F8] to-white p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#B8112D]">Totals</p>
        <p className="text-[10px] text-gray-500">
          Basic + OT + Allowance = Total Earning · Late + Unpaid + Loan(this mo) + PF + Tax = Total Deduction
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Read label="Total Earning" value={currency(b.totalEarning)} accent="text-emerald-700" />
          <Read label="Total Deduction" value={currency(b.totalDeduction)} accent="text-red-600" />
          <Read label="Total Salary (Net)" value={currency(b.totalSalary)} accent="text-[#B8112D]" />
        </div>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Remarks
        <textarea
          value={d.remarks}
          onChange={e => set("remarks", e.target.value)}
          rows={2}
          placeholder="Manual remarks…"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none resize-none focus:border-[#B8112D]"
        />
      </label>
    </div>
  );
}

export function ensureSalaryDetail(
  existing: EmployeeSalaryDetail | undefined,
  fallbackAmount = 0,
): EmployeeSalaryDetail {
  if (existing) return emptySalaryDetail(existing);
  return emptySalaryDetail({ basic: fallbackAmount });
}
