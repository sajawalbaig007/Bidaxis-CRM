"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, BarChart3 } from "lucide-react";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import AccountsChartCard from "../components/AccountsChartCard";
import ExpandableHeadsTable, { type ExpandableHeadRow } from "../components/ExpandableHeadsTable";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import { useScrollToHash } from "../hooks/useScrollToHash";
import type { AssetSectionRow, AssetsCompanyKey, TotalAssetsData } from "../types";
import { ASSETS_COMPANIES, currency, lineAmount, newRowId, todayIso } from "../types";

function emptyCompanies(): Record<AssetsCompanyKey, AssetSectionRow[]> {
  return { BEM: [], GPS: [], BDS: [] };
}

function defaultData(): TotalAssetsData {
  return { companies: emptyCompanies(), sections: [] };
}

/** Migrate legacy flat `sections` into company buckets. */
function normalizeCompanies(data: TotalAssetsData): Record<AssetsCompanyKey, AssetSectionRow[]> {
  const base = emptyCompanies();
  if (data.companies) {
    for (const c of ASSETS_COMPANIES) {
      base[c.key] = data.companies[c.key] ?? [];
    }
    const hasAny = ASSETS_COMPANIES.some(c => (base[c.key]?.length ?? 0) > 0);
    if (hasAny) return base;
  }
  // Legacy: put old sections under BEM
  if (data.sections?.length) {
    base.BEM = data.sections;
  }
  return base;
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
  useScrollToHash(!acc.loading);
  const companies = normalizeCompanies(acc.data);

  const companyTotals = useMemo(() => {
    const out: Record<AssetsCompanyKey, number> = { BEM: 0, GPS: 0, BDS: 0 };
    for (const c of ASSETS_COMPANIES) {
      out[c.key] = (companies[c.key] ?? []).reduce(
        (a, s) => a + lineAmount({ amount: s.total, subHeads: s.subHeads }),
        0,
      );
    }
    return out;
  }, [companies]);

  const grandTotal = companyTotals.BEM + companyTotals.GPS + companyTotals.BDS;

  const setCompanySections = (
    key: AssetsCompanyKey,
    rows: ExpandableHeadRow[],
    opts?: { persist?: boolean },
  ) => {
    const base = normalizeCompanies(acc.data);
    const next: TotalAssetsData = {
      ...acc.data,
      companies: { ...base, [key]: rows.map(headToSection) },
      sections: [],
    };
    acc.setData(() => next);
    if (opts?.persist) void acc.save(next);
  };

  const addHeadToCompany = (key: AssetsCompanyKey) => {
    const base = normalizeCompanies(acc.data);
    const next: TotalAssetsData = {
      ...acc.data,
      companies: {
        ...base,
        [key]: [
          ...base[key],
          {
            id: newRowId("s"),
            title: "New Head",
            heads: [],
            total: 0,
            filledAt: todayIso(),
            subHeads: [
              { id: newRowId("sub"), label: "Item 1", amount: 0, filledAt: todayIso() },
            ],
            notes: [],
          },
        ],
      },
      sections: [],
    };
    acc.setData(() => next);
    void acc.save(next);
  };

  return (
    <div className="flex min-h-screen accounts-page-bg">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Total Assets"
          subtitle="Company-wise registers — BEM, GPS, BDS. Edit heads via pencil; sub-heads drive totals."
          onAddNew={() => addHeadToCompany("BEM")}
          addNewLabel="Add Head (BEM)"
        >
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {ASSETS_COMPANIES.map(c => (
              <div
                key={c.key}
                className="rounded-2xl p-4 text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{c.label}</p>
                <p className="text-xl font-extrabold mt-1 tabular-nums">{currency(companyTotals[c.key])}</p>
              </div>
            ))}
            <div className="rounded-2xl p-4 text-white shadow-md bg-gradient-to-br from-[#0F172A] to-[#334155]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Grand Total</p>
              <p className="text-xl font-extrabold mt-1 tabular-nums">{currency(grandTotal)}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
            <AccountsChartCard
              title="Company Share"
              subtitle="BEM · GPS · BDS mix"
              accent="#0D9488"
              icon={<Building2 size={16} />}
            >
              <RechartsBox height={240}>
                {(() => {
                  const pieData = ASSETS_COMPANIES
                    .map(c => ({ name: c.label, value: companyTotals[c.key] || 0, color: c.accent }))
                    .filter(d => d.value > 0);
                  const data = pieData.length ? pieData : [{ name: "Empty", value: 1, color: "#E2E8F0" }];
                  return (
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {data.map(d => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => currency(Number(v ?? 0))} />
                    </PieChart>
                  );
                })()}
              </RechartsBox>
            </AccountsChartCard>

            <AccountsChartCard
              title="Company Comparison"
              subtitle="Total assets by company"
              accent="#F59E0B"
              icon={<BarChart3 size={16} />}
            >
              <RechartsBox height={240}>
                <BarChart
                  data={ASSETS_COMPANIES.map(c => ({
                    name: c.label,
                    value: companyTotals[c.key],
                    fill: c.accent,
                  }))}
                  barSize={42}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {ASSETS_COMPANIES.map(c => (
                      <Cell key={c.key} fill={c.accent} />
                    ))}
                  </Bar>
                </BarChart>
              </RechartsBox>
            </AccountsChartCard>
          </section>

          <section id="assets-register" className="mt-5 space-y-5 scroll-mt-24">
            {ASSETS_COMPANIES.map(c => (
              <ExpandableHeadsTable
                key={c.key}
                title={`${c.label} — Asset Heads`}
                accent={c.accent}
                addLabel={`Add Head (${c.label})`}
                emptyLabel={`No heads for ${c.label} yet.`}
                rows={(companies[c.key] ?? []).map(sectionToHead)}
                onChange={(rows, opts) => setCompanySections(c.key, rows, opts)}
                onPersist={() => void acc.save()}
                saving={acc.saving}
              />
            ))}
            <p className="text-right font-extrabold text-[#0F172A] pt-2">
              Grand Total (all companies): {currency(grandTotal)}
            </p>
          </section>
        </AccountsPageShell>
      </main>
    </div>
  );
}
