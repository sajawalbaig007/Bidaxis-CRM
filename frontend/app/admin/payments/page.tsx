"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Percent,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Cell, Pie, PieChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { apiErrorMessage } from "@/lib/api";
import { useStaffSidebar } from "@/app/hooks/useStaffSidebar";
import DashboardNavbar from "@/app/admin/components/layout/Navbar";
import RechartsBox from "@/app/components/charts/RechartsBox";
import {
  CHANNEL_STYLES,
  currentMonthIso,
  fetchPaymentsSummary,
  formatMoney,
  formatMoneyAlways,
  type PaymentsSummaryPayload,
  type ProjectPaymentSummaryRow,
} from "@/lib/paymentsSummary";

const STATUS_COLORS = {
  paid: "#22C55E",
  partial: "#F59E0B",
  unpaid: "#EF4444",
};

function CurrencyLines({
  totals,
}: {
  totals: { USD: number; CAD: number; PKR: number };
}) {
  const rows = [
    { key: "USD", value: totals.USD },
    { key: "CAD", value: totals.CAD },
    { key: "PKR", value: totals.PKR },
  ].filter((r) => r.value > 0);

  if (rows.length === 0) {
    return <p className="text-[11px] text-crm-text-faint mt-1">No currency yet</p>;
  }

  return (
    <div className="mt-2 space-y-0.5">
      {rows.map((r) => (
        <p key={r.key} className="text-[11px] text-crm-text-muted tabular-nums">
          <span className="font-bold text-crm-text-faint uppercase mr-1">{r.key}</span>
          {formatMoneyAlways(r.value, r.key)}
        </p>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  border,
  children,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  border: string;
  children?: React.ReactNode;
  icon: typeof DollarSign;
}) {
  return (
    <div
      className={`bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-sm p-4 sm:p-5 border-t-4 ${border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-crm-text-muted">
          {title}
        </p>
        <span className="w-8 h-8 rounded-xl bg-crm-muted flex items-center justify-center text-crm-text-muted shrink-0">
          <Icon size={15} />
        </span>
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold text-crm-text tracking-tight tabular-nums mt-2 leading-none">
        {value}
      </p>
      <p className="text-[11px] text-crm-text-faint mt-1.5">{hint}</p>
      {children}
    </div>
  );
}

function ProjectList({
  title,
  subtitle,
  rows,
  tone,
  emptyText,
}: {
  title: string;
  subtitle: string;
  rows: ProjectPaymentSummaryRow[];
  tone: "emerald" | "amber" | "red";
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toneCls =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/10"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-500/10"
        : "border-red-100 bg-red-50/40 dark:border-red-500/20 dark:bg-red-500/10";
  const badgeCls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300";

  return (
    <section className="bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-sm overflow-hidden">
      <div className={`px-4 sm:px-5 py-4 border-b ${toneCls}`}>
        <h2 className="text-sm font-bold text-crm-text flex items-center gap-2">
          {tone === "emerald" ? (
            <CheckCircle2 size={16} className="text-emerald-600" />
          ) : tone === "amber" ? (
            <AlertCircle size={16} className="text-amber-600" />
          ) : (
            <AlertCircle size={16} className="text-red-600" />
          )}
          {title}
          <span className={`ml-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${badgeCls}`}>
            {rows.length}
          </span>
        </h2>
        <p className="text-[11px] text-crm-text-muted mt-0.5">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-crm-text-faint">{emptyText}</p>
      ) : (
        <div className="divide-y divide-crm-border-subtle max-h-[420px] overflow-y-auto">
          {rows.map((p) => {
            const open = expanded[p.leadId] ?? false;
            return (
              <div key={p.leadId} className="px-4 sm:px-5 py-3">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [p.leadId]: !open }))}
                  className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.projectCode ? (
                        <span className="text-[10px] font-bold text-[#B8112D] bg-[#FFF1F3] dark:bg-crm-brand-soft px-1.5 py-0.5 rounded">
                          {p.projectCode}
                        </span>
                      ) : null}
                      <span className="font-semibold text-sm text-crm-text truncate">
                        {p.projectTitle || "Untitled"}
                      </span>
                    </div>
                    <p className="text-[11px] text-crm-text-muted mt-0.5">
                      Quoted {p.quotedLabel} · Collected {p.paidLabel} · {p.percent}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${badgeCls}`}>
                      {p.payments.length} payment{p.payments.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-crm-text-faint transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
                {open && p.payments.length > 0 ? (
                  <ul className="mt-3 space-y-2 pl-1">
                    {p.payments.map((pay) => (
                      <li
                        key={pay.id}
                        className="text-[11px] sm:text-xs rounded-xl border border-crm-border-subtle bg-crm-surface-muted px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                      >
                        <div>
                          <span className="font-bold text-crm-text">{pay.type}</span>
                          <span className="text-crm-text-faint mx-1.5">·</span>
                          <span className="font-semibold text-emerald-600">
                            {formatMoney(pay.amountNum, pay.currency)}
                          </span>
                          {!pay.channel ? (
                            <span className="ml-2 text-[10px] font-bold text-red-700 bg-red-50 dark:bg-red-500/15 px-1.5 py-0.5 rounded">
                              No channel
                            </span>
                          ) : null}
                        </div>
                        <div className="text-crm-text-muted">
                          {pay.channelLabel}
                          {pay.currency ? ` · ${pay.currency}` : ""}
                          {pay.accountsMonth ? ` · ${pay.accountsMonth}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function AdminPaymentsPage() {
  const StaffSidebar = useStaffSidebar();
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/manager") ? "/manager" : "/admin";

  const [month, setMonth] = useState<string>("");
  const [data, setData] = useState<PaymentsSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPaymentsSummary(month || null);
      setData(res);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load payments summary"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.totals;
  const status = data?.statusBreakdown;
  const channels = data?.channels ?? [];

  const statusPie = useMemo(() => {
    if (!status) return [];
    return [
      { name: "Paid", value: status.paid, color: STATUS_COLORS.paid },
      { name: "Partial", value: status.partial, color: STATUS_COLORS.partial },
      { name: "Unpaid", value: status.unpaid, color: STATUS_COLORS.unpaid },
    ].filter((d) => d.value > 0);
  }, [status]);

  const sourceBars = useMemo(
    () =>
      channels.map((ch) => ({
        key: ch.key,
        name: ch.label.split(" ")[0] === "Ahmed" || ch.label.split(" ")[0] === "Sharjeel"
          ? ch.label.split(" ").slice(0, 2).join(" ")
          : ch.label,
        short: ch.key,
        amount: ch.totalAmount,
        fill: CHANNEL_STYLES[ch.key].color,
        payments: ch.paymentCount,
      })),
    [channels],
  );

  const maxSource = Math.max(...sourceBars.map((s) => s.amount), 1);

  const lastUpdated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="flex min-h-screen bg-[#F0F2F8] dark:bg-crm-bg-subtle">
      <Toaster position="top-right" />
      <StaffSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-16">
        <DashboardNavbar />
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5">
          {/* Header */}
          <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#B8112D] mb-1">
                <Wallet size={13} />
                Collections
              </div>
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-crm-text tracking-tight">
                Payments Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-crm-text-muted mt-0.5 max-w-xl">
                Quoted · collected · outstanding · by source (Ahmed Hamza, Sharjeel Nasir, Cheque, Habib Metro)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-10 sm:h-11 px-3 rounded-xl border border-crm-border bg-crm-surface text-xs font-semibold text-crm-text-secondary inline-flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t?.projectCount ?? 0} projects · Updated {lastUpdated}
              </div>
              <Link
                href={`${basePath}/active-projects`}
                className="h-10 sm:h-11 px-4 rounded-xl border border-crm-border bg-crm-surface text-sm font-semibold text-crm-text-secondary inline-flex items-center justify-center hover:border-[#B8112D]/40"
              >
                Project DB
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </header>

          {/* Filters */}
          <section className="bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
            <div className="inline-flex p-1 rounded-full bg-crm-nav-pill border border-crm-border gap-1">
              <button
                type="button"
                onClick={() => setMonth("")}
                className={`h-8 px-3 rounded-full text-xs font-bold transition-colors ${
                  !month ? "bg-[#B8112D] text-white shadow-sm" : "text-crm-text-muted hover:text-crm-text"
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setMonth(currentMonthIso())}
                className={`h-8 px-3 rounded-full text-xs font-bold transition-colors ${
                  month === currentMonthIso()
                    ? "bg-[#B8112D] text-white shadow-sm"
                    : "text-crm-text-muted hover:text-crm-text"
                }`}
              >
                This Month
              </button>
            </div>
            <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-crm-border bg-crm-input text-sm font-semibold text-crm-text-secondary">
              <span className="text-[11px] text-crm-text-faint uppercase">Month</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="outline-none bg-transparent text-sm font-semibold text-crm-text"
              />
            </label>
            <p className="text-xs text-crm-text-muted sm:ml-auto">
              Showing <span className="font-bold text-crm-text">{data?.monthLabel ?? "All time"}</span>
              {t ? ` · ${t.projectCount} projects` : ""}
            </p>
          </section>

          {(t?.unassignedPaidCount ?? 0) > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                <span className="font-bold">{t!.unassignedPaidCount} paid entr{t!.unassignedPaidCount === 1 ? "y" : "ies"}</span>
                {" "}missing channel/currency — set in Project DB so source totals update.
              </p>
              <Link href={`${basePath}/active-projects`} className="text-xs font-bold text-[#B8112D] hover:underline shrink-0">
                Fix in Project DB →
              </Link>
            </div>
          ) : null}

          {/* KPI cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard
              title="Total Quoted"
              value={loading && !data ? "…" : formatMoneyAlways(t?.quotedAmount ?? 0)}
              hint={`${t?.quotedProjects ?? 0} projects with quote`}
              border="border-t-blue-500"
              icon={DollarSign}
            >
              <CurrencyLines
                totals={{
                  USD: t?.quotedAmount ?? 0,
                  CAD: 0,
                  PKR: 0,
                }}
              />
            </KpiCard>
            <KpiCard
              title="Collected"
              value={loading && !data ? "…" : formatMoneyAlways(t?.collectedAmount ?? 0)}
              hint={`${t?.collectedEntries ?? 0} payment entries`}
              border="border-t-emerald-500"
              icon={TrendingUp}
            >
              {t?.collectedByCurrency ? <CurrencyLines totals={t.collectedByCurrency} /> : null}
            </KpiCard>
            <KpiCard
              title="Outstanding"
              value={loading && !data ? "…" : formatMoneyAlways(t?.outstandingAmount ?? 0)}
              hint={`${t?.unpaidWithQuoteCount ?? 0} unpaid · ${t?.partialPaidCount ?? 0} partial`}
              border="border-t-red-500"
              icon={AlertCircle}
            />
            <KpiCard
              title="Collection Rate"
              value={loading && !data ? "…" : `${t?.collectionRate ?? 0}%`}
              hint={`of total quoted`}
              border="border-t-sky-500"
              icon={Percent}
            >
              <div className="mt-3 w-full h-2 rounded-full bg-crm-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${Math.min(100, t?.collectionRate ?? 0)}%` }}
                />
              </div>
              <p className="text-[11px] text-crm-text-muted mt-1.5 tabular-nums">
                {formatMoneyAlways(t?.collectedAmount ?? 0)} of {formatMoneyAlways(t?.quotedAmount ?? 0)} quoted
              </p>
            </KpiCard>
          </section>

          {/* Charts row */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Payment status donut */}
            <div className="bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-sm p-4 sm:p-5">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-crm-text-muted mb-3">
                Payment Status
              </h2>
              {statusPie.length === 0 ? (
                <p className="text-sm text-crm-text-faint text-center py-12">No status data</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <RechartsBox height={180} className="w-full sm:w-[180px] shrink-0">
                    <PieChart>
                      <Pie
                        data={statusPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {statusPie.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [String(value ?? 0), "Projects"]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--crm-border)",
                          background: "var(--crm-surface)",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </RechartsBox>
                  <ul className="space-y-2 w-full">
                    {[
                      { label: "Paid", value: status?.paid ?? 0, color: STATUS_COLORS.paid },
                      { label: "Partial", value: status?.partial ?? 0, color: STATUS_COLORS.partial },
                      { label: "Unpaid", value: status?.unpaid ?? 0, color: STATUS_COLORS.unpaid },
                    ].map((row) => (
                      <li key={row.label} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-crm-text-secondary font-medium">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                          {row.label}
                        </span>
                        <span className="font-bold text-crm-text tabular-nums">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Sources bar chart */}
            <div className="bg-crm-surface rounded-2xl border border-crm-border-subtle shadow-sm p-4 sm:p-5 lg:col-span-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-crm-text-muted mb-1">
                Collected by Source
              </h2>
              <p className="text-[11px] text-crm-text-faint mb-3">
                Ahmed Hamza · Sharjeel Nasir · Cheque · Habib Metro
              </p>
              <RechartsBox height={200}>
                <BarChart data={sourceBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="short"
                    tick={{ fontSize: 11, fill: "var(--crm-text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--crm-text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value) => [formatMoneyAlways(Number(value ?? 0)), "Collected"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { name?: string } | undefined;
                      return row?.name ?? "";
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--crm-border)",
                      background: "var(--crm-surface)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {sourceBars.map((s) => (
                      <Cell key={s.key} fill={s.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </RechartsBox>
            </div>
          </section>

          {/* Source cards */}
          <section>
            <h2 className="text-sm font-bold text-crm-text mb-3">
              Sources · {data?.monthLabel ?? "All time"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {channels.map((ch) => {
                const style = CHANNEL_STYLES[ch.key];
                const pct = Math.round((ch.totalAmount / maxSource) * 100);
                return (
                  <div
                    key={ch.key}
                    className={`rounded-2xl border ${style.border} ${style.soft} bg-crm-surface p-4 shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: style.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-crm-text-muted">
                            {ch.key}
                          </span>
                        </div>
                        <h3 className="font-bold text-crm-text text-sm mt-1">{ch.label}</h3>
                      </div>
                      <span className="text-[11px] font-bold bg-crm-surface border border-crm-border-subtle px-2 py-0.5 rounded-lg text-crm-text-muted">
                        {ch.paymentCount} paid
                      </span>
                    </div>
                    <p className="text-xl font-extrabold text-crm-text tabular-nums mt-3 tracking-tight">
                      {formatMoneyAlways(ch.totalAmount)}
                    </p>
                    <p className="text-[11px] text-crm-text-faint mt-0.5">
                      {ch.projectCount} project{ch.projectCount === 1 ? "" : "s"}
                      {ch.activeCurrencies.length > 0
                        ? ` · ${ch.activeCurrencies.join(" / ")}`
                        : " · No currency"}
                    </p>
                    <div className="mt-3 w-full h-1.5 rounded-full bg-crm-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: style.color }}
                      />
                    </div>
                    <CurrencyLines totals={ch.totals} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Project lists */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ProjectList
              title="Full paid"
              subtitle="Quoted amount fully collected"
              rows={data?.fullPaidProjects ?? []}
              tone="emerald"
              emptyText="No fully paid projects in this period."
            />
            <ProjectList
              title="Partial paid"
              subtitle="Expand to see channel & amount"
              rows={data?.partialPaidProjects ?? []}
              tone="amber"
              emptyText="No partial payments in this period."
            />
            <ProjectList
              title="Unpaid (with quote)"
              subtitle="Quoted but nothing collected yet"
              rows={data?.unpaidProjects ?? []}
              tone="red"
              emptyText="No unpaid quoted projects."
            />
          </div>
        </div>
      </main>
    </div>
  );
}
