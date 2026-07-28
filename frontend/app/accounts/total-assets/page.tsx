"use client";

import AccountsSidebar from "../components/layout/Sidebar";

type AssetSection = {
  title: string;
  heads: string[];
  total: number;
};

const ASSET_SECTIONS: AssetSection[] = [
  {
    title: "IT Inventory",
    heads: ["SR#", "Description", "Qty", "Total Price"],
    total: 171540,
  },
  {
    title: "Electrical Inventory",
    heads: ["SR#", "Description", "Qty", "Total Price"],
    total: 416730,
  },
  {
    title: "Furniture Inventory",
    heads: ["SR#", "Description", "Qty", "Total Price"],
    total: 645770,
  },
  {
    title: "Office Renovation & Security Expense",
    heads: ["SR#", "Description", "Qty", "Total Price"],
    total: 89350,
  },
  {
    title: "BIM Designing Studio",
    heads: ["IT Inventory", "Electrical Inventory", "Furniture Inventory"],
    total: 323830,
  },
  {
    title: "Global Pre-Construction Services",
    heads: ["SR#", "Description", "Qty", "Total Price"],
    total: 117900,
  },
];

function currency(value: number) {
  return value.toLocaleString("en-US");
}

export default function TotalAssetsPage() {
  const grandTotal = ASSET_SECTIONS.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-5">
          <header className="flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">Total Assets</h1>
            <p className="text-xs sm:text-sm text-gray-500">Heads matched from your inventory/assets sheet sections.</p>
          </header>

          <section className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-[#F8FAFC]">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Asset Register (Head Wise)</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "900px" }}>
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Section</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Picked Heads</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ASSET_SECTIONS.map((section) => (
                    <tr key={section.title} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{section.title}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{section.heads.join(" • ")}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{currency(section.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#ECFDF3] border-t border-gray-200">
                    <td className="px-3 py-2.5 font-bold text-[#0F172A]" colSpan={2}>
                      Grand Total Assets
                    </td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-[#0F172A]">{currency(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
