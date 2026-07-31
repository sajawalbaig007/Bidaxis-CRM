"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, PieChart as PieIcon, LayoutDashboard } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import API from "@/lib/api";
import AccountsSidebar from "./components/layout/Sidebar";
import AccountsPageShell from "./components/AccountsPageShell";
import AccountsChartCard from "./components/AccountsChartCard";
import CurrencyFormulaModal from "./components/CurrencyFormulaModal";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { accountsShellProps } from "./utils/accountsShellProps";
import { useAccountsPage } from "./hooks/useAccountsPage";
import type { CurrencyTabKey, DashboardCurrency, DashboardCurrencyTab, DashboardData } from "./types";
import { CURRENCY_TAB_LABELS, CURRENCY_TAB_SHORT, currency, isLocalPaymentTab, todayIso } from "./types";

const TAB_DEFAULTS: Record<CurrencyTabKey, DashboardCurrencyTab> = {
  // Ahmed Hamza — USD/CAD × 0.89 → × FX (example USD rate 285)
  AH: {
    usdAmount: 0,
    cadAmount: 0,
    pkrAmount: 0,
    usdToPkrRate: 285,
    cadToPkrRate: 204,
    usdTaxFactor: 0.89,
    cadTaxFactor: 0.89,
  },
  // Sharjeel Nasir — CAD × 0.945 → × 196
  SN: {
    usdAmount: 0,
    cadAmount: 0,
    pkrAmount: 0,
    usdToPkrRate: 285,
    cadToPkrRate: 196,
    usdTaxFactor: 0.89,
    cadTaxFactor: 0.945,
  },
  // Cheque payment — 25% tax deduction on PKR gross
  CHQ: {
    usdAmount: 0,
    cadAmount: 0,
    pkrAmount: 0,
    usdToPkrRate: 1,
    cadToPkrRate: 1,
    usdTaxFactor: 1,
    cadTaxFactor: 1,
    taxDeductionRate: 0.25,
  },
  // Direct payment Habib Metro — 1% tax deduction on PKR gross
  HM: {
    usdAmount: 0,
    cadAmount: 0,
    pkrAmount: 0,
    usdToPkrRate: 1,
    cadToPkrRate: 1,
    usdTaxFactor: 1,
    cadTaxFactor: 1,
    taxDeductionRate: 0.01,
  },
};

function defaultData(): DashboardData {
  return {
    currency: {
      tabs: {
        SN: { ...TAB_DEFAULTS.SN },
        AH: { ...TAB_DEFAULTS.AH },
        CHQ: { ...TAB_DEFAULTS.CHQ },
        HM: { ...TAB_DEFAULTS.HM },
      },
    },
  };
}

/** Migrate older single-block currency saves into SN/AH/CHQ/HM tabs. */
function normalizeCurrency(raw: DashboardCurrency | undefined): DashboardCurrency {
  const base = defaultData().currency;
  if (!raw) return base;

  const mergeFx = (key: "AH" | "SN", locked: Partial<DashboardCurrencyTab>) => ({
    ...TAB_DEFAULTS[key],
    ...(raw.tabs?.[key] ?? {}),
    ...locked,
  });

  if (raw.tabs?.SN && raw.tabs?.AH) {
    return {
      tabs: {
        AH: mergeFx("AH", { usdTaxFactor: 0.89, cadTaxFactor: 0.89 }),
        SN: mergeFx("SN", { cadTaxFactor: 0.945 }),
        CHQ: {
          ...TAB_DEFAULTS.CHQ,
          ...(raw.tabs.CHQ ?? {}),
          taxDeductionRate: 0.25,
          usdAmount: 0,
          cadAmount: 0,
        },
        HM: {
          ...TAB_DEFAULTS.HM,
          ...(raw.tabs.HM ?? {}),
          taxDeductionRate: 0.01,
          usdAmount: 0,
          cadAmount: 0,
        },
      },
    };
  }

  // Legacy flat shape → put amounts on SN, keep others defaults
  return {
    tabs: {
      SN: {
        ...TAB_DEFAULTS.SN,
        usdAmount: raw.usdAmount ?? TAB_DEFAULTS.SN.usdAmount,
        cadAmount: raw.cadAmount ?? TAB_DEFAULTS.SN.cadAmount,
        pkrAmount: raw.pkrAmount ?? TAB_DEFAULTS.SN.pkrAmount,
        usdToPkrRate: raw.usdToPkrRate ?? TAB_DEFAULTS.SN.usdToPkrRate,
        cadToPkrRate: raw.cadToPkrRate ?? TAB_DEFAULTS.SN.cadToPkrRate,
      },
      AH: { ...TAB_DEFAULTS.AH },
      CHQ: { ...TAB_DEFAULTS.CHQ },
      HM: { ...TAB_DEFAULTS.HM },
    },
  };
}

type TabCalc = {
  usdAfterTax: number;
  cadAfterTax: number;
  usdInPkr: number;
  cadInPkr: number;
  pkrGross: number;
  pkrTax: number;
  pkrNet: number;
  total: number;
};

function calcTab(t: DashboardCurrencyTab): TabCalc {
  const rate = Number(t.taxDeductionRate);
  if (Number.isFinite(rate) && rate > 0) {
    const pkrGross = Number(t.pkrAmount) || 0;
    const pkrTax = pkrGross * rate;
    const pkrNet = pkrGross - pkrTax;
    return {
      usdAfterTax: 0,
      cadAfterTax: 0,
      usdInPkr: 0,
      cadInPkr: 0,
      pkrGross,
      pkrTax,
      pkrNet,
      total: pkrNet,
    };
  }

  const usdAfterTax = t.usdAmount * t.usdTaxFactor;
  const cadAfterTax = t.cadAmount * t.cadTaxFactor;
  const usdInPkr = usdAfterTax * t.usdToPkrRate;
  const cadInPkr = cadAfterTax * t.cadToPkrRate;
  const pkrNet = Number(t.pkrAmount) || 0;
  return {
    usdAfterTax,
    cadAfterTax,
    usdInPkr,
    cadInPkr,
    pkrGross: pkrNet,
    pkrTax: 0,
    pkrNet,
    total: usdInPkr + cadInPkr + pkrNet,
  };
}

type Summary = {
  balanceSheetTotalAssets?: number;
  balanceSheetTotalEquity?: number;
  balanceSheetTotalLiabilities?: number;
  balanceSheetEquityLiabilities?: number;
  balanceSheetDifference?: number;
  incomeNetProfit?: number;
  cashFlowNet?: number;
  totalAssetsRegister?: number;
};

type ViewTab = CurrencyTabKey | "ALL";

export default function AccountsDashboardPage() {
  const acc = useAccountsPage<DashboardData>({ page: "dashboard", defaultData });
  const [summaries, setSummaries] = useState<Summary>({});
  const [viewTab, setViewTab] = useState<ViewTab>("AH");
  const [formulaOpen, setFormulaOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get(`/accounts/dashboard/summary?date=${acc.recordDate}`);
        if (!cancelled) setSummaries(res.data.summaries ?? {});
      } catch {
        if (!cancelled) setSummaries({});
      }
    })();
    return () => { cancelled = true; };
  }, [acc.recordDate, acc.dirty, acc.saving]);

  const currencyData = normalizeCurrency(acc.data.currency);
  const sn = currencyData.tabs.SN;
  const ah = currencyData.tabs.AH;
  const chq = currencyData.tabs.CHQ;
  const hm = currencyData.tabs.HM;
  const snCalc = calcTab(sn);
  const ahCalc = calcTab(ah);
  const chqCalc = calcTab(chq);
  const hmCalc = calcTab(hm);

  const activeKey: CurrencyTabKey = viewTab === "ALL" ? "AH" : viewTab;
  const active = currencyData.tabs[activeKey];
  const activeCalc = calcTab(active);

  const displayCalc = viewTab === "ALL"
    ? {
        usdAfterTax: snCalc.usdAfterTax + ahCalc.usdAfterTax,
        cadAfterTax: snCalc.cadAfterTax + ahCalc.cadAfterTax,
        usdInPkr: snCalc.usdInPkr + ahCalc.usdInPkr,
        cadInPkr: snCalc.cadInPkr + ahCalc.cadInPkr,
        pkrGross: snCalc.pkrGross + ahCalc.pkrGross + chqCalc.pkrGross + hmCalc.pkrGross,
        pkrTax: snCalc.pkrTax + ahCalc.pkrTax + chqCalc.pkrTax + hmCalc.pkrTax,
        pkrNet: snCalc.pkrNet + ahCalc.pkrNet + chqCalc.pkrNet + hmCalc.pkrNet,
        total: snCalc.total + ahCalc.total + chqCalc.total + hmCalc.total,
        pkrAmount: snCalc.pkrNet + ahCalc.pkrNet + chqCalc.pkrNet + hmCalc.pkrNet,
      }
    : { ...activeCalc, pkrAmount: activeCalc.pkrNet };

  const paymentSummary = useMemo(() => {
    if (viewTab === "ALL") {
      return [
        { name: "Ahmed", amount: ahCalc.total, color: "#B8112D" },
        { name: "Sharjeel", amount: snCalc.total, color: "#0B84F3" },
        { name: "Cheque", amount: chqCalc.total, color: "#F59E0B" },
        { name: "Habib", amount: hmCalc.total, color: "#0D9488" },
      ];
    }
    if (isLocalPaymentTab(viewTab)) {
      return [
        { name: "Gross", amount: activeCalc.pkrGross, color: "#64748B" },
        { name: "Tax", amount: activeCalc.pkrTax, color: "#EF4444" },
        { name: "Net", amount: activeCalc.pkrNet, color: "#12B76A" },
      ];
    }
    return [
      { name: "USD", amount: displayCalc.usdInPkr, color: "#0B84F3" },
      { name: "CAD", amount: displayCalc.cadInPkr, color: "#0D9488" },
      { name: "PKR", amount: displayCalc.pkrAmount, color: "#12B76A" },
    ];
  }, [viewTab, ahCalc.total, snCalc.total, chqCalc.total, hmCalc.total, activeCalc, displayCalc.usdInPkr, displayCalc.cadInPkr, displayCalc.pkrAmount]);

  const bsAssets = summaries.balanceSheetTotalAssets ?? 0;
  const bsEquityLiab = summaries.balanceSheetEquityLiabilities
    ?? ((summaries.balanceSheetTotalEquity ?? 0) + (summaries.balanceSheetTotalLiabilities ?? 0));
  const bsDiff = summaries.balanceSheetDifference ?? (bsAssets - bsEquityLiab);
  const bsBalanced = Math.abs(bsDiff) < 1 && bsAssets > 0;

  const metrics = [
    { label: "BS Total Assets", value: bsAssets, color: "from-[#0B84F3] to-[#0369A1]", hint: "Must equal Equity + Liabilities" },
    { label: "BS Equity + Liabilities", value: bsEquityLiab, color: "from-[#0D9488] to-[#0F766E]", hint: `Equity ${currency(summaries.balanceSheetTotalEquity ?? 0)} · Liab ${currency(summaries.balanceSheetTotalLiabilities ?? 0)}` },
    { label: bsBalanced ? "BS Balanced (Diff 0)" : "BS Difference (A − E−L)", value: bsDiff, color: bsBalanced ? "from-[#12B76A] to-[#027A48]" : "from-[#F59E0B] to-[#B45309]", hint: bsBalanced ? "Assets = Equity + Liabilities" : "Should be zero when balanced" },
    { label: "Income Statement Net Profit", value: summaries.incomeNetProfit ?? 0, color: "from-[#12B76A] to-[#027A48]" },
    { label: "Cash Flow Net Amount", value: summaries.cashFlowNet ?? 0, color: "from-[#B8112D] to-[#8b0d22]" },
  ];

  const ensureNormalized = (prev: DashboardData): DashboardCurrency =>
    normalizeCurrency(prev.currency);

  const setTabField = (tab: CurrencyTabKey, key: keyof DashboardCurrencyTab, val: number) => {
    acc.setData(prev => {
      const tabs = ensureNormalized(prev).tabs;
      const locked =
        tab === "CHQ"
          ? { taxDeductionRate: 0.25 as const }
          : tab === "HM"
            ? { taxDeductionRate: 0.01 as const }
            : tab === "AH"
              ? { usdTaxFactor: 0.89, cadTaxFactor: 0.89 }
              : tab === "SN"
                ? { cadTaxFactor: 0.945 }
                : {};
      return {
        ...prev,
        currency: {
          tabs: {
            ...tabs,
            [tab]: { ...tabs[tab], [key]: val, ...locked },
          },
        },
      };
    });
  };

  const formulaNote =
    viewTab === "AH"
      ? "Ahmed Hamza: USD/CAD × 0.89 = after tax → × international FX rate = PKR received."
      : viewTab === "SN"
        ? "Sharjeel Nasir (CAD): CAD × 0.945 = after tax → × exchange rate (record: 196) = PKR received."
        : viewTab === "CHQ"
          ? "Cheque payment: Gross PKR − 25% tax = net received."
          : viewTab === "HM"
            ? "Direct payment Habib Metro: Gross PKR − 1% tax = net received."
            : "Combined Ahmed + Sharjeel + Cheque + Habib Metro net totals.";

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_#F8FAFC_0%,_#EEF1F7_45%,_#E8ECF4_100%)]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Dashboard"
          subtitle="Live totals from other pages. Currency formulas are view-only — open the eye to edit."
        >
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {metrics.map(m => (
              <div
                key={m.label}
                className={`relative overflow-hidden rounded-2xl p-3.5 sm:p-4 text-white shadow-lg shadow-black/10 bg-gradient-to-br ${m.color}`}
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/5" />
                <p className="relative text-[10px] font-bold uppercase tracking-wider text-white/80 leading-snug">{m.label}</p>
                <p className="relative text-lg sm:text-2xl font-extrabold mt-2 tabular-nums tracking-tight">{currency(m.value)}</p>
                <p className="relative text-[10px] text-white/65 mt-1.5 font-medium">
                  {"hint" in m && m.hint ? m.hint : `As of ${acc.recordDate || todayIso()}`}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-5 w-full space-y-4">
            <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-gray-100/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)] overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-[#FFF8F9] to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="font-extrabold text-gray-800 text-sm tracking-tight">Currency Payment Formula</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">View-only · eye to edit · {acc.recordDate}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {viewTab !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => setFormulaOpen(true)}
                      className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 inline-flex items-center justify-center transition-colors"
                      title={`Edit ${viewTab} currency formula`}
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  <div className="inline-flex rounded-xl border border-gray-200/80 bg-[#F4F5F8] p-0.5 overflow-x-auto max-w-[min(100vw-8rem,520px)]">
                    {(["AH", "SN", "CHQ", "HM", "ALL"] as const).map(tab => {
                      const selected = viewTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            setViewTab(tab);
                            setFormulaOpen(false);
                          }}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                            selected
                              ? "bg-[#B8112D] text-white shadow-md shadow-[#B8112D]/20"
                              : "text-gray-600 hover:bg-white"
                          }`}
                          title={CURRENCY_TAB_LABELS[tab]}
                        >
                          {CURRENCY_TAB_SHORT[tab]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <p className="px-4 sm:px-5 pt-2.5 text-[11px] text-gray-500 leading-snug">{formulaNote}</p>

              {viewTab === "ALL" ? (
                <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: "AH" as const, label: "Ahmed Hamza", accent: "text-[#B8112D]", calc: ahCalc, note: "FX · 11% tax keep 0.89" },
                    { key: "SN" as const, label: "Sharjeel Nasir", accent: "text-[#0B84F3]", calc: snCalc, note: "CAD · tax 0.945" },
                    { key: "CHQ" as const, label: "Cheque Payment", accent: "text-amber-700", calc: chqCalc, note: "25% tax deduction" },
                    { key: "HM" as const, label: "Direct Habib Metro", accent: "text-teal-700", calc: hmCalc, note: "1% tax deduction" },
                  ]).map(card => (
                    <div key={card.key} className="rounded-xl border border-gray-100 bg-[#FAFBFC] p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${card.accent}`}>{card.label}</p>
                        <button
                          type="button"
                          onClick={() => { setViewTab(card.key); setFormulaOpen(true); }}
                          className="h-7 w-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 inline-flex items-center justify-center"
                          title={`Edit ${card.label}`}
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                      {isLocalPaymentTab(card.key) ? (
                        <>
                          <p className="text-xs text-gray-600">Gross: <span className="font-semibold text-gray-800 tabular-nums">{currency(card.calc.pkrGross)}</span></p>
                          <p className="text-xs text-gray-600">Tax: <span className="font-semibold text-red-600 tabular-nums">{currency(card.calc.pkrTax)}</span></p>
                          <p className="text-sm font-extrabold text-gray-900 mt-1.5 tabular-nums">Net: {currency(card.calc.total)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-gray-600">USD → PKR: <span className="font-semibold text-gray-800 tabular-nums">{currency(card.calc.usdInPkr)}</span></p>
                          <p className="text-xs text-gray-600">CAD → PKR: <span className="font-semibold text-gray-800 tabular-nums">{currency(card.calc.cadInPkr)}</span></p>
                          <p className="text-sm font-extrabold text-gray-900 mt-1.5 tabular-nums">Subtotal: {currency(card.calc.total)}</p>
                        </>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{card.note}</p>
                    </div>
                  ))}
                </div>
              ) : isLocalPaymentTab(viewTab) ? (
                <div className="p-3 sm:p-5 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      ["Gross PKR", activeCalc.pkrGross],
                      [`Tax ${((active.taxDeductionRate ?? 0) * 100).toFixed(0)}%`, activeCalc.pkrTax],
                      ["Net received", activeCalc.pkrNet],
                      ["Keep factor", 1 - (active.taxDeductionRate ?? 0)],
                    ] as const).map(([label, val]) => (
                      <div key={String(label)} className="rounded-lg border border-gray-100 bg-[#FAFBFC] px-2.5 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-800 tabular-nums">{currency(val)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-dashed border-gray-200 bg-[#F8FAFC] px-3 py-2.5 text-[10px] sm:text-[11px] text-gray-600 font-mono leading-snug">
                    <p>
                      {currency(activeCalc.pkrGross)} − {((active.taxDeductionRate ?? 0) * 100).toFixed(0)}% tax ({currency(activeCalc.pkrTax)}) ={" "}
                      <span className="font-bold text-[#B8112D]">{currency(activeCalc.pkrNet)}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 sm:p-5 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {([
                      ["USD Payment", active.usdAmount],
                      ["USD Tax", active.usdTaxFactor],
                      ["USD → PKR", active.usdToPkrRate],
                      ["CAD Payment", active.cadAmount],
                      ["CAD Tax", active.cadTaxFactor],
                      ["CAD → PKR", active.cadToPkrRate],
                      ["Direct PKR", active.pkrAmount],
                    ] as const).map(([label, val]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-gray-100 bg-[#FAFBFC] px-2.5 py-2"
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-800 tabular-nums">{currency(val)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-dashed border-gray-200 bg-[#F8FAFC] px-3 py-2.5 text-[10px] sm:text-[11px] text-gray-600 space-y-0.5 font-mono leading-snug sm:flex sm:gap-8 sm:space-y-0">
                    <p>USD: {currency(active.usdAmount)} × {active.usdTaxFactor} × {active.usdToPkrRate} = <span className="font-bold text-gray-800">{currency(activeCalc.usdInPkr)}</span></p>
                    <p>CAD: {currency(active.cadAmount)} × {active.cadTaxFactor} × {active.cadToPkrRate} = <span className="font-bold text-gray-800">{currency(activeCalc.cadInPkr)}</span></p>
                  </div>
                </div>
              )}

              <div className="mx-3 sm:mx-5 mb-4 rounded-xl border border-[#F3D7DC] bg-gradient-to-br from-[#FFF6F8] to-white px-3 sm:px-4 py-2.5 text-xs text-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {viewTab !== "ALL" && isLocalPaymentTab(viewTab) ? (
                  <>
                    <p><span className="font-bold text-gray-800 block text-[9px] uppercase tracking-wide">Gross</span><span className="tabular-nums font-semibold">{currency(displayCalc.pkrGross)}</span></p>
                    <p><span className="font-bold text-gray-800 block text-[9px] uppercase tracking-wide">Tax</span><span className="tabular-nums font-semibold text-red-600">{currency(displayCalc.pkrTax)}</span></p>
                    <p><span className="font-bold text-gray-800 block text-[9px] uppercase tracking-wide">Net</span><span className="tabular-nums font-semibold">{currency(displayCalc.pkrNet)}</span></p>
                    <p><span className="font-extrabold text-[#B8112D] block text-[9px] uppercase tracking-wide">Total</span><span className="tabular-nums font-extrabold text-[#B8112D]">{currency(displayCalc.total)}</span></p>
                  </>
                ) : (
                  <>
                    <p><span className="font-bold text-gray-800 block text-[9px] uppercase tracking-wide">USD PKR</span><span className="tabular-nums font-semibold">{currency(displayCalc.usdInPkr)}</span></p>
                    <p><span className="font-bold text-gray-800 block text-[9px] uppercase tracking-wide">CAD PKR</span><span className="tabular-nums font-semibold">{currency(displayCalc.cadInPkr)}</span></p>
                    <p><span className="font-bold text-gray-800 block text-[9px] uppercase tracking-wide">Local Net PKR</span><span className="tabular-nums font-semibold">{currency(displayCalc.pkrAmount)}</span></p>
                    <p><span className="font-extrabold text-[#B8112D] block text-[9px] uppercase tracking-wide">Total</span><span className="tabular-nums font-extrabold text-[#B8112D]">{currency(displayCalc.total)}</span></p>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 w-full">
              <AccountsChartCard
                title={`Payment Split — ${viewTab !== "ALL" ? CURRENCY_TAB_LABELS[viewTab] : "All"}`}
                subtitle={viewTab === "ALL" ? "All channels" : isLocalPaymentTab(viewTab) ? "Gross · Tax · Net" : "USD · CAD · PKR"}
                accent="#B8112D"
                icon={<PieIcon size={16} />}
              >
                <div className="grid grid-cols-2 gap-1 items-center">
                  <RechartsBox height={180}>
                    <PieChart>
                      <Pie
                        data={paymentSummary.filter(r => r.amount > 0).concat(
                          paymentSummary.every(r => r.amount <= 0) ? [{ name: "Empty", amount: 1, color: "#E2E8F0" }] : [],
                        )}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={68}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {paymentSummary.map(row => (
                          <Cell key={row.name} fill={row.color} />
                        ))}
                        {paymentSummary.every(r => r.amount <= 0) && <Cell fill="#E2E8F0" />}
                      </Pie>
                      <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    </PieChart>
                  </RechartsBox>
                  <RechartsBox height={180}>
                    <BarChart data={paymentSummary} barSize={26} margin={{ left: -8, right: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 9 }} width={36} />
                      <Tooltip formatter={v => currency(Number(v ?? 0))} />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                        {paymentSummary.map(row => (
                          <Cell key={row.name} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </RechartsBox>
                </div>
              </AccountsChartCard>

              <AccountsChartCard
                title="Pages Snapshot"
                subtitle={`As of ${acc.recordDate}`}
                accent="#0F172A"
                icon={<LayoutDashboard size={16} />}
              >
                <RechartsBox height={180}>
                  <BarChart
                    data={[
                      { name: "BS", value: summaries.balanceSheetTotalAssets ?? 0 },
                      { name: "Income", value: summaries.incomeNetProfit ?? 0 },
                      { name: "Cash", value: summaries.cashFlowNet ?? 0 },
                      { name: "Assets", value: summaries.totalAssetsRegister ?? 0 },
                    ]}
                    barSize={32}
                    margin={{ left: -4, right: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 9 }} width={40} />
                    <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {["#0B84F3", "#12B76A", "#B8112D", "#0D9488"].map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Bar>
                  </BarChart>
                </RechartsBox>
              </AccountsChartCard>
            </div>
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)] overflow-hidden mt-5">
            <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-[#F8FAFC] to-white">
              <h2 className="font-extrabold text-gray-800 text-sm tracking-tight">Combined Snapshot — {acc.recordDate}</h2>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
              <table className="w-full text-sm" style={{ minWidth: "860px" }}>
                <thead className="bg-[#FAFBFC] sticky top-0 z-10">
                  <tr className="border-b border-gray-200/80">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Page</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Primary Heads</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Total (this date)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Balance Sheet — Assets", "Must equal Equity + Liabilities", summaries.balanceSheetTotalAssets],
                    ["Balance Sheet — Equity + Liab.", `Equity ${currency(summaries.balanceSheetTotalEquity ?? 0)} · Liab ${currency(summaries.balanceSheetTotalLiabilities ?? 0)}`, bsEquityLiab],
                    ["Balance Sheet — Difference", bsBalanced ? "Balanced" : "Assets − (Equity + Liabilities)", bsDiff],
                    ["Income Statement", "Revenue, Payroll, OPEX, Net Profit", summaries.incomeNetProfit],
                    ["Cash Flow Statement", "AH Paypal, SN Paypal, CO. Habib Metro, Qasim Habib Metro", summaries.cashFlowNet],
                    ["Total Assets Register", "BEM, GPS, BDS company registers", summaries.totalAssetsRegister],
                    [
                      "Balance Sheet + Total Assets",
                      "Combined register sum",
                      (summaries.balanceSheetTotalAssets ?? 0) + (summaries.totalAssetsRegister ?? 0),
                    ],
                  ].map(([page, heads, total], i) => (
                    <tr key={String(page)} className={`border-b border-gray-50 ${i % 2 ? "bg-[#FCFCFD]" : "bg-white"} hover:bg-[#F8FAFC]`}>
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{page}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{heads}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900">{currency(Number(total) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </AccountsPageShell>

        <CurrencyFormulaModal
          open={formulaOpen && viewTab !== "ALL"}
          tab={activeKey}
          value={active}
          onClose={() => setFormulaOpen(false)}
          onChange={(key, val) => setTabField(activeKey, key, val)}
        />
      </main>
    </div>
  );
}
