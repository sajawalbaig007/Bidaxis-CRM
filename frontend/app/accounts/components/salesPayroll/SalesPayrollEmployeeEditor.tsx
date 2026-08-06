"use client";

import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { currency } from "../../types";
import {
  calcSalesCommission,
  calcTlAssignedCommission,
  computeSalesEmployeePayroll,
  newFixClientProject,
  type SalesPayrollEmployee,
  type SalesPayrollData,
} from "../../utils/salesPayrollFormula";
import { HAMMAD_TEAM_LEAD_ID } from "../../utils/salesPayrollDefaults";
import AmountInput from "../AmountInput";

type Props = {
  employee: SalesPayrollEmployee;
  variant: "sales" | "team_lead";
  allData: SalesPayrollData;
  onChange: (next: SalesPayrollEmployee) => void;
  onAssignToLead?: () => void;
  defaultOpen?: boolean;
  /** Inside Income Statement modal — skip outer collapse, show fields directly */
  embedded?: boolean;
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
  hint?: string;
  step?: string;
}) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
      {label}
      <AmountInput
        value={Number.isFinite(value) ? value : 0}
        onChange={onChange}
        className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm tabular-nums outline-none focus:border-[#B8112D]"
      />
      {hint && <span className="block mt-0.5 text-[9px] font-normal normal-case text-gray-400">{hint}</span>}
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

export default function SalesPayrollEmployeeEditor({
  employee,
  variant,
  allData,
  onChange,
  onAssignToLead,
  defaultOpen = false,
  embedded = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen || embedded);
  const isSales = variant === "sales";

  const assignedTlTotal =
    variant === "team_lead"
      ? allData.salesTeamMembers
          .filter(m => m.assignedToLead && m.assignedTeamLeadId === employee.id)
          .reduce((s, m) => s + calcTlAssignedCommission(m), 0)
      : 0;

  const breakdown = computeSalesEmployeePayroll(employee, assignedTlTotal);
  const comm = calcSalesCommission(employee.commission, employee.role);

  const set = useCallback(
    <K extends keyof SalesPayrollEmployee>(key: K, val: SalesPayrollEmployee[K]) => {
      onChange({ ...employee, [key]: val });
    },
    [employee, onChange],
  );

  const setComm = useCallback(
    (patch: Partial<SalesPayrollEmployee["commission"]>) => {
      onChange({ ...employee, commission: { ...employee.commission, ...patch } });
    },
    [employee, onChange],
  );

  const lookupLoan = useCallback(async (force = false) => {
    try {
      const res = await API.get(`/accounts/payroll-loans/lookup?name=${encodeURIComponent(employee.name)}`);
      const loan = res.data.loan;
      if (!loan) return;
      const hasLocal =
        (Number(employee.loanTotal) || 0) > 0 ||
        (Number(employee.loanPaid) || 0) > 0 ||
        (Number(employee.loanThisMonth) || 0) > 0;
      if (!force && hasLocal) return;
      onChange({
        ...employee,
        loanTotal: Number(loan.totalAmount) || 0,
        loanPaid: Number(loan.paidAmount) || 0,
        ...(force ? { loanThisMonth: 0 } : {}),
      });
    } catch {
      /* ignore */
    }
  }, [employee, onChange]);

  useEffect(() => {
    if (open) void lookupLoan(false);
  }, [open, employee.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignedReps = allData.salesTeamMembers.filter(
    m => m.assignedToLead && m.assignedTeamLeadId === employee.id,
  );

  return (
    <article className={`rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden ${embedded ? "border-0 shadow-none rounded-none" : ""}`}>
      {!embedded && (
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-[#ECFDF3] text-[#12B76A] flex items-center justify-center shrink-0 font-extrabold text-xs">
          {employee.code.split("-").pop()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-900 truncate">{employee.name}</p>
          <p className="text-[11px] text-gray-500">
            {employee.code} · {comm.totalProjects} projects · Commission {currency(comm.totalCommission)}
          </p>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-[10px] font-bold uppercase text-gray-400">Net Salary</p>
          <p className="text-base font-extrabold text-[#B8112D] tabular-nums">{currency(breakdown.netSalary)}</p>
        </div>
      </button>
      )}

      {(embedded || open) && (
        <div className="px-3 sm:px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* Project Commission */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
            <p className="text-[11px] font-extrabold uppercase text-emerald-800">Project Commission</p>
            <p className="text-[10px] text-emerald-900/80">
              {isSales
                ? "Old $1,000/project (partial 50%) · New $3,000 · Fix 2.5% · No overtime"
                : "New $3,000/project · Fix 2.5% · Old projects count in total · No overtime"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {isSales && (
                <>
                  <Num label="Old Client Projects" value={employee.commission.oldClientProjects} onChange={v => setComm({ oldClientProjects: v })} />
                  <Num label="Partial Pay Count" value={employee.commission.oldClientPartialCount} onChange={v => setComm({ oldClientPartialCount: v })} hint="0.5× $1,000" />
                  <Read label="Old Commission" value={currency(comm.oldComm)} accent="text-emerald-800" />
                </>
              )}
              {!isSales && (
                <Num label="Old Client Projects" value={employee.commission.oldClientProjects} onChange={v => setComm({ oldClientProjects: v })} />
              )}
              <Num label="New Client Projects" value={employee.commission.newClientProjects} onChange={v => setComm({ newClientProjects: v })} />
              <Read label="New Commission" value={currency(comm.newComm)} accent="text-emerald-800" />
              <Read label="Fix Commission (2.5%)" value={currency(comm.fixComm)} accent="text-emerald-800" />
              <Read label="Total Projects" value={String(comm.totalProjects)} />
              <Read label="Total Commission" value={currency(comm.totalCommission)} accent="text-emerald-900" />
            </div>

            {employee.commission.fixClientProjects.map(p => (
              <div key={p.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <label className="block text-[10px] font-bold uppercase text-gray-500">
                  Client
                  <input
                    value={p.clientName}
                    onChange={e => setComm({
                      fixClientProjects: employee.commission.fixClientProjects.map(x =>
                        x.id === p.id ? { ...x, clientName: e.target.value } : x,
                      ),
                    })}
                    className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm"
                  />
                </label>
                <Num
                  label="Project Pay ($)"
                  value={p.projectPay}
                  onChange={v => setComm({
                    fixClientProjects: employee.commission.fixClientProjects.map(x =>
                      x.id === p.id ? { ...x, projectPay: v } : x,
                    ),
                  })}
                />
                <Read label="Commission 2.5%" value={currency(p.projectPay * 0.025)} accent="text-emerald-800" />
                <button
                  type="button"
                  onClick={() => setComm({
                    fixClientProjects: employee.commission.fixClientProjects.filter(x => x.id !== p.id),
                  })}
                  className="h-9 rounded-lg border border-red-100 text-red-500 text-xs font-semibold hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setComm({
                fixClientProjects: [...employee.commission.fixClientProjects, newFixClientProject()],
              })}
              className="h-8 px-3 rounded-lg border border-dashed border-emerald-300 text-emerald-700 text-[11px] font-bold"
            >
              + Add Fix Client Project
            </button>

            {isSales && onAssignToLead && (
              <button
                type="button"
                onClick={onAssignToLead}
                className={`h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 ${
                  employee.assignedToLead
                    ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {employee.assignedToLead ? "Assigned to Hammad (Team Lead)" : "Assign to Lead"}
              </button>
            )}
          </div>

          {variant === "team_lead" && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
              <p className="text-[11px] font-extrabold uppercase text-indigo-800">Assigned Sales Reps — TL Commission</p>
              <p className="text-[10px] text-indigo-700">$1,000 × projects · Fix client 0.5% for TL</p>
              {assignedReps.length === 0 ? (
                <p className="text-xs text-gray-500">No sales reps assigned yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-indigo-700">
                        <th className="text-left py-1 pr-2">Rep</th>
                        <th className="text-left py-1 pr-2">Projects</th>
                        <th className="text-left py-1">TL Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedReps.map(r => (
                        <tr key={r.id} className="border-t border-indigo-100">
                          <td className="py-2 pr-2 font-semibold">{r.name}</td>
                          <td className="py-2 pr-2">{calcSalesCommission(r.commission, "sales").totalProjects}</td>
                          <td className="py-2 font-bold text-indigo-800">{currency(calcTlAssignedCommission(r))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-indigo-200">
                        <td colSpan={2} className="py-2 text-right font-bold pr-2">Total</td>
                        <td className="py-2 font-extrabold text-indigo-900">{currency(assignedTlTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Salary */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
            <p className="text-[11px] font-extrabold uppercase text-blue-800">Total Earning</p>
            <p className="text-[10px] text-blue-700">Basic + Allowance + Total Commission = Total Earning</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Num label="Basic Salary" value={employee.basic} onChange={v => set("basic", v)} />
              <Num label="Allowance" value={employee.allowance} onChange={v => set("allowance", v)} />
              {variant === "team_lead" && (
                <Num label="Home Allowance" value={employee.homeAllowance ?? 0} onChange={v => set("homeAllowance", v)} />
              )}
              <Read label="Total Commission" value={currency(comm.totalCommission)} accent="text-emerald-700" />
              <Read label="Total Earning" value={currency(breakdown.totalEarning)} accent="text-blue-800" />
            </div>
          </div>

          {/* Late */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-2">
            <p className="text-[11px] font-extrabold uppercase text-amber-900">Late Arrival (6 PM PKT)</p>
            <div className="text-[10px] text-amber-800 space-y-0.5">
              <p>≤18:15 none · 18:15–18:30 ⅕ day · 18:30–19:00 ¼ · 19:00–20:00 ⅓ · 20:00+ half</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="block text-[10px] font-bold uppercase text-gray-500">
                Check In
                <input
                  type="time"
                  value={employee.checkIn}
                  onChange={e => set("checkIn", e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm"
                />
              </label>
              <Read label="Day Salary (/30)" value={currency(breakdown.daySalary)} />
              <Read label="Late Deduction" value={currency(breakdown.lateDeduction)} accent="text-amber-800" />
              <Num
                label="Late Override"
                value={employee.lateDeductionOverride ?? 0}
                onChange={v => set("lateDeductionOverride", v > 0 ? v : null)}
                hint="0 = auto"
              />
            </div>
            <p className="text-[10px] text-amber-700">{breakdown.lateRuleApplied}</p>
          </div>

          {/* Leaves */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
            <p className="text-[11px] font-extrabold uppercase text-violet-800">Leaves</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Num label="Paid Leave Days" value={employee.paidLeaveDays} onChange={v => set("paidLeaveDays", v)} hint="No cut" />
              <Num label="Unpaid Leave Days" value={employee.unpaidLeaveDays} onChange={v => set("unpaidLeaveDays", v)} />
              <Read label="Unpaid Deduction" value={currency(breakdown.unpaidLeaveDeduction)} accent="text-violet-800" />
            </div>
          </div>

          {/* Loan */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-3 space-y-2">
            <p className="text-[11px] font-extrabold uppercase text-orange-800">Loan</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Read label="Employee" value={employee.name} />
              <Num label="Total Loan" value={employee.loanTotal} onChange={v => set("loanTotal", v)} />
              <Num label="Already Paid" value={employee.loanPaid} onChange={v => set("loanPaid", v)} />
              <Read label="Remaining" value={currency(breakdown.loanRemaining)} accent="text-orange-800" />
              <Num label="This Month (optional)" value={employee.loanThisMonth} onChange={v => set("loanThisMonth", v)} />
            </div>
            <button type="button" onClick={() => void lookupLoan(true)} className="text-[10px] font-bold text-[#0B84F3] hover:underline">
              Refresh loan from ledger
            </button>
            <p className="text-[10px] text-orange-700/80">
              Remaining = Total − Paid − This month. Saving Income Statement syncs the ledger for next month.
            </p>
          </div>

          {/* PF & Tax */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-3 space-y-2">
            <p className="text-[11px] font-extrabold uppercase text-teal-800">PF & Tax</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Read label="PF (8% basic)" value={currency(breakdown.pf)} accent="text-teal-800" />
              <Num label="Income Tax (manual)" value={employee.incomeTax} onChange={v => set("incomeTax", v)} />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-[#F3D7DC] bg-gradient-to-br from-[#FFF6F8] to-white p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Read label="Total Earning" value={currency(breakdown.totalEarning)} accent="text-emerald-700" />
              <Read label="Total Deduction" value={currency(breakdown.totalDeduction)} accent="text-red-600" />
            </div>
            <Read label="Net Total Salary" value={currency(breakdown.netSalary)} accent="text-[#B8112D]" />
          </div>

          <label className="block text-[10px] font-bold uppercase text-gray-500">
            Remarks
            <textarea
              value={employee.remarks}
              onChange={e => set("remarks", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm resize-none focus:border-[#B8112D]"
            />
          </label>
        </div>
      )}
    </article>
  );
}

export function assignMemberToLead(
  data: SalesPayrollData,
  memberId: string,
  leadId: string = HAMMAD_TEAM_LEAD_ID,
): SalesPayrollData {
  return {
    ...data,
    salesTeamMembers: data.salesTeamMembers.map(m =>
      m.id === memberId
        ? { ...m, assignedToLead: true, assignedTeamLeadId: leadId }
        : m,
    ),
  };
}
