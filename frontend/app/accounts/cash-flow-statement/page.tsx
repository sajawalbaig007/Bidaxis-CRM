"use client";

import { Fragment, useMemo } from "react";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
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

  const allRows = useMemo(
    () => (acc.data.months ?? []).flatMap(m => m.rows.map(r => ({ ...r, monthId: m.id, monthLabel: m.month }))),
    [acc.data.months],
  );

  const totalNet = useMemo(
    () => allRows.reduce((a, r) => a + (Number(r.netAmount) || 0), 0),
    [allRows],
  );

  const updateRow = (monthId: string, rowId: string, patch: Partial<CashFlowRow>) => {
    acc.setData(prev => ({
      ...prev,
      months: prev.months.map(m =>
        m.id === monthId
          ? { ...m, rows: m.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)) }
          : m,
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
            bankAmounts: Object.fromEntries(
              (prev.bankHeads ?? []).map(b => [b, { debit: 0, credit: 0 }]),
            ),
            netAmount: 0,
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
        bankAmounts: Object.fromEntries(
          (prev.bankHeads ?? []).map(b => [b, { debit: 0, credit: 0 }]),
        ),
        netAmount: 0,
      });
      return { ...prev, months };
    });
  };

  const bankHeads = acc.data.bankHeads ?? [];

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Cash Flow Statement"
          subtitle="Editable cashflow by bank heads — saved by record date."
          onAddNew={addRowToFirstMonth}
          addNewLabel="Add New Entry"
        >
          <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] rounded-2xl p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase text-white/80">Net Cash Flow (all rows)</p>
              <p className="text-2xl font-extrabold mt-1">{currency(totalNet)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 col-span-2">
              <label className="text-xs font-semibold text-gray-600">
                Bank heads (comma separated)
                <input
                  value={bankHeads.join(", ")}
                  onChange={e => {
                    const heads = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                    acc.setData(prev => ({ ...prev, bankHeads: heads }));
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
              </label>
              <button type="button" onClick={addMonth} className="mt-2 text-xs font-semibold text-[#0B84F3]">
                + Add Month Section
              </button>
            </div>
          </section>

          {(acc.data.months ?? []).map(month => (
            <section key={month.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-5">
              <div className="px-4 py-3 border-b bg-[#F8FAFC] flex items-center gap-2">
                <input
                  value={month.month}
                  onChange={e => {
                    acc.setData(prev => ({
                      ...prev,
                      months: prev.months.map(m => (m.id === month.id ? { ...m, month: e.target.value } : m)),
                    }));
                  }}
                  className="font-bold text-gray-800 bg-transparent outline-none flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    acc.setData(prev => ({
                      ...prev,
                      months: prev.months.filter(m => m.id !== month.id),
                    }));
                  }}
                  className="text-xs text-red-500 font-semibold"
                >
                  Remove section
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: `${900 + bankHeads.length * 140}px` }}>
                  <thead className="bg-gray-50">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      {bankHeads.map(bank => (
                        <th key={bank} colSpan={2} className="px-2 py-2 text-center text-xs font-semibold text-gray-700">
                          {bank}
                          <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                            <span>Debit</span><span>Credit</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold">Net</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {month.rows.map(row => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-[#FFFBFC]">
                        <td className="px-2 py-1.5">
                          <input type="date" value={row.date?.slice(0, 10) ?? ""} onChange={e => updateRow(month.id, row.id, { date: e.target.value })} className="h-9 w-full min-w-[120px] rounded-lg border px-2 text-xs" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.description} onChange={e => updateRow(month.id, row.id, { description: e.target.value })} className="h-9 w-full min-w-[160px] rounded-lg border px-2 text-xs" />
                        </td>
                        {bankHeads.map(bank => {
                          const b = row.bankAmounts?.[bank] ?? { debit: 0, credit: 0 };
                          return (
                            <Fragment key={`${row.id}-${bank}`}>
                              <td className="px-1 py-1.5">
                                <input type="number" value={b.debit} onChange={e => updateBank(month.id, row.id, bank, "debit", Number(e.target.value || 0))} className="h-9 w-full min-w-[70px] rounded-lg border px-1 text-xs text-right" />
                              </td>
                              <td className="px-1 py-1.5">
                                <input type="number" value={b.credit} onChange={e => updateBank(month.id, row.id, bank, "credit", Number(e.target.value || 0))} className="h-9 w-full min-w-[70px] rounded-lg border px-1 text-xs text-right" />
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="px-2 py-1.5">
                          <input type="number" value={row.netAmount} onChange={e => updateRow(month.id, row.id, { netAmount: Number(e.target.value || 0) })} className="h-9 w-full min-w-[90px] rounded-lg border px-2 text-xs text-right font-semibold" />
                        </td>
                        <td className="px-2">
                          <button type="button" onClick={() => acc.setData(prev => ({ ...prev, months: prev.months.map(m => m.id === month.id ? { ...m, rows: m.rows.filter(r => r.id !== row.id) } : m) }))} className="text-red-500 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#FFF8F2] font-bold">
                      <td colSpan={2 + bankHeads.length * 2} className="px-3 py-2 text-right text-sm">Section Total</td>
                      <td className="px-3 py-2 text-right">{currency(month.rows.reduce((a, r) => a + (Number(r.netAmount) || 0), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))}
        </AccountsPageShell>
      </main>
    </div>
  );
}
