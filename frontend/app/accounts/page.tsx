"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AccountsSidebar from "./components/layout/Sidebar";

const DASHBOARD_METRICS = [
  { label: "Balance Sheet Total Assets", value: 5170000 },
  { label: "Income Statement Net Profit", value: 1830181 },
  { label: "Cash Flow Net Amount", value: 400000 },
  { label: "Total Assets Register", value: 1767700 },
];

function currency(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function AccountsDashboardPage() {
  const [usdAmount, setUsdAmount] = useState(3200);
  const [cadAmount, setCadAmount] = useState(1800);
  const [pkrAmount, setPkrAmount] = useState(950000);
  const [usdToPkrRate, setUsdToPkrRate] = useState(278);
  const [cadToPkrRate, setCadToPkrRate] = useState(204);

  const usdInPkr = usdAmount * usdToPkrRate;
  const cadInPkr = cadAmount * cadToPkrRate;
  const totalPaymentsInPkr = usdInPkr + cadInPkr + pkrAmount;

  const paymentSummary = useMemo(
    () => [
      { name: "USD", amount: usdInPkr, color: "#0B84F3" },
      { name: "CAD", amount: cadInPkr, color: "#8B5CF6" },
      { name: "PKR", amount: pkrAmount, color: "#12B76A" },
    ],
    [usdInPkr, cadInPkr, pkrAmount],
  );

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-5">
          <header className="flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-500">Blend of all accounting pages with separate currency payments and editable formulas.</p>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {DASHBOARD_METRICS.map((item, idx) => (
              <div
                key={item.label}
                className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md ${
                  idx === 0
                    ? "bg-gradient-to-br from-[#0B84F3] to-[#0369A1]"
                    : idx === 1
                      ? "bg-gradient-to-br from-[#12B76A] to-[#027A48]"
                      : idx === 2
                        ? "bg-gradient-to-br from-[#B8112D] to-[#8b0d22]"
                        : "bg-gradient-to-br from-[#7C3AED] to-[#5B21B6]"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{item.label}</p>
                <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(item.value)}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
            <div className="xl:col-span-7 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-[#F8FAFC]">
                <h2 className="font-bold text-gray-800 text-sm sm:text-base">Currency Payment Formula (Editable)</h2>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">USD, CAD and PKR payments calculated separately</p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-gray-700">
                    USD Payment
                    <input value={usdAmount} onChange={(e) => setUsdAmount(Number(e.target.value || 0))} type="number" className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30" />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    USD to PKR Rate
                    <input value={usdToPkrRate} onChange={(e) => setUsdToPkrRate(Number(e.target.value || 0))} type="number" className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30" />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    CAD Payment
                    <input value={cadAmount} onChange={(e) => setCadAmount(Number(e.target.value || 0))} type="number" className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30" />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    CAD to PKR Rate
                    <input value={cadToPkrRate} onChange={(e) => setCadToPkrRate(Number(e.target.value || 0))} type="number" className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30" />
                  </label>
                  <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                    Direct PKR Payment
                    <input value={pkrAmount} onChange={(e) => setPkrAmount(Number(e.target.value || 0))} type="number" className="mt-1 h-10 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30" />
                  </label>
                </div>

                <div className="mt-4 rounded-2xl border border-[#F3D7DC] bg-[#FFF6F8] p-3 sm:p-4 text-sm text-gray-700 space-y-1.5">
                  <p><span className="font-bold">Formula 1:</span> USD in PKR = USD Payment × USD Rate = {currency(usdInPkr)}</p>
                  <p><span className="font-bold">Formula 2:</span> CAD in PKR = CAD Payment × CAD Rate = {currency(cadInPkr)}</p>
                  <p><span className="font-bold">Formula 3:</span> Total = USD in PKR + CAD in PKR + Direct PKR = {currency(totalPaymentsInPkr)}</p>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Payment Split (in PKR)</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Converted and direct values</p>
              <div className="mt-3 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentSummary}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: "#475569" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                    <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {paymentSummary.map((row) => (
                        <Cell key={row.name} fill={row.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-[#F8FAFC]">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Combined Accounts Snapshot</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "860px" }}>
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Page</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Primary Heads</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Current Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2.5 font-medium text-gray-800">Balance Sheet</td>
                    <td className="px-3 py-2.5 text-gray-600">Assets, Equity, Liabilities</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">5,170,000</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2.5 font-medium text-gray-800">Income Statement</td>
                    <td className="px-3 py-2.5 text-gray-600">Revenue, Payroll, Operating Expense, Net Profit</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">1,830,181</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2.5 font-medium text-gray-800">Cash Flow Statement</td>
                    <td className="px-3 py-2.5 text-gray-600">AH Paypal, SN Paypal, CO. Habib Metro, Qasim Habib Metro</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">400,000</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-medium text-gray-800">Total Assets</td>
                    <td className="px-3 py-2.5 text-gray-600">IT, Electrical, Furniture, Renovation, BIM, Global PCS</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">1,767,700</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
