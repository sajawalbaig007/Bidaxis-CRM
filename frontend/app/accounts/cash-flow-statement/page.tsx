"use client";

import AccountsSidebar from "../components/layout/Sidebar";

const BANK_HEADS = [
  "AH Paypal",
  "SN Paypal",
  "CO. Habib Metro",
  "Qasim Habib Metro",
];

const MONTH_SECTIONS = [
  { month: "May 2026", opening: "Closing Balance at the end of April", netAmount: 200000 },
  { month: "June 2026", opening: "Closing Balance at the end of May", netAmount: 200000 },
];

function currency(value: number) {
  return value.toLocaleString("en-US");
}

export default function CashFlowStatementPage() {
  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-5">
          <header className="flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">Cash Flow Statement</h1>
            <p className="text-xs sm:text-sm text-gray-500">Heads matched from your cash flow sheet format.</p>
          </header>

          <section className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-[#EAF5FF] border-b border-gray-200 py-2.5 px-4 text-center">
              <h2 className="text-lg sm:text-xl font-black text-[#111827] tracking-tight">BEM Solutions - Cashflow Record</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-gray-300">
                    <th className="text-left px-3 py-2 text-sm font-bold text-[#111827]">Date</th>
                    <th className="text-left px-3 py-2 text-sm font-bold text-[#111827]">Description</th>
                    {BANK_HEADS.map((bank) => (
                      <th key={`${bank}-debit`} className="text-center px-2 py-2 text-xs font-bold text-[#111827]">
                        {bank}
                        <div className="mt-1 flex justify-between text-[10px] font-semibold text-gray-500">
                          <span className="w-1/2 text-center">Debit</span>
                          <span className="w-1/2 text-center">Credit</span>
                        </div>
                      </th>
                    ))}
                    <th className="text-right px-3 py-2 text-sm font-bold text-[#111827]">Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTH_SECTIONS.flatMap((section) => [
                    <tr key={`${section.month}-title`} className="bg-[#F3F8FF] border-y border-gray-300">
                      <td className="px-3 py-2 text-sm font-bold text-[#111827]" colSpan={2 + BANK_HEADS.length + 1}>
                        {section.month}
                      </td>
                    </tr>,
                    <tr key={`${section.month}-opening`} className="border-b border-gray-200">
                      <td className="px-3 py-2 text-xs text-gray-700">31 {section.month === "May 2026" ? "April 2026" : "May 2026"}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{section.opening}</td>
                      {BANK_HEADS.map((bank) => (
                        <td key={`${section.month}-${bank}`} className="px-2 py-2 text-[11px] text-center text-gray-500">
                          Debit | Credit
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-xs font-semibold text-[#111827]">{currency(section.netAmount)}</td>
                    </tr>,
                    <tr key={`${section.month}-total`} className="bg-[#FFF8F2] border-b border-gray-300">
                      <td className="px-3 py-2 text-xs font-bold text-[#111827]" colSpan={2 + BANK_HEADS.length}>
                        TOTAL AMOUNT
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-extrabold text-[#111827]">{currency(section.netAmount)}</td>
                    </tr>,
                  ])}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
