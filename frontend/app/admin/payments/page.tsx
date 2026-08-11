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
  PieChart,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useStaffSidebar } from "@/app/hooks/useStaffSidebar";
import DashboardNavbar from "@/app/admin/components/layout/Navbar";
import {
  CHANNEL_STYLES,
  fetchPaymentsSummary,
  formatMoney,
  type PaymentsSummaryPayload,
  type ProjectPaymentSummaryRow,
} from "@/lib/paymentsSummary";

function CurrencyBreakdown({
  totals,
  active,
}: {
  totals: { USD: number; CAD: number; PKR: number };
  active: string[];
}) {
  const rows = [
    { key: "USD", value: totals.USD },
    { key: "CAD", value: totals.CAD },
    { key: "PKR", value: totals.PKR },
  ].filter((r) => r.value > 0 || active.includes(r.key));

  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 mt-2">No collections yet</p>;
  }

  return (
    <div className="mt-3 space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-500 uppercase">{r.key}</span>
          <span className="font-semibold text-[#0F172A] tabular-nums">{formatMoney(r.value, r.key)}</span>
        </div>
      ))}
    </div>
  );
}

function ProjectPaymentsTable({
  title,
  subtitle,
  rows,
  tone,
  emptyText,
}: {
  title: string;
  subtitle: string;
  rows: ProjectPaymentSummaryRow[];
  tone: "emerald" | "amber";
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div
        className={`px-4 sm:px-5 py-4 border-b ${
          tone === "emerald" ? "border-emerald-100 bg-emerald-50/40" : "border-amber-100 bg-amber-50/40"
        }`}
      >
        <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
          {tone === "emerald" ? (
            <CheckCircle2 size={16} className="text-emerald-600" />
          ) : (
            <AlertCircle size={16} className="text-amber-600" />
          )}
          {title}
          <span
            className={`ml-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
              tone === "emerald" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {rows.length}
          </span>
        </h2>
        <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="divide-y divide-gray-50">
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
                        <span className="text-[10px] font-bold text-[#B8112D] bg-[#FFF1F3] px-1.5 py-0.5 rounded">
                          {p.projectCode}
                        </span>
                      ) : null}
                      <span className="font-semibold text-sm text-[#0F172A] truncate">
                        {p.projectTitle || "Untitled"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Quoted {p.quotedLabel} · Collected {p.paidLabel} · {p.percent}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                        tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {p.payments.length} payment{p.payments.length === 1 ? "" : "s"}
                    </span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {open && p.payments.length > 0 ? (
                  <ul className="mt-3 space-y-2 pl-1">
                    {p.payments.map((pay) => (
                      <li
                        key={pay.id}
                        className="text-[11px] sm:text-xs rounded-xl border border-gray-100 bg-[#FAFBFC] px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                      >
                        <div>
                          <span className="font-bold text-[#0F172A]">{pay.type}</span>
                          <span className="text-gray-400 mx-1.5">·</span>
                          <span className="font-semibold text-emerald-700">
                            {formatMoney(pay.amountNum, pay.currency)}
                          </span>
                          {pay.isPartialType ? (
                            <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              Partial
                            </span>
                          ) : null}
                        </div>
                        <div className="text-gray-500">
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
    } catch {
      toast.error("Failed to load payments summary");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const summaryCards = useMemo(() => {
    const t = data?.totals;
    return [
      {
        label: "Total quoted",
        value: t ? formatMoney(t.quotedAmount) : "—",
        hint: t ? `${t.quotedProjects} projects` : "",
        icon: DollarSign,
        tone: "from-[#0B84F3] to-[#0369A1]",
      },
      {
        label: "Full paid",
        value: t ? String(t.fullPaidCount) : "—",
        hint: "100% collected",
        icon: CheckCircle2,
        tone: "from-[#059669] to-[#047857]",
      },
      {
        label: "Partial paid",
        value: t ? String(t.partialPaidCount) : "—",
        hint: "In progress",
        icon: PieChart,
        tone: "from-[#D97706] to-[#B45309]",
      },
      {
        label: "Payment entries",
        value: t ? String(t.collectedEntries) : "—",
        hint: data?.monthLabel ?? "All time",
        icon: Receipt,
        tone: "from-[#7C3AED] to-[#5B21B6]",
      },
    ];
  }, [data]);

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <Toaster position="top-right" />
      <StaffSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-16">
        <DashboardNavbar />
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#B8112D] mb-1">
                <Wallet size={13} />
                Payment channels
              </div>
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">
                Collections Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 max-w-xl">
                Ahmed Hamza · Sharjeel Nasir · Cheque · Habib Metro — per source amounts, quoted totals, partial & full paid projects.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <label className="flex items-center gap-2 h-10 sm:h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm">
                <span className="text-[11px] text-gray-400 uppercase">Month</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="outline-none bg-transparent text-sm font-semibold text-[#0F172A]"
                />
                {month ? (
                  <button
                    type="button"
                    onClick={() => setMonth("")}
                    className="text-[10px] font-bold text-[#B8112D] hover:underline ml-1"
                  >
                    All
                  </button>
                ) : null}
              </label>
              <Link
                href={`${basePath}/active-projects`}
                className="h-10 sm:h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 inline-flex items-center justify-center hover:border-[#B8112D]/40"
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

          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {summaryCards.map((c) => (
              <div
                key={c.label}
                className={`bg-gradient-to-br ${c.tone} rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md min-h-24 flex flex-col gap-1.5`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-white/75 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                    {c.label}
                  </span>
                  <span className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                    <c.icon size={14} />
                  </span>
                </div>
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums leading-none">
                  {loading && !data ? "…" : c.value}
                </span>
                <p className="text-[10px] sm:text-[11px] text-white/70 mt-auto">{c.hint}</p>
              </div>
            ))}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[#0F172A]">
                By source · {data?.monthLabel ?? "All time"}
              </h2>
              <p className="text-[11px] text-gray-400">Amounts shown in each entry&apos;s currency</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {(data?.channels ?? []).map((ch) => {
                const style = CHANNEL_STYLES[ch.key];
                return (
                  <div
                    key={ch.key}
                    className={`rounded-2xl border ${style.border} bg-gradient-to-br ${style.from} ${style.to} p-4 shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: style.dot }} />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{ch.key}</span>
                        </div>
                        <h3 className="font-bold text-[#0F172A] text-sm mt-1">{ch.label}</h3>
                      </div>
                      <span className="text-[11px] font-bold bg-white/80 border border-gray-100 px-2 py-0.5 rounded-lg text-gray-600">
                        {ch.paymentCount} paid
                      </span>
                    </div>
                    {ch.activeCurrencies.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ch.activeCurrencies.map((cur) => (
                          <span
                            key={cur}
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white border border-gray-100 text-gray-600"
                          >
                            {cur}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-2">No currency recorded</p>
                    )}
                    <CurrencyBreakdown totals={ch.totals} active={ch.activeCurrencies} />
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ProjectPaymentsTable
              title="Full paid projects"
              subtitle="Quoted amount fully collected"
              rows={data?.fullPaidProjects ?? []}
              tone="emerald"
              emptyText="No fully paid projects in this period."
            />
            <ProjectPaymentsTable
              title="Partial paid projects"
              subtitle="Expand to see which partial payments & channel"
              rows={data?.partialPaidProjects ?? []}
              tone="amber"
              emptyText="No partial payments in this period."
            />
          </div>
        </div>
      </main>
    </div>
  );
}
