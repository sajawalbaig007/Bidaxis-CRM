"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PiggyBank, RefreshCw, Save, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import { currency } from "../types";
import AmountInput from "./AmountInput";
import {
  currentQuarterId,
  ensureQuarter,
  INCOME_BUDGET_STORE_DATE,
  nextQuarterId,
  predictNextQuarterBudget,
  prevQuarterId,
  payrollTotal,
  quarterLabel,
  type BudgetLineKey,
  type BudgetQuarter,
  type IncomeBudgetData,
  upsertQuarter,
} from "../utils/incomeBudget";

type Props = {
  open: boolean;
  onClose: () => void;
};

type ActualsPayload = {
  actuals: Partial<Record<BudgetLineKey, number>>;
  daysRecorded: number;
  totals: { payroll: number; totalExpense: number; netProfit: number };
};

export default function IncomeBudgetModal({ open, onClose }: Props) {
  const [quarterId, setQuarterId] = useState(currentQuarterId);
  const [store, setStore] = useState<IncomeBudgetData>({ quarters: [] });
  const [quarter, setQuarter] = useState<BudgetQuarter>(() => ensureQuarter(null, currentQuarterId()));
  const [actuals, setActuals] = useState<Partial<Record<BudgetLineKey, number>>>({});
  const [daysRecorded, setDaysRecorded] = useState(0);
  const [growthPct, setGrowthPct] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingActuals, setLoadingActuals] = useState(false);

  const nextId = nextQuarterId(quarterId);
  const predictions = useMemo(
    () => predictNextQuarterBudget(quarter.lines, actuals, growthPct),
    [quarter.lines, actuals, growthPct],
  );

  const loadStore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/accounts/income_budget/${INCOME_BUDGET_STORE_DATE}`);
      const data = (res.data.data as IncomeBudgetData) ?? { quarters: [] };
      setStore({ quarters: data.quarters ?? [] });
      setQuarter(ensureQuarter(data, quarterId));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load budgets."));
      setStore({ quarters: [] });
      setQuarter(ensureQuarter(null, quarterId));
    } finally {
      setLoading(false);
    }
  }, [quarterId]);

  const loadActuals = useCallback(async (qid: string) => {
    setLoadingActuals(true);
    try {
      const res = await API.get(`/accounts/income-budget/actuals?quarter=${encodeURIComponent(qid)}`);
      const body = res.data as ActualsPayload;
      setActuals(body.actuals ?? {});
      setDaysRecorded(Number(body.daysRecorded) || 0);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load Income Statement actuals."));
      setActuals({});
      setDaysRecorded(0);
    } finally {
      setLoadingActuals(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadStore();
    void loadActuals(quarterId);
  }, [open, loadStore, loadActuals, quarterId]);

  useEffect(() => {
    if (!open) return;
    setQuarter(ensureQuarter(store, quarterId));
  }, [quarterId, store, open]);

  const setLineBudget = (key: BudgetLineKey, budget: number) => {
    setQuarter(prev => ({
      ...prev,
      lines: prev.lines.map(l => (l.key === key ? { ...l, budget: Math.max(0, budget) } : l)),
    }));
  };

  const fillFromActuals = () => {
    setQuarter(prev => ({
      ...prev,
      lines: prev.lines.map(l => ({
        ...l,
        budget: Math.max(0, Number(actuals[l.key]) || 0),
      })),
    }));
    toast.success("Budget filled from Income Statement actuals.");
  };

  const applyPredictedAsNextBudget = async () => {
    const nextQ = ensureQuarter(store, nextId);
    const withPredicted: BudgetQuarter = {
      ...nextQ,
      lines: nextQ.lines.map(l => {
        const pred = predictions.find(p => p.key === l.key);
        return { ...l, budget: pred?.predictedBudget ?? l.budget };
      }),
      notes: nextQ.notes || `Seeded from ${quarterId} prediction`,
    };
    const nextStore = upsertQuarter(store, withPredicted);
    setSaving(true);
    try {
      await API.put(`/accounts/income_budget/${INCOME_BUDGET_STORE_DATE}`, { data: nextStore });
      setStore(nextStore);
      setQuarterId(nextId);
      toast.success(`Saved predicted budget for ${quarterLabel(nextId)}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save next-quarter budget."));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const nextStore = upsertQuarter(store, {
        ...quarter,
        id: quarterId,
        notes: quarter.notes ?? "",
      });
      await API.put(`/accounts/income_budget/${INCOME_BUDGET_STORE_DATE}`, { data: nextStore });
      setStore(nextStore);
      toast.success(`Budget saved for ${quarterLabel(quarterId)}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save budget."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const budgetPayroll = payrollTotal(quarter.lines.map(l => ({ key: l.key, budget: l.budget })), "budget");
  const actualPayroll = payrollTotal(
    quarter.lines.map(l => ({ key: l.key, actual: Number(actuals[l.key]) || 0 })),
    "actual",
  );
  const predPayroll = payrollTotal(predictions, "predictedBudget");
  const budgetOpex = quarter.lines.find(l => l.key === "opex")?.budget ?? 0;
  const actualOpex = Number(actuals.opex) || 0;
  const predOpex = predictions.find(p => p.key === "opex")?.predictedBudget ?? 0;
  const budgetRev = quarter.lines.find(l => l.key === "revenue")?.budget ?? 0;
  const actualRev = Number(actuals.revenue) || 0;
  const predRev = predictions.find(p => p.key === "revenue")?.predictedBudget ?? 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <header className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#FFF6F8] to-white">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B8112D]/80 flex items-center gap-1.5">
              <PiggyBank size={12} /> 3-Month Budget
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
              Income Statement Budget Planner
            </h2>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Sales Team + Lead = one budget · Technical Team + Manager = one budget. Set this quarter, then see the predicted budget for the next 3 months.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-gray-100 inline-flex items-center justify-center text-gray-500 shrink-0"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-4 sm:px-5 py-3 border-b border-gray-50 flex flex-wrap items-center gap-2 bg-[#FAFBFC]">
          <button
            type="button"
            onClick={() => setQuarterId(prevQuarterId(quarterId))}
            className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white"
          >
            ← Prev
          </button>
          <div className="h-9 px-3 rounded-xl bg-white border border-[#B8112D]/25 text-sm font-extrabold text-slate-800 inline-flex items-center tabular-nums">
            {quarterId} · {quarterLabel(quarterId)}
          </div>
          <button
            type="button"
            onClick={() => setQuarterId(nextQuarterId(quarterId))}
            className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={() => {
              void loadActuals(quarterId);
            }}
            disabled={loadingActuals}
            className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-bold text-sky-700 hover:bg-sky-50 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {loadingActuals ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh actuals
          </button>
          <button
            type="button"
            onClick={fillFromActuals}
            disabled={loadingActuals || daysRecorded === 0}
            className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            Fill budget from actuals
          </button>
          <span className="text-[10px] text-gray-400 font-medium ml-auto">
            {daysRecorded} IS day(s) in this quarter
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm inline-flex items-center gap-2 justify-center w-full">
              <Loader2 size={16} className="animate-spin" /> Loading budgets…
            </div>
          ) : (
            <>
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: "Budget revenue", value: budgetRev, cls: "text-violet-700" },
                  { label: "Actual revenue", value: actualRev, cls: "text-violet-900" },
                  { label: "Budget payroll", value: budgetPayroll, cls: "text-sky-700" },
                  { label: "Actual payroll", value: actualPayroll, cls: "text-sky-900" },
                  { label: "Budget OPEX", value: budgetOpex, cls: "text-amber-700" },
                  { label: "Actual OPEX", value: actualOpex, cls: "text-amber-900" },
                  { label: "Budget net*", value: budgetRev - budgetPayroll - budgetOpex, cls: "text-emerald-700" },
                  { label: "Actual net*", value: actualRev - actualPayroll - actualOpex, cls: "text-emerald-900" },
                ].map(c => (
                  <div key={c.label} className="rounded-xl border border-gray-100 bg-[#F8FAFC] px-3 py-2.5">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{c.label}</p>
                    <p className={`text-sm font-extrabold tabular-nums mt-0.5 ${c.cls}`}>{currency(c.value)}</p>
                  </div>
                ))}
              </section>
              <p className="text-[10px] text-gray-400 -mt-3">* Net = Revenue − (Payroll + OPEX). Loans / PF shown separately.</p>

              <section className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-3 py-2.5 bg-[#FAFBFC] border-b border-gray-100 flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-slate-800">This quarter — set budget</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400">
                        <th className="px-3 py-2 text-left font-bold">Category</th>
                        <th className="px-3 py-2 text-right font-bold">Actual (IS)</th>
                        <th className="px-3 py-2 text-right font-bold w-40">Budget</th>
                        <th className="px-3 py-2 text-right font-bold">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quarter.lines.map(line => {
                        const actual = Number(actuals[line.key]) || 0;
                        const variance = actual - line.budget;
                        return (
                          <tr key={line.key} className="border-b border-gray-50">
                            <td className="px-3 py-2.5 font-semibold text-gray-800">
                              {line.label}
                              {(line.key === "sales" || line.key === "technical") && (
                                <span className="block text-[10px] font-normal text-gray-400">
                                  {line.key === "sales" ? "Sales Team + Sales Team Lead" : "Technical Team + Technical Manager"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{currency(actual)}</td>
                            <td className="px-3 py-2.5">
                              <AmountInput
                                value={line.budget}
                                onChange={n => setLineBudget(line.key, n)}
                                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm tabular-nums text-right outline-none focus:border-[#B8112D]"
                              />
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right tabular-nums font-semibold ${
                                variance > 0 ? "text-amber-700" : variance < 0 ? "text-emerald-700" : "text-gray-400"
                              }`}
                            >
                              {currency(variance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-3 border-t border-gray-50">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Notes
                    <textarea
                      value={quarter.notes ?? ""}
                      onChange={e => setQuarter(q => ({ ...q, notes: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#B8112D] resize-none"
                      placeholder="Optional notes for this 3-month budget…"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-violet-100 overflow-hidden shadow-sm bg-violet-50/20">
                <div className="px-3 py-2.5 bg-violet-50/80 border-b border-violet-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-violet-900 inline-flex items-center gap-1.5">
                      <Sparkles size={14} /> Predicted budget — {nextId} ({quarterLabel(nextId)})
                    </p>
                    <p className="text-[10px] text-violet-700/80 mt-0.5">
                      Based on this quarter&apos;s budget vs Income Statement actuals (70% actual · 30% budget), then growth %.
                    </p>
                  </div>
                  <label className="text-[10px] font-bold uppercase text-violet-700 inline-flex items-center gap-2">
                    Growth %
                    <input
                      type="number"
                      step="0.5"
                      value={growthPct}
                      onChange={e => setGrowthPct(Number(e.target.value) || 0)}
                      className="h-8 w-20 rounded-lg border border-violet-200 bg-white px-2 text-sm tabular-nums outline-none"
                    />
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-violet-100 text-[10px] uppercase tracking-wide text-violet-400">
                        <th className="px-3 py-2 text-left font-bold">Category</th>
                        <th className="px-3 py-2 text-right font-bold">This budget</th>
                        <th className="px-3 py-2 text-right font-bold">Actual</th>
                        <th className="px-3 py-2 text-right font-bold">Predicted next</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map(row => (
                        <tr key={row.key} className="border-b border-violet-50/80">
                          <td className="px-3 py-2 font-semibold text-gray-800">{row.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{currency(row.budget)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{currency(row.actual)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-extrabold text-violet-800">
                            {currency(row.predictedBudget)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-violet-50/60 border-t border-violet-100">
                        <td className="px-3 py-2.5 font-extrabold text-violet-900 text-xs">Payroll + OPEX (expense)</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">
                          {currency(budgetPayroll + budgetOpex)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">
                          {currency(actualPayroll + actualOpex)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-violet-900 text-xs">
                          {currency(predPayroll + predOpex)}
                        </td>
                      </tr>
                      <tr className="bg-violet-50/60">
                        <td className="px-3 py-2.5 font-extrabold text-violet-900 text-xs">Predicted net (Rev − Exp)</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">
                          {currency(budgetRev - budgetPayroll - budgetOpex)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">
                          {currency(actualRev - actualPayroll - actualOpex)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-violet-900 text-xs">
                          {currency(predRev - predPayroll - predOpex)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="px-4 sm:px-5 py-3 border-t border-gray-100 bg-white flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void applyPredictedAsNextBudget()}
            disabled={saving || loading}
            className="h-10 px-4 rounded-xl border border-violet-200 bg-violet-50 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            Save prediction → {nextId}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="h-10 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-bold hover:bg-[#9a0e26] disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save this quarter
          </button>
        </footer>
      </div>
    </div>
  );
}
