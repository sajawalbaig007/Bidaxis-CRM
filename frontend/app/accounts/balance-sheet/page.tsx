"use client";

import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import AccountsSidebar from "../components/layout/Sidebar";
import RechartsBox from "@/app/components/charts/RechartsBox";

type LineItem = {
  label: string;
  note?: string;
  amount: number;
};

type Section = {
  title: string;
  items: LineItem[];
};

const NON_CURRENT_ASSETS: LineItem[] = [
  { label: "Property, Plant & Equipment", note: "1", amount: 1825000 },
  { label: "Intangible Assets", note: "2", amount: 420000 },
  { label: "Investments", note: "3", amount: 760000 },
  { label: "Other Non-Current Assets", note: "4", amount: 240000 },
];

const CURRENT_ASSETS: LineItem[] = [
  { label: "Inventories", note: "5", amount: 535000 },
  { label: "Investments", note: "6", amount: 315000 },
  { label: "Trade Receivables", note: "7", amount: 650000 },
  { label: "Cash and Cash Equivalents", note: "8", amount: 280000 },
  { label: "Other Current Assets", note: "9", amount: 145000 },
];

const EQUITY_ITEMS: LineItem[] = [
  { label: "Share Capital", note: "10", amount: 1800000 },
  { label: "Retained Earnings", note: "11", amount: 970000 },
  { label: "Other Equity", note: "12", amount: 345000 },
];

const NON_CURRENT_LIABILITIES: LineItem[] = [
  { label: "Long-Term Borrowings", note: "13", amount: 620000 },
  { label: "Long-Term Provisions", note: "14", amount: 215000 },
  { label: "Deferred Tax Liabilities (Net)", note: "15", amount: 260000 },
  { label: "Other Non-Current Liabilities", note: "16", amount: 170000 },
];

const CURRENT_LIABILITIES: LineItem[] = [
  { label: "Short-Term Borrowings", note: "17", amount: 330000 },
  { label: "Trade Payables", note: "18", amount: 380000 },
  { label: "Other Current Liabilities", note: "19", amount: 235000 },
  { label: "Short-Term Provisions", note: "20", amount: 145000 },
];

function sum(items: LineItem[]) {
  return items.reduce((acc, item) => acc + item.amount, 0);
}

function currency(value: number) {
  return value.toLocaleString("en-US");
}

export default function BalanceSheetPage() {
  const nonCurrentAssets = sum(NON_CURRENT_ASSETS);
  const currentAssets = sum(CURRENT_ASSETS);
  const totalAssets = nonCurrentAssets + currentAssets;

  const totalEquity = sum(EQUITY_ITEMS);
  const nonCurrentLiabilities = sum(NON_CURRENT_LIABILITIES);
  const currentLiabilities = sum(CURRENT_LIABILITIES);
  const totalLiabilities = nonCurrentLiabilities + currentLiabilities;
  const totalEquityAndLiabilities = totalEquity + totalLiabilities;

  const assetMixData = [
    { name: "Non-Current Assets", value: nonCurrentAssets },
    { name: "Current Assets", value: currentAssets },
  ];

  const fundingMixData = [
    { name: "Equity", value: totalEquity },
    { name: "Non-Current Liabilities", value: nonCurrentLiabilities },
    { name: "Current Liabilities", value: currentLiabilities },
  ];

  const comparisonData = [
    { name: "Assets", nonCurrent: nonCurrentAssets, current: currentAssets },
    { name: "Funding", nonCurrent: totalEquity + nonCurrentLiabilities, current: currentLiabilities },
  ];

  const ASSET_COLORS = ["#0B84F3", "#12B76A"];
  const FUNDING_COLORS = ["#B8112D", "#7C3AED", "#F59E0B"];

  const assetSections: Section[] = [
    { title: "Non-Current Assets", items: NON_CURRENT_ASSETS },
    { title: "Current Assets", items: CURRENT_ASSETS },
  ];

  const equityLiabilitySections: Section[] = [
    { title: "Equity", items: EQUITY_ITEMS },
    { title: "Non-Current Liabilities", items: NON_CURRENT_LIABILITIES },
    { title: "Current Liabilities", items: CURRENT_LIABILITIES },
  ];

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-5">
          <header className="flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">Balance Sheet</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Vertical format of balance sheet with assets, equity and liabilities overview.
            </p>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-gradient-to-br from-[#0B84F3] to-[#0369A1] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Total Assets</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(totalAssets)}</p>
            </div>
            <div className="bg-gradient-to-br from-[#12B76A] to-[#027A48] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Current Assets</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(currentAssets)}</p>
            </div>
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Total Liabilities</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(totalLiabilities)}</p>
            </div>
            <div className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Total Equity</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(totalEquity)}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
            <div className="xl:col-span-6 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Asset Composition</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Current vs Non-current split</p>
              <RechartsBox height={260} className="mt-3">
                <PieChart>
                  <Pie data={assetMixData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={4}>
                    {assetMixData.map((_, idx) => (
                      <Cell key={`asset-${idx}`} fill={ASSET_COLORS[idx % ASSET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </RechartsBox>
            </div>

            <div className="xl:col-span-6 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Funding Mix</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Equity and liabilities distribution</p>
              <RechartsBox height={260} className="mt-3">
                <PieChart>
                  <Pie data={fundingMixData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {fundingMixData.map((_, idx) => (
                      <Cell key={`fund-${idx}`} fill={FUNDING_COLORS[idx % FUNDING_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </RechartsBox>
            </div>
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-800 text-sm sm:text-base">Current vs Non-Current Comparison</h2>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Assets side and funding side stacked comparison</p>
            <div className="mt-3 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} barSize={46}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: "#475569" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Legend />
                  <Bar dataKey="nonCurrent" stackId="a" fill="#0B84F3" radius={[8, 8, 0, 0]} name="Non-Current / Equity Base" />
                  <Bar dataKey="current" stackId="a" fill="#12B76A" radius={[8, 8, 0, 0]} name="Current / Current Liabilities" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-[#FDF1E8] border-b border-gray-200 py-2.5 px-4 text-center">
              <h2 className="text-lg sm:text-xl font-black text-[#111827] tracking-tight">Vertical Format of Balance Sheet</h2>
            </div>
            <div className="bg-[#EAF5FF] border-b border-gray-200 py-2 px-4 text-center">
              <p className="text-base sm:text-[28px] font-semibold text-[#0F172A]">Balance Sheet as at...</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-gray-300">
                    <th className="text-left px-3 py-2 text-2xl font-bold text-[#111827]">Particulars</th>
                    <th className="text-center px-3 py-2 w-[120px] text-xl font-bold text-[#111827]">Note</th>
                    <th className="text-right px-3 py-2 w-[170px] text-xl font-bold text-[#111827]">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-3 py-2 text-2xl font-extrabold italic text-[#111827]">Assets</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                  </tr>

                  {assetSections.map((section) => (
                    <tr key={section.title}>
                      <td colSpan={3} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <tr className="border-y border-gray-200 bg-[#FCFCFC]">
                              <td className="px-3 py-1.5 text-xl font-bold text-[#111827]">{section.title}:</td>
                              <td className="px-3 py-1.5 w-[120px]" />
                              <td className="px-3 py-1.5 w-[170px]" />
                            </tr>
                            {section.items.map((item) => (
                              <tr key={`${section.title}-${item.label}`} className="border-b border-gray-200">
                                <td className="px-3 py-1.5 text-xl text-[#111827]">{item.label}</td>
                                <td className="px-3 py-1.5 text-center text-sm text-gray-600">{item.note ?? ""}</td>
                                <td className="px-3 py-1.5 text-right text-xl font-semibold text-[#111827]">{currency(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}

                  <tr className="border-y border-gray-300 bg-[#FFF8F2]">
                    <td className="px-3 py-2 text-2xl font-bold text-[#111827]">Total Assets</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right text-2xl font-extrabold text-[#111827]">{currency(totalAssets)}</td>
                  </tr>

                  <tr className="border-b border-gray-200">
                    <td className="px-3 py-2 text-2xl font-extrabold italic text-[#111827]">Equity and Liabilities</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                  </tr>

                  {equityLiabilitySections.map((section) => (
                    <tr key={section.title}>
                      <td colSpan={3} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <tr className="border-y border-gray-200 bg-[#FCFCFC]">
                              <td className="px-3 py-1.5 text-xl font-bold text-[#111827]">{section.title}:</td>
                              <td className="px-3 py-1.5 w-[120px]" />
                              <td className="px-3 py-1.5 w-[170px]" />
                            </tr>
                            {section.items.map((item) => (
                              <tr key={`${section.title}-${item.label}`} className="border-b border-gray-200">
                                <td className="px-3 py-1.5 text-xl text-[#111827]">{item.label}</td>
                                <td className="px-3 py-1.5 text-center text-sm text-gray-600">{item.note ?? ""}</td>
                                <td className="px-3 py-1.5 text-right text-xl font-semibold text-[#111827]">{currency(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}

                  <tr className="border-y border-gray-300 bg-[#FFF8F2]">
                    <td className="px-3 py-2 text-2xl font-bold text-[#111827]">Total Equity and Liabilities</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right text-2xl font-extrabold text-[#111827]">{currency(totalEquityAndLiabilities)}</td>
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
