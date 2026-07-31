"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  CheckCircle2,
  Cpu,
  Eye,
  Headset,
  LayoutDashboard,
  PieChart as PieIcon,
  Scale,
  Sigma,
  TrendingUp,
  UserCog,
  Wallet,
  Waves,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import API from "@/lib/api";
import AccountsSidebar from "./components/layout/Sidebar";
import AccountsPageShell from "./components/AccountsPageShell";
import AccountsChartCard from "./components/AccountsChartCard";
import CurrencyFormulaModal from "./components/CurrencyFormulaModal";
import FormulaBookModal from "./components/FormulaBookModal";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { accountsShellProps } from "./utils/accountsShellProps";
import { useAccountsPage } from "./hooks/useAccountsPage";
import type { CurrencyTabKey, DashboardCurrency, DashboardCurrencyTab, DashboardData, FormulasState } from "./types";
import { CURRENCY_TAB_LABELS, CURRENCY_TAB_SHORT, currency, isLocalPaymentTab, todayIso } from "./types";

const TAB_DEFAULTS: Record<CurrencyTabKey, DashboardCurrencyTab> = {
  // Ahmed Hamza â€” USD/CAD Ã— 0.89 â†’ Ã— FX (example USD rate 285)
  AH: {
    usdAmount: 0,
    cadAmount: 0,
    pkrAmount: 0,
    usdToPkrRate: 285,
    cadToPkrRate: 204,
    usdTaxFactor: 0.89,
    cadTaxFactor: 0.89,
  },
  // Sharjeel Nasir â€” CAD Ã— 0.945 â†’ Ã— 196
  SN: {
    usdAmount: 0,
    cadAmount: 0,
    pkrAmount: 0,
    usdToPkrRate: 285,
    cadToPkrRate: 196,
    usdTaxFactor: 0.89,
    cadTaxFactor: 0.945,
  },
  // Cheque payment â€” 25% tax deduction on PKR gross
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
  // Direct payment Habib Metro â€” 1% tax deduction on PKR gross
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

  // Legacy flat shape â†’ put amounts on SN, keep others defaults
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
  const [formulaBookOpen, setFormulaBookOpen] = useState(false);

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

  const paymentSummary =
    viewTab === "ALL"
      ? [
          { name: "Ahmed", amount: ahCalc.total, color: "#B8112D" },
          { name: "Sharjeel", amount: snCalc.total, color: "#0B84F3" },
          { name: "Cheque", amount: chqCalc.total, color: "#F59E0B" },
          { name: "Habib", amount: hmCalc.total, color: "#0D9488" },
        ]
      : isLocalPaymentTab(viewTab)
        ? [
            { name: "Gross", amount: activeCalc.pkrGross, color: "#64748B" },
            { name: "Tax", amount: activeCalc.pkrTax, color: "#EF4444" },
            { name: "Net", amount: activeCalc.pkrNet, color: "#12B76A" },
          ]
        : [
            { name: "USD", amount: displayCalc.usdInPkr, color: "#0B84F3" },
            { name: "CAD", amount: displayCalc.cadInPkr, color: "#0D9488" },
            { name: "PKR", amount: displayCalc.pkrAmount, color: "#12B76A" },
          ];

  const bsAssets = summaries.balanceSheetTotalAssets ?? 0;
  const bsEquityLiab = summaries.balanceSheetEquityLiabilities
    ?? ((summaries.balanceSheetTotalEquity ?? 0) + (summaries.balanceSheetTotalLiabilities ?? 0));
  const bsDiff = summaries.balanceSheetDifference ?? (bsAssets - bsEquityLiab);
  const bsBalanced = Math.abs(bsDiff) < 1 && bsAssets > 0;

  const combinedTotal = ahCalc.total + snCalc.total + chqCalc.total + hmCalc.total;

  const metrics = [
    { label: "BS Total Assets", value: bsAssets, color: "from-[#0B84F3] to-[#0369A1]", hint: "Must equal Equity + Liabilities", icon: <Scale size={14} /> },
    { label: "BS Equity + Liabilities", value: bsEquityLiab, color: "from-[#0D9488] to-[#0F766E]", hint: `Equity ${currency(summaries.balanceSheetTotalEquity ?? 0)} Â· Liab ${currency(summaries.balanceSheetTotalLiabilities ?? 0)}`, icon: <Wallet size={14} /> },
    { label: bsBalanced ? "BS Balanced (Diff 0)" : "BS Difference (A âˆ’ Eâˆ’L)", value: bsDiff, color: bsBalanced ? "from-[#12B76A] to-[#027A48]" : "from-[#F59E0B] to-[#B45309]", hint: bsBalanced ? "Assets = Equity + Liabilities" : "Should be zero when balanced", icon: <CheckCircle2 size={14} /> },
    { label: "Income Statement Net Profit", value: summaries.incomeNetProfit ?? 0, color: "from-[#12B76A] to-[#027A48]", icon: <TrendingUp size={14} /> },
    { label: "Cash Flow Net Amount", value: summaries.cashFlowNet ?? 0, color: "from-[#B8112D] to-[#8b0d22]", icon: <Waves size={14} /> },
  ];

  const channelChips = [
    { key: "AH", label: "Ahmed Hamza", amount: ahCalc.total, dot: "#F87171" },
    { key: "SN", label: "Sharjeel Nasir", amount: snCalc.total, dot: "#60A5FA" },
    { key: "CHQ", label: "Cheque", amount: chqCalc.total, dot: "#FBBF24" },
    { key: "HM", label: "Habib Metro", amount: hmCalc.total, dot: "#2DD4BF" },
  ];

  const quickPages = [
    { href: "/accounts/income-statement", label: "Income Statement", hint: "Net Profit", stat: summaries.incomeNetProfit, icon: <TrendingUp size={17} />, from: "#12B76A", to: "#027A48" },
    { href: "/accounts/balance-sheet", label: "Balance Sheet", hint: "Total Assets", stat: summaries.balanceSheetTotalAssets, icon: <Scale size={17} />, from: "#0B84F3", to: "#0369A1" },
    { href: "/accounts/cash-flow-statement", label: "Cash Flow", hint: "Net Amount", stat: summaries.cashFlowNet, icon: <Waves size={17} />, from: "#B8112D", to: "#8b0d22" },
    { href: "/accounts/total-assets", label: "Total Assets", hint: "Register Sum", stat: summaries.totalAssetsRegister, icon: <Boxes size={17} />, from: "#0D9488", to: "#0F766E" },
    { href: "/accounts/technical-team-payroll", label: "Technical Payroll", hint: "Team salaries", icon: <Cpu size={17} />, from: "#6D28D9", to: "#4C1D95" },
    { href: "/accounts/sales-team-payroll", label: "Sales Payroll", hint: "Commission based", icon: <BadgeDollarSign size={17} />, from: "#F59E0B", to: "#B45309" },
    { href: "/accounts/sales-team-lead-payroll", label: "Team Lead Payroll", hint: "TL commission", icon: <UserCog size={17} />, from: "#0EA5E9", to: "#0369A1" },
    { href: "/accounts/csr-payroll", label: "CSR Payroll", hint: "CSR salaries", icon: <Headset size={17} />, from: "#EC4899", to: "#9D174D" },
  ] as const;

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

  /** Formula Book â€” edits save straight into the dashboard record */
  const formulasState: FormulasState = acc.data.formulas ?? {};
  const handleFormulasChange = (next: FormulasState) => {
    const nextData: DashboardData = { ...acc.data, formulas: next };
    acc.setData(() => nextData);
    void acc.save(nextData);
  };

  const formulaLiveNotes: Record<string, string> = {
    "fx-ah": `Current: USD rate ${ah.usdToPkrRate} Â· CAD rate ${ah.cadToPkrRate} Â· factor ${ah.usdTaxFactor}`,
    "fx-sn": `Current: CAD rate ${sn.cadToPkrRate} Â· factor ${sn.cadTaxFactor}`,
    "fx-chq": `Current gross: ${currency(chq.pkrAmount)} â†’ net ${currency(chqCalc.pkrNet)}`,
    "fx-hm": `Current gross: ${currency(hm.pkrAmount)} â†’ net ${currency(hmCalc.pkrNet)}`,
    "is-net-profit": `Current (${acc.recordDate}): ${currency(summaries.incomeNetProfit ?? 0)}`,
  };

  const formulaNote =
    viewTab === "AH"
      ? "Ahmed Hamza: USD/CAD Ã— 0.89 = after tax â†’ Ã— international FX rate = PKR received."
      : viewTab === "SN"
        ? "Sharjeel Nasir (CAD): CAD Ã— 0.945 = after tax â†’ Ã— exchange rate (record: 196) = PKR received."
        : viewTab === "CHQ"
          ? "Cheque payment: Gross PKR âˆ’ 25% tax = net received."
          : viewTab === "HM"
            ? "Direct payment Habib Metro: Gross PKR âˆ’ 1% tax = net received."
            : "Combined Ahmed + Sharjeel + Cheque + Habib Metro net totals.";

  return (
    <div className="flex min-h-screen accounts-page-bg">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Dashboard"
          subtitle="Live totals from other pages. Currency formulas are view-only â€” open the eye to edit."
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => setFormulaBookOpen(true)}
              className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 inline-flex items-center gap-2 hover:border-[#B8112D] hover:text-[#B8112D] transition-colors shadow-sm"
              title="Accounts ke tamam formulas â€” section-wise, editable"
            >
              <Sigma size={15} className="text-[#B8112D]" />
              All Formulas
            </button>
          </div>

          <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0B1220] text-white shadow-2xl shadow-black/20">
            <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[#B8112D]/35 blur-3xl" />
            <div className="absolute -bottom-28 left-1/4 w-80 h-80 rounded-full bg-[#0B84F3]/25 blur-3xl" />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="relative p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Total Received â€” All Channels</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 border border-white/15 text-white/80 tabular-nums">
                    {acc.recordDate || todayIso()}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      bsBalanced
                        ? "bg-emerald-400/15 border-emerald-300/30 text-emerald-300"
                        : "bg-amber-400/15 border-amber-300/30 text-amber-300"
                    }`}
                  >
                    <CheckCircle2 size={11} />
                    {bsBalanced ? "Balance Sheet balanced" : "Balance Sheet not balanced"}
                  </span>
                </div>
                <p className="mt-2 text-3xl sm:text-4xl xl:text-5xl font-extrabold tabular-nums tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                  {currency(combinedTotal)}
                </p>
                <p className="mt-1.5 text-[11px] text-white/50 font-medium">
                  Ahmed + Sharjeel + Cheque + Habib Metro â€” after tax, PKR net
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2 lg:ml-auto shrink-0">
                {channelChips.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => { setViewTab(c.key as ViewTab); setFormulaOpen(false); }}
                    className="text-left rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 hover:bg-white/[0.12] transition-colors backdrop-blur-sm"
                    title={`View ${c.label} formula`}
                  >
                    <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-white/55">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
                      {c.label}
                    </p>
                    <p className="mt-1 text-sm font-extrabold tabular-nums">{currency(c.amount)}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-4">
            {metrics.map(m => (
              <div
                key={m.label}
                className={`group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 text-white shadow-lg shadow-black/10 bg-gradient-to-br ${m.color} transition-transform duration-200 hover:-translate-y-0.5`}
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-125" />
                <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 leading-snug">{m.label}</p>
                  <span className="shrink-0 w-6 h-6 rounded-lg bg-white/15 border border-white/20 inline-flex items-center justify-center">
                    {m.icon}
                  </span>
                </div>
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
                  <p className="text-[11px] text-gray-400 mt-0.5">View-only Â· eye to edit Â· {acc.recordDate}</p>
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
                    { key: "AH" as const, label: "Ahmed Hamza", accent: "text-[#B8112D]", calc: ahCalc, note: "FX Â· 11% tax keep 0.89" },
                    { key: "SN" as const, label: "Sharjeel Nasir", accent: "text-[#0B84F3]", calc: snCalc, note: "CAD Â· tax 0.945" },
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
                          <p className="text-xs text-gray-600">USD â†’ PKR: <span className="font-semibold text-gray-800 tabular-nums">{currency(card.calc.usdInPkr)}</span></p>
                          <p className="text-xs text-gray-600">CAD â†’ PKR: <span className="font-semibold text-gray-800 tabular-nums">{currency(card.calc.cadInPkr)}</span></p>
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
                      {currency(activeCalc.pkrGross)} âˆ’ {((active.taxDeductionRate ?? 0) * 100).toFixed(0)}% tax ({currency(activeCalc.pkrTax)}) ={" "}
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
                      ["USD â†’ PKR", active.usdToPkrRate],
                      ["CAD Payment", active.cadAmount],
                      ["CAD Tax", active.cadTaxFactor],
                      ["CAD â†’ PKR", active.cadToPkrRate],
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
                    <p>USD: {currency(active.usdAmount)} Ã— {active.usdTaxFactor} Ã— {active.usdToPkrRate} = <span className="font-bold text-gray-800">{currency(activeCalc.usdInPkr)}</span></p>
                    <p>CAD: {currency(active.cadAmount)} Ã— {active.cadTaxFactor} Ã— {active.cadToPkrRate} = <span className="font-bold text-gray-800">{currency(activeCalc.cadInPkr)}</span></p>
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
                title={`Payment Split â€” ${viewTab !== "ALL" ? CURRENCY_TAB_LABELS[viewTab] : "All"}`}
                subtitle={viewTab === "ALL" ? "All channels" : isLocalPaymentTab(viewTab) ? "Gross Â· Tax Â· Net" : "USD Â· CAD Â· PKR"}
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

          <section className="mt-5">
            <div className="flex items-center gap-2.5 mb-3 px-0.5">
              <span className="w-1 h-6 rounded-full bg-[#B8112D] shrink-0" />
              <h2 className="font-extrabold text-gray-800 text-sm tracking-tight">Quick Access</h2>
              <span className="text-[11px] text-gray-400 font-medium">Jump to any accounts page â€” live totals as of {acc.recordDate}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {quickPages.map(p => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100/90 p-4 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(15,23,42,0.18)]"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-0.5 opacity-70 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(90deg, ${p.from}, ${p.to})` }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-white shadow-md"
                      style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                    >
                      {p.icon}
                    </span>
                    <span className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 text-gray-400 inline-flex items-center justify-center transition-all duration-200 group-hover:bg-[#B8112D] group-hover:border-[#B8112D] group-hover:text-white group-hover:rotate-45">
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                  <p className="mt-3 font-extrabold text-gray-800 text-sm tracking-tight">{p.label}</p>
                  {"stat" in p && p.stat != null ? (
                    <p className="mt-0.5 text-lg font-extrabold tabular-nums tracking-tight" style={{ color: p.from }}>
                      {currency(Number(p.stat) || 0)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-lg font-extrabold text-gray-300">â€”</p>
                  )}
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">{p.hint}</p>
                </Link>
              ))}
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

        <FormulaBookModal
          open={formulaBookOpen}
          onClose={() => setFormulaBookOpen(false)}
          value={formulasState}
          onChange={handleFormulasChange}
          liveNotes={formulaLiveNotes}
        />
      </main>
    </div>
  );
}
