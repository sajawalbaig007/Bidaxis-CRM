"use client";

import { useEffect, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { PieChart as PieIcon, Users, Layers3, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import AccountsSidebar from "../components/layout/Sidebar";
import AccountsPageShell from "../components/AccountsPageShell";
import AccountsChartCard, { CHART_COLORS } from "../components/AccountsChartCard";
import ExpandableHeadsTable, { type ExpandableHeadRow } from "../components/ExpandableHeadsTable";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { accountsShellProps } from "../utils/accountsShellProps";
import { useAccountsPage } from "../hooks/useAccountsPage";
import type { IncomeStatementData, OpexRow, TeamSalaryRow } from "../types";
import { currency, lineAmount, newRowId, todayIso } from "../types";
import { ensureIncomeStatementPeople, seededIncomeStatementData } from "../utils/incomeStatementSeed";
import { normalizeSalesTeamSubs, isSalesTeamTitle } from "../utils/salesPayrollBridge";

function defaultData(): IncomeStatementData {
  return ensureIncomeStatementPeople(seededIncomeStatementData());
}

function teamToHead(t: TeamSalaryRow): ExpandableHeadRow {
  const subHeads = isSalesTeamTitle(t.team, t.subHeads)
    ? normalizeSalesTeamSubs(t.subHeads, t.team)
    : (t.subHeads ?? []);
  return {
    id: t.id,
    title: t.team,
    amount: lineAmount({ subHeads }),
    filledAt: t.filledAt,
    subHeads,
    notes: t.notes ?? [],
  };
}

function opexToHead(o: OpexRow): ExpandableHeadRow {
  return {
    id: o.id,
    title: o.label,
    amount: o.amount,
    filledAt: o.filledAt,
    subHeads: o.subHeads ?? [],
    notes: o.notes ?? [],
  };
}

function headToTeam(h: ExpandableHeadRow): TeamSalaryRow {
  return {
    id: h.id,
    team: h.title,
    totalSalary: lineAmount(h),
    filledAt: h.filledAt,
    subHeads: h.subHeads ?? [],
    notes: h.notes ?? [],
  };
}

function headToOpex(h: ExpandableHeadRow): OpexRow {
  return {
    id: h.id,
    label: h.title,
    amount: lineAmount(h),
    filledAt: h.filledAt,
    subHeads: h.subHeads ?? [],
    notes: h.notes ?? [],
  };
}

export default function IncomeStatementPage() {
  const acc = useAccountsPage<IncomeStatementData>({ page: "income_statement", defaultData });
  const syncToastRef = useRef(false);

  /** Always apply sales-team split + payroll migration */
  const data = useMemo(() => ensureIncomeStatementPeople(acc.data), [acc.data]);

  useLayoutEffect(() => {
    if (acc.loading) return;
    const before = JSON.stringify(acc.data);
    const after = JSON.stringify(data);
    if (before !== after) {
      acc.setData(() => data);
      if (!syncToastRef.current) {
        syncToastRef.current = true;
        toast.success("Sales Team split updated — Hammad moved to Team Lead. Click Save to keep.");
      }
    }
  }, [acc.loading, acc.data, data, acc.setData]);

  useEffect(() => {
    syncToastRef.current = false;
  }, [acc.recordDate]);

  const uploadOpexProof = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await API.post(`/accounts/income_statement/${acc.recordDate}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const upload = res.data?.upload;
      if (!upload?.fileUrl) throw new Error("No file URL returned");
      toast.success("Screenshot uploaded.");
      return { fileUrl: String(upload.fileUrl), fileName: String(upload.fileName ?? file.name) };
    } catch (err) {
      toast.error(apiErrorMessage(err, "Proof upload failed."));
      throw err;
    }
  }, [acc.recordDate]);

  const payrollExpense = useMemo(
    () => (data.teamSalaries ?? []).reduce((a, t) => a + lineAmount(t), 0),
    [data.teamSalaries],
  );
  const operatingExpense = useMemo(
    () => (data.opexHeads ?? []).reduce((a, o) => a + lineAmount(o), 0),
    [data.opexHeads],
  );
  const loanExpense = useMemo(
    () => (data.loanHeads ?? []).reduce((a, o) => a + lineAmount(o), 0),
    [data.loanHeads],
  );
  const pfExpense = useMemo(
    () => (data.providentFundHeads ?? []).reduce((a, o) => a + lineAmount(o), 0),
    [data.providentFundHeads],
  );
  const totalExpense = payrollExpense + operatingExpense + loanExpense + pfExpense;
  const revenue = Number(data.totalRevenue) || 0;
  const netProfit = revenue - totalExpense;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const payrollChartData = (data.teamSalaries ?? []).map(t => ({
    name: t.team.replace(/ Salaries$/i, "").slice(0, 14),
    value: lineAmount(t),
  }));

  const expenseMix = [
    { name: "Payroll", value: payrollExpense, color: "#0B84F3" },
    { name: "OPEX", value: operatingExpense, color: "#F59E0B" },
    { name: "Loans", value: loanExpense, color: "#EA580C" },
    { name: "PF", value: pfExpense, color: "#0D9488" },
  ].filter(d => d.value > 0);

  const stackCompare = [
    { name: "Revenue", amount: revenue, fill: "#0B84F3" },
    { name: "Expense", amount: totalExpense, fill: "#B8112D" },
    { name: "Profit", amount: netProfit, fill: "#12B76A" },
  ];

  const opexBars = (data.opexHeads ?? [])
    .map(o => ({ name: o.label.slice(0, 18), value: lineAmount(o) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const tablesSummary = [
    { name: "Team Salaries", value: payrollExpense, fill: "#0B84F3" },
    { name: "OPEX", value: operatingExpense, fill: "#F59E0B" },
    { name: "Loans", value: loanExpense, fill: "#EA580C" },
    { name: "Provident Fund", value: pfExpense, fill: "#0D9488" },
  ].filter(d => d.value > 0);

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_#F8FAFC_0%,_#EEF1F7_45%,_#E8ECF4_100%)]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <AccountsPageShell
          {...accountsShellProps(acc)}
          title="Income Statement"
          subtitle="Team Salaries (Technical / Sales / Sales Lead) — expand a team, open Edit for full payroll fields."
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
                  subHeads: [{ id: newRowId("sub"), label: "New person", amount: 0, filledAt: todayIso() }],
                },
              ],
            }));
          }}
          addNewLabel="Add Team"
        >
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
            {[
              { label: "Payroll", value: payrollExpense, cls: "from-[#0B84F3] to-[#0369A1]" },
              { label: "Loans", value: loanExpense, cls: "from-[#EA580C] to-[#C2410C]" },
              { label: "Provident Fund", value: pfExpense, cls: "from-[#0D9488] to-[#0F766E]" },
              { label: "Total Expense", value: totalExpense, cls: "from-[#B8112D] to-[#8b0d22]" },
              { label: "Net Profit", value: netProfit, cls: "from-[#12B76A] to-[#027A48]" },
            ].map(c => (
              <div key={c.label} className={`bg-gradient-to-br ${c.cls} rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{c.label}</p>
                <p className="text-lg sm:text-xl font-extrabold mt-1 tabular-nums">{currency(Number(c.value) || 0)}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-5">
            <AccountsChartCard
              title="Expense Mix"
              subtitle="Share of payroll, OPEX, loans & PF"
              accent="#B8112D"
              icon={<PieIcon size={16} />}
            >
              <RechartsBox height={240}>
                <PieChart>
                  <Pie
                    data={expenseMix.length ? expenseMix : [{ name: "Empty", value: 1, color: "#E2E8F0" }]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {(expenseMix.length ? expenseMix : [{ color: "#E2E8F0" }]).map((d, i) => (
                      <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                </PieChart>
              </RechartsBox>
            </AccountsChartCard>

            <AccountsChartCard
              title="Team Salaries"
              subtitle="Payroll by team"
              accent="#0B84F3"
              icon={<Users size={16} />}
            >
              <RechartsBox height={240}>
                <BarChart data={payrollChartData.length ? payrollChartData : [{ name: "—", value: 0 }]} barSize={28}>
                  <defs>
                    <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0B84F3" stopOpacity={1} />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  <Bar dataKey="value" fill="url(#payGrad)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </RechartsBox>
            </AccountsChartCard>

            <AccountsChartCard
              title="Revenue · Expense · Profit"
              subtitle="Saved revenue vs current expenses"
              accent="#12B76A"
              icon={<TrendingUp size={16} />}
              className="lg:col-span-2 xl:col-span-1"
            >
              <RechartsBox height={240}>
                <BarChart data={stackCompare} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  <Bar dataKey="amount" radius={[12, 12, 0, 0]}>
                    {stackCompare.map(item => (
                      <Cell key={item.name} fill={item.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </RechartsBox>
            </AccountsChartCard>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
            <AccountsChartCard
              title="All Tables Summary"
              subtitle="Team · OPEX · Loans · Provident Fund"
              accent="#0B84F3"
              icon={<PieIcon size={16} />}
              className="lg:col-span-7"
            >
              <RechartsBox height={210}>
                <BarChart
                  data={tablesSummary.length ? tablesSummary : [{ name: "—", value: 0, fill: "#E2E8F0" }]}
                  barSize={36}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {(tablesSummary.length ? tablesSummary : [{ fill: "#E2E8F0" }]).map((d, i) => (
                      <Cell key={i} fill={d.fill || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </RechartsBox>
            </AccountsChartCard>

            <AccountsChartCard
              title="Top Operating Expenses"
              subtitle="Largest OPEX heads"
              accent="#F59E0B"
              icon={<Layers3 size={16} />}
              className="lg:col-span-5"
            >
              <RechartsBox height={210}>
                <BarChart
                  data={opexBars.length ? opexBars : [{ name: "—", value: 0 }]}
                  layout="vertical"
                  margin={{ left: 4, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 9, fontWeight: 600 }} />
                  <Tooltip formatter={v => currency(Number(v ?? 0))} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={14}>
                    {(opexBars.length ? opexBars : [{ name: "—" }]).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </RechartsBox>
            </AccountsChartCard>
          </section>

          <section className="mt-5 space-y-5">
            <ExpandableHeadsTable
              title="Team Salaries"
              accent="#0B84F3"
              addLabel="Add Team"
              salaryMode
              rows={(data.teamSalaries ?? []).map(teamToHead)}
              onChange={rows => acc.setData(prev => ({ ...ensureIncomeStatementPeople(prev), teamSalaries: rows.map(headToTeam) }))}
            />

            <ExpandableHeadsTable
              title="Operating Expenses"
              accent="#F59E0B"
              addLabel="Add OPEX"
              rows={(data.opexHeads ?? []).map(opexToHead)}
              onChange={rows => acc.setData(prev => ({ ...ensureIncomeStatementPeople(prev), opexHeads: rows.map(headToOpex) }))}
              allowProofUpload
              onUploadProof={uploadOpexProof}
            />

            <ExpandableHeadsTable
              title="Loans"
              accent="#EA580C"
              addLabel="Add Loan Head"
              rows={(data.loanHeads ?? []).map(opexToHead)}
              onChange={rows => acc.setData(prev => ({ ...ensureIncomeStatementPeople(prev), loanHeads: rows.map(headToOpex) }))}
            />

            <ExpandableHeadsTable
              title="Provident Fund"
              accent="#0D9488"
              addLabel="Add PF Head"
              rows={(data.providentFundHeads ?? []).map(opexToHead)}
              onChange={rows => acc.setData(prev => ({ ...ensureIncomeStatementPeople(prev), providentFundHeads: rows.map(headToOpex) }))}
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
