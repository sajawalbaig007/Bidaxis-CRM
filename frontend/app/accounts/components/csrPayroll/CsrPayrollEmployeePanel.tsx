"use client";

import { useState } from "react";
import {
  ChevronDown, UserCheck, DollarSign, CalendarDays,
  Receipt, MessageSquare, Plus, Trash2,
} from "lucide-react";
import type { CsrPayrollMock } from "./mockData";
import { SectionCard, MockInput, MockReadout, fmt, daySalary, pfAmount } from "./uiHelpers";

type Props = {
  employee: CsrPayrollMock;
  variant: "csr" | "team_lead";
  defaultOpen?: boolean;
};

const OLD_RATE = 1000;
const NEW_RATE = 3000;
const FIX_CSR_PCT = 2.5;
const TL_PER_PROJECT = 1000;
const TL_FIX_PCT = 0.5;

export default function CsrPayrollEmployeePanel({ employee, variant, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isCsr = variant === "csr";

  const day = daySalary(employee.basicSalary, employee.allowance);
  const pf = pfAmount(employee.basicSalary);
  const oldFull = employee.oldClientProjects - employee.oldClientPartialCount;
  const oldComm =
    oldFull * OLD_RATE + employee.oldClientPartialCount * (OLD_RATE * 0.5);
  const newComm = employee.newClientProjects * NEW_RATE;
  const fixComm = employee.fixClientProjects.reduce(
    (s, p) => s + p.projectPay * (p.commissionPct / 100),
    0,
  );
  const totalProjects =
    employee.oldClientProjects +
    employee.newClientProjects +
    employee.fixClientProjects.length;
  const totalProjectPay = oldComm + newComm + fixComm;
  const totalEarning = employee.basicSalary + employee.allowance + totalProjectPay;
  const totalDeduction =
    employee.lateDeduction +
    employee.unpaidLeaveDeduction +
    employee.loanThisMonth +
    pf +
    employee.incomeTax;
  const netSalary = totalEarning - totalDeduction;
  const assignedTlTotal =
    employee.assignedCsrs?.filter(a => a.assigned).reduce((s, a) => s + a.tlCommission, 0) ?? 0;

  return (
    <article className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0 font-extrabold text-xs">
          {employee.code.split("-").pop()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-gray-900 truncate">{employee.name}</p>
          <p className="text-[11px] text-gray-500">{employee.code} · {totalProjects} projects · Commission {fmt(totalProjectPay)}</p>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-[10px] font-bold uppercase text-gray-400">Net Salary</p>
          <p className="text-base font-extrabold text-[#B8112D] tabular-nums">{fmt(netSalary + (variant === "team_lead" ? assignedTlTotal : 0))}</p>
        </div>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 sm:px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* ── Project Commission ── */}
          <SectionCard
            title="Project Commission"
            subtitle={
              isCsr
                ? "Old client $1,000/project (partial = 50%) · New client $3,000/project · Fix client 2.5% of project pay"
                : "New client $3,000/project · Old + New + Fix client commission = total · TL gets $1,000/assigned CSR project (fix client 0.5%)"
            }
            accent="emerald"
          >
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[720px] text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                    {isCsr && (
                      <>
                        <th className="text-left py-2 pr-3 font-bold">Old Client Projects</th>
                        <th className="text-left py-2 pr-3 font-bold">Partial Pay (0.5×)</th>
                        <th className="text-left py-2 pr-3 font-bold">Old Commission</th>
                      </>
                    )}
                    {!isCsr && <th className="text-left py-2 pr-3 font-bold">Old Client Projects</th>}
                    <th className="text-left py-2 pr-3 font-bold">New Client Projects</th>
                    <th className="text-left py-2 pr-3 font-bold">New Commission (×$3,000)</th>
                    <th className="text-left py-2 pr-3 font-bold">Fix Client Commission (2.5%)</th>
                    <th className="text-left py-2 pr-3 font-bold">Total Projects</th>
                    <th className="text-left py-2 pr-3 font-bold">Total Project Pay</th>
                    {isCsr && <th className="text-left py-2 font-bold">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-emerald-100/80">
                    {isCsr && (
                      <>
                        <td className="py-2 pr-3">
                          <input type="number" defaultValue={employee.oldClientProjects} className="h-8 w-16 rounded-lg border border-gray-200 px-2 tabular-nums" />
                        </td>
                        <td className="py-2 pr-3">
                          <input type="number" defaultValue={employee.oldClientPartialCount} className="h-8 w-16 rounded-lg border border-gray-200 px-2 tabular-nums" title="Partial pay count" />
                        </td>
                        <td className="py-2 pr-3 font-bold text-emerald-800 tabular-nums">{fmt(oldComm)}</td>
                      </>
                    )}
                    {!isCsr && (
                      <td className="py-2 pr-3">
                        <input type="number" defaultValue={employee.oldClientProjects} className="h-8 w-16 rounded-lg border border-gray-200 px-2 tabular-nums" />
                      </td>
                    )}
                    <td className="py-2 pr-3">
                      <input type="number" defaultValue={employee.newClientProjects} className="h-8 w-16 rounded-lg border border-gray-200 px-2 tabular-nums" />
                    </td>
                    <td className="py-2 pr-3 font-bold text-emerald-800 tabular-nums">{fmt(newComm)}</td>
                    <td className="py-2 pr-3 font-bold text-emerald-800 tabular-nums">{fmt(fixComm)}</td>
                    <td className="py-2 pr-3 font-bold tabular-nums">{totalProjects}</td>
                    <td className="py-2 pr-3 font-extrabold text-emerald-900 tabular-nums">{fmt(totalProjectPay)}</td>
                    {isCsr && (
                      <td className="py-2">
                        <button
                          type="button"
                          className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-[11px] font-bold inline-flex items-center gap-1.5 hover:bg-indigo-700 transition-colors whitespace-nowrap"
                        >
                          <UserCheck size={13} />
                          Assign to Lead
                        </button>
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Fix client rows */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-emerald-800/80">Fix Client Projects</p>
              {employee.fixClientProjects.map(p => (
                <div key={p.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <MockInput label="Client Name" value={p.clientName} type="text" />
                  <MockInput label="Project Pay ($)" value={p.projectPay} hint="Company pays CSR 2.5%" />
                  <MockReadout label="CSR Commission (2.5%)" value={fmt(p.projectPay * 0.025)} accent="text-emerald-800" />
                  <button type="button" className="h-9 rounded-lg border border-red-100 text-red-500 text-xs font-semibold inline-flex items-center justify-center gap-1 hover:bg-red-50">
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              ))}
              <button type="button" className="h-8 px-3 rounded-lg border border-dashed border-emerald-300 text-emerald-700 text-[11px] font-bold inline-flex items-center gap-1 hover:bg-emerald-50/50">
                <Plus size={13} /> Add Fix Client Project
              </button>
            </div>
          </SectionCard>

          {/* Team Lead: assigned CSR commission */}
          {variant === "team_lead" && employee.assignedCsrs && (
            <SectionCard
              title="Assigned CSR Commission (Team Lead)"
              subtitle="Per assigned CSR project: $1,000 × project count · Fix client scenario: 0.5% of fix client amount"
              accent="indigo"
            >
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-indigo-700/80">
                      <th className="text-left py-2 pr-3 font-bold">CSR</th>
                      <th className="text-left py-2 pr-3 font-bold">Code</th>
                      <th className="text-left py-2 pr-3 font-bold">Projects (month)</th>
                      <th className="text-left py-2 pr-3 font-bold">Fix Client Amount</th>
                      <th className="text-left py-2 pr-3 font-bold">TL Commission</th>
                      <th className="text-left py-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.assignedCsrs.map(row => (
                      <tr key={row.id} className="border-t border-indigo-100/60">
                        <td className="py-2.5 pr-3 font-semibold text-gray-800">{row.csrName}</td>
                        <td className="py-2.5 pr-3 text-gray-500">{row.csrCode}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{row.totalProjects}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{fmt(row.fixClientAmount)}</td>
                        <td className="py-2.5 pr-3 font-bold text-indigo-800 tabular-nums">
                          {row.assigned ? fmt(row.totalProjects * TL_PER_PROJECT + row.fixClientAmount * (TL_FIX_PCT / 100)) : "—"}
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.assigned ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                            {row.assigned ? "Assigned" : "Not assigned"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-indigo-200">
                      <td colSpan={4} className="py-2 text-right font-bold text-indigo-800 pr-3">Total TL Commission from CSRs</td>
                      <td className="py-2 font-extrabold text-indigo-900 tabular-nums">{fmt(assignedTlTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>
          )}

          {/* ── Salary Calculation ── */}
          <SectionCard
            title="Salary Calculation — Total Earning"
            subtitle="Basic Salary + Allowance + Total Commission = Total Earning"
            accent="blue"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MockInput label="Basic Salary" value={employee.basicSalary} />
              <MockInput label="Allowance" value={employee.allowance} />
              <MockReadout label="Total Commission" value={fmt(totalProjectPay)} accent="text-emerald-700" />
              <MockReadout label="Total Earning" value={fmt(totalEarning)} accent="text-blue-800" />
              <MockReadout label="1 Day Salary (÷30)" value={fmt(day)} />
            </div>
          </SectionCard>

          {/* ── Late Arrival ── */}
          <SectionCard
            title="Late Arrival Deduction"
            subtitle="CSR shift 6:00 PM PKT · (Basic + Allowance) ÷ 30 = per day salary"
            accent="amber"
          >
            <div className="rounded-lg bg-amber-50/80 border border-amber-100 p-2.5 text-[10px] text-amber-900 leading-relaxed space-y-0.5">
              <p><strong>06:00 – 06:15</strong> → No deduction</p>
              <p><strong>06:15 – 06:30</strong> → ⅕ of day salary</p>
              <p><strong>06:30 – 07:00</strong> → ¼ of day salary</p>
              <p><strong>07:00 – 08:00</strong> → ⅓ of day salary</p>
              <p><strong>08:00 onwards</strong> → Half day salary deducted</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MockInput label="Check-in Time (PKT)" value={employee.checkIn} type="time" />
              <MockReadout label="Per Day Salary" value={fmt(day)} />
              <MockReadout label="Late Deduction" value={fmt(employee.lateDeduction)} accent="text-amber-800" />
              <MockInput label="Manual Override (optional)" value={0} hint="Leave 0 for auto formula" />
            </div>
          </SectionCard>

          {/* ── Leaves ── */}
          <SectionCard
            title="Leaves (Manual)"
            subtitle="Paid: no deduction · Unpaid: (Basic + Allowance) ÷ 30 × days"
            accent="violet"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-violet-100 bg-white/70 p-3 space-y-2">
                <p className="text-[10px] font-extrabold uppercase text-violet-700 flex items-center gap-1.5">
                  <CalendarDays size={12} /> Paid Leaves
                </p>
                <MockInput label="Number of Days" value={employee.paidLeaveDays} hint="No salary cut" />
                <MockReadout label="Deduction" value="Rs 0" accent="text-violet-700" />
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                <p className="text-[10px] font-extrabold uppercase text-violet-800 flex items-center gap-1.5">
                  <CalendarDays size={12} /> Unpaid Leaves
                </p>
                <MockInput label="Number of Days" value={employee.unpaidLeaveDays} />
                <MockReadout label="Deduction Amount" value={fmt(employee.unpaidLeaveDeduction)} accent="text-violet-900" />
                <p className="text-[9px] text-violet-700/80">Formula: day salary × unpaid days = {fmt(day)} × {employee.unpaidLeaveDays}</p>
              </div>
            </div>
          </SectionCard>

          {/* ── Loan ── */}
          <SectionCard
            title="Loan Deduction"
            subtitle="Manual entry by name — system identifies person across departments · shows total, paid & remaining"
            accent="orange"
          >
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <MockInput label="Employee Name (lookup)" value={employee.name} type="text" hint="Auto-match by name" />
              <MockInput label="Total Loan Amount" value={employee.loanTotal} />
              <MockInput label="Amount Already Paid" value={employee.loanPaid} />
              <MockReadout label="Remaining" value={fmt(employee.loanTotal - employee.loanPaid)} accent="text-orange-800" />
              <MockInput label="This Month Deduction" value={employee.loanThisMonth} hint="Optional field" />
            </div>
          </SectionCard>

          {/* ── PF & Tax ── */}
          <SectionCard
            title="Provident Fund & Tax"
            subtitle="PF = 8% of basic salary (automatic) · Income tax = manual amount"
            accent="teal"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MockReadout label="Basic Salary (PF base)" value={fmt(employee.basicSalary)} />
              <MockReadout label="PF (8% auto)" value={fmt(pf)} accent="text-teal-800" />
              <MockInput label="Income Tax (manual)" value={employee.incomeTax} />
            </div>
          </SectionCard>

          {/* ── Final Totals ── */}
          <SectionCard
            title="Final Salary Summary"
            subtitle="Total Earning − Total Deduction = Total Salary"
            accent="rose"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 space-y-2">
                <p className="text-[10px] font-extrabold uppercase text-emerald-800 flex items-center gap-1.5">
                  <DollarSign size={12} /> Total Earning
                </p>
                <div className="text-[11px] text-gray-600 space-y-1">
                  <p>Basic Salary: <strong>{fmt(employee.basicSalary)}</strong></p>
                  <p>Allowance: <strong>{fmt(employee.allowance)}</strong></p>
                  <p>Total Commission: <strong>{fmt(totalProjectPay)}</strong></p>
                  {variant === "team_lead" && assignedTlTotal > 0 && (
                    <p>TL Assigned CSR Commission: <strong>{fmt(assignedTlTotal)}</strong></p>
                  )}
                </div>
                <p className="text-lg font-extrabold text-emerald-800 tabular-nums border-t border-emerald-100 pt-2">
                  {fmt(totalEarning + (variant === "team_lead" ? assignedTlTotal : 0))}
                </p>
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50/20 p-3 space-y-2">
                <p className="text-[10px] font-extrabold uppercase text-red-700 flex items-center gap-1.5">
                  <Receipt size={12} /> Total Deduction
                </p>
                <div className="text-[11px] text-gray-600 space-y-1">
                  <p>Late Arrival: <strong>{fmt(employee.lateDeduction)}</strong></p>
                  <p>Unpaid Leaves: <strong>{fmt(employee.unpaidLeaveDeduction)}</strong></p>
                  <p>Loan (this month): <strong>{fmt(employee.loanThisMonth)}</strong></p>
                  <p>PF (8%): <strong>{fmt(pf)}</strong></p>
                  <p>Income Tax: <strong>{fmt(employee.incomeTax)}</strong></p>
                </div>
                <p className="text-lg font-extrabold text-red-700 tabular-nums border-t border-red-100 pt-2">{fmt(totalDeduction)}</p>
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-r from-[#B8112D] to-[#9a0e26] p-4 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Net Total Salary</p>
                <p className="text-2xl font-black tabular-nums">{fmt(netSalary + (variant === "team_lead" ? assignedTlTotal : 0))}</p>
              </div>
              <p className="text-[11px] text-white/80 max-w-xs">Total Earning − Total Deduction</p>
            </div>
          </SectionCard>

          {/* ── Remarks ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1.5 mb-1.5">
              <MessageSquare size={12} /> Remarks
            </label>
            <textarea
              defaultValue={employee.remarks}
              rows={2}
              placeholder="Manual remarks for this employee…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none resize-none focus:border-[#B8112D] focus:ring-2 focus:ring-[#B8112D]/15"
            />
          </div>
        </div>
      )}
    </article>
  );
}
