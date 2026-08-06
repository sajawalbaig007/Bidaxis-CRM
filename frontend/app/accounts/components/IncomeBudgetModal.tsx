"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PiggyBank, RefreshCw, Save, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import { currency } from "../types";
import AmountInput from "./AmountInput";
import {
  defaultPeriodFromToday,
  ensurePeriod,
  INCOME_BUDGET_STORE_DATE,
  lineTotal,
  mergeOpexSubsIntoPeriod,
  monthLabel,
  normalizeBudgetData,
  payrollKeys,
  predictNextPeriodBudget,
  shiftPeriod,
  threeMonthWindowFromStart,
  type BudgetLineKey,
  type BudgetPeriod,
  type IncomeBudgetData,
  upsertPeriod,
} from "../utils/incomeBudget";

type Props = {
  open: boolean;
  onClose: () => void;
};

type ActualsPayload = {
  byMonth?: Record<string, Partial<Record<string, number>>>;
  opexLines?: {
    key: string;
    label: string;
    headLabel?: string;
    subLabel?: string;
    months?: Record<string, number>;
  }[];
  daysRecorded: number;
};

export default function IncomeBudgetModal({ open, onClose }: Props) {
  const initial = defaultPeriodFromToday();
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [store, setStore] = useState<IncomeBudgetData>({ quarters: [] });
  const [period, setPeriod] = useState<BudgetPeriod>(() =>
    ensurePeriod(null, initial.fromDate, initial.toDate),
  );
  const [byMonthActuals, setByMonthActuals] = useState<
    Record<string, Partial<Record<string, number>>>
  >({});
  const [daysRecorded, setDaysRecorded] = useState(0);
  const [growthPct, setGrowthPct] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingActuals, setLoadingActuals] = useState(false);

  const monthKeys = period.monthKeys;
  const prediction = useMemo(
    () => predictNextPeriodBudget(period, byMonthActuals, growthPct),
    [period, byMonthActuals, growthPct],
  );

  const applyThreeMonthsFrom = useCallback((startDateOrYm: string, data?: IncomeBudgetData) => {
    const win = threeMonthWindowFromStart(startDateOrYm);
    setFromDate(win.fromDate);
    setToDate(win.toDate);
    setPeriod(ensurePeriod(data ?? store, win.fromDate, win.toDate));
  }, [store]);

  const loadStore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/accounts/income_budget/${INCOME_BUDGET_STORE_DATE}`);
      const data = normalizeBudgetData(res.data.data);
      setStore(data);
      setPeriod(prev => ensurePeriod(data, prev.fromDate, prev.toDate));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load budgets."));
      setStore({ quarters: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActuals = useCallback(async (from: string, to: string) => {
    setLoadingActuals(true);
    try {
      const res = await API.get(
        `/accounts/income-budget/actuals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const body = res.data as ActualsPayload;
      const monthly: Record<string, Partial<Record<string, number>>> = { ...(body.byMonth ?? {}) };
      for (const opex of body.opexLines ?? []) {
        for (const [ym, amt] of Object.entries(opex.months ?? {})) {
          if (!monthly[ym]) monthly[ym] = {};
          monthly[ym]![opex.key] = amt;
        }
      }
      setByMonthActuals(monthly);
      setDaysRecorded(Number(body.daysRecorded) || 0);
      setPeriod(prev => mergeOpexSubsIntoPeriod(prev, body.opexLines ?? []));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load Income Statement actuals."));
      setByMonthActuals({});
      setDaysRecorded(0);
    } finally {
      setLoadingActuals(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadStore();
  }, [open, loadStore]);

  useEffect(() => {
    if (!open) return;
    void loadActuals(fromDate, toDate);
  }, [open, fromDate, toDate, loadActuals]);

  const setMonthBudget = (key: BudgetLineKey, monthKey: string, value: number) => {
    setPeriod(prev => ({
      ...prev,
      lines: prev.lines.map(l =>
        l.key === key
          ? { ...l, months: { ...l.months, [monthKey]: Math.max(0, value) } }
          : l,
      ),
    }));
  };

  const fillFromActuals = () => {
    setPeriod(prev => ({
      ...prev,
      lines: prev.lines.map(l => {
        const months = { ...l.months };
        for (const mk of prev.monthKeys) {
          months[mk] = Math.max(0, Number(byMonthActuals[mk]?.[l.key]) || 0);
        }
        return { ...l, months };
      }),
    }));
    toast.success("Monthly budgets filled from Income Statement actuals.");
  };

  const save = async () => {
    setSaving(true);
    try {
      const nextStore = upsertPeriod(store, {
        ...period,
        fromDate,
        toDate,
        monthKeys,
        id: `${fromDate.slice(0, 7)}_${toDate.slice(0, 7)}`,
      });
      await API.put(`/accounts/income_budget/${INCOME_BUDGET_STORE_DATE}`, { data: nextStore });
      setStore(nextStore);
      toast.success("Budget saved.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save budget."));
    } finally {
      setSaving(false);
    }
  };

  const savePredictionAsNext = async () => {
    let nextPeriod = ensurePeriod(store, prediction.nextFrom, prediction.nextTo);
    nextPeriod = mergeOpexSubsIntoPeriod(
      nextPeriod,
      prediction.rows
        .filter(r => r.kind === "opex_sub")
        .map(r => ({ key: String(r.key), label: r.label })),
    );
    const withPred: BudgetPeriod = {
      ...nextPeriod,
      lines: nextPeriod.lines.map(l => {
        const row = prediction.rows.find(r => r.key === l.key);
        return { ...l, months: row?.months ?? l.months };
      }),
      notes: nextPeriod.notes || `Seeded from ${fromDate} → ${toDate} prediction`,
    };
    setSaving(true);
    try {
      const nextStore = upsertPeriod(store, withPred);
      await API.put(`/accounts/income_budget/${INCOME_BUDGET_STORE_DATE}`, { data: nextStore });
      setStore(nextStore);
      applyThreeMonthsFrom(prediction.nextFrom, nextStore);
      toast.success("Predicted budget saved for next 3 months.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to save next period."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const pk = payrollKeys();
  const coreLines = period.lines.filter(l => l.kind === "core");
  const opexLines = period.lines.filter(l => l.kind === "opex_sub");

  const sumBudgetKeys = (keys: Set<string>) =>
    period.lines.filter(l => keys.has(String(l.key))).reduce((a, l) => a + lineTotal(l), 0);
  const sumActualKeys = (keys: Set<string>) =>
    period.lines
      .filter(l => keys.has(String(l.key)))
      .reduce(
        (a, l) =>
          a + period.monthKeys.reduce((s, mk) => s + (Number(byMonthActuals[mk]?.[l.key]) || 0), 0),
        0,
      );

  const budgetPayroll = sumBudgetKeys(pk);
  const actualPayroll = sumActualKeys(pk);
  const budgetOpex = opexLines.reduce((a, l) => a + lineTotal(l), 0);
  const actualOpex = opexLines.reduce(
    (a, l) =>
      a + period.monthKeys.reduce((s, mk) => s + (Number(byMonthActuals[mk]?.[l.key]) || 0), 0),
    0,
  );
  const revLine = period.lines.find(l => l.key === "revenue");
  const budgetRev = revLine ? lineTotal(revLine) : 0;
  const actualRev = period.monthKeys.reduce((s, mk) => s + (Number(byMonthActuals[mk]?.revenue) || 0), 0);

  const renderLineRows = (lines: typeof period.lines) =>
    lines.map(line => {
      const actualTotal = monthKeys.reduce(
        (s, mk) => s + (Number(byMonthActuals[mk]?.[line.key]) || 0),
        0,
      );
      return (
        <tr key={line.key} className="border-b border-gray-50">
          <td className="px-3 py-2 font-semibold text-gray-800 sticky left-0 bg-white z-10">
            {line.label}
            {(line.key === "sales" || line.key === "technical") && (
              <span className="block text-[10px] font-normal text-gray-400">
                {line.key === "sales" ? "Sales Team + Lead" : "Technical Team + Manager"}
              </span>
            )}
            {line.kind === "opex_sub" && line.headLabel && line.subLabel !== line.headLabel && (
              <span className="block text-[10px] font-normal text-gray-400">{line.headLabel}</span>
            )}
          </td>
          {monthKeys.map(mk => (
            <Fragment key={`${line.key}-${mk}`}>
              <td className="px-1.5 py-1.5 align-top">
                <AmountInput
                  value={Number(line.months[mk]) || 0}
                  onChange={n => setMonthBudget(line.key, mk, n)}
                  className="h-8 w-[6.5rem] rounded-lg border border-gray-200 bg-white px-1.5 text-xs tabular-nums text-right outline-none focus:border-[#B8112D]"
                />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-xs text-gray-600 align-middle">
                {currency(Number(byMonthActuals[mk]?.[line.key]) || 0)}
              </td>
            </Fragment>
          ))}
          <td className="px-3 py-2 text-right font-bold tabular-nums">{currency(lineTotal(line))}</td>
          <td className="px-3 py-2 text-right tabular-nums text-gray-600">{currency(actualTotal)}</td>
        </tr>
      );
    });

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <header className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#FFF6F8] to-white">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#B8112D]/80 flex items-center gap-1.5">
              <PiggyBank size={12} /> 3-Month Budget
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
              Income Statement Budget Planner
            </h2>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              From date se pehla month choose karo — To date auto 3rd month end pe set hota hai. OPEX sub-heads included · Loans / PF excluded.
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

        <div className="px-4 sm:px-5 py-3 border-b border-gray-50 flex flex-wrap items-end gap-3 bg-[#FAFBFC]">
          <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            From date (month 1 start)
            <input
              type="date"
              value={fromDate}
              onChange={e => applyThreeMonthsFrom(e.target.value)}
              className="mt-1 h-10 block rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#B8112D]"
            />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            To date (month 3 end · auto)
            <input
              type="date"
              value={toDate}
              readOnly
              className="mt-1 h-10 block rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 cursor-default"
              title="Auto-set to end of the 3rd month from From date"
            />
          </label>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {monthKeys.map((mk, i) => (
              <span
                key={mk}
                className="inline-flex items-center h-8 px-2.5 rounded-lg bg-violet-50 text-violet-800 text-[11px] font-bold border border-violet-100"
              >
                M{i + 1}: {monthLabel(mk)}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const s = shiftPeriod(fromDate, toDate, -1);
              applyThreeMonthsFrom(s.fromDate);
            }}
            className="h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white"
          >
            ← Prev 3 mo
          </button>
          <button
            type="button"
            onClick={() => {
              const s = shiftPeriod(fromDate, toDate, 1);
              applyThreeMonthsFrom(s.fromDate);
            }}
            className="h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white"
          >
            Next 3 mo →
          </button>
          <button
            type="button"
            onClick={() => void loadActuals(fromDate, toDate)}
            disabled={loadingActuals}
            className="h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold text-sky-700 hover:bg-sky-50 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {loadingActuals ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh actuals
          </button>
          <button
            type="button"
            onClick={fillFromActuals}
            disabled={loadingActuals || daysRecorded === 0}
            className="h-10 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            Fill from actuals
          </button>
          <span className="text-[10px] text-gray-400 font-medium ml-auto pb-2">
            {daysRecorded} IS day(s) in range
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

              <section className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-3 py-2.5 bg-[#FAFBFC] border-b border-gray-100">
                  <p className="text-xs font-extrabold text-slate-800">
                    Revenue & team salaries · {fromDate} → {toDate}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[960px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400">
                        <th className="px-3 py-2 text-left font-bold sticky left-0 bg-[#FAFBFC] z-10">Category</th>
                        {monthKeys.map(mk => (
                          <th key={mk} className="px-2 py-2 text-center font-bold" colSpan={2}>
                            {monthLabel(mk)}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right font-bold">Total budget</th>
                        <th className="px-3 py-2 text-right font-bold">Total actual</th>
                      </tr>
                      <tr className="border-b border-gray-100 text-[9px] uppercase tracking-wide text-gray-400 bg-white">
                        <th className="px-3 py-1.5 sticky left-0 bg-white z-10" />
                        {monthKeys.map(mk => (
                          <Fragment key={`h-${mk}`}>
                            <th className="px-1 py-1 text-center font-bold">Budget</th>
                            <th className="px-1 py-1 text-center font-bold">Actual</th>
                          </Fragment>
                        ))}
                        <th />
                        <th />
                      </tr>
                    </thead>
                    <tbody>{renderLineRows(coreLines)}</tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
                <div className="px-3 py-2.5 bg-amber-50/80 border-b border-amber-100">
                  <p className="text-xs font-extrabold text-amber-900">
                    Operating Expenses — sub-heads ({opexLines.length})
                  </p>
                  <p className="text-[10px] text-amber-800/70 mt-0.5">
                    Har OPEX line Income Statement se aati hai. Loans / PF budget mein nahi.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  {opexLines.length === 0 ? (
                    <p className="px-3 py-8 text-center text-xs text-gray-400">
                      Is range mein koi OPEX sub-head actual nahi mila — pehle Income Statement mein OPEX fill karo, phir Refresh actuals.
                    </p>
                  ) : (
                    <table className="w-full text-sm min-w-[960px]">
                      <thead>
                        <tr className="border-b border-amber-100 text-[10px] uppercase tracking-wide text-amber-700/70">
                          <th className="px-3 py-2 text-left font-bold sticky left-0 bg-amber-50/80 z-10">OPEX line</th>
                          {monthKeys.map(mk => (
                            <th key={mk} className="px-2 py-2 text-center font-bold" colSpan={2}>
                              {monthLabel(mk)}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-bold">Total budget</th>
                          <th className="px-3 py-2 text-right font-bold">Total actual</th>
                        </tr>
                        <tr className="border-b border-amber-50 text-[9px] uppercase tracking-wide text-amber-700/50 bg-white">
                          <th className="px-3 py-1.5 sticky left-0 bg-white z-10" />
                          {monthKeys.map(mk => (
                            <Fragment key={`oh-${mk}`}>
                              <th className="px-1 py-1 text-center font-bold">Budget</th>
                              <th className="px-1 py-1 text-center font-bold">Actual</th>
                            </Fragment>
                          ))}
                          <th />
                          <th />
                        </tr>
                      </thead>
                      <tbody>{renderLineRows(opexLines)}</tbody>
                    </table>
                  )}
                </div>
                <div className="px-3 py-3 border-t border-amber-50">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Notes
                    <textarea
                      value={period.notes ?? ""}
                      onChange={e => setPeriod(p => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#B8112D] resize-none"
                      placeholder="Optional notes…"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-violet-100 overflow-hidden shadow-sm bg-violet-50/20">
                <div className="px-3 py-2.5 bg-violet-50/80 border-b border-violet-100 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-violet-900 inline-flex items-center gap-1.5">
                      <Sparkles size={14} /> Predicted next 3 months
                    </p>
                    <p className="text-[10px] text-violet-700/80 mt-0.5">
                      {prediction.nextFrom} → {prediction.nextTo}
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
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b border-violet-100 text-[10px] uppercase tracking-wide text-violet-400">
                        <th className="px-3 py-2 text-left font-bold">Category</th>
                        {prediction.nextMonths.map(mk => (
                          <th key={mk} className="px-3 py-2 text-right font-bold">{monthLabel(mk)}</th>
                        ))}
                        <th className="px-3 py-2 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prediction.rows.map(row => (
                        <tr key={row.key} className="border-b border-violet-50/80">
                          <td className="px-3 py-2 font-semibold text-gray-800">
                            {row.label}
                            {row.kind === "opex_sub" && (
                              <span className="ml-1 text-[9px] font-bold uppercase text-amber-600">OPEX</span>
                            )}
                          </td>
                          {prediction.nextMonths.map(mk => (
                            <td key={mk} className="px-3 py-2 text-right tabular-nums text-violet-800 font-semibold">
                              {currency(Number(row.months[mk]) || 0)}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right tabular-nums font-extrabold text-violet-900">
                            {currency(row.predictedTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
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
            onClick={() => void savePredictionAsNext()}
            disabled={saving || loading}
            className="h-10 px-4 rounded-xl border border-violet-200 bg-violet-50 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            Save prediction → next
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="h-10 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-bold hover:bg-[#9a0e26] disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save budget
          </button>
        </footer>
      </div>
    </div>
  );
}
