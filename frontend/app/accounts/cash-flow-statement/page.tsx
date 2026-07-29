"use client";

import { useMemo } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { Landmark, Wallet, Building2, Activity, PieChart as PieIcon } from "lucide-react";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import AccountsChartCard, { CHART_COLORS } from "../components/AccountsChartCard";
import CashFlowTable, { computedNet } from "../components/CashFlowTable";
import { bankColor, TABLE_VARIANT } from "../components/accountsTheme";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import type { CashFlowData, CashFlowRow } from "../types";
import { currency, newRowId } from "../types";

function defaultData(): CashFlowData {
  return {
    bankHeads: ["AH Paypal", "SN Paypal", "CO. Habib Metro", "Qasim Habib Metro"],
    months: [],
  };
}

export default function CashFlowStatementPage() {
  const acc = useAccountsPage<CashFlowData>({ page: "cash_flow", defaultData });
  const theme = TABLE_VARIANT.cashflow;
  const bankHeads = acc.data.bankHeads ?? [];

  const allRows = useMemo(
    () => (acc.data.months ?? []).flatMap(m => m.rows),
    [acc.data.months],
  );

  const totalNet = useMemo(() => allRows.reduce((a, r) => a + computedNet(r), 0), [allRows]);

  const monthChart = useMemo(
    () => (acc.data.months ?? []).map(m => ({
      name: (m.month || "Section").slice(0, 12),
      net: m.rows.reduce((a, r) => a + computedNet(r), 0),
    })),
    [acc.data.months],
  );

  const bankChart = useMemo(() => {
    return bankHeads.map((bank, i) => {
      let debit = 0;
      let credit = 0;
      for (const r of allRows) {
        const b = r.bankAmounts?.[bank];
        debit += Number(b?.debit) || 0;
        credit += Number(b?.credit) || 0;
      }
      return {
        name: bank.length > 14 ? `${bank.slice(0, 12)}…` : bank,
        full: bank,
        net: debit - credit,
        debit,
        credit,
        color: bankColor(i),
      };
    }).filter(b => b.debit !== 0 || b.credit !== 0 || b.net !== 0);
  }, [allRows, bankHeads]);

  const updateRow = (monthId: string, rowId: string, patch: Partial<CashFlowRow>) => {
    acc.setData(prev => ({
      ...prev,
      months: prev.months.map(m =>
        m.id === monthId ? { ...m, rows: m.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)) } : m,
      ),
    }));
  };

  const updateBank = (monthId: string, rowId: string, bank: string, side: "debit" | "credit", val: number) => {
    acc.setData(prev => ({
      ...prev,
      months: prev.months.map(m =>
        m.id === monthId
          ? {
              ...m,
              rows: m.rows.map(r => {
                if (r.id !== rowId) return r;
                const bankAmounts = { ...r.bankAmounts };
                bankAmounts[bank] = { ...(bankAmounts[bank] ?? { debit: 0, credit: 0 }), [side]: val };
                return { ...r, bankAmounts };
              }),
            }
          : m,
      ),
    }));
  };

  const addMonth = () => {
    acc.setData(prev => ({
      ...prev,
      months: [
        ...prev.months,
        {
          id: newRowId("m"),
          month: "New Month",
          rows: [{
            id: newRowId("r"),
            date: acc.recordDate,
            description: "New entry",
            bankAmounts: Object.fromEntries(bankHeads.map(b => [b, { debit: 0, credit: 0 }])),
            netAmount: 0,
            notes: [],
          }],
        },
      ],
    }));
  };

  const addRowToFirstMonth = () => {
    acc.setData(prev => {
      const months = [...prev.months];
      let month = months[0];
      if (!month) {
        month = { id: newRowId("m"), month: "Entries", rows: [] };
        months.unshift(month);
      }
      month.rows.push({
        id: newRowId("r"),
        date: acc.recordDate,
        description: "New entry",
        bankAmounts: Object.fromEntries((prev.bankHeads ?? []).map(b => [b, { debit: 0, credit: 0 }])),
        netAmount: 0,
        notes: [],
      });
      return { ...prev, months };
    });
  };

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_#F8FAFC_0%,_#EEF1F7_45%,_#E8ECF4_100%)]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Cash Flow Statement"
          subtitle="Tables are view-only — pencil opens edit popup for bank Dr/Cr & notes. Net auto-calculates from banks."
          onAddNew={addRowToFirstMonth}
          addNewLabel="Add New Entry"
        >
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-4 rounded-2xl border-2 p-5 text-white bg-gradient-to-br from-[#B8112D] to-[#8b0d22] shadow-lg ${theme.card}`}>
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={18} className="text-white/80" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">Net Cash Flow</p>
              </div>
              <p className="text-3xl font-extrabold tabular-nums">{currency(totalNet)}</p>
              <p className="text-[11px] text-white/60 mt-2">{allRows.length} entries across {acc.data.months?.length ?? 0} sections</p>
            </div>

            <div className={`lg:col-span-8 bg-white rounded-2xl border-2 p-4 sm:p-5 ${theme.card}`}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-[#B8112D]" />
                <h2 className="font-bold text-sm text-gray-800">Bank Accounts</h2>
              </div>
              <label className="text-xs font-semibold text-gray-600 block">
                Bank heads (comma separated)
                <input
                  value={bankHeads.join(", ")}
                  onChange={e => {
                    const heads = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                    acc.setData(prev => ({ ...prev, bankHeads: heads }));
                  }}
                  className={`mt-1.5 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 ${theme.input}`}
                />
              </label>
              <div className="flex flex-wrap gap-2 mt-3">
                {bankHeads.map((bank, i) => (
                  <span
                    key={bank}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
                    style={{ backgroundColor: bankColor(i) }}
                  >
                    {bank}
                  </span>
                ))}
              </div>
              <button type="button" onClick={addMonth} className="mt-3 h-9 px-4 rounded-xl bg-[#FFF1F3] text-[#B8112D] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#FFE4E8]">
                <Landmark size={14} />
                Add Month Section
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
            <AccountsChartCard
              title="Net by Section"
              subtitle="Cash movement across month sections"
              accent="#B8112D"
              icon={<Activity size={16} />}
            >
              <RechartsBox height={250}>
                <AreaChart data={monthChart.length ? monthChart : [{ name: "—", net: 0 }]}>
                  <defs>
                    <linearGradient id="cfArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#B8112D" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#B8112D" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="net" stroke="#B8112D" fill="url(#cfArea)" strokeWidth={2.5} />
                </AreaChart>
              </RechartsBox>
            </AccountsChartCard>

            <AccountsChartCard
              title="Bank Activity"
              subtitle="Volume share per bank"
              accent="#0B84F3"
              icon={<PieIcon size={16} />}
            >
              <RechartsBox height={250}>
                {bankChart.length > 0 ? (
                  <PieChart>
                    <Pie
                      data={bankChart.map(b => ({
                        name: b.name,
                        value: Math.abs(b.net) || Math.abs(b.debit) + Math.abs(b.credit) || 1,
                        color: b.color,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {bankChart.map((b, i) => (
                        <Cell key={b.full} fill={b.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  </PieChart>
                ) : (
                  <BarChart data={[{ name: "No activity", value: 0 }]}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Bar dataKey="value" fill="#E2E8F0" radius={[8, 8, 0, 0]} />
                  </BarChart>
                )}
              </RechartsBox>
            </AccountsChartCard>
          </section>

          {bankChart.length > 0 && (
            <section className="mt-4">
              <AccountsChartCard
                title="Bank Debit vs Credit"
                subtitle="Side-by-side activity"
                accent="#12B76A"
                icon={<Wallet size={16} />}
              >
                <RechartsBox height={230}>
                  <BarChart data={bankChart} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    <Bar dataKey="debit" name="Debit" fill="#0B84F3" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="credit" name="Credit" fill="#B8112D" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </RechartsBox>
              </AccountsChartCard>
            </section>
          )}

          <div className="mt-5">
            <CashFlowTable
              months={acc.data.months ?? []}
              bankHeads={bankHeads}
              onUpdateMonthTitle={(id, title) => acc.setData(prev => ({
                ...prev,
                months: prev.months.map(m => (m.id === id ? { ...m, month: title } : m)),
              }))}
              onRemoveMonth={id => acc.setData(prev => ({ ...prev, months: prev.months.filter(m => m.id !== id) }))}
              onUpdateRow={updateRow}
              onUpdateBank={updateBank}
              onRemoveRow={(mid, rid) => acc.setData(prev => ({
                ...prev,
                months: prev.months.map(m => m.id === mid ? { ...m, rows: m.rows.filter(r => r.id !== rid) } : m),
              }))}
              onAddRow={mid => acc.setData(prev => ({
                ...prev,
                months: prev.months.map(m =>
                  m.id === mid
                    ? {
                        ...m,
                        rows: [...m.rows, {
                          id: newRowId("r"),
                          date: acc.recordDate,
                          description: "New entry",
                          bankAmounts: Object.fromEntries((prev.bankHeads ?? []).map(b => [b, { debit: 0, credit: 0 }])),
                          netAmount: 0,
                          notes: [],
                        }],
                      }
                    : m,
                ),
              }))}
            />
          </div>
        </AccountsPageShell>
      </main>
    </div>
  );
}
