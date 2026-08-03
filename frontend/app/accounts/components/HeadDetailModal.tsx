"use client";

import { useRef, useState } from "react";
import { Trash2, X, Plus, Save, StickyNote, Upload, ExternalLink, Loader2, ImageIcon, ChevronDown, ChevronRight } from "lucide-react";
import type { DatedNote, SubHeadEntry } from "../types";
import { currency, newRowId, sumSubHeads, todayIso } from "../types";
import { computeAdminSalary, computeExecutiveSalary, computeSalary, emptySalaryDetail } from "../utils/payrollFormula";
import EmployeeSalaryEditor, { ensureSalaryDetail } from "./EmployeeSalaryEditor";
import ExecutiveSalaryEditor from "./ExecutiveSalaryEditor";
import SalesPayrollEmployeeEditor from "./salesPayroll/SalesPayrollEmployeeEditor";
import {
  type PayrollKind,
  payrollKindForTeamTitle,
  resolvePayrollKind,
  ensureSalesPayrollFromSub,
  netFromSalesSub,
  tlExtraFromPeers,
  assignSalesSubToLead,
  emptySalesPayrollEmployee,
  salesSubsFromPeerRows,
  isSalesTeamTitle,
} from "../utils/salesPayrollBridge";
import type { SalesPayrollData } from "../utils/salesPayrollFormula";
import { HAMMAD_TEAM_LEAD_ID } from "../utils/salesPayrollDefaults";
import SalarySlipDownloadButton from "./SalarySlipDownloadButton";
import type { SalarySlipCompanyKey } from "../utils/salarySlipCompanies";
import { DEFAULT_SALARY_SLIP_COMPANY } from "../utils/salarySlipCompanies";
import AmountInput from "./AmountInput";

export type HeadDetailModel = {
  id: string;
  title: string;
  amount: number;
  filledAt?: string;
  note?: string;
  subHeads: SubHeadEntry[];
  notes: DatedNote[];
  /** Locked at open — sales vs technical payroll editor */
  payrollKind?: PayrollKind;
};

type HeadDetailModalProps = {
  open: boolean;
  title: string;
  value: HeadDetailModel | null;
  onClose: () => void;
  onSave: (next: HeadDetailModel) => void;
  onDelete: () => void;
  /** Enable per-line screenshot / payment proof upload (OPEX). */
  allowProofUpload?: boolean;
  onUploadProof?: (file: File) => Promise<{ fileUrl: string; fileName: string }>;
  /** Full payroll editor for Team Salaries people. */
  salaryMode?: boolean;
  payrollKind?: PayrollKind;
  /** All team rows (for sales assign / TL commission). */
  peerTeamRows?: HeadDetailModel[];
  /** Net profit before executive salaries — commission base for executive payroll. */
  execProfitBase?: number;
  /** Record is currently saving — per-row Save buttons show a spinner. */
  saving?: boolean;
  /** Date used for salary-slip month label. */
  recordDate?: string;
  /** Company slip format (BEM Solutions now; GPS/BDS later). */
  salarySlipCompany?: SalarySlipCompanyKey;
};

export default function HeadDetailModal({
  open,
  title,
  value,
  onClose,
  onSave,
  onDelete,
  allowProofUpload = false,
  onUploadProof,
  salaryMode = false,
  payrollKind: payrollKindProp,
  peerTeamRows = [],
  execProfitBase = 0,
  saving = false,
  recordDate = todayIso(),
  salarySlipCompany = DEFAULT_SALARY_SLIP_COMPANY,
}: HeadDetailModalProps) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [openSalaryIds, setOpenSalaryIds] = useState<Set<string>>(new Set());
  const [expandedForId, setExpandedForId] = useState<string | null>(null);

  // Adjust-during-render: auto-expand sales employees once per opened head
  if (!open && expandedForId !== null) {
    setExpandedForId(null);
  }
  if (open && value && value.id !== expandedForId) {
    setExpandedForId(value.id);
    if (value.subHeads.length && salaryMode) {
      const kind = value.payrollKind ?? resolvePayrollKind(value.title, value.subHeads);
      if (kind === "sales" || kind === "sales_lead") {
        setOpenSalaryIds(new Set(value.subHeads.map(s => s.id)));
      }
    }
  }

  if (!open || !value) return null;

  const payrollKind: PayrollKind =
    value.payrollKind ??
    payrollKindProp ??
    (salaryMode ? resolvePayrollKind(value.title, value.subHeads) : "technical");
  const isSalesPayroll =
    payrollKind === "sales" ||
    payrollKind === "sales_lead" ||
    (salaryMode && isSalesTeamTitle(value.title, value.subHeads)) ||
    (salaryMode && /sales team/i.test(value.title) && !/technical/i.test(value.title)) ||
    value.subHeads.some(s => !!s.salesPayroll);
  const salesPeers = salesSubsFromPeerRows(peerTeamRows.map(r => ({ title: r.title, subHeads: r.subHeads })));

  const salesPayrollContext = (): SalesPayrollData => ({
    salesTeamMembers: salesPeers.map(s => ensureSalesPayrollFromSub(s, "sales")),
    salesTeamLeads: peerTeamRows
      .filter(r => payrollKindForTeamTitle(r.title) === "sales_lead")
      .flatMap(r => (r.subHeads ?? []).map(sh => ensureSalesPayrollFromSub(sh, "team_lead"))),
  });

  const setField = <K extends keyof HeadDetailModel>(key: K, val: HeadDetailModel[K]) => {
    onSave({ ...value, [key]: val });
  };

  const updateSub = (id: string, patch: Partial<SubHeadEntry>) => {
    const subHeads = value.subHeads.map(s => (s.id === id ? { ...s, ...patch } : s));
    onSave({
      ...value,
      subHeads,
      amount: sumSubHeads(subHeads),
    });
  };

  const addSub = () => {
    const id = newRowId("sub");
    if (isSalesPayroll) {
      const role = payrollKind === "sales_lead" ? "team_lead" : "sales";
      const sp = emptySalesPayrollEmployee("New employee", role, 0, 0, id);
      const subHeads = [
        ...value.subHeads,
        { id, label: "New employee", amount: 0, filledAt: todayIso(), salesPayroll: sp },
      ];
      onSave({ ...value, subHeads, amount: sumSubHeads(subHeads) });
      setOpenSalaryIds(prev => new Set(prev).add(id));
      return;
    }
    const isAdminKind = payrollKind === "admin";
    const isExecKind = payrollKind === "executive";
    const salary = salaryMode
      ? isExecKind
        ? emptySalaryDetail({ commissionPct: 0, loanPositive: 0, loanNegative: 0 })
        : isAdminKind
          ? emptySalaryDetail({ checkIn: "18:00" })
          : ensureSalaryDetail(undefined, 0)
      : undefined;
    const amount = salary
      ? isExecKind
        ? computeExecutiveSalary(salary, execProfitBase).totalSalary
        : (isAdminKind ? computeAdminSalary(salary) : computeSalary(salary)).totalSalary
      : 0;
    const subHeads = [
      ...value.subHeads,
      {
        id,
        label: salaryMode ? "New employee" : "New person / line",
        amount,
        filledAt: todayIso(),
        ...(salary ? { salary } : {}),
      },
    ];
    onSave({
      ...value,
      subHeads,
      amount: sumSubHeads(subHeads),
    });
    if (salaryMode) setOpenSalaryIds(prev => new Set(prev).add(id));
  };

  const removeSub = (id: string) => {
    const subHeads = value.subHeads.filter(s => s.id !== id);
    onSave({
      ...value,
      subHeads,
      amount: subHeads.length > 0 ? sumSubHeads(subHeads) : value.amount,
    });
  };

  const handleProof = async (subId: string, file: File | undefined) => {
    if (!file || !onUploadProof) return;
    setUploadingId(subId);
    try {
      const uploaded = await onUploadProof(file);
      updateSub(subId, { proofUrl: uploaded.fileUrl, proofName: uploaded.fileName });
    } finally {
      setUploadingId(null);
    }
  };

  const addNote = () => {
    onSave({
      ...value,
      notes: [
        { id: newRowId("note"), text: "", date: todayIso() },
        ...value.notes,
      ],
    });
  };

  const updateNote = (id: string, patch: Partial<DatedNote>) => {
    onSave({
      ...value,
      notes: value.notes.map(n => (n.id === id ? { ...n, ...patch } : n)),
    });
  };

  const removeNote = (id: string) => {
    onSave({ ...value, notes: value.notes.filter(n => n.id !== id) });
  };

  /** Re-persist the current head (each sub-head row gets its own Save button). */
  const rowSaveBtn = (
    <button
      type="button"
      onClick={() => onSave(value)}
      disabled={saving}
      className="text-emerald-600 px-1 disabled:opacity-50"
      title="Save this row"
    >
      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
    </button>
  );

  const sortedNotes = [...value.notes].sort((a, b) => b.date.localeCompare(a.date));
  const toggleSalary = (id: string) => {
    setOpenSalaryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/40" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
          salaryMode ? "max-w-3xl" : "max-w-lg"
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b bg-[#F8FAFC] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
            {isSalesPayroll && salaryMode && (
              <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                Sales payroll — project commission · 6 PM shift · no overtime
              </p>
            )}
            {payrollKind === "executive" && salaryMode && (
              <p className="text-[10px] font-bold text-indigo-700 mt-0.5">
                Executive payroll — Basic + commission (% of net profit) = total salary
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <label className="text-xs font-semibold text-gray-600 block">
            Title
            <input
              value={value.title}
              onChange={e => setField("title", e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-600 block">
              {value.subHeads.length > 0 ? "Total (auto from people / lines)" : "Total (add people/lines or set here)"}
              {value.subHeads.length > 0 ? (
                <input
                  type="text"
                  readOnly
                  value={String(sumSubHeads(value.subHeads))}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm bg-[#F8FAFC] text-gray-600 cursor-default"
                />
              ) : (
                <AmountInput
                  value={Number(value.amount) || 0}
                  onChange={n => setField("amount", n)}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
                />
              )}
            </label>
            <label className="text-xs font-semibold text-gray-600 block">
              Filled date
              <input
                type="date"
                value={value.filledAt ?? todayIso()}
                onChange={e => setField("filledAt", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700 inline-flex items-center gap-1.5">
                <StickyNote size={13} className="text-amber-500" /> Notes (by date)
              </p>
              <button type="button" onClick={addNote} className="text-[11px] font-bold text-amber-700 inline-flex items-center gap-1">
                <Plus size={12} /> Add note
              </button>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {sortedNotes.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-3 text-center border border-dashed border-amber-200 rounded-xl bg-amber-50/40">
                  No notes yet — add one with a date.
                </p>
              ) : (
                sortedNotes.map(n => (
                  <div key={n.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={n.date}
                        onChange={e => updateNote(n.id, { date: e.target.value })}
                        className="h-8 rounded-lg border border-amber-200 bg-white px-2 text-[11px]"
                      />
                      <button type="button" onClick={() => removeNote(n.id)} className="ml-auto text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <textarea
                      value={n.text}
                      onChange={e => updateNote(n.id, { text: e.target.value })}
                      rows={2}
                      placeholder="Note…"
                      className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs outline-none resize-none"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700">
                {salaryMode ? "Employees (full payroll)" : "People / line items"}
              </p>
              <button type="button" onClick={addSub} className="text-[11px] font-bold text-[#0B84F3]">
                + {salaryMode ? "Add employee" : "Add person / line"}
              </button>
            </div>

            <div className={`space-y-2 ${salaryMode ? "max-h-[55vh]" : "max-h-64"} overflow-y-auto`}>
              {value.subHeads.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-3 text-center border border-dashed rounded-xl">
                  No people yet — total uses the amount above.
                </p>
              ) : salaryMode ? (
                value.subHeads.map(s => {
                  const openEd = openSalaryIds.has(s.id);
                  const subKind = salaryMode ? resolvePayrollKind(value.title, [s]) : "technical";
                  const subIsSales =
                    isSalesPayroll ||
                    !!s.salesPayroll ||
                    subKind === "sales" ||
                    subKind === "sales_lead";
                  if (subIsSales) {
                    const role =
                      payrollKind === "sales_lead" || s.salesPayroll?.role === "team_lead"
                        ? "team_lead"
                        : "sales";
                    const sp = ensureSalesPayrollFromSub(s, role);
                    const extra =
                      payrollKind === "sales_lead" ? tlExtraFromPeers(s.id, salesPeers) : 0;
                    const net = netFromSalesSub({ ...s, salesPayroll: sp }, role, extra);
                    return (
                      <div key={s.id} className="rounded-xl border border-emerald-200 overflow-hidden">
                        <div className="flex items-center gap-2 px-2.5 py-2 bg-[#ECFDF3]">
                          <button type="button" onClick={() => toggleSalary(s.id)} className="text-gray-500">
                            {openEd ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <input
                            value={s.label}
                            onChange={e => updateSub(s.id, { label: e.target.value })}
                            className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold"
                            placeholder="Employee name"
                          />
                          <span className="text-xs font-bold tabular-nums text-[#B8112D] whitespace-nowrap">{currency(net)}</span>
                          <SalarySlipDownloadButton
                            sub={s}
                            kind={payrollKind === "sales_lead" ? "sales_lead" : "sales"}
                            recordDate={recordDate}
                            companyKey={salarySlipCompany}
                            salesExtra={extra}
                          />
                          {rowSaveBtn}
                          <button type="button" onClick={() => removeSub(s.id)} className="text-red-500 px-1">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {openEd && (
                          <div className="p-2 border-t border-emerald-100">
                            <SalesPayrollEmployeeEditor
                              employee={{ ...sp, name: s.label }}
                              variant={payrollKind === "sales_lead" ? "team_lead" : "sales"}
                              allData={salesPayrollContext()}
                              embedded
                              defaultOpen
                              onChange={next => {
                                const amount = netFromSalesSub(
                                  { ...s, salesPayroll: next, label: next.name },
                                  role,
                                  payrollKind === "sales_lead" ? tlExtraFromPeers(s.id, salesPeers) : 0,
                                );
                                updateSub(s.id, {
                                  label: next.name,
                                  salesPayroll: next,
                                  amount,
                                  salary: undefined,
                                });
                              }}
                              onAssignToLead={
                                payrollKind === "sales"
                                  ? () => {
                                      const assigned = assignSalesSubToLead(s, HAMMAD_TEAM_LEAD_ID);
                                      const sp2 = ensureSalesPayrollFromSub(assigned, "sales");
                                      updateSub(s.id, {
                                        salesPayroll: sp2,
                                        amount: netFromSalesSub({ ...assigned, salesPayroll: sp2 }, "sales"),
                                        salary: undefined,
                                      });
                                    }
                                  : undefined
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (payrollKind === "executive") {
                    const sal = emptySalaryDetail({
                      ...(s.salary ?? { basic: s.amount }),
                    });
                    const exec = computeExecutiveSalary(sal, execProfitBase);
                    return (
                      <div key={s.id} className="rounded-xl border border-indigo-200 overflow-hidden">
                        <div className="flex items-center gap-2 px-2.5 py-2 bg-indigo-50/60">
                          <button type="button" onClick={() => toggleSalary(s.id)} className="text-gray-500">
                            {openEd ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <input
                            value={s.label}
                            onChange={e => updateSub(s.id, { label: e.target.value })}
                            className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold"
                            placeholder="Executive name"
                          />
                          <span className="text-[10px] font-bold text-indigo-600 whitespace-nowrap">{exec.commissionPct}%</span>
                          <span className="text-xs font-bold tabular-nums text-[#B8112D] whitespace-nowrap">{currency(exec.totalSalary)}</span>
                          <SalarySlipDownloadButton
                            sub={s}
                            kind="executive"
                            recordDate={recordDate}
                            companyKey={salarySlipCompany}
                            execProfitBase={execProfitBase}
                          />
                          {rowSaveBtn}
                          <button type="button" onClick={() => removeSub(s.id)} className="text-red-500 px-1">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {openEd && (
                          <div className="p-2 border-t border-indigo-100">
                            <ExecutiveSalaryEditor
                              name={s.label}
                              teamHint={value.title}
                              value={sal}
                              profitBase={execProfitBase}
                              onChange={next => {
                                const total = computeExecutiveSalary(next, execProfitBase).totalSalary;
                                updateSub(s.id, { salary: next, amount: total });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }
                  const isAdminSub = payrollKind === "admin";
                  const sal = isAdminSub
                    ? emptySalaryDetail({
                        ...(s.salary ?? { basic: s.amount }),
                        checkIn: s.salary?.checkIn || "18:00",
                      })
                    : ensureSalaryDetail(s.salary, s.amount);
                  const net = (isAdminSub ? computeAdminSalary(sal) : computeSalary(sal)).totalSalary;
                  return (
                    <div key={s.id} className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-2.5 py-2 bg-[#F8FAFC]">
                        <button type="button" onClick={() => toggleSalary(s.id)} className="text-gray-500">
                          {openEd ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <input
                          value={s.label}
                          onChange={e => updateSub(s.id, { label: e.target.value })}
                          className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold"
                          placeholder="Employee name"
                        />
                        <span className="text-xs font-bold tabular-nums text-[#B8112D] whitespace-nowrap">{currency(net)}</span>
                        <SalarySlipDownloadButton
                          sub={s}
                          kind={isAdminSub ? "admin" : "technical"}
                          recordDate={recordDate}
                          companyKey={salarySlipCompany}
                        />
                        {rowSaveBtn}
                        <button type="button" onClick={() => removeSub(s.id)} className="text-red-500 px-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {openEd && (
                        <div className="p-2 border-t border-gray-100">
                          <EmployeeSalaryEditor
                            name={s.label}
                            teamHint={value.title}
                            value={sal}
                            variant={isAdminSub ? "admin" : "technical"}
                            onChange={next => {
                              const total = (isAdminSub ? computeAdminSalary(next) : computeSalary(next)).totalSalary;
                              updateSub(s.id, { salary: next, amount: total });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                value.subHeads.map(s => (
                  <div key={s.id} className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-2 space-y-1.5">
                    <div className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        value={s.label}
                        onChange={e => updateSub(s.id, { label: e.target.value })}
                        className="col-span-4 h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white"
                        placeholder="Label"
                      />
                      <AmountInput
                        value={Number(s.amount) || 0}
                        onChange={n => updateSub(s.id, { amount: n })}
                        className="col-span-3 h-8 rounded-lg border border-gray-200 px-2 text-xs text-right bg-white"
                      />
                      <input
                        type="date"
                        value={s.filledAt}
                        onChange={e => updateSub(s.id, { filledAt: e.target.value })}
                        className="col-span-3 h-8 rounded-lg border border-gray-200 px-1 text-[10px] bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => onSave(value)}
                        disabled={saving}
                        className="col-span-1 text-emerald-600 flex justify-center disabled:opacity-50"
                        title="Save this row"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      </button>
                      <button type="button" onClick={() => removeSub(s.id)} className="col-span-1 text-red-500 flex justify-center">
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {allowProofUpload && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={el => { fileRefs.current[s.id] = el; }}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            void handleProof(s.id, f);
                          }}
                        />
                        <button
                          type="button"
                          disabled={uploadingId === s.id || !onUploadProof}
                          onClick={() => fileRefs.current[s.id]?.click()}
                          className="h-7 px-2.5 rounded-lg bg-white border border-gray-200 text-[10px] font-bold text-gray-600 inline-flex items-center gap-1 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {uploadingId === s.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <Upload size={11} />}
                          {s.proofUrl ? "Replace proof" : "Upload screenshot"}
                        </button>
                        {s.proofUrl && (
                          <>
                            <a
                              href={s.proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="h-7 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1"
                              title={s.proofName || "View proof"}
                            >
                              <ImageIcon size={11} />
                              View
                              <ExternalLink size={10} />
                            </a>
                            <button
                              type="button"
                              onClick={() => updateSub(s.id, { proofUrl: undefined, proofName: undefined })}
                              className="h-7 px-2 rounded-lg text-[10px] font-bold text-red-500 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {value.subHeads.length > 0 && (
              <p className="text-[11px] text-gray-500 mt-2 font-semibold">
                Team / section sum: {currency(value.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0))}
              </p>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between gap-2 bg-[#FAFAFA]">
          <button
            type="button"
            onClick={() => { onDelete(); onClose(); }}
            className="h-9 px-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-[#B8112D] text-white hover:bg-[#9a0e26]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
