"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import EditableDataTable from "../components/EditableDataTable";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import type { IncomeStatementData, TeamSalaryRow, OpexRow } from "../types";
import { currency, newRowId } from "../types";

function defaultData(): IncomeStatementData {
  return {
    totalRevenue: 0,
    teamSalaries: [],
    opexHeads: [],
  };
}

export default function IncomeStatementPage() {
  const acc = useAccountsPage<IncomeStatementData>({ page: "income_statement", defaultData });

  const payrollExpense = useMemo(
    () => (acc.data.teamSalaries ?? []).reduce((a, t) => a + (Number(t.totalSalary) || 0), 0),
    [acc.data.teamSalaries],
  );
  const operatingExpense = useMemo(
    () => (acc.data.opexHeads ?? []).reduce((a, o) => a + (Number(o.amount) || 0), 0),
    [acc.data.opexHeads],
  );
  const totalExpense = payrollExpense + operatingExpense;
  const netProfit = (Number(acc.data.totalRevenue) || 0) - totalExpense;
  const netMargin = acc.data.totalRevenue > 0 ? (netProfit / acc.data.totalRevenue) * 100 : 0;

  const payrollChartData = (acc.data.teamSalaries ?? []).map(t => ({
    name: t.team.replace(" Salaries", ""),
    value: t.totalSalary,
  }));

  const incomeCompareData = [
    { name: "Revenue", amount: Number(acc.data.totalRevenue) || 0 },
    { name: "Total Expense", amount: totalExpense },
    { name: "Net Profit", amount: netProfit },
  ];

  const updateTeam = (id: string, key: keyof TeamSalaryRow, value: string | number) => {
    acc.setData(prev => ({
      ...prev,
      teamSalaries: prev.teamSalaries.map(t => (t.id === id ? { ...t, [key]: value } : t)),
    }));
  };

  const updateOpex = (id: string, key: keyof OpexRow, value: string | number) => {
    acc.setData(prev => ({
      ...prev,
      opexHeads: prev.opexHeads.map(o => (o.id === id ? { ...o, [key]: value } : o)),
    }));
  };

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Income Statement"
          subtitle="Editable payroll and operating expenses — saved by record date."
          onAddNew={() => {
            acc.setData(prev => ({
              ...prev,
              teamSalaries: [
                ...prev.teamSalaries,
                { id: newRowId("t"), team: "New Team Salaries", headLabels: ["Basic Salary", "Total Salary"], totalSalary: 0 },
              ],
            }));
          }}
          addNewLabel="Add Team / Row"
        >
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              { label: "Revenue", value: acc.data.totalRevenue, cls: "from-[#0B84F3] to-[#0369A1]" },
              { label: "Payroll", value: payrollExpense, cls: "from-[#8B5CF6] to-[#6D28D9]" },
              { label: "Total Expense", value: totalExpense, cls: "from-[#B8112D] to-[#8b0d22]" },
              { label: "Net Profit", value: netProfit, cls: "from-[#12B76A] to-[#027A48]" },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.cls} rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{c.label}</p>
                <p className="text-lg sm:text-2xl font-extrabold mt-1">{currency(Number(c.value) || 0)}</p>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4 mt-5">
            <label className="text-xs font-semibold text-gray-600 block max-w-xs">
              Total Revenue
              <input
                type="number"
                value={acc.data.totalRevenue ?? 0}
                onChange={e => acc.setData(prev => ({ ...prev, totalRevenue: Number(e.target.value || 0) }))}
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"
              />
            </label>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <h2 className="font-bold text-sm text-gray-800">Team Salary Distribution</h2>
              <div className="h-[260px] mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payrollChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    <Bar dataKey="value" fill="#0B84F3" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <h2 className="font-bold text-sm text-gray-800">Revenue vs Expense vs Profit</h2>
              <div className="h-[260px] mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeCompareData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {incomeCompareData.map(item => (
                        <Cell
                          key={item.name}
                          fill={item.name === "Revenue" ? "#0B84F3" : item.name === "Total Expense" ? "#B8112D" : "#12B76A"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 mt-5 space-y-5">
            <div>
              <h2 className="font-bold text-gray-800 mb-3">Team Salaries</h2>
              <EditableDataTable
                columns={[
                  { key: "team", label: "Section / Team", type: "text" },
                  { key: "headLabelsText", label: "Head Labels (comma separated)", type: "text" },
                  { key: "totalSalary", label: "Net Total", type: "number", align: "right" },
                ]}
                rows={(acc.data.teamSalaries ?? []).map(t => ({
                  id: t.id,
                  team: t.team,
                  headLabelsText: t.headLabels.join(", "),
                  totalSalary: t.totalSalary,
                }))}
                onChange={(id, key, value) => {
                  if (key === "headLabelsText") {
                    acc.setData(prev => ({
                      ...prev,
                      teamSalaries: prev.teamSalaries.map(t =>
                        t.id === id
                          ? { ...t, headLabels: String(value).split(",").map(s => s.trim()).filter(Boolean) }
                          : t,
                      ),
                    }));
                  } else {
                    updateTeam(id, key as keyof TeamSalaryRow, value);
                  }
                }}
                onDelete={id => acc.setData(prev => ({ ...prev, teamSalaries: prev.teamSalaries.filter(t => t.id !== id) }))}
                minWidth="900px"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-800">Operating Expenses</h2>
                <button
                  type="button"
                  onClick={() => acc.setData(prev => ({
                    ...prev,
                    opexHeads: [...prev.opexHeads, { id: newRowId("o"), label: "New Expense", amount: 0 }],
                  }))}
                  className="text-xs font-semibold text-[#0B84F3]"
                >
                  + Add OPEX
                </button>
              </div>
              <EditableDataTable
                columns={[
                  { key: "label", label: "Expense Head", type: "text" },
                  { key: "amount", label: "Amount", type: "number", align: "right" },
                ]}
                rows={acc.data.opexHeads ?? []}
                onChange={(id, key, value) => updateOpex(id, key as keyof OpexRow, value)}
                onDelete={id => acc.setData(prev => ({ ...prev, opexHeads: prev.opexHeads.filter(o => o.id !== id) }))}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-3 border-t text-sm font-bold">
              <span className="text-gray-600">Total Expense: {currency(totalExpense)}</span>
              <span className="text-[#12B76A]">Net Profit ({netMargin.toFixed(2)}%): {currency(netProfit)}</span>
            </div>
          </section>
        </AccountsPageShell>
      </main>
    </div>
  );
}
