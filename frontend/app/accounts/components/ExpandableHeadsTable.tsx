"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { DatedNote, SubHeadEntry } from "../types";
import { currency, lineAmount, normalizeNotes, newRowId, todayIso } from "../types";
import { computeAdminSalary, computeExecutiveSalary, computeSalary, computeTechnicalManagerSalary, emptySalaryDetail } from "../utils/payrollFormula";
import {
  resolvePayrollKind,
  resolveSubPayrollKind,
  payrollKindForTeamTitle,
  ensureSalesPayrollFromSub,
  tlExtraFromPeers,
  salesSubsFromPeerRows,
  normalizeSalesTeamSubs,
  isSalesTeamTitle,
} from "../utils/salesPayrollBridge";
import { computeSalesEmployeePayroll } from "../utils/salesPayrollFormula";
import AccountsNotesCell from "./AccountsNotesCell";
import HeadDetailModal, { type HeadDetailModel } from "./HeadDetailModal";
import ProofUploadField from "./ProofUploadField";
import SalarySlipDownloadButton from "./SalarySlipDownloadButton";
import { ensureSalaryDetail } from "./EmployeeSalaryEditor";
import type { SalarySlipCompanyKey } from "../utils/salarySlipCompanies";
import { DEFAULT_SALARY_SLIP_COMPANY } from "../utils/salarySlipCompanies";

export type ExpandableHeadRow = {
  id: string;
  title: string;
  amount: number;
  filledAt?: string;
  note?: string;
  subHeads?: SubHeadEntry[];
  notes?: DatedNote[];
};

type ExpandableHeadsTableProps = {
  title: string;
  accent?: string;
  rows: ExpandableHeadRow[];
  /** `opts.persist` asks the page to immediately save these rows to the DB. */
  onChange: (rows: ExpandableHeadRow[], opts?: { persist?: boolean }) => void;
  /** Save the whole record now (per-head / sub-head Save buttons). */
  onPersist?: () => void;
  saving?: boolean;
  addLabel?: string;
  emptyLabel?: string;
  allowProofUpload?: boolean;
  onUploadProof?: (file: File) => Promise<{ fileUrl: string; fileName: string }>;
  /** Team Salaries — full payroll editor in the edit modal. */
  salaryMode?: boolean;
  /** Net profit before executive salaries — commission base for Executive payroll. */
  execProfitBase?: number;
  /** Record date (YYYY-MM-DD) — salary slip month label. */
  recordDate?: string;
  /** Which company slip format to download (default BEM Solutions). */
  salarySlipCompany?: SalarySlipCompanyKey;
  /**
   * Custom sub-head delete. Return true if you already applied `nextRows`
   * (and any related clears); otherwise the table calls onChange itself.
   */
  onDeleteSubHead?: (args: {
    parent: ExpandableHeadRow;
    sub: SubHeadEntry;
    nextRows: ExpandableHeadRow[];
  }) => boolean | void;
};

export default function ExpandableHeadsTable({
  title,
  accent = "#0B84F3",
  rows,
  onChange,
  onPersist,
  saving = false,
  addLabel = "Add Head",
  emptyLabel = "No heads yet.",
  allowProofUpload = false,
  onUploadProof,
  salaryMode = false,
  execProfitBase = 0,
  recordDate = todayIso(),
  salarySlipCompany = DEFAULT_SALARY_SLIP_COMPANY,
  onDeleteSubHead,
}: ExpandableHeadsTableProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<HeadDetailModel | null>(null);

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addRow = () => {
    // Persist immediately so newly added heads survive reloads
    onChange(
      [
        ...rows,
        {
          id: newRowId("h"),
          title: "New Head",
          amount: 0,
          filledAt: todayIso(),
          subHeads: [],
          notes: [],
        },
      ],
      { persist: true },
    );
  };

  const saveEditing = (next: HeadDetailModel) => {
    setEditing(next);
    const salesPeers = salesSubsFromPeerRows(
      (next.payrollKind === "sales"
        ? rows.map(r =>
            r.id === next.id
              ? { title: next.title, subHeads: next.subHeads }
              : { title: r.title, subHeads: r.subHeads },
          )
        : rows.map(r => ({ title: r.title, subHeads: r.subHeads }))
      ),
    );
    // After sales / sales-lead edits, refresh lead nets so assigned TL commission lands in amount
    const nextRows = rows.map(r => {
      if (r.id === next.id) {
        const subHeads =
          next.payrollKind === "sales_lead"
            ? normalizeSalesTeamSubs(next.subHeads, next.title, salesPeers)
            : next.payrollKind === "sales"
              ? normalizeSalesTeamSubs(next.subHeads, next.title)
              : next.subHeads;
        return {
          ...r,
          title: next.title,
          amount: subHeads.length > 0
            ? subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0)
            : next.amount,
          filledAt: next.filledAt,
          note: next.notes[0]?.text ?? next.note,
          subHeads,
          notes: next.notes,
        };
      }
      if (salaryMode && resolvePayrollKind(r.title, r.subHeads) === "sales_lead") {
        const peers =
          next.payrollKind === "sales"
            ? next.subHeads
            : salesSubsFromPeerRows(rows.map(x => ({ title: x.title, subHeads: x.subHeads })));
        const subHeads = normalizeSalesTeamSubs(r.subHeads, r.title, peers);
        return {
          ...r,
          subHeads,
          amount: subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0),
        };
      }
      return r;
    });
    onChange(nextRows, { persist: true });
  };

  const deleteEditing = () => {
    if (!editing) return;
    onChange(rows.filter(r => r.id !== editing.id), { persist: true });
    setEditing(null);
  };

  const patchSubProof = (
    rowId: string,
    subId: string,
    proof: { proofUrl: string; proofName: string } | { proofUrl?: undefined; proofName?: undefined },
  ) => {
    onChange(
      rows.map(r =>
        r.id !== rowId
          ? r
          : {
              ...r,
              subHeads: (r.subHeads ?? []).map(s => (s.id === subId ? { ...s, ...proof } : s)),
            },
      ),
    );
  };

  const removeSubHead = (rowId: string, subId: string) => {
    const parent = rows.find(r => r.id === rowId);
    const removed = parent?.subHeads?.find(s => s.id === subId);
    if (!parent || !removed) return;
    const nextRows = rows.map(r => {
      if (r.id !== rowId) return r;
      const subHeads = (r.subHeads ?? []).filter(s => s.id !== subId);
      return {
        ...r,
        subHeads,
        amount: subHeads.length > 0 ? subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0) : 0,
      };
    });
    const handled = onDeleteSubHead?.({ parent, sub: removed, nextRows });
    if (!handled) onChange(nextRows, { persist: true });
  };

  const openEdit = (row: ExpandableHeadRow) => {
    const kind = salaryMode ? resolvePayrollKind(row.title, row.subHeads) : "technical";
    const isSales = kind === "sales" || kind === "sales_lead" || isSalesTeamTitle(row.title, row.subHeads);
    const salesPeers = salesSubsFromPeerRows(rows.map(r => ({ title: r.title, subHeads: r.subHeads })));
    const subHeads = isSales ? normalizeSalesTeamSubs(row.subHeads, row.title, salesPeers) : (row.subHeads ?? []);
    if (isSales) {
      onChange(
        rows.map(r =>
          r.id === row.id
            ? { ...r, subHeads, amount: subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0) }
            : r,
        ),
      );
    }
    setEditing({
      id: row.id,
      title: row.title,
      amount: row.amount,
      filledAt: row.filledAt ?? todayIso(),
      note: row.note,
      subHeads,
      notes: normalizeNotes(row.notes, row.note, row.filledAt),
      payrollKind: isSales ? (kind === "technical" ? payrollKindForTeamTitle(row.title) : kind) : kind,
    });
  };

  const total = rows.reduce((a, r) => a + lineAmount(r), 0);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100/90 overflow-hidden shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]">
      <div
        className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2"
        style={{ background: `linear-gradient(90deg, ${accent}12 0%, #ffffff 55%)` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: accent }} />
          <h2 className="font-extrabold text-gray-800 text-sm tracking-tight truncate">{title}</h2>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="h-8 px-3 rounded-xl text-[11px] font-bold text-white inline-flex items-center gap-1 shadow-sm hover:opacity-95 transition-opacity shrink-0"
          style={{ backgroundColor: accent }}
        >
          <Plus size={13} /> {addLabel}
        </button>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-[#FAFBFC]/95 backdrop-blur-sm">
            <tr className="border-b border-gray-200/80">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Head</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 min-w-[160px]">Notes</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 w-[100px]">Filled</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 w-[110px]">Total</th>
              <th className="w-24 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-gray-400 text-sm">{emptyLabel}</td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const expanded = openIds.has(row.id);
                const rowPayrollKind = salaryMode ? resolvePayrollKind(row.title, row.subHeads) : "technical";
                const isSalesRow =
                  salaryMode &&
                  (rowPayrollKind === "sales" ||
                    rowPayrollKind === "sales_lead" ||
                    isSalesTeamTitle(row.title, row.subHeads));
                const salesPeers = salesSubsFromPeerRows(rows);
                const subs = isSalesRow
                  ? normalizeSalesTeamSubs(row.subHeads, row.title, salesPeers)
                  : (row.subHeads ?? []);
                const amt = isSalesRow
                  ? subs.reduce((a, s) => a + (Number(s.amount) || 0), 0)
                  : lineAmount(row);
                return (
                  <Fragment key={row.id}>
                    <tr className={`border-b border-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-[#FCFCFD]"} hover:bg-[#F8FAFC]`}>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(row.id)}
                          className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 inline-flex items-center justify-center transition-colors"
                          title="Toggle individuals"
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">
                        {row.title}
                        {subs.length > 0 && (
                          <span
                            className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white/95"
                            style={{ backgroundColor: accent }}
                          >
                            {subs.length}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <AccountsNotesCell
                          notes={row.notes}
                          legacyNote={row.note}
                          fallbackDate={row.filledAt}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500 tabular-nums">{row.filledAt || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-gray-900">{currency(amt)}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          {onPersist && (
                            <button
                              type="button"
                              onClick={onPersist}
                              disabled={saving}
                              className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 inline-flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Save this head to the record"
                            >
                              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="w-8 h-8 rounded-lg text-[#0B84F3] hover:bg-[#EAF5FF] inline-flex items-center justify-center transition-colors"
                            title="Edit in popup"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onChange(rows.filter(r => r.id !== row.id), { persist: true })}
                            className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-[#F8FAFC]">
                        <td colSpan={6} className="px-4 py-2.5">
                          {subs.length === 0 ? (
                            <p className="text-[11px] text-gray-400 py-1">No individual heads — open Edit to add sub-heads.</p>
                          ) : salaryMode && rowPayrollKind === "executive" ? (
                            <div className="rounded-xl border border-indigo-100 overflow-x-auto bg-white shadow-sm">
                              <table className="w-full text-xs min-w-[860px]">
                                <thead>
                                  <tr className="border-b bg-indigo-50/60 text-gray-400">
                                    <th className="px-2 py-2 text-left font-bold uppercase tracking-wide text-[9px]">Executive</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Basic</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Comm. %</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Commission</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Total Salary</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Loan +ve</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Loan −ve</th>
                                    <th className="px-2 py-2 text-left font-bold uppercase tracking-wide text-[9px]">Remarks</th>
                                    <th className="w-10 px-1 py-2 text-center font-bold uppercase tracking-wide text-[9px]">Slip</th>
                                    {onPersist && <th className="w-10 px-1 py-2 text-center font-bold uppercase tracking-wide text-[9px]">Save</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {subs.map(s => {
                                    const sal = emptySalaryDetail(s.salary ?? { basic: s.amount });
                                    const ex = computeExecutiveSalary(sal, execProfitBase);
                                    return (
                                      <tr key={s.id} className="border-b border-gray-50 last:border-0">
                                        <td className="px-2 py-2 text-gray-700 font-medium whitespace-nowrap">{s.label}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{currency(ex.basic)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-indigo-700">{ex.commissionPct}%</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{currency(ex.commission)}</td>
                                        <td className="px-2 py-2 text-right font-bold tabular-nums text-[#B8112D]">{currency(ex.totalSalary)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{currency(ex.loanPositive)}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-red-600">{currency(ex.loanNegative)}</td>
                                        <td className="px-2 py-2 text-gray-500 max-w-[180px] truncate" title={sal.remarks || undefined}>{sal.remarks || "—"}</td>
                                        <td className="px-1 py-2 text-center">
                                          <SalarySlipDownloadButton
                                            compact
                                            sub={s}
                                            kind="executive"
                                            recordDate={recordDate}
                                            companyKey={salarySlipCompany}
                                            execProfitBase={execProfitBase}
                                          />
                                        </td>
                                        {onPersist && (
                                          <td className="px-1 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={onPersist}
                                              disabled={saving}
                                              className="w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 inline-flex items-center justify-center disabled:opacity-50"
                                              title="Save this row"
                                            >
                                              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <p className="px-3 py-1.5 text-[10px] text-gray-400 border-t">
                                {(() => {
                                  const base = Math.max(0, execProfitBase);
                                  const distributed = subs.reduce(
                                    (a, s) => a + computeExecutiveSalary(emptySalaryDetail(s.salary ?? { basic: s.amount }), execProfitBase).commission,
                                    0,
                                  );
                                  return `Net profit base: ${currency(base)} · Commissions distributed: ${currency(distributed)} · Remaining (company): ${currency(base - distributed)}`;
                                })()}
                              </p>
                            </div>
                          ) : salaryMode ? (
                            <div className="rounded-xl border border-gray-100 overflow-x-auto bg-white shadow-sm">
                              <table className="w-full text-xs min-w-[980px]">
                                <thead>
                                  <tr className="border-b bg-gray-50/80 text-gray-400">
                                    <th className="px-2 py-2 text-left font-bold uppercase tracking-wide text-[9px]">Employee</th>
                                    {isSalesRow ? (
                                      <>
                                        <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Commission</th>
                                        <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Basic</th>
                                        <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Allow.</th>
                                      </>
                                    ) : (
                                      <>
                                        <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Basic</th>
                                        <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Allow.</th>
                                        <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">OT</th>
                                        <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Earning</th>
                                      </>
                                    )}
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Late</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Unpaid</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Loan</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">PF</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Tax</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Deduct</th>
                                    <th className="px-2 py-2 text-right font-bold uppercase tracking-wide text-[9px]">Net</th>
                                    <th className="w-10 px-1 py-2 text-center font-bold uppercase tracking-wide text-[9px]">Slip</th>
                                    {onPersist && <th className="w-10 px-1 py-2 text-center font-bold uppercase tracking-wide text-[9px]">Save</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {subs.map(s => {
                                    if (isSalesRow) {
                                      const role = rowPayrollKind === "sales_lead" ? "team_lead" : "sales";
                                      const sp = ensureSalesPayrollFromSub(s, role);
                                      const extra = rowPayrollKind === "sales_lead" ? tlExtraFromPeers(s.id, salesPeers) : 0;
                                      const b = computeSalesEmployeePayroll(sp, extra);
                                      return (
                                        <tr key={s.id} className="border-b border-gray-50 last:border-0">
                                          <td className="px-2 py-2 text-gray-700 font-medium whitespace-nowrap">{s.label}</td>
                                          <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{currency(b.totalCommission + extra)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{currency(sp.basic)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{currency(sp.allowance)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{currency(b.lateDeduction)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{currency(b.unpaidLeaveDeduction)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{currency(sp.loanThisMonth)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{currency(b.pf)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums">{currency(sp.incomeTax)}</td>
                                          <td className="px-2 py-2 text-right tabular-nums text-red-600">{currency(b.totalDeduction)}</td>
                                          <td className="px-2 py-2 text-right font-bold tabular-nums text-[#B8112D]">{currency(b.netSalary)}</td>
                                          <td className="px-1 py-2 text-center">
                                            <SalarySlipDownloadButton
                                              compact
                                              sub={s}
                                              kind={rowPayrollKind === "sales_lead" ? "sales_lead" : "sales"}
                                              recordDate={recordDate}
                                              companyKey={salarySlipCompany}
                                              salesExtra={extra}
                                            />
                                          </td>
                                          {onPersist && (
                                            <td className="px-1 py-2 text-center">
                                              <button
                                                type="button"
                                                onClick={onPersist}
                                                disabled={saving}
                                                className="w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 inline-flex items-center justify-center disabled:opacity-50"
                                                title="Save this row"
                                              >
                                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    }
                                    const subKind = resolveSubPayrollKind(s, row.title, rowPayrollKind);
                                    const sal = s.salary ? ensureSalaryDetail(s.salary, s.amount) : null;
                                    const b = sal
                                      ? subKind === "admin"
                                        ? computeAdminSalary(sal)
                                        : subKind === "technical_manager"
                                          ? computeTechnicalManagerSalary(sal)
                                          : computeSalary(sal)
                                      : null;
                                    const slipKind =
                                      subKind === "admin"
                                        ? "admin"
                                        : subKind === "technical_manager"
                                          ? "technical_manager"
                                          : "technical";
                                    return (
                                      <tr key={s.id} className="border-b border-gray-50 last:border-0">
                                        <td className="px-2 py-2 text-gray-700 font-medium whitespace-nowrap">{s.label}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(sal!.basic) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(sal!.allowance) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(b.totalOvertime) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{b ? currency(b.totalEarning) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(b.lateDeduction) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(b.unpaidLeaveDeduction) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(b.loanThisMonth) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(b.pf) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums">{b ? currency(b.incomeTax) : "—"}</td>
                                        <td className="px-2 py-2 text-right tabular-nums text-red-600">{b ? currency(b.totalDeduction) : "—"}</td>
                                        <td className="px-2 py-2 text-right font-bold tabular-nums text-[#B8112D]">{currency(s.amount)}</td>
                                        <td className="px-1 py-2 text-center">
                                          <SalarySlipDownloadButton
                                            compact
                                            sub={s}
                                            kind={slipKind}
                                            recordDate={recordDate}
                                            companyKey={salarySlipCompany}
                                          />
                                        </td>
                                        {onPersist && (
                                          <td className="px-1 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={onPersist}
                                              disabled={saving}
                                              className="w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 inline-flex items-center justify-center disabled:opacity-50"
                                              title="Save this row"
                                            >
                                              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <p className="px-3 py-1.5 text-[10px] text-gray-400 border-t">
                                {allowProofUpload
                                  ? "Upload bill/screenshot per line · Preview anytime · Save record when done."
                                  : isSalesRow
                                    ? "Sales team: project commission · 6 PM shift · no overtime. Slip download = BEM Solutions format (more companies later)."
                                    : "Open Edit to fill payroll + Employee ID / CNIC for slips. Download = BEM Solutions format (more companies later)."}
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-gray-50/80 text-gray-400">
                                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Individual</th>
                                    <th className="px-3 py-2 text-center font-bold uppercase tracking-wide text-[10px] w-[110px]">Filled date</th>
                                    {allowProofUpload && (
                                      <th className="px-3 py-2 text-center font-bold uppercase tracking-wide text-[10px] w-[120px]">Image</th>
                                    )}
                                    <th className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px] w-[100px]">Amount</th>
                                    {onPersist && <th className="px-2 py-2 text-center font-bold uppercase tracking-wide text-[10px] w-[50px]">Save</th>}
                                    <th className="px-2 py-2 text-center font-bold uppercase tracking-wide text-[10px] w-[50px]">Del</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subs.map(s => (
                                    <tr key={s.id} className="border-b border-gray-50 last:border-0">
                                      <td className="px-3 py-2 text-gray-700 font-medium">{s.label}</td>
                                      <td className="px-3 py-2 text-center text-gray-500 tabular-nums">{s.filledAt || "—"}</td>
                                      {allowProofUpload && (
                                        <td className="px-3 py-2 text-center">
                                          <ProofUploadField
                                            compact
                                            proofUrl={s.proofUrl}
                                            proofName={s.proofName}
                                            disabled={!onUploadProof}
                                            onUpload={async file => {
                                              if (!onUploadProof) return;
                                              const uploaded = await onUploadProof(file);
                                              patchSubProof(row.id, s.id, {
                                                proofUrl: uploaded.fileUrl,
                                                proofName: uploaded.fileName,
                                              });
                                            }}
                                          />
                                        </td>
                                      )}
                                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-800">{currency(s.amount)}</td>
                                      {onPersist && (
                                        <td className="px-2 py-2 text-center">
                                          <button
                                            type="button"
                                            onClick={onPersist}
                                            disabled={saving}
                                            className="w-7 h-7 rounded-lg text-emerald-600 hover:bg-emerald-50 inline-flex items-center justify-center disabled:opacity-50"
                                            title="Save this row"
                                          >
                                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                          </button>
                                        </td>
                                      )}
                                      <td className="px-2 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => removeSubHead(row.id, s.id)}
                                          className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                                          title="Delete this line"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {allowProofUpload && (
                                <p className="px-3 py-1.5 text-[10px] text-gray-400 border-t">
                                  Upload bill/screenshot per line · Preview anytime · Save record when done.
                                </p>
                              )}
                            </div>
                          )}
                          {onPersist && subs.length > 0 && (
                            <div className="flex justify-end mt-2">
                              <button
                                type="button"
                                onClick={onPersist}
                                disabled={saving}
                                className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                                title="Save these sub-heads to the record"
                              >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Save Sub-heads
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2" style={{ borderColor: `${accent}33`, background: `${accent}0D` }}>
              <td colSpan={4} className="px-3 py-3.5 font-extrabold text-gray-800">Section Total</td>
              <td className="px-3 py-3.5 text-right font-extrabold tabular-nums text-base" style={{ color: accent }}>
                {currency(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <HeadDetailModal
        open={!!editing}
        title={`Edit — ${title}`}
        value={editing}
        onClose={() => setEditing(null)}
        onSave={saveEditing}
        onDelete={deleteEditing}
        allowProofUpload={allowProofUpload}
        onUploadProof={onUploadProof}
        salaryMode={salaryMode}
        saving={saving}
        execProfitBase={execProfitBase}
        recordDate={recordDate}
        salarySlipCompany={salarySlipCompany}
        payrollKind={editing?.payrollKind ?? (editing ? resolvePayrollKind(editing.title, editing.subHeads) : undefined)}
        peerTeamRows={rows.map(r => ({
          id: r.id,
          title: r.title,
          amount: r.amount,
          filledAt: r.filledAt,
          subHeads: r.subHeads ?? [],
          notes: normalizeNotes(r.notes, r.note, r.filledAt),
        }))}
      />
    </div>
  );
}
