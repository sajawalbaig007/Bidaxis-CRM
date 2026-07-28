"use client";

import { useMemo } from "react";
import { Landmark, Wallet, Building2 } from "lucide-react";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import CashFlowTable, { computedNet } from "../components/CashFlowTable";
import { bankColor, TABLE_VARIANT } from "../components/accountsTheme";
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
      });
      return { ...prev, months };
    });
  };

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Cash Flow Statement"
          subtitle="View mode by default — pencil on each row to edit. Net auto-calculates when bank Dr/Cr filled."
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
