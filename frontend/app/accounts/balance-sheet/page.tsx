"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, CartesianGrid, Legend, PieChart, Pie, Cell, Tooltip, XAxis, YAxis, ResponsiveContainer,
} from "recharts";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import EditableDataTable from "../components/EditableDataTable";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import type { BalanceSheetData, BalanceSection, BalanceLineItem } from "../types";
import { currency, newRowId } from "../types";

function defaultData(): BalanceSheetData {
  return {
    assetSections: [
      {
        id: "as-1",
        title: "Non-Current Assets",
        items: [
          { id: "a-1", label: "Property, Plant & Equipment", note: "1", amount: 1825000 },
          { id: "a-2", label: "Intangible Assets", note: "2", amount: 420000 },
        ],
      },
      {
        id: "as-2",
        title: "Current Assets",
        items: [
          { id: "a-3", label: "Inventories", note: "5", amount: 535000 },
          { id: "a-4", label: "Cash and Cash Equivalents", note: "8", amount: 280000 },
        ],
      },
    ],
    equityLiabilitySections: [
      {
        id: "es-1",
        title: "Equity",
        items: [
          { id: "e-1", label: "Share Capital", note: "10", amount: 1800000 },
          { id: "e-2", label: "Retained Earnings", note: "11", amount: 970000 },
        ],
      },
    ],
  };
}

function sumItems(items: BalanceLineItem[]) {
  return items.reduce((a, i) => a + (Number(i.amount) || 0), 0);
}

function sumSections(sections: BalanceSection[]) {
  return sections.reduce((a, s) => a + sumItems(s.items), 0);
}

export default function BalanceSheetPage() {
  const acc = useAccountsPage<BalanceSheetData>({ page: "balance_sheet", defaultData });

  const { totalAssets, currentAssets, nonCurrentAssets, totalEquity, totalLiabilities } = useMemo(() => {
    const assetSections = acc.data.assetSections ?? [];
    const eqSections = acc.data.equityLiabilitySections ?? [];
    const nc = assetSections.find(s => s.title.includes("Non-Current"))?.items ?? [];
    const cur = assetSections.find(s => s.title === "Current Assets")?.items ?? [];
    const nonCurrentAssets = sumItems(nc.length ? nc : assetSections[0]?.items ?? []);
    const currentAssets = sumItems(cur.length ? cur : assetSections[1]?.items ?? []);
    const totalAssets = sumSections(assetSections);
    const equity = eqSections.find(s => s.title === "Equity")?.items ?? [];
    const totalEquity = sumItems(equity);
    const liabilities = eqSections.filter(s => s.title !== "Equity");
    const totalLiabilities = sumSections(liabilities);
    return { totalAssets, currentAssets, nonCurrentAssets, totalEquity, totalLiabilities };
  }, [acc.data]);

  const updateItem = (
    side: "assetSections" | "equityLiabilitySections",
    sectionId: string,
    itemId: string,
    key: keyof BalanceLineItem,
    value: string | number,
  ) => {
    acc.setData(prev => ({
      ...prev,
      [side]: prev[side].map(sec =>
        sec.id === sectionId
          ? {
              ...sec,
              items: sec.items.map(it =>
                it.id === itemId ? { ...it, [key]: value } : it,
              ),
            }
          : sec,
      ),
    }));
  };

  const addRow = () => {
    acc.setData(prev => {
      const sections = [...prev.assetSections];
      const target = sections[0] ?? { id: newRowId("as"), title: "Non-Current Assets", items: [] };
      if (!sections[0]) sections.push(target);
      target.items = [
        ...target.items,
        { id: newRowId("a"), label: "New Line Item", note: "", amount: 0 },
      ];
      return { ...prev, assetSections: sections };
    });
  };

  const deleteItem = (
    side: "assetSections" | "equityLiabilitySections",
    sectionId: string,
    itemId: string,
  ) => {
    acc.setData(prev => ({
      ...prev,
      [side]: prev[side].map(sec =>
        sec.id === sectionId
          ? { ...sec, items: sec.items.filter(it => it.id !== itemId) }
          : sec,
      ),
    }));
  };

  const assetMixData = [
    { name: "Non-Current Assets", value: nonCurrentAssets },
    { name: "Current Assets", value: currentAssets },
  ];

  const renderSectionBlock = (
    side: "assetSections" | "equityLiabilitySections",
    section: BalanceSection,
  ) => (
    <div key={section.id} className="space-y-2">
      <input
        value={section.title}
        onChange={e => {
          acc.setData(prev => ({
            ...prev,
            [side]: prev[side].map(s => (s.id === section.id ? { ...s, title: e.target.value } : s)),
          }));
        }}
        className="w-full h-10 px-3 rounded-xl border border-gray-200 font-semibold text-gray-800 text-sm bg-[#FCFCFC]"
      />
      <EditableDataTable
        columns={[
          { key: "label", label: "Particulars", type: "text" },
          { key: "note", label: "Note", type: "text", width: "100px", align: "center" },
          { key: "amount", label: "Amount", type: "number", align: "right", width: "140px" },
        ]}
        rows={section.items}
        onChange={(id, key, value) => updateItem(side, section.id, id, key as keyof BalanceLineItem, value)}
        onDelete={id => deleteItem(side, section.id, id)}
      />
      <p className="text-right text-sm font-bold text-gray-700 pr-2">
        Section Total: {currency(sumItems(section.items))}
      </p>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Balance Sheet"
          subtitle="Editable vertical balance sheet — saved by record date."
          onAddNew={addRow}
        >
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              { label: "Total Assets", value: totalAssets, cls: "from-[#0B84F3] to-[#0369A1]" },
              { label: "Current Assets", value: currentAssets, cls: "from-[#12B76A] to-[#027A48]" },
              { label: "Total Liabilities", value: totalLiabilities, cls: "from-[#B8112D] to-[#8b0d22]" },
              { label: "Total Equity", value: totalEquity, cls: "from-[#7C3AED] to-[#5B21B6]" },
            ].map(card => (
              <div key={card.label} className={`bg-gradient-to-br ${card.cls} rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{card.label}</p>
                <p className="text-lg sm:text-2xl font-extrabold mt-1">{currency(card.value)}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm">Asset Composition</h2>
              <RechartsBox height={240} className="mt-3">
                <PieChart>
                  <Pie data={assetMixData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4}>
                    {assetMixData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#0B84F3" : "#12B76A"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  <Legend />
                </PieChart>
              </RechartsBox>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm">Totals Comparison</h2>
              <div className="h-[240px] mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: "Assets", value: totalAssets }, { name: "Equity+Liab.", value: totalEquity + totalLiabilities }]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    <Bar dataKey="value" fill="#B8112D" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mt-5 space-y-6">
            <h2 className="font-bold text-gray-800">Assets</h2>
            {(acc.data.assetSections ?? []).map(sec => renderSectionBlock("assetSections", sec))}
            <p className="text-right font-extrabold text-[#0F172A]">Total Assets: {currency(totalAssets)}</p>

            <h2 className="font-bold text-gray-800 pt-4 border-t">Equity and Liabilities</h2>
            {(acc.data.equityLiabilitySections ?? []).map(sec => renderSectionBlock("equityLiabilitySections", sec))}
            <p className="text-right font-extrabold text-[#0F172A]">
              Total Equity & Liabilities: {currency(totalEquity + totalLiabilities)}
            </p>
          </section>
        </AccountsPageShell>
      </main>
    </div>
  );
}
