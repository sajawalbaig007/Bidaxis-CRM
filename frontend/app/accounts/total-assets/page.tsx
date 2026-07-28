"use client";

import { useMemo } from "react";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import EditableDataTable from "../components/EditableDataTable";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import type { AssetSectionRow, TotalAssetsData } from "../types";
import { currency, newRowId } from "../types";

function defaultData(): TotalAssetsData {
  return { sections: [] };
}

export default function TotalAssetsPage() {
  const acc = useAccountsPage<TotalAssetsData>({ page: "total_assets", defaultData });

  const grandTotal = useMemo(
    () => (acc.data.sections ?? []).reduce((a, s) => a + (Number(s.total) || 0), 0),
    [acc.data.sections],
  );

  const rows = (acc.data.sections ?? []).map(s => ({
    id: s.id,
    title: s.title,
    headsText: s.heads.join(", "),
    total: s.total,
  }));

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Total Assets"
          subtitle="Editable asset register by section — saved by record date."
          onAddNew={() => {
            acc.setData(prev => ({
              ...prev,
              sections: [
                ...prev.sections,
                {
                  id: newRowId("s"),
                  title: "New Asset Section",
                  heads: ["SR#", "Description", "Qty", "Total Price"],
                  total: 0,
                },
              ],
            }));
          }}
        >
          <section className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-2xl p-4 text-white shadow-md max-w-sm">
            <p className="text-[10px] font-bold uppercase text-white/80">Grand Total Assets</p>
            <p className="text-2xl font-extrabold mt-1">{currency(grandTotal)}</p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 mt-5">
            <EditableDataTable
              columns={[
                { key: "title", label: "Section", type: "text" },
                { key: "headsText", label: "Column Heads (comma separated)", type: "text" },
                { key: "total", label: "Total", type: "number", align: "right", width: "140px" },
              ]}
              rows={rows}
              onChange={(id, key, value) => {
                acc.setData(prev => ({
                  ...prev,
                  sections: prev.sections.map(s => {
                    if (s.id !== id) return s;
                    if (key === "headsText") {
                      return { ...s, heads: String(value).split(",").map(x => x.trim()).filter(Boolean) };
                    }
                    return { ...s, [key]: value } as AssetSectionRow;
                  }),
                }));
              }}
              onDelete={id => acc.setData(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== id) }))}
              minWidth="900px"
            />
            <p className="text-right font-extrabold text-[#0F172A] mt-4 pt-3 border-t">
              Grand Total: {currency(grandTotal)}
            </p>
          </section>
        </AccountsPageShell>
      </main>
    </div>
  );
}
