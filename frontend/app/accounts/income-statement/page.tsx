"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import ExpandableHeadsTable, { type ExpandableHeadRow } from "../components/ExpandableHeadsTable";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import type { IncomeStatementData, OpexRow, TeamSalaryRow } from "../types";
import { currency, lineAmount, newRowId, todayIso } from "../types";

function defaultData(): IncomeStatementData {
  return {
    totalRevenue: 0,
    teamSalaries: [],
    opexHeads: [],
    loanHeads: [],
    providentFundHeads: [],
  };
}

function teamToHead(t: TeamSalaryRow): ExpandableHeadRow {
  const subHeads = t.subHeads?.length
    ? t.subHeads
    : (t.headLabels ?? []).map((label, i) => ({
        id: `${t.id}-legacy-${i}`,
        label,
        amount: 0,
        filledAt: t.filledAt ?? todayIso(),
      }));
  return {
    id: t.id,
    title: t.team,
    amount: t.totalSalary,
    filledAt: t.filledAt,
    subHeads,
  };
}

function opexToHead(o: OpexRow): ExpandableHeadRow {
  return {
    id: o.id,
    title: o.label,
    amount: o.amount,
    filledAt: o.filledAt,
    subHeads: o.subHeads ?? [],
  };
}

function headToTeam(h: ExpandableHeadRow): TeamSalaryRow {
  return {
    id: h.id,
    team: h.title,
    totalSalary: lineAmount(h),
    filledAt: h.filledAt,
    subHeads: h.subHeads ?? [],
    headLabels: (h.subHeads ?? []).map(s => s.label),
  };
}

function headToOpex(h: ExpandableHeadRow): OpexRow {
  return {
    id: h.id,
    label: h.title,
    amount: lineAmount(h),
    filledAt: h.filledAt,
    subHeads: h.subHeads ?? [],
  };
}

export default function IncomeStatementPage() {
  const acc = useAccountsPage<IncomeStatementData>({ page: "income_statement", defaultData });

  const payrollExpense = useMemo(
    () => (acc.data.teamSalaries ?? []).reduce((a, t) => a + lineAmount(t), 0),
    [acc.data.teamSalaries],
  );
  const operatingExpense = useMemo(
    () => (acc.data.opexHeads ?? []).reduce((a, o) => a + lineAmount(o), 0),
    [acc.data.opexHeads],
  );
  const loanExpense = useMemo(
    () => (acc.data.loanHeads ?? []).reduce((a, o) => a + lineAmount(o), 0),
    [acc.data.loanHeads],
  );
  const pfExpense = useMemo(
    () => (acc.data.providentFundHeads ?? []).reduce((a, o) => a + lineAmount(o), 0),
    [acc.data.providentFundHeads],
  );
  const totalExpense = payrollExpense + operatingExpense + loanExpense + pfExpense;
  const netProfit = (Number(acc.data.totalRevenue) || 0) - totalExpense;
  const netMargin = acc.data.totalRevenue > 0 ? (netProfit / acc.data.totalRevenue) * 100 : 0;

  const payrollChartData = (acc.data.teamSalaries ?? []).map(t => ({
    name: t.team.replace(" Salaries", ""),
    value: lineAmount(t),
  }));

  const incomeCompareData = [
    { name: "Revenue", amount: Number(acc.data.totalRevenue) || 0 },
    { name: "Total Expense", amount: totalExpense },
    { name: "Net Profit", amount: netProfit },
  ];

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_#F8FAFC_0%,_#EEF1F7_45%,_#E8ECF4_100%)]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Income Statement"
          subtitle="Totals on main rows — expand for individuals. Edit/delete opens a detail popup."
          onAddNew={() => {
            acc.setData(prev => ({
              ...prev,
              teamSalaries: [
                ...prev.teamSalaries,
                {
                  id: newRowId("t"),
                  team: "New Team Salaries",
                  totalSalary: 0,
                  filledAt: todayIso(),
                  subHeads: [{ id: newRowId("sub"), label: "Basic Salary", amount: 0, filledAt: todayIso() }],
                },
              ],
            }));
          }}
          addNewLabel="Add Team"
        >
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {[
              { label: "Revenue", value: acc.data.totalRevenue, cls: "from-[#0B84F3] to-[#0369A1]" },
              { label: "Payroll", value: payrollExpense, cls: "from-[#8B5CF6] to-[#6D28D9]" },
              { label: "Loans", value: loanExpense, cls: "from-[#F59E0B] to-[#B45309]" },
              { label: "Provident Fund", value: pfExpense, cls: "from-[#06B6D4] to-[#0E7490]" },
              { label: "Total Expense", value: totalExpense, cls: "from-[#B8112D] to-[#8b0d22]" },
              { label: "Net Profit", value: netProfit, cls: "from-[#12B76A] to-[#027A48]" },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.cls} rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{c.label}</p>
                <p className="text-lg sm:text-xl font-extrabold mt-1">{currency(Number(c.value) || 0)}</p>
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

          <section className="mt-5 space-y-5">
            <ExpandableHeadsTable
              title="Team Salaries"
              accent="#0B84F3"
              addLabel="Add Team"
              rows={(acc.data.teamSalaries ?? []).map(teamToHead)}
              onChange={rows => acc.setData(prev => ({ ...prev, teamSalaries: rows.map(headToTeam) }))}
            />

            <ExpandableHeadsTable
              title="Operating Expenses"
              accent="#7C3AED"
              addLabel="Add OPEX"
              rows={(acc.data.opexHeads ?? []).map(opexToHead)}
              onChange={rows => acc.setData(prev => ({ ...prev, opexHeads: rows.map(headToOpex) }))}
            />

            <ExpandableHeadsTable
              title="Loans"
              accent="#F59E0B"
              addLabel="Add Loan Head"
              rows={(acc.data.loanHeads ?? []).map(opexToHead)}
              onChange={rows => acc.setData(prev => ({ ...prev, loanHeads: rows.map(headToOpex) }))}
            />

            <ExpandableHeadsTable
              title="Provident Fund"
              accent="#06B6D4"
              addLabel="Add PF Head"
              rows={(acc.data.providentFundHeads ?? []).map(opexToHead)}
              onChange={rows => acc.setData(prev => ({ ...prev, providentFundHeads: rows.map(headToOpex) }))}
            />

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-1 text-sm font-bold">
              <span className="text-gray-600">Total Expense: {currency(totalExpense)}</span>
              <span className="text-[#12B76A]">Net Profit ({netMargin.toFixed(2)}%): {currency(netProfit)}</span>
            </div>
          </section>
        </AccountsPageShell>
      </main>
    </div>
  );
}
