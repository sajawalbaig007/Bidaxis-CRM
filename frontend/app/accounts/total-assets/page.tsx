"use client";

import { useMemo } from "react";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import ExpandableHeadsTable, { type ExpandableHeadRow } from "../components/ExpandableHeadsTable";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import type { AssetSectionRow, TotalAssetsData } from "../types";
import { currency, lineAmount, newRowId, todayIso } from "../types";

function defaultData(): TotalAssetsData {
  return { sections: [] };
}

function sectionToHead(s: AssetSectionRow): ExpandableHeadRow {
  const subHeads = s.subHeads?.length
    ? s.subHeads
    : (s.heads ?? []).map((label, i) => ({
        id: `${s.id}-h-${i}`,
        label,
        amount: 0,
        filledAt: s.filledAt ?? todayIso(),
      }));
  return {
    id: s.id,
    title: s.title,
    amount: s.total,
    filledAt: s.filledAt,
    subHeads,
    notes: s.notes ?? [],
  };
}

function headToSection(h: ExpandableHeadRow): AssetSectionRow {
  return {
    id: h.id,
    title: h.title,
    total: lineAmount(h),
    filledAt: h.filledAt,
    subHeads: h.subHeads ?? [],
    heads: (h.subHeads ?? []).map(s => s.label),
    notes: h.notes ?? [],
  };
}

export default function TotalAssetsPage() {
  const acc = useAccountsPage<TotalAssetsData>({ page: "total_assets", defaultData });

  const grandTotal = useMemo(
    () => (acc.data.sections ?? []).reduce((a, s) => a + lineAmount({ amount: s.total, subHeads: s.subHeads }), 0),
    [acc.data.sections],
  );

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_#F8FAFC_0%,_#EEF1F7_45%,_#E8ECF4_100%)]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Total Assets"
          subtitle="Section totals on main rows — expand for individual heads with fill dates."
          onAddNew={() => {
            acc.setData(prev => ({
              ...prev,
              sections: [
                ...prev.sections,
                {
                  id: newRowId("s"),
                  title: "New Asset Section",
                  heads: [],
                  total: 0,
                  filledAt: todayIso(),
                  subHeads: [
                    { id: newRowId("sub"), label: "Item 1", amount: 0, filledAt: todayIso() },
                  ],
                },
              ],
            }));
          }}
        >
          <section className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-2xl p-4 text-white shadow-md max-w-sm">
            <p className="text-[10px] font-bold uppercase text-white/80">Grand Total Assets</p>
            <p className="text-2xl font-extrabold mt-1">{currency(grandTotal)}</p>
          </section>

          <section className="mt-5">
            <ExpandableHeadsTable
              title="Asset Register"
              accent="#7C3AED"
              addLabel="Add Section"
              rows={(acc.data.sections ?? []).map(sectionToHead)}
              onChange={rows => acc.setData(prev => ({ ...prev, sections: rows.map(headToSection) }))}
            />
            <p className="text-right font-extrabold text-[#0F172A] mt-4 pt-3">
              Grand Total: {currency(grandTotal)}
            </p>
          </section>
        </AccountsPageShell>
      </main>
    </div>
  );
}
