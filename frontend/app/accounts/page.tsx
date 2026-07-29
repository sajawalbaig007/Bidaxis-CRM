"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import API from "@/lib/api";
import AccountsSidebar from "./components/layout/Sidebar";
import AccountsPageShell from "./components/AccountsPageShell";
import { accountsShellProps } from "./utils/accountsShellProps";
import { useAccountsPage } from "./hooks/useAccountsPage";
import type { CurrencyTabKey, DashboardCurrency, DashboardCurrencyTab, DashboardData } from "./types";
import { currency, todayIso } from "./types";

const TAB_DEFAULTS: Record<CurrencyTabKey, DashboardCurrencyTab> = {
  SN: {
    usdAmount: 3200,
    cadAmount: 1800,
    pkrAmount: 950000,
    usdToPkrRate: 278,
    cadToPkrRate: 204,
    usdTaxFactor: 0.89,
    cadTaxFactor: 0.89,
  },
  AH: {
    usdAmount: 0,
    cadAmount: 100000,
    pkrAmount: 0,
    usdToPkrRate: 285,
    cadToPkrRate: 196,
    usdTaxFactor: 0.89,
    cadTaxFactor: 0.945,
  },
};

function defaultData(): DashboardData {
  return {
    currency: {
      tabs: {
        SN: { ...TAB_DEFAULTS.SN },
        AH: { ...TAB_DEFAULTS.AH },
      },
    },
  };
}

/** Migrate older single-block currency saves into SN/AH tabs. */
function normalizeCurrency(raw: DashboardCurrency | undefined): DashboardCurrency {
  const base = defaultData().currency;
  if (!raw) return base;

  if (raw.tabs?.SN && raw.tabs?.AH) {
    return {
      tabs: {
        SN: { ...TAB_DEFAULTS.SN, ...raw.tabs.SN },
        AH: { ...TAB_DEFAULTS.AH, ...raw.tabs.AH },
      },
    };
  }

  // Legacy flat shape → put amounts on SN, keep AH defaults
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
    },
  };
}

function calcTab(t: DashboardCurrencyTab) {
  const usdAfterTax = t.usdAmount * t.usdTaxFactor;
  const cadAfterTax = t.cadAmount * t.cadTaxFactor;
  const usdInPkr = usdAfterTax * t.usdToPkrRate;
  const cadInPkr = cadAfterTax * t.cadToPkrRate;
  const total = usdInPkr + cadInPkr + t.pkrAmount;
  return { usdAfterTax, cadAfterTax, usdInPkr, cadInPkr, total };
}

type Summary = {
  balanceSheetTotalAssets?: number;
  incomeNetProfit?: number;
  cashFlowNet?: number;
  totalAssetsRegister?: number;
};

type ViewTab = CurrencyTabKey | "ALL";

export default function AccountsDashboardPage() {
  const acc = useAccountsPage<DashboardData>({ page: "dashboard", defaultData });
  const [summaries, setSummaries] = useState<Summary>({});
  const [viewTab, setViewTab] = useState<ViewTab>("SN");

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
  const snCalc = calcTab(sn);
  const ahCalc = calcTab(ah);

  const activeKey: CurrencyTabKey = viewTab === "ALL" ? "SN" : viewTab;
  const active = currencyData.tabs[activeKey];
  const activeCalc = calcTab(active);

  const displayCalc = viewTab === "ALL"
    ? {
        usdAfterTax: snCalc.usdAfterTax + ahCalc.usdAfterTax,
        cadAfterTax: snCalc.cadAfterTax + ahCalc.cadAfterTax,
        usdInPkr: snCalc.usdInPkr + ahCalc.usdInPkr,
        cadInPkr: snCalc.cadInPkr + ahCalc.cadInPkr,
        total: snCalc.total + ahCalc.total,
        pkrAmount: sn.pkrAmount + ah.pkrAmount,
      }
    : { ...activeCalc, pkrAmount: active.pkrAmount };

  const paymentSummary = useMemo(
    () => [
      { name: "USD", amount: displayCalc.usdInPkr, color: "#0B84F3" },
      { name: "CAD", amount: displayCalc.cadInPkr, color: "#8B5CF6" },
      { name: "PKR", amount: displayCalc.pkrAmount, color: "#12B76A" },
    ],
    [displayCalc.usdInPkr, displayCalc.cadInPkr, displayCalc.pkrAmount],
  );

  const metrics = [
    { label: "Balance Sheet Total Assets", value: summaries.balanceSheetTotalAssets ?? 0, color: "from-[#0B84F3] to-[#0369A1]" },
    { label: "Income Statement Net Profit", value: summaries.incomeNetProfit ?? 0, color: "from-[#12B76A] to-[#027A48]" },
    { label: "Cash Flow Net Amount", value: summaries.cashFlowNet ?? 0, color: "from-[#B8112D] to-[#8b0d22]" },
    { label: "Total Assets Register", value: summaries.totalAssetsRegister ?? 0, color: "from-[#7C3AED] to-[#5B21B6]" },
    {
      label: "Balance Sheet + Total Assets",
      value: (summaries.balanceSheetTotalAssets ?? 0) + (summaries.totalAssetsRegister ?? 0),
      color: "from-[#0F172A] to-[#334155]",
    },
  ];

  const ensureNormalized = (prev: DashboardData): DashboardCurrency =>
    normalizeCurrency(prev.currency);

  const setTabField = (tab: CurrencyTabKey, key: keyof DashboardCurrencyTab, val: number) => {
    acc.setData(prev => {
      const tabs = ensureNormalized(prev).tabs;
      return {
        ...prev,
        currency: {
          tabs: {
            ...tabs,
            [tab]: { ...tabs[tab], [key]: val },
          },
        },
      };
    });
  };

  const formulaNote =
    viewTab === "AH"
      ? "Sherjeel CAD formula: CAD × tax factor → after tax × FX rate = PKR. USD uses the same after-tax path."
      : viewTab === "SN"
        ? "Standard formula: USD/CAD × tax factor → after tax × FX rate = PKR received."
        : "Combined SN + AH totals (actual cash received only).";

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Dashboard"
          subtitle="Live totals from other pages for the selected record date + editable currency formulas."
        >
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
            {metrics.map(m => (
              <div key={m.label} className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md bg-gradient-to-br ${m.color}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{m.label}</p>
                <p className="text-lg sm:text-2xl font-extrabold mt-1">{currency(m.value)}</p>
                <p className="text-[10px] text-white/70 mt-1">As of {acc.recordDate || todayIso()}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 mt-5">
            <div className="xl:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="font-bold text-gray-800 text-sm">Currency Payment Formula (Editable)</h2>
                  <p className="text-xs text-gray-400">Saved under record date {acc.recordDate}</p>
                </div>
                <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 shrink-0">
                  {(["SN", "AH", "ALL"] as const).map(tab => {
                    const selected = viewTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setViewTab(tab)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selected
                            ? "bg-[#B8112D] text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {tab === "ALL" ? "All" : tab}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pt-3">
                <p className="text-[11px] text-gray-500 leading-relaxed">{formulaNote}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  All calculations are based on actual cash received. No quoted, billed, forecasted, or anticipated amounts.
                </p>
              </div>

              {viewTab === "ALL" ? (
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-3">
                      <p className="text-xs font-bold text-gray-700 mb-2">SN totals</p>
                      <p className="text-sm text-gray-600">USD after tax → PKR: <span className="font-semibold text-gray-800">{currency(snCalc.usdInPkr)}</span></p>
                      <p className="text-sm text-gray-600">CAD after tax → PKR: <span className="font-semibold text-gray-800">{currency(snCalc.cadInPkr)}</span></p>
                      <p className="text-sm font-bold text-gray-800 mt-1">Subtotal: {currency(snCalc.total)}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-3">
                      <p className="text-xs font-bold text-gray-700 mb-2">AH totals (Sherjeel CAD defaults)</p>
                      <p className="text-sm text-gray-600">USD after tax → PKR: <span className="font-semibold text-gray-800">{currency(ahCalc.usdInPkr)}</span></p>
                      <p className="text-sm text-gray-600">CAD after tax → PKR: <span className="font-semibold text-gray-800">{currency(ahCalc.cadInPkr)}</span></p>
                      <p className="text-sm font-bold text-gray-800 mt-1">Subtotal: {currency(ahCalc.total)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {([
                      ["USD Payment (actual cash)", "usdAmount"],
                      ["USD Tax Factor (editable)", "usdTaxFactor"],
                      ["USD to PKR Rate", "usdToPkrRate"],
                      ["CAD Payment (actual cash)", "cadAmount"],
                      ["CAD Tax Factor (editable)", "cadTaxFactor"],
                      ["CAD to PKR Rate", "cadToPkrRate"],
                    ] as const).map(([label, key]) => (
                      <label key={key} className="text-xs font-semibold text-gray-700">
                        {label}
                        <input
                          type="number"
                          step={key.includes("Tax") ? "0.001" : "1"}
                          value={active[key]}
                          onChange={e => setTabField(activeKey, key, Number(e.target.value || 0))}
                          className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
                        />
                      </label>
                    ))}
                    <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                      Direct PKR Payment
                      <input
                        type="number"
                        value={active.pkrAmount}
                        onChange={e => setTabField(activeKey, "pkrAmount", Number(e.target.value || 0))}
                        className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600 space-y-1 font-mono">
                    <p>1. USD After Tax = {currency(active.usdAmount)} × {active.usdTaxFactor} = <span className="font-bold text-gray-800">{currency(activeCalc.usdAfterTax)}</span></p>
                    <p>2. USD → PKR = {currency(activeCalc.usdAfterTax)} × {active.usdToPkrRate} = <span className="font-bold text-gray-800">{currency(activeCalc.usdInPkr)}</span></p>
                    <p className="pt-1">1. CAD After Tax = {currency(active.cadAmount)} × {active.cadTaxFactor} = <span className="font-bold text-gray-800">{currency(activeCalc.cadAfterTax)}</span></p>
                    <p>2. CAD → PKR = {currency(activeCalc.cadAfterTax)} × {active.cadToPkrRate} = <span className="font-bold text-gray-800">{currency(activeCalc.cadInPkr)}</span></p>
                  </div>
                </div>
              )}

              <div className="mx-4 mb-4 rounded-2xl border border-[#F3D7DC] bg-[#FFF6F8] p-3 text-sm text-gray-700 space-y-1">
                <p><span className="font-bold">USD in PKR</span> (after tax) = {currency(displayCalc.usdInPkr)}</p>
                <p><span className="font-bold">CAD in PKR</span> (after tax) = {currency(displayCalc.cadInPkr)}</p>
                <p><span className="font-bold">Direct PKR</span> = {currency(displayCalc.pkrAmount)}</p>
                <p><span className="font-bold">Total</span> = {currency(displayCalc.total)}</p>
              </div>
            </div>

            <div className="xl:col-span-5 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm">
                Payment Split (PKR){viewTab !== "ALL" ? ` — ${viewTab}` : " — All"}
              </h2>
              <div className="mt-3 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentSummary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {paymentSummary.map(row => (
                        <Cell key={row.name} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-5">
            <div className="px-4 py-3 border-b bg-[#F8FAFC]">
              <h2 className="font-bold text-gray-800 text-sm">Combined Snapshot — {acc.recordDate}</h2>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
              <table className="w-full text-sm" style={{ minWidth: "860px" }}>
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-semibold">Page</th>
                    <th className="px-3 py-2 text-left font-semibold">Primary Heads</th>
                    <th className="px-3 py-2 text-right font-semibold">Total (this date)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Balance Sheet", "Assets, Equity, Liabilities", summaries.balanceSheetTotalAssets],
                    ["Income Statement", "Revenue, Payroll, OPEX, Net Profit", summaries.incomeNetProfit],
                    ["Cash Flow Statement", "AH Paypal, SN Paypal, CO. Habib Metro, Qasim Habib Metro", summaries.cashFlowNet],
                    ["Total Assets", "IT, Electrical, Furniture, Renovation, BIM, Global PCS", summaries.totalAssetsRegister],
                    [
                      "Balance Sheet + Total Assets",
                      "Combined register sum",
                      (summaries.balanceSheetTotalAssets ?? 0) + (summaries.totalAssetsRegister ?? 0),
                    ],
                  ].map(([page, heads, total]) => (
                    <tr key={String(page)} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 font-medium">{page}</td>
                      <td className="px-3 py-2.5 text-gray-600">{heads}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{currency(Number(total) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </AccountsPageShell>
      </main>
    </div>
  );
}
