"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import API from "@/lib/api";
import AccountsSidebar from "./components/layout/Sidebar";
import AccountsPageShell from "./components/AccountsPageShell";
import { accountsShellProps } from "./utils/accountsShellProps";
import { useAccountsPage } from "./hooks/useAccountsPage";
import type { DashboardData } from "./types";
import { currency, todayIso } from "./types";

function defaultData(): DashboardData {
  return {
    currency: {
      usdAmount: 3200,
      cadAmount: 1800,
      pkrAmount: 950000,
      usdToPkrRate: 278,
      cadToPkrRate: 204,
    },
  };
}

type Summary = {
  balanceSheetTotalAssets?: number;
  incomeNetProfit?: number;
  cashFlowNet?: number;
  totalAssetsRegister?: number;
};

export default function AccountsDashboardPage() {
  const acc = useAccountsPage<DashboardData>({ page: "dashboard", defaultData });
  const [summaries, setSummaries] = useState<Summary>({});

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

  const c = acc.data.currency ?? defaultData().currency;
  const usdInPkr = c.usdAmount * c.usdToPkrRate;
  const cadInPkr = c.cadAmount * c.cadToPkrRate;
  const totalPaymentsInPkr = usdInPkr + cadInPkr + c.pkrAmount;

  const paymentSummary = useMemo(
    () => [
      { name: "USD", amount: usdInPkr, color: "#0B84F3" },
      { name: "CAD", amount: cadInPkr, color: "#8B5CF6" },
      { name: "PKR", amount: c.pkrAmount, color: "#12B76A" },
    ],
    [usdInPkr, cadInPkr, c.pkrAmount],
  );

  const metrics = [
    { label: "Balance Sheet Total Assets", value: summaries.balanceSheetTotalAssets ?? 0, color: "from-[#0B84F3] to-[#0369A1]" },
    { label: "Income Statement Net Profit", value: summaries.incomeNetProfit ?? 0, color: "from-[#12B76A] to-[#027A48]" },
    { label: "Cash Flow Net Amount", value: summaries.cashFlowNet ?? 0, color: "from-[#B8112D] to-[#8b0d22]" },
    { label: "Total Assets Register", value: summaries.totalAssetsRegister ?? 0, color: "from-[#7C3AED] to-[#5B21B6]" },
  ];

  const setCurrency = (key: keyof typeof c, val: number) => {
    acc.setData(prev => ({
      ...prev,
      currency: { ...prev.currency, [key]: val },
    }));
  };

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Dashboard"
          subtitle="Live totals from other pages for the selected record date + editable currency formulas."
        >
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
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
              <div className="px-4 py-3 border-b bg-[#F8FAFC]">
                <h2 className="font-bold text-gray-800 text-sm">Currency Payment Formula (Editable)</h2>
                <p className="text-xs text-gray-400">Saved under record date {acc.recordDate}</p>
              </div>
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ["USD Payment", "usdAmount"],
                  ["USD to PKR Rate", "usdToPkrRate"],
                  ["CAD Payment", "cadAmount"],
                  ["CAD to PKR Rate", "cadToPkrRate"],
                ] as const).map(([label, key]) => (
                  <label key={key} className="text-xs font-semibold text-gray-700">
                    {label}
                    <input
                      type="number"
                      value={c[key]}
                      onChange={e => setCurrency(key, Number(e.target.value || 0))}
                      className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
                    />
                  </label>
                ))}
                <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                  Direct PKR Payment
                  <input
                    type="number"
                    value={c.pkrAmount}
                    onChange={e => setCurrency("pkrAmount", Number(e.target.value || 0))}
                    className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
                  />
                </label>
              </div>
              <div className="mx-4 mb-4 rounded-2xl border border-[#F3D7DC] bg-[#FFF6F8] p-3 text-sm text-gray-700 space-y-1">
                <p><span className="font-bold">USD in PKR</span> = {currency(usdInPkr)}</p>
                <p><span className="font-bold">CAD in PKR</span> = {currency(cadInPkr)}</p>
                <p><span className="font-bold">Total</span> = {currency(totalPaymentsInPkr)}</p>
              </div>
            </div>

            <div className="xl:col-span-5 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm">Payment Split (PKR)</h2>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "860px" }}>
                <thead className="bg-gray-50">
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
