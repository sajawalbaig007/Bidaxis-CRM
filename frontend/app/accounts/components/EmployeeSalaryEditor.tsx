"use client";

import { useCallback, useEffect } from "react";
import {
  applyTechnicalManagerGross,
  computeAdminSalary,
  computeSalary,
  computeTechnicalManagerSalary,
  emptySalaryDetail,
  type EmployeeSalaryDetail,
} from "../utils/payrollFormula";
import { fetchAndApplyPendingLoan } from "../utils/loanLedgerApply";
import { currency } from "../types";
import AmountInput from "./AmountInput";

type Props = {
  name: string;
  value: EmployeeSalaryDetail;
  onChange: (next: EmployeeSalaryDetail) => void;
  teamHint?: string;
  /** Auto-lookup loan ledger by employee name */
  enableLoanLookup?: boolean;
  /** "admin" — Administration formula: no overtime, 6 PM late slabs. */
  variant?: "technical" | "technical_manager" | "admin";
};

function Num({
  label,
  value,
  onChange,
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
      <AmountInput
        value={Number.isFinite(value) ? value : 0}
        onChange={onChange}
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
  variant = "technical",
}: Props) {
  const d = value;
  const isAdmin = variant === "admin";
  const isTechMgr = variant === "technical_manager";
  const b = isTechMgr
    ? computeTechnicalManagerSalary(d)
    : isAdmin
      ? computeAdminSalary(d)
      : computeSalary(d);
  const tm = isTechMgr ? computeTechnicalManagerSalary(d) : null;

  const set = <K extends keyof EmployeeSalaryDetail>(key: K, val: EmployeeSalaryDetail[K]) => {
    onChange({ ...d, [key]: val });
  };

  const setGross = (gross: number) => {
    onChange(applyTechnicalManagerGross(d, gross));
  };

  const lookupLoan = useCallback(async (force = false) => {
    if (!enableLoanLookup || !name.trim()) return;
    const patch = await fetchAndApplyPendingLoan(
      name,
      {
        loanTotal: Number(d.loanTotal) || 0,
        loanPaid: Number(d.loanPaid) || 0,
        loanThisMonth: Number(d.loanThisMonth) || 0,
      },
      { force },
    );
    if (!patch) return;
    onChange({ ...d, ...patch });
  }, [enableLoanLookup, name, d, onChange]);

  useEffect(() => {
    void lookupLoan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate when person opens / name changes
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

      {isTechMgr && tm ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-2.5 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-violet-800">
            Package salary (Gross → %)
          </p>
          <p className="text-[10px] text-violet-700/80">
            Basic 50% · Medical 10% · Home 20% · Utility 10% · Travel 10% · PF = 8% of Basic ·
            Taxable = Gross − Medical · Net = Gross − PF − Tax
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Num label="Gross Salary" value={tm.grossSalary} onChange={setGross} hint="Enter package total" />
            <Num
              label="Tax Amount"
              value={d.incomeTax}
              onChange={v => set("incomeTax", v)}
              hint="Manual — editable"
            />
            <Read label="Basic (50%)" value={currency(tm.basic)} />
            <Read label="Medical (10%)" value={currency(tm.medicalAllowance)} />
            <Read label="Home (20%)" value={currency(tm.homeAllowance)} />
            <Read label="Utility (10%)" value={currency(tm.utilityAllowance)} />
            <Read label="Travel (10%)" value={currency(tm.travelAllowance)} />
            <Read label="Taxable Income" value={currency(tm.taxableIncome)} accent="text-violet-800" />
            <Read label="PF (8% of Basic)" value={currency(tm.pf)} accent="text-teal-800" />
            <Read label="1 Day (/30)" value={currency(tm.daySalary)} />
            <Read label="Net Salary" value={currency(tm.totalSalary)} accent="text-[#B8112D]" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Num label="Basic Salary" value={d.basic} onChange={v => set("basic", v)} />
          <Num label="Misc Allowance" value={d.allowance} onChange={v => set("allowance", v)} />
          <Num label="Home Allowance" value={d.homeAllowance ?? 0} onChange={v => set("homeAllowance", v)} />
          <Read label="Monthly (Basic+Allow)" value={currency(b.monthlySalary)} />
          <Read label="1 Day Salary (/30)" value={currency(b.daySalary)} />
          <Read label="1 Hour Salary (/8)" value={currency(b.hourSalary)} />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
          Salary slip profile ({variant === "technical" || variant === "technical_manager" ? "GPS · Global Pre Construction" : "BEM Solutions"})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Employee ID
            <input
              value={d.employeeId || ""}
              onChange={e => set("employeeId", e.target.value)}
              placeholder="BEM-DEV-002"
              className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-[#B8112D]"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Phone
            <input
              value={d.phone || ""}
              onChange={e => set("phone", e.target.value)}
              placeholder="03xx-xxxxxxx"
              className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-[#B8112D]"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
            CNIC
            <input
              value={d.cnic || ""}
              onChange={e => set("cnic", e.target.value)}
              placeholder="xxxxx-xxxxxxx-x"
              className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-[#B8112D]"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 col-span-2 sm:col-span-1">
            Address
            <input
              value={d.address || ""}
              onChange={e => set("address", e.target.value)}
              placeholder="City / area"
              className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-[#B8112D]"
            />
          </label>
        </div>
      </div>

      {!isAdmin && !isTechMgr && (
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
      )}

      {!isTechMgr && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-2.5 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-800">
            {isAdmin ? "Late Arrival (Admin shift 6:00 PM)" : "Late Arrival (Tech shift 7:00–16:00)"}
          </p>
          <p className="text-[10px] text-amber-700/80">
            {isAdmin
              ? "1-day salary = (Basic + Allowance) ÷ 30. Relief ≤18:15 · 18:15–18:30 = ⅕ day · 18:30–19:00 = ¼ day · 19:00–20:00 = ⅓ day · 20:00+ = half day."
              : "Relief ≤07:30 · 07:30–08:00 = ¼ day · 08:00–09:00 = ⅓ day · 09:00+ = half day. If worked ≥9h after late check-in → waived."}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Check In
              <input
                type="time"
                value={d.checkIn || (isAdmin ? "18:00" : "07:00")}
                onChange={e => set("checkIn", e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none"
              />
            </label>
            {!isAdmin && (
              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Check Out
                <input
                  type="time"
                  value={d.checkOut || "16:00"}
                  onChange={e => set("checkOut", e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none"
                />
              </label>
            )}
            <Num
              label="Late Override (optional)"
              value={d.lateDeductionOverride ?? 0}
              onChange={v => set("lateDeductionOverride", v)}
              hint="0 = use time rules"
            />
            <Read label="Late Deduction" value={currency(b.lateDeduction)} accent="text-amber-800" />
            <Read label="Rule" value={b.lateRuleApplied} />
          </div>
        </div>
      )}

      {!isTechMgr && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-2.5 space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-rose-800">Leaves</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Num label="Paid Leave Days" value={d.paidLeaveDays} onChange={v => set("paidLeaveDays", v)} />
            <Num label="Unpaid Leave Days" value={d.unpaidLeaveDays} onChange={v => set("unpaidLeaveDays", v)} />
            <Read label="Unpaid Leave Deduction" value={currency(b.unpaidLeaveDeduction)} accent="text-rose-700" />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-orange-800">Loan</p>
          {enableLoanLookup && (
            <button
              type="button"
              onClick={() => void lookupLoan(true)}
              className="text-[10px] font-bold text-[#0B84F3] hover:underline"
            >
              Refresh from ledger
            </button>
          )}
        </div>
        <p className="text-[10px] text-orange-700/80">
          Pending loan auto-fills from the shared ledger. Clearance: deduct from salary or pay separately in cash. Remaining = Total − Paid − This month.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Num label="Total Loan Amount" value={d.loanTotal} onChange={v => set("loanTotal", v)} />
          <Num label="Already Paid" value={d.loanPaid} onChange={v => set("loanPaid", v)} />
          <Read label="Remaining" value={currency(b.loanRemaining)} accent="text-orange-800" />
          <Num
            label="This Month Amount"
            value={d.loanThisMonth}
            onChange={v => set("loanThisMonth", v)}
            hint={d.loanPaymentMode === "cash" ? "Cash payment (not from salary)" : "Salary deduction"}
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => set("loanPaymentMode", "salary")}
            className={`h-8 px-3 rounded-lg text-[11px] font-bold border transition-colors ${
              (d.loanPaymentMode ?? "salary") === "salary"
                ? "bg-[#B8112D] text-white border-[#B8112D]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Deduct from salary
          </button>
          <button
            type="button"
            onClick={() => set("loanPaymentMode", "cash")}
            className={`h-8 px-3 rounded-lg text-[11px] font-bold border transition-colors ${
              d.loanPaymentMode === "cash"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Paid separately in cash
          </button>
        </div>
        {(d.loanPaymentMode ?? "salary") === "salary" && (Number(d.loanThisMonth) || 0) > 0 ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Read label="Net before loan" value={currency(b.netBeforeLoan)} accent="text-gray-700" />
            <Read label="Net after loan deduction" value={currency(b.totalSalary)} accent="text-[#B8112D]" />
          </div>
        ) : d.loanPaymentMode === "cash" && (Number(d.loanThisMonth) || 0) > 0 ? (
          <p className="text-[10px] font-semibold text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">
            Cash clearance — loan is not deducted from net salary. Ledger paid amount will update.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-teal-800">PF & Tax</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          {isTechMgr ? (
            <>
              <Read label="PF (8% of Basic)" value={currency(b.pf)} accent="text-teal-800" />
              <Num
                label="Tax Amount"
                value={d.incomeTax}
                onChange={v => set("incomeTax", v)}
                hint="Type any amount — updates Net"
              />
              <Read label="Taxable Income" value={currency(tm?.taxableIncome ?? 0)} accent="text-violet-800" />
            </>
          ) : (
            <>
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
              <Num label="Tax Amount" value={d.incomeTax} onChange={v => set("incomeTax", v)} />
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#F3D7DC] bg-gradient-to-br from-[#FFF6F8] to-white p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#B8112D]">Totals</p>
        <p className="text-[10px] text-gray-500">
          {isTechMgr
            ? "Gross − PF − Tax (− loan this month) = Net Salary"
            : isAdmin
              ? "Basic + Allowance = Total Earning · Late + Unpaid + Loan(this mo) + PF + Tax = Total Deduction"
              : "Basic + OT + Allowance = Total Earning · Late + Unpaid + Loan(this mo) + PF + Tax = Total Deduction"}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Read label={isTechMgr ? "Gross Salary" : "Total Earning"} value={currency(b.totalEarning)} accent="text-emerald-700" />
          <Read label="Total Deduction" value={currency(b.totalDeduction)} accent="text-red-600" />
          <Read
            label={(d.loanPaymentMode ?? "salary") === "salary" && b.loanFromSalary > 0 ? "Net after loan" : "Net Salary"}
            value={currency(b.totalSalary)}
            accent="text-[#B8112D]"
          />
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
